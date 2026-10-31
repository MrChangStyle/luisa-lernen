import { useEffect, useRef, useState } from 'react'
import type { Lesson, Saved } from './types'
import { EMPTY_FARM } from './logic/farm'
import { mergeSaved } from './logic/merge'
import { EMPTY_FAMILY, mergeFamily, type FamilyInfo } from './logic/learner'

// Alles, was gespeichert bleibt. Der Stand jedes Kindes liegt in der Cloud (api/data.ts, Supabase EU), damit das Kind
// und beide Eltern auf jedem Gerät dasselbe sehen. Eine Kopie bleibt auf dem Gerät für Funklöcher.
export type { Attempt, Saved } from './types'

// Luisa behält ihren bisherigen Speicherplatz, jedes weitere Kind bekommt einen eigenen
const keyFor = (child: string) => (child === 'luisa' ? 'luisa-lernen:v1' : `luisa-lernen:v1:${child}`)
const urlFor = (child: string) => (child === 'luisa' ? '/api/data' : `/api/data?kind=${encodeURIComponent(child)}`)

const initial: Saved = { farm: EMPTY_FARM, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }

// Ergänzt fehlende Felder (z. B. aus einem älteren Stand), damit die Anzeige nie an einem leeren Feld scheitert
const full = (s: Saved): Saved => ({ ...initial, ...s })

function load(key: string): Saved {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...initial, ...JSON.parse(raw) } : initial
  } catch {
    return initial
  }
}

// laden: erster Abgleich läuft · ok: alles in der Cloud · aus: Cloud nicht eingerichtet · fehler: keine Verbindung, wird nachgeholt
export type CloudState = 'laden' | 'ok' | 'aus' | 'fehler'

async function cloudCall<T>(url: string, method: 'GET' | 'PUT', body?: unknown): Promise<T | 'aus' | 'fehler'> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    if (res.status === 503) return 'aus'
    if (!res.ok) return 'fehler'
    return await res.json()
  } catch {
    return 'fehler'
  }
}

// Lernstand eines Kindes. Die App wird pro Kind neu aufgebaut (key), deshalb ändert sich child hier nie.
export function useSaved(child: string) {
  const KEY = keyFor(child)
  const url = urlFor(child)
  const [saved, setSaved] = useState<Saved>(() => load(KEY))
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
  }, [saved, KEY])

  // Stand aus der Cloud holen: beim Start und wenn die App wieder in den Vordergrund kommt
  useEffect(() => {
    const pull = async () => {
      const r = await cloudCall<{ saved: Saved | null }>(url, 'GET')
      if (r === 'aus' || r === 'fehler') {
        setCloud(r)
      } else if (r.saved) {
        const fromCloud = r.saved
        setSaved((cur) => full(mergeSaved(cur, { ...initial, ...fromCloud })))
        setCloud('ok')
      }
      setReady(true)
    }
    void pull()
    const onShow = () => document.visibilityState === 'visible' && void pull()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [url])

  // Jede Änderung kurz danach in die Cloud schreiben. Der Server führt sie mit dem Stand anderer Geräte zusammen.
  useEffect(() => {
    if (!ready || cloud === 'aus') return
    const sent = JSON.stringify(saved)
    if (sent === synced.current) return
    const t = setTimeout(async () => {
      const r = await cloudCall<{ saved: Saved | null }>(url, 'PUT', { saved })
      if (r === 'aus' || r === 'fehler') {
        setCloud(r)
        if (r === 'fehler') setTimeout(() => setRetry((n) => n + 1), 20000)
        return
      }
      const fromCloud = r.saved ?? saved
      setSaved((cur) => {
        const next = full(mergeSaved({ ...initial, ...fromCloud }, cur))
        // Nur als abgeglichen merken, wenn in der Zwischenzeit nichts Neues dazukam
        if (JSON.stringify(cur) === sent) synced.current = JSON.stringify(next)
        return next
      })
      setCloud('ok')
    }, 1200)
    return () => clearTimeout(t)
  }, [saved, ready, cloud, retry, url])

  return [saved, setSaved, cloud] as const
}

// Kinderliste und gemeinsame Eltern-PIN: auf dem Gerät und in der Cloud (Zeile „kinder“)
const FAMILY_KEY = 'luisa-lernen:kinder'

function loadFamily(): FamilyInfo {
  try {
    const raw = localStorage.getItem(FAMILY_KEY)
    return raw ? mergeFamily(EMPTY_FAMILY, JSON.parse(raw)) : EMPTY_FAMILY
  } catch {
    return EMPTY_FAMILY
  }
}

export function useFamily() {
  const [family, setFamily] = useState<FamilyInfo>(loadFamily)
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const synced = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(FAMILY_KEY, JSON.stringify(family))
    } catch {
      // egal, die Cloud hat die Liste auch
    }
  }, [family])

  useEffect(() => {
    const pull = async () => {
      const r = await cloudCall<{ family: FamilyInfo | null }>('/api/data?familie', 'GET')
      if (r !== 'aus' && r !== 'fehler' && r.family) {
        const fromCloud = r.family
        setFamily((cur) => {
          const next = mergeFamily(cur, fromCloud)
          if (JSON.stringify(next) === JSON.stringify(fromCloud)) synced.current = JSON.stringify(next)
          return next
        })
      }
      setReady(true)
    }
    void pull()
    const onShow = () => document.visibilityState === 'visible' && void pull()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])

  // Nur hochladen, wenn es etwas Eigenes gibt: Solange nur Luisa ohne PIN da ist, bleibt die Cloud unberührt
  useEffect(() => {
    if (!ready) return
    const sent = JSON.stringify(family)
    if (sent === synced.current || sent === JSON.stringify(EMPTY_FAMILY)) return
    const t = setTimeout(async () => {
      const r = await cloudCall<{ family: FamilyInfo | null }>('/api/data?familie', 'PUT', { family })
      if (r === 'aus') return
      if (r === 'fehler') return void setTimeout(() => setRetry((n) => n + 1), 20000)
      const fromCloud = r.family ?? family
      setFamily((cur) => {
        const next = mergeFamily(fromCloud, cur)
        if (JSON.stringify(cur) === sent) synced.current = JSON.stringify(next)
        return next
      })
    }, 800)
    return () => clearTimeout(t)
  }, [family, ready, retry])

  return [family, setFamily] as const
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
