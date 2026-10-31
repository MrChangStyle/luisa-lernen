// Kleiner Ersatz für Supabase (PostgREST und Auth) im Speicher. Kann genau das, was server/db.ts benutzt:
// Filter eq, in, is.null, lt; insert (409 bei doppeltem Schlüssel), upsert, update, delete; E-Mail-Code 123456.

type Row = Record<string, unknown>

const KEYS: Record<string, string> = { family_data: 'id', families: 'id', parents: 'user_id', children: 'id', devices: 'id', device_codes: 'code_hash' }

const DEFAULTS: Record<string, () => Row> = {
  families: () => ({ id: crypto.randomUUID(), legacy: false, pin: null, created_at: new Date().toISOString() }),
  parents: () => ({ family_id: null }),
  children: () => ({ helps: [], updated_at: new Date().toISOString() }),
  devices: () => ({ id: crypto.randomUUID(), label: null, created_at: new Date().toISOString(), last_seen: null, revoked_at: null }),
}

export const VALID_EMAIL_CODE = '123456'

export function fakeSupabase() {
  const tables: Record<string, Row[]> = { family_data: [], families: [], parents: [], children: [], devices: [], device_codes: [] }
  const users = new Map<string, string>()
  let writes = 0

  const matches = (r: Row, filters: [string, string][]) =>
    filters.every(([col, cond]) => {
      const v = r[col]
      if (cond.startsWith('eq.')) return String(v) === cond.slice(3)
      if (cond.startsWith('in.(')) return cond.slice(4, -1).split(',').map(decodeURIComponent).includes(String(v))
      if (cond === 'is.null') return v === null || v === undefined
      if (cond.startsWith('lt.')) return String(v) < cond.slice(3)
      throw new Error(`Filter nicht unterstützt: ${col}=${cond}`)
    })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  async function handle(input: string, init?: RequestInit): Promise<Response> {
    const url = new URL(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : null

    if (url.pathname === '/auth/v1/otp') return json({})
    if (url.pathname === '/auth/v1/verify') {
      if (body.token !== VALID_EMAIL_CODE) return json({ msg: 'Token has expired or is invalid' }, 403)
      if (!users.has(body.email)) users.set(body.email, crypto.randomUUID())
      return json({ user: { id: users.get(body.email), email: body.email } })
    }

    const table = url.pathname.replace('/rest/v1/', '')
    const rows = tables[table]
    if (!rows) return json({ message: `unbekannte Tabelle ${table}` }, 404)
    const key = KEYS[table]
    const filters: [string, string][] = []
    let limit = Infinity
    for (const [k, v] of url.searchParams) {
      if (k === 'select' || k === 'order') continue
      if (k === 'limit') limit = Number(v)
      else filters.push([k, v])
    }

    if (method === 'GET') return json(rows.filter((r) => matches(r, filters)).slice(0, limit))
    writes++
    if (method === 'POST') {
      const upsert = String((init?.headers as Record<string, string>)?.prefer ?? '').includes('merge-duplicates')
      const list = (Array.isArray(body) ? body : [body]) as Row[]
      const out: Row[] = []
      for (const item of list) {
        const full = { ...(DEFAULTS[table]?.() ?? {}), ...item }
        const at = rows.findIndex((r) => r[key] === full[key])
        if (at >= 0 && !upsert) return json({ message: 'duplicate key' }, 409)
        if (at >= 0) rows[at] = { ...rows[at], ...item }
        else rows.push(full)
        out.push(at >= 0 ? rows[at] : full)
      }
      return json(out, 201)
    }
    if (method === 'PATCH') {
      const hit = rows.filter((r) => matches(r, filters))
      hit.forEach((r) => Object.assign(r, body))
      return json(hit)
    }
    if (method === 'DELETE') {
      tables[table] = rows.filter((r) => !matches(r, filters))
      return new Response(null, { status: 204 })
    }
    return json({ message: 'Methode?' }, 405)
  }

  return { tables, handle, writes: () => writes }
}
