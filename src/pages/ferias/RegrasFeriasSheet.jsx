/**
 * Regras de férias — consulta rápida dentro do extrato (dono 04/08), para
 * não ter que abrir o PDF no meio da marcação. Temas em accordion + FAQ,
 * e o documento completo VISÍVEL NO APP (mesmo padrão da Biblioteca de
 * Documentos: PDFViewer do DS, sem download).
 *
 * O selo "o app verifica" marca as regras que o motor de alertas cobre —
 * deixa explícito o que NÃO é verificado automaticamente e continua
 * dependendo do combinado com o coordenador.
 */
import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, Badge, Button, useToast,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent, PDFViewer,
} from '@/design-system'
import { CheckCircle2, HelpCircle, FileText, Loader2, ArrowLeft } from 'lucide-react'
import { REGRAS_FERIAS, FAQ_FERIAS } from '@/data/feriasRegrasTexto'
import { generate } from '@/services/pdf/pdfService'

export default function RegrasFeriasSheet({ open, onOpenChange, ano, geradoPor }) {
  const { toast } = useToast()
  const [pdfUrl, setPdfUrl] = useState(null)
  const [gerando, setGerando] = useState(false)

  // Object URL do PDF gerado em memória — precisa ser revogado, senão o
  // blob fica preso enquanto a aba viver
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  // Fechar o sheet descarta o documento aberto
  useEffect(() => {
    if (!open && pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }
  }, [open, pdfUrl])

  const abrirDocumento = useCallback(async () => {
    setGerando(true)
    try {
      const blob = await generate('feriasRegrasReport', { ano, geradoPor })
      setPdfUrl(URL.createObjectURL(blob))
    } catch (err) {
      console.error('[RegrasFerias] falha ao montar o documento:', err?.message)
      toast({ title: 'Não foi possível abrir', description: err.message, variant: 'error' })
    } finally {
      setGerando(false)
    }
  }, [ano, geradoPor, toast])

  const fecharDocumento = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{pdfUrl ? 'Documento de regras' : 'Regras de férias'}</SheetTitle>
        </SheetHeader>

        {pdfUrl ? (
          // Documento completo dentro do app (padrão Biblioteca)
          <div className="px-4 sm:px-5 pb-8 overflow-y-auto">
            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={fecharDocumento}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar às regras
            </Button>
            {/* Suspense LOCAL: PDFViewer é export lazy — sem boundary aqui
                o React mantém a árvore anterior e o documento nunca aparece */}
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 h-[60vh] rounded-xl bg-muted/40 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Carregando documento...
                </div>
              }
            >
              <PDFViewer src={pdfUrl} title={`Regras de Férias ${ano}`} height="60vh" showTitle={false} />
            </Suspense>
          </div>
        ) : (
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

            {/* Documento completo NO APP — sem download (dono 04/08) */}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={abrirDocumento}
              disabled={gerando}
              leftIcon={gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            >
              {gerando ? 'Abrindo documento...' : 'Ver documento completo'}
            </Button>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Resumo do documento REGRAS DE ESCALAÇÃO do grupo (seções Férias, Feriados, Prazos,
              Licenças e Penalidades). Em caso de divergência, vale o documento oficial.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
