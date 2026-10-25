import { useEffect, useRef, useState } from 'react'
import type { Lesson, Saved } from './types'
import { EMPTY_FARM } from './logic/farm'
import { mergeSaved } from './logic/merge'

// Alles, was gespeichert bleibt. Der Stand liegt in der Cloud (api/data.ts, Supabase EU), damit Luisa
// und beide Eltern auf jedem Gerät dasselbe sehen. Eine Kopie bleibt auf dem Gerät für Funklöcher.
export type { Attempt, Saved } from './types'

const KEY = 'luisa-lernen:v1'

const initial: Saved = { farm: EMPTY_FARM, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...initial, ...JSON.parse(raw) } : initial
  } catch {
    return initial
  }
}

// laden: erster Abgleich läuft · ok: alles in der Cloud · aus: Cloud nicht eingerichtet · fehler: keine Verbindung, wird nachgeholt
export type CloudState = 'laden' | 'ok' | 'aus' | 'fehler'

async function cloudCall(method: 'GET' | 'PUT', saved?: Saved): Promise<{ saved: Saved | null } | 'aus' | 'fehler'> {
  try {
    const res = await fetch('/api/data', {
      method,
      headers: { 'content-type': 'application/json' },
      body: saved ? JSON.stringify({ saved }) : undefined,
      cache: 'no-store',
    })
    if (res.status === 503) return 'aus'
    if (!res.ok) return 'fehler'
    return await res.json()
  } catch {
    return 'fehler'
  }
}

export function useSaved() {
  const [saved, setSaved] = useState<Saved>(load)
  const [cloud, setCloud] = useState<CloudState>('laden')
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const synced = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      // Speicher voll oder gesperrt: App läuft trotzdem weiter
    }
  }, [saved])

  // Stand aus der Cloud holen: beim Start und wenn die App wieder in den Vordergrund kommt
  useEffect(() => {
    const pull = async () => {
      const r = await cloudCall('GET')
      if (r === 'aus' || r === 'fehler') {
        setCloud(r)
      } else if (r.saved) {
        const fromCloud = r.saved
        setSaved((cur) => mergeSaved(cur, { ...initial, ...fromCloud }))
        setCloud('ok')
      }
      setReady(true)
    }
    void pull()
    const onShow = () => document.visibilityState === 'visible' && void pull()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])

  // Jede Änderung kurz danach in die Cloud schreiben. Der Server führt sie mit dem Stand anderer Geräte zusammen.
  useEffect(() => {
    if (!ready || cloud === 'aus') return
    const sent = JSON.stringify(saved)
    if (sent === synced.current) return
    const t = setTimeout(async () => {
      const r = await cloudCall('PUT', saved)
      if (r === 'aus' || r === 'fehler') {
        setCloud(r)
        if (r === 'fehler') setTimeout(() => setRetry((n) => n + 1), 20000)
        return
      }
      const fromCloud = r.saved ?? saved
      setSaved((cur) => {
        const next = mergeSaved(fromCloud, cur)
        // Nur als abgeglichen merken, wenn in der Zwischenzeit nichts Neues dazukam
        if (JSON.stringify(cur) === sent) synced.current = JSON.stringify(next)
        return next
      })
      setCloud('ok')
    }, 1200)
    return () => clearTimeout(t)
  }, [saved, ready, cloud, retry])

  return [saved, setSaved, cloud] as const
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
