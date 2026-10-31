import { useState } from 'react'
import App from './App'
import { useMe, type Me } from './logic/konto'
import type { Child } from './logic/learner'
import { Parents } from './screens/Parents'
import { useFamily } from './state'

// Wer das Gerät benutzt, entscheidet der Server (siehe logic/konto.ts):
// Kindergerät: nur dieses eine Kind, kein Wechsel, keine Kinderliste.
// Eltern-Konto: Elternbereich mit Kindern, Geräten und Übersicht je Kind.
// Bisheriges Familien-Passwort: alles wie bisher (Luisa).
export default function Root() {
  const [me, reload] = useMe()
  if (!me) return null
  if (me.rolle === 'kind') return <ChildDevice key={me.kind.id} me={me} />
  if (me.rolle === 'eltern') return <Parents key={me.familie?.id ?? 'neu'} me={me} reload={reload} />
  return <LegacyRoot />
}

// Kindergerät: Kind und PIN kommen vom Server. Die Kinderliste ändert nur ein Eltern-Konto.
function ChildDevice({ me }: { me: Extract<Me, { rolle: 'kind' }> }) {
  const [family] = useFamily({ key: 'luisa-lernen:kinder:geraet', start: { children: [me.kind], pin: null }, readOnly: true })
  // Name, Klasse und Hilfen immer in der neuesten Fassung vom Server
  const child: Child = family.children.find((c) => c.id === me.kind.id) ?? me.kind
  return <App key={child.id} device="kind" child={child} family={{ children: [child], pin: family.pin }} setFamily={() => {}} />
}

// Bisheriger Zugang: Jedes Gerät gehört einem Kind (Zuordnung im Familienbereich), ohne Zuordnung Luisa.
const ACTIVE_KEY = 'luisa-lernen:aktiv'

function loadActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? 'luisa'
  } catch {
    return 'luisa'
  }
}

function LegacyRoot() {
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
  return <App key={child.id} device="alt" child={child} family={family} setFamily={setFamily} onAssignDevice={assignDevice} />
}
