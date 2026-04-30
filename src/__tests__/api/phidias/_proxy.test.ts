import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/app/api/phidias/_proxy'

// Helper to build a minimal upstream mock Response
function makeUpstreamResponse(
  body: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers })
}

describe('proxyRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('strips hop-by-hop headers (host, connection, transfer-encoding) from forwarded request', async () => {
    const mockFn = vi.fn().mockResolvedValue(makeUpstreamResponse('ok', 200))
    vi.stubGlobal('fetch', mockFn)

    const req = new NextRequest('http://localhost/api/test', {
      method: 'GET',
      headers: {
        host: 'localhost',
        connection: 'keep-alive',
        'transfer-encoding': 'chunked',
        'x-custom-header': 'should-pass',
      },
    })

    await proxyRequest(req, 'http://upstream/test')

    const [, init] = mockFn.mock.calls[0] as [string, RequestInit]
    const forwarded = init.headers as Headers
    expect(forwarded.has('host')).toBe(false)
    expect(forwarded.has('connection')).toBe(false)
    expect(forwarded.has('transfer-encoding')).toBe(false)
  })

  it('keeps non-hop-by-hop headers (x-custom-header) when forwarding', async () => {
    const mockFn = vi.fn().mockResolvedValue(makeUpstreamResponse('ok', 200))
    vi.stubGlobal('fetch', mockFn)

    const req = new NextRequest('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'x-custom-header': 'my-value',
        'content-type': 'application/json',
      },
    })

    await proxyRequest(req, 'http://upstream/test')

    const [, init] = mockFn.mock.calls[0] as [string, RequestInit]
    const forwarded = init.headers as Headers
    expect(forwarded.get('x-custom-header')).toBe('my-value')
    expect(forwarded.get('content-type')).toBe('application/json')
  })

  it('does not forward a body for GET requests (body is undefined)', async () => {
    const mockFn = vi.fn().mockResolvedValue(makeUpstreamResponse('ok', 200))
    vi.stubGlobal('fetch', mockFn)

    const req = new NextRequest('http://localhost/api/test', { method: 'GET' })
    await proxyRequest(req, 'http://upstream/test')

    const [, init] = mockFn.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })

  it('forwards body for POST requests (body is not undefined)', async () => {
    const mockFn = vi.fn().mockResolvedValue(makeUpstreamResponse('ok', 200))
    vi.stubGlobal('fetch', mockFn)

    const req = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      headers: { 'content-type': 'application/json' },
    })

    await proxyRequest(req, 'http://upstream/test')

    const [, init] = mockFn.mock.calls[0] as [string, RequestInit]
    expect(init.body).not.toBeUndefined()
  })

  it('forwards the upstream status code (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeUpstreamResponse('not found', 404)))

    const req = new NextRequest('http://localhost/api/test', { method: 'GET' })
    const result = await proxyRequest(req, 'http://upstream/test')

    expect(result.status).toBe(404)
  })

  it('forwards upstream status 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeUpstreamResponse('unavailable', 503)))

    const req = new NextRequest('http://localhost/api/test', { method: 'GET' })
    const result = await proxyRequest(req, 'http://upstream/test')

    expect(result.status).toBe(503)
  })

  it('strips transfer-encoding and connection from upstream response headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeUpstreamResponse('ok', 200, {
          'transfer-encoding': 'chunked',
          connection: 'keep-alive',
          'content-type': 'application/json',
        }),
      ),
    )

    const req = new NextRequest('http://localhost/api/test', { method: 'GET' })
    const result = await proxyRequest(req, 'http://upstream/test')

    expect(result.headers.has('transfer-encoding')).toBe(false)
    expect(result.headers.has('connection')).toBe(false)
  })

  it('keeps content-type from upstream response headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeUpstreamResponse('ok', 200, { 'content-type': 'application/json' }),
      ),
    )

    const req = new NextRequest('http://localhost/api/test', { method: 'GET' })
    const result = await proxyRequest(req, 'http://upstream/test')

    expect(result.headers.get('content-type')).toBe('application/json')
  })
})
