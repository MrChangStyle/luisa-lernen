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
}

export interface Saved {
  farm: Farm
  mood: Record<string, { value: number; at: string }>
  selection: string[]
  attempts: Attempt[]
  events: LogEvent[]
  parentPin: string | null
  // Lernpfade, die die KI erstellt hat (die neuesten 40)
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

export const withLesson = (s: Saved, l: Lesson): Saved => {
  const ids = [...Object.keys(s.lessons).filter((id) => id !== l.id), l.id].slice(-40)
  return { ...s, lessons: Object.fromEntries(ids.map((id) => [id, id === l.id ? l : s.lessons[id]])) }
}

// Familienbereich: Aufgaben zurücksetzen. Die Aufgabe verschwindet aus der Liste, aus „Aus meinen Fotos“
// und mit ihr die offenen Übungen dazu. Der Bauernhof bleibt, damit Luisa nichts verliert.
export function resetAttempts(s: Saved, ids: string[]): Saved {
  const gone = s.attempts.filter((a) => ids.includes(a.id))
  if (gone.length === 0) return s
  const attempts = s.attempts.filter((a) => !ids.includes(a.id))
  const used = new Set(attempts.map((a) => a.lessonId))
  const lessons = Object.fromEntries(Object.entries(s.lessons).filter(([id]) => used.has(id)))
  const donePractice = s.donePractice.filter((k) => used.has(k.split('#')[0]))
  const text = gone.length === 1 ? `Familienbereich: Aufgabe „${gone[0].topic}“ zurückgesetzt` : `Familienbereich: ${gone.length} Aufgaben zurückgesetzt`
  return withEvent({ ...s, attempts, lessons, donePractice }, text)
}
