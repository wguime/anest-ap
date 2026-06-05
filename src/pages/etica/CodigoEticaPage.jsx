import { useState, useEffect } from 'react';
import { SectionCard, Button, Spinner, EmptyState, ConfirmDialog, PDFViewer } from '@/design-system';
import { AdminOnly } from '@/design-system/components/anest/admin-only';
import { Plus, FileText, Archive, Calendar, User } from 'lucide-react';
import { PageHeader } from '../../components';
import { useEticaDocumentos } from '@/hooks/useEticaDocumentos';
import { ETICA_CONFIGS } from '@/data/eticaConfig';
import { UploadDocumentoModal } from '@/components/etica';
import { formatDate as fmtDate } from '@/utils/formatters';

const CONFIG = ETICA_CONFIGS.codigoEtica;

// Formata o tamanho do arquivo
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Formata data
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return fmtDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CodigoEticaPage({ onNavigate, user }) {
  const [_activeNav, _setActiveNav] = useState('shield');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    loading,
    error,
    documento,
    loadDocumento,
    uploadDocumento,
    deleteDocumento,
  } = useEticaDocumentos();

  // Carregar documento ao montar
  useEffect(() => {
    loadDocumento('codigoEtica');
  }, [loadDocumento]);

  // Handler de upload
  const handleUpload = async (file, metadata) => {
    await uploadDocumento('codigoEtica', file, metadata, user);
  };

  // Handler de exclusao
  const handleDelete = async () => {
    if (!documento) return;
    await deleteDocumento('codigoEtica', documento.id, documento.storagePath);
    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Codigo de Etica" onBack={() => onNavigate('eticaBioetica')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Botao Novo Documento (Admin) */}
        <AdminOnly user={user}>
          <Button
            variant="default"
            onClick={() => setShowUploadModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full bg-primary hover:bg-primary dark:hover:bg-greenMedium"
          >
            Novo Documento
          </Button>
        </AdminOnly>

        {/* Loading State */}
        {loading && !documento && (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Documento - PDF Direto na Pagina */}
        {!loading && documento && (
          <>
            {/* Metadados do documento */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate">
                    {documento.titulo || 'Documento'}
                  </h4>
                  <div className="mt-2 space-y-1">
                    {documento.createdAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Enviado em {formatDate(documento.createdAt)}</span>
                      </div>
                    )}
                    {documento.createdByName && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>Por {documento.createdByName}</span>
                      </div>
                    )}
                    {documento.arquivoTamanho && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{formatFileSize(documento.arquivoTamanho)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <AdminOnly user={user}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    leftIcon={<Archive className="w-4 h-4" />}
                  >
                    Arquivar
                  </Button>
                </AdminOnly>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="rounded-2xl overflow-hidden border border-border">
              <PDFViewer
                src={documento.arquivoURL}
                title={documento.titulo || CONFIG.titulo}
                height="70vh"
              />
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !documento && !error && (
          <SectionCard title="Documento">
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="Nenhum documento"
              description="Ainda nao ha documento cadastrado nesta secao."
            />
          </SectionCard>
        )}

        {/* Sobre */}
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">
            Esta secao apresenta o Codigo de Etica institucional, documento base que
            estabelece os principios, valores e normas de conduta que regem as atividades
            do servico. Inclui o texto completo do codigo, suas revisoes e material de
            apoio para consulta.
          </p>
        </SectionCard>
      </div>

      {/* Modal de Upload */}
      <UploadDocumentoModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        config={CONFIG}
        onUpload={handleUpload}
        loading={loading}
      />

      {/* Modal de Confirmacao de Exclusao */}
      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Arquivar Documento"
        description="O documento sera movido para Arquivados e deixara de aparecer na lista, mas continua acessivel e pode ser restaurado."
        confirmText="Arquivar"
        cancelText="Cancelar"
        variant="default"
        loading={loading}
      />

    </div>
  );
}
