import { useState, useCallback } from 'react'
import { Input, Badge, Button, useToast } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { Check, Loader2 } from 'lucide-react'
import { formatValor } from '@/data/indicadores-2025'

const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * KpiEntryRow - Row component for KPI data entry grid
 *
 * @param {Object} props
 * @param {Object} props.indicador - Indicator object with mesesDetalhados
 * @param {number} props.mes - Month index (1-12)
 * @param {Function} props.onSave - Callback (indicadorId, mes, data) => Promise
 * @param {Function} props.onValidate - Callback (dadoId, validadorInfo) => Promise
 * @param {boolean} props.disabled
 * @param {boolean} props.isAdmin
 */
export default function KpiEntryRow({ indicador, mes, onSave, onValidate, disabled, isAdmin }) {
  const { toast } = useToast()
  const mesIdx = mes - 1
  const detalhe = indicador.mesesDetalhados?.[mesIdx] || {}

  const [valor, setValor] = useState(detalhe.valor != null ? String(detalhe.valor) : '')
  const [numerador, setNumerador] = useState(detalhe.numerador != null ? String(detalhe.numerador) : '')
  const [denominador, setDenominador] = useState(detalhe.denominador != null ? String(detalhe.denominador) : '')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)

  const handleSave = useCallback(async () => {
    if (!valor.trim()) return
    setSaving(true)
    try {
      await onSave?.(indicador.id, mes, {
        valor: parseFloat(valor),
        numerador: numerador ? parseInt(numerador, 10) : null,
        denominador: denominador ? parseInt(denominador, 10) : null,
      })
    } catch (e) {
      console.error('[KpiEntryRow] save error:', e)
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [indicador.id, mes, valor, numerador, denominador, onSave, toast])

  const handleValidate = useCallback(async () => {
    if (!detalhe.dadoId) return
    setValidating(true)
    try {
      await onValidate?.(detalhe.dadoId)
    } catch (e) {
      console.error('[KpiEntryRow] validate error:', e)
      toast({ title: 'Erro ao validar', description: e.message, variant: 'destructive' })
    } finally {
      setValidating(false)
    }
  }, [detalhe.dadoId, onValidate, toast])

  const statusVariant = indicador.statusAtual?.variant || 'secondary'
  const hasData = detalhe.hasData

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1A2420] rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] p-3',
        'transition-colors',
        hasData && 'border-l-4 border-l-[#006837] dark:border-l-[#2ECC71]'
      )}
    >
      {/* Indicator name + status badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-[#004225] dark:text-white truncate flex-1">
          {indicador.titulo}
        </h4>
        <div className="flex items-center gap-1.5 shrink-0">
          {detalhe.validado ? (
            <Badge variant="success" badgeStyle="subtle">Validado</Badge>
          ) : hasData ? (
            <Badge variant="warning" badgeStyle="subtle">Pendente</Badge>
          ) : (
            <Badge variant="secondary" badgeStyle="subtle">Sem dados</Badge>
          )}
        </div>
      </div>

      {/* Meta info line */}
      <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-2">
        Meta: {indicador.metaLabel} | Unidade: {indicador.unidade || 'Absoluto'}
        {detalhe.valor != null && (
          <span className="ml-2 font-medium text-[#004225] dark:text-[#2ECC71]">
            Atual: {formatValor(detalhe.valor, indicador.unidade)}
          </span>
        )}
      </p>

      {/* Input fields row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Input
            type="number"
            label="Valor"
            placeholder={indicador.unidade === '%' ? '0.0' : '0'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={disabled || detalhe.validado}
            className="[&_[data-slot=input-control]]:min-h-[36px] [&_[data-slot=input-control]]:py-2 [&_[data-slot=input-control]]:px-3 [&_[data-slot=input-control]]:rounded-xl"
          />
        </div>
        <div className="w-20">
          <Input
            type="number"
            label="Num."
            placeholder="0"
            value={numerador}
            onChange={(e) => setNumerador(e.target.value)}
            disabled={disabled || detalhe.validado}
            className="[&_[data-slot=input-control]]:min-h-[36px] [&_[data-slot=input-control]]:py-2 [&_[data-slot=input-control]]:px-3 [&_[data-slot=input-control]]:rounded-xl"
          />
        </div>
        <div className="w-20">
          <Input
            type="number"
            label="Den."
            placeholder="0"
            value={denominador}
            onChange={(e) => setDenominador(e.target.value)}
            disabled={disabled || detalhe.validado}
            className="[&_[data-slot=input-control]]:min-h-[36px] [&_[data-slot=input-control]]:py-2 [&_[data-slot=input-control]]:px-3 [&_[data-slot=input-control]]:rounded-xl"
          />
        </div>

        {/* Save button */}
        <Button
          size="sm"
          variant="default"
          disabled={disabled || saving || !valor.trim() || detalhe.validado}
          onClick={handleSave}
          className="shrink-0 h-[36px] min-h-[36px] px-3"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>

        {/* Validate button (admin only, only when data exists and not yet validated) */}
        {isAdmin && hasData && !detalhe.validado && (
          <Button
            size="sm"
            variant="secondary"
            disabled={validating}
            onClick={handleValidate}
            className="shrink-0 h-[36px] min-h-[36px] px-3"
          >
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {/* Validation info */}
      {detalhe.validado && detalhe.validadoPor && (
        <p className="text-xs text-[#059669] dark:text-[#2ECC71] mt-2">
          Validado por {detalhe.validadoPor}
          {detalhe.validadoEm && ` em ${new Date(detalhe.validadoEm).toLocaleDateString('pt-BR')}`}
        </p>
      )}
    </div>
  )
}
