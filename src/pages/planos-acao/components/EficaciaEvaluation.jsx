/**
 * EficaciaEvaluation - Componente de avaliacao de eficacia de plano de acao
 */
import { useState } from 'react'
import { Card, Badge, Button, Textarea, Select } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { EFICACIA_OPTIONS } from '@/data/planosAcaoConfig'

const EFICACIA_ICONS = {
  eficaz: CheckCircle2,
  parcialmente_eficaz: AlertTriangle,
  ineficaz: XCircle,
}

export default function EficaciaEvaluation({ currentEficacia, onSubmit, disabled }) {
  const [eficacia, setEficacia] = useState(currentEficacia || '')
  const [justificativa, setJustificativa] = useState('')

  const handleSubmit = () => {
    if (!eficacia) return
    onSubmit({ eficacia, justificativa })
  }

  const eficaciaOptions = Object.entries(EFICACIA_OPTIONS).map(([key, config]) => ({
    value: key,
    label: config.label,
  }))

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Avaliacao de Eficacia
      </h3>

      {currentEficacia ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = EFICACIA_ICONS[currentEficacia] || CheckCircle2
              const config = EFICACIA_OPTIONS[currentEficacia]
              return (
                <>
                  <Icon className="w-5 h-5" />
                  <Badge variant={config?.variant || 'secondary'} badgeStyle="solid">
                    {config?.label || currentEficacia}
                  </Badge>
                </>
              )
            })()}
          </div>
          <p className="text-xs text-muted-foreground">
            {EFICACIA_OPTIONS[currentEficacia]?.description}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Avalie a eficacia das acoes corretivas implementadas.
          </p>

          <Select
            value={eficacia}
            onChange={(e) => setEficacia(e.target.value)}
            disabled={disabled}
          >
            <option value="">Selecione a avaliacao...</option>
            {eficaciaOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {eficacia && EFICACIA_OPTIONS[eficacia] && (
            <p className="text-xs text-muted-foreground italic">
              {EFICACIA_OPTIONS[eficacia].description}
            </p>
          )}

          <Textarea
            placeholder="Justificativa da avaliacao (opcional)..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            disabled={disabled}
          />

          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!eficacia || disabled}
            className="w-full"
          >
            Registrar Avaliacao
          </Button>
        </div>
      )}
    </Card>
  )
}
