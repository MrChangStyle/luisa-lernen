import { mergeSaved } from '../src/logic/merge.js'
import type { Saved } from '../src/types.js'
import { CHILD_ID, mergeFamily, parseChild, type FamilyInfo } from '../src/logic/learner.js'

// Cloud-Speicher der Familie in Supabase (EU, Frankfurt). Alle Geräte lesen und schreiben denselben Stand.
// Die Middleware lässt nur angemeldete Geräte bis hierher. Der geheime Schlüssel bleibt auf dem Server.
// Zeilen: „familie“ = Luisas Lernstand (wie bisher), „kind-<id>“ = Lernstand jedes weiteren Kindes,
// „kinder“ = Liste der Kinder mit ihren Hilfen und die gemeinsame Eltern-PIN.

const URL_DEFAULT = 'https://dmccelapjdnftwtbrwia.supabase.co'
const LUISA_ROW = 'familie'
const FAMILY_ROW = 'kinder'

type Row<T> = { data: T; updated_at: string }

function db<T>(ROW: string) {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) return null
  const base = `${process.env.SUPABASE_URL ?? URL_DEFAULT}/rest/v1/family_data`
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  return {
    async read(): Promise<Row<T> | null> {
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(ROW)}&select=data,updated_at`, { headers })
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
      const rows = (await res.json()) as Row<T>[]
      return rows[0] ?? null
    },
    // Schreibt nur, wenn seit dem Lesen niemand anderes geschrieben hat. Sonst false.
    async write(data: T, before: Row<T> | null): Promise<boolean> {
      const now = new Date().toISOString()
      const res = before
        ? await fetch(`${base}?id=eq.${encodeURIComponent(ROW)}&updated_at=eq.${encodeURIComponent(before.updated_at)}`, {
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

// Welche Zeile: ?kind=<id> für ein Kind (Luisa und ältere App-Versionen ohne Angabe: „familie“), ?familie für die Kinderliste
type Target = { kind: 'saved'; row: string } | { kind: 'family' } | null

function target(request?: Request): Target {
  const q = new URL(request?.url ?? 'http://x/api/data').searchParams
  if (q.has('familie')) return { kind: 'family' }
  const id = q.get('kind')
  if (!id || id === 'luisa') return { kind: 'saved', row: LUISA_ROW }
  return CHILD_ID.test(id) ? { kind: 'saved', row: `kind-${id}` } : null
}

const looksFamily = (f: unknown): f is FamilyInfo =>
  !!f && typeof f === 'object' && Array.isArray((f as FamilyInfo).children) && (f as FamilyInfo).children.length <= 30 && (f as FamilyInfo).children.every((c) => parseChild(c)) &&
  ((f as FamilyInfo).pin === null || /^\d{4}$/.test(String((f as FamilyInfo).pin)))

const cleanFamily = (f: FamilyInfo): FamilyInfo => ({ children: f.children.map((c) => parseChild(c)!), pin: f.pin ?? null })

const bad = () => Response.json({ error: 'Ungültige Daten.' }, { status: 400 })
const noStore = { headers: { 'cache-control': 'no-store' } }

export async function GET(request?: Request) {
  const t = target(request)
  if (!t) return bad()
  const store = db<unknown>(t.kind === 'family' ? FAMILY_ROW : t.row)
  if (!store) return notReady()
  try {
    const row = await store.read()
    return Response.json(t.kind === 'family' ? { family: row?.data ?? null } : { saved: row?.data ?? null }, noStore)
  } catch (e) {
    return Response.json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, { status: 502 })
  }
}

export async function PUT(request: Request) {
  const t = target(request)
  if (!t) return bad()
  const body = (await request.json().catch(() => null)) as { saved?: unknown; family?: unknown } | null
  if (t.kind === 'family') {
    if (!looksFamily(body?.family)) return bad()
    return save(db<FamilyInfo>(FAMILY_ROW), cleanFamily(body.family), mergeFamily, 'family')
  }
  if (!looksSaved(body?.saved)) return bad()
  return save(db<Saved>(t.row), body.saved, mergeSaved, 'saved')
}

async function save<T>(store: ReturnType<typeof db<T>>, data: T, merge: (old: T, next: T) => T, key: string) {
  if (!store) return notReady()
  try {
    for (let i = 0; i < 4; i++) {
      const row = await store.read()
      const merged = row ? merge(row.data, data) : data
      if (await store.write(merged, row)) return Response.json({ [key]: merged }, noStore)
    }
    return Response.json({ error: 'Gerade speichern mehrere Geräte gleichzeitig.' }, { status: 409 })
  } catch (e) {
    return Response.json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, { status: 502 })
  }
}
