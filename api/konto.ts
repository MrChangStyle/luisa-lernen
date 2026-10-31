import { LUISA, parseChild, type Child, type FamilyInfo } from '../src/logic/learner.js'
import { childrenOf, toChild, who, type FamilyRow } from '../server/auth.js'
import { db, secretKey } from '../server/db.js'
import { codeHash, legacyToken, same } from '../server/session.js'

// Eltern-Konto: Familie anlegen oder die bisherige übernehmen, Kindergeräte einrichten und sperren.
// GET  ?aktion=ich                      → wer bin ich (Kindergerät, Eltern, bisheriges Passwort)
// POST {aktion:'familie-anlegen', name}
// POST {aktion:'familie-uebernehmen', passwort}   bisherige Familie mit Luisa (Familien-Passwort nötig)
// POST {aktion:'geraet-code', kind}     6-stelliger Einmal-Code, 15 Minuten gültig
// GET  ?aktion=geraete                  Geräte der Kinder dieser Familie
// POST {aktion:'geraet-sperren', geraet}

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
const fail = (error: string, status = 400) => json({ error }, status)

export const CODE_MINUTES = 15

const familyOut = (f: FamilyRow | null) => (f ? { id: f.id, name: f.name, bisherige: f.legacy, pin: !!f.pin } : null)

export async function GET(request: Request) {
  if (!secretKey()) return fail('Der Cloud-Speicher ist noch nicht eingerichtet.', 503)
  try {
    const w = await who(request)
    if (!w) return fail('Bitte melde dich an.', 401)
    const aktion = new URL(request.url).searchParams.get('aktion') ?? 'ich'
    if (aktion === 'ich') {
      if (w.r === 'kind') return json({ rolle: 'kind', kind: toChild(w.child), familie: familyOut(w.family) })
      if (w.r === 'eltern') return json({ rolle: 'eltern', email: w.email, familie: familyOut(w.family) })
      return json({ rolle: 'alt' })
    }
    if (aktion === 'geraete') {
      if (w.r !== 'eltern' || !w.family) return fail('Dafür fehlt die Berechtigung.', 403)
      const ids = (await childrenOf(w.family.id)).map((c) => c.id)
      if (!ids.length) return json({ geraete: [] })
      const rows = await db.select<{ id: string; child_id: string; label: string | null; created_at: string; last_seen: string | null }>(
        'devices',
        `child_id=in.(${ids.map(encodeURIComponent).join(',')})&revoked_at=is.null&select=id,child_id,label,created_at,last_seen&order=created_at.asc`,
      )
      return json({ geraete: rows.map((d) => ({ id: d.id, kind: d.child_id, name: d.label ?? 'Gerät', seit: d.created_at, zuletzt: d.last_seen })) })
    }
    return fail('Unbekannte Aktion.')
  } catch (e) {
    return json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, 502)
  }
}

type Body = { aktion?: unknown; name?: unknown; passwort?: unknown; kind?: unknown; geraet?: unknown }

export async function POST(request: Request) {
  if (!secretKey()) return fail('Der Cloud-Speicher ist noch nicht eingerichtet.', 503)
  try {
    const w = await who(request)
    if (!w) return fail('Bitte melde dich an.', 401)
    if (w.r !== 'eltern') return fail('Das geht nur mit einem Eltern-Konto.', 403)
    const body = ((await request.json().catch(() => null)) ?? {}) as Body

    switch (body.aktion) {
      case 'familie-anlegen': {
        if (w.family) return fail('Du gehörst schon zu einer Familie.', 409)
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
        if (!name) return fail('Bitte einen Namen für die Familie eingeben.')
        const [f] = await db.insert<FamilyRow>('families', { name })
        await db.update('parents', db.eq('user_id', w.userId), { family_id: f.id })
        return json({ familie: familyOut(f) })
      }

      case 'familie-uebernehmen': {
        if (w.family) return fail('Du gehörst schon zu einer Familie.', 409)
        const password = process.env.APP_PASSWORD
        const given = typeof body.passwort === 'string' ? body.passwort : ''
        if (!password || !given || !same(await legacyToken(given), await legacyToken(password))) {
          await new Promise((r) => setTimeout(r, 1000))
          return fail('Das Familien-Passwort passt nicht.', 403)
        }
        // Zweiter Elternteil: tritt der schon übernommenen Familie bei
        let f = (await db.select<FamilyRow>('families', 'legacy=eq.true&select=id,name,legacy,pin&limit=1'))[0]
        if (!f) {
          const old = (await db.select<{ data: FamilyInfo }>('family_data', `${db.eq('id', 'kinder')}&select=data`))[0]?.data
          const kids: Child[] = (old?.children ?? []).map((c) => parseChild(c)).filter((c): c is Child => !!c)
          if (!kids.some((c) => c.id === LUISA.id)) kids.unshift(LUISA)
          // Ältere PIN aus Luisas Lernstand, falls die Kinderliste noch keine hat
          const luisaPin = (await db.select<{ data: { parentPin?: string | null } }>('family_data', `${db.eq('id', 'familie')}&select=data`))[0]?.data?.parentPin
          const pin = [old?.pin, luisaPin].find((p) => typeof p === 'string' && /^\d{4}$/.test(p)) ?? null
          ;[f] = await db.insert<FamilyRow>('families', { name: 'Familie von Luisa', legacy: true, pin })
          await db.upsert(
            'children',
            kids.map((c) => ({ id: c.id, family_id: f.id, name: c.name, grade: c.grade, school: c.school, helps: c.helps, updated_at: c.updatedAt })),
          )
        }
        await db.update('parents', db.eq('user_id', w.userId), { family_id: f.id })
        return json({ familie: familyOut(f) })
      }

      case 'geraet-code': {
        if (!w.family) return fail('Lege zuerst eine Familie an.', 409)
        const childId = typeof body.kind === 'string' ? body.kind : ''
        if (!(await childrenOf(w.family.id)).some((c) => c.id === childId)) return fail('Dieses Kind gehört nicht zu deiner Familie.', 403)
        // Abgelaufene Codes aufräumen, damit die Tabelle klein bleibt
        await db.remove('device_codes', `expires_at=lt.${encodeURIComponent(new Date().toISOString())}`)
        const expires = new Date(Date.now() + CODE_MINUTES * 60_000).toISOString()
        for (let i = 0; i < 5; i++) {
          const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
          try {
            await db.insert('device_codes', { code_hash: await codeHash(code), child_id: childId, expires_at: expires })
            return json({ code, gueltigBis: expires })
          } catch (e) {
            if (!String(e).includes('409')) throw e
          }
        }
        return fail('Gerade ist kein Code frei. Bitte gleich noch einmal versuchen.', 503)
      }

      case 'geraet-sperren': {
        if (!w.family) return fail('Dafür fehlt die Berechtigung.', 403)
        const id = typeof body.geraet === 'string' && /^[0-9a-f-]{36}$/.test(body.geraet) ? body.geraet : ''
        const dev = id ? (await db.select<{ child_id: string }>('devices', `${db.eq('id', id)}&select=child_id`))[0] : undefined
        if (!dev || !(await childrenOf(w.family.id)).some((c) => c.id === dev.child_id)) return fail('Dieses Gerät gehört nicht zu deiner Familie.', 403)
        await db.update('devices', db.eq('id', id), { revoked_at: new Date().toISOString() })
        return json({ ok: true })
      }
    }
    return fail('Unbekannte Aktion.')
  } catch (e) {
    return json({ error: 'Cloud nicht erreichbar.', detail: String(e) }, 502)
  }
}
