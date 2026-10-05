/**
 * Selo do HORÁRIO PENDENTE na cirurgia (dono 05/10, modelo A): diz o QUE falta —
 * "Falta início", "Falta término" ou "Sem horário". Badge do DS em OUTLINE vermelho com
 * o relógio de alerta: vermelho SÓLIDO já é Suspensa/Emergência, e outline não é usado
 * por nenhum outro estado do quadro. O fundo `bg-card` mantém o texto legível sobre a
 * tinta verde (iniciada) e azul (terminada) do card.
 */
import { ClockAlert } from 'lucide-react'
import { Badge } from '@/design-system'
import { ROTULO_FALTA } from '@/lib/escalaHorarioPendente'

export default function SeloHorarioPendente({ falta, className = '' }) {
  const rotulo = ROTULO_FALTA[falta]
  if (!rotulo) return null
  return (
    <Badge
      variant="destructive"
      badgeStyle="outline"
      className={`gap-1 bg-card text-category-red-fg ${className}`}
      title={`${rotulo}: aparece para todos até início e término serem preenchidos`}
    >
      <ClockAlert className="h-3 w-3 shrink-0" strokeWidth={2.4} aria-hidden="true" />
      {rotulo}
    </Badge>
  )
}
