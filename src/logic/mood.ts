export function moodText(v: number): string {
  if (v < 20) return 'Mir geht es schlecht.'
  if (v < 40) return 'Mir geht es nicht so gut.'
  if (v < 60) return 'Es geht.'
  if (v < 80) return 'Mir geht es gut.'
  return 'Mir geht es sehr gut.'
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
