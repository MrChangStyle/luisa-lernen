import { describe, expect, it } from 'vitest'
import { addEgg, EMPTY_FARM } from './farm'
import { checkAnswer } from './check'
import { SAMPLE_LESSON } from '../data/sampleLesson'
import { archiveAttempts, lessonOverview, passedBefore, restoreAttempt, type Saved } from '../state'

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
    donePractice: ['L1#x'],
  }
  const last = (s: Saved) => s.events[s.events.length - 1]?.text
  it('legt eine Aufgabe ins Archiv und löscht nichts', () => {
    const s = archiveAttempts(base, ['a1'], '2026-10-21T08:00:00Z')
    expect(s.attempts).toHaveLength(2)
    expect(s.attempts[0].archivedAt).toBe('2026-10-21T08:00:00Z')
    expect(s.attempts[1].archivedAt).toBeUndefined()
    expect(s.lessons).toEqual(base.lessons)
    expect(s.donePractice).toEqual(base.donePractice)
    expect(s.farm).toEqual(base.farm)
    expect(last(s)).toBe('Familienbereich: „Thema a1“ zurückgesetzt und archiviert')
  })
  it('setzt alle zurück und holt eine wieder zurück', () => {
    const all = archiveAttempts(base, ['a1', 'a2'])
    expect(all.attempts.every((a) => a.archivedAt)).toBe(true)
    expect(last(all)).toBe('Familienbereich: 2 Aufgaben zurückgesetzt und archiviert')
    const back = restoreAttempt(all, 'a2')
    expect(back.attempts[1].archivedAt).toBeNull()
    expect(last(back)).toBe('Familienbereich: „Thema a2“ aus dem Archiv zurückgeholt')
  })
})

describe('Meine Aufgaben und Ei nur beim ersten Bestehen', () => {
  const L = (id: string) => ({ ...SAMPLE_LESSON, id })
  const s: Saved = {
    farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 },
    mood: {},
    selection: [],
    attempts: [
      { id: 'a1', lessonId: 'L1', subject: 'Mathe', topic: 'T1', source: 'Foto', startedAt: '2026-10-20T10:00:00Z', finishedAt: '2026-10-20T10:05:00Z', stats: [], archivedAt: '2026-10-20T11:00:00Z' },
      { id: 'a2', lessonId: 'L2', subject: 'Mathe', topic: 'T2', source: 'Übung', startedAt: '2026-10-20T12:00:00Z', finishedAt: null, stats: [] },
      { id: 'a3', lessonId: 'L1', subject: 'Mathe', topic: 'T1', source: 'Foto', startedAt: '2026-10-20T13:00:00Z', finishedAt: null, stats: [] },
    ],
    events: [],
    parentPin: null,
    lessons: { L1: L('L1'), L2: L('L2'), L3: L('L3') },
    donePractice: [],
  }
  it('zählt archivierte Versuche als bestanden, damit es kein zweites Ei gibt', () => {
    expect(passedBefore(s, 'L1', 'a3')).toBe(true)
    expect(passedBefore(s, 'L2', 'a2')).toBe(false)
    expect(passedBefore(s, 'L1', 'a1')).toBe(false)
  })
  it('zeigt alle angefangenen Aufgaben, neueste zuerst, auch archivierte', () => {
    const o = lessonOverview(s)
    expect(o.map((e) => [e.lesson.id, e.passed])).toEqual([
      ['L1', true],
      ['L2', false],
    ])
  })
})
