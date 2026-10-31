// Erstellt ein Inhaltspaket (z. B. Mathe Klasse 3) einmalig mit der KI und speichert es in public/inhalte/<id>.json.
// Aufruf: ANTHROPIC_API_KEY=… npx tsx scripts/make-package.ts gs-3-mathe [Aufgaben pro Thema, Standard 6]
// Läuft auch als GitHub-Action „Inhaltspaket erstellen“. Ein abgebrochener Lauf macht beim nächsten Mal weiter.
//
// Jede Aufgabe geht durch drei Prüfungen: das Format (problems), den Wächter gegen verratene Ergebnisse
// (auch im Mengenbild) und ein zweites Nachrechnen durch die KI. Was nicht besteht, wird neu erstellt oder weggelassen.

import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { OUTPUT_SCHEMA, findLeaks, problems, systemPrompt, toLesson, type AiLesson, type AiStep } from '../api/lesson.js'
import { PLANS, type PackagePlan, type PlanTopic } from '../src/data/packages.js'
import type { ContentPackage, PackLesson, PackTopic, Visual } from '../src/types.js'

const MODEL = 'claude-opus-5-5'
const LEVELS: (1 | 2 | 3)[] = [1, 1, 2, 2, 3, 3, 1, 2, 3]
const LEVEL_TEXT = { 1: 'leicht (kleine Zahlen, ein Gedanke)', 2: 'mittel', 3: 'schwer (größere Zahlen oder zwei Schritte)' }

// --- Schema: der normale Lernpfad plus Leichte Sprache und Mengenbild je Schritt ---

type AiVisual = { kind: 'keins' | 'zehnerfeld' | 'zahlenstrahl' | 'stellenwert'; zahl: number; von: number; bis: number; schritt: number; markiert: number[]; zahlen: number[] }
type PackAiStep = AiStep & { leicht: string; visual: AiVisual }
type PackAi = Omit<AiLesson, 'steps'> & { steps: PackAiStep[] }

const int = { type: 'integer' }
const ints = { type: 'array', items: int }
const VISUAL_SCHEMA = {
  type: 'object',
  properties: { kind: { type: 'string', enum: ['keins', 'zehnerfeld', 'zahlenstrahl', 'stellenwert'] }, zahl: int, von: int, bis: int, schritt: int, markiert: ints, zahlen: ints },
  required: ['kind', 'zahl', 'von', 'bis', 'schritt', 'markiert', 'zahlen'],
  additionalProperties: false,
}

function packSchema(): { [key: string]: unknown } {
  const s = structuredClone(OUTPUT_SCHEMA) as unknown as { properties: { steps: { items: { properties: Record<string, unknown>; required: string[] } } } }
  const step = s.properties.steps.items
  step.properties.leicht = { type: 'string' }
  step.properties.visual = VISUAL_SCHEMA
  step.required.push('leicht', 'visual')
  return s
}

const EXTRA = `

Zusätzlich für ein Inhaltspaket, das viele Kinder nutzen:
- Die Aufgaben sind für viele Kinder. Nenne in keinem Text einen Namen für das Kind, sprich es nur mit „du“ an. Personen in Sachaufgaben dürfen Namen haben.
- Erfinde die Aufgabe selbst. Schreibe keine Aufgabe aus einem Schulbuch ab.
- leicht: dieselbe Erklärung wie worte, aber in Leichter Sprache: höchstens 10 Wörter pro Satz, keine Nebensätze, ein Gedanke pro Satz. Auch hier steht kein Ergebnis.
- visual: ein Mengenbild, das die App zeichnet, für Kinder, die Zahlen schwer erfassen. Es zeigt nur Zahlen, die in der Aufgabe oder in diesem Schritt schon bekannt sind, nie das gesuchte Ergebnis.
  zehnerfeld: zahl (1 bis 100) wird als Punkte in Zehnerfeldern gezeigt. Gut für kleine Mengen und Zehnerbündel.
  zahlenstrahl: von, bis, schritt für die Striche, markiert sind bekannte Zahlen. Gut für Vergleichen, Runden, Ergänzen, Zeitspannen.
  stellenwert: zahlen werden in einer Stellenwerttafel (H, Z, E) gezeigt. Gut für Zahlen bis 1000 und schriftliches Rechnen.
  keins: wenn kein Mengenbild passt (z. B. Geometrie). Nicht benutzte Felder sind 0 oder leer.`

