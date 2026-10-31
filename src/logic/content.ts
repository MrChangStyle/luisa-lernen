import { useEffect, useState } from 'react'
import type { ContentPackage, Lesson, PackLesson, PackTopic, Saved } from '../types'

// Inhaltspaket eines Schuljahrs: einmal laden, dauerhaft auf dem Gerät speichern (Cache Storage),
// danach ohne Internet und ohne Wartezeit nutzen. Neue Version auf dem Server wird beim nächsten Start geholt.

const CACHE = 'lerninhalte-v1'
const url = (id: string) => `/inhalte/${id}.json`

export type PackState = { state: 'kein' } | { state: 'laden' } | { state: 'fehlt' } | { state: 'ok'; pkg: ContentPackage }

const looksPackage = (p: unknown): p is ContentPackage => !!p && typeof p === 'object' && Array.isArray((p as ContentPackage).topics) && typeof (p as ContentPackage).id === 'string'

async function fromCache(id: string): Promise<ContentPackage | null> {
  try {
    const res = await (await caches.open(CACHE)).match(url(id))
    const pkg = res ? await res.json() : null
    return looksPackage(pkg) ? pkg : null
  } catch {
    return null
  }
}

async function fromServer(id: string): Promise<ContentPackage | null> {
  try {
    const res = await fetch(url(id), { cache: 'no-cache' })
    if (!res.ok) return null
    const copy = res.clone()
    const pkg = await res.json()
    if (!looksPackage(pkg)) return null
    try {
      await (await caches.open(CACHE)).put(url(id), copy)
      // Bittet den Browser, die Inhalte nicht bei Platzmangel zu löschen
      await navigator.storage?.persist?.()
    } catch {
      // ohne Cache geht es trotzdem, nur nicht offline
    }
    return pkg
  } catch {
    return null
  }
}

export function usePackage(id: string | null): PackState {
  const [s, setS] = useState<PackState>(id ? { state: 'laden' } : { state: 'kein' })
  useEffect(() => {
    if (!id) return
    let live = true
    void (async () => {
      const cached = await fromCache(id)
      if (cached && live) setS({ state: 'ok', pkg: cached })
      const fresh = await fromServer(id)
      if (!live) return
      if (fresh && fresh.version !== cached?.version) setS({ state: 'ok', pkg: fresh })
      else if (!cached && !fresh) setS({ state: 'fehlt' })
    })()
    return () => {
      live = false
    }
  }, [id])
  return s
}

// Nächste Aufgabe zu einem Thema: zuerst die noch nicht bestandenen, leichte vor schweren.
// Sind alle bestanden, kommt die am längsten nicht geübte wieder dran.
export function nextLesson(topic: PackTopic, saved: Saved): PackLesson | null {
  if (topic.lessons.length === 0) return null
  const passed = (id: string) => saved.attempts.some((a) => a.lessonId === id && a.finishedAt)
  const open = topic.lessons.filter((l) => !passed(l.id)).sort((a, b) => a.level - b.level)
  if (open.length) return open[0]
  const last = (id: string) => saved.attempts.filter((a) => a.lessonId === id).map((a) => a.startedAt).sort().reverse()[0] ?? ''
  return [...topic.lessons].sort((a, b) => last(a.id).localeCompare(last(b.id)))[0]
}

// Hilfe „Leichte Sprache“: Die Fassung in Leichter Sprache kommt als erste Erklärung
export const withEasyFirst = (l: Lesson): Lesson =>
  l.steps.some((st) => st.easy)
    ? { ...l, steps: l.steps.map((st) => (st.easy ? { ...st, versions: [{ key: 'leicht' as const, text: st.easy }, ...st.versions.filter((v) => v.key !== 'leicht')] } : st)) }
    : l
