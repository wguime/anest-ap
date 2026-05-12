import { useState } from 'react'
import { Loader2, Copy, Check, Key, AlertTriangle } from 'lucide-react'
import { Modal, Select, useToast } from '@/design-system'

/**
 * GenerateTokenModal — Sprint 14c / O2-5 (B4)
 *
 * Modal de 2 etapas:
 *   1. INPUT  — usuário digita o nome do token (>=3 chars) e (futuro) scope.
 *               Submit chama service.generateToken → edge generate-api-token.
 *   2. REVEAL — token plain é exibido UMA ÚNICA VEZ com botão "Copiar" e
 *               aviso "este token não será mostrado novamente".
 *
 * Após o reveal, o botão de fechar volta para a lista (chama onCreated).
 */
function GenerateTokenModal({ open, onClose, onGenerate, onCreated }) {
  const { toast } = useToast()
  const [step, setStep] = useState('input') // 'input' | 'reveal'
  const [name, setName] = useState('')
  const [scope, setScope] = useState('read')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [generated, setGenerated] = useState(null) // { token, id, name, scope, created_at }
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setStep('input')
    setName('')
    setScope('read')
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

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setErrorMsg('')
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setErrorMsg('Nome precisa ter no mínimo 3 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      const result = await onGenerate({ name: trimmed, scope })
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

  const scopeOptions = [
    { value: 'read', label: 'read (leitura)' },
  ]

  return (
    <Modal
      open={open}
      onClose={step === 'reveal' ? handleFinish : handleClose}
      title={step === 'input' ? 'Gerar token API' : 'Token gerado'}
      description={
        step === 'input'
          ? 'Tokens permitem integrações externas ler documentos via API pública v1 (read-only).'
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

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Escopo
            </label>
            <Select
              value={scope}
              onChange={setScope}
              options={scopeOptions}
              disabled
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              v1 suporta apenas <code>read</code>. Mais escopos virão em versões futuras.
            </p>
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
              disabled={submitting || name.trim().length < 3}
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
            <div className="flex gap-2">
              <dt className="font-medium text-foreground">Escopo:</dt>
              <dd>{generated?.scope}</dd>
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
