// Name der App. Vor der Anmeldung und im Elternbereich gilt der Basisname,
// auf dem Gerät eines Kindes heißt sie wie das Kind, z. B. „Luisa lernen“.
// Den Basisnamen nur hier ändern (dazu public/manifest.webmanifest und index.html für die lokale Entwicklung).
export const BASE_NAME = 'Lernhof'

export const childAppName = (name: string) => `${name} lernen`

export function manifest(name: string) {
  return {
    name,
    short_name: name.length > 14 ? name.split(' ')[0] : name,
    lang: 'de',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfbf8',
    theme_color: '#2f6f73',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
