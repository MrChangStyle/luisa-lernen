import type { Check } from '../types'

// Prüft Luisas Eingabe. Ergebnis: passt / passt fast / passt nicht, mit einem sachlichen Hinweis.
// In dieser Testversion läuft die Prüfung auf dem Gerät; später auf dem Server, damit keine Lösung im Handy liegt.
export type CheckResult = { status: 'ok' | 'almost' | 'no'; text: string; given: string }

const fill = (s: string, x: string | number) => s.split('{x}').join(String(x))

export function checkAnswer(check: Check, input: string[]): CheckResult | null {
  const nums = input.map((v) => Number(v.trim()))
  switch (check.type) {
    case 'choice': {
      const a = input[0]
      if (!a) return null
      return a === check.answer ? { status: 'ok', text: 'Das passt.', given: a } : { status: 'no', text: fill(check.hint, a), given: a }
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
