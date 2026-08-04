/**
 * MarcarFeriasView — aba "Agendar" do Extrato de Férias.
 *
 * Agendamento SELF-SERVICE (decisão do dono 04/08): dois modos explícitos
 * (Marcar / Desmarcar) em vez de um calendário que adivinha a intenção —
 * em Marcar tocam-se os dias livres; em Desmarcar aparece a LISTA das
 * férias ainda não cumpridas (o caminho fácil) além do calendário.
 * Só as próprias férias (a RLS garante; a UI nem oferece outro nome).
 *
 * Prazos bloqueiam (marcar exige dia futuro; desmarcar, depois de amanhã);
 * dia lotado e estouro de cota apenas exigem confirmação — REGRAS ESCALAS.
 */
import { useState, useMemo, useCallback } from 'react'
import { CalendarPlus, CalendarX2, ClipboardCheck, X } from 'lucide-react'
import { Card, Button, useToast } from '@/design-system'
import { CalendarioOcupacao, Legenda, fmtBr } from './calendarioOcupacao'
import ConfirmarMarcacaoSheet from './ConfirmarMarcacaoSheet'
import {
  avaliarMarcacaoDia, avaliarDesmarcacaoDia, montarResumoConfirmacao,
  montarMovimentacoesParaInsert,
} from '@/lib/feriasMarcacao'
import { indexarPorPessoaDia, filtrarNoOps } from '@/lib/feriasMovimentacoes'
import {
  fetchMovimentacoes, registrarMovimentacoes,
} from '@/services/supabaseFeriasMovimentacoesService'

const vazio = () => ({ marcar: new Set(), desmarcar: new Set() })
const titleCase = (n) => n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

