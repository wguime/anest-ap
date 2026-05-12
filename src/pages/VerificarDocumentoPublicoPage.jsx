// Sprint 10 / F7 — Portal público /verificar/doc/:hash.
// Verifica integridade de documento institucional pelo SHA-256.
// Sem autenticação. Layout vertical centralizado, mobile-first (mockup
// aprovado pelo user 2026-05-09).
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Loader2, Copy, Check } from 'lucide-react'
import { Card, CardContent, Badge, Button } from '@/design-system'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function truncateHash(hash) {
  if (!hash || hash.length < 20) return hash || ''
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

export default function VerificarDocumentoPublicoPage({ hash }) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [hashExpanded, setHashExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!hash) {
      setState({ loading: false, data: null, error: 'missing_hash' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/verify-doc-public?hash=${encodeURIComponent(hash)}`,
          { method: 'GET' }
        )
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && body?.ok) {
          setState({ loading: false, data: body, error: null })
        } else {
          setState({ loading: false, data: null, error: body?.reason || `http_${res.status}` })
        }
      } catch (_err) {
        if (cancelled) return
        setState({ loading: false, data: null, error: 'network_error' })
      }
    })()
    return () => { cancelled = true }
  }, [hash])

  const copyHash = async () => {
    if (!state.data?.signatureHash) return
    try {
      await navigator.clipboard.writeText(state.data.signatureHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header verde institucional */}
      <header className="bg-primary text-primary-foreground px-4 py-4 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="font-bold text-lg tracking-tight">ANEST</div>
          <div className="text-sm opacity-90">Verificar documento</div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="max-w-md mx-auto">
          {state.loading && <LoadingCard />}
          {!state.loading && state.error && <ErrorCard reason={state.error} />}
          {!state.loading && state.data && (
            <ValidCard
              data={state.data}
              hashExpanded={hashExpanded}
              setHashExpanded={setHashExpanded}
              copyHash={copyHash}
              copied={copied}
            />
          )}

          <div className="mt-6 flex justify-center">
            <a href="/" className="inline-block">
              <Button variant="outline">Voltar para o app</Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando documento…</p>
      </CardContent>
    </Card>
  )
}

function ErrorCard({ reason }) {
  const config = {
    not_found: {
      icon: XCircle,
      iconClass: 'text-destructive',
      title: 'Documento não encontrado',
      message: 'Nenhum documento público corresponde a esta assinatura.',
    },
    invalid_hash: {
      icon: AlertTriangle,
      iconClass: 'text-warning',
      title: 'Hash inválido',
      message: 'O formato da assinatura não é válido (esperado SHA-256, 64 caracteres hex).',
    },
    rate_limited: {
      icon: AlertTriangle,
      iconClass: 'text-warning',
      title: 'Muitas tentativas',
      message: 'Você fez muitas verificações em pouco tempo. Tente novamente em 1 minuto.',
    },
    missing_hash: {
      icon: AlertTriangle,
      iconClass: 'text-warning',
      title: 'Hash ausente',
      message: 'Esta página espera um hash de documento na URL.',
    },
    network_error: {
      icon: AlertTriangle,
      iconClass: 'text-warning',
      title: 'Sem conexão',
      message: 'Não foi possível contatar o servidor. Verifique sua conexão e tente novamente.',
    },
  }
  const c = config[reason] || {
    icon: XCircle,
    iconClass: 'text-destructive',
    title: 'Erro',
    message: 'Não foi possível verificar este documento.',
  }
  const Icon = c.icon

  return (
    <Card>
      <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
        <Icon className={`w-12 h-12 ${c.iconClass}`} />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{c.title}</h2>
          <p className="text-sm text-muted-foreground mt-2">{c.message}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ValidCard({ data, hashExpanded, setHashExpanded, copyHash, copied }) {
  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <CheckCircle className="w-12 h-12 text-success" />
          <Badge variant="success" className="text-base px-4 py-1.5">
            Documento válido
          </Badge>
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Código" value={data.codigo} />
          <Row label="Título" value={data.titulo} />
          <Row label="Versão" value={String(data.versao)} />
          <Row label="Assinado em" value={formatDate(data.decidedAt)} />
        </dl>

        <div className="border-t border-border my-4" aria-hidden="true" />

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Hash SHA-256
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono break-all flex-1 min-w-0">
              {hashExpanded ? data.signatureHash : truncateHash(data.signatureHash)}
            </code>
            <button
              type="button"
              onClick={() => setHashExpanded((v) => !v)}
              className="text-xs text-primary hover:underline shrink-0"
              aria-label={hashExpanded ? 'Recolher hash' : 'Expandir hash'}
            >
              {hashExpanded ? 'recolher' : 'expandir'}
            </button>
            <button
              type="button"
              onClick={copyHash}
              className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1"
              aria-label="Copiar hash"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'copiado' : 'copiar'}
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Algoritmo: {data.signatureAlgo || 'SHA-256'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 items-baseline">
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-foreground text-right">{value || '—'}</dd>
    </div>
  )
}
