import { mergeSaved } from '../src/logic/merge.js'
import type { Saved } from '../src/types.js'
import { CHILD_ID, LUISA, mergeFamily, parseChild, type Child, type FamilyInfo } from '../src/logic/learner.js'
import { childrenOf, rowOf, toChild, who, type FamilyRow, type Who } from '../server/auth.js'
import { db, secretKey } from '../server/db.js'

// Lernstände und Kinderliste. Jede Anfrage wird nach Rolle geprüft:
// - Kindergerät: nur der eigene Lernstand und das eigene Kind, nichts von Geschwistern.
// - Eltern: Lernstände und Kinderliste der eigenen Familie.
// - Familien-Passwort (bisher): Luisas Familie. Ist sie schon ins Konto übernommen, gilt die Kinderliste aus der Datenbank.
// Lernstände liegen in family_data: „familie“ = Luisa, „kind-<id>“ = jedes weitere Kind, „kinder“ = alte Kinderliste.

type Row<T> = { data: T; updated_at: string }

function store<T>(id: string) {
  return {
    async read(): Promise<Row<T> | null> {
      return (await db.select<Row<T>>('family_data', `${db.eq('id', id)}&select=data,updated_at`))[0] ?? null
    },
    // Schreibt nur, wenn seit dem Lesen niemand anderes geschrieben hat. Sonst false.
    async write(data: T, before: Row<T> | null): Promise<boolean> {
      const now = new Date().toISOString()
      try {
        const rows = before
          ? await db.update('family_data', `${db.eq('id', id)}&${db.eq('updated_at', before.updated_at)}`, { data, updated_at: now })
          : await db.insert('family_data', { id, data, updated_at: now })
        return rows.length > 0
      } catch (e) {
        if (String(e).includes('409')) return false
        throw e
      }
    },
  }
}

const looksSaved = (s: unknown): s is Saved =>
  !!s && typeof s === 'object' && Array.isArray((s as Saved).attempts) && Array.isArray((s as Saved).events) && typeof (s as Saved).lessons === 'object' && typeof (s as Saved).farm === 'object'

const looksFamily = (f: unknown): f is FamilyInfo =>
  !!f &&
  typeof f === 'object' &&
  Array.isArray((f as FamilyInfo).children) &&
  (f as FamilyInfo).children.length <= 30 &&
  (f as FamilyInfo).children.every((c) => parseChild(c)) &&
  ((f as FamilyInfo).pin === null || /^\d{4}$/.test(String((f as FamilyInfo).pin)))

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
const bad = () => json({ error: 'Ungültige Daten.' }, 400)
const denied = () => json({ error: 'Dafür fehlt die Berechtigung.' }, 403)
const notReady = () => json({ error: 'Der Cloud-Speicher ist noch nicht eingerichtet.' }, 503)

// Die bisherige Familie, falls schon ins Eltern-Konto übernommen
// Solange die neuen Tabellen noch nicht angelegt sind, läuft alles wie bisher.
async function legacyFamily(): Promise<FamilyRow | null> {
  try {
    return (await db.select<FamilyRow>('families', 'legacy=eq.true&select=id,name,legacy,pin&limit=1'))[0] ?? null
  } catch (e) {
    if (/Supabase 404|PGRST205|42P01/.test(String(e))) return null
    throw e
  }
}

// Familie hinter der Anfrage: für Eltern ihre, für das alte Passwort die übernommene (oder null = alte Zeile „kinder“)
async function familyFor(w: Who): Promise<FamilyRow | null | 'alt'> {
  if (w.r === 'kind') return w.family
  if (w.r === 'eltern') return w.family
  return (await legacyFamily()) ?? 'alt'
}

const familyInfo = async (f: FamilyRow): Promise<FamilyInfo> => ({ children: (await childrenOf(f.id)).map(toChild), pin: f.pin })

// Darf diese Anfrage den Lernstand dieses Kindes lesen und schreiben?
async function mayUseChild(w: Who, childId: string): Promise<boolean> {
  if (w.r === 'kind') return w.child.id === childId
  const f = await familyFor(w)
  if (f === 'alt') return true
  if (!f) return false
  if (f.legacy && childId === LUISA.id) return true
  return (await childrenOf(f.id)).some((c) => c.id === childId)
}

