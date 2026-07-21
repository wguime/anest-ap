/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Stethoscope, Timer, ArrowLeftRight, Plus } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, Button, EmptyState,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { casosResolvidos, agruparPorSala, tipoBadge, corConvenio, normNome, filtrarPorTurno, compararSalas, anestesistaDaSala } from './utils'
import TrocaSalaSheet from './TrocaSalaSheet'
import TrocaPendenteCard from './TrocaPendenteCard'
import AddCasoSheet from './AddCasoSheet'

// Status em DOIS eixos (decisão do dono 2026-07-21):
// PRINCIPAL (exclusivo, pinta o card): agendada → Iniciada VERDE → Terminada AZUL.
const STATUS_CIRURGIA = {
  iniciada: { label: 'Iniciada', variant: 'success', card: 'border-success bg-success/25' },
  terminada: { label: 'Terminada', variant: 'info', card: 'border-info bg-info/15 dark:bg-info/25' },
}
// EXTRA (badge que convive com agendada/iniciada; terminada limpa e bloqueia):
const STATUS_EXTRA = {
  atrasada: { label: 'Atrasada', variant: 'warning' },
  suspensa: { label: 'Suspensa', variant: 'destructive' },
  passa_tarde: { label: 'Passa para tarde', variant: 'default', badgeClass: 'border-transparent bg-category-purple text-white' },
}
// dados/demos antigos ainda podem trazer o extra no campo principal
const extraDe = (caso) => STATUS_EXTRA[caso.statusExtra] || STATUS_EXTRA[caso.statusCirurgia] || null

