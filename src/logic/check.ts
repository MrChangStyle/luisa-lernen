import type { Check } from '../types'

// Prüft Luisas Eingabe. Ergebnis: passt / passt fast / passt nicht, mit einem sachlichen Hinweis.
// Die Prüfung läuft auf dem Gerät. Luisa sieht die erwarteten Antworten nie, sie stecken aber im Lernpfad.
export type CheckResult = { status: 'ok' | 'almost' | 'no'; text: string; given: string }

const fill = (s: string, x: string | number) => s.split('{x}').join(String(x))

// Vergleichbare Form einer Eingabe: ohne Groß/klein, doppelte Leerzeichen und Punkt am Ende
export const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[„“"'.!]+$/g, '')
    .replace(/^[„“"']+/, '')
    .replace(/\s+/g, ' ')

const asNumber = (s: string) => {
  const t = normalize(s).replace(/\s/g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

export function sameAnswer(given: string, expected: string) {
  const a = asNumber(given)
  const b = asNumber(expected)
  if (a !== null && b !== null) return Math.abs(a - b) < 1e-9
  return normalize(given) === normalize(expected)
}

export function checkAnswer(check: Check, input: string[]): CheckResult | null {
  const nums = input.map((v) => Number(v.trim()))
  switch (check.type) {
    case 'choice': {
      const a = input[0]
      if (!a) return null
      return a === check.answer ? { status: 'ok', text: 'Das passt.', given: a } : { status: 'no', text: fill(check.hint, a), given: a }
    }
    case 'value': {
      const a = input[0]?.trim()
      if (!a) return null
      return check.answers.some((e) => sameAnswer(a, e)) ? { status: 'ok', text: check.okText, given: a } : { status: 'no', text: fill(check.hint, a), given: a }
    }
    case 'number': {
      const n = nums[0]
      if (!input[0] || !Number.isFinite(n) || n <= 0) return null
      if (n === check.answer) return { status: 'ok', text: check.okText, given: String(n) }
      if (n % check.answer === 0) return { status: 'almost', text: check.largerMultipleHint, given: String(n) }
      return { status: 'no', text: fill(check.hint, n), given: String(n) }
    }
    case 'numerators': {
      if (input.length < check.answers.length || input.some((v) => !v.trim())) return null
      const given = nums.map((n) => `${n}/${check.denominator}`).join(' und ')
      const wrong = check.answers.findIndex((a, i) => nums[i] !== a)
      return wrong === -1 ? { status: 'ok', text: check.okText, given } : { status: 'no', text: check.hints[wrong], given }
    }
    case 'fraction': {
      if (input.length < 2 || input.some((v) => !v.trim())) return null
      const [z, n] = nums
      const given = `${z}/${n}`
      if (z === check.answer[0] && n === check.answer[1]) return { status: 'ok', text: check.okText, given }
      const special = check.hints.find(
        (h) => (h.numerator === undefined || h.numerator === z) && (h.denominator === undefined || h.denominator === n),
      )
      if (special) return { status: 'no', text: special.text, given }
      return { status: 'no', text: n !== check.answer[1] ? check.wrongDenominator : check.wrongNumerator, given }
    }
  }
}
