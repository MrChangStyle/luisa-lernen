import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import middleware from '../middleware'

const BASE = 'https://luisa-lernen.vercel.app'
const login = (passwort: string) =>
  middleware(new Request(`${BASE}/__anmelden`, { method: 'POST', body: new URLSearchParams({ passwort }) }))

describe('Passwortschutz', () => {
  beforeEach(() => {
    vi.stubEnv('APP_PASSWORD', 'Hühnerstall-42')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('zeigt ohne Anmeldung nur die Anmeldeseite', async () => {
    const res = await middleware(new Request(`${BASE}/`))
    expect(res.status).toBe(401)
    expect(await res.text()).toContain('Familien-Passwort')
  })

  it('sperrt auch die KI-Schnittstelle', async () => {
    const res = await middleware(new Request(`${BASE}/api/lesson`, { method: 'POST' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Familien-Passwort')
  })

  it('lehnt ein falsches Passwort ab', async () => {
    const res = await login('falsch')
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('setzt mit dem richtigen Passwort ein Cookie, mit dem alles aufgeht', async () => {
    const res = await login('Hühnerstall-42')
    expect(res.status).toBe(303)
    const set = res.headers.get('set-cookie')!
    expect(set).toContain('HttpOnly')
    expect(set).not.toContain('Hühnerstall')
    const cookie = set.split(';')[0]
    const ok = await middleware(new Request(`${BASE}/assets/app.js`, { headers: { cookie } }))
    expect(ok.headers.get('x-middleware-next')).toBe('1')
  })

  it('meldet alle Geräte ab, wenn das Passwort geändert wird', async () => {
    const cookie = (await login('Hühnerstall-42')).headers.get('set-cookie')!.split(';')[0]
    vi.stubEnv('APP_PASSWORD', 'neues-Passwort')
    expect((await middleware(new Request(`${BASE}/`, { headers: { cookie } }))).status).toBe(401)
  })

  it('bleibt gesperrt, solange kein Passwort eingerichtet ist', async () => {
    vi.stubEnv('APP_PASSWORD', '')
    const res = await middleware(new Request(`${BASE}/`))
    expect(res.status).toBe(503)
  })
})