async function save<T>(id: string, data: T, merge: (old: T, next: T) => T, key: string) {
  const s = store<T>(id)
  for (let i = 0; i < 4; i++) {
    const row = await s.read()
    const merged = row ? merge(row.data, data) : data
    if (await s.write(merged, row)) return json({ [key]: merged })
  }
  return json({ error: 'Gerade speichern mehrere Geräte gleichzeitig.' }, 409)
}

// Neue oder geänderte Kinder in die Tabelle children. Ein Kind einer anderen Familie lässt sich nicht übernehmen.
async function saveChildren(f: FamilyRow, info: FamilyInfo): Promise<FamilyInfo | 'fremd'> {
  const ids = info.children.map((c) => c.id)
  const existing = ids.length ? await db.select<{ id: string; family_id: string; updated_at: string }>('children', `id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,family_id,updated_at`) : []
  if (existing.some((e) => e.family_id !== f.id)) return 'fremd'
  if (!f.legacy && ids.includes(LUISA.id) && !existing.some((e) => e.id === LUISA.id)) return 'fremd'
  const newer = info.children.filter((c) => {
    const old = existing.find((e) => e.id === c.id)
    return !old || Date.parse(c.updatedAt) > Date.parse(old.updated_at)
  })
  if (newer.length) {
    await db.upsert(
      'children',
      newer.map((c: Child) => ({ id: c.id, family_id: f.id, name: c.name, grade: c.grade, school: c.school, helps: c.helps, updated_at: c.updatedAt })),
    )
  }
  if (info.pin && info.pin !== f.pin) await db.update('families', db.eq('id', f.id), { pin: info.pin })
  return familyInfo({ ...f, pin: info.pin ?? f.pin })
}

export async function GET(request: Request) {
  if (!secretKey()) return notReady()
  try {
    const w = await who(request)
    if (!w) return json({ error: 'Bitte melde dich an.' }, 401)
    const q = new URL(request.url).searchParams
    if (q.has('familie')) {
      if (w.r === 'kind') return json({ family: { children: [toChild(w.child)], pin: w.family.pin } })
      const f = await familyFor(w)
      if (f === 'alt') return json({ family: (await store<FamilyInfo>('kinder').read())?.data ?? null })
      if (!f) return json({ error: 'Es gibt noch keine Familie.' }, 409)
      return json({ family: await familyInfo(f) })
    }
    const childId = q.get('kind') ?? (w.r === 'kind' ? w.child.id : LUISA.id)
    if (!CHILD_ID.test(childId)) return bad()
    if (!(await mayUseChild(w, childId))) return denied()
    return json({ saved: (await store<Saved>(rowOf(childId)).read())?.data ?? null })
  } catch (e) {
    return json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, 502)
  }
}

export async function PUT(request: Request) {
  if (!secretKey()) return notReady()
  try {
    const w = await who(request)
    if (!w) return json({ error: 'Bitte melde dich an.' }, 401)
    const q = new URL(request.url).searchParams
    const body = (await request.json().catch(() => null)) as { saved?: unknown; family?: unknown } | null
    if (q.has('familie')) {
      if (w.r === 'kind') return denied()
      if (!looksFamily(body?.family)) return bad()
      const clean: FamilyInfo = { children: body.family.children.map((c) => parseChild(c)!), pin: body.family.pin ?? null }
      const f = await familyFor(w)
      if (f === 'alt') return save<FamilyInfo>('kinder', clean, mergeFamily, 'family')
      if (!f) return json({ error: 'Es gibt noch keine Familie.' }, 409)
      const r = await saveChildren(f, clean)
      return r === 'fremd' ? bad() : json({ family: r })
    }
    const childId = q.get('kind') ?? (w.r === 'kind' ? w.child.id : LUISA.id)
    if (!CHILD_ID.test(childId)) return bad()
    if (!looksSaved(body?.saved)) return bad()
    if (!(await mayUseChild(w, childId))) return denied()
    return save<Saved>(rowOf(childId), body.saved, mergeSaved, 'saved')
  } catch (e) {
    return json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, 502)
  }
}
