import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './components/Dashboard'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

// Build: v3.3-ENTERPRISE-SaaS-PRO-FIX

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
)
