import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '../api/data'
import { LUISA } from '../src/logic/learner'
import type { Saved } from '../src/state'

import { legacyToken } from '../server/session'
import { fakeSupabase } from './fixtures/fake-supabase'

// Bisheriger Zugang mit Familien-Passwort; die neuen Rollen prüft tests/konto.test.ts
let fake: ReturnType<typeof fakeSupabase>
let cookie = ''
const familie = () => (fake.tables.family_data.find((r) => r.id === 'familie') ?? null) as { data: Saved } | null
const req = (url = 'http://x/api/data', init: RequestInit = {}) => new Request(url, { ...init, headers: { cookie } })
const get = (r: Request = req()) => GET(r)

const empty: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [] }
const put = (saved: unknown) => PUT(req('http://x/api/data', { method: 'PUT', body: JSON.stringify({ saved }) }))

describe('Cloud-Speicher api/data', () => {
  beforeEach(async () => {
    fake = fakeSupabase()
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test')
    vi.stubEnv('APP_PASSWORD', 'Hühnerstall-42')
    cookie = `luisa_zugang=${await legacyToken('Hühnerstall-42')}`
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => fake.handle(u, i)))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('meldet 503, solange kein Schlüssel eingetragen ist', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    expect((await get()).status).toBe(503)
  })
  it('legt den ersten Stand an und liefert ihn wieder aus', async () => {
    expect(await (await get()).json()).toEqual({ saved: null })
    cookie = ''
    expect((await get()).status).toBe(401)
    cookie = `luisa_zugang=${await legacyToken('Hühnerstall-42')}`
    await put({ ...empty, selection: ['Brüche'] })
    expect((await (await get()).json()).saved.selection).toEqual(['Brüche'])
  })
  it('führt den Stand eines zweiten Geräts zusammen, statt ihn zu überschreiben', async () => {
    await put({ ...empty, donePractice: ['A'] })
    const r = await (await put({ ...empty, donePractice: ['B'] })).json()
    expect(r.saved.donePractice).toEqual(['A', 'B'])
    expect(familie()?.data.donePractice).toEqual(['A', 'B'])
    expect(fake.writes()).toBe(2)
  })
  it('lehnt kaputte Daten ab', async () => {
    expect((await put({ hallo: 1 })).status).toBe(400)
    expect(familie()).toBeNull()
  })

  it('speichert jedes weitere Kind in einer eigenen Zeile, Luisa bleibt in „familie“', async () => {
    const at = (q: string) => `http://x/api/data${q}`
    await PUT(req(at('?kind=luisa'), { method: 'PUT', body: JSON.stringify({ saved: { ...empty, selection: ['L'] } }) }))
    await PUT(req(at('?kind=ben-a1b2c3'), { method: 'PUT', body: JSON.stringify({ saved: { ...empty, selection: ['B'] } }) }))
    expect(fake.tables.family_data.map((r) => r.id).sort()).toEqual(['familie', 'kind-ben-a1b2c3'])
    expect((await (await get()).json()).saved.selection).toEqual(['L'])
    expect((await (await get(req(at('?kind=ben-a1b2c3')))).json()).saved.selection).toEqual(['B'])
    expect((await PUT(req(at('?kind=../x'), { method: 'PUT', body: JSON.stringify({ saved: empty }) }))).status).toBe(400)
  })
  it('führt die Kinderliste zusammen und prüft sie', async () => {
    const url = 'http://x/api/data?familie'
    const ben = { id: 'ben-1', name: 'Ben', grade: 3, school: 'Grundschule', helps: ['zahlenBild'], updatedAt: '2026-11-01T00:00:00Z' }
    await PUT(req(url, { method: 'PUT', body: JSON.stringify({ family: { children: [LUISA], pin: '1234' } }) }))
    const r = await (await PUT(req(url, { method: 'PUT', body: JSON.stringify({ family: { children: [LUISA, ben], pin: null } }) }))).json()
    expect(r.family.children.map((c: { id: string }) => c.id)).toEqual(['luisa', 'ben-1'])
    expect(r.family.pin).toBe('1234')
    expect((await (await get(req(url))).json()).family.children).toHaveLength(2)
    const broken = { children: [{ ...ben, school: 'Hogwarts' }], pin: null }
    expect((await PUT(req(url, { method: 'PUT', body: JSON.stringify({ family: broken }) }))).status).toBe(400)
  })
  it('läuft wie bisher, solange die neuen Tabellen noch fehlen', async () => {
    delete (fake.tables as Record<string, unknown>).families
    await put({ ...empty, selection: ['Brüche'] })
    expect((await (await get()).json()).saved.selection).toEqual(['Brüche'])
    expect((await get(req('http://x/api/data?familie'))).status).toBe(200)
  })
})
