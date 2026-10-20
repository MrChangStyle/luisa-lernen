import type { Attempt, Farm, Saved } from '../types.js'

// Führt zwei Stände zusammen, z. B. Handy und Tablet. Nichts geht verloren:
// Aufgaben, Lernpfade, Stimmungen und Protokoll werden vereinigt, der Bauernhof wächst nur.
// `next` ist der neuere Stand (das Gerät, das gerade speichert); bei echten Widersprüchen gewinnt er.

const WORTH: Record<keyof Farm, number> = { egg: 1, chick: 10, hen: 100, rooster: 1000, cow: 10000 }

export const farmTotal = (f: Farm) => (Object.keys(WORTH) as (keyof Farm)[]).reduce((n, k) => n + (f[k] ?? 0) * WORTH[k], 0)

export function farmFromTotal(total: number): Farm {
  const cow = Math.floor(total / 10000)
  let rest = total % 10000
  const rooster = Math.floor(rest / 1000)
  rest %= 1000
  const hen = Math.floor(rest / 100)
  rest %= 100
  return { egg: rest % 10, chick: Math.floor(rest / 10), hen, rooster, cow }
}

// Eier, die sich aus den Daten belegen lassen: je bestandene Aufgabe und je bestätigte Tagesstimmung eins
export const earnedEggs = (s: Saved) =>
  new Set(s.attempts.filter((a) => a.finishedAt).map((a) => a.lessonId)).size + Object.values(s.mood).filter((m) => m.egg).length

function mergeAttempt(old: Attempt, next: Attempt): Attempt {
  return {
    ...old,
    ...next,
    finishedAt: next.finishedAt ?? old.finishedAt,
    stats: next.stats.length >= old.stats.length ? next.stats : old.stats,
  }
}

export function mergeSaved(old: Saved, next: Saved): Saved {
  const attempts = new Map(old.attempts.map((a) => [a.id, a]))
  for (const a of next.attempts) attempts.set(a.id, attempts.has(a.id) ? mergeAttempt(attempts.get(a.id)!, a) : a)

  const mood = { ...old.mood }
  for (const [day, m] of Object.entries(next.mood)) {
    const o = mood[day]
    mood[day] = !o || m.egg || (!o.egg && m.at >= o.at) ? m : o
  }

  const seen = new Set<string>()
  const events = [...old.events, ...next.events]
    .filter((e) => {
      const k = e.at + e.text
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-300)

  const merged: Saved = {
    ...old,
    ...next,
    attempts: [...attempts.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    lessons: { ...old.lessons, ...next.lessons },
    mood,
    events,
    donePractice: [...new Set([...old.donePractice, ...next.donePractice])],
    parentPin: next.parentPin ?? old.parentPin,
  }
  merged.farm = farmFromTotal(Math.max(farmTotal(old.farm), farmTotal(next.farm), earnedEggs(merged)))
  return merged
}
