import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { POST } from '@/app/api/phidias/segment/3d/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

describe('segment/3d route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls proxyRequest with a URL ending in /segment', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({ job_id: 'job-123', status: 'queued', queue_position: 5 }),
    )

    const req = new NextRequest('http://localhost/api/phidias/segment/3d', { method: 'POST' })
    await POST(req)

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toMatch(/\/segment$/)
  })

  it('returns JobSubmitResponse with job_id, status, and queue_position', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({
        job_id: 'job-123',
        status: 'queued',
        queue_position: 3,
      }),
    )

    const req = new NextRequest('http://localhost/api/phidias/segment/3d', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(body).toEqual({
      job_id: 'job-123',
      status: 'queued',
      queue_position: 3,
    })
  })

  it('upstream error (413) returns formatted error response', async () => {
    mockProxy.mockResolvedValue(
      new Response(
        JSON.stringify({ error_code: 'FILE_TOO_LARGE', message: 'File too large' }),
        { status: 413, headers: { 'content-type': 'application/json' } }
      ) as unknown as NextResponse
    )

    const req = new NextRequest('http://localhost/api/phidias/segment/3d', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(413)
    expect(body.status).toBe('error')
    expect(body.error_code).toBe('FILE_TOO_LARGE')
  })

  it('upstream 503 is returned directly', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ error: 'service unavailable' }, 503))

    const req = new NextRequest('http://localhost/api/phidias/segment/3d', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(503)
  })
})
