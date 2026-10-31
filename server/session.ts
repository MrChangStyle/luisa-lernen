// Signierte Cookies für Eltern-Konten und Kindergeräte. Der Inhalt ist lesbar, aber nicht fälschbar.
// Schlüssel: SESSION_SECRET oder, wenn nicht gesetzt, der geheime Supabase-Schlüssel (bleibt auf dem Server).

export const PARENT_COOKIE = 'eltern'
export const DEVICE_COOKIE = 'kindgeraet'
export const LEGACY_COOKIE = 'luisa_zugang'

export type Session = { r: 'eltern'; u: string; exp: number } | { r: 'kind'; d: string; c: string; exp: number }

const DAY = 60 * 60 * 24
export const PARENT_DAYS = 60
export const DEVICE_DAYS = 730

const enc = new TextEncoder()
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

export const sessionKey = () => process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || null

export async function hmac(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Einmal-Codes für Kindergeräte liegen nur als Hash in der Datenbank
export const codeHash = (code: string) => hmac(sessionKey() ?? '', `geraete-code-v1:${code}`)

// Vergleich in gleicher Zeit
export function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function sign(s: Session): Promise<string | null> {
  const key = sessionKey()
  if (!key) return null
  const body = b64(JSON.stringify(s))
  return `${body}.${await hmac(key, `sitzung-v1:${body}`)}`
}

export async function verify(value: string | null, now = Date.now()): Promise<Session | null> {
  const key = sessionKey()
  if (!key || !value) return null
  const [body, sig] = value.split('.')
  if (!body || !sig || !same(sig, await hmac(key, `sitzung-v1:${body}`))) return null
  try {
    const s = JSON.parse(unb64(body)) as Session
    return s.exp * 1000 > now ? s : null
  } catch {
    return null
  }
}

export function cookie(request: Request, name: string) {
  const all = request.headers.get('cookie') ?? ''
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

export const setCookie = (name: string, value: string, days: number) => `${name}=${value}; Path=/; Max-Age=${days * DAY}; HttpOnly; Secure; SameSite=Lax`
export const clearCookie = (name: string) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
export const expiry = (days: number) => Math.floor(Date.now() / 1000) + days * DAY

// Altes Familien-Passwort (APP_PASSWORD): gilt weiter, bis alle Geräte umgestellt sind
export async function legacyToken(password: string) {
  return hmac(password, 'luisa-lernen-zugang-v1')
}

export async function legacyOk(request: Request) {
  const password = process.env.APP_PASSWORD
  if (!password) return false
  return same(cookie(request, LEGACY_COOKIE) ?? '', await legacyToken(password))
}

// Wer fragt? Nur Signatur und Ablauf; ob ein Gerät gesperrt ist, prüft server/auth.ts mit der Datenbank.
// Ein Kindergerät hat Vorrang: Auch wenn dort noch das alte Familien-Cookie liegt, sieht es nur sein Kind.
export async function sessionOf(request: Request): Promise<Session | { r: 'alt' } | null> {
  const device = await verify(cookie(request, DEVICE_COOKIE))
  if (device?.r === 'kind') return device
  const parent = await verify(cookie(request, PARENT_COOKIE))
  if (parent?.r === 'eltern') return parent
  if (await legacyOk(request)) return { r: 'alt' }
  return null
}
