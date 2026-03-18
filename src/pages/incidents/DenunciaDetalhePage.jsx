import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  User,
  Clock,
  Calendar,
  MessageSquare,
  FileText,
  ChevronLeft,
  Send,
  Check,
  Edit3,
  Lock,
  Eye,
  Users,
  AlertCircle,
  Paperclip,
  Search,
  Link2,
} from 'lucide-react';
import { STATUS_CONFIG, DENUNCIA_TYPES } from '@/data/incidentesConfig';
import { useUser } from '@/contexts/UserContext';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useToast } from '@/design-system';
import ExpandableSection from './components/ExpandableSection';
import RcaReadOnly from './components/RcaReadOnly';
import RopVinculacaoReadOnly from './components/RopVinculacaoReadOnly';

// Componente de timeline de respostas
function TimelineItem({ resposta, isLast }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#5B21B6]/30 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-[#E5E7EB] dark:bg-[#2D4A3E] mt-2" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">
            {resposta.autor}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(resposta.data)}
          </span>
          {resposta.isInternal && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F]/30 dark:text-warning">
              Interno
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {resposta.mensagem}
        </p>
      </div>
    </div>
  );
}

// Modal de alteração de status
function StatusModal({ currentStatus, onClose, onSave }) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const statusOptions = Object.entries(STATUS_CONFIG).map(([key, value]) => ({
    id: key,
    ...value,
  }));

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-muted rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Alterar Status
        </h3>

        <div className="space-y-2 mb-6">
          {statusOptions.map((status) => (
            <button
              key={status.id}
              type="button"
              onClick={() => setSelectedStatus(status.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl border transition-all
                ${selectedStatus === status.id
                  ? 'border-[#7C3AED] dark:border-[#A78BFA] bg-[#EDE9FE] dark:bg-[#5B21B6]/30'
                  : 'border-[#E5E7EB] dark:border-border hover:bg-[#F9FAFB] dark:hover:bg-muted'
                }
              `}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="font-medium text-foreground">
                {status.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border text-foreground font-medium hover:bg-[#F9FAFB] dark:hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(selectedStatus)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] dark:bg-[#A78BFA] text-white dark:text-primary-foreground font-medium hover:bg-[#6D28D9] dark:hover:bg-[#C4B5FD] transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de nova resposta
function ReplyModal({ onClose, onSend }) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend({ message, isInternal });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/50">
      <div className="w-full max-w-lg min-h-[50vh] max-h-[90vh] overflow-y-auto bg-white dark:bg-muted rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Adicionar Resposta
        </h3>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua resposta ou observação..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border bg-white dark:bg-muted text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#7C3AED] dark:focus:ring-[#A78BFA] focus:border-transparent transition-all resize-none mb-4"
        />

        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => setIsInternal(!isInternal)}
            className="flex items-center gap-2"
          >
            <div
              className={`
                w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                ${isInternal
                  ? 'bg-[#7C3AED] dark:bg-[#A78BFA] border-[#7C3AED] dark:border-[#A78BFA]'
                  : 'border-[#E5E7EB] dark:border-border'
                }
              `}
            >
              {isInternal && <Check className="w-3 h-3 text-white dark:text-primary-foreground" />}
            </div>
            <span className="text-sm text-foreground">
              Nota interna (não visível ao denunciante)
            </span>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border text-foreground font-medium hover:bg-[#F9FAFB] dark:hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim()}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors
              ${message.trim()
                ? 'bg-[#7C3AED] dark:bg-[#A78BFA] text-white dark:text-primary-foreground hover:bg-[#6D28D9] dark:hover:bg-[#C4B5FD]'
                : 'bg-[#E5E7EB] dark:bg-[#2D4A3E] text-muted-foreground dark:text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de gravidade
function GravidadeModal({ currentGravidade, onClose, onSave }) {
  const [selectedGravidade, setSelectedGravidade] = useState(currentGravidade || 'media');

  const gravidadeOptions = [
    { id: 'baixa', label: 'Baixa', color: '#22C55E', description: 'Situação de menor impacto' },
    { id: 'media', label: 'Média', color: '#F59E0B', description: 'Requer atenção moderada' },
    { id: 'alta', label: 'Alta', color: '#EF4444', description: 'Situação grave, ação urgente' },
    { id: 'critica', label: 'Crítica', color: '#7C3AED', description: 'Máxima prioridade' },
  ];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-muted rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Classificar Gravidade
        </h3>

        <div className="space-y-2 mb-6">
          {gravidadeOptions.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGravidade(g.id)}
              className={`
                w-full flex items-start gap-3 p-3 rounded-xl border transition-all
                ${selectedGravidade === g.id
                  ? 'border-[#7C3AED] dark:border-[#A78BFA] bg-[#EDE9FE] dark:bg-[#5B21B6]/30'
                  : 'border-[#E5E7EB] dark:border-border hover:bg-[#F9FAFB] dark:hover:bg-muted'
                }
              `}
            >
              <span
                className="w-3 h-3 rounded-full mt-1"
                style={{ backgroundColor: g.color }}
              />
              <div className="text-left">
                <span className="font-medium text-foreground block">
                  {g.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border text-foreground font-medium hover:bg-[#F9FAFB] dark:hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(selectedGravidade)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] dark:bg-[#A78BFA] text-white dark:text-primary-foreground font-medium hover:bg-[#6D28D9] dark:hover:bg-[#C4B5FD] transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DenunciaDetalhePage({ onNavigate, denunciaId }) {
  const { user } = useUser();
  const { getDenunciaById, updateDenuncia } = useIncidents();
  const { toast } = useToast();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showGravidadeModal, setShowGravidadeModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Obter denúncia do contexto
  const denuncia = getDenunciaById(denunciaId);

  // LGPD P4: Verificar se o usuário é dono do relato ou admin
  const isOwner = denuncia?.userId && user?.id && denuncia.userId === user.id;
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()));
  const hasAccess = isOwner || isAdmin;

  if (!denuncia) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Denúncia não encontrada
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('incidentes')}
            className="text-[#7C3AED] dark:text-[#A78BFA] font-medium"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  // LGPD P4: Bloquear acesso se não for dono nem admin
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Acesso restrito
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Você não tem permissão para visualizar esta denúncia.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('incidentes')}
            className="text-[#7C3AED] dark:text-[#A78BFA] font-medium"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[denuncia.status] || STATUS_CONFIG.pending;
  const tipoConfig = DENUNCIA_TYPES.find(t => t.value === denuncia.denuncia?.tipo) || {};

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (newStatus) => {
    setIsSaving(true);
    try {
      await updateDenuncia({
        id: denunciaId,
        status: newStatus,
      });
      toast({ title: 'Status atualizado com sucesso', variant: 'success' });
    } catch (err) {
      console.error('[DenunciaDetalhe] Erro ao atualizar status:', err);
      toast({ title: 'Erro ao atualizar status', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
    setShowStatusModal(false);
  };

  const handleReply = async (data) => {
    setIsSaving(true);
    try {
      const currentRespostas = denuncia.admin?.respostas || [];
      const newResposta = {
        id: crypto.randomUUID(),
        autor: user?.displayName || user?.name || 'Usuário',
        mensagem: data.message,
        data: new Date().toISOString(),
        isInternal: data.isInternal || false,
      };
      await updateDenuncia({
        id: denunciaId,
        admin: {
          ...(denuncia.admin || {}),
          respostas: [...currentRespostas, newResposta],
        },
      });
      toast({ title: 'Resposta enviada com sucesso', variant: 'success' });
    } catch (err) {
      console.error('[DenunciaDetalhe] Erro ao enviar resposta:', err);
      toast({ title: 'Erro ao enviar resposta', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGravidadeChange = async (gravidade) => {
    setIsSaving(true);
    try {
      await updateDenuncia({
        id: denunciaId,
        admin: {
          ...(denuncia.admin || {}),
          gravidade,
        },
      });
      toast({ title: 'Gravidade atualizada com sucesso', variant: 'success' });
    } catch (err) {
      console.error('[DenunciaDetalhe] Erro ao alterar gravidade:', err);
      toast({ title: 'Erro ao alterar gravidade', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
    setShowGravidadeModal(false);
  };

  const gravidadeColors = {
    baixa: '#22C55E',
    media: '#F59E0B',
    alta: '#EF4444',
    critica: '#7C3AED',
  };

  const gravidadeLabels = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Detalhe da Denúncia
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Header com protocolo e status */}
        <div className="bg-white dark:bg-muted rounded-2xl p-4 border border-[#E5E7EB] dark:border-border mb-4">
          {/* Linha 1: Titulo + Status */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-bold text-foreground leading-snug">
              {denuncia.denuncia?.titulo || 'Denúncia'}
            </h2>
            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors hover:opacity-80"
              style={{ backgroundColor: `${statusConfig.color}15`, color: statusConfig.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig.color }} />
              {statusConfig.label}
              <Edit3 className="w-3 h-3" />
            </button>
          </div>

          {/* Linha 2: Tipo */}
          <p className="text-sm text-muted-foreground mb-3">
            {tipoConfig.label || denuncia.denuncia?.tipo}
          </p>

          {/* Linha 3: Metadados */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-muted text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formatDate(denuncia.createdAt)}
            </span>
            {(denuncia.protocolo || denuncia.trackingCode) && (
              <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-mono text-primary">
                {denuncia.protocolo || denuncia.trackingCode}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowGravidadeModal(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors hover:opacity-80"
              style={{
                backgroundColor: denuncia.admin?.gravidade
                  ? `${gravidadeColors[denuncia.admin.gravidade]}15`
                  : '#F3F4F6',
                color: denuncia.admin?.gravidade
                  ? gravidadeColors[denuncia.admin.gravidade]
                  : '#6B7280',
              }}
            >
              {denuncia.admin?.gravidade
                ? gravidadeLabels[denuncia.admin.gravidade]
                : 'Classificar gravidade'
              }
              <Edit3 className="w-2.5 h-2.5" />
            </button>
            {denuncia.denunciante?.isAnonimo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] dark:bg-muted text-muted-foreground">
                <Eye className="w-3 h-3" />
                Anônimo
              </span>
            )}
          </div>
        </div>

        {/* Seções expansíveis */}
        <div className="space-y-3">
          {/* Denunciante */}
          <ExpandableSection variant="purple"
            title="Denunciante"
            icon={User}
            defaultOpen
            badge={denuncia.denunciante?.isAnonimo ? 'Anônimo' : null}
          >
            {denuncia.denunciante?.isAnonimo ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F3F4F6] dark:bg-muted">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Denúncia anônima - identidade protegida
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {denuncia.denunciante?.nome && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nome</p>
                    <p className="text-sm text-foreground">
                      {denuncia.denunciante.nome}
                    </p>
                  </div>
                )}
                {denuncia.denunciante?.email && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="text-sm text-foreground">
                      {denuncia.denunciante.email}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ExpandableSection>

          {/* Detalhes da Denúncia */}
          <ExpandableSection variant="purple" title="Detalhes da Denúncia" icon={FileText} defaultOpen>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Título</p>
                <p className="text-base font-medium text-foreground">
                  {denuncia.denuncia?.titulo}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {denuncia.denuncia?.descricao}
                </p>
              </div>

              {denuncia.denuncia?.impacto && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Impacto</p>
                  <p className="text-sm text-foreground">
                    {denuncia.denuncia.impacto}
                  </p>
                </div>
              )}
            </div>
          </ExpandableSection>

          {/* Pessoas Envolvidas */}
          {(denuncia.denuncia?.pessoasEnvolvidas || denuncia.denuncia?.testemunhas) && (
            <ExpandableSection variant="purple" title="Pessoas Envolvidas" icon={Users}>
              <div className="space-y-4">
                {denuncia.denuncia?.pessoasEnvolvidas && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Envolvidos</p>
                    <p className="text-sm text-foreground">
                      {denuncia.denuncia.pessoasEnvolvidas}
                    </p>
                  </div>
                )}

                {denuncia.denuncia?.testemunhas && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Testemunhas</p>
                    <p className="text-sm text-foreground">
                      {denuncia.denuncia.testemunhas}
                    </p>
                  </div>
                )}
              </div>
            </ExpandableSection>
          )}

          {/* Anexos */}
          {denuncia.attachments?.length > 0 && (
            <ExpandableSection variant="purple"
              title="Anexos"
              icon={Paperclip}
              badge={`${denuncia.attachments.length}`}
            >
              <div className="space-y-2">
                {denuncia.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#F3F4F6] dark:bg-muted"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm text-foreground truncate">
                      {file}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-[#7C3AED] dark:text-[#A78BFA] font-medium"
                    >
                      Baixar
                    </button>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Análise de Causa Raiz (Read-Only) */}
          {(denuncia.admin?.rca || denuncia.gestaoInterna?.rca) && (
            <ExpandableSection variant="purple" title="Análise de Causa Raiz" icon={Search}>
              <RcaReadOnly rca={denuncia.admin?.rca || denuncia.gestaoInterna?.rca} />
            </ExpandableSection>
          )}

          {/* ROPs Vinculados (Read-Only) */}
          {((denuncia.admin?.ropsVinculados?.length > 0) || (denuncia.gestaoInterna?.ropsVinculados?.length > 0)) && (
            <ExpandableSection variant="purple" title="ROPs Vinculados" icon={Link2}>
              <RopVinculacaoReadOnly ropsVinculados={denuncia.admin?.ropsVinculados || denuncia.gestaoInterna?.ropsVinculados} />
            </ExpandableSection>
          )}

          {/* Histórico de Respostas */}
          <ExpandableSection variant="purple" title="Histórico" icon={MessageSquare}>
            {denuncia.admin?.respostas?.length > 0 ? (
              <div className="space-y-0">
                {denuncia.admin.respostas.map((resposta, index) => (
                  <TimelineItem
                    key={resposta.id || index}
                    resposta={resposta}
                    isLast={index === denuncia.admin.respostas.length - 1}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma resposta ainda
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowReplyModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border text-foreground font-medium hover:bg-[#F9FAFB] dark:hover:bg-muted transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Adicionar Resposta
            </button>
          </ExpandableSection>
        </div>

        {/* Metadados */}
        <div className="mt-4 p-4 rounded-xl bg-[#F3F4F6] dark:bg-[#0D1F17]">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recebida em: {formatDateTime(denuncia.createdAt)}</span>
            {denuncia.updatedAt && (
              <span>Atualizado: {formatDateTime(denuncia.updatedAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStatusModal && (
        <StatusModal
          currentStatus={denuncia.status}
          onClose={() => setShowStatusModal(false)}
          onSave={handleStatusChange}
        />
      )}

      {showReplyModal && (
        <ReplyModal
          onClose={() => setShowReplyModal(false)}
          onSend={handleReply}
        />
      )}

      {showGravidadeModal && (
        <GravidadeModal
          currentGravidade={denuncia.admin?.gravidade}
          onClose={() => setShowGravidadeModal(false)}
          onSave={handleGravidadeChange}
        />
      )}
    </div>
  );
}
