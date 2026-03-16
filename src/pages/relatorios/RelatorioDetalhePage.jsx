import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, Button, Badge, PDFViewer, Card, CardContent } from '@/design-system';
import {
  GraduationCap,
  FileText,
  Clock,
  User,
  Tag,
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
  Check,
  BarChart3,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { RELATORIOS_CONFIGS } from '../../data/relatoriosConfig';
import { useUser } from '../../contexts/UserContext';

export default function RelatorioDetalhePage({ onNavigate, goBack, params }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [showVersoes, setShowVersoes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);

  const { user } = useUser();
  const roleKey = (user?.role || '').toLowerCase();
  const isAdmin =
    user?.isAdmin ||
    user?.isCoordenador ||
    roleKey === 'administrador' ||
    roleKey === 'coordenador';

  // Funcao para voltar usando o historico de navegacao
  const handleGoBack = () => {
    goBack();
  };

  // Buscar relatorio pelo ID
  const relatorioId = params?.relatorioId;

  useEffect(() => {
    const loadRelatorio = async () => {
      if (relatorioId) {
        setLoading(true);
        try {
          const tipoRelatorio = params?.tipoRelatorio;
          const configEntry = RELATORIOS_CONFIGS[tipoRelatorio];

          if (configEntry) {
            // Direct lookup in the known collection
            const docSnap = await getDoc(doc(db, configEntry.collection, relatorioId));
            if (docSnap.exists()) {
              setRelatorio({ id: docSnap.id, tipo: tipoRelatorio, ...docSnap.data() });
            } else {
              setRelatorio(null);
            }
          } else {
            // Fallback: try all 3 collections
            let found = null;
            for (const [tipo, cfg] of Object.entries(RELATORIOS_CONFIGS)) {
              const docSnap = await getDoc(doc(db, cfg.collection, relatorioId));
              if (docSnap.exists()) {
                found = { id: docSnap.id, tipo, ...docSnap.data() };
                break;
              }
            }
            setRelatorio(found);
          }
        } catch (error) {
          console.error('Erro ao carregar relatorio:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadRelatorio();
  }, [relatorioId, params?.tipoRelatorio]);

  // Versoes do relatorio (do proprio relatorio ou gerado)
  const versoes = useMemo(() => {
    if (!relatorio) return [];
    if (relatorio.versoes) return relatorio.versoes;
    // Fallback para relatorios sem versoes explicitas
    return [
      {
        versao: relatorio.versaoAtual || 1,
        arquivoURL: relatorio.arquivoURL || '#',
        arquivoNome: `${relatorio.codigo || 'REL'}.pdf`,
        descricaoAlteracao: 'Versão inicial do relatório',
        motivoAlteracao: 'Criação do relatório',
        status: 'ativo',
        createdAt: relatorio.createdAt || new Date().toISOString(),
        createdBy: relatorio.createdBy || 'sistema@anest.com.br',
        createdByName: relatorio.createdByName || 'Sistema',
        aprovadoPor: 'Coordenador',
        dataAprovacao: relatorio.createdAt || new Date().toISOString(),
      },
    ];
  }, [relatorio]);

  // Header fixo via Portal para estado de erro/loading
  const errorHeaderElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Relatório
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
        {createPortal(errorHeaderElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#006837] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
        {createPortal(errorHeaderElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] dark:bg-[#450A0A] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[#DC2626] dark:text-[#F87171]" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Relatório não encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              O relatório solicitado não existe ou foi removido.
            </p>
            <Button onClick={handleGoBack}>
              Voltar
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

  // Cores por tipo de relatorio
  const tipoConfig = {
    trimestral: { label: 'Trimestral', color: 'bg-[#3B82F6]', colorLight: 'bg-[#3B82F6]/10 text-[#3B82F6] dark:bg-[#60A5FA]/20 dark:text-[#60A5FA]', icon: BarChart3 },
    incidentes: { label: 'Incidentes', color: 'bg-[#DC2626]', colorLight: 'bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#F87171]/20 dark:text-[#F87171]', icon: AlertTriangle },
    indicadores: { label: 'Indicadores', color: 'bg-[#059669]', colorLight: 'bg-[#059669]/10 text-[#059669] dark:bg-[#2ECC71]/20 dark:text-[#2ECC71]', icon: TrendingUp },
  };
  const config = tipoConfig[relatorio.tipo] || tipoConfig.trimestral;
  const IconComponent = config.icon;

  // Verificar se proxima revisao esta proxima ou vencida
  const getRevisaoStatus = () => {
    if (!relatorio.proximaRevisao) return null;
    const hoje = new Date();
    const revisao = new Date(relatorio.proximaRevisao);
    const diffDays = Math.ceil((revisao - hoje) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'vencida', label: 'Revisão vencida', color: 'text-red-600 dark:text-red-400' };
    if (diffDays <= 30) return { status: 'proxima', label: 'Revisão próxima', color: 'text-amber-600 dark:text-amber-400' };
    return { status: 'ok', label: 'Em dia', color: 'text-green-600 dark:text-green-400' };
  };
  const revisaoStatus = getRevisaoStatus();

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            {relatorio.titulo}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  const handleSaveEdit = async (updatedData) => {
    try {
      const collectionName = RELATORIOS_CONFIGS[relatorio.tipo]?.collection;
      if (!collectionName) throw new Error('Tipo de relatório não encontrado');
      await updateDoc(doc(db, collectionName, relatorio.id), { ...updatedData, updatedAt: serverTimestamp() });
      setRelatorio({ ...relatorio, ...updatedData });
      setShowEditModal(false);
    } catch (error) {
      console.error('Erro ao atualizar relatorio:', error);
    }
  };

  const handleAddVersion = async (versionData) => {
    try {
      const collectionName = RELATORIOS_CONFIGS[relatorio.tipo]?.collection;
      if (!collectionName) throw new Error('Tipo de relatório não encontrado');

      const newVersion = (relatorio.versaoAtual || 1) + 1;

      // Mark previous versions as 'historico'
      const previousVersoes = (relatorio.versoes || []).map((v) => ({
        ...v,
        status: v.status === 'ativo' ? 'historico' : v.status,
      }));

      const newVersaoEntry = {
        versao: newVersion,
        ...versionData,
      };

      const updatedVersoes = [...previousVersoes, newVersaoEntry];

      const updatePayload = {
        versoes: updatedVersoes,
        versaoAtual: newVersion,
        arquivoURL: versionData.arquivoURL || relatorio.arquivoURL,
        arquivoNome: versionData.arquivoNome || relatorio.arquivoNome,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, collectionName, relatorio.id), updatePayload);

      setRelatorio({
        ...relatorio,
        ...updatePayload,
        updatedAt: new Date().toISOString(),
      });
      setShowVersionModal(false);
    } catch (error) {
      console.error('Erro ao adicionar versao:', error);
    }
  };

  const handleArchive = async () => {
    try {
      const collectionName = RELATORIOS_CONFIGS[relatorio.tipo]?.collection;
      if (!collectionName) throw new Error('Tipo de relatório não encontrado');
      await updateDoc(doc(db, collectionName, relatorio.id), { status: 'arquivado', updatedAt: serverTimestamp() });
      setShowDeleteConfirm(false);
      handleGoBack();
    } catch (error) {
      console.error('Erro ao arquivar relatorio:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Card principal com informacoes */}
        <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 shadow-sm border border-border mb-4">
          {/* Codigo e tipo */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}>
              {config.label}
            </span>
            {relatorio.codigo && (
              <span className="text-sm font-mono text-muted-foreground">
                {relatorio.codigo}
              </span>
            )}
          </div>

          {/* Informacoes em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Período</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {relatorio.periodo}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="w-3 h-3" />
                <span>Versão</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                v{relatorio.versaoAtual || 1}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Publicado em</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatDateShort(relatorio.dataPublicacao || relatorio.createdAt)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>Responsável</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {relatorio.responsavel}
              </p>
            </div>

            {relatorio.proximaRevisao && (
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Próxima Revisão</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {formatDateShort(relatorio.proximaRevisao)}
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

            {relatorio.responsavelRevisao && (
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>Responsável pela Revisão</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {relatorio.responsavelRevisao}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Administração - visíveis apenas para admin */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] hover:bg-[#C8E6C9] dark:hover:bg-[#2A3F36] transition-colors"
            >
              <Edit className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              <span className="text-sm font-medium text-[#006837] dark:text-[#2ECC71]">Editar</span>
            </button>
            <button
              onClick={() => setShowVersionModal(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] hover:bg-[#C8E6C9] dark:hover:bg-[#2A3F36] transition-colors"
            >
              <Plus className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              <span className="text-sm font-medium text-[#006837] dark:text-[#2ECC71]">Nova Versão</span>
            </button>
            <button
              onClick={() => setShowVersoes(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] hover:bg-[#C8E6C9] dark:hover:bg-[#2A3F36] transition-colors"
            >
              <History className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              <span className="text-sm font-medium text-[#006837] dark:text-[#2ECC71]">Histórico</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#FEE2E2] dark:bg-[#450A0A]/50 hover:bg-[#FECACA] dark:hover:bg-[#450A0A] transition-colors"
            >
              <Archive className="w-4 h-4 text-[#DC2626] dark:text-[#F87171]" />
              <span className="text-sm font-medium text-[#DC2626] dark:text-[#F87171]">Arquivar</span>
            </button>
          </div>
        )}

        {/* Visualizador de PDF */}
        <div className="mb-4">
          {relatorio.arquivoURL && relatorio.arquivoURL !== '#' ? (
            <PDFViewer
              src={relatorio.arquivoURL}
              title={relatorio.titulo}
              height="500px"
            />
          ) : (
            <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-8 shadow-sm border border-border text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#FEF3C7] dark:bg-[#78350F]/30 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#F59E0B] dark:text-[#FBBF24]" />
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                PDF não disponível
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                O arquivo PDF deste relatório ainda não foi carregado no sistema.
              </p>
              {isAdmin && (
                <Button onClick={() => setShowVersionModal(true)}>
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
            Histórico de Versões ({versoes.length})
          </Button>
        </div>

        {/* Descricao */}
        {relatorio.descricao && (
          <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 shadow-sm border border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {relatorio.descricao}
            </p>
          </div>
        )}

        {/* Observacoes */}
        {relatorio.observacoes && (
          <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 shadow-sm border border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observações
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {relatorio.observacoes}
            </p>
          </div>
        )}

        {/* Tags */}
        {relatorio.tags && relatorio.tags.length > 0 && (
          <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {relatorio.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Versoes */}
      {showVersoes && (
        <div className="fixed inset-0 bg-black/50 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
          <div className="bg-white dark:bg-[#1A2420] rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-black dark:text-white">
                Histórico de Versões
              </h2>
              <button
                onClick={() => setShowVersoes(false)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                        ? 'bg-[#E8F5E9] dark:bg-[#243530] border-[#A5D6A7] dark:border-[#2ECC71]/30'
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-black dark:text-white">
                        v{versao.versao}
                      </span>
                      {versao.status === 'ativo' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#059669]/20 text-[#059669] dark:bg-[#2ECC71]/20 dark:text-[#2ECC71]">
                          Atual
                        </span>
                      )}
                      {versao.status === 'arquivado' || versao.status === 'historico' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                          Histórico
                        </span>
                      ) : null}
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
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edicao */}
      {showEditModal && relatorio && (
        <EditRelatorioModal
          relatorio={relatorio}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal de Nova Versao */}
      {showVersionModal && relatorio && (
        <NewVersionModal
          relatorio={relatorio}
          onClose={() => setShowVersionModal(false)}
          onSave={handleAddVersion}
        />
      )}

      {/* Modal de Confirmacao de Exclusao */}
      {showDeleteConfirm && relatorio && (
        <DeleteConfirmModal
          relatorio={relatorio}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleArchive}
        />
      )}

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

// =============================================================================
// MODAL DE EDICAO DE RELATORIO
// =============================================================================
function EditRelatorioModal({ relatorio, onClose, onSave }) {
  const [formData, setFormData] = useState({
    titulo: relatorio.titulo || '',
    codigo: relatorio.codigo || '',
    periodo: relatorio.periodo || '',
    descricao: relatorio.descricao || '',
    observacoes: relatorio.observacoes || '',
    tags: relatorio.tags?.join(', ') || '',
    responsavel: relatorio.responsavel || '',
    responsavelRevisao: relatorio.responsavelRevisao || '',
    proximaRevisao: relatorio.proximaRevisao?.split('T')[0] || '',
  });

  const handleSubmit = () => {
    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t);

    onSave({
      ...formData,
      tags: tagsArray,
      updatedAt: new Date().toISOString(),
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Editar Relatório
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Código</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Período</label>
              <input
                type="text"
                value={formData.periodo}
                onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
            <textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Responsável</label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Resp. Revisão</label>
              <input
                type="text"
                value={formData.responsavelRevisao}
                onChange={(e) => setFormData({ ...formData, responsavelRevisao: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Próxima Revisão</label>
            <input
              type="date"
              value={formData.proximaRevisao}
              onChange={(e) => setFormData({ ...formData, proximaRevisao: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            <Check className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================================================
// MODAL DE NOVA VERSAO
// =============================================================================
function NewVersionModal({ relatorio, onClose, onSave }) {
  const [formData, setFormData] = useState({
    descricaoAlteracao: '',
    motivoAlteracao: '',
    arquivoURL: relatorio.arquivoURL || '',
    arquivoNome: relatorio.arquivoNome || '',
    enviarParaAprovacao: false,
  });

  const handleSubmit = () => {
    onSave({
      ...formData,
      status: formData.enviarParaAprovacao ? 'pendente_aprovacao' : 'ativo',
      createdAt: new Date().toISOString(),
      createdBy: 'admin@anest.com.br',
      createdByName: 'Administrador',
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Nova Versão
            </h2>
            <p className="text-sm text-muted-foreground">
              {relatorio.codigo} - v{relatorio.versaoAtual || 1} → v{(relatorio.versaoAtual || 1) + 1}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição das Alterações *</label>
            <textarea
              value={formData.descricaoAlteracao}
              onChange={(e) => setFormData({ ...formData, descricaoAlteracao: e.target.value })}
              rows={3}
              placeholder="Descreva as alterações realizadas..."
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Motivo da Alteração *</label>
            <textarea
              value={formData.motivoAlteracao}
              onChange={(e) => setFormData({ ...formData, motivoAlteracao: e.target.value })}
              rows={2}
              placeholder="Ex: Revisão periódica, Atualização de dados, Correção..."
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">URL do Arquivo (PDF)</label>
            <input
              type="text"
              value={formData.arquivoURL}
              onChange={(e) => setFormData({ ...formData, arquivoURL: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground"
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enviarParaAprovacao}
              onChange={(e) => setFormData({ ...formData, enviarParaAprovacao: e.target.checked })}
              className="w-5 h-5 rounded border-border"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Enviar para aprovação</span>
              <p className="text-xs text-muted-foreground">A nova versão ficará pendente até ser aprovada</p>
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
            disabled={!formData.descricaoAlteracao || !formData.motivoAlteracao}
          >
            <Upload className="w-4 h-4 mr-2" />
            Criar Versão
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
function DeleteConfirmModal({ relatorio, onClose, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#FEF3C7] dark:bg-[#78350F]/50 flex items-center justify-center mb-4">
            <Archive className="w-7 h-7 text-[#D97706] dark:text-[#FBBF24]" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Arquivar Relatório?
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            O relatório <strong>"{relatorio.titulo}"</strong> será movido para os arquivados. Você poderá restaurá-lo posteriormente.
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-[#D97706] hover:bg-[#B45309] text-white"
              onClick={onConfirm}
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
