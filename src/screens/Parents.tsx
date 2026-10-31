import { useEffect, useState } from 'react'
import App from '../App'
import { Screen } from '../components/Ui'
import { fetchDevices, konto, type DeviceInfo, type Me } from '../logic/konto'
import { genitive, type Child } from '../logic/learner'
import { dateLabel, parentFamily, useFamily } from '../state'
import { ChildrenCard } from './Children'

type ParentMe = Extract<Me, { rolle: 'eltern' }>

// Elternbereich mit E-Mail-Konto. Ohne Familie: anlegen oder die bisherige (Luisa) übernehmen.
export function Parents({ me, reload }: { me: ParentMe; reload: () => Promise<void> }) {
  if (!me.familie) return <FamilySetup email={me.email} reload={reload} />
  return <ParentHome me={me} familyId={me.familie.id} familyName={me.familie.name} />
}

function Logout() {
  return (
    <a className="mini" href="/__abmelden">
      Abmelden
    </a>
  )
}

function FamilySetup({ email, reload }: { email: string; reload: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async (body: Record<string, unknown>) => {
    setBusy(true)
    setErr('')
    const r = await konto<{ familie: unknown }>(body)
    setBusy(false)
    if ('error' in r) return setErr(r.error)
    await reload()
  }
  return (
    <Screen>
      <div className="row-between">
        <div className="s-title">Willkommen</div>
        <Logout />
      </div>
      <p className="mini">Angemeldet als {email}</p>
      <section className="card stack child-form">
        <b>Neue Familie anlegen</b>
        <p className="mini">Danach legst du deine Kinder an und richtest für jedes Kind sein eigenes Gerät ein.</p>
        <label>
          <span>Name der Familie</span>
          <input value={name} maxLength={40} placeholder="z. B. Familie Müller" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn slim" disabled={busy || !name.trim()} onClick={() => send({ aktion: 'familie-anlegen', name })}>
          Familie anlegen
        </button>
      </section>
      <details className="fold">
        <summary>Bisherige Familie übernehmen (Luisa)</summary>
        <div className="stack child-form">
          <p className="mini">Mit dem bisherigen Familien-Passwort übernimmst du Luisas Familie mit allen Kindern, Lernständen und der Eltern-PIN in dein Konto. Der zweite Elternteil macht das genauso.</p>
          <input type="password" aria-label="Familien-Passwort" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn slim" disabled={busy || !password} onClick={() => send({ aktion: 'familie-uebernehmen', passwort: password })}>
            Familie übernehmen
          </button>
        </div>
      </details>
      {err && <div className="fb no">{err}</div>}
    </Screen>
  )
}

function ParentHome({ me, familyId, familyName }: { me: ParentMe; familyId: string; familyName: string }) {
  const [opts] = useState(() => parentFamily(familyId))
  const [family, setFamily] = useFamily(opts)
  const [viewing, setViewing] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null)
  const [pin, setPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const refresh = () => void fetchDevices().then(setDevices)
  useEffect(refresh, [])

  const child = viewing ? family.children.find((c) => c.id === viewing) : undefined
  if (child) return <App key={child.id} device="eltern" child={child} family={family} setFamily={setFamily} onExit={() => setViewing(null)} />

  const savePin = () => {
    if (!/^\d{4}$/.test(pin)) return setPinMsg('Bitte genau 4 Ziffern eingeben.')
    setFamily((f) => ({ ...f, pin }))
    setPin('')
    setPinMsg('PIN gespeichert. Sie gilt auf allen Kindergeräten.')
  }

  return (
    <Screen>
      <div className="row-between">
        <div className="s-title">Elternbereich</div>
        <Logout />
      </div>
      <p className="mini">
        {familyName} · angemeldet als {me.email}
      </p>
      <ChildrenCard
        open
        family={family}
        setFamily={setFamily}
        extra={(c) => (
          <>
            <button className="btn sec slim" onClick={() => setViewing(c.id)}>
              {genitive(c.name)} Übersicht
            </button>
            <DeviceCode child={c} onPaired={refresh} />
            <DeviceList child={c} devices={devices?.filter((d) => d.kind === c.id) ?? []} onChange={refresh} />
          </>
        )}
      />
      <section className="card stack">
        <b>Eltern-PIN {family.pin ? '(festgelegt)' : '(noch keine)'}</b>
        <p className="mini">Schützt den Familienbereich auf den Kindergeräten. Die Kinder brauchen sie nicht.</p>
        <div className="row2">
          <input className="num" type="password" inputMode="numeric" maxLength={4} aria-label="Neue PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="btn slim" onClick={savePin}>
            {family.pin ? 'PIN ändern' : 'PIN festlegen'}
          </button>
        </div>
        {pinMsg && <div className="mini">{pinMsg}</div>}
      </section>
    </Screen>
  )
}

// Einmal-Code, mit dem das Kind auf seinem Gerät die App einrichtet
function DeviceCode({ child, onPaired }: { child: Child; onPaired: () => void }) {
  const [code, setCode] = useState<{ code: string; until: string } | null>(null)
  const [err, setErr] = useState('')
  const make = async () => {
    setErr('')
    const r = await konto<{ code: string; gueltigBis: string }>({ aktion: 'geraet-code', kind: child.id })
    if ('error' in r) return setErr(r.error)
    setCode({ code: r.code, until: r.gueltigBis })
  }
  if (code)
    return (
      <div className="fb ok stack" role="status">
        <span>
          Öffne die App auf {genitive(child.name)} Gerät und gib unter „Für Kinder: Gerät einrichten“ diesen Code ein. Er gilt bis{' '}
          {new Date(code.until).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr und nur einmal.
        </span>
        <b className="device-code">{code.code}</b>
        <button
          className="btn sec slim"
          onClick={() => {
            setCode(null)
            onPaired()
          }}
        >
          Fertig
        </button>
      </div>
    )
  return (
    <>
      <button className="btn sec slim" onClick={make}>
        Gerät für {child.name} einrichten
      </button>
      {err && <div className="fb no">{err}</div>}
    </>
  )
}

function DeviceList({ child, devices, onChange }: { child: Child; devices: DeviceInfo[]; onChange: () => void }) {
  const [asking, setAsking] = useState<string | null>(null)
  const [err, setErr] = useState('')
  if (!devices.length) return <div className="mini">Noch kein eigenes Gerät eingerichtet.</div>
  const revoke = async (id: string) => {
    const r = await konto<{ ok: boolean }>({ aktion: 'geraet-sperren', geraet: id })
    if ('error' in r) return setErr(r.error)
    setAsking(null)
    onChange()
  }
  return (
    <div className="stack">
      {devices.map((d) => (
        <div key={d.id} className="stack">
          <div className="row-between mini">
            <span>
              {d.name}, eingerichtet {dateLabel(d.seit)}
              {d.zuletzt ? `, zuletzt ${dateLabel(d.zuletzt)}` : ''}
            </span>
            {asking !== d.id && (
              <button className="btn sec slim" onClick={() => setAsking(d.id)}>
                Entfernen
              </button>
            )}
          </div>
          {asking === d.id && (
            <div className="fb no stack" role="alertdialog">
              <span>Dieses Gerät kommt danach nicht mehr an {genitive(child.name)} Daten. Die Daten selbst bleiben erhalten.</span>
              <div className="row2">
                <button className="btn slim" onClick={() => revoke(d.id)}>
                  Ja, entfernen
                </button>
                <button className="btn sec slim" onClick={() => setAsking(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {err && <div className="fb no">{err}</div>}
    </div>
  )
}
