import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { GET } from '@/app/api/phidias/p3sam/download/[...path]/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

describe('p3sam/download route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds correct downstream URL from path segments', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({ ok: true }))

    const req = new NextRequest('http://localhost/api/phidias/p3sam/download/req1/model.glb', {
      method: 'GET',
    })
    await GET(req, { params: { path: ['req1', 'model.glb'] } })

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toContain('/download/req1/model.glb')
  })

  it('returns the proxyRequest response directly', async () => {
    const mockRes = makeMockResponse({ binary: 'data' })
    mockProxy.mockResolvedValue(mockRes)

    const req = new NextRequest('http://localhost/api/phidias/p3sam/download/req1/model.glb', {
      method: 'GET',
    })
    const result = await GET(req, { params: { path: ['req1', 'model.glb'] } })

    expect(result).toBe(mockRes)
  })

  it('handles multi-segment paths correctly', async () => {
    mockProxy.mockResolvedValue(makeMockResponse({}))

    const req = new NextRequest(
      'http://localhost/api/phidias/p3sam/download/abc/def/file.ply',
      { method: 'GET' },
    )
    await GET(req, { params: { path: ['abc', 'def', 'file.ply'] } })

    const [, url] = mockProxy.mock.calls[0]
    expect(url).toContain('/download/abc/def/file.ply')
  })
})
