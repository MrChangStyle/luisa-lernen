import { useState } from 'react'
import App from './App'
import { useFamily } from './state'

// Jedes Gerät gehört genau einem Kind. Es kennt nur dessen Stand. Ohne Zuordnung: Luisa (bisheriges Verhalten).
const ACTIVE_KEY = 'luisa-lernen:aktiv'

function loadActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? 'luisa'
  } catch {
    return 'luisa'
  }
}

export default function Root() {
  const [family, setFamily] = useFamily()
  const [active, setActive] = useState(loadActive)
  const child = family.children.find((c) => c.id === active) ?? family.children[0]
  // Nur im Familienbereich (hinter der Eltern-PIN): dieses Gerät einem anderen Kind zuordnen
  const assignDevice = (id: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, id)
    } catch {
      // Zuordnung gilt dann nur bis zum Neuladen
    }
    setActive(id)
  }
  // key: Beim Wechsel wird die App neu aufgebaut, damit sich die Stände der Kinder nie vermischen
  return <App key={child.id} child={child} family={family} setFamily={setFamily} onAssignDevice={assignDevice} />
}
