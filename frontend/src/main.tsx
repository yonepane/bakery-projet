import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './components/Dashboard'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

// Build: v2.9-FINAL-SIDEBAR-GROUP-FIX

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
)
