import type { Lesson, PackLesson, PackTopic, Saved, VersionKey } from '../types'
import type { HelpKey, Learner } from './learner'

// Die App lernt pro Kind aus dem Lernverhalten. Alles hier ist nachvollziehbar und im Familienbereich sichtbar:
// - Welche Erklärung hilft diesem Kind meistens? Die kommt beim nächsten Mal zuerst.
// - Bei welchen Themen hat das Kind „Ich verstehe es noch nicht“ gedrückt? Dort beginnt die App leichter.

const current = (s: Saved) => s.attempts.filter((a) => !a.archivedAt)

// Erst ab 3 Schritten, bei denen eine Erklärung geholfen hat, und nur bei klarem Vorsprung
export function preferredVersion(s: Saved): { key: VersionKey; count: number; total: number } | null {
  const counts = new Map<VersionKey, number>()
  for (const a of current(s)) for (const st of a.stats) if (st.helped) counts.set(st.helped, (counts.get(st.helped) ?? 0) + 1)
  const total = [...counts.values()].reduce((n, c) => n + c, 0)
  if (total < 3) return null
  const [key, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  // Die erste Erklärung hilft oft einfach deshalb, weil sie die erste ist. Sie muss deutlich vorn liegen.
  return count / total >= 0.5 ? { key, count, total } : null
}

// Erklärung, die meistens hilft, als erste zeigen
export const withFirst = (l: Lesson, key: VersionKey | null): Lesson =>
  !key
    ? l
    : {
        ...l,
        steps: l.steps.map((st) => {
          const i = st.versions.findIndex((v) => v.key === key)
          return i > 0 ? { ...st, versions: [st.versions[i], ...st.versions.filter((_, j) => j !== i)] } : st
        }),
      }

// Themen, bei denen das Kind zuletzt „Ich verstehe es noch nicht“ gedrückt hat
export function hardTopics(s: Saved): string[] {
  const byTopic = new Map<string, Saved['attempts']>()
  for (const a of current(s)) byTopic.set(a.topic, [...(byTopic.get(a.topic) ?? []), a])
  return [...byTopic.entries()]
    .filter(([, list]) =>
      list
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 3)
        .some((a) => a.stats.some((st) => (st.stuck ?? 0) > 0)),
    )
    .map(([t]) => t)
}

// Zusätzliche Hilfen für die KI, wenn ein Thema schwerfällt
export const EASIER: HelpKey[] = ['kleineSchritte', 'zahlenBild', 'leichteSprache']
export const easierLearner = (l: Learner): Learner => ({ ...l, helps: [...new Set([...l.helps, ...EASIER])] })

// Leichtere Aufgabe aus dem Paket: zuerst eine leichtere Stufe, sonst eine andere der gleichen Stufe
export function easierLesson(topic: PackTopic, s: Saved, now: Lesson): PackLesson | null {
  const level = topic.lessons.find((l) => l.id === now.id)?.level ?? 3
  const passed = (id: string) => s.attempts.some((a) => a.lessonId === id && a.finishedAt)
  const others = topic.lessons.filter((l) => l.id !== now.id && l.level <= level)
  return [...others].sort((a, b) => a.level - b.level || Number(passed(a.id)) - Number(passed(b.id)))[0] ?? null
}