// --- KI-Aufrufe ---

async function call<T>(client: Anthropic, system: string, user: string, schema: { [key: string]: unknown }, effort: 'low' | 'medium', maxTokens: number) {
  const message = await client.beta.messages
    .stream({ model: MODEL, max_tokens: maxTokens, output_config: { effort, format: { type: 'json_schema', schema } }, system, messages: [{ role: 'user', content: user }] })
    .finalMessage()
  if (message.stop_reason !== 'end_turn') throw new Error(`KI stoppte mit ${message.stop_reason}`)
  usage.input += message.usage.input_tokens
  usage.output += message.usage.output_tokens
  return JSON.parse(message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as T
}

const usage = { input: 0, output: 0 }

const CHECK_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' }, fehler: { type: 'string' } }, required: ['ok', 'fehler'], additionalProperties: false }

// Zweite Meinung: Stimmen alle hinterlegten Antworten? Ein Fehler hier würde ein Kind sehr verwirren.
async function verify(client: Anthropic, ai: PackAi): Promise<string | null> {
  const steps = ai.steps.map((s, i) => `Schritt ${i + 1}: ${s.check.question} | Optionen: ${s.check.options.join(' / ') || '–'} | hinterlegt: ${s.check.answers.join(' oder ')}`).join('\n')
  const r = await call<{ ok: boolean; fehler: string }>(
    client,
    'Du prüfst Mathe-Aufgaben einer Grundschul-App. Rechne jede Aufgabe selbst nach. ok ist nur true, wenn jede hinterlegte Antwort eindeutig richtig ist und die Aufgabe zur Frage passt. fehler nennt sonst kurz, was falsch ist.',
    `Aufgabe: ${ai.task}\nEndergebnis laut Ersteller: ${ai.final_result}\n\n${steps}`,
    CHECK_SCHEMA,
    'low',
    4000,
  )
  return r.ok ? null : r.fehler || 'Nachrechnen fehlgeschlagen'
}

// --- Wächter für das Mengenbild ---

const numbersOf = (v: AiVisual) =>
  v.kind === 'zehnerfeld' ? [v.zahl] : v.kind === 'zahlenstrahl' ? v.markiert : v.kind === 'stellenwert' ? v.zahlen : []

export function visualLeaks(ai: PackAi): string[] {
  const num = (a: string) => (/^\s*-?\d+\s*$/.test(a) ? Number(a) : null)
  const finals = [ai.final_result, ...(ai.steps.at(-1)?.check.answers ?? [])].map(num).filter((n): n is number => n !== null)
  return ai.steps.flatMap((s, i) => {
    const own = s.check.answers.map(num).filter((n): n is number => n !== null)
    const shown = numbersOf(s.visual)
    return [...new Set([...finals, ...own])].filter((n) => shown.includes(n)).map((n) => `Schritt ${i + 1}: Das Mengenbild zeigt das Ergebnis ${n}.`)
  })
}

function toVisual(v: AiVisual): Visual | undefined {
  if (v.kind === 'zehnerfeld' && v.zahl >= 1 && v.zahl <= 100) return { kind: 'zehnerfeld', zahl: v.zahl }
  if (v.kind === 'zahlenstrahl' && v.bis > v.von && v.schritt > 0 && (v.bis - v.von) / v.schritt <= 20) return { kind: 'zahlenstrahl', von: v.von, bis: v.bis, schritt: v.schritt, markiert: v.markiert.slice(0, 4) }
  if (v.kind === 'stellenwert' && v.zahlen.length > 0) return { kind: 'stellenwert', zahlen: v.zahlen.filter((n) => n >= 0 && n < 10000).slice(0, 3) }
  return undefined
}

// --- Eine Aufgabe ---

export async function makeLesson(client: Anthropic, plan: PackagePlan, topic: PlanTopic, level: 1 | 2 | 3, known: string[], index: number): Promise<PackLesson | null> {
  const system = systemPrompt({ name: 'Kim', grade: plan.grade, school: plan.school, helps: [] }) + EXTRA
  let user = `Erstelle eine neue Übungsaufgabe für ${plan.title} (${plan.school}, Bayern, LehrplanPLUS).
Fach: ${plan.subject}. Thema: ${topic.name} (Lernbereich ${topic.area}). Schwerpunkt: ${topic.focus}
Schwierigkeit: ${LEVEL_TEXT[level]}.
Alles, was man zum Lösen braucht, steht in der Aufgabe selbst. source ist „Übung“. topic ist „${topic.name}“. subject ist „${plan.subject}“.`
  if (known.length) user += `\n\nDiese Aufgaben gibt es zu dem Thema schon. Mache eine andere, mit anderen Zahlen und einer anderen Situation:\n${known.map((k) => `- ${k}`).join('\n')}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ai = await call<PackAi>(client, system, user, packSchema(), 'medium', 32000)
      const easyLeaks = findLeaks({ ...(ai as unknown as AiLesson), steps: ai.steps.map((st) => ({ ...st, worte: st.leicht })) })
      const found = [...problems(ai as unknown as AiLesson), ...visualLeaks(ai), ...easyLeaks.map((l) => `Leichte Sprache: ${l}`)]
      if (/\bKim\b/.test(JSON.stringify(ai))) found.push('Der Name Kim steht im Text.')
      const wrong = found.length ? null : await verify(client, ai)
      if (wrong) found.push(`Nachrechnen: ${wrong}`)
      if (found.length) {
        console.log(`  ↻ ${topic.name} #${index} Versuch ${attempt}: ${found.join(' ')}`)
        continue
      }
      const lesson = toLesson(ai as unknown as AiLesson, `${plan.id}-${slug(topic.name)}-${index}`)
      lesson.steps.forEach((st, i) => {
        st.easy = ai.steps[i].leicht
        st.visual = toVisual(ai.steps[i].visual)
      })
      return { ...lesson, level }
    } catch (e) {
      console.log(`  ✗ ${topic.name} #${index} Versuch ${attempt}: ${e instanceof Error ? e.message : e}`)
    }
  }
  return null
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// --- Ablauf ---

