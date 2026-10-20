import Anthropic from '@anthropic-ai/sdk'
import type { Check, Lesson, Step } from '../src/types.js'

// Erstellt einen Lernpfad mit Claude: aus Luisas Foto, aus einem Thema oder aus einer Übungsaufgabe.
// Der Wächter (findLeaks) prüft danach, dass kein Ergebnis in den Erklärungen steht.
// Diese Datei bleibt bewusst eigenständig, weil Vercel sie einzeln als Funktion baut.

export const SUBJECT_NAMES = ['Mathe', 'Deutsch', 'Englisch', 'NT', 'Biologie', 'GPG'] as const

export type LessonRequest =
  | { mode: 'photo'; image: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }
  | { mode: 'topic'; subject: string; topic: string }
  | { mode: 'task'; subject: string; topic: string; text: string }

// Antwort der KI, genau nach OUTPUT_SCHEMA
export interface AiCheck {
  kind: 'choice' | 'value' | 'fraction'
  question: string
  options: string[]
  answers: string[]
  ok_text: string
  hint: string
}
export interface AiStep {
  title: string
  why: string
  worte: string
  bild: string
  regel: string
  check: AiCheck
}
export interface AiLesson {
  readable: boolean
  problem: string
  subject: string
  topic: string
  source: string
  task: string
  final_result: string
  parent_solution: string
  glossary: { term: string; definition: string }[]
  steps: AiStep[]
  practice: { text: string; note: string }[]
}

const str = { type: 'string' }
const strList = { type: 'array', items: str }
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

export const OUTPUT_SCHEMA = obj({
  readable: { type: 'boolean' },
  problem: str,
  subject: { type: 'string', enum: [...SUBJECT_NAMES] },
  topic: str,
  source: str,
  task: str,
  final_result: str,
  parent_solution: str,
  glossary: { type: 'array', items: obj({ term: str, definition: str }) },
  steps: {
    type: 'array',
    items: obj({
      title: str,
      why: str,
      worte: str,
      bild: str,
      regel: str,
      check: obj({ kind: { type: 'string', enum: ['choice', 'value', 'fraction'] }, question: str, options: strList, answers: strList, ok_text: str, hint: str }),
    }),
  },
  practice: { type: 'array', items: obj({ text: str, note: str }) },
})

