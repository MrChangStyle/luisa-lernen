import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { Guard } from './components/Guard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Guard>
      <Root />
    </Guard>
  </StrictMode>,
)

// Damit sich die App auf den Startbildschirm legen lässt und offline startet
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
