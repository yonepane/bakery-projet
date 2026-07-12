/// <reference types="vite-plugin-pwa/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './i18n'
import { registerSW } from 'virtual:pwa-register'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID } from './components/dashboard/constants'
import Dashboard from './components/Dashboard'

// PERF: Start the service worker right away so the app can cache files and
// support offline behavior. This is non-blocking by nature.
registerSW({ immediate: true })

// H3 fix: catch unhandled React render errors so a single panel crash cannot
// blank the entire app. Shows a minimal recovery UI instead.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif', gap: 16,
        }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, margin: 0 }}>{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8,
              background: '#d4a017', border: 'none', color: '#000',
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Dashboard />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

