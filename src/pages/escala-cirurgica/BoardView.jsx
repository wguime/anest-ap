/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, Stethoscope, Timer, UserCog, Plus } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, Button, EmptyState,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { fraseClinica, titleCaseNome } from '@/lib/colunaLiberacao'
import { casosResolvidos, agruparPorSala, tipoBadge, normNome, filtrarPorTurno, compararSalas, anestesistaDaSala, salaExibicao } from './utils'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import AddCasoSheet from './AddCasoSheet'
import CasoDetalheSheet from './CasoDetalheSheet'

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

/** Caso "placeholder" (ex.: SRPA sem procedimentos): não renderiza card — só o cabeçalho da sala. */
export const casoVazio = (c) =>
  !String(c?.hora || '').trim() && !String(c?.pacienteIniciais || '').trim() &&
  !String(c?.procedimento || '').trim() && !String(c?.cirurgiao || '').trim()

// Exportado: a aba Minhas usa o MESMO card (pedido do dono 2026-07-21).
// Grafia: nunca CAIXA ALTA — procedimento em frase (siglas preservadas), nomes em Title Case.
export function CasoCard({ caso, destaque, salaLabel, onClick }) {
  const tb = tipoBadge(caso.tipo)
  const st = STATUS_CIRURGIA[caso.statusCirurgia]
  const ex = extraDe(caso)
  const procedimento = fraseClinica(caso.procedimento)
  const cirurgiao = titleCaseNome(caso.cirurgiao)
  const rotulo = ['Detalhes do caso', salaLabel, caso.hora, caso.pacienteIniciais, procedimento]
    .filter(Boolean).join(', ')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={[
        'w-full text-left rounded-xl border p-3 min-h-[44px] transition-colors',
        // hover só onde hover existe de verdade — no touch o :hover "gruda" após o tap
        // e o card fica oscilando entre a tinta do status e o cinza (bug reportado no mobile)
        'active:bg-muted/60 supports-[hover:hover]:hover:bg-muted/40',
        st?.card ? st.card : destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
        // convênio identifica só pelo SELO (stripe lateral removida a pedido do dono 2026-07-21)
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Zona 1 — quando/quem: hora fixa à esquerda, paciente+idade, badges de tipo/status */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {salaLabel && <span className="font-bold text-foreground">{salaLabel}</span>}
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
          {/* Zona 2 — procedimento + tempo cirúrgico na MESMA linha (pedido 2026-07-21) */}
          {(procedimento || caso.tempoEstimado) && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[15px] text-foreground/90" title={procedimento}>{procedimento}</p>
              {caso.tempoEstimado && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="w-3 h-3" /> {caso.tempoEstimado}
                </span>
              )}
            </div>
          )}
          {/* Zona 3 — cirurgião em destaque + convênio na MESMA linha (sem rodapé:
              elimina o espaço em branco abaixo do cirurgião — pedido 2026-07-21).
              Selo TONAL; -mr-6 estende sob a coluna da seta → cola na borda direita. */}
          {(cirurgiao || caso.convenio) && (
            <div className="-mr-6 mt-1 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground">
                <Stethoscope className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate" title={cirurgiao}>{cirurgiao}</span>
              </p>
              {caso.convenio && (
                <span className="max-w-[140px] shrink-0 truncate rounded-md border border-transparent bg-black/10 px-1.5 py-0.5 text-xs font-medium text-foreground/80 dark:bg-white/15 dark:text-foreground/90"
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

export default function BoardView({ escala, meuAlias, meuUid, turno, onNavigate }) {
  const { user } = useUser()
  const [detalhe, setDetalhe] = useState(null)
  const [definirSala, setDefinirSala] = useState(null) // sala com o sheet "Anestesista da sala" aberto
  const [addCaso, setAddCaso] = useState(false)
  // Accordion controlado p/ "recolher todas" (pedido 2026-07-21): null = padrão (abertas)
  const [abertas, setAbertas] = useState(null)
  const casos = useMemo(() => filtrarPorTurno(casosResolvidos(escala), turno), [escala, turno])
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  const alvo = normNome(meuAlias)
  const ehMeu = (c) => (c.anestesistaUserId ? c.anestesistaUserId === meuUid : alvo && normNome(c.anestesista) === alvo)

  const isDemo = String(escala?.id).startsWith('demo-')
  const role = (user?.role || '').toLowerCase()
  const podeGerenciar = !!(user?.isAdmin || role === 'secretaria')
  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes(role))
  // Identidade com fallback por apelido: escala real pode vir sem uid nos casos
  // (secretária não atribuiu logins) — a resolução final acontece no sheet.
  const souDaSala = (sala) => {
    const { uid, alias } = anestesistaDaSala(escala?.casos, sala)
    if (uid) return uid === meuUid
    const primeiro = (escala?.casos || []).find((c) => c.sala === sala && c.anestesista)
    return !!(alvo && primeiro && normNome(primeiro.anestesista) === alvo) || !!(alias && alvo && normNome(alias) === alvo)
  }
  // Sistema de trocas APOSENTADO (decisão do dono 2026-07-23): agora é definir o
  // RESPONSÁVEL pela sala direto — o responsável atual repassa; coordenador define qualquer uma.
  const podeDefinirAnestesista = (sala) => !isDemo && (podeGerenciar || souDaSala(sala))

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

  const abertasAtual = abertas ?? salas
  const algumaAberta = abertasAtual.length > 0

  return (
    <>
      <div className="mb-2 flex gap-2">
        {canEdit && !isDemo && (
          <Button size="sm" variant="outline" onClick={() => setAddCaso(true)} className="min-w-0 flex-1">
            <Plus className="w-4 h-4" /> Adicionar caso (urgência/encaixe)
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAbertas(algumaAberta ? [] : salas)}
          aria-label={algumaAberta ? 'Recolher todas as salas' : 'Expandir todas as salas'}
          className={canEdit && !isDemo ? 'shrink-0' : 'w-full'}
        >
          {algumaAberta ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
          {canEdit && !isDemo ? null : (algumaAberta ? 'Recolher todas' : 'Expandir todas')}
        </Button>
      </div>
      <Accordion type="multiple" value={abertasAtual} onValueChange={setAbertas} className="space-y-2">
        {salas.map((sala) => {
          const lista = grupos.get(sala)
          // p/ exibição vale o apelido resolvido mesmo sem uid (demo/legado);
          // a resolução de uid acontece no sheet (dicionário + roster)
          const aliasSala = anestesistaDaSala(escala?.casos, sala).alias
            || lista.find((c) => c.anestesista)?.anestesista || ''
          const definivel = podeDefinirAnestesista(sala)
          return (
            <AccordionItem key={sala} value={sala} className="rounded-xl border border-border bg-card">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele) */}
              <AccordionTrigger
                className="px-3"
                headerClassName="sticky top-14 z-10 bg-card rounded-t-xl"
                iconAfterActions
                iconClassName="rounded-tr-xl group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                actions={definivel ? (
                  <button
                    type="button"
                    onClick={() => setDefinirSala(sala)}
                    aria-label={`Definir anestesista da ${sala}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-stretch
                               px-1 text-primary transition-colors active:opacity-60
                               group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                ) : null}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">{salaExibicao(sala)}</span>
                  {aliasSala && (
                    <span className="truncate font-normal text-muted-foreground">— {titleCaseNome(aliasSala)}</span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {/* SRPA e afins sem procedimentos: só o cabeçalho, sem card vazio */}
                  {lista.filter((c) => !casoVazio(c)).map((caso) => (
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

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
          onClose={() => setDetalhe(null)}
          podeDefinirAnestesista={podeDefinirAnestesista}
          onDefinirAnestesista={(sala) => setDefinirSala(sala)}
        />
      )}

      {addCaso && (
        <AddCasoSheet
          escala={escala}
          onClose={() => setAddCaso(false)}
          onPreencherCobranca={(novo) => onNavigate?.('novaCirurgiaParticular', { escalaCasoId: novo.id })}
        />
      )}

      {definirSala && (
        <DefinirAnestesistaSheet
          escala={escala}
          sala={definirSala}
          onClose={() => setDefinirSala(null)}
        />
      )}
    </>
  )
}

