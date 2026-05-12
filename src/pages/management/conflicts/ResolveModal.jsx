/**
 * ResolveModal — Sprint 14b / F6.3 (+ Wave 2: merge manual interativo)
 *
 * Modal de resolução manual de conflito. Mostra preview side-by-side de payload
 * vs server_state, textarea de notas (>= 10 chars) e radio com 4 estratégias:
 *
 * - 'last_write_wins'   → resolveLastWriteWins(id, userInfo)
 *                         (notes registradas via resolveManual? não — botão LWW
 *                          tem note fixo; aqui o admin escolhe LWW mas pode
 *                          adicionar context via notes — usamos resolveManual
 *                          com status manual + notes do admin)
 * - 'keep_server'       → resolveManual(id, notes prefixadas, userInfo)
 *                         (não há endpoint específico; status fica
 *                          resolved_manual)
 * - 'register_only'     → resolveManual(id, notes, userInfo)
 *                         (apenas registra sem aplicar nem manter)
 * - 'merge-manual'      → resolveMerge(id, mergedPayload, userInfo)
 *                         (3-way merge: admin escolhe valores campo-a-campo via
 *                          DiffViewer interativo; status='resolved_merge_manual')
 *
 * Submit disabled até notes.trim().length >= 10 E radio selecionado.
 *
 * onSubmit assinatura (estendida em Wave 2):
 *   `(strategy, notes, mergedPayload?) => Promise<void>`
 *   `mergedPayload` é passado APENAS quando `strategy === 'merge-manual'`.
 */
import { useState } from 'react'
import { Modal } from '@/design-system'
import { AlertTriangle } from 'lucide-react'
import DiffViewer from '@/design-system/components/anest/DiffViewer'

const MIN_NOTES = 10
const MAX_NOTES = 500

const STRATEGIES = [
  {
    value: 'last_write_wins',
    label: 'Manter versao do usuario (LWW)',
    description:
      'A versao do payload original sera marcada como vencedora (last-write-wins).',
  },
  {
    value: 'keep_server',
    label: 'Manter versao do servidor',
    description:
      'O snapshot atual do servidor sera mantido. A op do usuario sera descartada.',
  },
  {
    value: 'register_only',
    label: 'Apenas registrar',
    description:
      'Apenas anota a resolucao no historico, sem indicar lado vencedor.',
  },
  {
    value: 'merge-manual',
    label: 'Merge manual',
    description:
      'Escolher valores por campo — combina sua versao e a do servidor em um payload final.',
  },
]

function jsonToLines(obj) {
  if (!obj || typeof obj !== 'object') return ['(vazio)']
  return Object.entries(obj).map(([k, v]) => {
    let display
    if (v === null) display = 'null'
    else if (typeof v === 'object') display = JSON.stringify(v)
    else display = String(v)
    return `${k}: ${display}`
  })
}

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object} props.conflict
 * @param {(strategy: 'last_write_wins' | 'keep_server' | 'register_only' | 'merge-manual', notes: string, mergedPayload?: Object) => Promise<void>} props.onSubmit
 */
