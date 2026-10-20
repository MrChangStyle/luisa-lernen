// Reihenfolge in „Meine Auswahl“: ein Thema eine Stelle nach oben (-1) oder unten (+1) schieben
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}
