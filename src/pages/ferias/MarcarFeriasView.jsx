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
import { CalendarPlus, CalendarX2, Trash2, ClipboardCheck } from 'lucide-react'
import { Card, Button, Badge, useToast } from '@/design-system'
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

export default function MarcarFeriasView({
  ano, nome, socios, feriados, hojeISO, extrato, violacoes,
  registrosPP, registrosEfetivos, movimentacoes, user, onGravado,
}) {
  const { toast } = useToast()
  const [modo, setModo] = useState('marcar') // 'marcar' | 'desmarcar'
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [selecoes, setSelecoes] = useState(vazio)
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
  }

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
        <CalendarioOcupacao
          ano={ano}
          porDia={porDia}
          mes={mes}
          onSelectMes={setMes}
          modo="selecao"
          meusDias={meusDias}
          selecionados={selecoes}
          onToggleDia={alternarDia}
          motivoBloqueio={motivoBloqueio}
        />
        <Legenda mostrarMeusDias />
      </Card>

      {/* Modo de ação DEPOIS do calendário (dono 04/08) */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={desmarcando ? 'outline' : 'default'}
            onClick={() => trocarModo('marcar')}
            aria-pressed={!desmarcando}
            leftIcon={<CalendarPlus className="w-4 h-4" />}
          >
            Marcar
          </Button>
          <Button
            variant={desmarcando ? 'default' : 'outline'}
            onClick={() => trocarModo('desmarcar')}
            aria-pressed={desmarcando}
            leftIcon={<CalendarX2 className="w-4 h-4" />}
          >
            Desmarcar
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          {desmarcando
            ? 'Toque nas suas férias (contorno verde) ou use a lista acima.'
            : 'Toque nos dias livres que quer agendar.'}
        </p>
      </Card>

      {/* Espaçador: a barra fixa de revisão cobria os botões de modo, que
          são o último card da página (dono 04/08) */}
      {total > 0 && <div className="h-36" aria-hidden="true" />}

      {/* Barra de revisão — fixa acima da bottom nav */}
      {total > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 sm:px-5">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-3 shadow-[0_4px_16px_rgba(0,66,37,0.14)] dark:shadow-none">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {selecoes.marcar.size > 0 && (
                <Badge variant="success" badgeStyle="subtle">{selecoes.marcar.size} marcar</Badge>
              )}
              {selecoes.desmarcar.size > 0 && (
                <Badge variant="destructive" badgeStyle="subtle">{selecoes.desmarcar.size} desmarcar</Badge>
              )}
              {resumo && (
                <span className="text-[12px] text-muted-foreground">
                  saldo {resumo.saldoAntes} → <span className="font-semibold text-foreground">{resumo.saldoDepois}</span>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelecoes(vazio())}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Limpar
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setSheetAberto(true)}
                leftIcon={<ClipboardCheck className="w-4 h-4" />}
              >
                Revisar
              </Button>
            </div>
          </div>
        </div>
      )}

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
