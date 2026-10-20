import { describe, expect, it } from 'vitest'
import { findLeaks, problems, toLesson, type AiLesson, type AiStep } from '../api/lesson'
import { checkAnswer } from '../src/logic/check'

const step = (over: Partial<AiStep> = {}, check: Partial<AiStep['check']> = {}): AiStep => ({
  title: 'Schritt',
  why: 'Weil es nötig ist.',
  worte: 'Wir suchen eine Zahl in beiden Reihen.\n\n4er-Reihe: 4, 8, …',
  bild: 'Stell dir eine Pizza vor.',
  regel: '**Regel:** Gleiche Nenner zuerst.',
  check: { kind: 'value', question: 'Welche Zahl?', options: [], answers: ['12'], ok_text: 'Das passt. Es ist 12.', hint: '{x} passt nicht.', ...check },
  ...over,
})

const lesson = (steps: AiStep[]): AiLesson => ({
  readable: true,
  problem: '',
  subject: 'Mathe',
  topic: 'Brüche addieren',
  source: 'Übung',
  task: 'Rechne {1/4} + {2/3}.',
  final_result: '11/12',
  parent_solution: '1/4 + 2/3 = 3/12 + 8/12 = 11/12',
  glossary: [{ term: 'Nenner', definition: 'Die Zahl unter dem Bruchstrich.' }],
  steps,
  practice: [
    { text: 'Rechne {1/2} + {1/3}.', note: 'Gleiche Schritte.' },
    { text: 'Rechne {2/5} + {3/10}.', note: 'Ein Nenner passt schon.' },
  ],
})

const ok = lesson([
  step({}, { kind: 'choice', options: ['+', '−'], answers: ['+'] }),
  step(),
  step({}, { kind: 'fraction', answers: ['11/12'], ok_text: 'Das passt.' }),
])

describe('Wächter', () => {
  it('lässt einen sauberen Lernpfad durch', () => {
    expect(problems(ok)).toEqual([])
  })
  it('findet das Endergebnis in einer Erklärung, auch als Bruch-Auszeichnung', () => {
    const bad = lesson([step({ regel: 'Am Ende kommt { 11 / 12 } heraus.' }), step({}, { kind: 'fraction', answers: ['11/12'] })])
    expect(findLeaks(bad)).toContain('Schritt 1 verrät „11/12“.')
  })
  it('findet das Ergebnis eines Schritts in seiner eigenen Erklärung', () => {
    const bad = lesson([step({ worte: '4er-Reihe: 4, 8, 12, 16' }), step({}, { kind: 'fraction', answers: ['11/12'] })])
    expect(findLeaks(bad)).toEqual(['Schritt 1 verrät „12“.'])
  })
  it('verwechselt 12 nicht mit 120 oder 1,25', () => {
    const fine = lesson([step({ worte: 'Es sind 120 Stück, oder 1,25 Liter.' }), step({}, { kind: 'fraction', answers: ['11/12'] })])
    expect(findLeaks(fine)).toEqual([])
  })
  it('prüft Wörter nicht, weil sie in Erklärungen vorkommen dürfen', () => {
    const words = lesson([step({ worte: 'Bei „dass“ kann man nicht „dieses“ einsetzen.' }, { answers: ['dass'] })])
    expect(findLeaks({ ...words, final_result: 'dass' })).toEqual([])
  })
  it('meldet eine Auswahl-Antwort, die nicht unter den Optionen steht', () => {
    const bad = lesson([step({}, { kind: 'choice', options: ['Ja', 'Nein'], answers: ['Vielleicht'] }), step(), step()])
    expect(problems(bad)).toContain('Schritt 1: Die Antwort steht nicht in options.')
  })
})

describe('Umwandeln für die App', () => {
  const l = toLesson(ok, 'id-1')
  it('baut drei Fassungen und die Prüfarten', () => {
    expect(l.steps[0].versions.map((v) => v.key)).toEqual(['worte', 'bild', 'regel'])
    expect(l.steps[0].check).toMatchObject({ type: 'choice', answer: '+' })
    expect(l.steps[1].check).toMatchObject({ type: 'value', answers: ['12'] })
    expect(l.steps[2].check).toMatchObject({ type: 'fraction', answer: [11, 12] })
    expect(l.glossary).toEqual({ Nenner: 'Die Zahl unter dem Bruchstrich.' })
  })
  it('prüft Bruch-Eingaben', () => {
    expect(checkAnswer(l.steps[2].check, ['11', '12'])?.status).toBe('ok')
    expect(checkAnswer(l.steps[2].check, ['3', '7'])?.status).toBe('no')
  })
})

describe('Kurze Antworten prüfen', () => {
  const c = { type: 'value' as const, question: '?', answers: ['0,5', 'dass'], okText: 'Das passt.', hint: '„{x}“ passt nicht.' }
  it('akzeptiert Komma und Punkt bei Zahlen', () => {
    expect(checkAnswer(c, ['0.5'])?.status).toBe('ok')
    expect(checkAnswer(c, [' 0,50 '])?.status).toBe('ok')
  })
  it('ignoriert Groß/klein und Punkt am Ende', () => {
    expect(checkAnswer(c, ['Dass.'])?.status).toBe('ok')
  })
  it('zeigt den Hinweis mit der Eingabe', () => {
    expect(checkAnswer(c, ['das'])).toEqual({ status: 'no', text: '„das“ passt nicht.', given: 'das' })
  })
  it('wartet bei leerer Eingabe', () => {
    expect(checkAnswer(c, ['  '])).toBeNull()
  })
})
