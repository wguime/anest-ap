/**
 * Confirmação da marcação — a tela onde o CUSTO é declarado antes de gravar
 * (decisão do dono 04/08: nada bloqueia em silêncio, mas nada passa sem o
 * usuário ver o que custa). Mostra dia a dia, saldo antes → depois, o custo
 * extra da 7ª vaga e os alertas de regra que a seleção CRIA (diff — não
 * repete os que já existiam).
 */
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, Badge, Button,
} from '@/design-system'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { REGRA_LABEL } from '@/lib/extratoFeriasRegras'
import { fmtBr } from './calendarioOcupacao'

export default function ConfirmarMarcacaoSheet({ open, onOpenChange, resumo, onConfirmar, gravando }) {
  if (!resumo) return null
  const marcar = resumo.linhas.filter((l) => l.acao === 'marcar')
  const desmarcar = resumo.linhas.filter((l) => l.acao === 'desmarcar')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh]">
        <SheetHeader>
          <SheetTitle>Confirmar alterações</SheetTitle>
        </SheetHeader>

        <div className="px-4 sm:px-5 pb-8 overflow-y-auto">
          {/* Saldo antes → depois */}
          <div className="flex items-center justify-between rounded-xl bg-accent dark:bg-card-elevated px-3 py-2.5 mb-3">
            <div>
              <p className="text-[11px] font-medium text-primary">Saldo de dias</p>
              <p className="flex items-center gap-2 text-lg font-bold tabular-nums text-foreground">
                {resumo.saldoAntes}
                <ArrowRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className={resumo.saldoDepois < 0 ? 'text-destructive' : ''}>{resumo.saldoDepois}</span>
              </p>
            </div>
            <p className="text-[11px] text-right text-muted-foreground">
              {resumo.diasAntes} → {resumo.diasDepois} dias<br />marcados
            </p>
          </div>

          {marcar.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1">
                Marcar ({marcar.length})
              </p>
              <ul className="divide-y divide-border mb-3">
                {marcar.map((l) => (
                  <li key={l.data} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{fmtBr(l.data)}</span>
                      {l.custoDias > 1 && (
                        <Badge variant="warning" badgeStyle="subtle">custa {l.custoDias} dias</Badge>
                      )}
                    </div>
                    {l.avisos.map((a) => (
                      <p key={a.tipo} className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                        {a.msg}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}

          {desmarcar.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive mb-1">
                Desmarcar ({desmarcar.length})
              </p>
              <ul className="divide-y divide-border mb-3">
                {desmarcar.map((l) => (
                  <li key={l.data} className="py-2 text-sm font-medium text-foreground">{fmtBr(l.data)}</li>
                ))}
              </ul>
            </>
          )}

          {resumo.custoDeclaradoExtra > 0 && (
            <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 mb-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
                Custo extra declarado: +{resumo.custoDeclaradoExtra} dia{resumo.custoDeclaradoExtra !== 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-foreground/90">
                Regra do grupo: a 7ª vaga do dia conta 3 dias de férias. O extrato mostra os dias marcados;
                o desconto extra fica registrado no log para a gestão das escalas.
              </p>
            </div>
          )}

          {resumo.avisosNovos.length > 0 && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/40 p-3 mb-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />
                {resumo.avisosNovos.length} novo{resumo.avisosNovos.length !== 1 ? 's' : ''} alerta
                {resumo.avisosNovos.length !== 1 ? 's' : ''} de regra
              </p>
              <ul className="mt-2 space-y-1.5">
                {resumo.avisosNovos.map((v) => (
                  <li key={v.id} className="text-[12px] leading-snug">
                    <span className="font-semibold text-foreground">{REGRA_LABEL[v.regra] || v.regra}</span>
                    <span className="text-muted-foreground"> — {v.detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="default"
            className="w-full"
            onClick={onConfirmar}
            disabled={gravando}
            leftIcon={gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {gravando
              ? 'Gravando...'
              : `Confirmar${resumo.custoTotal ? ` (custo: ${resumo.custoTotal} dia${resumo.custoTotal !== 1 ? 's' : ''})` : ''}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
