import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, Button, Modal, FileUpload, FormField, Input, Textarea, SearchBar } from '@/design-system';
import { AdminOnly } from '@/design-system/components/anest/admin-only';
import DocumentoCard from '@/components/DocumentoCard';
import {
  GraduationCap,
  ChevronLeft,
  FileBarChart,
  Plus,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useRelatoriosDocumentos } from '@/hooks/useRelatoriosDocumentos';
import { useUser } from '@/contexts/UserContext';

export default function RelatorioTrimestralPage({ onNavigate, goBack }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useUser();

  // Hook de documentos
  const {
    loading,
    error,
    relatorios,
    loadRelatorios,
    uploadRelatorio,
    clearError,
  } = useRelatoriosDocumentos('trimestral');

  // Modal de upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitulo, setUploadTitulo] = useState('');
  const [uploadPeriodo, setUploadPeriodo] = useState('');
  const [uploadResponsavel, setUploadResponsavel] = useState('');
  const [uploadObservacoes, setUploadObservacoes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Carregar relatorios ao montar
  useEffect(() => {
    loadRelatorios('trimestral');
  }, [loadRelatorios]);

  // Filtrar relatorios por busca
  const filteredRelatorios = relatorios.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.titulo?.toLowerCase().includes(q) ||
      r.periodo?.toLowerCase().includes(q) ||
      r.codigo?.toLowerCase().includes(q) ||
      r.responsavel?.toLowerCase().includes(q)
    );
  });

  const handleGoBack = () => {
    if (goBack) {
      goBack();
    } else {
      onNavigate('relatorios');
    }
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Relatórios Trimestrais
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  // Handlers
  const handleCardClick = (relatorio) => {
    onNavigate('relatorioDetalhe', { relatorioId: relatorio.id, tipoRelatorio: 'trimestral' });
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadError('Selecione um arquivo PDF');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await uploadRelatorio('trimestral', uploadFile, {
        titulo: uploadTitulo || uploadFile.name.replace('.pdf', ''),
        periodo: uploadPeriodo,
        responsavel: uploadResponsavel,
        observacoes: uploadObservacoes,
      }, user);

      // Limpar e fechar modal
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitulo('');
      setUploadPeriodo('');
      setUploadResponsavel('');
      setUploadObservacoes('');
    } catch (err) {
      setUploadError(err.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Header com icone e contador */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted">
              <FileBarChart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Trimestrais</h2>
              <p className="text-sm text-muted-foreground">
                {filteredRelatorios.length} relatório{filteredRelatorios.length !== 1 ? 's' : ''} {searchQuery && 'encontrado' + (filteredRelatorios.length !== 1 ? 's' : '')}
              </p>
            </div>
          </div>
          <AdminOnly user={user}>
            <Button
              size="sm"
              onClick={() => setShowUploadModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </AdminOnly>
        </div>

        {/* Campo de busca */}
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar relatórios..."
          className="mb-4"
        />

        {/* Erro */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button onClick={clearError} className="ml-auto text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        {/* Grid de cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredRelatorios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileBarChart className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {searchQuery ? 'Nenhum relatório encontrado' : 'Nenhum relatório disponível'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {searchQuery ? 'Tente ajustar os filtros ou buscar por outro termo.' : 'Adicione o primeiro relatório trimestral.'}
            </p>
            {!searchQuery && (
              <AdminOnly user={user}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Primeiro Relatório
                </Button>
              </AdminOnly>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredRelatorios.map((relatorio) => (
              <DocumentoCard
                key={relatorio.id}
                documento={{
                  ...relatorio,
                  tipo: 'relatorio',
                  versaoAtual: relatorio.versaoAtual || 1,
                  codigo: relatorio.codigo || relatorio.periodo,
                }}
                onClick={() => handleCardClick(relatorio)}
              />
            ))}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 p-4 rounded-xl bg-muted border border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Relatórios trimestrais consolidam indicadores de qualidade e segurança do paciente. Clique em um relatório para visualizar detalhes e o PDF.
          </p>
        </div>
      </div>

      {/* Modal de Upload */}
      <Modal
        open={showUploadModal}
        onClose={() => !uploading && setShowUploadModal(false)}
        title="Novo Relatório Trimestral"
        description="Adicionar documento de relatório trimestral"
        size="md"
        closeOnOverlayClick={!uploading}
        showCloseButton={!uploading}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleUploadSubmit}
              disabled={!uploadFile || uploading}
              loading={uploading}
            >
              Enviar Documento
            </Button>
          </>
        }
      >
        <Modal.Body>
          <div className="space-y-4">
            <FileUpload
              value={uploadFile}
              onChange={setUploadFile}
              accept=".pdf"
              maxSize={10485760}
              label="Arquivo PDF"
              description="Arraste ou clique para selecionar um arquivo PDF (max 10MB)"
              disabled={uploading}
              error={uploadError && !uploadFile ? 'Selecione um arquivo' : undefined}
            />

            <FormField label="Título do Relatório" hint="Deixe em branco para usar o nome do arquivo">
              <Input
                value={uploadTitulo}
                onChange={(e) => setUploadTitulo(e.target.value)}
                placeholder="Ex: Relatório Trimestral Q4 2024"
                disabled={uploading}
              />
            </FormField>

            <FormField label="Período" hint="Ex: Q4 2024, Q1 2025">
              <Input
                value={uploadPeriodo}
                onChange={(e) => setUploadPeriodo(e.target.value)}
                placeholder="Ex: Q4 2024"
                disabled={uploading}
              />
            </FormField>

            <FormField label="Responsável">
              <Input
                value={uploadResponsavel}
                onChange={(e) => setUploadResponsavel(e.target.value)}
                placeholder="Ex: Dr. Marcelo Silva"
                disabled={uploading}
              />
            </FormField>

            <FormField label="Observações" hint="Opcional">
              <Textarea
                value={uploadObservacoes}
                onChange={(e) => setUploadObservacoes(e.target.value)}
                placeholder="Notas sobre o relatório..."
                rows={3}
                disabled={uploading}
              />
            </FormField>

            {uploadError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
              </div>
            )}
          </div>
        </Modal.Body>
      </Modal>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />,
            active: false,
            id: 'education',
          },
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
