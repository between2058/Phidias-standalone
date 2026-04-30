/**
 * Developer-Faceted E2E Tests — API Contract Suite
 *
 * Perspective: Code / Developer
 * Strategy:
 *   - Every test sends an actual HTTP request to a live Next.js route handler
 *     (via `request.fetch()` against the running dev server).
 *   - We intercept requests that would go to the *upstream backend* (the real
 *     Python phidias service) using `page.route()` so no real backend is needed.
 *   - This validates that each Next.js proxy route:
 *       1. Forwards the request to the correct upstream path
 *       2. Reshapes the upstream response body as documented
 *       3. Propagates error status codes without modification
 *
 * File layout:
 *   e2e/developer/api-contracts.spec.ts
 */

import { test, expect, type Page, type Route } from '@playwright/test';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** A tiny 1×1 PNG in binary, used wherever the API expects an image file. */
const TINY_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal GLB buffer (12-byte header + empty chunk list) */
const TINY_GLB_BYTES = Buffer.from(
  '676c544600000000' + // magic "glTF" + version 2
  '0c000000' + // total length: 12 bytes
  '00000000' + // JSON chunk length 0 (not valid glb but enough to be a blob)
  '4e4f534a', // chunkType = JSON
  'hex',
);

/**
 * Mock a single upstream call to a phidias backend path and return the
 * given JSON body + status code.
 */
