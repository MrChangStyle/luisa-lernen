import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '../api/data'
import { LUISA } from '../src/logic/learner'
import type { Saved } from '../src/state'

// Kleiner Ersatz für Supabase (PostgREST) im Speicher, mehrere Zeilen nach id
type R = { data: Saved; updated_at: string }
let rows: Record<string, R>
let row: R | null
let writes = 0
function fakeSupabase(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  const body = init?.body ? JSON.parse(String(init.body)) : null
  const id = method === 'POST' ? body.id : decodeURIComponent(url.split('id=eq.')[1].split('&')[0])
  const sync = () => (row = rows.familie ?? null)
  if (method === 'GET') return json(rows[id] ? [rows[id]] : [])
  writes++
  if (method === 'POST') {
    if (rows[id]) return json({ message: 'duplicate' }, 409)
    rows[id] = { data: body.data, updated_at: body.updated_at }
    sync()
    return json([rows[id]], 201)
  }
  const want = decodeURIComponent(url.split('updated_at=eq.')[1] ?? '')
  if (!rows[id] || rows[id].updated_at !== want) return json([])
  rows[id] = { data: body.data, updated_at: body.updated_at }
  sync()
  return json([rows[id]])
}

const empty: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [] }
const put = (saved: unknown) => PUT(new Request('http://x/api/data', { method: 'PUT', body: JSON.stringify({ saved }) }))

describe('Cloud-Speicher api/data', () => {
  beforeEach(() => {
    rows = {}
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

  it('speichert jedes weitere Kind in einer eigenen Zeile, Luisa bleibt in „familie“', async () => {
    const at = (q: string) => `http://x/api/data${q}`
    await PUT(new Request(at('?kind=luisa'), { method: 'PUT', body: JSON.stringify({ saved: { ...empty, selection: ['L'] } }) }))
    await PUT(new Request(at('?kind=ben-a1b2c3'), { method: 'PUT', body: JSON.stringify({ saved: { ...empty, selection: ['B'] } }) }))
    expect(Object.keys(rows).sort()).toEqual(['familie', 'kind-ben-a1b2c3'])
    expect((await (await GET()).json()).saved.selection).toEqual(['L'])
    expect((await (await GET(new Request(at('?kind=ben-a1b2c3')))).json()).saved.selection).toEqual(['B'])
    expect((await PUT(new Request(at('?kind=../x'), { method: 'PUT', body: JSON.stringify({ saved: empty }) }))).status).toBe(400)
  })
  it('führt die Kinderliste zusammen und prüft sie', async () => {
    const url = 'http://x/api/data?familie'
    const ben = { id: 'ben-1', name: 'Ben', grade: 3, school: 'Grundschule', helps: ['zahlenBild'], updatedAt: '2026-11-01T00:00:00Z' }
    await PUT(new Request(url, { method: 'PUT', body: JSON.stringify({ family: { children: [LUISA], pin: '1234' } }) }))
    const r = await (await PUT(new Request(url, { method: 'PUT', body: JSON.stringify({ family: { children: [LUISA, ben], pin: null } }) }))).json()
    expect(r.family.children.map((c: { id: string }) => c.id)).toEqual(['luisa', 'ben-1'])
    expect(r.family.pin).toBe('1234')
    expect((await (await GET(new Request(url))).json()).family.children).toHaveLength(2)
    const broken = { children: [{ ...ben, school: 'Hogwarts' }], pin: null }
    expect((await PUT(new Request(url, { method: 'PUT', body: JSON.stringify({ family: broken }) }))).status).toBe(400)
  })
})