export default function MarcarFeriasView({
  ano, nome, socios, feriados, hojeISO, extrato, violacoes,
  registrosPP, registrosEfetivos, movimentacoes, user, onGravado,
}) {
  const { toast } = useToast()
  // null = navegando (toque mostra quem está de férias no dia); só depois de
  // escolher a operação o calendário entra em seleção (dono 04/08: o modo
  // ativo tem que ser evidente e ter saída)
  const [modo, setModo] = useState(null) // null | 'marcar' | 'desmarcar'
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [selecoes, setSelecoes] = useState(vazio)
  const [diaDetalhe, setDiaDetalhe] = useState(null)
  const [sheetAberto, setSheetAberto] = useState(false)
  const [gravando, setGravando] = useState(false)

  const pessoa = extrato?.porPessoa.find((p) => p.nome === nome)
  const porDia = extrato?.porDia || new Map()

  const estadoPorDia = useMemo(() => indexarPorPessoaDia(registrosEfetivos), [registrosEfetivos])
  const meusDias = useMemo(() => {
    const out = new Map()
    for (const [k, v] of estadoPorDia) {
      const [n, data] = k.split('|')
      if (n === nome) out.set(data, v)
    }
    return out
  }, [estadoPorDia, nome])

  /** Férias ainda NÃO cumpridas — a lista que facilita desmarcar. */
  const agendadas = useMemo(
    () =>
      [...meusDias.keys()]
        .filter((d) => d > hojeISO)
        .sort()
        .map((data) => ({
          data,
          podeDesmarcar: avaliarDesmarcacaoDia({ data, nome, estadoPorDia, hojeISO }).ok,
        })),
    [meusDias, hojeISO, nome, estadoPorDia]
  )

  const motivoBloqueio = useCallback(
    (dia) => {
      if (modo === 'desmarcar') {
        if (!meusDias.has(dia)) return 'Você não tem férias neste dia'
        return avaliarDesmarcacaoDia({ data: dia, nome, estadoPorDia, hojeISO }).bloqueio?.msg || null
      }
      if (meusDias.has(dia)) return 'Você já tem férias neste dia'
      return avaliarMarcacaoDia({ data: dia, nome, porDia, estadoPorDia, hojeISO, feriados }).bloqueio?.msg || null
    },
    [modo, meusDias, nome, estadoPorDia, hojeISO, porDia, feriados]
  )

  const alternarDia = useCallback(
    (dia) => {
      setSelecoes((atual) => {
        const marcar = new Set(atual.marcar)
        const desmarcar = new Set(atual.desmarcar)
        if (marcar.has(dia)) { marcar.delete(dia); return { marcar, desmarcar } }
        if (desmarcar.has(dia)) { desmarcar.delete(dia); return { marcar, desmarcar } }

        const querDesmarcar = modo === 'desmarcar'
        const aval = querDesmarcar
          ? avaliarDesmarcacaoDia({ data: dia, nome, estadoPorDia, hojeISO })
          : avaliarMarcacaoDia({ data: dia, nome, porDia, estadoPorDia, hojeISO, feriados })
        if (!aval.ok) {
          toast({ title: 'Não é possível', description: aval.bloqueio.msg, variant: 'warning' })
          return atual
        }
        if (querDesmarcar) desmarcar.add(dia)
        else marcar.add(dia)
        return { marcar, desmarcar }
      })
    },
    [modo, nome, estadoPorDia, hojeISO, porDia, feriados, toast]
  )

  const trocarModo = (novo) => {
    setModo(novo)
    setSelecoes(vazio())
    setDiaDetalhe(null)
  }
  const sairDoModo = () => trocarModo(null)

  const total = selecoes.marcar.size + selecoes.desmarcar.size

  const resumo = useMemo(() => {
    if (!total || !extrato) return null
    return montarResumoConfirmacao({
      registrosPP, movimentacoes, selecoes, nome, ano, socios, feriados,
      hojeISO, violacoesAtuais: violacoes, estadoPorDia, porDia,
    })
  }, [total, extrato, registrosPP, movimentacoes, selecoes, nome, ano, socios, feriados, hojeISO, violacoes, estadoPorDia, porDia])

  const confirmar = async () => {
    setGravando(true)
    try {
      const userId = user?.uid || user?.id
      const reqId = crypto.randomUUID()
      const rows = montarMovimentacoesParaInsert({ selecoes, nome, ano, estadoPorDia, resumo, userId, reqId })

      // Preflight anti-corrida: alguém (ou outro device) pode ter mexido
      const frescas = await fetchMovimentacoes(ano)
      const efetivas = filtrarNoOps(rows, frescas, registrosPP)
      if (!efetivas.length) {
        toast({ title: 'Nada a fazer', description: 'Esses dias já estavam no estado desejado.', variant: 'warning' })
        setSelecoes(vazio()); setSheetAberto(false)
        await onGravado?.()
        return
      }

      await registrarMovimentacoes(efetivas)
      const nMarcar = efetivas.filter((r) => r.acao === 'marcar').length
      const nDesmarcar = efetivas.length - nMarcar
      toast({
        title: 'Férias atualizadas',
        description: [
          nMarcar ? `${nMarcar} dia${nMarcar !== 1 ? 's' : ''} marcado${nMarcar !== 1 ? 's' : ''}` : null,
          nDesmarcar ? `${nDesmarcar} desmarcado${nDesmarcar !== 1 ? 's' : ''}` : null,
        ].filter(Boolean).join(' · '),
        variant: 'success',
      })
      setSelecoes(vazio()); setSheetAberto(false)
      await onGravado?.()
    } catch (err) {
      console.error('[MarcarFerias] erro ao gravar:', err?.message)
      // A RLS recusa por dois motivos: prazo (relógio do servidor) ou login
      // fora do allowlist de sócios — a mensagem cobre os dois sem mentir
      const rls = err?.message?.includes('row-level security')
      toast({
        title: 'Não foi possível gravar',
        description: rls
          ? 'O servidor recusou: confira se o dia ainda está no prazo e se o seu login é um dos sócios habilitados.'
          : err?.message || 'Tente novamente.',
        variant: 'error',
      })
    } finally {
      setGravando(false)
    }
  }

  if (!pessoa) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Seu login não está vinculado a um sócio da lista — agendamento indisponível.
        </p>
      </Card>
    )
  }

  const desmarcando = modo === 'desmarcar'

  return (
    <div className="space-y-3">
      {/* Cabeçalho: nome e saldo como números-herói (dono 04/08 — a linha
          corrida em cinza escondia a informação que mais importa) */}
      <Card className="p-4">
        <p className="text-sm font-bold text-foreground">{pessoa.nomeCompleto}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-accent dark:bg-card-elevated px-3 py-2">
            <p className="text-[11px] font-medium text-primary">Dias marcados</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {pessoa.diasContados}
              <span className="text-[13px] font-medium text-muted-foreground"> / {pessoa.cota}</span>
            </p>
          </div>
          <div className="rounded-xl bg-accent dark:bg-card-elevated px-3 py-2">
            <p className="text-[11px] font-medium text-primary">
              {pessoa.saldo < 0 ? 'Acima da cota' : 'Disponíveis'}
            </p>
            <p className={`text-lg font-bold tabular-nums ${pessoa.saldo < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {pessoa.saldo < 0 ? -pessoa.saldo : pessoa.saldo}
            </p>
          </div>
        </div>
      </Card>

      {/* Modo desmarcar: as férias que ainda não foram cumpridas */}
      {desmarcando && (
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-2">
            <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Férias agendadas ({agendadas.length})
          </p>
          {agendadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você não tem férias futuras marcadas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {agendadas.map(({ data, podeDesmarcar }) => {
                const escolhido = selecoes.desmarcar.has(data)
                return (
                  <li key={data} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-sm text-foreground">
                      {fmtBr(data)}
                      {!podeDesmarcar && (
                        <span className="ml-2 text-[11px] text-muted-foreground">escala já publicada</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant={escolhido ? 'default' : 'outline'}
                      className="h-8 min-h-0 px-3 text-xs"
                      disabled={!podeDesmarcar}
                      onClick={() => alternarDia(data)}
                    >
                      {escolhido ? 'Selecionado' : 'Desmarcar'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-4">
        {/* Faixa de MODO ATIVO: sem ela não dava para saber que a próxima
            toque marca ou desmarca (dono 04/08) */}
        {modo && (
          <div
            className={`-mt-1 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ${
              desmarcando ? 'bg-destructive/10' : 'bg-primary/10'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${desmarcando ? 'bg-destructive' : 'bg-primary'}`}
            />
            <span className={`text-[13px] font-semibold ${desmarcando ? 'text-destructive' : 'text-primary'}`}>
              {desmarcando ? 'Desmarcando férias' : 'Marcando férias'}
            </span>
            <button
              type="button"
              onClick={sairDoModo}
              className="ml-auto inline-flex items-center gap-1 min-h-[36px] px-2 text-[12px] font-medium text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Sair
            </button>
          </div>
        )}

        <CalendarioOcupacao
          ano={ano}
          porDia={porDia}
          mes={mes}
          onSelectMes={setMes}
          modo={modo ? 'selecao' : 'detalhe'}
          meusDias={meusDias}
          selecionados={selecoes}
          onToggleDia={alternarDia}
          motivoBloqueio={motivoBloqueio}
          onSelectDia={setDiaDetalhe}
          diaSelecionado={diaDetalhe}
        />
        <Legenda mostrarMeusDias />

        {/* Sem modo ativo o toque informa quem está de férias no dia */}
        {!modo && diaDetalhe && (
          <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[13px]">
            <span className="font-semibold text-foreground">
              {fmtBr(diaDetalhe)} · {(porDia.get(diaDetalhe) || []).length} de férias
            </span>
            {(porDia.get(diaDetalhe) || []).length > 0 && (
              <span className="text-muted-foreground">
                {' '}— {(porDia.get(diaDetalhe) || []).map(titleCase).join(', ')}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* ÚNICO painel de ação (dono 04/08: dois pares de botões brigavam).
          Sem seleção = escolher a operação; com seleção = confirmar. Fixo
          na base para acompanhar a rolagem do calendário. */}
      <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 sm:px-5">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-3 shadow-[0_4px_16px_rgba(0,66,37,0.14)] dark:shadow-none">
          {total === 0 && !modo ? (
            // Estado neutro: escolher o que fazer
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  onClick={() => trocarModo('marcar')}
                  leftIcon={<CalendarPlus className="w-4 h-4" />}
                >
                  Marcar férias
                </Button>
                <Button
                  variant="outline"
                  onClick={() => trocarModo('desmarcar')}
                  leftIcon={<CalendarX2 className="w-4 h-4" />}
                >
                  Desmarcar
                </Button>
              </div>
              <p className="mt-2 text-center text-[12px] text-muted-foreground">
                Escolha o que quer fazer para liberar o calendário
              </p>
            </>
          ) : total === 0 ? (
            // Modo ativo, nada escolhido ainda
            <>
              <p className="mb-2 text-center text-[13px] text-muted-foreground">
                {desmarcando
                  ? 'Toque nas suas férias (contorno verde) ou use a lista acima'
                  : 'Toque nos dias livres que quer agendar'}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={sairDoModo}
                leftIcon={<X className="w-4 h-4" />}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <p className="mb-2 text-center text-[13px]">
                <span className="font-semibold text-foreground">
                  {total} dia{total !== 1 ? 's' : ''} para {desmarcando ? 'desmarcar' : 'marcar'}
                </span>
                {resumo && (
                  <span className="text-muted-foreground">
                    {' '}· saldo {resumo.saldoAntes} →{' '}
                    <span className="font-semibold text-foreground">{resumo.saldoDepois}</span>
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={sairDoModo}
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Cancelar
                </Button>
                <Button
                  variant={desmarcando ? 'destructive' : 'default'}
                  className="flex-1"
                  onClick={() => setSheetAberto(true)}
                  leftIcon={desmarcando ? <CalendarX2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                >
                  {desmarcando ? 'Desmarcar' : 'Confirmar'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Espaço p/ o painel fixo não cobrir o fim do conteúdo */}
      <div className="h-32" aria-hidden="true" />

      <ConfirmarMarcacaoSheet
        open={sheetAberto}
        onOpenChange={setSheetAberto}
        resumo={resumo}
        onConfirmar={confirmar}
        gravando={gravando}
      />
    </div>
  )
}
