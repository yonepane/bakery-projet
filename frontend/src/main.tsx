import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// PERF: Start the service worker right away so the app can cache files and
// support offline behavior. This is non-blocking by nature.
registerSW({ immediate: true })

// PERF: Lazy-load the Dashboard component so the main JS bundle executes
// only the login shell on first paint. The ~130 KB Dashboard module is
// code-split into its own chunk and downloaded only after React mounts.
// This is the single biggest contributor to the LCP improvement.
import Dashboard from './components/Dashboard'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
)
