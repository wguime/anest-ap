/**
 * CasoDetalheSheet — detalhe do caso COMPARTILHADO pelas abas Completa e Minhas.
 * Fonte única da UI de detalhe/status/troca (antes vivia só no BoardView e a aba
 * Minhas era um beco sem saída — pedido do dono 2026-07-21).
 *
 * Sincronizado AO VIVO: o caso exibido deriva de `escala.casos` (context) — updates
 * otimistas e realtime de outros usuários refletem com o sheet aberto.
 */
import { useMemo } from 'react'
import { UserCog } from 'lucide-react'
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { anestesistaDaSala, corConvenio, tipoBadge } from './utils'

const STATUS_BOTOES = [
  { valor: 'agendada', label: 'Agendada', ativo: 'default' },
  { valor: 'iniciada', label: 'Iniciada', ativo: 'success' },
  // Button não tem variant azul/roxo — tokens via className
  { valor: 'terminada', label: 'Terminada', ativo: 'default', cls: 'bg-info text-white hover:bg-info/90' },
  { valor: 'atrasada', label: 'Atrasada', ativo: 'warning', extra: true },
  { valor: 'suspensa', label: 'Suspensa', ativo: 'destructive', extra: true },
  { valor: 'passa_tarde', label: 'Passa para tarde', ativo: 'default', extra: true, cls: 'bg-category-purple text-white hover:bg-category-purple/90' },
]

export default function CasoDetalheSheet({ escala, caso, onClose, podeDefinirAnestesista, onDefinirAnestesista }) {
  const { setStatusCirurgia } = useEscalaCirurgicaActions()
  const isDemo = String(escala?.id).startsWith('demo-')

  // caso VIVO: busca a versão atual no estado (id); cai no prop p/ demo/sem id
  const vivo = useMemo(() => {
    if (!caso) return null
    return (caso.id && (escala?.casos || []).find((c) => c.id === caso.id)) || caso
  }, [escala, caso])

  if (!vivo) return null

  const aliasDet = anestesistaDaSala(escala?.casos, vivo.sala).alias || vivo.anestesista || ''
  const definivel = !!(podeDefinirAnestesista && onDefinirAnestesista && podeDefinirAnestesista(vivo.sala, aliasDet))
  // otimista no context (erro reverte + toast lá) — o sheet só dispara
  const mudarStatus = (status) => setStatusCirurgia(escala, vivo, status).catch(() => {})

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{vivo.sala} · {vivo.hora}</SheetTitle>
        </SheetHeader>
        <dl className="px-1 pb-2 space-y-2 text-sm">
          <Linha rotulo="Paciente" valor={vivo.pacienteIniciais} />
          <Linha rotulo="Idade" valor={vivo.idade} />
          <Linha rotulo="Procedimento" valor={vivo.procedimento} />
          <Linha rotulo="Cirurgião" valor={vivo.cirurgiao} />
          <Linha rotulo="Anestesista" valor={vivo.anestesista} destaque />
          <Linha rotulo="Convênio" valor={vivo.convenio && (
            <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${corConvenio(vivo.convenio)?.badge || ''}`}>
              {vivo.convenio}
            </span>
          )} />
          <Linha rotulo="Tempo estimado" valor={vivo.tempoEstimado} />
          {tipoBadge(vivo.tipo) && <Linha rotulo="Tipo" valor={tipoBadge(vivo.tipo).label} />}
        </dl>

        {definivel && (
          <div className="px-1 pb-2">
            {/* por CASO: caminho certo p/ blocos multi-anestesista (IOSC/Exames) —
                a troca de SALA inteira fica no header da Completa */}
            <Button size="sm" variant="outline" className="w-full"
              onClick={() => { onClose?.(); onDefinirAnestesista(vivo.sala, vivo) }}>
              <UserCog className="w-4 h-4" /> Definir anestesista deste caso
            </Button>
          </div>
        )}

        {/* status da cirurgia — qualquer clínico atualiza (RLS cobre) */}
        {!isDemo && vivo.id && (
          <div className="px-1 pb-4">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status da cirurgia
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_BOTOES.map((s) => {
                const atual = s.extra
                  ? vivo.statusExtra === s.valor
                  : (vivo.statusCirurgia || 'agendada') === s.valor
                // extras convivem com agendada/iniciada, nunca com terminada
                const bloqueado = s.extra && vivo.statusCirurgia === 'terminada'
                return (
                  <Button key={s.valor} size="sm"
                    disabled={bloqueado}
                    className={[
                      'h-auto min-h-[36px] w-full whitespace-normal px-1 py-1.5 leading-tight',
                      // inativo com cara de botão (borda+fundo) e grafia padrão (preta)
                      atual ? s.cls : 'border border-border-strong bg-card text-foreground',
                      bloqueado && 'opacity-40',
                    ].filter(Boolean).join(' ')}
                    variant={atual ? s.ativo : 'ghost'}
                    aria-pressed={atual}
                    onClick={() => mudarStatus(s.valor)}>
                    {s.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Linha({ rotulo, valor, destaque }) {
  if (!valor) return null
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? 'font-semibold text-foreground' : 'text-foreground/90'}>{valor}</dd>
    </div>
  )
}