export const SYSTEM_PROMPT = `Du bist „Henni“, ein freundliches Lehrerhuhn in einer Lern-App. Du erklärst Luisa Schulaufgaben Schritt für Schritt. Luisa ist 12 Jahre alt, Autistin und geht in die 6. Klasse einer Mittelschule in Bayern (LehrplanPLUS). Sie braucht klare, logische Erklärungen, die sie nachvollziehen kann.

Die wichtigste Regel: Du verrätst nie ein Ergebnis.
- Weder das Endergebnis noch das Ergebnis eines Schritts steht in einer Erklärung (worte, bild, regel), im Feld why, in der Frage oder im Hinweis. Luisa findet jedes Ergebnis selbst.
- Zahlenreihen fängst du nur an („4, 8, …“) und hörst auf, bevor der gesuchte Wert kommt.
- Statt das Ergebnis zu nennen, zeigst du den Weg dorthin.

So baust du den Lernpfad:
- 3 bis 6 Schritte. Ein Schritt ist genau ein Gedanke. Der erste Schritt klärt, was gefragt ist.
- Jeder Schritt endet mit einer Prüffrage (check), deren Antwort Luisa selbst herausfindet. Der letzte Schritt fragt das Endergebnis ab, wenn es eins gibt. Hat die Aufgabe kein eindeutiges Ergebnis (zum Beispiel einen Text schreiben), prüft der letzte Schritt ein klares Merkmal.
- Jeder Schritt hat drei Fassungen derselben Erklärung. Jede Fassung ist für sich allein verständlich:
  worte: mit anderen, einfachen Worten.
  bild: mit einem konkreten Bild aus dem Alltag, das man sich vorstellen kann (Pizza, Lineal, Schrank mit Fächern …).
  regel: als feste Regel. Beginnt mit „**Regel:**“ und wendet die Regel danach auf diese Aufgabe an.
- why: ein bis zwei Sätze, warum dieser Schritt nötig ist.

Sprache:
- Deutsch, Du-Form, kurze Sätze. Wörtlich gemeint: keine Redewendungen, keine Ironie, keine Bilder ohne Erklärung.
- Kein Lob-Überschwang, keine Ausrufe wie „Super!“, keine Wörter wie „einfach“ oder „ganz leicht“.
- Ein Ding hat immer denselben Namen. Fachwörter markierst du mit [[Fachwort]] und erklärst jedes markierte Wort im glossary in einem Satz (term genau wie in den Klammern).
- Auszeichnung: **fett**, [[Fachwort]], {Zähler/Nenner} für Brüche, Leerzeile (\\n\\n) zwischen Absätzen, \\n für eine neue Zeile. Sonst kein Markdown, keine Listen mit Strichen, keine Emojis.

Prüffragen (check):
- kind "choice": 2 bis 4 options. answers enthält genau die richtige Option, Zeichen für Zeichen wie in options.
- kind "value": Luisa tippt eine kurze Antwort (eine Zahl oder ein bis drei Wörter, nie einen Satz). answers enthält alle richtigen Schreibweisen, zum Beispiel ["0,5", "0.5"] oder ["dass"]. options ist leer.
- kind "fraction": Luisa tippt Zähler und Nenner. answers enthält genau einen Bruch als "Zähler/Nenner", zum Beispiel ["11/12"]. options ist leer.
- hint: ein sachlicher Hinweis für eine falsche Eingabe, der zum Nachdenken führt, ohne die Lösung zu nennen. {x} steht für Luisas Eingabe.
- ok_text: eine sachliche Bestätigung, zum Beispiel „Das passt. Der Nenner ist jetzt bei beiden Brüchen gleich.“ Hier darf das Ergebnis stehen, weil Luisa es schon gefunden hat.
- Rechne jede Antwort sorgfältig nach. Eine falsche Antwort in answers verwirrt Luisa sehr.

Weitere Felder:
- task: die Aufgabe vollständig im Wortlaut, mit der Auszeichnung von oben.
- source: woher die Aufgabe kommt, zum Beispiel „Aufgabe 4 (S. 37)“, wenn das auf dem Foto steht.
- subject: eines der Fächer. topic: ein kurzer Themenname, zum Beispiel „Brüche addieren“.
- final_result: das Endergebnis in Kurzform. Das sieht nur die App, nie Luisa.
- parent_solution: der Lösungsweg in einer Zeile für die Eltern, zum Beispiel „1/4 + 2/3 = 3/12 + 8/12 = 11/12“.
- practice: genau 2 neue Aufgaben zum selben Thema mit derselben Schwierigkeit und anderen Zahlen oder Wörtern, ohne Lösung. note sagt in einem Satz, was gleich oder anders ist.
- readable ist true. problem ist leer.

Nur bei einem Foto: Wenn das Foto nicht lesbar ist oder keine Schulaufgabe zeigt, setze readable auf false und schreibe in problem einen ruhigen Satz an Luisa, was sie tun kann (zum Beispiel „Das Foto ist zu dunkel. Mache bitte ein neues Foto mit mehr Licht.“). Alle anderen Texte sind dann leer und die Listen leer. Sind mehrere Aufgaben auf dem Foto, nimm die erste vollständig sichtbare und nenne sie in source.`

export function userContent(req: LessonRequest): Anthropic.Beta.BetaContentBlockParam[] {
  switch (req.mode) {
    case 'photo':
      return [
        { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.image } },
        { type: 'text', text: 'Luisa hat diese Aufgabe aus der Schule fotografiert. Erstelle den Lernpfad dazu.' },
      ]
    case 'topic':
      return [
        {
          type: 'text',
          text: `Luisa möchte selbstständig üben. Fach: ${req.subject}. Thema: ${req.topic}.\n\nDenke dir eine neue Übungsaufgabe aus, die zur 6. Klasse Mittelschule in Bayern passt, und erstelle den Lernpfad dazu. Alles, was Luisa zum Lösen braucht, steht in der Aufgabe selbst. source ist „Übung“. topic ist „${req.topic}“.`,
        },
      ]
    case 'task':
      return [
        {
          type: 'text',
          text: `Luisa möchte diese Übungsaufgabe lösen. Fach: ${req.subject}. Thema: ${req.topic}.\n\nAufgabe: ${req.text}\n\nErstelle den Lernpfad dazu. source ist „Übung zu deinem Foto“. topic ist „${req.topic}“.`,
        },
      ]
  }
}

