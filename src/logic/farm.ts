import type { Farm } from '../types'

export const FARM_ORDER = ['egg', 'chick', 'hen', 'rooster', 'cow'] as const
export type Animal = (typeof FARM_ORDER)[number]

export const ANIMAL_NAME: Record<Animal, [string, string]> = {
  egg: ['Ei', 'Eier'],
  chick: ['Küken', 'Küken'],
  hen: ['Huhn', 'Hühner'],
  rooster: ['Hahn', 'Hähne'],
  cow: ['Kuh', 'Kühe'],
}

export const animalName = (a: Animal, n: number) => ANIMAL_NAME[a][n === 1 ? 0 : 1]

export const EMPTY_FARM: Farm = { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }

// 1 Ei pro richtig fertiger Aufgabe. Je 10 Tiere werden zum nächsten Tier. Nichts geht verloren.
export function addEgg(farm: Farm): { farm: Farm; messages: string[] } {
  const next = { ...farm, egg: farm.egg + 1 }
  const messages: string[] = []
  for (let i = 0; i < FARM_ORDER.length - 1; i++) {
    const k = FARM_ORDER[i]
    const up = FARM_ORDER[i + 1]
    if (next[k] >= 10) {
      next[k] -= 10
      next[up] += 1
      messages.push(`10 ${animalName(k, 10)} sind jetzt 1 ${animalName(up, 1)}.`)
    }
  }
  return { farm: next, messages }
}
