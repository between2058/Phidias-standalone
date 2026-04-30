import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { GET, POST } from '@/app/api/phidias/reconviagen/[...path]/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

function makeRequest(path: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost/api/phidias/reconviagen/${path}`, { method })
}

describe('reconviagen route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET calls proxyRequest with path segments joined by "/"', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ ok: true }))

    const req = makeRequest('download/abc123/model.glb')
    await GET(req, { params: { path: ['download', 'abc123', 'model.glb'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toContain('/download/abc123/model.glb')
  })

  // ── POST generation endpoints (polling mode) ───────────────────────────────────

  it('POST generate-single returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-abc123',
        status: 'queued',
        queue_position: 2,
      }),
    )

    const req = makeRequest('generate-single', 'POST')
    const res = await POST(req, { params: { path: ['generate-single'] } })
    const body = await res.json()

    expect(body.job_id).toBe('job-abc123')
    expect(body.status).toBe('queued')
    expect(body.queue_position).toBe(2)
  })

  it('POST generate-multi returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-xyz789',
        status: 'processing',
        queue_position: 0,
      }),
    )

    const req = makeRequest('generate-multi', 'POST')
    const res = await POST(req, { params: { path: ['generate-multi'] } })
    const body = await res.json()

    expect(body.job_id).toBe('job-xyz789')
    expect(body.status).toBe('processing')
    expect(body.queue_position).toBe(0)
  })

  it('POST generate-batch returns JobSubmitResponse with job_id, status, queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-batch-001',
        status: 'queued',
        queue_position: 5,
      }),
    )

    const req = makeRequest('generate-batch', 'POST')
    const res = await POST(req, { params: { path: ['generate-batch'] } })
    const body = await res.json()

    expect(body.job_id).toBe('job-batch-001')
    expect(body.status).toBe('queued')
    expect(body.queue_position).toBe(5)
  })

  it('POST generate-single upstream error is returned directly without reshaping', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ error: 'server error' }, 500))

    const req = makeRequest('generate-single', 'POST')
    const res = await POST(req, { params: { path: ['generate-single'] } })

    expect(res.status).toBe(500)
  })

  it('POST generate-multi upstream error is returned directly without reshaping', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ error_code: 'RATE_LIMIT', message: 'Too many requests' }, 429))

    const req = makeRequest('generate-multi', 'POST')
    const res = await POST(req, { params: { path: ['generate-multi'] } })

    expect(res.status).toBe(429)
  })

  it('POST generate-batch upstream error is returned directly without reshaping', async () => {
    const errorResponse = new Response(
      JSON.stringify({ error: 'invalid input' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    ) as unknown as NextResponse
    mockProxy.mockResolvedValue(errorResponse)

    const req = makeRequest('generate-batch', 'POST')
    const res = await POST(req, { params: { path: ['generate-batch'] } })

    expect(res.status).toBe(400)
  })

  // ── POST passthrough (non-generation endpoints) ────────────────────────────────────

  it('POST non-generation endpoint calls proxyRequest and returns response directly', async () => {
    const mockRes = makeMockResponse({ custom: 'data' })
    mockProxy.mockResolvedValue(mockRes)

    const req = makeRequest('custom/endpoint', 'POST')
    const result = await POST(req, { params: { path: ['custom', 'endpoint'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    expect(result).toBe(mockRes)
  })
})
