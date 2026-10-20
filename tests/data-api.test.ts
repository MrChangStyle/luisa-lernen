import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '../api/data'
import type { Saved } from '../src/state'

// Kleiner Ersatz für Supabase (PostgREST) im Speicher
let row: { data: Saved; updated_at: string } | null
let writes = 0
function fakeSupabase(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  if (method === 'GET') return json(row ? [row] : [])
  const body = JSON.parse(String(init?.body))
  writes++
  if (method === 'POST') {
    if (row) return json({ message: 'duplicate' }, 409)
    row = { data: body.data, updated_at: body.updated_at }
    return json([row], 201)
  }
  const want = decodeURIComponent(url.split('updated_at=eq.')[1] ?? '')
  if (!row || row.updated_at !== want) return json([])
  row = { data: body.data, updated_at: body.updated_at }
  return json([row])
}

const empty: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [] }
const put = (saved: unknown) => PUT(new Request('http://x/api/data', { method: 'PUT', body: JSON.stringify({ saved }) }))

describe('Cloud-Speicher api/data', () => {
  beforeEach(() => {
    row = null
    writes = 0
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test')
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => fakeSupabase(u, i)))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('meldet 503, solange kein Schlüssel eingetragen ist', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    expect((await GET()).status).toBe(503)
  })
  it('legt den ersten Stand an und liefert ihn wieder aus', async () => {
    expect(await (await GET()).json()).toEqual({ saved: null })
    await put({ ...empty, selection: ['Brüche'] })
    expect((await (await GET()).json()).saved.selection).toEqual(['Brüche'])
  })
  it('führt den Stand eines zweiten Geräts zusammen, statt ihn zu überschreiben', async () => {
    await put({ ...empty, donePractice: ['A'] })
    const r = await (await put({ ...empty, donePractice: ['B'] })).json()
    expect(r.saved.donePractice).toEqual(['A', 'B'])
    expect(row?.data.donePractice).toEqual(['A', 'B'])
    expect(writes).toBe(2)
  })
  it('lehnt kaputte Daten ab', async () => {
    expect((await put({ hallo: 1 })).status).toBe(400)
    expect(row).toBeNull()
  })
})
