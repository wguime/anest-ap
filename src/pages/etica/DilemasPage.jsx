import { useState, useEffect } from 'react';
import { SectionCard, Button, Spinner, EmptyState, ConfirmDialog, PDFViewer } from '@/design-system';
import { AdminOnly } from '@/design-system/components/anest/admin-only';
import { Plus, FileText, Trash2, Calendar, User } from 'lucide-react';
import { PageHeader } from '../../components';
import { useEticaDocumentos } from '@/hooks/useEticaDocumentos';
import { ETICA_CONFIGS } from '@/data/eticaConfig';
import { UploadDocumentoModal } from '@/components/etica';

const CONFIG = ETICA_CONFIGS.dilemas;

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
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function DilemasPage({ onNavigate, user }) {
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
    loadDocumento('dilemas');
  }, [loadDocumento]);

  // Handler de upload
  const handleUpload = async (file, metadata) => {
    await uploadDocumento('dilemas', file, metadata, user);
  };

  // Handler de exclusao
  const handleDelete = async () => {
    if (!documento) return;
    await deleteDocumento('dilemas', documento.id, documento.storagePath);
    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Dilemas Bioeticos" onBack={() => onNavigate('eticaBioetica')} />

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
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Excluir
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
            Esta secao apresenta casos e discussoes sobre dilemas bioeticos que surgem na pratica medica.
            Inclui deliberacoes sobre questoes eticas complexas, orientacoes para tomada de decisao e
            registros de casos analisados pelo comite de etica.
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
        title="Excluir Documento"
        description="Tem certeza que deseja excluir este documento? Esta acao nao pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        loading={loading}
      />

    </div>
  );
}
