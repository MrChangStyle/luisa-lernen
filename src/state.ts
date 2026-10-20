import { useEffect, useState } from 'react'
import type { Farm, Lesson, LogEvent, StepStat } from './types'
import { EMPTY_FARM } from './logic/farm'

// Alles, was gespeichert bleibt. In dieser Testversion nur auf dem Gerät (localStorage);
// später in der Familien-Datenbank, damit beide Eltern es auf ihren Handys sehen.
export interface Attempt {
  id: string
  lessonId: string
  subject: string
  topic: string
  source: string
  startedAt: string
  finishedAt: string | null
  stats: StepStat[]
  // true, wenn die Aufgabe von Luisas Foto stammt
  photo?: boolean
  // gesetzt, wenn die Eltern die Aufgabe zurückgesetzt haben; sie bleibt im Archiv
  archivedAt?: string | null
}

export interface Saved {
  farm: Farm
  mood: Record<string, { value: number; at: string }>
  selection: string[]
  attempts: Attempt[]
  events: LogEvent[]
  parentPin: string | null
  // Lernpfade, die die KI erstellt hat. Werden nie gelöscht, auch nicht nach dem Zurücksetzen.
  lessons: Record<string, Lesson>
  // Übungen aus „Offene Übungen“, die Luisa schon fertig gemacht hat: "lessonId#nummer"
  donePractice: string[]
}

const KEY = 'luisa-lernen:v1'

const initial: Saved = { farm: EMPTY_FARM, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [] }

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...initial, ...JSON.parse(raw) } : initial
  } catch {
    return initial
  }
}

export function useSaved() {
  const [saved, setSaved] = useState<Saved>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      // Speicher voll oder gesperrt: App läuft trotzdem weiter
    }
  }, [saved])
  return [saved, setSaved] as const
}

export const withEvent = (s: Saved, text: string): Saved => ({
  ...s,
  events: [...s.events, { at: new Date().toISOString(), text }].slice(-300),
})

export const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
export const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

export const withLesson = (s: Saved, l: Lesson): Saved => ({ ...s, lessons: { ...s.lessons, [l.id]: l } })

// Familienbereich: Aufgaben zurücksetzen. Nichts wird gelöscht: Die Aufgabe kommt ins Archiv und
// verschwindet nur aus Luisas Listen (Aus meinen Fotos, Offene Übungen, geübt). Der Bauernhof bleibt immer.
export function archiveAttempts(s: Saved, ids: string[], at = new Date().toISOString()): Saved {
  const hit = s.attempts.filter((a) => ids.includes(a.id) && !a.archivedAt)
  if (hit.length === 0) return s
  const attempts = s.attempts.map((a) => (hit.includes(a) ? { ...a, archivedAt: at } : a))
  const text = hit.length === 1 ? `Familienbereich: „${hit[0].topic}“ zurückgesetzt und archiviert` : `Familienbereich: ${hit.length} Aufgaben zurückgesetzt und archiviert`
  return withEvent({ ...s, attempts }, text)
}

export function restoreAttempt(s: Saved, id: string): Saved {
  const a = s.attempts.find((x) => x.id === id)
  if (!a?.archivedAt) return s
  return withEvent({ ...s, attempts: s.attempts.map((x) => (x.id === id ? { ...x, archivedAt: null } : x)) }, `Familienbereich: „${a.topic}“ aus dem Archiv zurückgeholt`)
}

// Hat Luisa diese Aufgabe schon einmal bestanden? Archivierte Versuche zählen mit,
// denn ein Ei gibt es pro Aufgabe nur beim ersten Bestehen.
export const passedBefore = (s: Saved, lessonId: string, exceptAttemptId?: string | null) =>
  s.attempts.some((a) => a.lessonId === lessonId && a.finishedAt && a.id !== exceptAttemptId)

export interface LessonEntry {
  lesson: Lesson
  passed: boolean
  lastAt: string
}

// Alle Aufgaben der KI, die Luisa angefangen hat, neueste zuerst. Sie bleiben immer in dieser Liste.
export function lessonOverview(s: Saved): LessonEntry[] {
  const list: LessonEntry[] = []
  for (const lesson of Object.values(s.lessons)) {
    const tries = s.attempts.filter((a) => a.lessonId === lesson.id)
    if (tries.length === 0) continue
    const lastAt = tries.map((a) => a.finishedAt ?? a.startedAt).sort().reverse()[0]
    list.push({ lesson, passed: tries.some((a) => a.finishedAt), lastAt })
  }
  return list.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}