export default function ResolveModal({ open, onClose, conflict, onSubmit }) {
  const [notes, setNotes] = useState('')
  const [strategy, setStrategy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Wave 2: payload merged proveniente do DiffViewer interativo.
  // Inicia com o payload original do user (default por linha = "minha versão"),
  // o que reflete o estado inicial dos radios. DiffViewer chama setMergedPayload
  // via onChange em cada mudança e na montagem.
  const [mergedPayload, setMergedPayload] = useState(null)

  const trimmed = notes.trim()
  const isNotesValid = trimmed.length >= MIN_NOTES && trimmed.length <= MAX_NOTES
  const canSubmit = isNotesValid && Boolean(strategy) && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      if (strategy === 'merge-manual') {
        // Fallback defensivo: se DiffViewer ainda não emitiu onChange (caso
        // extremo de allKeys=0), envia payload original do user.
        const payload = mergedPayload ?? conflict.payload ?? {}
        await onSubmit(strategy, trimmed, payload)
      } else {
        await onSubmit(strategy, trimmed)
      }
      // limpa estado local (modal fecha pelo caller via onClose)
      setNotes('')
      setStrategy('')
      setMergedPayload(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setNotes('')
    setStrategy('')
    setMergedPayload(null)
    onClose?.()
  }

  if (!conflict) return null

  const payloadLines = jsonToLines(conflict.payload)
  const serverLines = jsonToLines(conflict.serverState)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Resolver conflito"
      description={`${conflict.opString} — op ${conflict.opId}`}
      size="xl"
      closeOnOverlayClick={!submitting}
      closeOnEscape={!submitting}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white dark:text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {submitting ? 'Salvando…' : 'Salvar resolucao'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div>
            <span className="font-semibold">Usuario:</span>{' '}
            {conflict.userName} (<span className="font-mono">{conflict.userId}</span>)
          </div>
          <div>
            <span className="font-semibold">Op:</span>{' '}
            <span className="font-mono">{conflict.opString}</span>
          </div>
          <div>
            <span className="font-semibold">Criado em:</span>{' '}
            {conflict.createdAt
              ? new Date(conflict.createdAt).toLocaleString('pt-BR')
              : '-'}
          </div>
        </div>

        {/* Preview side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border">
              Sua versao (payload)
            </div>
            <pre className="px-3 py-2 text-xs text-foreground font-mono whitespace-pre-wrap break-all max-h-[280px] overflow-y-auto">
              {payloadLines.join('\n')}
            </pre>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border">
              Versao do servidor
            </div>
            <pre className="px-3 py-2 text-xs text-foreground font-mono whitespace-pre-wrap break-all max-h-[280px] overflow-y-auto">
              {conflict.serverState
                ? serverLines.join('\n')
                : '(sem snapshot do servidor)'}
            </pre>
          </div>
        </div>

        {/* DiffViewer — chave-a-chave.
            - Default (Sprint 16): accordion fechado para inspeção rápida.
            - merge-manual (Wave 2): expandido, radio group por linha; onChange
              alimenta `mergedPayload` que é enviado no submit. */}
        {strategy === 'merge-manual' ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="text-xs font-semibold text-foreground">
              Merge manual — escolha campo por campo
            </div>
            <DiffViewer
              left={conflict.payload}
              right={conflict.serverState ?? null}
              leftLabel="Sua versao"
              rightLabel="Servidor"
              collapsible={false}
              interactive
              onChange={setMergedPayload}
            />
          </div>
        ) : (
          <DiffViewer
            left={conflict.payload}
            right={conflict.serverState ?? null}
            leftLabel="Sua versao"
            rightLabel="Servidor"
            collapsible
          />
        )}

        {/* RadioGroup */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground mb-1">
            Estrategia de resolucao
          </legend>
          {STRATEGIES.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer min-h-[44px]"
            >
              <input
                type="radio"
                name="strategy"
                value={opt.value}
                checked={strategy === opt.value}
                onChange={(e) => setStrategy(e.target.value)}
                className="mt-0.5 flex-shrink-0 w-4 h-4 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </fieldset>

        {/* Notes textarea */}
        <div>
          <label
            htmlFor="resolve-notes"
            className="block text-sm font-semibold text-foreground mb-1"
          >
            Notas da resolucao{' '}
            <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <textarea
            id="resolve-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.substring(0, MAX_NOTES))}
            rows={4}
            placeholder="Descreva por que esta resolucao foi escolhida (minimo 10 caracteres)…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <span
              className={
                trimmed.length === 0
                  ? 'text-xs text-muted-foreground'
                  : isNotesValid
                  ? 'text-xs text-success'
                  : 'text-xs text-destructive flex items-center gap-1'
              }
            >
              {trimmed.length === 0 ? (
                `Minimo ${MIN_NOTES} caracteres`
              ) : !isNotesValid ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Minimo {MIN_NOTES} caracteres ({trimmed.length}/{MIN_NOTES})
                </>
              ) : (
                'OK'
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {trimmed.length}/{MAX_NOTES}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

