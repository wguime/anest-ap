/**
 * DocumentHeader — header fixo (createPortal) + barra de ações
 * (Download / Imprimir / Compartilhar). Read-only para todos.
 *
 * Exporta também `DocumentActionBar` para ser inserido como slot dentro
 * do DocumentMetadata sem montar o portal de novo.
 */
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Download, Printer, Share2 } from 'lucide-react';
import { useToast } from '@/design-system';

// =============================================================================
// DocumentActionBar — só os 3 botões (Download / Imprimir / Share).
// Renderizado inline; usado pelo metadata card.
// =============================================================================
export function DocumentActionBar({ documento, pdfDisplayUrl }) {
  const { toast } = useToast();

  const fileBaseName = useMemo(() => {
    const codigo = documento?.codigo || 'documento';
    return `${codigo}.pdf`;
  }, [documento?.codigo]);

  const handleDownload = useCallback(() => {
    if (!pdfDisplayUrl) {
      toast({
        title: 'Arquivo indisponível',
        description: 'Nenhum PDF associado a este documento.',
        variant: 'error',
      });
      return;
    }
    const a = document.createElement('a');
    a.href = pdfDisplayUrl;
    a.download = fileBaseName;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfDisplayUrl, fileBaseName, toast]);

  const handlePrint = useCallback(() => {
    if (!pdfDisplayUrl) {
      toast({
        title: 'Arquivo indisponível',
        description: 'Nenhum PDF associado a este documento.',
        variant: 'error',
      });
      return;
    }
    try {
      const win = window.open(pdfDisplayUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        toast({
          title: 'Pop-up bloqueado',
          description: 'Permita pop-ups para imprimir o documento.',
          variant: 'warning',
        });
      }
    } catch (err) {
      console.warn('[DocumentoDetalhe] Falha ao imprimir:', err.message);
      toast({ title: 'Erro ao imprimir', description: err.message, variant: 'error' });
    }
  }, [pdfDisplayUrl, toast]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: documento?.titulo || 'Documento ANEST',
      text: documento?.descricao || documento?.titulo || '',
      url: pdfDisplayUrl || window.location.href,
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        toast({ title: 'Link copiado', variant: 'success' });
        return;
      }
      toast({
        title: 'Compartilhamento indisponível',
        description: 'Seu navegador não suporta compartilhar nem copiar.',
        variant: 'warning',
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // eslint-disable-next-line no-console
      console.warn('[DocumentoDetalhe] Falha ao compartilhar:', err.message);
      toast({ title: 'Erro ao compartilhar', description: err.message, variant: 'error' });
    }
  }, [documento?.titulo, documento?.descricao, pdfDisplayUrl, toast]);

  if (!documento) return null;

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Ações do documento"
      data-testid="document-actions"
    >
      <button
        type="button"
        onClick={handleDownload}
        disabled={!pdfDisplayUrl}
        aria-label={`Baixar ${documento.titulo}`}
        title="Baixar"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handlePrint}
        disabled={!pdfDisplayUrl}
        aria-label={`Imprimir ${documento.titulo}`}
        title="Imprimir"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Printer className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Compartilhar ${documento.titulo}`}
        title="Compartilhar"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Share2 className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function DocumentHeader({ documento, goBack, isErrorState = false }) {
  // Header fixo via Portal — title vazio em error state.
  const titulo = isErrorState ? 'Documento' : documento?.titulo || 'Documento';

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {titulo}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return createPortal(headerElement, document.body);
}
