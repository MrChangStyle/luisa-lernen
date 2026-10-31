import { useState } from 'react'
import App from './App'
import { ChildPicker } from './screens/Children'
import { useFamily } from './state'

// Welches Kind auf diesem Gerät gerade lernt. Ohne Wahl: Luisa (bisheriges Verhalten).
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
  const [picking, setPicking] = useState(false)
  const child = family.children.find((c) => c.id === active) ?? family.children[0]

  if (picking)
    return (
      <ChildPicker
        children={family.children}
        onPick={(id) => {
          try {
            localStorage.setItem(ACTIVE_KEY, id)
          } catch {
            // Wahl gilt dann nur bis zum Neuladen
          }
          setActive(id)
          setPicking(false)
        }}
        onBack={() => setPicking(false)}
      />
    )
  // key: Beim Wechsel wird die App neu aufgebaut, damit sich die Stände der Kinder nie vermischen
  return <App key={child.id} child={child} family={family} setFamily={setFamily} onSwitch={family.children.length > 1 ? () => setPicking(true) : undefined} />
}
