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
