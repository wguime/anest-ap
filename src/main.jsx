import { StrictMode, Component, Suspense, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider, ToastProvider, Spinner } from '@/design-system'
import { PageLoadingFallback } from '@/design-system/components/anest/page-loading-fallback'
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
import { EscalaCirurgicaProvider } from './contexts/EscalaCirurgicaContext'
import { NoticiasProvider } from './contexts/NoticiasContext'
import LoginPage from './pages/LoginPage'
import VerificarCertificadoPage from './pages/educacao/VerificarCertificadoPage'
import VerificarDocumentoPublicoPage from './pages/VerificarDocumentoPublicoPage'
import './index.css'
import App from './App.jsx'

// Sentry init (PROD only, requer VITE_SENTRY_DSN). Lazy import → não bundla
// em DEV e bundla apenas se DSN configurada via env build-time.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
      // LGPD: não inclui PII no payload default (ANEST sanitiza explicitamente
      // em errorReporting.js via tags/extras whitelisted).
      sendDefaultPii: false,
    })
  }).catch((e) => {
    console.warn('[Sentry] Failed to initialize:', e)
  })
}

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
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#111916', color: '#2ECC71', minHeight: '100dvh' }}>
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
                  <EscalaCirurgicaProvider>
                    {children}
                  </EscalaCirurgicaProvider>
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
 * Single auth gate. Renders one of three trees based on auth state:
 *   1. isLoading       → splash spinner (prevents login flash on cold start)
 *   2. !isAuthenticated → LoginPage (no data providers yet)
 *   3. authenticated   → Tier 1 providers + DeferredProviders + App
 *
 * Why splash before any decision: see firebase/quickstart-js#58 and
 * FirebaseExtended/reactfire#354 — without this, the login screen flashes
 * briefly even for users with persisted sessions, because the synchronous
 * render runs before onAuthStateChanged resolves.
 *
 * Why providers only after auth: each provider fires useEffect([], []) on
 * mount; if mounted pre-auth, Supabase queries run with no JWT and RLS
 * blocks everything. Mounting them only after auth also guarantees `App`
 * never remounts (the wrapper tree stops changing once auth resolves),
 * which fixes the double-mount of HomePage in production.
 *
 * Tier 1 (critical — mount immediately): Comunicados, EventAlerts, Messages, Noticias
 * Tier 2 (deferred — mount after 2s): Documents, Incidents, UsersManagement,
 *         PlanosAcao, AuditoriasInterativas, Autoavaliacao, CateterPeridual
 */
function AuthGatedProviders({ children }) {
  const { isAuthenticated, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <ComunicadosProvider>
      <EventAlertsProvider>
        <MessagesProvider>
          <NoticiasProvider>
            <DeferredProviders>
              {children}
            </DeferredProviders>
          </NoticiasProvider>
        </MessagesProvider>
      </EventAlertsProvider>
    </ComunicadosProvider>
  )
}

/**
 * Public deep-links bypass the auth gate entirely. Detected synchronously
 * from the URL on first render — these routes don't depend on user state
 * or any data provider Tier 1/2.
 *   /verificar/doc/:hash  — Sprint 10/F7 portal público de documentos
 *   /verificar/:uuid      — verificação de certificado por QR
 */
function PublicRouteOrApp() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''

  const docMatch = path.match(/^\/verificar\/doc\/([a-fA-F0-9]{64})$/)
  if (docMatch) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <VerificarDocumentoPublicoPage hash={docMatch[1].toLowerCase()} />
      </Suspense>
    )
  }

  const certMatch = path.match(/^\/verificar\/([a-zA-Z0-9_-]+)$/i)
  if (certMatch) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <VerificarCertificadoPage certificadoId={certMatch[1]} />
      </Suspense>
    )
  }

  return (
    <AuthGatedProviders>
      <App />
    </AuthGatedProviders>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <UserProvider>
              {/* F2 Etapa A: BrowserRouter dá URL real ao App (useNavigate/
                  useLocation). As rotas públicas /verificar/* continuam
                  detectadas por regex em PublicRouteOrApp — só são alcançáveis
                  por load direto, nunca por navegação interna. */}
              <BrowserRouter>
                <PublicRouteOrApp />
              </BrowserRouter>
            </UserProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
