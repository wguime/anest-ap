/**
 * DocumentMetadata — card principal com codigo, tipo (badge), setor, versao,
 * data de atualização, autor e indicador de revisão.
 */
import { useMemo } from 'react';
import { Folder, History, Clock, User, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { TIPO_DISPLAY_CONFIG } from '@/types/documents';
import { OcrStatusBadge } from '@/components/OcrStatusBadge';
import { PdfaStatusBadge } from '@/components/PdfaStatusBadge';
import { isOcrEnabled, isPdfaEnabled } from '@/utils/featureFlags';

function formatDateShort(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

function getRevisaoStatus(proximaRevisao) {
  if (!proximaRevisao) return null;
  const hoje = new Date();
  const revisao = new Date(proximaRevisao);
  const diffDays = Math.ceil((revisao - hoje) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return { status: 'vencida', label: 'Revisao vencida', color: 'text-destructive' };
  if (diffDays <= 30)
    return { status: 'proxima', label: 'Revisao proxima', color: 'text-warning' };
  return { status: 'ok', label: 'Em dia', color: 'text-success' };
}

export default function DocumentMetadata({ documento, actionBarSlot = null }) {
  const config = useMemo(
    () => TIPO_DISPLAY_CONFIG[documento.tipo] || TIPO_DISPLAY_CONFIG.protocolo,
    [documento.tipo]
  );

  const revisaoStatus = getRevisaoStatus(documento.proximaRevisao);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
      {/* Codigo e tipo */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}
          >
            {config.label}
          </span>
          <span className="text-sm font-mono text-muted-foreground">{documento.codigo}</span>
          {isOcrEnabled() && documento.ocrStatus ? (
            <OcrStatusBadge documento={documento} short />
          ) : null}
          {isPdfaEnabled() && documento.pdfaStatus ? (
            <PdfaStatusBadge documento={documento} short />
          ) : null}
        </div>
        {actionBarSlot}
      </div>

      {/* Informacoes em grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Folder className="w-3 h-3" />
            <span>Setor</span>
          </div>
          <p className="text-sm font-medium text-foreground">{documento.setorNome}</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <History className="w-3 h-3" />
            <span>Versao</span>
          </div>
          <p className="text-sm font-medium text-foreground">v{documento.versaoAtual}</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Atualizado em</span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {formatDateShort(documento.updatedAt)}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>Autor</span>
          </div>
          <p className="text-sm font-medium text-foreground">{documento.createdByName}</p>
        </div>

        {documento.proximaRevisao && (
          <div className="space-y-1 col-span-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Proxima Revisao</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {formatDateShort(documento.proximaRevisao)}
              </p>
              {revisaoStatus && (
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${revisaoStatus.color}`}
                >
                  {revisaoStatus.status === 'vencida' || revisaoStatus.status === 'proxima' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  {revisaoStatus.label}
                </span>
              )}
            </div>
          </div>
        )}

        {documento.responsavelRevisao && (
          <div className="space-y-1 col-span-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>Responsavel pela Revisao</span>
            </div>
            <p className="text-sm font-medium text-foreground">{documento.responsavelRevisao}</p>
          </div>
        )}
      </div>
    </div>
  );
}
