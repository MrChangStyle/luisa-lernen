import type { Topic } from '../types'

// Vorläufige Themen nach LehrplanPLUS, 6. Klasse Mittelschule Bayern. Wird noch mit dem Lehrplan abgeglichen.
export const SUBJECTS: Record<string, Topic[]> = {
  Mathe: [
    { name: 'Teiler und Vielfache', status: 'neu' },
    { name: 'Brüche erweitern und kürzen', status: 'neu' },
    { name: 'Brüche addieren', status: 'neu' },
    { name: 'Dezimalbrüche', status: 'neu' },
    { name: 'Würfel und Quader: Rauminhalt', status: 'neu' },
  ],
  Deutsch: [
    { name: 'Satzglieder', status: 'neu' },
    { name: 'Wortarten', status: 'neu' },
    { name: 'das oder dass', status: 'neu' },
    { name: 'Einen Bericht schreiben', status: 'neu' },
  ],
  Englisch: [
    { name: 'Vokabeln', status: 'neu' },
    { name: 'simple past', status: 'neu' },
    { name: 'present progressive', status: 'neu' },
    { name: 'Fragen bilden', status: 'neu' },
  ],
  NT: [
    { name: 'Stoffe und ihre Eigenschaften', status: 'neu' },
    { name: 'Der einfache Stromkreis', status: 'neu' },
    { name: 'Messen und Experimentieren', status: 'neu' },
  ],
  Biologie: [
    { name: 'Pflanzen und ihre Teile', status: 'neu' },
    { name: 'Tiere und ihre Lebensräume', status: 'neu' },
    { name: 'Der menschliche Körper', status: 'neu' },
  ],
  GPG: [
    { name: 'Karten lesen', status: 'neu' },
    { name: 'Bayern und Deutschland', status: 'neu' },
    { name: 'Klima und Landschaften', status: 'neu' },
    { name: 'Frühe Menschen', status: 'neu' },
    { name: 'Ägypten', status: 'neu' },
    { name: 'Griechen und Römer', status: 'neu' },
  ],
}
