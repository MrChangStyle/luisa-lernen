import { mergeSaved } from '../src/logic/merge.js'
import type { Saved } from '../src/state.js'

// Cloud-Speicher der Familie in Supabase (EU, Frankfurt). Alle Geräte lesen und schreiben denselben Stand.
// Die Middleware lässt nur angemeldete Geräte bis hierher. Der geheime Schlüssel bleibt auf dem Server.

const URL_DEFAULT = 'https://dmccelapjdnftwtbrwia.supabase.co'
const ROW = 'familie'

type Row = { data: Saved; updated_at: string }

function db() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) return null
  const base = `${process.env.SUPABASE_URL ?? URL_DEFAULT}/rest/v1/family_data`
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  return {
    async read(): Promise<Row | null> {
      const res = await fetch(`${base}?id=eq.${ROW}&select=data,updated_at`, { headers })
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
      const rows = (await res.json()) as Row[]
      return rows[0] ?? null
    },
    // Schreibt nur, wenn seit dem Lesen niemand anderes geschrieben hat. Sonst false.
    async write(data: Saved, before: Row | null): Promise<boolean> {
      const now = new Date().toISOString()
      const res = before
        ? await fetch(`${base}?id=eq.${ROW}&updated_at=eq.${encodeURIComponent(before.updated_at)}`, {
            method: 'PATCH',
            headers: { ...headers, prefer: 'return=representation' },
            body: JSON.stringify({ data, updated_at: now }),
          })
        : await fetch(base, { method: 'POST', headers: { ...headers, prefer: 'return=representation' }, body: JSON.stringify({ id: ROW, data, updated_at: now }) })
      if (res.status === 409) return false
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
      return ((await res.json()) as unknown[]).length > 0
    },
  }
}

const looksSaved = (s: unknown): s is Saved =>
  !!s && typeof s === 'object' && Array.isArray((s as Saved).attempts) && Array.isArray((s as Saved).events) && typeof (s as Saved).lessons === 'object' && typeof (s as Saved).farm === 'object'

const notReady = () => Response.json({ error: 'Der Cloud-Speicher ist noch nicht eingerichtet.' }, { status: 503 })

export async function GET() {
  const store = db()
  if (!store) return notReady()
  try {
    const row = await store.read()
    return Response.json({ saved: row?.data ?? null }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, { status: 502 })
  }
}

export async function PUT(request: Request) {
  const store = db()
  if (!store) return notReady()
  const body = (await request.json().catch(() => null)) as { saved?: unknown } | null
  if (!looksSaved(body?.saved)) return Response.json({ error: 'Ungültige Daten.' }, { status: 400 })
  try {
    for (let i = 0; i < 4; i++) {
      const row = await store.read()
      const merged = row ? mergeSaved(row.data, body.saved) : body.saved
      if (await store.write(merged, row)) return Response.json({ saved: merged }, { headers: { 'cache-control': 'no-store' } })
    }
    return Response.json({ error: 'Gerade speichern mehrere Geräte gleichzeitig.' }, { status: 409 })
  } catch (e) {
    return Response.json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, { status: 502 })
  }
}
