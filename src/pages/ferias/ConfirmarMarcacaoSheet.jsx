/**
 * Confirmação da marcação — dia a dia, saldo antes → depois, e o que a
 * seleção CRIA (diff — não repete o que já existia). Regras 2026/27: o que
 * quebra uma regra [TRAVA] aparece com o código (V-xx) e o botão fica
 * desabilitado; o resto (ex.: candidato acima das 6 vagas) é aviso que segue
 * para o comitê de escalas.
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
          {/* Título espelha a operação — o sheet é a 2ª metade do mesmo
              gesto, não uma tela genérica (dono 04/08) */}
          <SheetTitle>
            {desmarcar.length && !marcar.length
              ? `Desmarcar ${desmarcar.length} dia${desmarcar.length !== 1 ? 's' : ''} de férias`
              : marcar.length && !desmarcar.length
                ? `Marcar ${marcar.length} dia${marcar.length !== 1 ? 's' : ''} de férias`
                : 'Confirmar alterações'}
          </SheetTitle>
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
                  <li key={l.data} className="py-2">
                    <span className="text-sm font-medium text-foreground">{fmtBr(l.data)}</span>
                    {l.avisos.map((a) => (
                      <p key={a.tipo} className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{a.msg}</p>
                    ))}
                  </li>
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
                Marcação feita antes das regras de 18/11/2026: a 7ª vaga do dia conta 3 dias de férias. O extrato mostra os dias marcados;
                o desconto extra fica registrado no log para a gestão das escalas.
              </p>
            </div>
          )}

          {/* Marcação além da cota: o custo é institucional, não só um
              número — quem confirma precisa saber que o Comitê é avisado
              (REGRAS, Penalidades; dono 04/08) */}
          {resumo.saldoDepois < 0 && (
            <div role="alert" className="rounded-xl bg-destructive/10 border border-destructive/40 p-3 mb-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />
                {-resumo.saldoDepois} dia{resumo.saldoDepois !== -1 ? 's' : ''} além do seu direito
              </p>
              <p className="mt-1 text-[12px] leading-snug text-foreground/90">
                Você está marcando mais dias do que a sua cota permite. Pela regra do grupo, dia de
                férias irregular é descontado do total — e <strong>o Comitê de Ética será informado</strong>
                {' '}desta marcação.
              </p>
            </div>
          )}

          {/* Seção 9 das regras: o app bloqueia, mostra o código e o motivo */}
          {resumo.bloqueios?.length > 0 && (
            <div role="alert" className="rounded-xl bg-destructive/10 border border-destructive/40 p-3 mb-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />
                Não é possível confirmar: {resumo.bloqueios.length === 1 ? 'a seleção quebra uma regra' : `a seleção quebra ${resumo.bloqueios.length} regras`}
              </p>
              <ul className="mt-2 space-y-1.5">
                {resumo.bloqueios.map((v) => (
                  <li key={v.id} className="text-[12px] leading-snug">
                    <span className="font-semibold text-foreground">{v.codigo} · {v.label}</span>
                    <span className="text-muted-foreground"> — {v.detalhe}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] leading-snug text-foreground/90">
                Ajuste os dias. Exceção só com aprovação do comitê de escalas.
              </p>
            </div>
          )}

          {resumo.avisosNovos.length > 0 && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/40 p-3 mb-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />
                {resumo.avisosNovos.length} aviso{resumo.avisosNovos.length !== 1 ? 's' : ''} para o comitê
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
            variant={desmarcar.length && !marcar.length ? 'destructive' : 'default'}
            className="w-full"
            onClick={onConfirmar}
            disabled={gravando || resumo.bloqueios?.length > 0}
            leftIcon={gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {gravando
              ? 'Gravando...'
              : resumo.bloqueios?.length > 0
                ? 'Ajuste a seleção para confirmar'
              : desmarcar.length && !marcar.length
                ? `Desmarcar ${desmarcar.length} dia${desmarcar.length !== 1 ? 's' : ''}`
                : resumo.saldoDepois < 0
                  ? 'Confirmar mesmo assim'
                  : `Confirmar${resumo.custoTotal ? ` (custo: ${resumo.custoTotal} dia${resumo.custoTotal !== 1 ? 's' : ''})` : ''}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
