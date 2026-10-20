import { describe, expect, it } from 'vitest'
import { addEgg, EMPTY_FARM } from './farm'
import { checkAnswer } from './check'
import { SAMPLE_LESSON } from '../data/sampleLesson'
import { resetAttempts, type Saved } from '../state'

describe('Bauernhof', () => {
  it('gibt ein Ei', () => {
    expect(addEgg(EMPTY_FARM).farm.egg).toBe(1)
  })
  it('macht aus 10 Eiern ein Küken und rechnet bis zur Kuh weiter', () => {
    const r = addEgg({ egg: 9, chick: 9, hen: 9, rooster: 9, cow: 0 })
    expect(r.farm).toEqual({ egg: 0, chick: 0, hen: 0, rooster: 0, cow: 1 })
    expect(r.messages).toHaveLength(4)
    expect(r.messages[0]).toBe('10 Eier sind jetzt 1 Küken.')
  })
})

describe('Prüfen ohne Lösung zu verraten', () => {
  const [s1, , s3, s4, s5] = SAMPLE_LESSON.steps
  it('Rechenart', () => {
    expect(checkAnswer(s1.check, ['+'])?.status).toBe('ok')
    expect(checkAnswer(s1.check, ['−'])?.text).toContain('zusammen')
  })
  it('gemeinsamer Nenner, auch größere Vielfache', () => {
    expect(checkAnswer(s3.check, ['12'])?.status).toBe('ok')
    expect(checkAnswer(s3.check, ['24'])?.status).toBe('almost')
    expect(checkAnswer(s3.check, ['7'])?.status).toBe('no')
    expect(checkAnswer(s3.check, [''])).toBeNull()
  })
  it('Zähler erweitern', () => {
    expect(checkAnswer(s4.check, ['3', '8'])?.status).toBe('ok')
    expect(checkAnswer(s4.check, ['3', '6'])?.text).toContain('zweite')
  })
  it('Ergebnis mit typischen Fehlern', () => {
    expect(checkAnswer(s5.check, ['11', '12'])?.status).toBe('ok')
    expect(checkAnswer(s5.check, ['11', '24'])?.text).toContain('Nenner addiert')
    expect(checkAnswer(s5.check, ['3', '7'])?.text).toContain('Schritt 2')
  })
  it('kein Hinweistext enthält das Endergebnis', () => {
    const texts = SAMPLE_LESSON.steps.flatMap((s) => [s.why, ...s.versions.map((v) => v.text), JSON.stringify({ ...s.check, answer: undefined, answers: undefined })])
    for (const t of texts) expect(t).not.toMatch(/11\s*\/\s*12|\{11\/12\}/)
  })
})

import { move } from './selection'
describe('Meine Auswahl', () => {
  it('verschiebt ein Thema nach oben und unten', () => {
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })
  it('bleibt am Rand unverändert', () => {
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('Aufgaben zurücksetzen', () => {
  const attempt = (id: string, lessonId: string) => ({ id, lessonId, subject: 'Mathe', topic: `Thema ${id}`, source: 'Übung', startedAt: '2026-10-20T10:00:00Z', finishedAt: '2026-10-20T10:05:00Z', stats: [] })
  const base: Saved = {
    farm: { egg: 3, chick: 1, hen: 0, rooster: 0, cow: 0 },
    mood: {},
    selection: [],
    attempts: [attempt('a1', 'L1'), attempt('a2', 'L2')],
    events: [],
    parentPin: null,
    lessons: { L1: SAMPLE_LESSON, L2: SAMPLE_LESSON },
    donePractice: ['L1#x', 'L2#y'],
  }
  it('entfernt eine Aufgabe mit Lernpfad und Übungen, der Bauernhof bleibt', () => {
    const s = resetAttempts(base, ['a1'])
    expect(s.attempts.map((a) => a.id)).toEqual(['a2'])
    expect(Object.keys(s.lessons)).toEqual(['L2'])
    expect(s.donePractice).toEqual(['L2#y'])
    expect(s.farm).toEqual(base.farm)
    expect(s.events[s.events.length - 1]?.text).toBe('Familienbereich: Aufgabe „Thema a1“ zurückgesetzt')
  })
  it('setzt alle Aufgaben zurück', () => {
    const s = resetAttempts(base, ['a1', 'a2'])
    expect(s.attempts).toEqual([])
    expect(s.lessons).toEqual({})
    expect(s.events[s.events.length - 1]?.text).toBe('Familienbereich: 2 Aufgaben zurückgesetzt')
  })
})
