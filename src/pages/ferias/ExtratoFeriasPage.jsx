/**
 * ExtratoFeriasPage — extrato anual de férias do grupo (Pega Plantão).
 *
 * Acesso RESTRITO (gate.js): Guilherme (2 contas), Fernanda e Leandro.
 * Redesign 03/08 (referência: leave trackers tipo Timetastic/BambooHR —
 * saldo como número-herói + barra de progresso; detalhes atrás de um
 * toque): 3 tiles de resumo, alertas escondidos num bottom-sheet aberto
 * pelo tile, lista coletiva com nome COMPLETO + barra de uso, individual
 * com card de saldo e períodos agrupados em Agendados/Usufruídos.
 *
 * Período fixo 01/01–31/12 do ano corrente. Sem fallback mock: erro de
 * rede mostra retry (extrato errado é pior que extrato ausente).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  AlertTriangle, BookOpen, CalendarDays, ChevronDown, ChevronRight, Download,
  FileSpreadsheet, FileText, Loader2, UserRound, UsersRound,
} from 'lucide-react'
import {
  Card, Badge, Tabs, TabsList, TabsTrigger, EmptyState, Select, Alert,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Skeleton, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem,
  Sheet, SheetContent, SheetHeader, SheetTitle, Progress,
  useToast,
} from '@/design-system'
import PageHeader from '@/components/PageHeader'
import { useUser } from '@/contexts/UserContext'
import { useMessages } from '@/contexts/MessagesContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { usePdfExport } from '@/hooks/usePdfExport'
import { getFeriasDoAno, invalidarFeriasDoAno } from '@/services/pegaPlantaoApi'
import { penalidadesSetimaVaga, aplicarPenalidades } from '@/lib/feriasAnalise'
import {
  fetchViolacoesVistas, registrarViolacoesVistas,
  fetchMarcacoesVistas, registrarMarcacoesVistas,
} from '@/services/supabaseFeriasViolacoesService'
import { ultimoAMarcar } from '@/lib/feriasAnalise'
import {
  getDestinatariosFerias, diffViolacoesNovas, buildFeriasNotificationPayload,
} from '@/utils/feriasNotificacoes'
import { normalizarRegistrosFerias, construirExtrato } from '@/lib/extratoFerias'
import { aplicarMovimentacoes, vistasDasMovimentacoes } from '@/lib/feriasMovimentacoes'
import { hojeLocalISO } from '@/lib/feriasMarcacao'
import { fetchMovimentacoes } from '@/services/supabaseFeriasMovimentacoesService'
import { getSocioDoUsuario } from './gate'
import MapaFeriasView from './MapaFeriasView'
import MarcarFeriasView from './MarcarFeriasView'
import RegrasFeriasSheet from './RegrasFeriasSheet'
import { getSocios } from '@/lib/feriasSocios'
import { getFeriados, FERIADOS_UTEIS } from '@/lib/feriasFeriados'
import { avaliarRegras, REGRA_LABEL, MAX_VAGAS_DIA } from '@/lib/extratoFeriasRegras'

const fmtBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
// espelha o TTL do cache de getFeriasDoAno (pegaPlantaoApi)
const FERIAS_TTL_MS = 30 * 60 * 1000

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Quem abre a aba Individual cai no próprio extrato
const EMAIL_TO_SOCIO = {
  'wguime@yahoo.com.br': 'G. MELO',
  'anestesista.guilherme@gmail.com': 'G. MELO',
  'guollofernanda@gmail.com': 'FERNANDA GUOLLO',
  'leandrobernardes03@hotmail.com': 'LEANDRO BERNARDES',
}

/**
 * Terminologia + semântica de cor (dono 03/08, iterada na mesma noite):
 * Excedida = vermelho sólido (crítico salta), Completa = VERDE (cota
 * concluída), N livres = LARANJA (category-orange — diferenciação
 * não-semântica; azul e teal foram vetados). Barra de uso acompanha a cor
 * do badge; sem dot (vetado). O laranja entra pelo var --badge-color do
 * estilo subtle do Badge — segue 100% token DS.
 */
/**
 * Hierarquia tonal (dono 04/08, ref. Setproduct/Carbon): UM único estado
 * de alarme em SÓLIDO (Excedida); os dois estados calmos no MESMO peso —
 * tint ~20% do matiz vivo + texto escuro do matiz. O pastel puro (-bg)
 * era apagado demais e o laranja sólido brigava com o vermelho.
 */
function statusPessoa(p) {
  if (p.saldo < 0) return { label: 'Excedida', variant: 'destructive', badgeStyle: 'solid', barra: 'error' }
  if (p.saldo === 0) {
    return {
      label: 'Completa',
      variant: 'success',
      badgeStyle: 'subtle',
      barra: 'success',
      badgeClassName: 'bg-success/20 text-category-green-fg',
    }
  }
  return {
    label: `${p.saldo} livres`,
    variant: 'default',
    badgeStyle: 'subtle',
    barra: 'orange',
    badgeClassName: 'bg-category-orange/20 text-category-orange-fg',
  }
}

