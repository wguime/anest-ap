/**
 * ExtratoFeriasPage — extrato anual de férias do grupo (Pega Plantão).
 *
 * A página É o relatório: visão Coletiva (totais por sócio + alertas das
 * regras de escalação) e Individual (períodos, cota e violações de uma
 * pessoa). Período fixo 01/01–31/12 do ano corrente — renova sozinho na
 * virada. Dados via getFeriasDoAno (12 meses pelo proxy, cache 30min);
 * contagem e regras nas libs puras extratoFerias/extratoFeriasRegras.
 *
 * Sem fallback mock: erro de rede mostra retry (extrato errado é pior que
 * extrato ausente). Alertas de regra aparecem SÓ aqui (decisão do dono
 * 03/08 — nada de badge de alerta no card da Home).
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AlertTriangle, CalendarDays, UserRound, Users } from 'lucide-react'
import {
  Card, Badge, Tabs, TabsList, TabsTrigger, EmptyState, Select, Alert,
  WarningCallout, Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Skeleton,
} from '@/design-system'
import PageHeader from '@/components/PageHeader'
import { useUser } from '@/contexts/UserContext'
import { getFeriasDoAno } from '@/services/pegaPlantaoApi'
import { normalizarRegistrosFerias, construirExtrato } from '@/lib/extratoFerias'
import { getSocios } from '@/lib/feriasSocios'
import { getFeriados, FERIADOS_UTEIS } from '@/lib/feriasFeriados'
import { avaliarRegras, REGRA_LABEL, MAX_VAGAS_DIA } from '@/lib/extratoFeriasRegras'

const fmtBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Título curto para exibição: "MARCOS TADEU CURY" → "Marcos Tadeu Cury". */
const titleCase = (nome) =>
  nome
    .toLowerCase()
    .split(' ')
    .map((p) => (p.length > 2 || p.includes('.') ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ')

function statusPessoa(p) {
  if (p.diasContados > p.cota) return { label: 'Estourada', variant: 'destructive' }
  if (p.diasContados === p.cota) return { label: 'No limite', variant: 'warning' }
  return { label: `${p.saldo} restantes`, variant: 'success' }
}

// ─── Stat boxes do topo ─────────────────────────────────────────────────────
function ResumoCards({ extrato, violacoes }) {
  const criticas = violacoes.filter((v) => v.severidade === 'critical').length
  const diasNoTeto = [...extrato.porDia.values()].filter((n) => n.length >= MAX_VAGAS_DIA).length
  const stats = [
    { label: 'Dias marcados', valor: extrato.totalDiasContados, Icon: CalendarDays },
    { label: 'Sócios com férias', valor: `${extrato.totalPessoasComFerias}/${extrato.porPessoa.length}`, Icon: Users },
    { label: 'Alertas de regra', valor: violacoes.length, Icon: AlertTriangle, destaque: criticas > 0 },
    { label: `Dias com ${MAX_VAGAS_DIA}+ pessoas`, valor: diasNoTeto, Icon: UserRound },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {stats.map(({ label, valor, Icon, destaque }) => (
        <div key={label} className="rounded-xl bg-card border border-border px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon className={`w-3.5 h-3.5 ${destaque ? 'text-destructive' : ''}`} aria-hidden="true" />
            {label}
          </p>
          <p className={`text-lg font-bold tabular-nums ${destaque ? 'text-destructive' : 'text-foreground'}`}>
            {valor}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Banner de violações (agrupadas por regra) ──────────────────────────────
function AlertasBanner({ violacoes }) {
  const porRegra = useMemo(() => {
    const map = new Map()
    for (const v of violacoes) {
      if (!map.has(v.regra)) map.set(v.regra, [])
      map.get(v.regra).push(v)
    }
    return [...map.entries()]
  }, [violacoes])

  if (!violacoes.length) return null
  const criticas = violacoes.filter((v) => v.severidade === 'critical').length

  return (
    <WarningCallout
      variant={criticas > 0 ? 'critical' : 'warning'}
      title={`${violacoes.length} alerta${violacoes.length !== 1 ? 's' : ''} de regra de férias${criticas ? ` (${criticas} crítico${criticas !== 1 ? 's' : ''})` : ''}`}
      className="mb-3"
    >
      <Accordion type="multiple" className="mt-1">
        {porRegra.map(([regra, lista]) => (
          <AccordionItem key={regra} value={regra}>
            <AccordionTrigger className="text-sm py-2">
              <span className="flex items-center gap-2 text-left">
                <Badge
                  variant={lista.some((v) => v.severidade === 'critical') ? 'destructive' : 'warning'}
                  badgeStyle="subtle"
                >
                  {lista.length}
                </Badge>
                {REGRA_LABEL[regra] || regra}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1.5">
                {lista.map((v) => (
                  <li key={v.id} className="text-[13px] leading-snug text-foreground/90">
                    {v.detalhe}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </WarningCallout>
  )
}

// ─── Tabela coletiva (lista mobile-first) ───────────────────────────────────
function TabelaColetiva({ extrato, onSelectPessoa }) {
  const ordenados = useMemo(
    () => [...extrato.porPessoa].sort((a, b) => b.diasContados - a.diasContados || a.nome.localeCompare(b.nome)),
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
            className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left active:bg-muted/50 transition-colors ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground truncate">
              {titleCase(p.nome)}
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
              {p.diasContados}/{p.cota}
            </span>
            <Badge variant={status.variant} badgeStyle="subtle" className="shrink-0">
              {status.label}
            </Badge>
          </button>
        )
      })}
    </Card>
  )
}

// ─── Visão individual ───────────────────────────────────────────────────────
function ExtratoIndividual({ pessoa, violacoes, hojeISO }) {
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
  const stats = [
    { label: 'Cota do ano', valor: pessoa.cota, nota: pessoa.regraCota },
    { label: 'Dias marcados', valor: pessoa.diasContados, nota: `${gozados} gozados · ${pessoa.diasContados - gozados} por vir` },
    { label: 'Saldo', valor: pessoa.saldo, destaque: pessoa.saldo < 0 },
    { label: 'Semanas inteiras', valor: pessoa.semanas.filter((s) => s.inteira).length },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ label, valor, nota, destaque }) => (
          <div key={label} className="rounded-xl bg-card border border-border px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${destaque ? 'text-destructive' : 'text-foreground'}`}>
              {valor}
            </p>
            {nota && <p className="text-[11px] text-muted-foreground leading-tight">{nota}</p>}
          </div>
        ))}
      </div>

      {violacoesDaPessoa.length > 0 && (
        <WarningCallout
          variant={violacoesDaPessoa.some((v) => v.severidade === 'critical') ? 'critical' : 'warning'}
          title={`${violacoesDaPessoa.length} alerta${violacoesDaPessoa.length !== 1 ? 's' : ''} de regra`}
        >
          <ul className="space-y-1.5">
            {violacoesDaPessoa.map((v) => (
              <li key={v.id} className="text-[13px] leading-snug">{v.detalhe}</li>
            ))}
          </ul>
        </WarningCallout>
      )}

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Períodos marcados</p>
        {pessoa.periodos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dia de férias marcado em {pessoa.dias.length === 0 ? 'nenhuma data' : 'dias úteis'}.</p>
        ) : (
          <ul className="space-y-1.5">
            {pessoa.periodos.map((per) => (
              <li key={per.inicio} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {per.inicio === per.fim ? fmtBr(per.inicio) : `${fmtBr(per.inicio)} – ${fmtBr(per.fim)}`}
                  {per.fim < hojeISO && <span className="text-muted-foreground"> · gozado</span>}
                </span>
                <span className="font-semibold tabular-nums text-foreground shrink-0">
                  {per.diasUteis} dia{per.diasUteis !== 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pessoa.feriadosNaoContados.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
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

      {pessoa.diasContados > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Por mês</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(pessoa.porMes).sort().map(([mes, n]) => (
              <li key={mes} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{MES_LABEL[Number(mes.slice(5, 7)) - 1]}</span>
                <span className="font-semibold tabular-nums text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function ExtratoFeriasPage({ goBack }) {
  const { user } = useUser()
  const ano = new Date().getFullYear()
  const hojeISO = new Date().toISOString().slice(0, 10)

  const [registrosRaw, setRegistrosRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('coletivo')
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await getFeriasDoAno(ano)
      setRegistrosRaw(raw)
    } catch (err) {
      console.error('[ExtratoFerias] erro ao buscar férias do ano:', err.message)
      setError(err.message || 'Erro ao consultar o Pega Plantão')
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  const socios = useMemo(() => getSocios(ano), [ano])
  const feriados = useMemo(() => getFeriados(ano), [ano])
  const extrato = useMemo(() => {
    if (!registrosRaw) return null
    const registros = normalizarRegistrosFerias(registrosRaw)
    return construirExtrato({ registros, ano, socios, feriados })
  }, [registrosRaw, ano, socios, feriados])
  const violacoes = useMemo(
    () => (extrato ? avaliarRegras(extrato, { feriados }) : []),
    [extrato, feriados]
  )

  // Individual: default = o próprio usuário, quando o nome do login casa com um sócio
  useEffect(() => {
    if (pessoaSelecionada || !extrato) return
    const displayUpper = (user?.displayName || '').trim().toUpperCase()
    const match = extrato.porPessoa.find((p) => p.nome === displayUpper)
    if (match) setPessoaSelecionada(match.nome)
  }, [extrato, user, pessoaSelecionada])

  const opcoesPessoa = useMemo(
    () =>
      (extrato?.porPessoa || [])
        .map((p) => ({ value: p.nome, label: titleCase(p.nome) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [extrato]
  )

  const pessoa = extrato?.porPessoa.find((p) => p.nome === pessoaSelecionada) || null

  const selecionarPessoa = (nome) => {
    setPessoaSelecionada(nome)
    setTab('individual')
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Extrato de Férias"
        subtitle={`01/01 – 31/12/${ano}`}
        onBack={goBack}
      />

      <div className="px-4 sm:px-5 pt-2">
        <Tabs value={tab} onValueChange={setTab} variant="pills">
          <TabsList className="mb-3">
            <TabsTrigger value="coletivo" className="flex-1">Coletivo</TabsTrigger>
            <TabsTrigger value="individual" className="flex-1">Individual</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
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
                {extrato.naoReconhecidos.map((n) => `${titleCase(n.nome)} (${n.dias} dia${n.dias !== 1 ? 's' : ''})`).join(' · ')}
                {' '}— atualizar src/lib/feriasSocios.js.
              </Alert>
            )}

            {tab === 'coletivo' ? (
              extrato.totalDiasContados === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="w-8 h-8" />}
                  title="Nenhuma férias marcada"
                  description={`Nenhum registro de férias no Pega Plantão em ${ano}.`}
                />
              ) : (
                <>
                  <ResumoCards extrato={extrato} violacoes={violacoes} />
                  <AlertasBanner violacoes={violacoes} />
                  <TabelaColetiva extrato={extrato} onSelectPessoa={selecionarPessoa} />
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
                <ExtratoIndividual pessoa={pessoa} violacoes={violacoes} hojeISO={hojeISO} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
