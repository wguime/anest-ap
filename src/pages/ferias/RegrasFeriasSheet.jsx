/**
 * Regras de férias — consulta rápida dentro do extrato (dono 04/08), para
 * não ter que abrir o PDF no meio da marcação. Temas em accordion + FAQ.
 *
 * O selo "o app verifica" marca as regras que o motor de alertas cobre —
 * deixa explícito o que NÃO é verificado automaticamente e continua
 * dependendo do combinado com o coordenador.
 */
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, Badge, Button, useToast,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/design-system'
import { CheckCircle2, HelpCircle, FileDown, Loader2 } from 'lucide-react'
import { REGRAS_FERIAS, FAQ_FERIAS } from '@/data/feriasRegrasTexto'
import { usePdfExport } from '@/hooks/usePdfExport'

export default function RegrasFeriasSheet({ open, onOpenChange, ano, geradoPor }) {
  const { exportPdf, exporting } = usePdfExport()
  const { toast } = useToast()

  const baixarPdf = async () => {
    try {
      await exportPdf('feriasRegrasReport', { ano, geradoPor })
    } catch (err) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'error' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>Regras de férias</SheetTitle>
        </SheetHeader>

        <div className="px-4 sm:px-5 pb-8 overflow-y-auto">
          <p className="mb-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-success" aria-hidden="true" />
            marca as regras que o app confere sozinho e alerta no extrato
          </p>

          <Accordion type="multiple">
            {REGRAS_FERIAS.map((tema) => (
              <AccordionItem key={tema.id} value={tema.id}>
                <AccordionTrigger className="text-sm py-3">
                  <span className="text-left font-semibold text-foreground">{tema.titulo}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5">
                    {tema.itens.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {item.verificada ? (
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-success" aria-label="verificada pelo app" />
                        ) : (
                          <span className="w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-[13px] leading-relaxed text-foreground/90">{item.texto}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}

            <AccordionItem value="faq">
              <AccordionTrigger className="text-sm py-3">
                <span className="flex items-center gap-2 text-left font-semibold text-foreground">
                  <HelpCircle className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
                  Perguntas frequentes
                  <Badge variant="default" badgeStyle="subtle">{FAQ_FERIAS.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {FAQ_FERIAS.map((item, i) => (
                    <li key={i}>
                      <p className="text-[13px] font-semibold text-foreground">{item.p}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.r}</p>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* PDF só das regras de férias — consulta fora do app e para
              circular no grupo (dono 04/08) */}
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={baixarPdf}
            disabled={exporting}
            leftIcon={exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          >
            {exporting ? 'Gerando PDF...' : 'Baixar regras em PDF'}
          </Button>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Resumo do documento REGRAS DE ESCALAÇÃO do grupo (seções Férias, Feriados, Prazos,
            Licenças e Penalidades). Em caso de divergência, vale o documento oficial.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
