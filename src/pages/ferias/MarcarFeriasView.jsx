/**
 * MarcarFeriasView — aba "Marcar" do Extrato de Férias.
 *
 * Marcação SELF-SERVICE (decisão do dono 04/08): o sócio toca os dias no
 * calendário de ocupação — vendo quantas vagas cada dia já tem —, revisa
 * numa barra fixa e confirma num sheet que declara o custo. Só as próprias
 * férias (a RLS garante; a UI nem oferece outro nome).
 *
 * Prazos bloqueiam (marcar exige dia futuro; desmarcar, depois de amanhã);
 * dia lotado e estouro de cota apenas exigem confirmação — REGRAS ESCALAS.
 */
import { useState, useMemo, useCallback } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { Card, Button, Badge, useToast } from '@/design-system'
import { CalendarioOcupacao, Legenda } from './calendarioOcupacao'
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
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [selecoes, setSelecoes] = useState(vazio)
  const [sheetAberto, setSheetAberto] = useState(false)
  const [gravando, setGravando] = useState(false)

  const pessoa = extrato?.porPessoa.find((p) => p.nome === nome)
  const porDia = extrato?.porDia || new Map()

  // Dias que já são meus (ativos) — chave do dia → {codigo, origem}
  const estadoPorDia = useMemo(() => indexarPorPessoaDia(registrosEfetivos), [registrosEfetivos])
  const meusDias = useMemo(() => {
    const out = new Map()
    for (const [k, v] of estadoPorDia) {
      const [n, data] = k.split('|')
      if (n === nome) out.set(data, v)
    }
    return out
  }, [estadoPorDia, nome])

  const motivoBloqueio = useCallback(
    (dia) => {
      if (meusDias.has(dia)) {
        return avaliarDesmarcacaoDia({ data: dia, nome, estadoPorDia, hojeISO }).bloqueio?.msg || null
      }
      return avaliarMarcacaoDia({ data: dia, nome, porDia, estadoPorDia, hojeISO, feriados }).bloqueio?.msg || null
    },
    [meusDias, nome, estadoPorDia, hojeISO, porDia, feriados]
  )

  const alternarDia = useCallback(
    (dia) => {
      setSelecoes((atual) => {
        const marcar = new Set(atual.marcar)
        const desmarcar = new Set(atual.desmarcar)
        if (marcar.has(dia)) { marcar.delete(dia); return { marcar, desmarcar } }
        if (desmarcar.has(dia)) { desmarcar.delete(dia); return { marcar, desmarcar } }

        const ehMeu = meusDias.has(dia)
        const aval = ehMeu
          ? avaliarDesmarcacaoDia({ data: dia, nome, estadoPorDia, hojeISO })
          : avaliarMarcacaoDia({ data: dia, nome, porDia, estadoPorDia, hojeISO, feriados })
        if (!aval.ok) {
          toast({ title: 'Não é possível', description: aval.bloqueio.msg, variant: 'warning' })
          return atual
        }
        if (ehMeu) desmarcar.add(dia)
        else marcar.add(dia)
        return { marcar, desmarcar }
      })
    },
    [meusDias, nome, estadoPorDia, hojeISO, porDia, feriados, toast]
  )

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
          Seu login não está vinculado a um sócio da lista — marcação indisponível.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{pessoa.nomeCompleto}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {pessoa.diasContados} de {pessoa.cota} dias marcados ·{' '}
          <span className={pessoa.saldo < 0 ? 'text-destructive font-semibold' : 'font-semibold text-foreground'}>
            {pessoa.saldo < 0 ? `${-pessoa.saldo} acima da cota` : `${pessoa.saldo} disponíveis`}
          </span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Toque nos dias para marcar; nos seus dias (contorno verde) para desmarcar.
        </p>
      </Card>

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

      {/* Barra de revisão — fixa acima da bottom nav */}
      {total > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 sm:px-5">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-3 shadow-[0_4px_16px_rgba(0,66,37,0.14)] dark:shadow-none">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {selecoes.marcar.size > 0 && (
                <Badge variant="success" badgeStyle="subtle">
                  {selecoes.marcar.size} marcar
                </Badge>
              )}
              {selecoes.desmarcar.size > 0 && (
                <Badge variant="destructive" badgeStyle="subtle">
                  {selecoes.desmarcar.size} desmarcar
                </Badge>
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
                leftIcon={<CalendarPlus className="w-4 h-4" />}
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
