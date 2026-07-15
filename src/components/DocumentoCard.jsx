import { memo } from 'react';
import { Lock } from 'lucide-react';
import { Badge, Tooltip } from '@/design-system';
import { OcrStatusBadge } from '@/components/OcrStatusBadge';
import { PdfaStatusBadge } from '@/components/PdfaStatusBadge';
import { isOcrEnabled, isPdfaEnabled } from '@/utils/featureFlags';
import { getTipoDisplayConfig } from '@/types/documents';

/**
 * DocumentoCard - Widget para grid de documentos (segue padrao DS WidgetCard)
 * Memoizado para evitar re-renders quando contextos globais atualizam.
 * @param {object} documento - Dados do documento
 * @param {function} onClick - Callback ao clicar no card
 */
const DocumentoCard = memo(function DocumentoCard({ documento, onClick }) {
  const { titulo, codigo, tipo, versaoAtual, legalHold, legalHoldReason, ocrStatus, pdfaStatus } = documento;
  const showOcrBadge =
    isOcrEnabled() && ['pending', 'processing', 'failed'].includes(ocrStatus);
  const showPdfaBadge =
    isPdfaEnabled() && ['pending', 'processing', 'failed'].includes(pdfaStatus);

  // Cores e labels por tipo — SSOT em TIPO_DISPLAY_CONFIG (types/documents.js).
  // O mapa local anterior não conhecia os tipos novos de CATEGORY_SUBSECTIONS
  // (politicas, formularios, tabelas, ...) e rotulava tudo como "Protocolo".
  const config = getTipoDisplayConfig(tipo);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full h-full min-h-[140px] flex flex-col text-left rounded-[20px] p-4 bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98] transition-all"
    >
      {/* Badge de tipo + Legal Hold (Onda1-3) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}
        >
          {config.label}
        </span>
        {legalHold && (
          <Tooltip
            content={legalHoldReason ? `Retention hold: ${legalHoldReason}` : 'Documento sob legal hold'}
            side="top"
          >
            <Badge
              variant="warning"
              badgeStyle="solid"
              icon={<Lock />}
              aria-label={`Legal hold ativo${legalHoldReason ? ': ' + legalHoldReason : ''}`}
            >
              RETENTION HOLD
            </Badge>
          </Tooltip>
        )}
        {showOcrBadge && <OcrStatusBadge documento={documento} short />}
        {showPdfaBadge && <PdfaStatusBadge documento={documento} short />}
      </div>

      {/* Titulo completo */}
      <h3
        lang="pt-BR"
        className="mt-2 flex-1 text-[14px] font-bold leading-tight text-foreground hyphens-auto overflow-hidden"
      >
        {titulo}
      </h3>

      {/* Codigo e Versao */}
      <div className="mt-auto pt-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[65%]">
          {codigo}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          v{versaoAtual}
        </span>
      </div>
    </button>
  );
});

export default DocumentoCard;
