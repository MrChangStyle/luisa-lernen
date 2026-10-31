import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import middleware from '../middleware'
import * as data from '../api/data'
import * as konto from '../api/konto'
import { LUISA } from '../src/logic/learner'
import type { Saved } from '../src/state'
import { legacyToken } from '../server/session'
import { VALID_EMAIL_CODE, fakeSupabase } from './fixtures/fake-supabase'

// Eltern-Konten, Kindergeräte und die Trennung der Kinder auf dem Server

const BASE = 'https://luisa-lernen.vercel.app'
let fake: ReturnType<typeof fakeSupabase>

const empty: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }
const cookieOf = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith(`${name}=`) && c.length > name.length + 1) ?? ''
const form = (path: string, fields: Record<string, string>, cookie = '') =>
  middleware(new Request(`${BASE}${path}`, { method: 'POST', body: new URLSearchParams(fields), headers: { cookie } }))
const api = (path: string, cookie: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') =>
  new Request(`${BASE}${path}`, { method, headers: { cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
const ask = async (fn: (r: Request) => Promise<Response>, r: Request) => {
  const res = await fn(r)
  return { status: res.status, body: await res.json() }
}

async function parentLogin(email: string) {
  const page = await form('/__konto/email', { email })
  expect(await page.text()).toContain('Code eingeben')
  const res = await form('/__konto/code', { email, code: VALID_EMAIL_CODE })
  expect(res.status).toBe(303)
  return cookieOf(res, 'eltern')
}

async function newFamily(email: string, name: string) {
  const c = await parentLogin(email)
  expect((await ask(konto.POST, api('/api/konto', c, { aktion: 'familie-anlegen', name }))).status).toBe(200)
  return c
}

const putFamily = (c: string, children: unknown[], pin: string | null = null) => ask(data.PUT, api('/api/data?familie', c, { family: { children, pin } }, 'PUT'))
const ben = { id: 'ben-a1b2c3', name: 'Ben', grade: 3, school: 'Grundschule', helps: ['zahlenBild'], updatedAt: '2026-11-01T10:00:00.000Z' }
const mia = { ...ben, id: 'mia-d4e5f6', name: 'Mia', helps: [] }

async function pair(parent: string, child: string) {
  const r = await ask(konto.POST, api('/api/konto', parent, { aktion: 'geraet-code', kind: child }))
  expect(r.status).toBe(200)
  expect(r.body.code).toMatch(/^\d{6}$/)
  const res = await form('/__geraet', { code: r.body.code })
  expect(res.status).toBe(303)
  return { code: r.body.code as string, cookie: cookieOf(res, 'kindgeraet') }
}

describe('Eltern-Konten und Kindergeräte', () => {
  beforeEach(() => {
    fake = fakeSupabase()
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-geheim')
    vi.stubEnv('SESSION_SECRET', 'sitzungs-schluessel')
    vi.stubEnv('APP_PASSWORD', 'Hühnerstall-42')
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => fake.handle(u, i)))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('meldet Eltern mit E-Mail-Code an, ein falscher Code hilft nicht', async () => {
    const wrong = await form('/__konto/code', { email: 'a@b.de', code: '999999' })
    expect(wrong.status).toBe(401)
    expect(wrong.headers.get('set-cookie')).toBeNull()
    const c = await parentLogin('mama@example.de')
    expect(fake.tables.parents).toHaveLength(1)
    expect((await middleware(new Request(`${BASE}/`, { headers: { cookie: c } }))).headers.get('x-middleware-next')).toBe('1')
    const me = await ask(konto.GET, api('/api/konto?aktion=ich', c))
    expect(me.body).toEqual({ rolle: 'eltern', email: 'mama@example.de', familie: null })
  })

  it('lässt gefälschte Cookies nicht durch', async () => {
    const c = await parentLogin('mama@example.de')
    const [body, sig] = c.slice('eltern='.length).split('.')
    const forged = `eltern=${body}.${sig.replace(/^./, (x) => (x === 'a' ? 'b' : 'a'))}`
    expect((await middleware(new Request(`${BASE}/`, { headers: { cookie: forged } }))).status).toBe(401)
    expect((await konto.GET(api('/api/konto?aktion=ich', forged))).status).toBe(401)
  })

  it('legt eine Familie mit Kindern an; Luisa lässt sich nicht in eine fremde Familie holen', async () => {
    const c = await newFamily('mama@example.de', 'Familie Test')
    expect((await putFamily(c, [ben, mia], '4321')).body.family.children.map((x: { id: string }) => x.id)).toEqual(['ben-a1b2c3', 'mia-d4e5f6'])
    expect(fake.tables.families[0].pin).toBe('4321')
    expect((await putFamily(c, [LUISA])).status).toBe(400)
    expect((await ask(data.GET, api('/api/data?familie', c))).body.family.children).toHaveLength(2)
  })

  it('richtet ein Kindergerät mit Einmal-Code ein; das Gerät sieht nur sein eigenes Kind', async () => {
    const c = await newFamily('mama@example.de', 'Familie Test')
    await putFamily(c, [ben, mia], '4321')
    await ask(data.PUT, api('/api/data?kind=mia-d4e5f6', c, { saved: { ...empty, selection: ['Mia geheim'] } }, 'PUT'))

    const { code, cookie: dev } = await pair(c, 'ben-a1b2c3')
    expect(dev).toMatch(/^kindgeraet=/)
    // Code gilt nur einmal und liegt nur als Hash in der Datenbank
    expect(fake.tables.device_codes).toHaveLength(0)
    expect((await form('/__geraet', { code })).status).toBe(401)

    const me = await ask(konto.GET, api('/api/konto?aktion=ich', dev))
    expect(me.body.rolle).toBe('kind')
    expect(me.body.kind.id).toBe('ben-a1b2c3')
    const fam = await ask(data.GET, api('/api/data?familie', dev))
    expect(fam.body.family).toEqual({ children: [expect.objectContaining({ id: 'ben-a1b2c3' })], pin: '4321' })

    // Eigener Lernstand: ohne ?kind landet er bei Ben
    expect((await ask(data.PUT, api('/api/data', dev, { saved: { ...empty, selection: ['Ben'] } }, 'PUT'))).status).toBe(200)
    expect(fake.tables.family_data.find((r) => r.id === 'kind-ben-a1b2c3')).toBeTruthy()
    // Geschwister, Luisa und die Kinderliste sind gesperrt
    expect((await ask(data.GET, api('/api/data?kind=mia-d4e5f6', dev))).status).toBe(403)
    expect((await ask(data.PUT, api('/api/data?kind=mia-d4e5f6', dev, { saved: empty }, 'PUT'))).status).toBe(403)
    expect((await ask(data.GET, api('/api/data?kind=luisa', dev))).status).toBe(403)
    expect((await putFamily(dev, [ben])).status).toBe(403)
    expect((await ask(konto.POST, api('/api/konto', dev, { aktion: 'geraet-code', kind: 'ben-a1b2c3' }))).status).toBe(403)
  })

  it('ein gesperrtes Gerät kommt nicht mehr an die Daten', async () => {
    const c = await newFamily('mama@example.de', 'Familie Test')
    await putFamily(c, [ben])
    const { cookie: dev } = await pair(c, 'ben-a1b2c3')
    const list = await ask(konto.GET, api('/api/konto?aktion=geraete', c))
    expect(list.body.geraete).toHaveLength(1)
    expect((await ask(konto.POST, api('/api/konto', c, { aktion: 'geraet-sperren', geraet: list.body.geraete[0].id }))).status).toBe(200)
    expect((await ask(data.GET, api('/api/data', dev))).status).toBe(401)
    expect((await ask(konto.GET, api('/api/konto?aktion=geraete', c))).body.geraete).toHaveLength(0)
  })

  it('trennt Familien voneinander', async () => {
    const a = await newFamily('mama@example.de', 'Familie A')
    await putFamily(a, [ben])
    const { cookie: dev } = await pair(a, 'ben-a1b2c3')
    const b = await newFamily('fremd@example.de', 'Familie B')
    expect((await ask(data.GET, api('/api/data?kind=ben-a1b2c3', b))).status).toBe(403)
    expect((await ask(data.GET, api('/api/data?familie', b))).body.family.children).toEqual([])
    // Bens Id in die eigene Liste schreiben, um ihn zu übernehmen: abgelehnt
    expect((await putFamily(b, [{ ...ben, updatedAt: '2027-01-01T00:00:00.000Z' }])).status).toBe(400)
    expect((await ask(konto.POST, api('/api/konto', b, { aktion: 'geraet-code', kind: 'ben-a1b2c3' }))).status).toBe(403)
    const devId = (await ask(konto.GET, api('/api/konto?aktion=geraete', a))).body.geraete[0].id
    expect((await ask(konto.POST, api('/api/konto', b, { aktion: 'geraet-sperren', geraet: devId }))).status).toBe(403)
    expect((await ask(data.GET, api('/api/data', dev))).status).toBe(200)
  })

  it('übernimmt Luisas bisherige Familie mit dem Familien-Passwort, auch für den zweiten Elternteil', async () => {
    fake.tables.family_data.push(
      { id: 'kinder', data: { children: [LUISA, ben], pin: '2468' }, updated_at: '2026-10-31T12:00:00Z' },
      { id: 'familie', data: { ...empty, selection: ['Brüche'] }, updated_at: '2026-10-31T12:00:00Z' },
    )
    const mama = await parentLogin('mama@example.de')
    expect((await ask(konto.POST, api('/api/konto', mama, { aktion: 'familie-uebernehmen', passwort: 'falsch' }))).status).toBe(403)
    const r = await ask(konto.POST, api('/api/konto', mama, { aktion: 'familie-uebernehmen', passwort: 'Hühnerstall-42' }))
    expect(r.body.familie).toMatchObject({ bisherige: true, pin: true })
    expect(fake.tables.children.map((c) => c.id).sort()).toEqual(['ben-a1b2c3', 'luisa'])

    const papa = await parentLogin('papa@example.de')
    await ask(konto.POST, api('/api/konto', papa, { aktion: 'familie-uebernehmen', passwort: 'Hühnerstall-42' }))
    expect(fake.tables.families).toHaveLength(1)
    // Luisas Lernstand bleibt in „familie“ und ist für beide sichtbar
    expect((await ask(data.GET, api('/api/data?kind=luisa', papa))).body.saved.selection).toEqual(['Brüche'])

    // Luisas Gerät mit Code: sieht ihren bisherigen Stand
    const { cookie: dev } = await pair(mama, 'luisa')
    expect((await ask(data.GET, api('/api/data', dev))).body.saved.selection).toEqual(['Brüche'])
    expect((await ask(data.GET, api('/api/data?kind=ben-a1b2c3', dev))).status).toBe(403)

    // Geräte mit dem alten Passwort laufen weiter und sehen jetzt die Kinderliste aus dem Konto
    const old = `luisa_zugang=${await legacyToken('Hühnerstall-42')}`
    expect((await ask(data.GET, api('/api/data?familie', old))).body.family.pin).toBe('2468')
    expect((await ask(data.GET, api('/api/data', old))).body.saved.selection).toEqual(['Brüche'])
  })

  it('ein Kindergerät bleibt beim Kind, auch wenn dort noch das alte Passwort-Cookie liegt', async () => {
    const c = await newFamily('mama@example.de', 'Familie Test')
    await putFamily(c, [ben])
    const { cookie: dev } = await pair(c, 'ben-a1b2c3')
    const both = `${dev}; luisa_zugang=${await legacyToken('Hühnerstall-42')}`
    expect((await ask(data.GET, api('/api/data?kind=luisa', both))).status).toBe(403)
  })
})

describe('Name der App', () => {
  beforeEach(() => {
    fake = fakeSupabase()
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-geheim')
    vi.stubEnv('SESSION_SECRET', 'sitzungs-schluessel')
    vi.stubEnv('APP_PASSWORD', 'Hühnerstall-42')
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => fake.handle(u, i)))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  const nameFor = async (cookie: string) => (await (await middleware(new Request(`${BASE}/manifest.webmanifest`, { headers: { cookie } }))).json()).name

  it('heißt auf dem Gerät eines Kindes wie das Kind, sonst wie die App', async () => {
    expect(await nameFor('')).toBe('Lernhof')
    const c = await newFamily('mama@example.de', 'Familie Test')
    expect(await nameFor(c)).toBe('Lernhof')
    await putFamily(c, [{ ...ben, name: 'Caroline' }])
    const { cookie: dev } = await pair(c, 'ben-a1b2c3')
    expect(await nameFor(dev)).toBe('Caroline lernen')
    expect(await nameFor(`luisa_zugang=${await legacyToken('Hühnerstall-42')}`)).toBe('Luisa lernen')
  })
})