function CasoCard({ caso, destaque, onClick }) {
  const tb = tipoBadge(caso.tipo)
  const st = STATUS_CIRURGIA[caso.statusCirurgia]
  const ex = extraDe(caso)
  const rotulo = ['Detalhes do caso', caso.hora, caso.pacienteIniciais, caso.procedimento]
    .filter(Boolean).join(', ')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={[
        'w-full text-left rounded-xl border p-3 min-h-[44px] transition-colors',
        'active:bg-muted/60 hover:bg-muted/40',
        st?.card ? st.card : destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
        // convênio identifica só pelo SELO (stripe lateral removida a pedido do dono 2026-07-21)
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Zona 1 — quando/quem: hora fixa à esquerda, paciente+idade, badges de tipo/status */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {caso.hora && (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {caso.hora}
              </span>
            )}
            {caso.pacienteIniciais && (
              <span className="max-w-[8rem] truncate font-semibold text-foreground" title={caso.pacienteIniciais}>
                {caso.pacienteIniciais}
              </span>
            )}
            {caso.idade && <span className="text-muted-foreground">{caso.idade}</span>}
            {tb && <Badge variant={tb.variant} badgeStyle={tb.style}>{tb.label}</Badge>}
            {st && <Badge variant={st.variant}>{st.label}</Badge>}
            {ex && <Badge variant={ex.variant} className={ex.badgeClass}>{ex.label}</Badge>}
          </div>
          {/* Zona 2 — procedimento */}
          {caso.procedimento && (
            <p className="mt-1 truncate text-sm text-foreground/90" title={caso.procedimento}>{caso.procedimento}</p>
          )}
          {/* Zona 3 — cirurgião em destaque (o anestesista já está no título da sala) */}
          {caso.cirurgiao && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Stethoscope className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" title={caso.cirurgiao}>{caso.cirurgiao}</span>
            </p>
          )}
          {/* Zona 4 — rodapé: tempo à esquerda, convênio no canto inferior direito.
              Selo TONAL (tinta translúcida) — harmoniza com a cor vigente do card.
              -mr-6 estende o rodapé sob a coluna da seta → selo cola na borda direita. */}
          {(caso.tempoEstimado || caso.convenio) && (
            <div className="-mr-6 mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {caso.tempoEstimado && (<><Timer className="w-3 h-3" /> {caso.tempoEstimado}</>)}
              </span>
              {caso.convenio && (
                <span className="max-w-[160px] truncate rounded-md border border-transparent bg-black/10 px-1.5 py-0.5 font-medium text-foreground/80 dark:bg-white/15 dark:text-foreground/90"
                  title={caso.convenio}>
                  {caso.convenio}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  )
}

export default function BoardView({ escala, meuAlias, meuUid, turno }) {
  const { user } = useUser()
  const { trocasPendentes, aceitarTroca, recusarTroca, cancelarTroca } = useEscalaCirurgica()
  const { setStatusCirurgia } = useEscalaCirurgicaActions()
  const [detalhe, setDetalhe] = useState(null)
  const [trocaSala, setTrocaSala] = useState(null)
  const [addCaso, setAddCaso] = useState(false)
  const casos = useMemo(() => filtrarPorTurno(casosResolvidos(escala), turno), [escala, turno])
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  const alvo = normNome(meuAlias)
  const ehMeu = (c) => (c.anestesistaUserId ? c.anestesistaUserId === meuUid : alvo && normNome(c.anestesista) === alvo)

  const isDemo = String(escala?.id).startsWith('demo-')
  const role = (user?.role || '').toLowerCase()
  const podeGerenciar = !!(user?.isAdmin || role === 'secretaria')
  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes(role))
  const userInfo = { userId: meuUid }
  const trocasDaSala = (sala) => (trocasPendentes || []).filter((t) => t.salaA === sala || t.salaB === sala)
  // Identidade com fallback por apelido: escala real pode vir sem uid nos casos
  // (secretária não atribuiu logins) — a resolução final acontece na TrocaSalaSheet.
  const souDaSala = (sala) => {
    const { uid, alias } = anestesistaDaSala(escala?.casos, sala)
    if (uid) return uid === meuUid
    const primeiro = (escala?.casos || []).find((c) => c.sala === sala && c.anestesista)
    return !!(alvo && primeiro && normNome(primeiro.anestesista) === alvo) || !!(alias && alvo && normNome(alias) === alvo)
  }
  const podeTrocarSala = (sala, aliasSala) => !isDemo && !!aliasSala && (podeGerenciar || souDaSala(sala))

  const mudarStatus = async (status) => {
    if (!detalhe) return
    await setStatusCirurgia(escala, detalhe, status)
    // espelha a regra da RPC: extras alternam; terminada limpa o extra
    if (STATUS_EXTRA[status]) {
      setDetalhe({ ...detalhe, statusExtra: detalhe.statusExtra === status ? null : status })
    } else {
      setDetalhe({ ...detalhe, statusCirurgia: status, ...(status === 'terminada' && { statusExtra: null }) })
    }
  }

  if (!escala || !escala.casos?.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Sem escala publicada"
        description="A escala deste hospital ainda não foi importada para esta data."
      />
    )
  }
  if (!casos.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Nenhum caso neste turno"
        description="Não há casos no turno selecionado. Troque para o outro turno."
      />
    )
  }

  const salas = [...grupos.keys()].sort(compararSalas(escala.hospital))

  return (
    <>
      {canEdit && !isDemo && (
        <Button size="sm" variant="outline" onClick={() => setAddCaso(true)} className="mb-2 w-full">
          <Plus className="w-4 h-4" /> Adicionar caso (urgência/encaixe)
        </Button>
      )}
      <Accordion type="multiple" defaultValue={salas} className="space-y-2">
        {salas.map((sala) => {
          const lista = grupos.get(sala)
          const trocas = trocasDaSala(sala)
          // p/ exibição vale o apelido resolvido mesmo sem uid (demo/legado);
          // a resolução de uid p/ TROCA acontece na sheet (dicionário + backfill)
          const aliasSala = anestesistaDaSala(escala?.casos, sala).alias
            || lista.find((c) => c.anestesista)?.anestesista || ''
          const trocavel = podeTrocarSala(sala, aliasSala)
          return (
            <AccordionItem key={sala} value={sala} className="rounded-xl border border-border bg-card">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele) */}
              <AccordionTrigger
                className="px-3"
                headerClassName="sticky top-14 z-10 bg-card rounded-t-xl"
                iconAfterActions
                iconClassName="rounded-tr-xl group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                actions={trocavel ? (
                  <button
                    type="button"
                    onClick={() => setTrocaSala(sala)}
                    aria-label={`Trocar sala de ${aliasSala}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-stretch
                               px-1 text-primary transition-colors active:opacity-60
                               group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                ) : null}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">{sala}</span>
                  {trocas.length > 0 && <Badge variant="warning" badgeStyle="subtle">Troca pendente</Badge>}
                  {aliasSala && (
                    <span className="truncate font-normal text-muted-foreground">— {aliasSala}</span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {trocas.map((t) => (
                    <TrocaPendenteCard
                      key={t.id}
                      troca={t}
                      meuUid={meuUid}
                      podeGerenciar={podeGerenciar}
                      onAceitar={(x) => aceitarTroca(x)}
                      onRecusar={(x) => recusarTroca(x, userInfo)}
                      onCancelar={(x) => cancelarTroca(x, userInfo)}
                    />
                  ))}
                  {lista.map((caso) => (
                    <CasoCard
                      key={caso.id || `${sala}-${caso.ordem}`}
                      caso={caso}
                      destaque={ehMeu(caso)}
                      onClick={() => setDetalhe(caso)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>{detalhe?.sala} · {detalhe?.hora}</SheetTitle>
          </SheetHeader>
          {detalhe && (
            <>
              <dl className="px-1 pb-2 space-y-2 text-sm">
                <Linha rotulo="Paciente" valor={detalhe.pacienteIniciais} />
                <Linha rotulo="Idade" valor={detalhe.idade} />
                <Linha rotulo="Procedimento" valor={detalhe.procedimento} />
                <Linha rotulo="Cirurgião" valor={detalhe.cirurgiao} />
                <Linha rotulo="Anestesista" valor={detalhe.anestesista} destaque />
                <Linha rotulo="Convênio" valor={detalhe.convenio && (
                  <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${corConvenio(detalhe.convenio)?.badge || ''}`}>
                    {detalhe.convenio}
                  </span>
                )} />
                <Linha rotulo="Tempo estimado" valor={detalhe.tempoEstimado} />
                {tipoBadge(detalhe.tipo) && (
                  <Linha rotulo="Tipo" valor={tipoBadge(detalhe.tipo).label} />
                )}
              </dl>
              {/* troca de sala a partir do caso (pedido do dono): mesmo fluxo do chip do título */}
              {(() => {
                const aliasDet = anestesistaDaSala(escala?.casos, detalhe.sala).alias || detalhe.anestesista || ''
                return podeTrocarSala(detalhe.sala, aliasDet) ? (
                  <div className="px-1 pb-2">
                    <Button size="sm" variant="outline" className="w-full"
                      onClick={() => { setDetalhe(null); setTrocaSala(detalhe.sala) }}>
                      <ArrowLeftRight className="w-4 h-4" /> Trocar sala ({aliasDet})
                    </Button>
                  </div>
                ) : null
              })()}
              {/* status da cirurgia — qualquer clínico atualiza (RLS cobre) */}
              {!isDemo && detalhe.id && (
                <div className="px-1 pb-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status da cirurgia
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { valor: 'agendada', label: 'Agendada', ativo: 'default' },
                      { valor: 'iniciada', label: 'Iniciada', ativo: 'success' },
                      // Button não tem variant azul/laranja — tokens via className
                      { valor: 'terminada', label: 'Terminada', ativo: 'default', cls: 'bg-info text-white hover:bg-info/90' },
                      { valor: 'atrasada', label: 'Atrasada', ativo: 'warning', extra: true },
                      { valor: 'suspensa', label: 'Suspensa', ativo: 'destructive', extra: true },
                      { valor: 'passa_tarde', label: 'Passa para tarde', ativo: 'default', extra: true, cls: 'bg-category-purple text-white hover:bg-category-purple/90' },
                    ].map((s) => {
                      const atual = s.extra
                        ? detalhe.statusExtra === s.valor
                        : (detalhe.statusCirurgia || 'agendada') === s.valor
                      // extras convivem com agendada/iniciada, nunca com terminada
                      const bloqueado = s.extra && detalhe.statusCirurgia === 'terminada'
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
            </>
          )}
        </SheetContent>
      </Sheet>

      {addCaso && (
        <AddCasoSheet escala={escala} onClose={() => setAddCaso(false)} />
      )}

      {trocaSala && (
        <TrocaSalaSheet
          escala={escala}
          salaAtual={trocaSala}
          meuUid={meuUid}
          podeAplicarDireto={podeGerenciar}
          onClose={() => setTrocaSala(null)}
        />
      )}
    </>
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
