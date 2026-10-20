import type { Lesson } from '../types'

// Anfrage an den Server (api/lesson.ts), der mit der KI den Lernpfad erstellt
export type LessonAsk =
  | { mode: 'photo'; image: string; mediaType: 'image/jpeg' }
  | { mode: 'topic'; subject: string; topic: string }
  | { mode: 'task'; subject: string; topic: string; text: string }

export type LessonAnswer = { lesson: Lesson } | { problem: string } | { error: string }

export async function requestLesson(ask: LessonAsk, signal: AbortSignal): Promise<LessonAnswer> {
  try {
    const res = await fetch('/api/lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ask),
      signal,
    })
    const data = await res.json().catch(() => null)
    if (data && ('lesson' in data || 'problem' in data || 'error' in data)) return data
    return { error: 'Der Server hat nicht geantwortet. Bitte versuche es gleich noch einmal.' }
  } catch (e) {
    if (signal.aborted) throw e
    return { error: 'Keine Verbindung zum Internet. Bitte prüfe das WLAN und versuche es noch einmal.' }
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
