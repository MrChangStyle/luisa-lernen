import { describe, expect, it } from 'vitest'
import { makeLesson, visualLeaks } from '../scripts/make-package'
import { PLANS, packageIdFor } from '../src/data/packages'
import { nextLesson, withEasyFirst } from '../src/logic/content'
import type { PackLesson, Saved } from '../src/types'
import { PACK_AI } from './fixtures/pack-ai'

// Ersatz für den Anthropic-Client: liefert der Reihe nach die vorbereiteten Antworten
function fakeClient(answers: unknown[]) {
  const calls: { system: string; user: string }[] = []
  const client = {
    beta: {
      messages: {
        stream: (req: { system: string; messages: { content: string }[] }) => {
          calls.push({ system: req.system, user: req.messages[0].content })
          const next = answers.shift()
          return { finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify(next) }] }) }
        },
      },
    },
  }
  return { client: client as never, calls }
}

const plan = PLANS['gs-3-mathe']
const topic = plan.topics.find((t) => t.name === 'Schriftliche Addition')!

describe('Inhaltspaket-Generator', () => {
  it('erstellt eine geprüfte Aufgabe mit Leichter Sprache und Mengenbild', async () => {
    const { client, calls } = fakeClient([PACK_AI, { ok: true, fehler: '' }])
    const l = await makeLesson(client, plan, topic, 2, ['Alte Aufgabe'], 3)
    expect(l?.id).toBe('gs-3-mathe-schriftliche-addition-3')
    expect(l?.level).toBe(2)
    expect(l?.steps[0].easy).toContain('zwei Tage')
    expect(l?.steps[0].visual).toEqual({ kind: 'stellenwert', zahlen: [345, 230] })
    expect(calls[0].system).toContain('3. Klasse einer Grundschule')
    expect(calls[0].user).toContain('Alte Aufgabe')
    expect(calls).toHaveLength(2)
  })
  it('verwirft eine Aufgabe, deren Mengenbild das Ergebnis zeigt, und versucht es neu', async () => {
    const leaky = structuredClone(PACK_AI)
    leaky.steps[2].visual.markiert = [575]
    expect(visualLeaks(leaky as never)).toHaveLength(1)
    const { client, calls } = fakeClient([leaky, PACK_AI, { ok: true, fehler: '' }])
    expect(await makeLesson(client, plan, topic, 1, [], 1)).not.toBeNull()
    expect(calls).toHaveLength(3)
  })
  it('verwirft eine Aufgabe, die beim Nachrechnen durchfällt', async () => {
    const { client } = fakeClient([PACK_AI, { ok: false, fehler: 'falsch' }, PACK_AI, { ok: false, fehler: 'falsch' }, PACK_AI, { ok: false, fehler: 'falsch' }])
    expect(await makeLesson(client, plan, topic, 1, [], 1)).toBeNull()
  })
})

describe('Inhaltspaket in der App', () => {
  const lesson = (id: string, level: 1 | 2 | 3): PackLesson => ({ id, level, subject: 'Mathe', topic: 'T', source: 'Übung', task: '', parentSolution: '', steps: [], practice: [] })
  const saved = (done: string[]): Saved =>
    ({ attempts: done.map((id, i) => ({ id: `a${i}`, lessonId: id, startedAt: `2026-10-0${i + 1}`, finishedAt: 'x' })) }) as unknown as Saved
  it('nimmt zuerst offene Aufgaben, leichte vor schweren', () => {
    const t = { name: 'T', area: 'A', lessons: [lesson('b', 2), lesson('a', 1), lesson('c', 1)] }
    expect(nextLesson(t, saved([]))?.id).toBe('a')
    expect(nextLesson(t, saved(['a']))?.id).toBe('c')
    expect(nextLesson(t, saved(['a', 'c', 'b']))?.id).toBe('a')
  })
  it('findet das Paket nur für passende Klassen', () => {
    expect(packageIdFor('Grundschule', 3)).toBe('gs-3-mathe')
    expect(packageIdFor('Grundschule', 4)).toBeNull()
    expect(packageIdFor('Mittelschule', 6)).toBeNull()
  })
  it('stellt die Leichte Sprache an den Anfang', () => {
    const l = { ...lesson('x', 1), steps: [{ title: 't', why: '', easy: 'Kurz.', versions: [{ key: 'worte' as const, text: 'Lang.' }], check: { type: 'choice' as const, question: '', options: [], answer: '', hint: '' } }] }
    expect(withEasyFirst(l).steps[0].versions.map((v) => v.key)).toEqual(['leicht', 'worte'])
  })
})
