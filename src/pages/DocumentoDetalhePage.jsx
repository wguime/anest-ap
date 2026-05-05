import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Badge,
  PDFViewer,
  Card,
  CardContent,
  Select,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  Textarea,
  Switch,
  useToast,
} from '@/design-system';
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
  Download,
  Printer,
  Share2,
} from 'lucide-react';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { CATEGORY_SUBSECTIONS } from '@/types/documents';
import { TIPO_CONFIG, SETORES, formatDocDate } from '../data/documentTypes';
import { AUDITORIA_TIPO_CONFIG, AUDITORIA_SETORES } from '../data/auditoriasConfig';
import { COMITE_TIPO_CONFIG, getComiteConfig } from '../data/comitesConfig';
import { ETICA_CONFIGS } from '../data/eticaConfig';
import DistributionPanel from '@/components/documents/DistributionPanel';
import AuditTrailViewer from '@/components/documents/AuditTrailViewer';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useUser } from '@/contexts/UserContext';
import {
  CONFIDENTIALITY_OPTIONS,
} from '@/utils/confidentiality';

const CONFIDENTIALITY_FLAG_ENABLED =
  import.meta.env?.VITE_FEATURE_CONFIDENTIALITY === 'true';

const RETENTION_FLAG_ENABLED =
  import.meta.env?.VITE_FEATURE_RETENTION === 'true';

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

  // ─── Ações dedicadas: Download / Imprimir / Compartilhar ──────────────────
  // Operam sobre a signed URL (signed URL expira em 1h, gerada on-demand).
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
    // Usa <a download> programático (signed URL pode estar em outro origin).
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
    // Abre o PDF em nova aba; navegador exibe controles de impressão.
    // Fallback robusto: bloqueio de pop-up cai num try/catch.
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
      // AbortError = usuário cancelou o share — não mostrar toast.
      if (err?.name === 'AbortError') return;
      console.warn('[DocumentoDetalhe] Falha ao compartilhar:', err.message);
      toast({ title: 'Erro ao compartilhar', description: err.message, variant: 'error' });
    }
  }, [documento?.titulo, documento?.descricao, pdfDisplayUrl, toast]);

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
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}>
                {config.label}
              </span>
              <span className="text-sm font-mono text-muted-foreground">
                {documento.codigo}
              </span>
            </div>
            {/* Ações dedicadas: Download / Imprimir / Compartilhar
                Visíveis para qualquer usuário (read-only). Min 44x44px (touch). */}
            <div className="flex items-center gap-1" role="group" aria-label="Ações do documento">
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

        {/* Tab system — Documento sempre visível.
            Distribuição é admin-only (mutações).
            Histórico (Audit Trail) agora é visível para todos em modo read-only:
            AuditTrailViewer já recebe isAdmin e exibe ações destrutivas só pra admin. */}
        <div className="flex gap-2 mb-4 overflow-x-auto" role="tablist" aria-label="Seções do documento">
          {[
            { id: 'documento', label: 'Documento' },
            ...(isAdmin ? [{ id: 'distribuicao', label: 'Distribuicao' }] : []),
            { id: 'historico', label: isAdmin ? 'Audit Trail' : 'Historico' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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

        {/* Tab content: Audit Trail
            Visível para todos. Componente recebe isAdmin para condicionar
            ações destrutivas (alterar status, deletar versão) apenas a admins. */}
        {activeTab === 'historico' && (
          <div
            role="tabpanel"
            id="tab-panel-historico"
            aria-labelledby="tab-historico"
          >
            <AuditTrailViewer documentoId={documento.id} isAdmin={isAdmin} />
          </div>
        )}
      </div>

      {/* Modal de Versoes — DS Modal (focus trap, ESC, ARIA via role="dialog")
          Auditoria W2-2: residual onde Wave 0b corrigiu apenas Nova Versão. */}
      <Modal
        open={showVersoes}
        onClose={() => setShowVersoes(false)}
        title="Histórico de Versões"
        description={`${versoes.length} versão(ões) registrada(s)`}
        size="md"
      >
        <Modal.Body>
          <div className="space-y-4">
            {versoes.map((versao) => (
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
                        <span className="block text-[10px] uppercase tracking-wider mb-0.5">Data Aprovação</span>
                        <span className="text-foreground">{formatDateShort(versao.dataAprovacao)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      {/* Modal de Edicao */}
      {showEditModal && documento && (
        <EditDocumentModal
          documento={documento}
          isAdmin={isAdmin}
          firebaseUser={firebaseUser}
          currentUser={currentUser}
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
// LegalHoldSection — Onda1-3 (Retention + Legal hold)
// -----------------------------------------------------------------------------
// Renderizada apenas para admins quando VITE_FEATURE_RETENTION === 'true'.
// Toggle aplica/remove legal_hold via supabaseDocumentService.setLegalHold,
// que cria entrada 'legal_hold_set' / 'legal_hold_released' no changelog.
// =============================================================================
function LegalHoldSection({ documento, firebaseUser, currentUser }) {
  const { toast } = useToast();
  const [holdState, setHoldState] = useState(!!documento?.legalHold);
  const [reason, setReason] = useState(documento?.legalHoldReason || '');
  const [submitting, setSubmitting] = useState(false);

  const retentionLabel = useMemo(() => {
    if (!documento?.retentionUntil) return 'Não definida';
    try {
      return formatDocDate(documento.retentionUntil);
    } catch {
      return String(documento.retentionUntil);
    }
  }, [documento?.retentionUntil]);

  const handleToggle = async (nextChecked) => {
    if (!firebaseUser?.uid) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para alterar o legal hold.',
        variant: 'error',
      });
      return;
    }
    if (nextChecked && (!reason || reason.trim().length === 0)) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do legal hold antes de ativar.',
        variant: 'warning',
      });
      return;
    }
    setSubmitting(true);
    try {
      await supabaseDocumentService.setLegalHold(
        documento.id,
        nextChecked ? reason.trim() : '',
        {
          userId: firebaseUser.uid,
          userName: currentUser?.nome || currentUser?.displayName || firebaseUser.email,
          userEmail: firebaseUser.email,
        },
        { hold: nextChecked }
      );
      setHoldState(nextChecked);
      toast({
        title: nextChecked ? 'Legal hold aplicado' : 'Legal hold removido',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Erro ao alterar legal hold',
        description: err?.message || 'Tente novamente.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-warning/30 bg-warning/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[14px] font-bold text-foreground">Legal hold</span>
          <span className="text-[12px] text-muted-foreground">
            Bloqueia exclusão e arquivamento enquanto ativo.
          </span>
        </div>
        <Switch
          checked={holdState}
          disabled={submitting}
          onChange={handleToggle}
          aria-label="Ativar legal hold"
        />
      </div>

      <FormField
        label="Motivo do legal hold"
        hint="Obrigatório ao ativar. Ex: investigação CRM, processo judicial."
      >
        <Textarea
          value={reason}
          onChange={(val) => setReason(val)}
          rows={2}
          placeholder="Descreva o motivo (litígio, auditoria externa, etc.)"
          disabled={holdState && submitting}
        />
      </FormField>

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Retention até:</span>
        <span className="font-medium text-foreground">{retentionLabel}</span>
      </div>
    </div>
  );
}

// =============================================================================
// MODAL DE EDICAO DE DOCUMENTO
// -----------------------------------------------------------------------------
// W2-2 (UX/A11y residual):
//   • Usa DS <Modal> (focus trap, ESC, role="dialog", aria-modal).
//   • Required fields: titulo, classificacao (acesso), proximaRevisao.
//   • Validação roda no onChange (live) e bloqueia submit enquanto inválido.
//   • Cada campo obrigatório usa <FormField error=...> que injeta
//     aria-invalid + aria-describedby no input automaticamente.
//   • Unsaved changes guard via useUnsavedChangesGuard — beforeunload
//     + ConfirmDialog ao tentar fechar (X / overlay / ESC) com dirty state.
// =============================================================================
function EditDocumentModal({ documento, onClose, onSave, isAdmin = false, firebaseUser = null, currentUser = null }) {
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

  const tipoOptions = useMemo(
    () => tiposDisponiveis.map(([key, conf]) => ({
      value: key,
      label: conf?.label || key,
    })),
    [tiposDisponiveis]
  );

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

  // Snapshot inicial — comparação para isDirty.
  const initialFormRef = useRef(null);
  const initialForm = useMemo(() => ({
    titulo: documento?.titulo || '',
    codigo: documento?.codigo || '',
    tipo: documento?.tipo || 'protocolo',
    setorId: documento?.setorId || 'anestesia',
    descricao: documento?.descricao || '',
    tags: getTagsString(documento?.tags),
    responsavelRevisao: documento?.responsavelRevisao || '',
    proximaRevisao: getDateString(documento?.proximaRevisao),
    origem: documento?.origem || '',
    dataPublicacao: getDateString(documento?.dataPublicacao),
    dataVersao: getDateString(documento?.dataVersao),
    classificacaoAcesso: documento?.classificacaoAcesso || 'interno',
    confidentialityLevel: documento?.confidentialityLevel || 'interno',
    setorNome: documento?.setorNome || '',
    localArmazenamento: documento?.localArmazenamento || 'Supabase Cloud Storage',
    responsavelElaboracao: documento?.responsavelElaboracao || '',
    responsavelAprovacao: documento?.responsavelAprovacao || '',
  }), [documento]);

  if (initialFormRef.current === null) {
    initialFormRef.current = initialForm;
  }

  const [formData, setFormData] = useState(initialForm);

  // ── Validação live ──────────────────────────────────────────────────────
  // Required: titulo, classificacaoAcesso, proximaRevisao.
  const errors = useMemo(() => {
    const e = {};
    if (!formData.titulo || formData.titulo.trim().length === 0) {
      e.titulo = 'Título é obrigatório.';
    } else if (formData.titulo.trim().length < 3) {
      e.titulo = 'Título deve ter ao menos 3 caracteres.';
    }
    if (!formData.classificacaoAcesso) {
      e.classificacaoAcesso = 'Selecione a classificação de acesso.';
    }
    if (!formData.proximaRevisao) {
      e.proximaRevisao = 'Data da próxima revisão é obrigatória.';
    }
    return e;
  }, [formData.titulo, formData.classificacaoAcesso, formData.proximaRevisao]);

  const isValid = Object.keys(errors).length === 0;

  // isDirty: shallow compare contra snapshot inicial.
  const isDirty = useMemo(() => {
    const snap = initialFormRef.current || {};
    return Object.keys(formData).some(k => formData[k] !== snap[k]);
  }, [formData]);

  // Unsaved changes guard.
  const guard = useUnsavedChangesGuard(isDirty);

  // Wrapper que SEMPRE passa por requestClose — protege X / overlay / ESC.
  const handleClose = useCallback(() => {
    guard.requestClose(onClose);
  }, [guard, onClose]);

  const handleField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return; // double-guard além do disabled

    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t);

    const payload = {
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
    };

    // Onda1-4: só enviar confidentialityLevel se a feature flag estiver
    // ativa E o usuário for admin. Caso contrário remove para não sobrescrever.
    if (CONFIDENTIALITY_FLAG_ENABLED && isAdmin) {
      payload.confidentialityLevel = formData.confidentialityLevel || 'interno';
    } else {
      delete payload.confidentialityLevel;
    }

    onSave(payload);
  }, [isValid, formData, onSave, isAdmin]);

  return (
    <>
      <Modal
        open={true}
        onClose={handleClose}
        title="Editar Documento"
        description="Os campos marcados com * são obrigatórios."
        size="lg"
        // Bloqueia overlay/ESC quando dirty (guard mostra ConfirmDialog).
        closeOnOverlayClick={!isDirty}
        closeOnEscape={!isDirty}
        footer={
          <>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              aria-disabled={!isValid}
            >
              <Check className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </>
        }
      >
        <Modal.Body>
          <div className="space-y-4 pb-2">
            {/* Título — REQUIRED */}
            <FormField
              label="Título"
              required
              error={errors.titulo}
            >
              <Input
                type="text"
                value={formData.titulo}
                onChange={(e) => handleField('titulo', e.target.value)}
                placeholder="Nome do documento"
                autoFocus
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Código">
                <Input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => handleField('codigo', e.target.value)}
                />
              </FormField>
              <FormField label="Tipo">
                <Select
                  value={formData.tipo}
                  onChange={(val) => handleField('tipo', val)}
                  options={tipoOptions}
                  placeholder="Selecione o tipo"
                />
              </FormField>
            </div>

            {/* Origem e Departamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Origem">
                <Input
                  type="text"
                  value={formData.origem}
                  onChange={(e) => handleField('origem', e.target.value)}
                  placeholder="Ex: Diretoria, Comitê"
                />
              </FormField>
              <FormField label="Departamento">
                <Input
                  type="text"
                  value={formData.setorNome}
                  onChange={(e) => handleField('setorNome', e.target.value)}
                  placeholder="Ex: Anestesia, UTI"
                />
              </FormField>
            </div>

            {/* Classificação de Acesso — REQUIRED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Classificação de Acesso"
                required
                error={errors.classificacaoAcesso}
              >
                <Select
                  value={formData.classificacaoAcesso}
                  onChange={(val) => handleField('classificacaoAcesso', val)}
                  options={classificacaoOptions}
                  placeholder="Selecione a classificação"
                />
              </FormField>
              <FormField label="Local de Armazenamento">
                <Input
                  type="text"
                  value={formData.localArmazenamento}
                  onChange={(e) => handleField('localArmazenamento', e.target.value)}
                  placeholder="Ex: Servidor, Nuvem"
                />
              </FormField>
            </div>

            {/* Onda1-4 — Nível de Confidencialidade (admin-only, atrás de feature flag) */}
            {CONFIDENTIALITY_FLAG_ENABLED && isAdmin && (
              <FormField
                label="Nível de Confidencialidade"
                hint="Define o clearance mínimo necessário para leitura."
              >
                <Select
                  value={formData.confidentialityLevel}
                  onChange={(val) => handleField('confidentialityLevel', val)}
                  options={CONFIDENTIALITY_OPTIONS}
                  placeholder="Selecione o nível"
                />
              </FormField>
            )}

            {/* Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Data de Publicação">
                <Input
                  type="date"
                  value={formData.dataPublicacao}
                  onChange={(e) => handleField('dataPublicacao', e.target.value)}
                />
              </FormField>
              <FormField label="Data da Versão">
                <Input
                  type="date"
                  value={formData.dataVersao}
                  onChange={(e) => handleField('dataVersao', e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Descrição">
              <Textarea
                value={formData.descricao}
                onChange={(val) => handleField('descricao', val)}
                rows={3}
                placeholder="Descreva brevemente o documento"
              />
            </FormField>

            <FormField label="Tags" hint="Separe por vírgula">
              <Input
                type="text"
                value={formData.tags}
                onChange={(e) => handleField('tags', e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </FormField>

            {/* Responsáveis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Resp. Elaboração">
                <Select
                  value={formData.responsavelElaboracao}
                  onChange={(val) => handleField('responsavelElaboracao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
              <FormField label="Resp. Aprovação">
                <Select
                  value={formData.responsavelAprovacao}
                  onChange={(val) => handleField('responsavelAprovacao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Responsável Revisão">
                <Select
                  value={formData.responsavelRevisao}
                  onChange={(val) => handleField('responsavelRevisao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
              {/* Próxima Revisão — REQUIRED */}
              <FormField
                label="Próxima Revisão"
                required
                error={errors.proximaRevisao}
              >
                <Input
                  type="date"
                  value={formData.proximaRevisao}
                  onChange={(e) => handleField('proximaRevisao', e.target.value)}
                />
              </FormField>
            </div>

            {/* Onda1-3 — Legal Hold + Retention (admin + feature flag) */}
            {isAdmin && RETENTION_FLAG_ENABLED && (
              <LegalHoldSection
                documento={documento}
                firebaseUser={firebaseUser}
                currentUser={currentUser}
              />
            )}
          </div>
        </Modal.Body>
      </Modal>

      {/* Confirmação de descarte de alterações (UnsavedChanges guard) */}
      <ConfirmDialog
        open={guard.confirmOpen}
        onClose={guard.cancelClose}
        onConfirm={guard.confirmClose}
        title="Descartar alterações?"
        description="Você tem alterações não salvas. Se sair agora elas serão perdidas."
        confirmText="Descartar"
        cancelText="Continuar editando"
        variant="danger"
      />
    </>
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
// -----------------------------------------------------------------------------
// W2-2: usa DS <ConfirmDialog> (role="alertdialog", focus trap, ESC).
// Children renderizam o Select de subseção como conteúdo customizado.
// =============================================================================
function ArchiveConfirmModal({ documento, onClose, onConfirm }) {
  const [archiveSubsection, setArchiveSubsection] = useState('');

  const obsoletosOptions = CATEGORY_SUBSECTIONS.obsoletos || [];

  const [showError, setShowError] = useState(false);

  const handleConfirm = () => {
    if (!archiveSubsection) {
      setShowError(true);
      return;
    }
    onConfirm(archiveSubsection);
  };

  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Arquivar Documento?"
      description={`O documento "${documento.titulo}" será movido para a seção 10 Obsoletos. Selecione a subseção de destino.`}
      confirmText="Arquivar"
      cancelText="Cancelar"
      variant="danger"
      icon={<Archive className="h-7 w-7" aria-hidden="true" />}
    >
      <FormField
        label="Subseção em Obsoletos"
        required
        error={showError && !archiveSubsection ? 'Selecione uma subseção.' : ''}
      >
        <Select
          value={archiveSubsection}
          onChange={(val) => {
            setArchiveSubsection(val);
            if (val) setShowError(false);
          }}
          placeholder="Selecione a subseção"
          options={obsoletosOptions}
        />
      </FormField>
    </ConfirmDialog>
  );
}
