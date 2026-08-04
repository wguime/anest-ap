/**
 * Log de movimentações — quem marcou/desmarcou o quê e quando (gestão de
 * escalas, pedido do dono 04/08). Vive no fim da aba Mapa, que já é a
 * superfície de gestão. Append-only: o histórico não é editável.
 */
import { useState } from 'react'
import { Card, Badge } from '@/design-system'
import { History } from 'lucide-react'
import { fmtBr } from './calendarioOcupacao'

const PAGINA = 20

const fmtQuando = (iso) => {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes} ${hh}:${mm}`
}

export default function MovimentacoesLog({ movimentacoes = [], socios = [], usersList = [] }) {
  const [expandido, setExpandido] = useState(false)
  if (!movimentacoes.length) return null

  const nomeCompleto = new Map(socios.map((s) => [s.nome, s.nomeCompleto || s.nome]))
  const autorPorUid = new Map(usersList.map((u) => [u.id, u.nome || u.displayName || u.email]))

  // Mais recentes primeiro (o fetch vem cronológico p/ o replay)
  const lista = [...movimentacoes].reverse()
  const visiveis = expandido ? lista : lista.slice(0, PAGINA)

  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-2">
        <History className="w-3.5 h-3.5" aria-hidden="true" /> Movimentações ({movimentacoes.length})
      </p>
      <ul className="divide-y divide-border">
        {visiveis.map((m) => {
          const marcou = m.acao === 'marcar'
          const autor = autorPorUid.get(m.userId)
          return (
            <li key={m.id} className="py-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] leading-snug">
                  <span className="font-semibold text-foreground">{nomeCompleto.get(m.nome) || m.nome}</span>
                  <span className="text-muted-foreground">
                    {' '}{marcou ? 'marcou' : 'desmarcou'} {fmtBr(m.data)}
                    {m.origemDia === 'pegaplantao' ? ' (dia do Pega Plantão)' : ''}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtQuando(m.criadoEm)}
                  {autor && autor !== (nomeCompleto.get(m.nome) || m.nome) ? ` · por ${autor}` : ''}
                </p>
              </div>
              {m.custoDias > 1 && (
                <Badge variant="warning" badgeStyle="subtle" className="shrink-0">
                  {m.custoDias} dias
                </Badge>
              )}
            </li>
          )
        })}
      </ul>
      {lista.length > PAGINA && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-2 min-h-[44px] w-full text-[13px] font-medium text-primary"
        >
          {expandido ? 'Mostrar menos' : `Mostrar todas (${lista.length})`}
        </button>
      )}
    </Card>
  )
}
