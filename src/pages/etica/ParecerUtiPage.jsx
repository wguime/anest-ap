import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav, Button, Spinner, EmptyState, ConfirmDialog, PDFViewer } from '@/design-system';
import { AdminOnly } from '@/design-system/components/anest/admin-only';
import { GraduationCap, ChevronLeft, Heart, Plus, FileText, Trash2, Calendar, User } from 'lucide-react';
import { useEticaDocumentos } from '@/hooks/useEticaDocumentos';
import { ETICA_CONFIGS } from '@/data/eticaConfig';
import { UploadDocumentoModal } from '@/components/etica';

const CONFIG = ETICA_CONFIGS.parecerUti;

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

export default function ParecerUtiPage({ onNavigate, user }) {
  const [activeNav, setActiveNav] = useState('shield');
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
    loadDocumento('parecerUti');
  }, [loadDocumento]);

  // Handler de upload
  const handleUpload = async (file, metadata) => {
    await uploadDocumento('parecerUti', file, metadata, user);
  };

  // Handler de exclusao
  const handleDelete = async () => {
    if (!documento) return;
    await deleteDocumento('parecerUti', documento.id, documento.storagePath);
    setShowDeleteModal(false);
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button type="button" onClick={() => onNavigate('eticaBioetica')} className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">Parecer Etico - UTI</h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted dark:bg-muted flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{CONFIG.titulo}</h3>
              <p className="text-sm text-muted-foreground">{CONFIG.descricao}</p>
            </div>
          </div>
        </div>

        {/* Botao Novo Documento (Admin) */}
        <AdminOnly user={user}>
          <Button
            variant="default"
            onClick={() => setShowUploadModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full bg-primary hover:bg-primary dark:hover:bg-[#1E8449]"
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
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
            Esta secao contem os criterios e protocolos para emissao de pareceres eticos
            relacionados ao encaminhamento de pacientes para UTI. Inclui diretrizes para
            priorizacao de vagas, criterios de admissao e documentacao necessaria para
            decisoes eticas em situacoes criticas.
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

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />, active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
