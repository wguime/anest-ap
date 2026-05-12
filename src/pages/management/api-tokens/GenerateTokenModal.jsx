import { useState } from 'react'
import { Loader2, Copy, Check, Key, AlertTriangle } from 'lucide-react'
import { Modal, Checkbox, useToast } from '@/design-system'

/**
 * GenerateTokenModal — Sprint 14c / O2-5 (B4) + Sprint 16 (scopes granular)
 *
 * Modal de 2 etapas:
 *   1. INPUT  — usuário digita o nome do token (>=3 chars) e seleciona scopes
 *               (>=1 dos 3 da whitelist). Submit chama service.generateToken
 *               → edge generate-api-token.
 *   2. REVEAL — token plain é exibido UMA ÚNICA VEZ com botão "Copiar" e
 *               aviso "este token não será mostrado novamente".
 *
 * Após o reveal, o botão de fechar volta para a lista (chama onCreated).
 *
 * Sprint 16 — scopes granulares:
 *   3 checkboxes (read:docs / read:planos-acao / read:comunicados). Default =
 *   todas marcadas (≡ legacy scope='read'). Submit fica disabled se 0
 *   marcadas + helper text. Service valida client-side antes de hit no DB.
 */

const SCOPE_OPTIONS = [
  { value: 'read:docs', label: 'Documentos', code: 'read:docs' },
  { value: 'read:planos-acao', label: 'Planos de Ação', code: 'read:planos-acao' },
  { value: 'read:comunicados', label: 'Comunicados', code: 'read:comunicados' },
]

function GenerateTokenModal({ open, onClose, onGenerate, onCreated }) {
  const { toast } = useToast()
  const [step, setStep] = useState('input') // 'input' | 'reveal'
  const [name, setName] = useState('')
  // Default: 3 scopes marcadas (back-compat com legacy scope='read')
  const [scopes, setScopes] = useState(() => SCOPE_OPTIONS.map((s) => s.value))
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [generated, setGenerated] = useState(null) // { token, id, name, scope, scopes, created_at }
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setStep('input')
    setName('')
    setScopes(SCOPE_OPTIONS.map((s) => s.value))
    setSubmitting(false)
    setErrorMsg('')
    setGenerated(null)
    setCopied(false)
  }

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const handleFinish = () => {
    reset()
    onCreated?.()
  }

  const toggleScope = (scopeValue) => (checked) => {
    setScopes((prev) => {
      if (checked) {
        // Mantém ordem canônica para snapshot estável
        const next = new Set([...prev, scopeValue])
        return SCOPE_OPTIONS.map((s) => s.value).filter((v) => next.has(v))
      }
      return prev.filter((v) => v !== scopeValue)
    })
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setErrorMsg('')
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setErrorMsg('Nome precisa ter no mínimo 3 caracteres.')
      return
    }
    if (scopes.length === 0) {
      setErrorMsg('Selecione ao menos 1 permissão.')
      return
    }
    setSubmitting(true)
    try {
      const result = await onGenerate({ name: trimmed, scope: 'read', scopes })
      setGenerated(result)
      setStep('reveal')
    } catch (err) {
      const msg = err?.message || 'Erro ao gerar token.'
      setErrorMsg(msg)
      toast({ title: 'Falha ao gerar token', description: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!generated?.token) return
    try {
      await navigator.clipboard.writeText(generated.token)
      setCopied(true)
      toast({ title: 'Token copiado', variant: 'success' })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast({ title: 'Não foi possível copiar — selecione manualmente', variant: 'warning' })
    }
  }

  const submitDisabled = submitting || name.trim().length < 3 || scopes.length === 0

  return (
    <Modal
      open={open}
      onClose={step === 'reveal' ? handleFinish : handleClose}
      title={step === 'input' ? 'Gerar token API' : 'Token gerado'}
      description={
        step === 'input'
          ? 'Tokens permitem integrações externas ler dados via API pública v1 (read-only).'
          : undefined
      }
      size="md"
      closeOnOverlayClick={step !== 'reveal'}
      closeOnEscape={step !== 'reveal'}
    >
      {step === 'input' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="api-token-name"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Nome do token
            </label>
            <input
              id="api-token-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Integração ERP Hospital X"
              maxLength={80}
              className="w-full px-4 py-3 border border-border rounded-xl bg-white dark:bg-muted text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Use um nome descritivo (mínimo 3 caracteres). Será exibido na lista de tokens.
            </p>
          </div>

          <div data-testid="scopes-group">
            <fieldset className="border-0 p-0 m-0">
              <legend className="block text-xs font-medium text-muted-foreground mb-1.5">
                Permissões (scopes)
              </legend>
              <div className="space-y-1">
                {SCOPE_OPTIONS.map((opt) => (
                  <Checkbox
                    key={opt.value}
                    id={`scope-${opt.value}`}
                    compact
                    size="sm"
                    checked={scopes.includes(opt.value)}
                    onChange={toggleScope(opt.value)}
                    label={
                      <span className="inline-flex items-baseline gap-1.5">
                        <span>{opt.label}</span>
                        <code className="text-[11px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          {opt.code}
                        </code>
                      </span>
                    }
                  />
                ))}
              </div>
              {scopes.length === 0 ? (
                <p
                  data-testid="scopes-helper"
                  className="mt-1.5 text-[11px] text-destructive"
                >
                  Selecione ao menos 1 permissão.
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Cada permissão libera um endpoint da API v1 separadamente. Padrão = todas.
                </p>
              )}
            </fieldset>
          </div>

          {errorMsg ? (
            <div
              role="alert"
              className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
            >
              {errorMsg}
            </div>
          ) : null}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" /> Gerar token
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-xs bg-warning/10 border border-warning/40 text-warning-foreground rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-foreground">
                Este token não será mostrado novamente.
              </p>
              <p className="text-muted-foreground">
                Copie agora e armazene em um cofre seguro. Após fechar, só o hash fica no banco —
                não há reveal subsequente.
              </p>
            </div>
          </div>

          <div className="bg-warning/5 border border-warning/40 rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Token plain (uso único)
            </p>
            <code
              data-testid="generated-token-value"
              className="block break-all font-mono text-sm bg-card border border-border rounded-md px-3 py-2 text-foreground select-all"
            >
              {generated?.token}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar token'}
            </button>
          </div>

          <dl className="text-xs space-y-1 text-muted-foreground">
            <div className="flex gap-2">
              <dt className="font-medium text-foreground">Nome:</dt>
              <dd>{generated?.name}</dd>
            </div>
            <div className="flex gap-2 items-start">
              <dt className="font-medium text-foreground shrink-0">Permissões:</dt>
              <dd className="flex flex-wrap gap-1">
                {(generated?.scopes && generated.scopes.length > 0
                  ? generated.scopes
                  : [generated?.scope].filter(Boolean)
                ).map((s) => (
                  <code
                    key={s}
                    className="text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border"
                  >
                    {s}
                  </code>
                ))}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
            >
              Fechar e ir para a lista
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default GenerateTokenModal
