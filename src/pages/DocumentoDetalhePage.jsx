import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Badge, PDFViewer, Card, CardContent, Select, useToast } from '@/design-system';
import { FileUpload } from '@/design-system/components/ui/file-upload';
import supabaseDocumentService from '@/services/supabaseDocumentService';
import {
  GraduationCap,
  FileText,
  Clock,
  User,
  Tag,
  Folder,
  History,
  X,
  Calendar,
  CheckCircle,
  AlertCircle,
  Edit,
  Plus,
  Archive,
  Upload,
  ChevronLeft,
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { CATEGORY_SUBSECTIONS } from '@/types/documents';
import { TIPO_CONFIG, SETORES, formatDocDate } from '../data/documentTypes';
import { AUDITORIA_TIPO_CONFIG, AUDITORIA_SETORES } from '../data/auditoriasConfig';
import { COMITE_TIPO_CONFIG, getComiteConfig } from '../data/comitesConfig';
import { ETICA_CONFIGS } from '../data/eticaConfig';
import DistributionPanel from '@/components/documents/DistributionPanel';
import AuditTrailViewer from '@/components/documents/AuditTrailViewer';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useUser } from '@/contexts/UserContext';

export default function DocumentoDetalhePage({ onNavigate, goBack, params, isAdmin = false }) {
  const { toast } = useToast();
  const [activeNav, setActiveNav] = useState('shield');
  const [showVersoes, setShowVersoes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('documento');

  // Use context SSOT instead of 6 separate mock imports
  const {
    findDocumentById,
    updateDocument: contextUpdateDocument,
    archiveDocument: contextArchiveDocument,
    addVersion: contextAddVersion,
    isLoading: contextLoading,
    isInitialized,
  } = useDocumentsContext();
  const { firebaseUser, user: currentUser } = useUser();

  // Funcao para voltar usando o historico de navegacao
  const handleGoBack = () => {
    goBack();
  };

  // Buscar documento pelo ID - uses context findDocumentById (searches ALL categories)
  const documentoId = params?.documentoId;

  // Find document from context (reactive - updates when context changes)
  const documento = useMemo(() => {
    if (!documentoId || !isInitialized) return null;
    const found = findDocumentById(documentoId);
    if (!found) return null;

    // Adapt fields for display based on category
    if (found.category === 'etica' && !found.setorNome) {
      const eticaConfig = ETICA_CONFIGS?.[found.categoria] || {};
      return {
        ...found,
        setorNome: eticaConfig.titulo || found.setor || 'Comite de Etica',
        setorId: found.categoria || 'etica',
        tipo: found.tipo || 'etica',
        createdByName: found.createdByName || found.responsavel || 'Comite de Etica',
      };
    }
    if (found.category === 'comites' && !found.setorNome) {
      const comiteConfig = getComiteConfig(found.tipo);
      return {
        ...found,
        setorNome: comiteConfig?.label || found.setorNome || 'Comites',
        setorId: found.tipo || 'comites',
      };
    }
    if (found.category === 'biblioteca' && !found.setorNome) {
      return {
        ...found,
        setorNome: found.categoria || 'Biblioteca',
        setorId: found.categoria || 'biblioteca',
      };
    }
    if ((found.category === 'relatorios' || found.category === 'auditorias') && !found.setorNome) {
      return {
        ...found,
        setorNome: found.responsavel || found.setorNome || 'Qualidade',
        setorId: found.setorId || 'qualidade',
      };
    }
    return found;
  }, [documentoId, isInitialized, findDocumentById]);

  const loading = contextLoading || !isInitialized;

  // Auto-open edit modal when editMode is passed in params
  useEffect(() => {
    if (params?.editMode && documento && !loading) {
      setShowEditModal(true);
    }
  }, [params?.editMode, documento, loading]);

  // Signed URL on-demand (Wave 0b root cause #2):
  // Não persistimos URL assinada no DB porque expira em 1h. Geramos
  // sob demanda quando a página renderiza, e renovamos a cada 50min.
  const [pdfDisplayUrl, setPdfDisplayUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    async function fetchSignedUrl() {
      if (!documento?.storagePath) {
        // Documento legado pode ainda ter arquivoURL como string pública/expirada.
        // Usamos como fallback até a próxima nova versão regravar com storagePath.
        if (documento?.arquivoURL && documento.arquivoURL !== '#') {
          setPdfDisplayUrl(documento.arquivoURL);
        } else {
          setPdfDisplayUrl(null);
        }
        return;
      }
      try {
        const url = await supabaseDocumentService.getSignedUrl(documento.storagePath, 3600);
        if (!cancelled) {
          setPdfDisplayUrl(url);
          // Renovar 10min antes de expirar
          refreshTimer = setTimeout(fetchSignedUrl, 50 * 60 * 1000);
        }
      } catch (err) {
        console.warn('[DocumentoDetalhe] Falha ao gerar signed URL:', err.message);
        if (!cancelled) setPdfDisplayUrl(null);
      }
    }

    fetchSignedUrl();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [documento?.storagePath, documento?.arquivoURL]);

  // Versoes do documento (do proprio documento ou gerado)
  const versoes = useMemo(() => {
    if (documento?.versoes) return documento.versoes;
    // Fallback para documentos sem versoes explicitas
    return [
      {
        versao: documento?.versaoAtual || 1,
        arquivoURL: documento?.arquivoURL || '#',
        arquivoNome: `${documento?.codigo || 'DOC'}.pdf`,
        descricaoAlteracao: 'Versao inicial do documento',
        motivoAlteracao: 'Criacao do documento',
        status: 'ativo',
        createdAt: documento?.createdAt || new Date().toISOString(),
        createdBy: documento?.createdBy || 'sistema@anest.com.br',
        createdByName: documento?.createdByName || 'Sistema',
        aprovadoPor: 'Coordenador',
        dataAprovacao: documento?.createdAt || new Date().toISOString(),
      },
    ];
  }, [documento]);

  // Header fixo via Portal para estado de erro
  const errorHeaderElement = (
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
            Documento
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  // Estado de carregamento
  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {createPortal(errorHeaderElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!documento) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {/* Header fixo via Portal */}
        {createPortal(errorHeaderElement, document.body)}

        {/* Espaçador para o header fixo */}
        <div className="h-14" aria-hidden="true" />

        <div className="px-4 sm:px-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-destructive dark:text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Documento nao encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              O documento solicitado nao existe ou foi removido.
            </p>
            <Button onClick={handleGoBack}>
              Voltar para Biblioteca
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Cores por tipo (documentos + auditorias + comites)
  const tipoConfig = {
    // Tipos de documentos (biblioteca)
    protocolo: { label: 'Protocolo', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    politica: { label: 'Politica', color: 'bg-category-indigo', colorLight: 'bg-category-indigo-bg text-category-indigo-fg dark:bg-category-indigo-bg dark:text-category-indigo-fg' },
    formulario: { label: 'Formulario', color: 'bg-warning', colorLight: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning' },
    manual: { label: 'Manual', color: 'bg-category-pink', colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
    relatorio: { label: 'Relatorio', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
    processo: { label: 'Processo', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    termo: { label: 'Termo', color: 'bg-category-teal', colorLight: 'bg-category-teal-bg text-category-teal-fg dark:bg-category-teal-bg dark:text-category-teal-fg' },
    risco: { label: 'Risco', color: 'bg-destructive', colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
    plano: { label: 'Plano', color: 'bg-category-cyan', colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
    // Tipos de auditorias
    higiene_maos: { label: 'Higiene Maos', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    uso_medicamentos: { label: 'Medicamentos', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
    abreviaturas: { label: 'Abreviaturas', color: 'bg-destructive', colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
    politica_qualidade: { label: 'Qualidade', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    politica_disclosure: { label: 'Disclosure', color: 'bg-category-cyan', colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
    relatorio_rops: { label: 'ROPs', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    operacional: { label: 'Operacional', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    conformidade: { label: 'Conformidade', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    procedimento: { label: 'Procedimento', color: 'bg-category-pink', colorLight: 'bg-category-pink-bg text-category-pink-fg dark:bg-category-pink-bg dark:text-category-pink-fg' },
    seguranca_paciente: { label: 'Seguranca', color: 'bg-destructive', colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
    controle_infeccao: { label: 'Infeccao', color: 'bg-category-cyan', colorLight: 'bg-category-cyan-bg text-category-cyan-fg dark:bg-category-cyan-bg dark:text-category-cyan-fg' },
    equipamentos: { label: 'Equipamentos', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    // Tipos de comites institucionais
    regimento_interno: { label: 'Regimento', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
    executivo: { label: 'Executivo', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    financeiro: { label: 'Financeiro', color: 'bg-success', colorLight: 'bg-success/10 text-success dark:bg-primary/20 dark:text-primary' },
    gestao_pessoas: { label: 'Gestao RH', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    escalas: { label: 'Escalas', color: 'bg-warning', colorLight: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning' },
    tecnologia: { label: 'Tecnologia', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
    qualidade: { label: 'Qualidade', color: 'bg-category-blue', colorLight: 'bg-category-blue-bg text-category-blue-fg dark:bg-category-blue-bg dark:text-category-blue-fg' },
    educacao: { label: 'Educacao', color: 'bg-destructive', colorLight: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive' },
    etica_conduta: { label: 'Etica', color: 'bg-category-purple', colorLight: 'bg-category-purple-bg text-category-purple-fg dark:bg-category-purple-bg dark:text-category-purple-fg' },
    // Tipo de documentos de etica e bioetica
    etica: { label: 'Etica e Bioetica', color: 'bg-primary', colorLight: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' },
  };
  const config = tipoConfig[documento.tipo] || tipoConfig.protocolo;

  // Verificar se proxima revisao esta proxima ou vencida
  const getRevisaoStatus = () => {
    if (!documento.proximaRevisao) return null;
    const hoje = new Date();
    const revisao = new Date(documento.proximaRevisao);
    const diffDays = Math.ceil((revisao - hoje) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'vencida', label: 'Revisao vencida', color: 'text-destructive' };
    if (diffDays <= 30) return { status: 'proxima', label: 'Revisao proxima', color: 'text-warning' };
    return { status: 'ok', label: 'Em dia', color: 'text-success' };
  };
  const revisaoStatus = getRevisaoStatus();

  // Header fixo via Portal
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
            {documento.titulo}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Card principal com informacoes */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
          {/* Codigo e tipo */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}>
              {config.label}
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {documento.codigo}
            </span>
          </div>

          {/* Informacoes em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Folder className="w-3 h-3" />
                <span>Setor</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {documento.setorNome}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="w-3 h-3" />
                <span>Versao</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                v{documento.versaoAtual}
              </p>
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
              <p className="text-sm font-medium text-foreground">
                {documento.createdByName}
              </p>
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
                    <span className={`flex items-center gap-1 text-xs font-medium ${revisaoStatus.color}`}>
                      {revisaoStatus.status === 'vencida' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : revisaoStatus.status === 'proxima' ? (
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
                <p className="text-sm font-medium text-foreground">
                  {documento.responsavelRevisao}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botoes de Administracao - visiveis apenas para admin */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
            >
              <Edit className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Editar</span>
            </button>
            <button
              onClick={() => setShowVersionModal(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Nova Versao</span>
            </button>
            <button
              onClick={() => setShowVersoes(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
            >
              <History className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Historico</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-destructive/10 dark:bg-destructive/20 hover:bg-destructive/20 dark:hover:bg-destructive/30 transition-colors"
            >
              <Archive className="w-4 h-4 text-destructive dark:text-destructive" />
              <span className="text-sm font-medium text-destructive dark:text-destructive">Arquivar</span>
            </button>
          </div>
        )}

        {/* Tab system - Documento / Distribuicao (admin) / Audit Trail (admin) */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {[
            { id: 'documento', label: 'Documento' },
            ...(isAdmin ? [
              { id: 'distribuicao', label: 'Distribuicao' },
              { id: 'historico', label: 'Audit Trail' },
            ] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white dark:bg-primary dark:text-primary-foreground'
                  : 'bg-muted text-primary hover:bg-border dark:hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content: Documento */}
        {activeTab === 'documento' && (
          <>
            {/* Visualizador de PDF — signed URL gerada on-demand
                (Wave 0b root cause #2 — não persistir Signed URL no DB) */}
            <div className="mb-4">
              {pdfDisplayUrl ? (
                <PDFViewer
                  src={pdfDisplayUrl}
                  title={documento.titulo}
                  height="500px"
                />
              ) : (
                <div className="bg-card rounded-2xl p-8 shadow-sm border border-border text-center">
                  <div className="w-16 h-16 rounded-2xl bg-warning/10 dark:bg-warning/20 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-warning dark:text-warning" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    PDF nao disponivel
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                    O arquivo PDF deste documento ainda nao foi carregado no sistema.
                  </p>
                  {isAdmin && (
                    <Button onClick={() => toast({ title: 'Em desenvolvimento', description: 'Em breve você poderá fazer upload de PDFs.' })}>
                      <Upload className="w-4 h-4 mr-2" />
                      Fazer Upload
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Botao de versoes */}
            <div className="mb-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowVersoes(true)}
              >
                <History className="w-4 h-4 mr-2" />
                Historico de Versoes ({versoes.length})
              </Button>
            </div>

            {/* Descricao */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Descricao
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {documento.descricao}
              </p>
            </div>

            {/* Tags */}
            {documento.tags && documento.tags.length > 0 && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {documento.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab content: Distribuicao (admin only) */}
        {activeTab === 'distribuicao' && (
          <DistributionPanel documentoId={documento.id} isAdmin={isAdmin} />
        )}

        {/* Tab content: Audit Trail (admin only) */}
        {activeTab === 'historico' && (
          <AuditTrailViewer documentoId={documento.id} />
        )}
      </div>

      {/* Modal de Versoes */}
      {showVersoes && (
        <div className="fixed inset-0 bg-black/50 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
          <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Historico de Versoes
              </h2>
              <button
                onClick={() => setShowVersoes(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Lista de versoes */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                {versoes.map((versao, index) => (
                  <div
                    key={versao.versao}
                    className={`p-4 rounded-xl border ${
                      versao.status === 'ativo'
                        ? 'bg-muted border-border dark:border-primary/30'
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-foreground">
                        v{versao.versao}
                      </span>
                      {versao.status === 'ativo' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success dark:bg-primary/20 dark:text-primary">
                          Atual
                        </span>
                      )}
                      {versao.status === 'arquivado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                          Arquivado
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-foreground mb-1">
                      {versao.descricaoAlteracao}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Motivo: {versao.motivoAlteracao}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider mb-0.5">Criado em</span>
                        <span className="text-foreground">{formatDateShort(versao.createdAt)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider mb-0.5">Autor</span>
                        <span className="text-foreground">{versao.createdByName}</span>
                      </div>
                      {versao.aprovadoPor && (
                        <>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5">Aprovado por</span>
                            <span className="text-foreground">{versao.aprovadoPor}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5">Data Aprovacao</span>
                            <span className="text-foreground">{formatDateShort(versao.dataAprovacao)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edicao */}
      {showEditModal && documento && (
        <EditDocumentModal
          documento={documento}
          onClose={() => setShowEditModal(false)}
          onSave={(updatedData) => {
            contextUpdateDocument(documento.category, documento.id, updatedData);
            setShowEditModal(false);
          }}
        />
      )}

      {/* Modal de Nova Versao */}
      {showVersionModal && documento && (
        <NewVersionModal
          documento={documento}
          currentUser={firebaseUser}
          onClose={() => setShowVersionModal(false)}
          onSave={async (versionData) => {
            try {
              await contextAddVersion(documento.category, documento.id, versionData, {
                userId: firebaseUser?.uid,
                userName: currentUser?.displayName || firebaseUser?.email || 'Usuário',
                userEmail: firebaseUser?.email || null,
              });
              toast({ title: 'Nova versão criada', variant: 'success' });
              setShowVersionModal(false);
            } catch (err) {
              toast({ title: 'Erro ao criar versão', description: err.message, variant: 'error' });
            }
          }}
        />
      )}

      {/* Modal de Confirmacao de Arquivamento */}
      {showDeleteConfirm && documento && (
        <ArchiveConfirmModal
          documento={documento}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={(archiveSubsection) => {
            contextArchiveDocument(documento.category, documento.id, {
              userId: firebaseUser?.uid,
              userName: currentUser?.nome || firebaseUser?.displayName,
              userEmail: firebaseUser?.email,
            }, archiveSubsection);
            setShowDeleteConfirm(false);
            handleGoBack();
          }}
        />
      )}

    </div>
  );
}

// =============================================================================
// MODAL DE EDICAO DE DOCUMENTO
// =============================================================================
function EditDocumentModal({ documento, onClose, onSave }) {
  // Safely convert tags to string - handle array, string, or undefined
  const getTagsString = (tags) => {
    if (!tags) return '';
    if (Array.isArray(tags)) return tags.join(', ');
    if (typeof tags === 'string') return tags;
    return '';
  };

  // Safely get date string
  const getDateString = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (typeof dateStr === 'string') {
        return dateStr.split('T')[0];
      }
      return '';
    } catch {
      return '';
    }
  };

  // Fallback types if TIPO_CONFIG is not available
  const tiposDisponiveis = TIPO_CONFIG ? Object.entries(TIPO_CONFIG) : [
    ['protocolo', { label: 'Protocolo' }],
    ['politica', { label: 'Politica' }],
    ['formulario', { label: 'Formulario' }],
    ['manual', { label: 'Manual' }],
    ['relatorio', { label: 'Relatorio' }],
    ['etica', { label: 'Etica e Bioetica' }],
  ];

  // Fallback setores if SETORES is not available
  const setoresDisponiveis = SETORES ? SETORES : [
    { id: 'anestesia', nome: 'Anestesia' },
    { id: 'cuidados-gerais', nome: 'Cuidados Gerais' },
    { id: 'gestao', nome: 'Gestao' },
  ];

  const classificacaoOptions = [
    { value: 'publico', label: 'Publico' },
    { value: 'interno', label: 'Interno' },
    { value: 'confidencial', label: 'Confidencial' },
    { value: 'restrito', label: 'Restrito' },
  ];

  const { users: allUsers } = useUsersManagement();
  const userOptions = useMemo(() =>
    (allUsers || [])
      .filter(u => u.active)
      .map(u => ({ value: u.nome, label: u.nome }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [allUsers]
  );

  const [formData, setFormData] = useState({
    titulo: documento?.titulo || '',
    codigo: documento?.codigo || '',
    tipo: documento?.tipo || 'protocolo',
    setorId: documento?.setorId || 'anestesia',
    descricao: documento?.descricao || '',
    tags: getTagsString(documento?.tags),
    responsavelRevisao: documento?.responsavelRevisao || '',
    proximaRevisao: getDateString(documento?.proximaRevisao),
    // New metadata fields
    origem: documento?.origem || '',
    dataPublicacao: getDateString(documento?.dataPublicacao),
    dataVersao: getDateString(documento?.dataVersao),
    classificacaoAcesso: documento?.classificacaoAcesso || 'interno',
    setorNome: documento?.setorNome || '',
    localArmazenamento: documento?.localArmazenamento || 'Supabase Cloud Storage',
    responsavelElaboracao: documento?.responsavelElaboracao || '',
    responsavelAprovacao: documento?.responsavelAprovacao || '',
  });

  const inputClass = "w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "block text-sm font-medium text-foreground mb-1";

  const handleSubmit = () => {
    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t);

    onSave({
      ...formData,
      tags: tagsArray,
      origem: formData.origem || null,
      dataPublicacao: formData.dataPublicacao || null,
      dataVersao: formData.dataVersao || null,
      classificacaoAcesso: formData.classificacaoAcesso || 'interno',
      localArmazenamento: formData.localArmazenamento || null,
      responsavelElaboracao: formData.responsavelElaboracao || null,
      responsavel: formData.responsavelElaboracao || null,
      responsavelAprovacao: formData.responsavelAprovacao || null,
      setorNome: formData.setorNome || null,
      updatedAt: new Date().toISOString(),
    });
  };

  // Verificar se document.body existe
  if (typeof document === 'undefined' || !document.body) {
    console.error('document.body não disponível');
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Editar Documento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted dark:hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className={labelClass}>Titulo</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Codigo</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className={inputClass}
              >
                {tiposDisponiveis.map(([key, config]) => (
                  <option key={key} value={key}>{config?.label || key}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Origem e Departamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Origem</label>
              <input
                type="text"
                value={formData.origem}
                onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                placeholder="Ex: Diretoria, Comite"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Departamento</label>
              <input
                type="text"
                value={formData.setorNome}
                onChange={(e) => setFormData({ ...formData, setorNome: e.target.value })}
                placeholder="Ex: Anestesia, UTI"
                className={inputClass}
              />
            </div>
          </div>

          {/* Classificacao e Local */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Classificacao de Acesso</label>
              <select
                value={formData.classificacaoAcesso}
                onChange={(e) => setFormData({ ...formData, classificacaoAcesso: e.target.value })}
                className={inputClass}
              >
                {classificacaoOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Local de Armazenamento</label>
              <input
                type="text"
                value={formData.localArmazenamento}
                onChange={(e) => setFormData({ ...formData, localArmazenamento: e.target.value })}
                placeholder="Ex: Servidor, Nuvem"
                className={inputClass}
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Data de Publicacao</label>
              <input
                type="date"
                value={formData.dataPublicacao}
                onChange={(e) => setFormData({ ...formData, dataPublicacao: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Data da Versao</label>
              <input
                type="date"
                value={formData.dataVersao}
                onChange={(e) => setFormData({ ...formData, dataVersao: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Descricao</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Tags (separadas por virgula)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
              className={inputClass}
            />
          </div>

          {/* Responsaveis */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Resp. Elaboracao</label>
              <Select
                value={formData.responsavelElaboracao}
                onChange={(val) => setFormData({ ...formData, responsavelElaboracao: val })}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
                size="sm"
              />
            </div>
            <div>
              <label className={labelClass}>Resp. Aprovacao</label>
              <Select
                value={formData.responsavelAprovacao}
                onChange={(val) => setFormData({ ...formData, responsavelAprovacao: val })}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
                size="sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Responsavel Revisao</label>
              <Select
                value={formData.responsavelRevisao}
                onChange={(val) => setFormData({ ...formData, responsavelRevisao: val })}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
                size="sm"
              />
            </div>
            <div>
              <label className={labelClass}>Proxima Revisao</label>
              <input
                type="date"
                value={formData.proximaRevisao}
                onChange={(e) => setFormData({ ...formData, proximaRevisao: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-primary font-medium hover:bg-muted dark:hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================================================
// MODAL DE NOVA VERSAO
// =============================================================================
function NewVersionModal({ documento, currentUser, onClose, onSave }) {
  const versaoSugerida = String(documento.versaoAtual + 1)
  const versoesExistentes = useMemo(
    () => (documento.versoes || []).map(v => String(v.versao)),
    [documento.versoes]
  )

  const [novaVersao, setNovaVersao] = useState(versaoSugerida)
  const [novoArquivo, setNovoArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    descricaoAlteracao: '',
    motivoAlteracao: '',
    enviarParaAprovacao: false,
  });

  const versaoDuplicada = versoesExistentes.includes(novaVersao.trim()) && novaVersao.trim() !== ''

  const handleSubmit = async () => {
    if (versaoDuplicada) return;
    if (!currentUser?.uid) {
      // Guard: audit-trail.md exige userId real (Wave 0b)
      onSave({ __error: 'Sessão expirada. Faça login novamente.' });
      return;
    }

    setUploading(true);
    try {
      let arquivoFields = {};
      if (novoArquivo) {
        // Upload via supabaseDocumentService (retorna apenas path; URL on-demand)
        const uploaded = await supabaseDocumentService.uploadFile(
          novoArquivo,
          documento.category || documento.categoria || 'biblioteca',
          documento.id,
          parseFloat(novaVersao) || documento.versaoAtual + 1
        );
        arquivoFields = {
          arquivoURL: null, // signed URL gerada on-demand pelo PDFViewer
          arquivoNome: novoArquivo.name,
          arquivoTamanho: novoArquivo.size,
          storagePath: uploaded.path,
        };
      }

      onSave({
        ...formData,
        ...arquivoFields,
        versao: parseFloat(novaVersao) || documento.versaoAtual + 1,
        status: formData.enviarParaAprovacao ? 'pendente_aprovacao' : 'ativo',
        createdAt: new Date().toISOString(),
        // Audit fields — usar Firebase UID real, nunca hardcode
        // (Wave 0b root cause #3 — was 'admin@anest.com.br')
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'Usuário',
      });
    } catch (err) {
      onSave({ __error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Nova Versao
            </h2>
            <p className="text-sm text-muted-foreground">
              {documento.codigo} - versao atual: v{documento.versaoAtual}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted dark:hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Numero da Nova Versao *</label>
            <input
              type="text"
              value={novaVersao}
              onChange={(e) => setNovaVersao(e.target.value)}
              placeholder="Ex: 2, 2.1, 3.0"
              className={`w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${versaoDuplicada ? 'border-destructive dark:border-destructive focus:ring-destructive/30' : 'border-border focus:ring-primary/30'}`}
            />
            {versaoDuplicada && (
              <p className="text-xs text-destructive mt-1">
                Esta versao ja existe neste documento. Escolha um numero diferente.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descricao das Alteracoes *</label>
            <textarea
              value={formData.descricaoAlteracao}
              onChange={(e) => setFormData({ ...formData, descricaoAlteracao: e.target.value })}
              rows={3}
              placeholder="Descreva as alteracoes realizadas..."
              className="w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border border-border text-foreground resize-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Motivo da Alteracao *</label>
            <textarea
              value={formData.motivoAlteracao}
              onChange={(e) => setFormData({ ...formData, motivoAlteracao: e.target.value })}
              rows={2}
              placeholder="Ex: Revisao anual, Correcao de erro, Atualizacao normativa..."
              className="w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border border-border text-foreground resize-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Arquivo da Nova Versão
            </label>
            <FileUpload
              variant="dropzone"
              accept=".pdf,.docx,.xlsx"
              maxSize={20 * 1024 * 1024}
              value={novoArquivo}
              onChange={setNovoArquivo}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX ou XLSX até 20 MB. O arquivo será associado à nova versão.
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enviarParaAprovacao}
              onChange={(e) => setFormData({ ...formData, enviarParaAprovacao: e.target.checked })}
              className="w-5 h-5 rounded border-border"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Enviar para aprovacao</span>
              <p className="text-xs text-muted-foreground">A nova versao ficara pendente ate ser aprovada</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={
              uploading ||
              !formData.descricaoAlteracao ||
              !formData.motivoAlteracao ||
              !novaVersao.trim() ||
              versaoDuplicada
            }
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? 'Enviando...' : 'Criar Versao'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================================================
// MODAL DE CONFIRMACAO DE ARQUIVAMENTO
// =============================================================================
function ArchiveConfirmModal({ documento, onClose, onConfirm }) {
  const [archiveSubsection, setArchiveSubsection] = useState('');

  const obsoletosOptions = CATEGORY_SUBSECTIONS.obsoletos || [];

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-warning/10 dark:bg-warning/20 flex items-center justify-center mb-4">
            <Archive className="w-7 h-7 text-warning dark:text-warning" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Arquivar Documento?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            O documento <strong>"{documento.titulo}"</strong> sera movido para a secao <strong>10 Obsoletos</strong>. Selecione a subseção de destino:
          </p>

          <div className="w-full mb-6 text-left">
            <label className="block text-sm font-semibold text-primary mb-2">
              Subseção em Obsoletos *
            </label>
            <Select
              value={archiveSubsection}
              onChange={setArchiveSubsection}
              placeholder="Selecione a subseção"
              options={obsoletosOptions}
            />
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-warning hover:bg-warning/90 text-white"
              onClick={() => onConfirm(archiveSubsection)}
              disabled={!archiveSubsection}
            >
              Arquivar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
