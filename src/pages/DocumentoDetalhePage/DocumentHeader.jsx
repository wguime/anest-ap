/**
 * DocumentHeader — header fixo (createPortal) + barra de ações
 * (Download / Imprimir / Compartilhar). Read-only para todos.
 *
 * Exporta também `DocumentActionBar` para ser inserido como slot dentro
 * do DocumentMetadata sem montar o portal de novo.
 */
import { useCallback, useMemo } from 'react';
import { Download, Printer, Share2 } from 'lucide-react';
import { useToast } from '@/design-system';
import { PageHeader } from '@/components';

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
  // title vazio em error state.
  const titulo = isErrorState ? 'Documento' : documento?.titulo || 'Documento';

  return <PageHeader title={titulo} onBack={goBack} />;
}
