import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// proxyRequest is mocked before the route module is imported.
// vi.mock is hoisted to the top of the file by Vitest's transformer.
vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { GET, POST } from '@/app/api/phidias/qwen/[...path]/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

// Build a mock Response that mimics a successful proxyRequest result
function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

function makeRequest(path: string, method = 'GET', body?: unknown): NextRequest {
  if (body) {
    return new NextRequest(`http://localhost/api/phidias/qwen/${path}`, {
      method,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  }
  return new NextRequest(`http://localhost/api/phidias/qwen/${path}`, { method })
}

// Helper to mock global.fetch for text2img (which bypasses proxyRequest)
function mockFetch(data: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('qwen route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET calls proxyRequest with a URL containing the correct path', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ ok: true }))

    const req = makeRequest('text2img')
    await GET(req, { params: { path: ['text2img'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toContain('/text2img')
  })

  it('GET with angle/* path uses /angle (special-case mapping)', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ ok: true }))

    const req = makeRequest('angle/multi')
    await GET(req, { params: { path: ['angle', 'multi'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    // qwenPath(['angle', 'multi']) → '/angle'
    expect(url).toMatch(/\/angle$/)
  })

  // ── POST text2img (polling mode) ─────────────────────────────────────────
  // text2img converts JSON → form-urlencoded and calls fetch directly (not proxyRequest).

  it('POST text2img returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockFetch({ job_id: 'job-abc123', status: 'queued', queue_position: 2 })

    const req = makeRequest('text2img', 'POST', { prompt: 'a cat' })
    const res = await POST(req, { params: { path: ['text2img'] } })
    const body = await res.json()

    expect(body).toEqual({
      job_id: 'job-abc123',
      status: 'queued',
      queue_position: 2,
    })
    expect(mockProxy).not.toHaveBeenCalled()
  })

  it('POST text2img upstream 503 is returned directly without reshaping', async () => {
    mockFetch({ error: 'service unavailable' }, 503)

    const req = makeRequest('text2img', 'POST', { prompt: 'a cat' })
    const res = await POST(req, { params: { path: ['text2img'] } })

    expect(res.status).toBe(503)
    expect(mockProxy).not.toHaveBeenCalled()
  })

  // ── POST edit (polling mode) ─────────────────────────────────────────────────

  it('POST edit returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-edit-001',
        status: 'processing',
        queue_position: 0,
      }),
    )

    const req = makeRequest('edit', 'POST')
    const res = await POST(req, { params: { path: ['edit'] } })
    const body = await res.json()

    expect(body).toEqual({
      job_id: 'job-edit-001',
      status: 'processing',
      queue_position: 0,
    })
  })

  it('POST edit upstream error is returned directly without reshaping', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ error: 'server error' }, 500))

    const req = makeRequest('edit', 'POST')
    const res = await POST(req, { params: { path: ['edit'] } })

    expect(res.status).toBe(500)
  })

  // ── POST angle/multi (polling mode) ─────────────────────────────────────────

  it('POST angle/multi returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-angle-001',
        status: 'queued',
        queue_position: 3,
      }),
    )

    const req = makeRequest('angle/multi', 'POST')
    const res = await POST(req, { params: { path: ['angle', 'multi'] } })
    const body = await res.json()

    expect(body).toEqual({
      job_id: 'job-angle-001',
      status: 'queued',
      queue_position: 3,
    })
  })

  it('POST angle/multi upstream error is returned directly without reshaping', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse(
        { error_code: 'INVALID_INPUT', message: 'Invalid request' },
        400,
      ),
    )

    const req = makeRequest('angle/multi', 'POST')
    const res = await POST(req, { params: { path: ['angle', 'multi'] } })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error_code).toBe('INVALID_INPUT')
  })

  // ── POST passthrough paths ────────────────────────────────────────────────

  it('POST angle/custom (passthrough) calls proxyRequest once and returns response directly', async () => {
    const mockRes = makeMockResponse({ custom: true })
    mockProxy.mockResolvedValue(mockRes)

    const req = makeRequest('angle/custom', 'POST')
    await POST(req, { params: { path: ['angle', 'custom'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    // qwenPath maps 'angle/*' to '/angle' (special-case mapping for angle paths)
    expect(mockProxy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('/angle'),
      expect.objectContaining({ service: 'qwen' }),
    )
  })

  it('POST edit-multi (passthrough) calls proxyRequest once and returns response directly', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ batch: true }))

    const req = makeRequest('edit-multi', 'POST')
    await POST(req, { params: { path: ['edit-multi'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    expect(mockProxy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('/edit-multi'),
      expect.objectContaining({ service: 'qwen' }),
    )
  })
})
