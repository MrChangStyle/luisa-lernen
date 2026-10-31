import { describe, expect, it } from 'vitest'
import { systemPrompt, userContent } from '../api/lesson'
import { pagePrompt } from '../api/page'
import { LUISA, genitive, learnerIntro, mergeFamily, parseLearner, type Child } from '../src/logic/learner'
import { spoken } from '../src/logic/speech'

const ben: Child = { id: 'ben-1', name: 'Ben', grade: 3, school: 'Grundschule', helps: ['zahlenBild', 'kleineSchritte'], updatedAt: '2026-11-01T10:00:00Z' }

describe('Kinder und Hilfen', () => {
  it('nimmt nur gültige Angaben an und ignoriert unbekannte Hilfen', () => {
    expect(parseLearner({ name: ' Ben ', grade: 3, school: 'Grundschule', helps: ['zahlenBild', 'diagnose', 'zahlenBild'] })).toEqual({ name: 'Ben', grade: 3, school: 'Grundschule', helps: ['zahlenBild'] })
    expect(parseLearner({ name: '', grade: 3, school: 'Grundschule', helps: [] })).toBeNull()
    expect(parseLearner({ name: 'Ben', grade: 30, school: 'Grundschule', helps: [] })).toBeNull()
    expect(parseLearner(null)).toBeNull()
  })
  it('verliert beim Zusammenführen kein Kind, die neuere Änderung gewinnt', () => {
    const older = { ...ben, grade: 2, updatedAt: '2026-10-01T00:00:00Z' }
    const m = mergeFamily({ children: [LUISA, ben], pin: '1111' }, { children: [LUISA, older], pin: null })
    expect(m.children.map((c) => c.id)).toEqual(['luisa', 'ben-1'])
    expect(m.children[1].grade).toBe(3)
    expect(m.pin).toBe('1111')
  })
  it('schreibt den Genitiv richtig', () => {
    expect(genitive('Luisa')).toBe('Luisas')
    expect(genitive('Jonas')).toBe('Jonas’')
  })
})

describe('KI bekommt das Kind und seine Hilfen', () => {
  it('ohne Angaben gilt Luisa wie bisher', () => {
    const p = systemPrompt()
    expect(p).toContain('Du erklärst Luisa Schulaufgaben')
    expect(p).toContain('6. Klasse einer Mittelschule')
    expect(p).toContain('wörtlich')
    expect(p).not.toContain('${')
  })
  it('nennt Name, Klasse und die Hilfen, aber keine Diagnose', () => {
    const p = systemPrompt(ben)
    expect(p).toContain('Du erklärst Ben')
    expect(p).toContain('3. Klasse einer Grundschule')
    expect(p).toContain('Zehnerfeld')
    expect(p).toContain('4 bis 7 Schritte')
    expect(p).not.toContain('Luisa')
    expect(p).not.toMatch(/Dyskalkulie|Autis/)
    expect(learnerIntro({ ...ben, helps: [] })).not.toContain('Besondere Hilfen')
    const topic = userContent({ mode: 'topic', subject: 'Mathe', topic: 'Plus' }, ben)[0]
    expect(topic.type === 'text' && topic.text).toContain('3. Klasse Grundschule')
    expect(pagePrompt(ben)).toContain('Das Kind heißt Ben')
  })
})

describe('Vorlesen', () => {
  it('liest Auszeichnung als normalen Text', () => {
    expect(spoken('**Regel:** Der [[Nenner]] von {3/4}\n\nist unten.')).toBe('Regel: Der Nenner von 3 von 4 ist unten.')
  })
})
