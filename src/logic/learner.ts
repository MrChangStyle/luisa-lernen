// Kinder in der Familie und ihre Hilfen. Gespeichert werden nur Hilfen (Einstellungen), nie eine Diagnose:
// Die Profile sind Abkürzungen beim Anlegen, die mehrere Hilfen auf einmal einschalten.
// Diese Datei nutzen App und Server (api/lesson.ts, api/page.ts), deshalb ohne React.

export const HELP_KEYS = ['woertlich', 'zahlenBild', 'kleineSchritte', 'leichteSprache', 'vorlesen'] as const
export type HelpKey = (typeof HELP_KEYS)[number]

export const HELPS: Record<HelpKey, { label: string; parents: string; ai?: string }> = {
  woertlich: {
    label: 'Wörtliche Sprache',
    parents: 'Eindeutige Sätze ohne Redewendungen. Jeder Schritt sagt vorher, was jetzt passiert.',
    ai: 'Sprache streng wörtlich und eindeutig, keine Redewendungen, keine Ironie, keine Andeutungen. Das Feld why sagt am Anfang klar, was in diesem Schritt passiert.',
  },
  zahlenBild: {
    label: 'Zahlen mit Bild',
    parents: 'Zahlen und Mengen immer mit einem Bild (Zehnerfeld, Zahlenstrahl, Geld). Kleine Zahlen zuerst.',
    ai: 'Zahlen und Mengen immer anschaulich machen: In jeder Fassung (auch worte und regel) steht ein konkretes Mengenbild, zum Beispiel Zehnerfeld, Zahlenstrahl, Münzen oder Stellenwerttafel. Nenne Stellenwerte ausdrücklich (Einer, Zehner, Hunderter). Rechnungen in kleine Teilrechnungen zerlegen. Neue Übungsaufgaben (practice und Übungen zu einem Thema) mit kleinen, gut überschaubaren Zahlen.',
  },
  kleineSchritte: {
    label: 'Kleine Schritte',
    parents: 'Mehr, aber kürzere Schritte. Jeder Schritt enthält nur einen sehr kleinen Gedanken.',
    ai: 'Kleinere Schritte: 4 bis 7 Schritte statt 3 bis 6. Jeder Schritt höchstens drei kurze Sätze pro Fassung.',
  },
  leichteSprache: {
    label: 'Leichte Sprache',
    parents: 'Sehr kurze Sätze, keine Nebensätze, jedes Fachwort wird erklärt.',
    ai: 'Leichte Sprache: höchstens 10 Wörter pro Satz, keine Nebensätze, keine Fremdwörter. Jedes Fachwort mit [[…]] markieren und im glossary erklären.',
  },
  vorlesen: {
    label: 'Vorlesen',
    parents: 'Henni kann die Erklärung vorlesen (Knopf „Vorlesen“ in der Sprechblase).',
  },
}

export const PROFILES: { name: string; helps: HelpKey[] }[] = [
  { name: 'Autismus', helps: ['woertlich'] },
  { name: 'Dyskalkulie', helps: ['zahlenBild', 'kleineSchritte'] },
  { name: 'Allgemeine Lernschwierigkeiten', helps: ['kleineSchritte', 'leichteSprache', 'vorlesen'] },
]

export const SCHOOLS = ['Grundschule', 'Mittelschule', 'Realschule', 'Gymnasium', 'Förderschule'] as const

// Was der Server über ein Kind erfährt: Spitzname, Klasse, Schulart und Hilfen
export interface Learner {
  name: string
  grade: number
  school: string
  helps: HelpKey[]
}

export interface Child extends Learner {
  id: string
  // für das Zusammenführen zwischen Geräten: neuere Änderung gewinnt
  updatedAt: string
}

// Luisa ist das erste Kind. Ihr Lernstand bleibt unter der bisherigen Zeile „familie“ gespeichert.
export const LUISA: Child = { id: 'luisa', name: 'Luisa', grade: 6, school: 'Mittelschule', helps: ['woertlich'], updatedAt: '2026-10-31T00:00:00.000Z' }

export interface FamilyInfo {
  children: Child[]
  // Eltern-PIN für alle Kinder gemeinsam. null: noch keine (dann gilt die ältere PIN aus Luisas Stand).
  pin: string | null
}

export const EMPTY_FAMILY: FamilyInfo = { children: [LUISA], pin: null }

export const CHILD_ID = /^[a-z0-9-]{1,40}$/

// Luisas Name im Genitiv: „Luisas“, aber „Jonas’“
export const genitive = (name: string) => (/[sßxz]$/i.test(name) ? `${name}’` : `${name}s`)

const isHelp = (v: unknown): v is HelpKey => typeof v === 'string' && (HELP_KEYS as readonly string[]).includes(v)

export function parseLearner(v: unknown): Learner | null {
  if (!v || typeof v !== 'object') return null
  const b = v as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 30) : ''
  const grade = Number(b.grade)
  const school = typeof b.school === 'string' && (SCHOOLS as readonly string[]).includes(b.school) ? b.school : ''
  if (!name || !Number.isInteger(grade) || grade < 1 || grade > 13 || !school) return null
  const helps = Array.isArray(b.helps) ? [...new Set(b.helps.filter(isHelp))] : []
  return { name, grade, school, helps }
}

export function parseChild(v: unknown): Child | null {
  const l = parseLearner(v)
  const b = v as Record<string, unknown>
  if (!l || typeof b.id !== 'string' || !CHILD_ID.test(b.id) || typeof b.updatedAt !== 'string') return null
  return { ...l, id: b.id, updatedAt: b.updatedAt.slice(0, 40) }
}

export const learnerOf = (c: Learner): Learner => ({ name: c.name, grade: c.grade, school: c.school, helps: c.helps })

// Zwei Stände der Kinderliste zusammenführen: kein Kind geht verloren, pro Kind gewinnt die neuere Änderung
export function mergeFamily(a: FamilyInfo, b: FamilyInfo): FamilyInfo {
  const byId = new Map(a.children.map((c) => [c.id, c]))
  for (const c of b.children) {
    const old = byId.get(c.id)
    if (!old || c.updatedAt >= old.updatedAt) byId.set(c.id, c)
  }
  const order = [...a.children.map((c) => c.id), ...b.children.map((c) => c.id)]
  const children = [...new Set(order)].map((id) => byId.get(id)!)
  return { children, pin: b.pin ?? a.pin }
}

// Für den Server: wer lernt und welche Hilfen gelten. Ersetzt den früher fest eingebauten Text über Luisa.
export function learnerIntro(l: Learner): string {
  const rules = l.helps.flatMap((h) => (HELPS[h].ai ? [`- ${HELPS[h].ai}`] : []))
  return [
    `${l.name} geht in die ${l.grade}. Klasse einer ${l.school} in Bayern (LehrplanPLUS). ${l.name} braucht klare, logische Erklärungen, die sich Schritt für Schritt nachvollziehen lassen.`,
    rules.length ? `\nBesondere Hilfen für ${l.name}. Sie gelten vor allen anderen Regeln, außer der Regel, nie ein Ergebnis zu verraten:\n${rules.join('\n')}` : '',
  ].join('')
}
