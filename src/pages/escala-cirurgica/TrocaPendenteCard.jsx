/**
 * TrocaPendenteCard — troca de sala pendente exibida no topo da sala (aba Completa).
 * O alvo (uid_b) ou coordenador aceita/recusa; o solicitante (uid_a) cancela.
 */
import { ArrowLeftRight } from 'lucide-react'
import { Badge, Button } from '@/design-system'

export default function TrocaPendenteCard({ troca, meuUid, podeGerenciar, onAceitar, onRecusar, onCancelar }) {
  const souAlvo = meuUid === troca.uidB
  const souSolicitante = meuUid === troca.uidA

  return (
    <div className="rounded-xl border border-warning/50 bg-warning/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="warning" badgeStyle="subtle">Troca pendente</Badge>
        <span className="font-medium">
          {troca.aliasA} <ArrowLeftRight className="inline w-3 h-3" /> {troca.aliasB}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {troca.salaA} ↔ {troca.salaB}{troca.motivo ? ` · ${troca.motivo}` : ''}
      </p>
      <div className="flex gap-2">
        {(souAlvo || podeGerenciar) && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onRecusar?.(troca)} className="flex-1">Recusar</Button>
            <Button size="sm" onClick={() => onAceitar?.(troca)} className="flex-1">Aceitar</Button>
          </>
        )}
        {souSolicitante && !souAlvo && !podeGerenciar && (
          <Button size="sm" variant="ghost" onClick={() => onCancelar?.(troca)} className="flex-1">Cancelar solicitação</Button>
        )}
      </div>
    </div>
  )
}
