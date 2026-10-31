import { db } from './db.js'
import { sessionOf } from './session.js'
import { LUISA, type Child } from '../src/logic/learner.js'

// Wer fragt, mit Prüfung in der Datenbank:
// kind  = ein eingerichtetes Kindergerät, sieht nur dieses eine Kind
// eltern = angemeldeter Elternteil, sieht die Kinder seiner Familie (familyId null: noch keine Familie)
// alt   = bisheriges Familien-Passwort (Luisas Familie, bis alle Geräte umgestellt sind)

export type FamilyRow = { id: string; name: string; legacy: boolean; pin: string | null }
export type ChildRow = { id: string; family_id: string; name: string; grade: number; school: string; helps: string[]; updated_at: string }

export type Who =
  | { r: 'kind'; deviceId: string; child: ChildRow; family: FamilyRow }
  | { r: 'eltern'; userId: string; email: string; family: FamilyRow | null }
  | { r: 'alt' }

export const toChild = (c: ChildRow): Child => ({ id: c.id, name: c.name, grade: c.grade, school: c.school, helps: (c.helps ?? []) as Child['helps'], updatedAt: new Date(c.updated_at).toISOString() })

export async function familyById(id: string) {
  return (await db.select<FamilyRow>('families', `${db.eq('id', id)}&select=id,name,legacy,pin`))[0] ?? null
}

export async function childrenOf(familyId: string) {
  return db.select<ChildRow>('children', `${db.eq('family_id', familyId)}&select=*&order=updated_at.asc`)
}

export async function who(request: Request): Promise<Who | null> {
  const s = await sessionOf(request)
  if (!s) return null
  if (s.r === 'alt') return s
  if (s.r === 'kind') {
    const dev = (await db.select<{ id: string; child_id: string; revoked_at: string | null }>('devices', `${db.eq('id', s.d)}&select=id,child_id,revoked_at`))[0]
    if (!dev || dev.revoked_at || dev.child_id !== s.c) return null
    const child = (await db.select<ChildRow>('children', `${db.eq('id', s.c)}&select=*`))[0]
    const family = child && (await familyById(child.family_id))
    if (!child || !family) return null
    void db.update('devices', db.eq('id', dev.id), { last_seen: new Date().toISOString() }).catch(() => {})
    return { r: 'kind', deviceId: dev.id, child, family }
  }
  const p = (await db.select<{ email: string; family_id: string | null }>('parents', `${db.eq('user_id', s.u)}&select=email,family_id`))[0]
  if (!p) return null
  return { r: 'eltern', userId: s.u, email: p.email, family: p.family_id ? await familyById(p.family_id) : null }
}

// Zeile in family_data für den Lernstand eines Kindes. Luisa (bisherige Familie) behält „familie“.
export const rowOf = (childId: string) => (childId === LUISA.id ? 'familie' : `kind-${childId}`)
