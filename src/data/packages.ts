// Pläne für die Inhaltspakete: welche Themen ein Paket hat. Der Generator (scripts/make-package.ts) erstellt daraus
// die fertigen Aufgaben; die App lädt das fertige Paket aus public/inhalte/<id>.json.
// Grundlage: LehrplanPLUS Grundschule Bayern, Mathematik 3/4 (https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/3/mathematik).
// Der Lehrplan gilt für 3/4 gemeinsam; die Aufteilung auf Klasse 3 folgt der üblichen Praxis (Zahlenraum bis 1000,
// schriftliche Addition und Subtraktion, Einmaleins festigen; Million und schriftliches Malnehmen/Teilen in Klasse 4).

export interface PlanTopic {
  name: string
  area: string
  // Was die Aufgaben genau abdecken sollen, für die KI
  focus: string
}

export interface PackagePlan {
  id: string
  title: string
  grade: number
  school: string
  subject: string
  topics: PlanTopic[]
}

const Z = 'Zahlen und Operationen'
const R = 'Raum und Form'
const G = 'Größen und Messen'
const D = 'Daten und Zufall'

export const PLANS: Record<string, PackagePlan> = {
  'gs-3-mathe': {
    id: 'gs-3-mathe',
    title: 'Mathe Klasse 3',
    grade: 3,
    school: 'Grundschule',
    subject: 'Mathe',
    topics: [
      { name: 'Zahlen bis 1000 darstellen', area: Z, focus: 'Hunderter, Zehner, Einer bündeln und in der Stellenwerttafel darstellen, Zahlwort und Ziffern, Zahlen zerlegen (z. B. 347 = 300 + 40 + 7).' },
      { name: 'Zahlen bis 1000 vergleichen und ordnen', area: Z, focus: 'Größer, kleiner, Nachbarzahlen, Nachbarzehner und -hunderter, Zahlen am Zahlenstrahl einordnen.' },
      { name: 'Runden und Überschlagen', area: Z, focus: 'Auf Zehner und Hunderter runden, Ergebnis mit Überschlag prüfen.' },
      { name: 'Kopfrechnen: Plus und Minus bis 1000', area: Z, focus: 'Reine Hunderter und Zehner addieren und subtrahieren, Analogie zum kleinen Zahlenraum (3 + 4 → 300 + 400), Ergänzen.' },
      { name: 'Halbschriftlich addieren und subtrahieren', area: Z, focus: 'Schrittweise rechnen mit Notizen, Stellenwerte extra, verschiedene Rechenwege vergleichen.' },
      { name: 'Schriftliche Addition', area: Z, focus: 'Stellengerecht untereinander schreiben, von rechts nach links rechnen, Übertrag.' },
      { name: 'Schriftliche Subtraktion', area: Z, focus: 'Abziehverfahren mit Entbündeln, stellengerecht, Probe mit Addition.' },
      { name: 'Einmaleins und Umkehraufgaben', area: Z, focus: 'Kleines Einmaleins festigen, Kernaufgaben (·1, ·2, ·5, ·10) nutzen, Tauschaufgabe, Umkehraufgabe mit Geteilt.' },
      { name: 'Malnehmen mit Zehnerzahlen', area: Z, focus: 'Einmaleins übertragen (6 · 4 → 60 · 4), halbschriftlich zerlegen (7 · 23 = 7 · 20 + 7 · 3).' },
      { name: 'Teilen mit Rest', area: Z, focus: 'Geteilt-Aufgaben im Einmaleins, Rest bestimmen, Rest kleiner als der Teiler.' },
      { name: 'Sachaufgaben lösen', area: Z, focus: 'Frage, Rechnung, Antwort; wichtige Angaben finden; ein- und zweischrittige Aufgaben aus dem Alltag.' },
      { name: 'Längen: mm, cm, m, km', area: G, focus: 'Einheiten umwandeln, Kommaschreibweise bei Meter, Längen vergleichen und schätzen.' },
      { name: 'Gewichte: g und kg', area: G, focus: '1 kg = 1000 g, umwandeln, vergleichen, halbes und viertel Kilogramm.' },
      { name: 'Zeit und Zeitspannen', area: G, focus: 'Uhrzeit lesen, Zeitspannen in Minuten und Stunden berechnen, Anfang und Ende.' },
      { name: 'Geld: Euro und Cent', area: G, focus: 'Kommaschreibweise, umwandeln, einkaufen und Rückgeld.' },
      { name: 'Würfel und Quader', area: R, focus: 'Ecken, Kanten, Flächen zählen und vergleichen, Würfel und Quader unterscheiden, Würfelgebäude zählen.' },
      { name: 'Achsensymmetrie', area: R, focus: 'Symmetrische Figuren erkennen, Symmetrieachse, Spiegelbild beschreiben (als Text oder einfache Raster-Beschreibung).' },
      { name: 'Tabellen und Diagramme', area: D, focus: 'Werte aus Tabelle und Balkendiagramm ablesen (als Text-Tabelle dargestellt), vergleichen, einfache Fragen beantworten.' },
      { name: 'Sicher, möglich, unmöglich', area: D, focus: 'Wahrscheinlichkeit bei Würfel, Glücksrad und Kugeln im Säckchen einschätzen und begründen.' },
    ],
  },
}

// Welches Paket zu einem Kind passt. Bisher gibt es nur Mathe; weitere Fächer kommen dazu.
export const packageIdFor = (school: string, grade: number) => {
  const id = school === 'Grundschule' ? `gs-${grade}-mathe` : ''
  return id in PLANS ? id : null
}