// ─── Resumo: 3 tiles (Alertas é botão → abre o sheet) ───────────────────────
function ResumoStrip({ extrato, violacoes, onOpenAlertas, onOpenRegras }) {
  const criticas = violacoes.filter((v) => v.severidade === 'critical').length
  const diasLotados = [...extrato.porDia.values()].filter((n) => n.length >= MAX_VAGAS_DIA).length
  // Cota somada do grupo: mostra quanto do direito total já foi marcado
  const cotaTotal = extrato.porPessoa.reduce((a, p) => a + p.cota, 0)
  const disponiveis = cotaTotal - extrato.totalDiasContados
  const tileBase = 'rounded-xl bg-card border border-border px-3 py-2.5 text-left'
  return (
    <>
    {/* Uso do grupo em destaque + 2 tiles menores (dono 04/08: o texto
        quebrava dentro do tile de 1/3 de largura) */}
    <div className={`${tileBase} mb-2`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            Dias de férias do grupo em {extrato.ano}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {extrato.totalDiasContados}
            <span className="text-[13px] font-medium text-muted-foreground"> de {cotaTotal} marcados</span>
          </p>
        </div>
        <p className="text-right text-[12px] leading-tight text-muted-foreground shrink-0">
          <span className="block text-base font-bold text-foreground">{disponiveis > 0 ? disponiveis : 0}</span>
          disponíveis
        </p>
      </div>
      <Progress
        value={extrato.totalDiasContados}
        max={cotaTotal || 1}
        size="sm"
        variant="success"
        animated={false}
        className="mt-2 opacity-60"
      />
    </div>

    <div className="grid grid-cols-2 gap-2 mb-2">

      <button
        type="button"
        onClick={violacoes.length > 0 ? onOpenAlertas : undefined}
        disabled={violacoes.length === 0}
        className={`${tileBase} min-h-[44px] ${violacoes.length > 0 ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''}`}
        aria-haspopup="dialog"
      >
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertTriangle className={`w-3.5 h-3.5 ${criticas ? 'text-destructive' : ''}`} aria-hidden="true" />
          Alertas
        </p>
        <p className={`flex items-center gap-1 text-lg font-bold tabular-nums ${criticas ? 'text-destructive' : 'text-foreground'}`}>
          {violacoes.length}
          {violacoes.length > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
        </p>
      </button>

      <div className={tileBase}>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <UsersRound className="w-3.5 h-3.5" aria-hidden="true" />
          Dias lotados
        </p>
        <p className="text-lg font-bold tabular-nums text-foreground">{diasLotados}</p>
      </div>
    </div>

    {/* Consulta das regras sem sair do extrato (dono 04/08) */}
    <button
      type="button"
      onClick={onOpenRegras}
      className="w-full flex items-center gap-2 mb-3 rounded-xl bg-card border border-border px-3 py-2.5 min-h-[44px] text-left active:scale-[0.99] transition-transform"
    >
      <BookOpen className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Regras</span>
        <span className="block text-[11px] text-muted-foreground">Cotas, vagas, prazos e perguntas frequentes</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
    </>
  )
}

// ─── Bottom-sheet de alertas (agrupados por regra) ──────────────────────────
function AlertasSheet({ open, onOpenChange, violacoes, ultimosPorDia = new Map() }) {
  const porRegra = useMemo(() => {
    const map = new Map()
    for (const v of violacoes) {
      if (!map.has(v.regra)) map.set(v.regra, [])
      map.get(v.regra).push(v)
    }
    return [...map.entries()]
  }, [violacoes])
  const criticas = violacoes.filter((v) => v.severidade === 'critical').length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>
            {violacoes.length} alerta{violacoes.length !== 1 ? 's' : ''} de regra
            {criticas > 0 && (
              <span className="ml-2 align-middle">
                <Badge variant="destructive" badgeStyle="subtle">{criticas} crítico{criticas !== 1 ? 's' : ''}</Badge>
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 sm:px-5 pb-8 overflow-y-auto">
          <Accordion type="multiple">
            {porRegra.map(([regra, lista]) => {
              const critico = lista.some((v) => v.severidade === 'critical')
              return (
              <AccordionItem key={regra} value={regra}>
                {/* Cabeçalho tingido pela severidade do grupo + contagem sólida (dono 03/08) */}
                <AccordionTrigger
                  className={`text-sm py-3 px-3 rounded-xl my-1 ${
                    critico
                      ? 'bg-destructive/10 group-data-[state=open]:bg-destructive/15 dark:group-data-[state=open]:bg-destructive/15'
                      : 'bg-warning/10 group-data-[state=open]:bg-warning/15 dark:group-data-[state=open]:bg-warning/15'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-left">
                    <Badge variant={critico ? 'destructive' : 'warning'} badgeStyle="solid">
                      {lista.length}
                    </Badge>
                    <span className={critico ? 'text-destructive font-semibold' : 'text-foreground'}>
                      {REGRA_LABEL[regra] || regra}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="divide-y divide-border">
                    {lista.map((v) => {
                      const ultimo = v.regra === 'MAX_POR_DIA' ? ultimosPorDia.get(v.referencia) : null
                      return (
                        <li key={v.id} className="py-2 text-[13px] leading-snug">
                          {v.pessoaExib ? (
                            <>
                              <span className="font-semibold text-foreground">{v.pessoaExib}</span>
                              <span className="text-muted-foreground"> — {v.detalhe}</span>
                            </>
                          ) : (
                            <span className="text-foreground/90">{v.detalhe}</span>
                          )}
                          {v.regra === 'MAX_POR_DIA' && (
                            ultimo?.confiavel ? (
                              <>
                                <p className="mt-0.5 text-[12px] font-medium text-destructive">
                                  Último a marcar: {ultimo.nomeCompleto} (marcado em {fmtBr(ultimo.vistoEm)})
                                </p>
                                <p className="text-[12px] text-muted-foreground">
                                  Penalidade da 7ª vaga: conta 3 dias de férias em vez de 1 (+2).
                                </p>
                              </>
                            ) : (
                              <p className="mt-0.5 text-[12px] text-muted-foreground">
                                Ordem de marcação desconhecida — sem como apontar quem usou a 7ª vaga.
                              </p>
                            )
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Lista coletiva: nome completo + barra de uso + saldo ───────────────────
function TabelaColetiva({ extrato, onSelectPessoa }) {
  const ordenados = useMemo(
    () => [...extrato.porPessoa].sort((a, b) => (b.diasEfetivos ?? b.diasContados) - (a.diasEfetivos ?? a.diasContados) || a.nomeCompleto.localeCompare(b.nomeCompleto)),
    [extrato]
  )
  return (
    <Card className="p-0 overflow-hidden">
      {ordenados.map((p, i) => {
        const status = statusPessoa(p)
        return (
          <button
            key={p.nome}
            type="button"
            onClick={() => onSelectPessoa(p.nome)}
            className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left active:bg-muted/50 transition-colors ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground truncate">{p.nomeCompleto}</span>
              {/* discreta (dono 04/08): fina e translúcida, só um eco da cor do badge */}
              <Progress
                value={p.diasEfetivos ?? p.diasContados}
                max={p.cota || 1}
                size="sm"
                variant={status.barra}
                animated={false}
                className="mt-1.5 opacity-50"
              />
            </span>
            {/* Só o total efetivo — a linha do Coletivo é uniforme p/ todos;
                o detalhe da penalidade vive no extrato individual (dono 04/08) */}
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {p.diasEfetivos ?? p.diasContados}/{p.cota}
            </span>
            <Badge
              variant={status.variant}
              badgeStyle={status.badgeStyle}
              className={`shrink-0 w-[74px] justify-center ${status.badgeClassName || ''}`}
            >
              {status.label}
            </Badge>
          </button>
        )
      })}
    </Card>
  )
}

// ─── Individual: saldo-herói + períodos agrupados ───────────────────────────
function ExtratoIndividual({ pessoa, violacoes, hojeISO, ano, penalidades = [] }) {
  if (!pessoa) {
    return (
      <EmptyState
        icon={<UserRound className="w-8 h-8" />}
        title="Escolha um sócio"
        description="Selecione acima para ver o extrato individual."
        size="sm"
      />
    )
  }

  const violacoesDaPessoa = violacoes.filter((v) => v.pessoa === pessoa.nome)
  const gozados = pessoa.diasContaveis.filter((d) => d < hojeISO).length
  const agendados = pessoa.periodos.filter((per) => per.fim >= hojeISO)
  const usufruidos = pessoa.periodos.filter((per) => per.fim < hojeISO)
  // 7ª vaga: já calculada em aplicarPenalidades (fonte única)
  const diasExtras = pessoa.diasPenalidade ?? 0
  const diasEfetivos = pessoa.diasEfetivos ?? pessoa.diasContados
  const saldoEfetivo = pessoa.saldo
  const status = statusPessoa(pessoa)

  // Qual período contém cada dia penalizado (dono 04/08: a penalidade tem
  // que ser localizável na lista, não só no bloco de aviso)
  const penalPorPeriodo = (per) => penalidades.filter((p) => p.data >= per.inicio && p.data <= per.fim)
  /** Total da seção JÁ com os dias de penalidade dos períodos dela. */
  const totalSecao = (periodos) =>
    periodos.reduce(
      (acc, per) => acc + per.diasUteis + penalPorPeriodo(per).reduce((a, p) => a + p.diasExtras, 0),
      0
    )

  const linhaPeriodo = (per) => {
    const penal = penalPorPeriodo(per)
    return (
      <li key={per.inicio} className="py-0.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground">
            {per.inicio === per.fim ? fmtBr(per.inicio) : `${fmtBr(per.inicio)} – ${fmtBr(per.fim)}`}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {penal.length > 0 && (
              <Badge variant="destructive" badgeStyle="subtle">
                7ª vaga +{penal.reduce((a, p) => a + p.diasExtras, 0)}
              </Badge>
            )}
            <span className="font-semibold tabular-nums text-foreground">
              {per.diasUteis} dia{per.diasUteis !== 1 ? 's' : ''}
            </span>
          </span>
        </div>
        {penal.map((p) => (
          <p key={p.data} className="text-[11px] leading-tight text-destructive">
            {fmtBr(p.data)}: 7ª vaga — conta 3 dias em vez de 1
          </p>
        ))}
      </li>
    )
  }

  return (
    <div className="space-y-3">
      {/* Saldo-herói (padrão leave tracker: número grande + barra de uso) */}
      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{pessoa.nomeCompleto}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${saldoEfetivo < 0 ? 'text-destructive' : 'text-foreground'}`}>
          {saldoEfetivo < 0
            ? `${-saldoEfetivo} dia${saldoEfetivo !== -1 ? 's' : ''} acima da cota`
            : `${saldoEfetivo} dia${saldoEfetivo !== 1 ? 's' : ''} disponíve${saldoEfetivo !== 1 ? 'is' : 'l'}`}
        </p>
        <Progress
          value={diasEfetivos}
          max={pessoa.cota || 1}
          size="sm"
          variant={status.barra}
          animated={false}
          className="mt-2"
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {pessoa.diasContados} de {pessoa.cota} dias marcados
          {diasExtras > 0 && (
            <span className="text-destructive font-medium"> · +{diasExtras} de penalidade</span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">Cota de {pessoa.cota} dias — {pessoa.regraCota}</p>
        {/* Totais em destaque (dono 04/08) — superfície accent (nível 1 do DS),
            não o cinza muted que destoava da paleta verde */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-accent dark:bg-card-elevated px-3 py-2.5">
            <p className="text-[11px] font-medium text-primary">Já usufruídos</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{gozados}</p>
          </div>
          <div className="rounded-xl bg-accent dark:bg-card-elevated px-3 py-2.5">
            <p className="text-[11px] font-medium text-primary">Agendados</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{pessoa.diasContados - gozados}</p>
          </div>
        </div>
      </Card>

      {/* 7ª vaga: o custo de 3 dias tem que estar escrito no extrato de
          quem vai pagar (dono 04/08 — caso real da Raquel em 13/10) */}
      {penalidades.length > 0 && (
        <div role="alert" className="rounded-[20px] border border-destructive/40 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />
            7ª vaga usada — desconto de {diasExtras} dia{diasExtras !== 1 ? 's' : ''}
          </p>
          <ul className="mt-2 space-y-1">
            {penalidades.map((p) => (
              <li key={p.data} className="text-[13px] leading-snug text-foreground/90">
                <span className="font-semibold">{fmtBr(p.data)}</span> — último a marcar num dia que já tinha
                as {MAX_VAGAS_DIA} vagas: conta 3 dias em vez de 1 (+{p.diasExtras}).
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Total efetivo: {diasEfetivos} de {pessoa.cota} dias ({pessoa.diasContados} marcados + {diasExtras} de penalidade).
          </p>
        </div>
      )}

      {violacoesDaPessoa.length > 0 && (() => {
        const temCritica = violacoesDaPessoa.some((v) => v.severidade === 'critical')
        // Custom (não WarningCallout): a coluna do ícone indentava a lista —
        // dono 04/08 pediu tudo alinhado à borda esquerda
        return (
          <div
            role="alert"
            className={`rounded-[20px] border p-4 ${
              temCritica ? 'bg-destructive/10 border-destructive/40' : 'bg-warning/10 border-warning/30'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${temCritica ? 'text-destructive' : 'text-warning'}`} aria-hidden="true" />
              {violacoesDaPessoa.length} alerta{violacoesDaPessoa.length !== 1 ? 's' : ''} de regra
            </p>
            <ul className="mt-2.5 space-y-2.5">
              {violacoesDaPessoa.map((v) => (
                <li key={v.id} className="flex flex-col items-start gap-1">
                  <Badge
                    variant={v.severidade === 'critical' ? 'destructive' : 'warning'}
                    badgeStyle="subtle"
                  >
                    {REGRA_LABEL[v.regra] || v.regra}
                  </Badge>
                  <span className="text-[13px] leading-snug text-foreground/90">{v.detalhe}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}

      {(agendados.length > 0 || usufruidos.length > 0) && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Extrato</p>
          {agendados.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Agendados</p>
              <ul>{agendados.map(linhaPeriodo)}</ul>
              <p className="mt-1 pt-1 border-t border-border flex items-center justify-between text-sm font-semibold text-foreground">
                <span>Total agendado</span>
                <span className="tabular-nums">{totalSecao(agendados)} dias</span>
              </p>
            </>
          )}
          {usufruidos.length > 0 && (
            <>
              <p className={`text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 ${agendados.length > 0 ? 'mt-3' : ''}`}>
                Usufruídos
              </p>
              <ul className="opacity-70">{usufruidos.map(linhaPeriodo)}</ul>
              <p className="mt-1 pt-1 border-t border-border flex items-center justify-between text-sm font-semibold text-foreground">
                <span>Total usufruído</span>
                <span className="tabular-nums">{totalSecao(usufruidos)} dias</span>
              </p>
            </>
          )}
          {pessoa.feriadosNaoContados.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Feriado{pessoa.feriadosNaoContados.length !== 1 ? 's' : ''} em semana inteira (não conta):{' '}
              {pessoa.feriadosNaoContados.map(fmtBr).join(', ')}
            </p>
          )}
          {pessoa.feriadosContados.length > 0 && (
            <p className="mt-1 text-[11px] text-warning">
              Feriado{pessoa.feriadosContados.length !== 1 ? 's' : ''} contado{pessoa.feriadosContados.length !== 1 ? 's' : ''} (semana parcial):{' '}
              {pessoa.feriadosContados.map(fmtBr).join(', ')}
            </p>
          )}
          {pessoa.fdsIgnorados.length > 0 && (
            <p className="mt-1 text-[11px] text-warning">
              Marcação em fim de semana ignorada (conferir no Pega Plantão):{' '}
              {pessoa.fdsIgnorados.map(fmtBr).join(', ')}
            </p>
          )}
        </Card>
      )}

      {pessoa.diasContados > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
            Dias de férias por mês
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            {pessoa.diasContados} dias distribuídos ao longo de {ano}
          </p>
          {/* Mini-gráfico: os 12 meses de uma vez, altura proporcional —
              lê-se a distribuição do ano num relance (dono 04/08) */}
          <div className="flex items-end justify-between gap-1 h-24">
            {MES_LABEL.map((rotulo, i) => {
              const n = pessoa.porMes[`${ano}-${String(i + 1).padStart(2, '0')}`] || 0
              const maxMes = Math.max(1, ...Object.values(pessoa.porMes))
              return (
                <div key={rotulo} className="flex flex-1 min-w-0 flex-col items-center justify-end gap-1">
                  <span className={`text-[11px] font-bold tabular-nums ${n ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {n}
                  </span>
                  <div
                    className={`w-full rounded-t-[3px] ${n ? 'bg-success/60' : 'bg-muted'}`}
                    style={{ height: `${n ? Math.max(6, (n / maxMes) * 48) : 3}px` }}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] leading-none text-muted-foreground">{rotulo}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function ExtratoFeriasPage({ goBack }) {
  const { user } = useUser()
  const { toast } = useToast()
  const { exportPdf, exporting } = usePdfExport()
  const { createSystemNotification } = useMessages()
  const { users: usersList = [] } = useUsersManagement()
  const ano = new Date().getFullYear()
  // Data LOCAL: toISOString() vira o dia às 21h em UTC-3 (quebraria prazos
  // de marcação e o split Agendados/Usufruídos na virada de ano)
  const hojeISO = hojeLocalISO()

  const [registrosRaw, setRegistrosRaw] = useState(null)
  const [movimentacoes, setMovimentacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('coletivo')
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null)
  const [alertasAbertos, setAlertasAbertos] = useState(false)
  const [regrasAbertas, setRegrasAbertas] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)

  const carregar = useCallback(async ({ forcar = false } = {}) => {
    setLoading(true)
    setError(null)
    try {
      // forcar = alguém mexeu no Pega Plantão e não dá p/ esperar o TTL
      if (forcar) invalidarFeriasDoAno(ano)
      // Ambos bloqueantes: extrato sem as marcações do app é extrato errado
      const [raw, movs] = await Promise.all([getFeriasDoAno(ano), fetchMovimentacoes(ano)])
      setRegistrosRaw(raw)
      setMovimentacoes(movs)
    } catch (err) {
      console.error('[ExtratoFerias] erro ao carregar:', err.message)
      setError(err.message || 'Erro ao consultar o Pega Plantão')
    } finally {
      setLoading(false)
    }
  }, [ano])

  /**
   * Revalidação silenciosa (stale-while-revalidate): ao voltar para a aba
   * ou reabrir o app, se o cache do Pega Plantão já passou dos 30min, os
   * dados são re-buscados sozinhos — sem botão e sem tela de loading
   * (dono 04/08). Cobre o caso "alguém alterou no PP enquanto eu estava
   * fora". Mesmo gatilho do cronômetro da Escala Cirúrgica, que já lida
   * com o iOS matando timers em background.
   */
  const ultimoFetch = useRef(Date.now())
  useEffect(() => {
    const revalidar = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimoFetch.current < FERIAS_TTL_MS) return
      ultimoFetch.current = Date.now()
      invalidarFeriasDoAno(ano)
      Promise.all([getFeriasDoAno(ano), fetchMovimentacoes(ano)])
        .then(([raw, movs]) => { setRegistrosRaw(raw); setMovimentacoes(movs) })
        .catch((err) => console.warn('[ExtratoFerias] revalidação falhou:', err?.message))
    }
    document.addEventListener('visibilitychange', revalidar)
    window.addEventListener('focus', revalidar)
    return () => {
      document.removeEventListener('visibilitychange', revalidar)
      window.removeEventListener('focus', revalidar)
    }
  }, [ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Após marcar/desmarcar: só as movimentações precisam voltar do banco (o
   * Pega Plantão não mudou). Todas as abas leem dos mesmos `registros
   * efetivos`, então Coletivo, Individual e Mapa refletem no mesmo render.
   */
  const recarregarMovimentacoes = useCallback(async () => {
    setMovimentacoes(await fetchMovimentacoes(ano))
  }, [ano])

  const socios = useMemo(() => getSocios(ano), [ano])
  const feriados = useMemo(() => getFeriados(ano), [ano])
  const registrosPP = useMemo(
    () => (registrosRaw ? normalizarRegistrosFerias(registrosRaw) : []),
    [registrosRaw]
  )
  // Fonte única do resto da página: PP + marcações do app (0 movimentações
  // ⇒ idêntico ao PP)
  const registros = useMemo(
    () => aplicarMovimentacoes(registrosPP, movimentacoes),
    [registrosPP, movimentacoes]
  )
  const extratoBase = useMemo(
    () => (registrosRaw ? construirExtrato({ registros, ano, socios, feriados }) : null),
    [registrosRaw, registros, ano, socios, feriados]
  )
  // Regras avaliam os dias MARCADOS (penalidade é consequência, não marcação)
  const violacoes = useMemo(
    () => (extratoBase ? avaliarRegras(extratoBase, { feriados }) : []),
    [extratoBase, feriados]
  )

  // ─── Notificação agregada (violações NOVAS; 1/dia; só p/ quem tem acesso) ──
  // Roda 1x por carga de dados reais. Recipients primeiro: se a lista de
  // usuários ainda não carregou, NÃO registra as vistas (senão a violação
  // ficaria marcada como notificada sem ninguém ter recebido).
  const [notifDone, setNotifDone] = useState(false)
  useEffect(() => {
    if (notifDone || !extratoBase || violacoes.length === 0 || usersList.length === 0) return
    const uid = user?.uid || user?.id
    if (!uid) return
    setNotifDone(true)
    ;(async () => {
      try {
        const recipients = getDestinatariosFerias(usersList)
        if (recipients.length === 0) return
        const vistas = await fetchViolacoesVistas(ano)
        const novas = diffViolacoesNovas(violacoes, vistas)
        if (novas.length === 0) return
        await registrarViolacoesVistas(novas, { ano, detectedBy: uid })
        await createSystemNotification(
          buildFeriasNotificationPayload({ novas, ano, hojeISO, recipientIds: recipients })
        )
      } catch (err) {
        // Nunca derruba a página — o alerta segue visível na tela
        console.warn('[ExtratoFerias] notificação agregada falhou:', err?.message)
      }
    })()
  }, [notifDone, extratoBase, violacoes, usersList, user, ano, hojeISO, createSystemNotification])

  // ─── First-seen das marcações (proxy da ORDEM de marcação — 7ª vaga) ──────
  // A API não expõe quando se marcou; registramos quando cada CodigoPlantao
  // aparece pela 1ª vez. Baseline (1ª varredura) = ordem desconhecida.
  // Só registros do PP entram aqui (os do app já nascem com timestamp real)
  const [marcacoesVistas, setMarcacoesVistas] = useState(null)
  useEffect(() => {
    if (marcacoesVistas || registrosPP.length === 0) return
    const uid = user?.uid || user?.id
    if (!uid) return
    ;(async () => {
      try {
        await registrarMarcacoesVistas(registrosPP.filter((r) => !r.ehFimDeSemana), { ano, seenBy: uid })
        setMarcacoesVistas(await fetchMarcacoesVistas(ano))
      } catch (err) {
        console.warn('[ExtratoFerias] first-seen de marcações falhou:', err?.message)
      }
    })()
  }, [registrosPP, marcacoesVistas, user, ano])

  const nomeCompletoPorNome = useMemo(
    () => new Map(socios.map((s) => [s.nome, s.nomeCompleto || s.nome])),
    [socios]
  )

  // Dias com 7+ → quem foi o último a marcar. Fonte de ordem, do melhor
  // para o pior: DataCriacao do próprio Pega Plantão (descoberta 04/08 —
  // timestamp exato da marcação), timestamp das marcações do app, e por
  // fim o first-seen aproximado por varredura.
  const ultimosPorDia = useMemo(() => {
    const out = new Map()
    if (!extratoBase) return out
    const doPP = new Map(
      registrosPP
        .filter((r) => r.criadoEm)
        .map((r) => [r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.criadoEm }])
    )
    const vistas = new Map([
      ...(marcacoesVistas || new Map()),
      ...doPP,
      ...vistasDasMovimentacoes(movimentacoes),
    ])
    const codigosPorDia = new Map()
    for (const r of registros) {
      if (r.ehFimDeSemana) continue
      if (!codigosPorDia.has(r.data)) codigosPorDia.set(r.data, [])
      codigosPorDia.get(r.data).push(r.codigo)
    }
    for (const [data, nomes] of extratoBase.porDia) {
      if (nomes.length <= MAX_VAGAS_DIA) continue
      const info = ultimoAMarcar(codigosPorDia.get(data) || [], vistas)
      if (!info) continue
      out.set(
        data,
        info.confiavel
          ? { ...info, nomeCompleto: nomeCompletoPorNome.get(info.nome) || info.nome }
          : info
      )
    }
    return out
  }, [marcacoesVistas, movimentacoes, extratoBase, registros, registrosPP, nomeCompletoPorNome])

  // Penalidades da 7ª vaga (3 dias) — derivadas da ordem real de marcação
  const penalidadesPorPessoa = useMemo(
    () => (extratoBase ? penalidadesSetimaVaga(extratoBase.porDia, ultimosPorDia) : new Map()),
    [extratoBase, ultimosPorDia]
  )

  // FONTE ÚNICA de saldo: base + penalidades. Coletivo, Individual, Mapa e
  // export leem daqui — sem isso a mesma pessoa aparecia com saldos
  // diferentes em abas diferentes (bug 04/08).
  const extrato = useMemo(
    () => aplicarPenalidades(extratoBase, penalidadesPorPessoa),
    [extratoBase, penalidadesPorPessoa]
  )

  // Individual: default = o próprio usuário (mapa e-mail → sócio)
  useEffect(() => {
    if (pessoaSelecionada || !extrato) return
    const proprio = EMAIL_TO_SOCIO[(user?.email || '').trim().toLowerCase()]
    if (proprio && extrato.porPessoa.some((p) => p.nome === proprio)) {
      setPessoaSelecionada(proprio)
    }
  }, [extrato, user, pessoaSelecionada])

  const opcoesPessoa = useMemo(
    () =>
      (extrato?.porPessoa || [])
        .map((p) => ({ value: p.nome, label: p.nomeCompleto, keywords: p.nome }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [extrato]
  )

  const pessoa = extrato?.porPessoa.find((p) => p.nome === pessoaSelecionada) || null
  // Sócio que este usuário pode marcar/desmarcar (self-service)
  const socioDoUsuario = useMemo(() => getSocioDoUsuario(user), [user])


  const selecionarPessoa = (nome) => {
    setPessoaSelecionada(nome)
    setTab('individual')
  }

  // ─── Exports (padrão CirurgiasParticularesPage: botão único, menu decide) ──
  const handleExportPdf = async () => {
    if (!extrato) return
    try {
      await exportPdf('extratoFeriasReport', {
        extrato,
        violacoes,
        // Da aba Individual sai também a seção da pessoa selecionada
        pessoa: tab === 'individual' ? pessoa : null,
        geradoPor: user?.displayName || user?.email || '',
      })
    } catch (err) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'error' })
    }
  }

  const handleExportExcel = async () => {
    if (!extrato) return
    setExportingXlsx(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const ordenados = [...extrato.porPessoa].sort(
        (a, b) => b.diasContados - a.diasContados || a.nomeCompleto.localeCompare(b.nomeCompleto)
      )
      const wsResumo = XLSX.utils.aoa_to_sheet([
        [`Extrato de Férias ${ano} — uso interno do grupo`],
        [],
        ['Sócio', 'Entrada', 'Cota', 'Dias marcados', 'Saldo', 'Semanas inteiras', 'Situação'],
        ...ordenados.map((p) => [
          p.nomeCompleto, p.anoEntrada, p.cota, p.diasContados, p.saldo,
          p.semanas.filter((s) => s.inteira).length,
          p.saldo < 0 ? 'EXCEDIDA' : p.saldo === 0 ? 'Completa' : 'OK',
        ]),
        [],
        ['TOTAL', '', '', extrato.totalDiasContados],
      ])
      wsResumo['!cols'] = [34, 8, 6, 13, 7, 15, 12].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

      const wsDias = XLSX.utils.aoa_to_sheet([
        ['Sócio', 'Período', 'Dias úteis'],
        ...extrato.porPessoa.flatMap((p) =>
          p.periodos.map((per) => [
            p.nomeCompleto,
            per.inicio === per.fim ? fmtBr(per.inicio) : `${fmtBr(per.inicio)} - ${fmtBr(per.fim)}`,
            per.diasUteis,
          ])
        ),
      ])
      wsDias['!cols'] = [34, 16, 10].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(wb, wsDias, 'Períodos')

      const wsAlertas = XLSX.utils.aoa_to_sheet([
        ['Nível', 'Sócio', 'Regra', 'Detalhe'],
        ...violacoes.map((v) => [
          v.severidade === 'critical' ? 'CRÍTICO' : 'Aviso',
          v.pessoaExib || '—',
          REGRA_LABEL[v.regra] || v.regra,
          v.detalhe,
        ]),
      ])
      wsAlertas['!cols'] = [9, 30, 30, 70].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(wb, wsAlertas, 'Alertas')

      XLSX.writeFile(wb, `ANEST_Extrato_Ferias_${ano}.xlsx`)
    } catch (err) {
      toast({ title: 'Erro ao gerar Excel', description: err.message, variant: 'error' })
    } finally {
      setExportingXlsx(false)
    }
  }

  const podeExportar = !loading && !error && !!extrato

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Extrato de Férias"
        subtitle={`01/01 – 31/12/${ano}`}
        onBack={goBack}
        actions={
          podeExportar ? (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  disabled={exporting || exportingXlsx}
                  className="inline-flex items-center gap-1.5 font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 px-2.5 py-1.5 text-xs dark:text-primary-foreground"
                >
                  {exporting || exportingXlsx
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {exporting || exportingXlsx ? 'Gerando...' : 'Exportar'}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end" minWidth={190}>
                <DropdownItem icon={<FileText className="w-4 h-4" />} onClick={handleExportPdf}>
                  PDF
                </DropdownItem>
                <DropdownItem icon={<FileSpreadsheet className="w-4 h-4" />} onClick={handleExportExcel}>
                  Excel
                </DropdownItem>
                <DropdownItem
                  icon={<Download className="w-4 h-4" />}
                  onClick={async () => { await handleExportPdf(); await handleExportExcel() }}
                >
                  PDF + Excel
                </DropdownItem>
              </DropdownContent>
            </DropdownMenu>
          ) : null
        }
      />

      <div className="px-4 sm:px-5 pt-2">
        <Tabs value={tab} onValueChange={setTab} variant="pills">
          {/* 4 abas a 375px: padding menor e texto menor p/ 'Marcar' não cortar */}
          <TabsList className="mb-3">
            <TabsTrigger value="coletivo" className="flex-1 px-1 text-xs sm:text-sm">Coletivo</TabsTrigger>
            <TabsTrigger value="individual" className="flex-1 px-1 text-xs sm:text-sm">Individual</TabsTrigger>
            <TabsTrigger value="mapa" className="flex-1 px-1 text-xs sm:text-sm">Mapa</TabsTrigger>
            {socioDoUsuario && (
              <TabsTrigger value="marcar" className="flex-1 px-1 text-xs sm:text-sm">Agendar</TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : error ? (
          <Alert
            variant="error"
            title="Não foi possível consultar o Pega Plantão"
            action={{ label: 'Tentar de novo', onClick: carregar }}
          >
            {error}
          </Alert>
        ) : !extrato ? null : (
          <>
            {FERIADOS_UTEIS[ano] === undefined && (
              <Alert variant="warning" title="Feriados do ano não configurados" className="mb-3">
                O extrato está contando feriados como dias comuns. Atualize src/lib/feriasFeriados.js.
              </Alert>
            )}
            {extrato.naoReconhecidos.length > 0 && (
              <Alert variant="warning" title="Nomes fora da lista de sócios" className="mb-3">
                {extrato.naoReconhecidos.map((n) => `${n.nome} (${n.dias} dia${n.dias !== 1 ? 's' : ''})`).join(' · ')}
                {' '}— atualizar src/lib/feriasSocios.js.
              </Alert>
            )}

            {tab === 'marcar' && socioDoUsuario ? (
              <MarcarFeriasView
                ano={ano}
                nome={socioDoUsuario}
                socios={socios}
                feriados={feriados}
                hojeISO={hojeISO}
                extrato={extrato}
                violacoes={violacoes}
                registrosPP={registrosPP}
                registrosEfetivos={registros}
                movimentacoes={movimentacoes}
                user={user}
                onGravado={recarregarMovimentacoes}
              />
            ) : tab === 'mapa' ? (
              <MapaFeriasView
                ano={ano}
                registrosAtual={registros}
                ultimosPorDia={ultimosPorDia}
                movimentacoes={movimentacoes}
                usersList={usersList}
                socios={socios}
              />
            ) : tab === 'coletivo' ? (
              extrato.totalDiasContados === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="w-8 h-8" />}
                  title="Nenhuma férias marcada"
                  description={`Nenhum registro de férias no Pega Plantão em ${ano}.`}
                />
              ) : (
                <>
                  <ResumoStrip
                    extrato={extrato}
                    violacoes={violacoes}
                    onOpenAlertas={() => setAlertasAbertos(true)}
                    onOpenRegras={() => setRegrasAbertas(true)}
                  />
                  <TabelaColetiva extrato={extrato} onSelectPessoa={selecionarPessoa} />
                  <RegrasFeriasSheet
                    open={regrasAbertas}
                    onOpenChange={setRegrasAbertas}
                    ano={ano}
                    geradoPor={user?.displayName || user?.email || ''}
                  />
                  <AlertasSheet
                    open={alertasAbertos}
                    onOpenChange={setAlertasAbertos}
                    violacoes={violacoes}
                    ultimosPorDia={ultimosPorDia}
                  />
                </>
              )
            ) : (
              <div className="space-y-3">
                <Select
                  searchable
                  label="Sócio"
                  placeholder="Buscar pelo nome..."
                  options={opcoesPessoa}
                  value={pessoaSelecionada}
                  onChange={setPessoaSelecionada}
                />
                <ExtratoIndividual
                  pessoa={pessoa}
                  violacoes={violacoes}
                  hojeISO={hojeISO}
                  ano={ano}
                  penalidades={pessoa?.penalidades || []}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
