import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// fetch is mocked globally so the module picks it up at import time and on every call.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDummyFile(): File {
  return new File([Buffer.from('fake-image')], 'test.png', { type: 'image/png' })
}

function makeRequest(
  opts: { parts?: object[]; includeScreenshots?: boolean; angles?: string[] } = {},
): NextRequest {
  const formData = new FormData()
  const parts = opts.parts ?? [{ id: 'p1', color: '#ff0000' }]
  formData.append('parts', JSON.stringify(parts))
  if (opts.angles) {
    formData.append('angles', JSON.stringify(opts.angles))
  }
  if (opts.includeScreenshots !== false) {
    formData.append('original', makeDummyFile())
    formData.append('colored', makeDummyFile())
  }
  return new NextRequest('http://localhost/api/phidias/smart-organize', {
    method: 'POST',
    body: formData,
  })
}

// Build an OpenAI-compatible VLM mock response
function makeVlmResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

// ── "VLM not configured" suite ────────────────────────────────────────────────

describe('smart-organize: VLM not configured', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: (req: NextRequest) => Promise<any>

  beforeAll(async () => {
    // Ensure env vars are absent and the module is freshly loaded
    vi.resetModules()
    const mod = await import('@/app/api/phidias/smart-organize/route')
    POST = mod.POST
  })

  it('returns 500 with a message containing "VLM not configured"', async () => {
    const req = makeRequest()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('VLM not configured')
  })
})

// ── "VLM configured" suite ────────────────────────────────────────────────────

describe('smart-organize: VLM configured', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: (req: NextRequest) => Promise<any>

  beforeAll(async () => {
    vi.stubEnv('VLM_API_URL', 'http://test-vlm/v1')
    vi.stubEnv('VLM_API_KEY', 'test-key')
    vi.resetModules()
    const mod = await import('@/app/api/phidias/smart-organize/route')
    POST = mod.POST
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('returns 400 when parts field is missing from FormData', async () => {
    const formData = new FormData()
    formData.append('original', makeDummyFile())
    const req = new NextRequest('http://localhost/api/phidias/smart-organize', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('parts')
  })

  it('returns 400 when no screenshots (neither original nor colored) are provided', async () => {
    const req = makeRequest({ includeScreenshots: false })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('screenshots')
  })

  it('returns 200 with { parts: [...] } on a successful VLM response', async () => {
    mockFetch.mockResolvedValue(
      makeVlmResponse(JSON.stringify([{ id: 'p1', name: 'Body', group: 'Body' }])),
    )

    const req = makeRequest({ parts: [{ id: 'p1', color: '#ff0000' }] })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('parts')
    expect(Array.isArray(body.parts)).toBe(true)
    expect(body.parts[0].id).toBe('p1')
    expect(body.parts[0].name).toBe('Body')
    expect(body.parts[0].group).toBe('Body')
  })

  it('parses VLM response wrapped in markdown fences (```json ... ```)', async () => {
    const jsonPayload = JSON.stringify([{ id: 'p1', name: 'Wing', group: 'Wings' }])
    mockFetch.mockResolvedValue(makeVlmResponse('```json\n' + jsonPayload + '\n```'))

    const req = makeRequest({ parts: [{ id: 'p1', color: '#00ff00' }] })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.parts[0].name).toBe('Wing')
    expect(body.parts[0].group).toBe('Wings')
  })

  it('fills fallback { group: "Ungrouped" } for parts not returned by the VLM', async () => {
    // VLM only returns p1; p2 should get a fallback entry
    mockFetch.mockResolvedValue(
      makeVlmResponse(JSON.stringify([{ id: 'p1', name: 'Top Panel', group: 'Body' }])),
    )

    const req = makeRequest({
      parts: [
        { id: 'p1', color: '#ff0000' },
        { id: 'p2', color: '#0000ff' },
      ],
    })
    const res = await POST(req)
    const body = await res.json()

    const p2 = body.parts.find((p: { id: string }) => p.id === 'p2')
    expect(p2).toBeDefined()
    expect(p2.group).toBe('Ungrouped')
  })

  it('works with angle labels in the request', async () => {
    mockFetch.mockResolvedValue(
      makeVlmResponse(JSON.stringify([{ id: 'p1', name: 'Front Panel', group: 'Body' }])),
    )

    const req = makeRequest({
      parts: [{ id: 'p1', color: '#ff0000' }],
      angles: ['front', 'back', 'left'],
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.parts[0].name).toBe('Front Panel')
  })
})
