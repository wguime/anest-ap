/**
 * AuditChecklistItem - Item de checklist para execucao de auditoria interativa
 */
import { useState } from 'react'
import { Textarea } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { MessageSquare } from 'lucide-react'

const BUTTONS = [
  { key: 'C', label: 'C', activeClass: 'bg-success border-success text-white' },
  { key: 'NC', label: 'NC', activeClass: 'bg-destructive border-destructive text-destructive-foreground' },
  { key: 'NA', label: 'NA', activeClass: 'bg-muted border-muted-foreground text-foreground' },
]

export default function AuditChecklistItem({ item, resposta, onRespostaChange, index }) {
  const [showObs, setShowObs] = useState(!!resposta?.observacao)

  const handleButtonClick = (key) => {
    const newResposta = key === resposta?.resposta ? null : key
    onRespostaChange(item.id, {
      ...resposta,
      resposta: newResposta,
    })
    if (newResposta && !showObs) {
      setShowObs(true)
    }
  }

  const handleObsChange = (e) => {
    onRespostaChange(item.id, {
      ...resposta,
      observacao: e.target.value,
    })
  }

  return (
    <div className="rounded-[20px] border border-border-strong bg-card">
      <div className="p-4">
        {/* Item e descrição */}
        <div className="mb-3">
          {index != null && (
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Item {index}
            </span>
          )}
          <p className="text-sm font-semibold text-foreground dark:text-white leading-snug mt-0.5">
            {item.label}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Resposta C / NC / NA */}
        <div className="flex items-center gap-2">
          {BUTTONS.map((btn) => {
            const isActive = resposta?.resposta === btn.key
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => handleButtonClick(btn.key)}
                className={cn(
                  'flex-1 h-9 rounded-lg text-xs font-semibold border-2 transition-all active:scale-95',
                  isActive ? btn.activeClass : 'bg-transparent border-border text-muted-foreground hover:border-muted-foreground'
                )}
              >
                {btn.label}
              </button>
            )
          })}

          {/* Observation toggle */}
          <button
            type="button"
            onClick={() => setShowObs((prev) => !prev)}
            className={cn(
              'h-9 w-9 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all',
              showObs || resposta?.observacao
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
            aria-label="Adicionar observacao"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Observation textarea */}
        {showObs && (
          <div className="mt-3">
            <Textarea
              placeholder="Observacao (opcional)..."
              value={resposta?.observacao || ''}
              onChange={handleObsChange}
              className="text-sm min-h-[60px]"
            />
          </div>
        )}
      </div>
    </div>
  )
}
