import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  User,
  Clock,
  MapPin,
  Calendar,
  Activity,
  Stethoscope,
  MessageSquare,
  FileText,
  ChevronLeft,
  Send,
  Check,
  X,
  Edit3,
  UserCheck,
  Flag,
  Shield,
  Search,
  Link2,
} from 'lucide-react';
import { useIncidents } from '@/contexts/IncidentsContext';
import {
  STATUS_CONFIG,
  SEVERITY_LEVELS,
  INCIDENT_TYPES,
  FUNCOES
} from '@/data/incidentesConfig';
import { useUser } from '@/contexts/UserContext';
import { useMessages } from '@/contexts/MessagesContext';
import { notifyStatusChange } from '@/services/notificationService';
import ExpandableSection from './components/ExpandableSection';
import RcaReadOnly from './components/RcaReadOnly';
import RopVinculacaoReadOnly from './components/RopVinculacaoReadOnly';

// Campo de informação
function InfoField({ label, value, icon: Icon }) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178] mt-0.5 flex-shrink-0" />
      )}
      <div>
        <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">{label}</p>
        <p className="text-sm text-[#111827] dark:text-white">{value}</p>
      </div>
    </div>
  );
}

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
        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-[#E5E7EB] dark:bg-[#2D4A3E] mt-2" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-[#111827] dark:text-white">
            {resposta.autor}
          </span>
          <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">
            {formatDate(resposta.data)}
          </span>
        </div>
        <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
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
      <div className="w-full max-w-md bg-white dark:bg-[#1A2F23] rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-[#111827] dark:text-white mb-4">
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
                  ? 'border-[#006837] dark:border-[#2ECC71] bg-[#E8F5E9] dark:bg-[#243530]'
                  : 'border-[#E5E7EB] dark:border-[#2D4A3E] hover:bg-[#F9FAFB] dark:hover:bg-[#243530]'
                }
              `}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="font-medium text-[#111827] dark:text-white">
                {status.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] text-[#111827] dark:text-white font-medium hover:bg-[#F9FAFB] dark:hover:bg-[#243530] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(selectedStatus)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916] font-medium hover:bg-[#005530] dark:hover:bg-[#27AE60] transition-colors"
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
      <div className="w-full max-w-lg min-h-[50vh] max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1A2F23] rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-[#111827] dark:text-white mb-4">
          Adicionar Resposta
        </h3>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua resposta ou observação..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2F23] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] dark:placeholder:text-[#4B5E55] focus:outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71] focus:border-transparent transition-all resize-none mb-4"
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
                  ? 'bg-[#006837] dark:bg-[#2ECC71] border-[#006837] dark:border-[#2ECC71]'
                  : 'border-[#E5E7EB] dark:border-[#2D4A3E]'
                }
              `}
            >
              {isInternal && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
            </div>
            <span className="text-sm text-[#111827] dark:text-white">
              Nota interna (não visível ao notificante)
            </span>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] text-[#111827] dark:text-white font-medium hover:bg-[#F9FAFB] dark:hover:bg-[#243530] transition-colors"
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
                ? 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916] hover:bg-[#005530] dark:hover:bg-[#27AE60]'
                : 'bg-[#E5E7EB] dark:bg-[#2D4A3E] text-[#9CA3AF] dark:text-[#4B5E55] cursor-not-allowed'
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

export default function IncidenteDetalhePage({ onNavigate, incidenteId }) {
  const { user } = useUser();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);

  // Obter incidente do contexto
  const { getIncidenteById, updateStatus: ctxUpdateStatus, updateIncidente } = useIncidents();
  const { createSystemNotification, sendMessage } = useMessages();
  const incidente = getIncidenteById(incidenteId);

  // LGPD P4: Verificar se o usuário é dono do relato ou admin
  const isOwner = incidente?.userId && user?.id && incidente.userId === user.id;
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()));
  const hasAccess = isOwner || isAdmin;

  if (!incidente) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-2">
            Incidente não encontrado
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('incidentes')}
            className="text-[#006837] dark:text-[#2ECC71] font-medium"
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
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-2">
            Acesso restrito
          </h2>
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-4">
            Você não tem permissão para visualizar este incidente.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('incidentes')}
            className="text-[#006837] dark:text-[#2ECC71] font-medium"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[incidente.status] || STATUS_CONFIG.pending;
  const severityConfig = SEVERITY_LEVELS.find(s => s.value === incidente.incidente?.severidade) || {};
  const tipoConfig = INCIDENT_TYPES[incidente.incidente?.tipo] || {};

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
    try {
      await ctxUpdateStatus(incidenteId, newStatus, {
        userId: user?.id || user?.uid,
        userName: user?.displayName || user?.name,
      });
      // Notify status change (in-app system notification)
      notifyStatusChange(createSystemNotification, {
        protocolo: incidente.protocolo,
        newStatus,
      });
      // Notify the reporter if identified
      if (incidente.userId && incidente.notificante?.tipoIdentificacao === 'identificado') {
        sendMessage({
          recipientId: incidente.userId,
          subject: 'Status do seu relato atualizado',
          content: `O status do seu relato ${incidente.protocolo} foi atualizado.`,
          priority: 'normal',
        });
      }
    } catch (err) {
      console.error('[IncidenteDetalhe] Erro ao atualizar status:', err);
    }
    setShowStatusModal(false);
  };

  const handleReply = async (data) => {
    try {
      const currentRespostas = incidente.adminData?.respostas || incidente.admin?.respostas || [];
      const now = new Date().toISOString();
      const newResposta = {
        id: crypto.randomUUID(),
        autor: user?.displayName || user?.name || 'Usuário',
        mensagem: data.message,
        data: now,
        isInternal: data.isInternal || false,
      };
      await updateIncidente({
        id: incidenteId,
        adminData: {
          ...(incidente.adminData || incidente.admin || {}),
          respostas: [...currentRespostas, newResposta],
        },
      });
    } catch (err) {
      console.error('[IncidenteDetalhe] Erro ao enviar resposta:', err);
    }
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Detalhe do Incidente
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Header com protocolo e status */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          {/* Linha 1: Titulo + Status */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-bold text-[#111827] dark:text-white leading-snug">
              {tipoConfig.label || incidente.incidente?.tipo}
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

          {/* Linha 2: Subtipo */}
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-3">
            {tipoConfig.subtipos?.find(s => s.value === incidente.incidente?.subtipo)?.label || incidente.incidente?.subtipo || incidente.incidente?.tipo}
          </p>

          {/* Linha 3: Metadados */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#243530] text-xs text-[#6B7280] dark:text-[#6B8178]">
              <Calendar className="w-3 h-3" />
              {formatDate(incidente.incidente?.dataOcorrencia)}
            </span>
            {incidente.protocolo && (
              <span className="px-2 py-0.5 rounded-md bg-[#E8F5E9] dark:bg-[#243530] text-xs font-mono text-[#006837] dark:text-[#2ECC71]">
                {incidente.protocolo}
              </span>
            )}
            {severityConfig.label && (
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: `${severityConfig.color}15`, color: severityConfig.color }}
              >
                {severityConfig.label}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#E8F5E9] dark:bg-[#065F46]/30 text-[#047857] dark:text-[#6EE7B7]">
              {incidente.source === 'interno' ? 'Interno' : incidente.source === 'externo' ? 'Externo' : 'QR Code'}
            </span>
          </div>
        </div>

        {/* Seções expansíveis */}
        <div className="space-y-3">
          {/* Notificante */}
          <ExpandableSection title="Notificante" icon={User} defaultOpen>
            {incidente.notificante?.tipoIdentificacao === 'anonimo' ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F3F4F6] dark:bg-[#243530]">
                <Shield className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178]" />
                <span className="text-sm text-[#6B7280] dark:text-[#6B8178]">
                  Notificação anônima
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoField label="Nome" value={incidente.notificante?.nome} icon={User} />
                <InfoField label="Função" value={incidente.notificante?.funcao} icon={UserCheck} />
                <InfoField label="Setor" value={incidente.notificante?.setor} icon={MapPin} />
                <InfoField label="Email" value={incidente.notificante?.email} icon={MessageSquare} />
              </div>
            )}
          </ExpandableSection>

          {/* Descrição do Incidente */}
          <ExpandableSection title="Descrição do Incidente" icon={AlertTriangle} defaultOpen>
            <div className="space-y-4">
              {incidente.incidente?.subtipo && (
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Subtipo</p>
                  <p className="text-sm text-[#111827] dark:text-white">
                    {incidente.incidente.subtipo}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Descrição</p>
                <p className="text-sm text-[#111827] dark:text-white whitespace-pre-wrap">
                  {incidente.incidente?.descricao}
                </p>
              </div>
            </div>
          </ExpandableSection>

          {/* Impacto */}
          <ExpandableSection title="Impacto" icon={Activity}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Dano ao Paciente</p>
                <p className="text-sm text-[#111827] dark:text-white">
                  {incidente.impacto?.danoAoPaciente || 'Não informado'}
                </p>
              </div>

              {incidente.impacto?.descricaoDano && (
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Descrição do Dano</p>
                  <p className="text-sm text-[#111827] dark:text-white">
                    {incidente.impacto.descricaoDano}
                  </p>
                </div>
              )}

              {incidente.impacto?.acoesTomadas && (
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Ações Tomadas</p>
                  <p className="text-sm text-[#111827] dark:text-white">
                    {incidente.impacto.acoesTomadas}
                  </p>
                </div>
              )}

              {incidente.impacto?.sugestoesMelhoria && (
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Sugestões de Melhoria</p>
                  <p className="text-sm text-[#111827] dark:text-white">
                    {incidente.impacto.sugestoesMelhoria}
                  </p>
                </div>
              )}
            </div>
          </ExpandableSection>

          {/* Contexto Anestesiologia */}
          {incidente.contextoAnest && (
            <ExpandableSection title="Contexto Anestesiologia" icon={Stethoscope}>
              <div className="space-y-4">
                {incidente.contextoAnest.faseProcedimento && (
                  <InfoField
                    label="Fase do Procedimento"
                    value={incidente.contextoAnest.faseProcedimento}
                  />
                )}

                {incidente.contextoAnest.tipoAnestesia && (
                  <InfoField
                    label="Tipo de Anestesia"
                    value={incidente.contextoAnest.tipoAnestesia}
                  />
                )}

                {incidente.contextoAnest.monitoramento?.length > 0 && (
                  <div>
                    <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-2">Monitoramento</p>
                    <div className="flex flex-wrap gap-1">
                      {incidente.contextoAnest.monitoramento.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-1 rounded-lg text-xs bg-[#E8F5E9] dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ExpandableSection>
          )}

          {/* Classificação (Admin) */}
          {incidente.classificacao && (
            <ExpandableSection title="Classificação" icon={Flag}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${incidente.classificacao.requerInvestigacao ? 'bg-[#006837] dark:bg-[#2ECC71]' : 'bg-[#E5E7EB] dark:bg-[#2D4A3E]'}`}>
                    {incidente.classificacao.requerInvestigacao && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
                  </div>
                  <span className="text-sm text-[#111827] dark:text-white">Requer investigação</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${incidente.classificacao.comunicarComissao ? 'bg-[#006837] dark:bg-[#2ECC71]' : 'bg-[#E5E7EB] dark:bg-[#2D4A3E]'}`}>
                    {incidente.classificacao.comunicarComissao && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
                  </div>
                  <span className="text-sm text-[#111827] dark:text-white">Comunicar comissão</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${incidente.classificacao.comunicarPaciente ? 'bg-[#006837] dark:bg-[#2ECC71]' : 'bg-[#E5E7EB] dark:bg-[#2D4A3E]'}`}>
                    {incidente.classificacao.comunicarPaciente && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
                  </div>
                  <span className="text-sm text-[#111827] dark:text-white">Comunicar paciente/família</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${incidente.classificacao.comunicarOrgaoRegulador ? 'bg-[#006837] dark:bg-[#2ECC71]' : 'bg-[#E5E7EB] dark:bg-[#2D4A3E]'}`}>
                    {incidente.classificacao.comunicarOrgaoRegulador && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
                  </div>
                  <span className="text-sm text-[#111827] dark:text-white">Comunicar órgão regulador</span>
                </div>
              </div>
            </ExpandableSection>
          )}

          {/* Análise de Causa Raiz (Read-Only) */}
          {(incidente.admin?.rca || incidente.gestaoInterna?.rca) && (
            <ExpandableSection title="Análise de Causa Raiz" icon={Search}>
              <RcaReadOnly rca={incidente.admin?.rca || incidente.gestaoInterna?.rca} />
            </ExpandableSection>
          )}

          {/* ROPs Vinculados (Read-Only) */}
          {((incidente.admin?.ropsVinculados?.length > 0) || (incidente.gestaoInterna?.ropsVinculados?.length > 0)) && (
            <ExpandableSection title="ROPs Vinculados" icon={Link2}>
              <RopVinculacaoReadOnly ropsVinculados={incidente.admin?.ropsVinculados || incidente.gestaoInterna?.ropsVinculados} />
            </ExpandableSection>
          )}

          {/* Histórico de Respostas */}
          <ExpandableSection title="Histórico" icon={MessageSquare}>
            {incidente.admin?.respostas?.length > 0 ? (
              <div className="space-y-0">
                {incidente.admin.respostas.map((resposta, index) => (
                  <TimelineItem
                    key={resposta.id || index}
                    resposta={resposta}
                    isLast={index === incidente.admin.respostas.length - 1}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178] text-center py-4">
                Nenhuma resposta ainda
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowReplyModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] text-[#111827] dark:text-white font-medium hover:bg-[#F9FAFB] dark:hover:bg-[#243530] transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Adicionar Resposta
            </button>
          </ExpandableSection>
        </div>

        {/* Metadados */}
        <div className="mt-4 p-4 rounded-xl bg-[#F3F4F6] dark:bg-[#0D1F17]">
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#6B8178]">
            <span>Criado em: {formatDateTime(incidente.createdAt)}</span>
            {incidente.updatedAt && (
              <span>Atualizado: {formatDateTime(incidente.updatedAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStatusModal && (
        <StatusModal
          currentStatus={incidente.status}
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
    </div>
  );
}
