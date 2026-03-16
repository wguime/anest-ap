import { StrictMode, Component, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, ToastProvider } from '@/design-system'
import { EventAlertsProvider } from './contexts/EventAlertsContext'
import { UserProvider, useUser } from './contexts/UserContext'
import { DocumentsProvider } from './contexts/DocumentsContext'
import { IncidentsProvider } from './contexts/IncidentsContext'
import { MessagesProvider } from './contexts/MessagesContext'
import { PlanosAcaoProvider } from './contexts/PlanosAcaoContext'
import { AuditoriasInterativasProvider } from './contexts/AuditoriasInterativasContext'
import { AutoavaliacaoProvider } from './contexts/AutoavaliacaoContext'
import { CateterPeridualProvider } from './contexts/CateterPeridualContext'
import { UsersManagementProvider } from './contexts/UsersManagementContext'
import { ComunicadosProvider } from './contexts/ComunicadosContext'
import './index.css'
import App from './App.jsx'

/**
 * Global error boundary to catch and display runtime errors
 * instead of showing a blank white page.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#111916', color: '#2ECC71', minHeight: '100vh' }}>
          <h1 style={{ color: '#ff6b6b', fontSize: 20 }}>Erro na Aplicacao</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, fontSize: 14, color: '#ccc' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12, color: '#888' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: '10px 20px', background: '#2ECC71', color: '#111916', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Recarregar Pagina
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Tier 2 providers — deferred by 2 seconds after login to speed up initial render.
 * Until the timer fires, children render without these providers (hooks return safe fallbacks).
 */
function DeferredProviders({ children }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!ready) return children

  return (
    <DocumentsProvider>
      <IncidentsProvider>
        <UsersManagementProvider>
          <PlanosAcaoProvider>
            <AuditoriasInterativasProvider>
              <AutoavaliacaoProvider>
                <CateterPeridualProvider>
                  {children}
                </CateterPeridualProvider>
              </AutoavaliacaoProvider>
            </AuditoriasInterativasProvider>
          </PlanosAcaoProvider>
        </UsersManagementProvider>
      </IncidentsProvider>
    </DocumentsProvider>
  )
}

/**
 * Gate that only mounts data providers AFTER authentication is confirmed.
 * Without this, all providers fire useEffect([], []) on mount (before login),
 * Supabase queries run with no auth token, RLS blocks everything, and data
 * stays empty forever — even after the user logs in.
 *
 * Tier 1 (critical — mount immediately): Comunicados, EventAlerts, Messages
 * Tier 2 (deferred — mount after 2s): Documents, Incidents, UsersManagement,
 *         PlanosAcao, AuditoriasInterativas, Autoavaliacao
 */
function AuthGatedProviders({ children }) {
  const { isAuthenticated, isLoading } = useUser()

  // While auth is loading or user is not authenticated, render children
  // directly (App.jsx will show spinner or LoginPage)
  if (isLoading || !isAuthenticated) {
    return children
  }

  return (
    <ComunicadosProvider>
      <EventAlertsProvider>
        <MessagesProvider>
          <DeferredProviders>
            {children}
          </DeferredProviders>
        </MessagesProvider>
      </EventAlertsProvider>
    </ComunicadosProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <UserProvider>
            <AuthGatedProviders>
              <App />
            </AuthGatedProviders>
          </UserProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
