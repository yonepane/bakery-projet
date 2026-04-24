import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './components/Dashboard'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Start the service worker right away so the app can cache files and support
// offline behavior.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* The Dashboard component renders the whole app interface. */}
    <Dashboard />
  </React.StrictMode>,
)
