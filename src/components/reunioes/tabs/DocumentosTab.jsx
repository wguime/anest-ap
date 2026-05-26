import { useMemo } from 'react';
import { SectionCard, Button, EmptyState } from '@/design-system';
import { FileText, Eye, Download, Upload } from 'lucide-react';

/**
 * DocumentosTab — Documents section: subsidios list, ata list, upload buttons,
 * EmptyState when empty, approval flow for ata.
 */
export default function DocumentosTab({
  documentos,
  canUploadSubsidio,
  canUploadAta,
  onOpenPDF,
  onShowUploadSubsidio,
  onShowUploadAta,
  formatDateTime,
}) {
  // Agrupar documentos por tipo
  const documentosPorTipo = useMemo(() => {
    const grupos = {
      subsidio: [],
      pauta: [],
      ata: [],
      outros: [],
    };

    documentos.forEach(doc => {
      const tipo = doc.tipoDocumento || 'outros';
      if (grupos[tipo]) {
        grupos[tipo].push(doc);
      } else {
        grupos.outros.push(doc);
      }
    });

    return grupos;
  }, [documentos]);

  return (
    <div className="space-y-4">
      {/* Seção: Documentos de Subsídio */}
      <SectionCard
        title="Documentos de Subsídio"
        subtitle={
          documentosPorTipo.subsidio.length > 0
            ? `${documentosPorTipo.subsidio.length} documento(s)`
            : canUploadSubsidio
              ? 'Envie documentos de apoio para a reunião'
              : 'Prazo para envio encerrado'
        }
      >
        {documentosPorTipo.subsidio.length > 0 ? (
          <div className="space-y-2">
            {documentosPorTipo.subsidio.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border"
              >
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.titulo}
                  </p>
                  {doc.descricao && (
                    <p className="text-xs text-muted-foreground">
                      {doc.descricao}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPDF(doc)}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4 text-primary" />
                  </button>
                  <a
                    href={doc.arquivoUrl}
                    download
                    className="p-2 rounded-lg hover:bg-secondary transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-4 h-4 text-primary" />
                  </a>
                </div>
              </div>
            ))}
            {canUploadSubsidio && (
              <Button
                onClick={onShowUploadSubsidio}
                variant="outline"
                size="sm"
                className="w-full mt-2"
              >
                <Upload className="w-4 h-4 mr-2" />
                Adicionar Subsídio
              </Button>
            )}
          </div>
        ) : (
          <EmptyState
            size="sm"
            icon={<FileText className="h-full w-full" aria-hidden="true" />}
            title="Nenhum subsídio anexado"
            description={canUploadSubsidio
              ? 'Adicione documentos de apoio para a reunião.'
              : 'Prazo para envio de subsídios encerrado.'
            }
            action={canUploadSubsidio ? {
              label: 'Adicionar Subsídio',
              onClick: onShowUploadSubsidio,
              variant: 'outline',
            } : undefined}
          />
        )}
      </SectionCard>

      {/* Seção: Ata da Reunião */}
      <SectionCard
        title="Ata da Reunião"
        subtitle={
          documentosPorTipo.ata.length > 0
            ? `${documentosPorTipo.ata.length} ata(s)`
            : 'Nenhuma ata anexada'
        }
      >
        {documentosPorTipo.ata.length > 0 ? (
          <div className="space-y-2">
            {documentosPorTipo.ata.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border-strong"
              >
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviado por {doc.uploadedByName} em {formatDateTime(doc.uploadedAt)}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPDF(doc)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4 text-primary" />
                  </button>
                  <a
                    href={doc.arquivoUrl}
                    download
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-4 h-4 text-primary" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            size="sm"
            icon={<FileText className="h-full w-full" aria-hidden="true" />}
            title="Nenhuma ata anexada"
            description={canUploadAta
              ? 'Nenhuma ata foi anexada a esta reunião ainda.'
              : 'Ata poderá ser adicionada após a data da reunião.'
            }
            action={canUploadAta ? {
              label: 'Adicionar Ata',
              onClick: onShowUploadAta,
              variant: 'outline',
            } : undefined}
          />
        )}
      </SectionCard>
    </div>
  );
}
