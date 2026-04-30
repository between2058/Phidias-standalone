import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { POST } from '@/app/api/phidias/trellis2/[...path]/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

function makeRequest(path: string, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost/api/phidias/trellis2/${path}`, { method })
}

describe('trellis2 route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST generate-multi is mapped to upstream /generate-multiview and wraps the response', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({ request_id: 'req-abc', glb_url: '/download/req-abc/model.glb' }),
    )

    const req = makeRequest('generate-multi', 'POST')
    const res = await POST(req, { params: { path: ['generate-multi'] } })
    const body = await res.json()

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toMatch(/\/generate-multiview$/)
    expect(url).not.toMatch(/\/generate-multi$/)

    expect(body.status).toBe('success')
    expect(body.request_id).toBe('req-abc')
    expect(body.glb_url).toBe('/download/req-abc/model.glb')
  })

  it('POST generate is mapped to upstream /generate and wraps the response', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({ request_id: 'req-xyz', glb_url: '/download/req-xyz/model.glb' }),
    )

    const req = makeRequest('generate', 'POST')
    const res = await POST(req, { params: { path: ['generate'] } })
    const body = await res.json()

    const [, url] = mockProxy.mock.calls[0]
    expect(url).toMatch(/\/generate$/)
    expect(body.status).toBe('success')
    expect(body.request_id).toBe('req-xyz')
  })
})
