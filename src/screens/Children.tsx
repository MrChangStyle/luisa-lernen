import { useState } from 'react'
import { Screen } from '../components/Ui'
import { HELP_KEYS, HELPS, PROFILES, SCHOOLS, type Child, type FamilyInfo, type HelpKey } from '../logic/learner'

// Familienbereich: Kinder anlegen und ihre Hilfen einstellen. Gespeichert werden nur die Hilfen, keine Diagnose.
export function ChildrenCard({ family, current, setFamily }: { family: FamilyInfo; current: string; setFamily: (fn: (f: FamilyInfo) => FamilyInfo) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const save = (c: Child) => {
    setFamily((f) => ({
      ...f,
      children: f.children.some((x) => x.id === c.id) ? f.children.map((x) => (x.id === c.id ? c : x)) : [...f.children, c],
    }))
    setEditing(null)
  }
  const blank: Child = { id: '', name: '', grade: 5, school: 'Mittelschule', helps: [], updatedAt: '' }
  return (
    <details className="fold">
      <summary>
        <span>Kinder und Hilfen</span>
        <span className="pill idle">{family.children.length}</span>
      </summary>
      {family.children.map((c) =>
        editing === c.id ? (
          <ChildForm key={c.id} start={c} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <section key={c.id} className="card stack">
            <div className="row-between">
              <b>
                {c.name}
                {c.id === current && <span className="mini"> (gerade geöffnet)</span>}
              </b>
              <span className="mini">
                {c.grade}. Klasse · {c.school}
              </span>
            </div>
            <div className="mini">Hilfen: {c.helps.length ? c.helps.map((h) => HELPS[h].label).join(', ') : 'keine besonderen'}</div>
            <button className="btn sec slim" onClick={() => setEditing(c.id)}>
              Ändern
            </button>
          </section>
        ),
      )}
      {editing === 'neu' ? (
        <ChildForm start={blank} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <button className="btn sec slim" onClick={() => setEditing('neu')}>
          Kind hinzufügen
        </button>
      )}
      <p className="mini">Jedes Kind hat seinen eigenen Bauernhof, seine eigenen Aufgaben und seinen eigenen Verlauf. Die Eltern-PIN gilt für alle Kinder.</p>
    </details>
  )
}

function ChildForm({ start, onSave, onCancel }: { start: Child; onSave: (c: Child) => void; onCancel: () => void }) {
  const [name, setName] = useState(start.name)
  const [grade, setGrade] = useState(start.grade)
  const [school, setSchool] = useState(start.school)
  const [helps, setHelps] = useState<HelpKey[]>(start.helps)
  const [err, setErr] = useState('')
  const toggle = (h: HelpKey) => setHelps((old) => (old.includes(h) ? old.filter((x) => x !== h) : [...old, h]))
  const submit = () => {
    const n = name.trim()
    if (!n) return setErr('Bitte einen Vornamen oder Spitznamen eingeben.')
    const id = start.id || `${n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'kind'}-${crypto.randomUUID().slice(0, 6)}`
    // Reihenfolge wie in HELP_KEYS, damit gleiche Einstellungen gleich aussehen
    onSave({ id, name: n.slice(0, 30), grade, school, helps: HELP_KEYS.filter((h) => helps.includes(h)), updatedAt: new Date().toISOString() })
  }
  return (
    <section className="card stack child-form">
      <b>{start.id ? `${start.name} ändern` : 'Neues Kind'}</b>
      <label>
        <span>Vorname oder Spitzname</span>
        <input value={name} maxLength={30} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="row2">
        <label>
          <span>Klasse</span>
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {g}. Klasse
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Schulart</span>
          <select value={school} onChange={(e) => setSchool(e.target.value)}>
            {SCHOOLS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="stack">
        <span className="mini">Profil als Abkürzung (schaltet passende Hilfen ein, gespeichert werden nur die Hilfen):</span>
        <div className="chips">
          {PROFILES.map((p) => (
            <button key={p.name} type="button" className="chip small" onClick={() => setHelps((old) => [...new Set([...old, ...p.helps])])}>
              + {p.name}
            </button>
          ))}
        </div>
      </div>
      {HELP_KEYS.map((h) => (
        <label key={h} className="check">
          <input type="checkbox" checked={helps.includes(h)} onChange={() => toggle(h)} />
          <span>
            <b>{HELPS[h].label}</b>
            <br />
            <span className="mini">{HELPS[h].parents}</span>
          </span>
        </label>
      ))}
      {err && <div className="fb no">{err}</div>}
      <div className="row2">
        <button className="btn slim" onClick={submit}>
          Speichern
        </button>
        <button className="btn sec slim" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </section>
  )
}

// Auswahl beim Wechseln: Jedes Kind tippt auf seinen Namen. Das Gerät merkt sich die Wahl.
export function ChildPicker({ children, onPick, onBack }: { children: Child[]; onPick: (id: string) => void; onBack: () => void }) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Wer lernt jetzt?</div>
      <div className="stack">
        {children.map((c) => (
          <button key={c.id} className="card tap pick-child" onClick={() => onPick(c.id)}>
            <span className="initial" aria-hidden="true">
              {c.name.slice(0, 1).toUpperCase()}
            </span>
            <b>{c.name}</b>
          </button>
        ))}
      </div>
    </Screen>
  )
}