async function mockUpstream(
  page: Page,
  urlPattern: string | RegExp,
  body: unknown,
  status = 200,
) {
  await page.route(urlPattern, (route: Route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Mock an upstream path that returns a binary blob (e.g. GLB download).
 */
async function mockUpstreamBlob(
  page: Page,
  urlPattern: string | RegExp,
  data: Buffer,
  contentType = 'application/octet-stream',
  status = 200,
) {
  await page.route(urlPattern, (route: Route) => {
    route.fulfill({ status, contentType, body: data });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite: Qwen routes  (/api/phidias/qwen/...)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('API contract — Qwen routes', () => {
  // ── text2img ────────────────────────────────────────────────────────────────

  test('POST /api/phidias/qwen/text2img — success response is reshaped correctly', async ({
    page,
    request,
  }) => {
    // Mock the upstream phidias backend text2img call
    await mockUpstream(page, /\/phidias\/qwen\/text2img/, {
      request_id: 'req-t2i-001',
      urls: [],
      seeds: [42],
    });

    // Also mock the download call since the route downloads each image
    await mockUpstreamBlob(
      page,
      /\/phidias\/qwen\/download\/.*/,
      TINY_PNG_BYTES,
      'image/png',
    );

    const res = await request.post('/api/phidias/qwen/text2img', {
      data: { prompt: 'a red cube', num_samples: 1 },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'success',
      request_id: expect.any(String),
      urls: expect.any(Array),
      seeds: expect.any(Array),
    });
  });

  test('POST /api/phidias/qwen/text2img — upstream 503 is propagated as-is', async ({
    page,
    request,
  }) => {
    await mockUpstream(
      page,
      /\/phidias\/qwen\/text2img/,
      { error: 'service unavailable' },
      503,
    );

    const res = await request.post('/api/phidias/qwen/text2img', {
      data: { prompt: 'a cube' },
    });

    expect(res.status()).toBe(503);
  });

  test('GET /api/phidias/qwen/text2img — is forwarded to upstream', async ({
    page,
    request,
  }) => {
    let capturedUrl = '';
    await page.route(/\/phidias\/qwen\/text2img/, (route) => {
      capturedUrl = route.request().url();
      route.fulfill({ status: 200, body: '{}', contentType: 'application/json' });
    });

    await request.get('/api/phidias/qwen/text2img');

    expect(capturedUrl).toContain('/text2img');
  });

  // ── edit ────────────────────────────────────────────────────────────────────

  test('POST /api/phidias/qwen/edit — result_urls array is returned as urls', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/qwen\/edit/, {
      request_id: 'req-edit-001',
      input_url: 'http://upstream/input.png',
      result_urls: ['http://upstream/out1.png', 'http://upstream/out2.png'],
      seeds: [1],
    });
    // Mock image downloads
    await mockUpstreamBlob(
      page,
      /\/phidias\/qwen\/download\/.*/,
      TINY_PNG_BYTES,
      'image/png',
    );

    const formData = new FormData();
    formData.set('prompt', 'make it blue');

    const res = await request.post('/api/phidias/qwen/edit', {
      multipart: {
        file: {
          name: 'input.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
        prompt: 'make it blue',
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(Array.isArray(body.urls)).toBeTruthy();
  });

  test('POST /api/phidias/qwen/edit — upstream 500 is propagated as-is', async ({
    page,
    request,
  }) => {
    await mockUpstream(
      page,
      /\/phidias\/qwen\/edit/,
      { detail: 'internal error' },
      500,
    );

    const res = await request.post('/api/phidias/qwen/edit', {
      multipart: {
        file: {
          name: 'input.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
        prompt: 'test',
      },
    });

    expect(res.status()).toBe(500);
  });

  // ── angle/multi ─────────────────────────────────────────────────────────────

  test('POST /api/phidias/qwen/angle/multi — results object with right/back/left is returned', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/qwen\/angle.*multi/, {
      request_id: 'req-angle-001',
      input_url: 'http://upstream/front.png',
      results: {
        right: 'http://upstream/right.png',
        back: 'http://upstream/back.png',
        left: 'http://upstream/left.png',
      },
    });
    await mockUpstreamBlob(
      page,
      /\/phidias\/qwen\/download\/.*/,
      TINY_PNG_BYTES,
      'image/png',
    );

    const res = await request.post('/api/phidias/qwen/angle/multi', {
      multipart: {
        file: {
          name: 'input.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
        mode: 'multi',
        azimuth: '0',
        elevation: '0',
        distance: '1.0',
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.request_id).toBe('req-angle-001');
    expect(body.results).toMatchObject({
      right: expect.any(String),
      back: expect.any(String),
      left: expect.any(String),
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite: ReconViaGen routes  (/api/phidias/reconviagen/...)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('API contract — ReconViaGen routes', () => {
  test('POST /api/phidias/reconviagen/generate-single — glb_file is mapped to glb_url + request_id extracted', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/reconviagen\/generate-single/, {
      glb_file: '/download/abc123/model.glb',
      ply_file: '/download/abc123/model.ply',
      gaussian_video: '',
      radiance_video: '',
      mesh_video: '',
    });

    const res = await request.post(
      '/api/phidias/reconviagen/generate-single',
      {
        multipart: {
          file: {
            name: 'object.png',
            mimeType: 'image/png',
            buffer: TINY_PNG_BYTES,
          },
        },
      },
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.glb_url).toContain('model.glb');
    expect(body.ply_url).toContain('model.ply');
    expect(body.request_id).toBe('abc123');
    expect(body.status).toBe('success');
    // Old keys must not be present
    expect(body.glb_file).toBeUndefined();
    expect(body.ply_file).toBeUndefined();
  });

  test('POST /api/phidias/reconviagen/generate-single — upstream 500 is propagated as-is', async ({
    page,
    request,
  }) => {
    await mockUpstream(
      page,
      /\/phidias\/reconviagen\/generate-single/,
      { error: 'GPU out of memory' },
      500,
    );

    const res = await request.post(
      '/api/phidias/reconviagen/generate-single',
      {
        multipart: {
          file: {
            name: 'object.png',
            mimeType: 'image/png',
            buffer: TINY_PNG_BYTES,
          },
        },
      },
    );

    expect(res.status()).toBe(500);
  });

  test('POST /api/phidias/reconviagen/generate-multi — request_id extracted and message contains "multi"', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/reconviagen\/generate-multi/, {
      glb_file: '/download/xyz789/multi.glb',
      ply_file: '/download/xyz789/multi.ply',
      gaussian_video: '',
      radiance_video: '',
      mesh_video: '',
    });

    const res = await request.post(
      '/api/phidias/reconviagen/generate-multi',
      {
        multipart: {
          files: {
            name: 'view1.png',
            mimeType: 'image/png',
            buffer: TINY_PNG_BYTES,
          },
        },
      },
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.request_id).toBe('xyz789');
    expect(body.message).toMatch(/multi/i);
    expect(body.status).toBe('success');
  });

  test('POST /api/phidias/reconviagen/generate-batch — passthrough returns upstream body', async ({
    page,
    request,
  }) => {
    const batchPayload = {
      total_count: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { index: 0, status: 'success', glb_url: '/download/b0/model.glb' },
        { index: 1, status: 'success', glb_url: '/download/b1/model.glb' },
      ],
    };
    await mockUpstream(
      page,
      /\/phidias\/reconviagen\/generate-batch/,
      batchPayload,
    );

    const res = await request.post(
      '/api/phidias/reconviagen/generate-batch',
      {
        multipart: {
          files: {
            name: 'a.png',
            mimeType: 'image/png',
            buffer: TINY_PNG_BYTES,
          },
        },
      },
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.total_count).toBe(2);
    expect(Array.isArray(body.results)).toBeTruthy();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toMatchObject({ index: 0, status: 'success' });
  });

  test('GET /api/phidias/reconviagen/download/:id/:file — blob is streamed with correct content-type', async ({
    page,
    request,
  }) => {
    await mockUpstreamBlob(
      page,
      /\/phidias\/reconviagen\/download\/.*/,
      TINY_GLB_BYTES,
      'model/gltf-binary',
    );

    const res = await request.get(
      '/api/phidias/reconviagen/download/abc123/model.glb',
    );

    expect(res.ok()).toBeTruthy();
    const contentType = res.headers()['content-type'];
    // The route streams through; content-type should be binary-ish
    expect(
      contentType?.includes('model/') ||
      contentType?.includes('application/octet-stream') ||
      contentType?.includes('gltf'),
    ).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite: Segment routes  (/api/phidias/segment/...)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('API contract — Segment routes', () => {
  test('POST /api/phidias/segment/generate-single — passthrough returns upstream body', async ({
    page,
    request,
  }) => {
    const segmentPayload = {
      status: 'success',
      request_id: 'seg-001',
      num_parts: 3,
      segmented_glb_url: '/download/seg-001/segmented.glb',
    };
    await mockUpstream(page, /\/phidias\/segment\/generate-single/, segmentPayload);

    const res = await request.post('/api/phidias/segment/generate-single', {
      multipart: {
        file: {
          name: 'model.glb',
          mimeType: 'model/gltf-binary',
          buffer: TINY_GLB_BYTES,
        },
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'success',
      request_id: 'seg-001',
      num_parts: 3,
    });
  });

  test('POST /api/phidias/segment/generate-single — upstream 422 is propagated', async ({
    page,
    request,
  }) => {
    await mockUpstream(
      page,
      /\/phidias\/segment\/generate-single/,
      { detail: 'file too large' },
      422,
    );

    const res = await request.post('/api/phidias/segment/generate-single', {
      multipart: {
        file: {
          name: 'model.glb',
          mimeType: 'model/gltf-binary',
          buffer: TINY_GLB_BYTES,
        },
      },
    });

    expect(res.status()).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite: Smart-Organize route  (/api/phidias/smart-organize/...)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('API contract — Smart-Organize route', () => {
  test('POST /api/phidias/smart-organize — returns parts[] with id, name, group', async ({
    page,
    request,
  }) => {
    const organizePayload = {
      parts: [
        { id: 'part-0', name: 'Wheel', group: 'Mechanical' },
        { id: 'part-1', name: 'Body', group: 'Chassis' },
      ],
    };
    await mockUpstream(page, /\/phidias\/smart-organize/, organizePayload);

    const res = await request.post('/api/phidias/smart-organize', {
      multipart: {
        parts: JSON.stringify([
          { id: 'part-0', color: '#ff0000' },
          { id: 'part-1', color: '#00ff00' },
        ]),
        original: {
          name: 'original_0.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
        colored: {
          name: 'colored_0.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.parts)).toBeTruthy();
    expect(body.parts[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      group: expect.any(String),
    });
  });

  test('POST /api/phidias/smart-organize — upstream 503 is propagated', async ({
    page,
    request,
  }) => {
    await mockUpstream(
      page,
      /\/phidias\/smart-organize/,
      { error: 'VLM unavailable' },
      503,
    );

    const res = await request.post('/api/phidias/smart-organize', {
      multipart: {
        parts: JSON.stringify([{ id: 'part-0', color: '#ff0000' }]),
        original: {
          name: 'original_0.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
        colored: {
          name: 'colored_0.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
      },
    });

    expect(res.status()).toBe(503);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite: P3SAM routes  (/api/phidias/p3sam/...)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('API contract — P3SAM routes', () => {
  test('POST /api/phidias/p3sam/set-image — upstream response is passed through', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/p3sam\/set.?image/, {
      session_id: 'session-abc',
      status: 'ready',
    });

    const res = await request.post('/api/phidias/p3sam/set-image', {
      multipart: {
        image: {
          name: 'image.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BYTES,
        },
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ session_id: expect.any(String) });
  });

  test('POST /api/phidias/p3sam/predict — upstream response is passed through', async ({
    page,
    request,
  }) => {
    await mockUpstream(page, /\/phidias\/p3sam\/predict/, {
      masks: ['data:image/png;base64,abc'],
      scores: [0.95],
      status: 'success',
    });

    const res = await request.post('/api/phidias/p3sam/predict', {
      multipart: {
        session_id: 'session-abc',
        point_coords: JSON.stringify([[100, 200]]),
        point_labels: JSON.stringify([1]),
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ masks: expect.any(Array) });
  });
});
