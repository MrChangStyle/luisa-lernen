// Ein Lernpfad ist genau das Datenpaket aus dem Konzept: Schritte mit je drei Fassungen.
// Der Server (api/lesson.ts) erstellt ihn mit der KI aus Luisas Foto oder einem Thema.

export type VersionKey = 'worte' | 'bild' | 'regel'

export const VERSION_LABEL: Record<VersionKey, string> = {
  worte: 'Mit anderen Worten',
  bild: 'Mit einem Bild',
  regel: 'Als feste Regel',
}

export type Graphic = { kind: 'pizza'; parts: { slices: number; filled: number; caption: string }[] }

export interface Version {
  key: VersionKey
  // Einfache Auszeichnung: Absätze mit Leerzeile, **fett**, [[Fachwort]], {1/4} für Brüche
  text: string
  graphic?: Graphic
}

export type Check =
  | { type: 'choice'; question: string; options: string[]; answer: string; hint: string }
  | { type: 'value'; question: string; answers: string[]; okText: string; hint: string }
  | { type: 'number'; question: string; answer: number; okText: string; largerMultipleHint: string; hint: string }
  | {
      type: 'numerators'
      question: string
      fractions: [number, number][]
      denominator: number
      answers: number[]
      okText: string
      hints: string[]
    }
  | {
      type: 'fraction'
      question: string
      left: string
      answer: [number, number]
      okText: string
      hints: { numerator?: number; denominator?: number; text: string }[]
      wrongDenominator: string
      wrongNumerator: string
    }

export interface Step {
  title: string
  versions: Version[]
  why: string
  check: Check
}

export interface Lesson {
  id: string
  subject: string
  topic: string
  source: string
  task: string
  // Nur im Familienbereich sichtbar
  parentSolution: string
  steps: Step[]
  practice: { text: string; note: string }[]
  // Fachwörter, die in diesem Lernpfad mit [[…]] markiert sind
  glossary?: Record<string, string>
}

export interface Topic {
  name: string
  status: 'neu' | 'geübt' | 'aus deinem Foto'
}

export type Farm = { egg: number; chick: number; hen: number; rooster: number; cow: number }

export interface LogEvent {
  at: string // ISO-Zeitpunkt
  text: string
}

export interface StepStat {
  again: number
  wrong: string[]
  helped: VersionKey | null
}

// Alles, was gespeichert bleibt (Cloud und Kopie auf dem Gerät). Logik dazu in state.ts und logic/merge.ts.
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

// Eine fotografierte Buch- oder Arbeitsblattseite. Die KI liest sie einmal; danach wählt Luisa daraus Aufgabe für Aufgabe.
export interface PageTask {
  label: string
  topic: string
  text: string
  // gesetzt, sobald die KI den Lernpfad zu dieser Aufgabe erstellt hat
  lessonId?: string
}

export interface Page {
  id: string
  at: string
  subject: string
  title: string
  tasks: PageTask[]
}

export interface Saved {
  farm: Farm
  // egg: Luisa hat die Stimmung an diesem Tag selbst bestätigt und dafür ein Ei bekommen
  mood: Record<string, { value: number; at: string; egg?: boolean }>
  selection: string[]
  attempts: Attempt[]
  events: LogEvent[]
  parentPin: string | null
  // Lernpfade, die die KI erstellt hat. Werden nie gelöscht, auch nicht nach dem Zurücksetzen.
  lessons: Record<string, Lesson>
  // Übungen aus „Offene Übungen“, die Luisa schon fertig gemacht hat: "lessonId#nummer"
  donePractice: string[]
  // Gescannte Seiten, damit eine Aufgabe von dort nicht noch einmal gelesen werden muss
  pages: Record<string, Page>
  // Kennung des Neustarts (ISO-Zeit). Nach einem Zurücksetzen der Familie gewinnt der neuere Neustart ganz,
  // damit Geräte mit altem Stand die gelöschten Daten nicht wieder hochladen.
  start?: string
}
