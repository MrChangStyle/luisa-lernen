import { useCallback, useEffect, useState } from 'react'
import type { Child } from './learner'

// Wer benutzt dieses Gerät? Das entscheidet der Server (api/konto.ts) anhand des Anmelde-Cookies:
// kind   = eingerichtetes Kindergerät, kennt nur dieses eine Kind
// eltern = Elternteil mit E-Mail-Konto
// alt    = bisheriges Familien-Passwort (Luisas Familie), alles wie bisher
// Die letzte Antwort bleibt auf dem Gerät, damit die App auch ohne Internet richtig startet.

export type FamilyMeta = { id: string; name: string; bisherige: boolean; pin: boolean }

export type Me =
  | { rolle: 'kind'; kind: Child; familie: FamilyMeta }
  | { rolle: 'eltern'; email: string; familie: FamilyMeta | null }
  | { rolle: 'alt' }

const ROLE_KEY = 'luisa-lernen:rolle'

function cached(): Me | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY)
    return raw ? (JSON.parse(raw) as Me) : null
  } catch {
    return null
  }
}

function remember(me: Me) {
  try {
    localStorage.setItem(ROLE_KEY, JSON.stringify(me))
  } catch {
    // dann fragt die App beim nächsten Start wieder
  }
}

export async function fetchMe(): Promise<Me | 'offline'> {
  try {
    const res = await fetch('/api/konto?aktion=ich', { cache: 'no-store' })
    // Cloud noch nicht eingerichtet: bisheriges Verhalten
    if (res.status === 503) return { rolle: 'alt' }
    if (!res.ok) return 'offline'
    return (await res.json()) as Me
  } catch {
    return 'offline'
  }
}

// Ein Kindergerät behält nur die Daten seines eigenen Kindes. Ältere Stände anderer Kinder
// (aus der Zeit mit gemeinsamem Familien-Passwort) werden von diesem Gerät entfernt; in der Cloud bleiben sie.
export function keepOnlyChild(childId: string) {
  try {
    const own = childId === 'luisa' ? 'luisa-lernen:v1' : `luisa-lernen:v1:${childId}`
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if ((k.startsWith('luisa-lernen:v1') && k !== own) || k.startsWith('luisa-lernen:kinder') || k === 'luisa-lernen:aktiv') drop.push(k)
    }
    drop.forEach((k) => localStorage.removeItem(k))
  } catch {
    // Speicher gesperrt: nichts zu entfernen
  }
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(cached)
  const reload = useCallback(async () => {
    const r = await fetchMe()
    if (r === 'offline') {
      // Ohne Internet und ohne gemerkte Rolle: wie bisher
      setMe((cur) => cur ?? { rolle: 'alt' })
      return
    }
    if (r.rolle === 'kind') keepOnlyChild(r.kind.id)
    remember(r)
    setMe(r)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return [me, reload] as const
}

// Anfragen an api/konto.ts aus dem Elternbereich
export async function konto<T>(body: Record<string, unknown>): Promise<T | { error: string }> {
  try {
    const res = await fetch('/api/konto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!data) return { error: 'Der Server hat nicht geantwortet.' }
    return data
  } catch {
    return { error: 'Keine Verbindung zum Internet.' }
  }
}

export type DeviceInfo = { id: string; kind: string; name: string; seit: string; zuletzt: string | null }

export async function fetchDevices(): Promise<DeviceInfo[] | null> {
  try {
    const res = await fetch('/api/konto?aktion=geraete', { cache: 'no-store' })
    if (!res.ok) return null
    return ((await res.json()) as { geraete: DeviceInfo[] }).geraete
  } catch {
    return null
  }
}