// --- Wächter: kein Ergebnis in den Texten, die Luisa vor ihrer Eingabe sieht ---

const plain = (s: string) =>
  s
    .replace(/\{\s*([^{}/]+?)\s*\/\s*([^{}/]+?)\s*\}/g, '$1/$2')
    .replace(/\*\*|\[\[|\]\]/g, '')
    .toLowerCase()

// Nur Ergebnisse mit Ziffern und mindestens zwei Zeichen sind eindeutig genug.
// Ein Wort wie „dass“ steht in einer Erklärung zu „das oder dass“ natürlich drin.
const guarded = (answer: string) => {
  const a = plain(answer).replace(/\s+/g, '')
  return /\d/.test(a) && a.length >= 2 ? a : null
}

const contains = (text: string, answer: string) => {
  const t = plain(text).replace(/(\d)\s+(?=[\d/,.])/g, '$1').replace(/\s*\/\s*/g, '/')
  const esc = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\d/,.])${esc}($|[^\\d/,.]|[.,](?!\\d))`).test(t)
}

export function findLeaks(ai: AiLesson): string[] {
  const leaks: string[] = []
  const finals = [ai.final_result, ...(ai.steps[ai.steps.length - 1]?.check.answers ?? [])].map(guarded).filter((a): a is string => !!a)
  ai.steps.forEach((s, i) => {
    const seen = [s.worte, s.bild, s.regel, s.why, s.check.question, s.check.hint]
    const own = s.check.kind === 'choice' ? [] : s.check.answers.map(guarded).filter((a): a is string => !!a)
    for (const answer of new Set([...finals, ...own])) {
      if (seen.some((t) => contains(t, answer))) leaks.push(`Schritt ${i + 1} verrät „${answer}“.`)
    }
  })
  return leaks
}

// --- Umwandeln in das Format der App ---

function toCheck(c: AiCheck): Check {
  const answers = c.answers.map((a) => a.trim()).filter(Boolean)
  if (c.kind === 'choice') {
    const answer = answers[0] ?? ''
    const options = c.options.includes(answer) ? c.options : [...c.options, answer]
    return { type: 'choice', question: c.question, options, answer, hint: c.hint }
  }
  if (c.kind === 'fraction') {
    const m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(answers[0] ?? '')
    if (m) {
      return {
        type: 'fraction',
        question: c.question,
        left: '',
        answer: [Number(m[1]), Number(m[2])],
        okText: c.ok_text,
        hints: [],
        wrongDenominator: c.hint,
        wrongNumerator: c.hint,
      }
    }
  }
  return { type: 'value', question: c.question, answers, okText: c.ok_text, hint: c.hint }
}

export function problems(ai: AiLesson): string[] {
  const out: string[] = []
  if (ai.steps.length < 2 || ai.steps.length > 8) out.push(`Es sind ${ai.steps.length} Schritte statt 3 bis 6.`)
  if (ai.practice.length < 2) out.push('Es fehlen die 2 Übungsaufgaben.')
  ai.steps.forEach((s, i) => {
    if (s.check.answers.every((a) => !a.trim())) out.push(`Schritt ${i + 1} hat keine Antwort in answers.`)
    if (s.check.kind === 'choice' && !s.check.options.includes(s.check.answers[0])) out.push(`Schritt ${i + 1}: Die Antwort steht nicht in options.`)
  })
  return [...out, ...findLeaks(ai)]
}

export function toLesson(ai: AiLesson, id: string): Lesson {
  const steps: Step[] = ai.steps.map((s) => ({
    title: s.title,
    why: s.why,
    versions: [
      { key: 'worte', text: s.worte },
      { key: 'bild', text: s.bild },
      { key: 'regel', text: s.regel },
    ],
    check: toCheck(s.check),
  }))
  return {
    id,
    subject: ai.subject,
    topic: ai.topic,
    source: ai.source || 'Aufgabe',
    task: ai.task,
    parentSolution: ai.parent_solution,
    steps,
    practice: ai.practice.slice(0, 2),
    glossary: Object.fromEntries(ai.glossary.map((g) => [g.term, g.definition])),
  }
}

// --- Aufruf der KI ---

const MODEL = 'claude-opus-5-5'

function send(client: Anthropic, messages: Anthropic.Beta.BetaMessageParam[], withFallback: boolean) {
  return client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages,
    })
    .finalMessage()
}

async function ask(client: Anthropic, messages: Anthropic.Beta.BetaMessageParam[]) {
  // Ersatzmodell bei Ablehnung; lehnt das Konto diese Einstellung ab, geht es ohne weiter
  const message = await send(client, messages, true).catch((e) => {
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) return send(client, messages, false)
    throw e
  })
  if (message.stop_reason === 'refusal') throw new Error('Die KI hat diese Aufgabe abgelehnt.')
  if (message.stop_reason === 'max_tokens') throw new Error('Der Lernpfad wurde zu lang.')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  return { message, ai: JSON.parse(text) as AiLesson }
}

export async function createLesson(client: Anthropic, req: LessonRequest): Promise<{ lesson: Lesson } | { problem: string }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: userContent(req) }]
  let { message, ai } = await ask(client, messages)
  if (!ai.readable) return { problem: ai.problem || 'Ich kann die Aufgabe auf dem Foto nicht lesen. Mache bitte ein neues Foto.' }
  let found = problems(ai)
  if (found.length) {
    // Ein zweiter Versuch mit genauer Rückmeldung, was nicht gepasst hat
    messages.push(
      { role: 'assistant', content: message.content },
      { role: 'user', content: `Der Lernpfad passt so noch nicht:\n${found.join('\n')}\n\nSchreibe den ganzen Lernpfad noch einmal und behebe genau diese Punkte.` },
    )
    ;({ message, ai } = await ask(client, messages))
    found = problems(ai)
    if (found.length) throw new Error(`Der Wächter hat den Lernpfad gestoppt: ${found.join(' ')}`)
  }
  return { lesson: toLesson(ai, crypto.randomUUID()) }
}

function parseRequest(body: unknown): LessonRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const s = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  if (b.mode === 'photo' && s(b.image, 7_000_000) && ['image/jpeg', 'image/png', 'image/webp'].includes(b.mediaType as string)) {
    return { mode: 'photo', image: b.image as string, mediaType: b.mediaType as 'image/jpeg' }
  }
  if (!s(b.subject, 40) || !s(b.topic, 80)) return null
  if (b.mode === 'topic') return { mode: 'topic', subject: b.subject as string, topic: b.topic as string }
  if (b.mode === 'task' && s(b.text, 2000)) return { mode: 'task', subject: b.subject as string, topic: b.topic as string, text: b.text as string }
  return null
}

const json = (data: unknown, status = 200) => Response.json(data, { status })

// Kurze technische Angabe für die Eltern, damit man den Grund ohne Server-Logs sieht
function detailOf(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    const body = e.error as { error?: { type?: string; message?: string } } | undefined
    return `Anthropic ${e.status ?? '?'}: ${body?.error?.message ?? e.message}`.slice(0, 300)
  }
  return e instanceof Error ? e.message.slice(0, 300) : String(e)
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'Die KI ist noch nicht eingerichtet. Ein Elternteil muss den Schlüssel bei Vercel eintragen.' }, 503)
  }
  const req = parseRequest(await request.json().catch(() => null))
  if (!req) return json({ error: 'Die Anfrage war unvollständig.' }, 400)
  try {
    return json(await createLesson(new Anthropic(), req))
  } catch (e) {
    console.error(e)
    const text = e instanceof Anthropic.APIError ? 'Die KI ist gerade nicht erreichbar.' : e instanceof Error ? e.message : 'Unbekannter Fehler.'
    return json({ error: `${text} Bitte versuche es gleich noch einmal.`, detail: detailOf(e) }, 502)
  }
}
