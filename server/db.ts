// Zugriff auf Supabase (PostgREST und Auth) nur vom Server aus, mit dem geheimen Schlüssel.
// Die Tabellen haben RLS ohne Policies: Mit dem öffentlichen Schlüssel kommt niemand an die Daten.

const URL_DEFAULT = 'https://dmccelapjdnftwtbrwia.supabase.co'

export const supabaseUrl = () => process.env.SUPABASE_URL ?? URL_DEFAULT
export const secretKey = () => process.env.SUPABASE_SECRET_KEY || null

const headers = (key: string, extra: Record<string, string> = {}) => ({ apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...extra })

export class DbError extends Error {}

async function rest<T>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
  const key = secretKey()
  if (!key) throw new DbError('SUPABASE_SECRET_KEY fehlt')
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method,
    headers: headers(key, prefer ? { prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new DbError(`Supabase ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

const q = encodeURIComponent

export const db = {
  select: <T>(table: string, filter: string) => rest<T[]>('GET', `${table}?${filter}`),
  insert: <T>(table: string, row: unknown) => rest<T[]>('POST', table, row, 'return=representation'),
  upsert: <T>(table: string, row: unknown) => rest<T[]>('POST', table, row, 'return=representation,resolution=merge-duplicates'),
  update: <T>(table: string, filter: string, patch: unknown) => rest<T[]>('PATCH', `${table}?${filter}`, patch, 'return=representation'),
  remove: (table: string, filter: string) => rest<null>('DELETE', `${table}?${filter}`),
  eq: (col: string, v: string) => `${col}=eq.${q(v)}`,
}

// --- Anmeldung der Eltern per E-Mail-Code (Supabase Auth) ---

export async function sendEmailCode(email: string): Promise<void> {
  const key = secretKey()
  if (!key) throw new DbError('SUPABASE_SECRET_KEY fehlt')
  const res = await fetch(`${supabaseUrl()}/auth/v1/otp`, { method: 'POST', headers: headers(key), body: JSON.stringify({ email, create_user: true }) })
  if (!res.ok) throw new DbError(`Auth ${res.status}: ${await res.text()}`)
}

export async function verifyEmailCode(email: string, token: string): Promise<{ id: string; email: string } | null> {
  const key = secretKey()
  if (!key) throw new DbError('SUPABASE_SECRET_KEY fehlt')
  const res = await fetch(`${supabaseUrl()}/auth/v1/verify`, { method: 'POST', headers: headers(key), body: JSON.stringify({ type: 'email', email, token }) })
  if (res.status === 400 || res.status === 401 || res.status === 403) return null
  if (!res.ok) throw new DbError(`Auth ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { user?: { id?: string; email?: string } }
  return body.user?.id ? { id: body.user.id, email: body.user.email ?? email } : null
}