async function main() {
  const id = process.argv[2]
  const perTopic = Math.min(9, Math.max(1, Number(process.argv[3] ?? 6)))
  const plan = PLANS[id]
  if (!plan) throw new Error(`Unbekanntes Paket „${id}“. Vorhanden: ${Object.keys(PLANS).join(', ')}`)
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY fehlt.')
  const client = new Anthropic()
  mkdirSync('public/inhalte', { recursive: true })
  const file = `public/inhalte/${id}.json`
  const old: ContentPackage | null = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  const topics: PackTopic[] = plan.topics.map((t) => ({ name: t.name, area: t.area, lessons: old?.topics.find((o) => o.name === t.name)?.lessons ?? [] }))
  const save = () => {
    const pkg: ContentPackage = { id, version: new Date().toISOString().slice(0, 10), title: plan.title, grade: plan.grade, school: plan.school, subject: plan.subject, createdAt: new Date().toISOString(), topics: topics.filter((t) => t.lessons.length > 0) }
    writeFileSync(file, JSON.stringify(pkg))
  }

  // Vier Themen gleichzeitig, innerhalb eines Themas nacheinander (damit sich Aufgaben nicht doppeln)
  const queue = plan.topics.map((t, i) => ({ t, out: topics[i] }))
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { t, out } = job
      while (out.lessons.length < perTopic) {
        const n = out.lessons.length
        const lesson = await makeLesson(client, plan, t, LEVELS[n], out.lessons.map((l) => l.task.slice(0, 160)), n + 1)
        if (!lesson) break
        out.lessons.push(lesson)
        save()
        console.log(`✓ ${t.name} ${out.lessons.length}/${perTopic}`)
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  save()
  const total = topics.reduce((n, t) => n + t.lessons.length, 0)
  const size = readFileSync(file).length
  console.log(`\nFertig: ${total} Aufgaben in ${topics.filter((t) => t.lessons.length).length} Themen, ${(size / 1024).toFixed(0)} KB.`)
  console.log(`Tokens: ${usage.input} Eingabe, ${usage.output} Ausgabe.`)
  const missing = topics.filter((t) => t.lessons.length < perTopic).map((t) => `${t.name} (${t.lessons.length})`)
  if (missing.length) console.log(`Unvollständig, beim nächsten Lauf geht es weiter: ${missing.join(', ')}`)
}

if (process.argv[1]?.endsWith('make-package.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
