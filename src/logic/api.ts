import type { Lesson, PageTask } from '../types'

// Anfrage an den Server (api/lesson.ts), der mit der KI den Lernpfad erstellt
export type LessonAsk =
  | { mode: 'photo'; image: string; mediaType: 'image/jpeg' }
  | { mode: 'topic'; subject: string; topic: string }
  | { mode: 'task'; subject: string; topic: string; text: string; source?: string }

export type LessonAnswer = { lesson: Lesson } | { problem: string } | { error: string; detail?: string }

export type PageAnswer = { page: { subject: string; title: string; tasks: PageTask[] } } | { problem: string } | { error: string; detail?: string }

export const requestLesson = (ask: LessonAsk, signal: AbortSignal) => post<LessonAnswer>('/api/lesson', ask, 'lesson', signal)

// Liest eine fotografierte Seite (api/page.ts) und liefert nur die Liste der Aufgaben darauf
export const requestPage = (image: string, signal: AbortSignal) => post<PageAnswer>('/api/page', { image, mediaType: 'image/jpeg' }, 'page', signal)

async function post<T>(url: string, body: unknown, key: string, signal: AbortSignal): Promise<T> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json().catch(() => null)
    if (data && (key in data || 'problem' in data || 'error' in data)) return data
    return { error: 'Der Server hat nicht geantwortet. Bitte versuche es gleich noch einmal.' } as T
  } catch (e) {
    if (signal.aborted) throw e
    return { error: 'Keine Verbindung zum Internet. Bitte prüfe das WLAN und versuche es noch einmal.' } as T
  }
}

// Handyfotos sind oft mehrere MB groß. Für die KI reichen 1600 Pixel an der langen Seite.
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}
