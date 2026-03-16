import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  User,
  Clock,
  Shield,
  Plus,
  Save,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Send,
  Search,
  Link2,
  Timer,
  Calendar,
} from 'lucide-react';
import {
  STATUS_CONFIG,
  SEVERITY_LEVELS,
  INCIDENT_TYPES,
  PRIORIDADES_INTERNAS,
  CLASSIFICACOES_INTERNAS,
  MEMBROS_COMITE,
} from '@/data/incidentesConfig';
import { createRcaTemplate, getRiskLevel, getNextDeadline, RISK_DEADLINES_LEGEND } from '@/data/rcaConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useUser } from '@/contexts/UserContext';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useMessages } from '@/contexts/MessagesContext';
import { notifyDeadlineReminder } from '@/services/notificationService';
import { Button, Select, DatePicker, Textarea, Timeline, useToast } from '@/design-system';
import ExpandableSection from './components/ExpandableSection';
import RcaSection from './components/RcaSection';
import RopVinculacao from './components/RopVinculacao';

// Info row component
function InfoRow({ label, value, highlight = false }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-xs text-[#6B7280] dark:text-[#6B8178] sm:w-40 flex-shrink-0">
        {label}:
      </span>
      <span className={`text-sm ${highlight ? 'font-medium text-[#006837] dark:text-[#2ECC71]' : 'text-[#111827] dark:text-white'}`}>
        {value}
      </span>
    </div>
  );
}


export default function IncidenteGestaoPage({ onNavigate, goBack, params, incidenteId: propIncidenteId }) {
  const { incidentes, getIncidenteById, updateGestaoInterna } = useIncidents();
  const { user } = useUser();
  const { incidentResponsibles } = useUsersManagement();

  // Find incident by ID
  const incidenteId = propIncidenteId || params?.id || 'inc-001';
  const incidente = getIncidenteById(incidenteId) || incidentes[0];
  const returnTo = params?.returnTo;

  // Internal management state - load from gestaoInterna (where updateGestaoInterna saves)
  const gi = incidente?.gestaoInterna || {};
  const [gestao, setGestao] = useState({
    responsavelAnalise: gi.responsavelAnalise || '',
    prioridadeInterna: gi.prioridadeInterna || 'media',
    classificacaoInterna: gi.classificacaoInterna || 'em_analise',
    dataLimiteResposta: gi.dataLimiteResposta || '',
    notasInternas: gi.notasInternas || '',
    parecer: gi.parecer || '',
    recomendacoes: gi.recomendacoes || '',
    feedbackAoRelator: gi.feedbackAoRelator || '',
    rca: gi.rca || null,
    ropsVinculados: gi.ropsVinculados || [],
    acoes: gi.acoes || [],
  });

  // Dynamic dropdown for responsáveis
  const responsaveisOptions = useMemo(() => {
    if (incidentResponsibles.length > 0) {
      return incidentResponsibles.map(r => ({
        value: r.id,
        label: r.nome,
      }));
    }
    return MEMBROS_COMITE;
  }, [incidentResponsibles]);

  const [novaAcao, setNovaAcao] = useState('');
  const [showAddAcao, setShowAddAcao] = useState(false);
  const [saving, setSaving] = useState(false);

  const { createSystemNotification, sendMessage } = useMessages();
  const { toast } = useToast();

  const updateGestao = (field, value) => {
    setGestao(prev => ({ ...prev, [field]: value }));
  };

  const handleRcaChange = (rcaData) => setGestao(prev => ({ ...prev, rca: rcaData }));
  const handleInitializeRca = () => setGestao(prev => ({ ...prev, rca: createRcaTemplate() }));
  const handleRopsChange = (ropsVinculados) => setGestao(prev => ({ ...prev, ropsVinculados }));

  // Compute deadline info
  const deadlineInfo = useMemo(() => {
    const gi = incidente?.gestaoInterna || {};
    const historico = gi.historicoStatus || incidente?.admin?.historicoStatus || [];
    const currentStatus = historico.length > 0 ? historico[0].status : incidente?.status;
    return getNextDeadline(gestao.rca, historico, currentStatus, incidente?.createdAt);
  }, [gestao.rca, incidente]);

  // Send deadline reminder on mount when deadline is ≤1 day away
  useEffect(() => {
    if (!deadlineInfo || !incidente) return;
    const { nextDeadline, nextStatus, riskLevel } = deadlineInfo;
    const now = new Date();
    const msLeft = nextDeadline.getTime() - now.getTime();
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);

    if (daysLeft > 1) return;

    const storageKey = `deadline_notified_${incidenteId}_${nextStatus}`;
    if (localStorage.getItem(storageKey)) return;

    const nextStatusLabel = STATUS_CONFIG[nextStatus]?.label || nextStatus;
    const deadlineFormatted = nextDeadline.toLocaleDateString('pt-BR');
    const protocolo = incidente.protocolo || incidenteId;

    notifyDeadlineReminder(createSystemNotification, {
      protocolo,
      nextStatusLabel,
      deadline: deadlineFormatted,
      riskLevel: riskLevel.label,
      tipo: 'incidente',
      recipientId: gestao.responsavelAnalise || undefined,
    });

    if (gestao.responsavelAnalise) {
      sendMessage({
        recipientId: gestao.responsavelAnalise,
        subject: `Prazo amanhã: ${protocolo}`,
        content: `O incidente ${protocolo} tem prazo para "${nextStatusLabel}" em ${deadlineFormatted}. Nível de risco: ${riskLevel.label}. Acesse a gestão do caso para tomar as ações necessárias.`,
        priority: 'urgente',
      });
    }

    localStorage.setItem(storageKey, 'true');
  }, [deadlineInfo, incidenteId]);

  const statusConfig = STATUS_CONFIG[incidente.status] || STATUS_CONFIG.pending;
  const severityConfig = SEVERITY_LEVELS.find(s => s.value === incidente.incidente?.severidade) || {};
  const tipoConfig = INCIDENT_TYPES[incidente.incidente?.tipo] || {};
  const subtipoLabel = tipoConfig.subtipos?.find(s => s.value === incidente.incidente?.subtipo)?.label || incidente.incidente?.subtipo;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  // Convert string date to Date object for DatePicker
  const parseDate = (dateStr) => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d;
  };

  // Convert Date object to ISO string for state
  const dateToString = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const userInfo = { userId: user?.id || user?.uid, userName: user?.displayName || user?.name };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGestaoInterna(incidenteId, {
        ...gestao,
        ultimaAtualizacao: new Date().toISOString(),
      }, userInfo);
      toast({ title: 'Alterações salvas com sucesso!', variant: 'success' });
      // Notify status change if status changed
      const oldStatus = incidente?.gestaoInterna?.classificacaoInterna;
      if (oldStatus && oldStatus !== gestao.classificacaoInterna) {
        const protocolo = incidente.protocolo || incidenteId;
        // Notify reporter if identified
        if (incidente.notificante?.tipoIdentificacao === 'identificado' && incidente.userId) {
          createSystemNotification({
            category: 'incidente',
            subject: `Atualização do seu relato ${protocolo}`,
            content: `Seu relato ${protocolo} foi atualizado pelo Comitê de Ética.`,
            senderName: 'Comitê de Segurança',
            priority: 'normal',
            actionUrl: 'incidenteDetalhe',
            actionLabel: 'Ver Incidente',
            actionParams: { id: incidenteId },
            recipientId: incidente.userId,
          });
        }
        // Notify investigator (responsável)
        if (gestao.responsavelAnalise) {
          createSystemNotification({
            category: 'incidente',
            subject: `Caso ${protocolo} atualizado`,
            content: `O incidente ${protocolo} foi atualizado.`,
            senderName: 'Comitê de Segurança',
            priority: 'normal',
            actionUrl: 'incidenteGestao',
            actionLabel: 'Ver Gestão',
            actionParams: { id: incidenteId },
            recipientId: gestao.responsavelAnalise,
          });
        }
        // Notify all incident responsibles
        const otherResponsibles = incidentResponsibles
          .filter(r => r.receberIncidentes && r.notificarApp && r.id !== gestao.responsavelAnalise)
          .map(r => r.id);
        if (otherResponsibles.length > 0) {
          createSystemNotification({
            category: 'incidente',
            subject: `Incidente ${protocolo} atualizado`,
            content: `O incidente ${protocolo} teve status alterado.`,
            senderName: 'Comitê de Segurança',
            priority: 'normal',
            actionUrl: 'incidenteDetalhe',
            actionLabel: 'Ver Incidente',
            actionParams: { id: incidenteId },
            recipientIds: otherResponsibles,
          });
        }
      }
    } catch (err) {
      console.error('[IncidenteGestao] Erro ao salvar:', err);
      toast({ title: 'Erro ao salvar alterações. Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAcao = async () => {
    if (!novaAcao.trim()) return;
    try {
      const existingAcoes = gestao.acoes || [];
      const newAcao = {
        id: Date.now().toString(),
        descricao: novaAcao.trim(),
        criadoEm: new Date().toISOString(),
        status: 'pendente',
      };
      const updatedAcoes = [...existingAcoes, newAcao];
      await updateGestaoInterna(incidenteId, {
        ...gestao,
        acoes: updatedAcoes,
        ultimaAtualizacao: new Date().toISOString(),
      }, userInfo);
      setGestao(prev => ({ ...prev, acoes: updatedAcoes }));
      setNovaAcao('');
      setShowAddAcao(false);
    } catch (err) {
      console.error('[IncidenteGestao] Erro ao adicionar ação:', err);
    }
  };

  const handleBack = () => {
    if (returnTo === 'painel-etica') {
      onNavigate('permissions', { initialSection: 'incidentes' });
    } else if (goBack) {
      goBack();
    } else {
      onNavigate('incidenteDetalhe', { id: incidente.id });
    }
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

  // Header via createPortal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Gestão do Incidente
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Header Card - Status e Info Principal */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          {/* Linha 1: Titulo + Status */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-bold text-[#111827] dark:text-white leading-snug">
              {tipoConfig.label || incidente.incidente?.tipo}
            </h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: `${statusConfig.color}15`, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          </div>

          {/* Linha 2: Subtipo */}
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-3">
            {subtipoLabel}
          </p>

          {/* Linha 3: Metadados */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#243530] text-xs text-[#6B7280] dark:text-[#6B8178]">
              <Calendar className="w-3 h-3" />
              {formatDate(incidente.createdAt)}
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
          </div>
        </div>

        {/* Banner - Área Restrita */}
        <div className="mb-4 p-3 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#F59E0B]" />
            <p className="text-xs font-medium text-[#92400E] dark:text-[#FBBF24]">
              Área Restrita - Comitê de Ética
            </p>
          </div>
          <p className="text-xs text-[#A16207] dark:text-[#FBBF24] mt-1">
            As informações abaixo são de uso exclusivo do Comitê de Ética e não são visíveis ao relator.
          </p>
        </div>

        {/* Card de Prazo Limite */}
        <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-[#1A2F23] border border-[#E5E7EB] dark:border-[#2D4A3E]">
          {deadlineInfo ? (() => {
            const now = new Date();
            const daysLeft = (deadlineInfo.nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            const nextStatusLabel = STATUS_CONFIG[deadlineInfo.nextStatus]?.label || deadlineInfo.nextStatus;

            let urgencyColor, urgencyLabel;
            if (daysLeft <= 0) {
              urgencyColor = '#DC2626'; urgencyLabel = 'Vencido';
            } else if (daysLeft <= 3) {
              urgencyColor = '#F59E0B'; urgencyLabel = `${Math.ceil(daysLeft)} dia(s)`;
            } else {
              urgencyColor = '#22C55E'; urgencyLabel = `${Math.ceil(daysLeft)} dias`;
            }

            return (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="w-4 h-4" style={{ color: urgencyColor }} />
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-white">Prazo Limite</h3>
                  <span
                    className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${urgencyColor}20`, color: urgencyColor }}
                  >
                    {urgencyLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">Próxima etapa</span>
                    <span className="text-sm font-medium text-[#111827] dark:text-white">{nextStatusLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">Prazo da próxima etapa</span>
                    <span className="text-sm font-medium" style={{ color: urgencyColor }}>
                      {deadlineInfo.nextDeadline.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">Prazo final (encerramento)</span>
                    <span className="text-sm font-medium text-[#111827] dark:text-white">
                      {deadlineInfo.finalDeadline.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">Nível de risco</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: deadlineInfo.riskLevel.bgColor, color: deadlineInfo.riskLevel.color }}
                    >
                      {deadlineInfo.riskLevel.label} ({deadlineInfo.deadlineDays}d)
                    </span>
                  </div>
                </div>
              </>
            );
          })() : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178]" />
                <h3 className="text-sm font-semibold text-[#111827] dark:text-white">Prazo Limite</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] dark:bg-[#243530] text-[#6B7280] dark:text-[#6B8178]">
                  Pendente
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                Preencha a classificação de risco na Análise de Causa Raiz (RCA) para calcular os prazos automaticamente.
              </p>
            </>
          )}
        </div>

        {/* Legenda de Prazos por Nível de Risco */}
        <div className="mb-4 rounded-2xl bg-white dark:bg-[#1A2F23] border border-[#E5E7EB] dark:border-[#2D4A3E] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F9FAFB] dark:bg-[#0D1F17] border-b border-[#E5E7EB] dark:border-[#2D4A3E]">
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#6B8178] uppercase tracking-wide">
              Prazos recomendados por nível de risco
            </p>
          </div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2D4A3E]">
            {RISK_DEADLINES_LEGEND.map((item) => (
              <div key={item.level} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium text-[#111827] dark:text-white">
                  {item.label}
                </span>
                <span
                  className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ backgroundColor: item.bgColor, color: item.color }}
                >
                  {item.range}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Seções com ExpandableSection */}
        <div className="space-y-3">
          <ExpandableSection title="Notificante" icon={User} defaultOpen>
            <div className="space-y-3">
              <InfoRow label="Nome" value={incidente.notificante?.tipoIdentificacao === 'anonimo' ? 'Anônimo' : incidente.notificante?.nome} />
              <InfoRow label="Função" value={incidente.notificante?.funcao} />
              <InfoRow label="Setor" value={incidente.notificante?.setor} />
              <InfoRow label="Email" value={incidente.notificante?.email} />
              <InfoRow label="Ramal" value={incidente.notificante?.ramal} />
            </div>
          </ExpandableSection>

          <ExpandableSection title="Dados do Incidente" icon={AlertTriangle}>
            <div className="space-y-3">
              <InfoRow label="Data" value={formatDate(incidente.incidente?.dataOcorrencia)} />
              <InfoRow label="Hora" value={incidente.incidente?.horaOcorrencia} />
              <InfoRow label="Local" value={incidente.incidente?.local} />
              <InfoRow label="Local Específico" value={incidente.incidente?.localEspecifico} />
              <InfoRow label="Unidade" value={incidente.incidente?.unidade} />
              <div className="mt-3 p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#0D1F17]">
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Descrição</p>
                <p className="text-sm text-[#111827] dark:text-white">
                  {incidente.incidente?.descricao}
                </p>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection title="Impacto" icon={AlertCircle}>
            <div className="space-y-3">
              <InfoRow label="Dano ao Paciente" value={incidente.impacto?.danoAoPaciente ? 'Sim' : 'Não'} highlight={incidente.impacto?.danoAoPaciente} />
              <InfoRow label="Descrição do Dano" value={incidente.impacto?.descricaoDano} />
              <InfoRow label="Ações Tomadas" value={incidente.impacto?.acoesTomadas} />
              <InfoRow label="Sugestões" value={incidente.impacto?.sugestoesMelhoria} />
            </div>
          </ExpandableSection>

          <ExpandableSection title="Gestão Interna" icon={Edit3} defaultOpen>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Responsável pela Análise"
                  value={gestao.responsavelAnalise}
                  onChange={(v) => updateGestao('responsavelAnalise', v)}
                  options={responsaveisOptions}
                  placeholder="Selecione..."
                />

                <Select
                  label="Prioridade Interna"
                  value={gestao.prioridadeInterna}
                  onChange={(v) => updateGestao('prioridadeInterna', v)}
                  options={PRIORIDADES_INTERNAS}
                  placeholder="Selecione..."
                />

                <Select
                  label="Classificação"
                  value={gestao.classificacaoInterna}
                  onChange={(v) => updateGestao('classificacaoInterna', v)}
                  options={CLASSIFICACOES_INTERNAS}
                  placeholder="Selecione..."
                />

                <DatePicker
                  label="Data Limite para Resposta"
                  value={parseDate(gestao.dataLimiteResposta)}
                  onChange={(d) => updateGestao('dataLimiteResposta', dateToString(d))}
                  placeholder="Selecione uma data"
                />
              </div>

              <Textarea
                label="Notas Internas (não visíveis ao relator)"
                value={gestao.notasInternas}
                onChange={(v) => updateGestao('notasInternas', v)}
                placeholder="Anotações internas do comitê..."
                rows={3}
              />

              <Textarea
                label="Parecer do Comitê"
                value={gestao.parecer}
                onChange={(v) => updateGestao('parecer', v)}
                placeholder="Parecer final do comitê sobre o caso..."
                rows={4}
              />

              <Textarea
                label="Recomendações de Melhoria"
                value={gestao.recomendacoes}
                onChange={(v) => updateGestao('recomendacoes', v)}
                placeholder="Recomendações para prevenção de recorrência..."
                rows={3}
              />

              <Textarea
                label="Feedback ao Relator (visível ao relator)"
                value={gestao.feedbackAoRelator}
                onChange={(v) => updateGestao('feedbackAoRelator', v)}
                placeholder="Mensagem que será enviada ao relator..."
                rows={3}
              />
            </div>
          </ExpandableSection>

          <ExpandableSection title="Análise de Causa Raiz (RCA)" icon={Search}>
            <RcaSection
              rca={gestao.rca}
              onChange={handleRcaChange}
              onInitialize={handleInitializeRca}
            />
          </ExpandableSection>

          <ExpandableSection title="ROPs Vinculados" icon={Link2}>
            <RopVinculacao
              ropsVinculados={gestao.ropsVinculados}
              incidenteTipo={incidente.incidente?.tipo}
              onChange={handleRopsChange}
            />
          </ExpandableSection>

          <ExpandableSection title="Histórico de Status" icon={Clock}>
            {(() => {
              const STATUS_FLOW = ['pending', 'in_review', 'investigating', 'action_required', 'resolved', 'closed'];
              const gi = incidente.gestaoInterna || {};
              const historico = gi.historicoStatus || incidente.admin?.historicoStatus || [];

              const pastItems = historico.map((item, index) => ({
                id: `status-${index}`,
                title: STATUS_CONFIG[item.status]?.label || item.status,
                description: `por ${item.usuario || item.user || 'Sistema'}${item.observacao ? ` — ${item.observacao}` : ''}`,
                timestamp: new Date(item.data || item.date).toLocaleString('pt-BR'),
                status: index === 0 ? 'active' : 'completed',
              }));

              const currentStatus = historico.length > 0 ? historico[0].status : incidente.status;
              const currentIdx = STATUS_FLOW.indexOf(currentStatus);
              const lastDate = historico.length > 0
                ? new Date(historico[0].data || historico[0].date)
                : new Date(incidente.createdAt);

              const futureSteps = [];
              if (deadlineInfo && currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1) {
                const remaining = STATUS_FLOW.slice(currentIdx + 1);
                remaining.forEach((statusKey, i) => {
                  const estimatedDate = new Date(lastDate);
                  estimatedDate.setDate(estimatedDate.getDate() + deadlineInfo.stepInterval * (i + 1));
                  futureSteps.push({
                    id: `future-${statusKey}`,
                    title: STATUS_CONFIG[statusKey]?.label || statusKey,
                    description: `Risco ${deadlineInfo.riskLevel.label} · ${deadlineInfo.deadlineDays}d total`,
                    timestamp: `Data limite: ${estimatedDate.toLocaleDateString('pt-BR')}`,
                    status: 'pending',
                  });
                });
              }

              const allItems = [...pastItems, ...futureSteps];

              return allItems.length > 0 ? (
                <Timeline items={allItems} size="sm" />
              ) : (
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178] text-center py-4">
                  Nenhum histórico de status registrado.
                </p>
              );
            })()}
          </ExpandableSection>

          <ExpandableSection title="Ações Realizadas" icon={CheckCircle2}>
            <div>
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setShowAddAcao(!showAddAcao)}
                  className="flex items-center gap-1 text-xs font-medium text-[#006837] dark:text-[#2ECC71]"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>

              {showAddAcao && (
                <div className="mb-4 p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1F17]">
                  <Textarea
                    value={novaAcao}
                    onChange={setNovaAcao}
                    placeholder="Descreva a ação realizada..."
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAcao(false)}
                      className="px-3 py-1.5 text-xs font-medium text-[#6B7280] dark:text-[#6B8178] hover:text-[#111827] dark:hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAcao}
                      className="px-3 py-1.5 rounded-lg bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916] text-xs font-medium"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              {incidente.admin?.respostas?.length > 0 ? (
                <div className="space-y-3">
                  {incidente.admin.respostas.map((resp, index) => (
                    <div key={resp.id || index} className="p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#0D1F17]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[#111827] dark:text-white">
                          {resp.responderName}
                        </span>
                        <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                          {formatDate(resp.createdAt)}
                        </span>
                        {resp.isInternal && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] dark:bg-[#78350F]/20 text-[10px] text-[#92400E] dark:text-[#FBBF24]">
                            Interno
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
                        {resp.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178] text-center py-4">
                  Nenhuma ação registrada ainda.
                </p>
              )}
            </div>
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

        {/* Botões de Ação */}
        <div className="flex gap-3 mt-4">
          <Button
            className="flex-1"
            onClick={handleSave}
            loading={saving}
            leftIcon={<Save />}
          >
            Salvar Alterações
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!gestao.feedbackAoRelator.trim()) {
                toast({ title: 'Escreva o feedback antes de enviar.', variant: 'destructive' });
                return;
              }
              setSaving(true);
              try {
                await updateGestaoInterna(incidenteId, {
                  ...gestao,
                  ultimaAtualizacao: new Date().toISOString(),
                }, userInfo);
                toast({ title: 'Feedback enviado com sucesso!', variant: 'success' });
                // Notify the reporter if identified with userId
                const tipoId = incidente.notificante?.tipoIdentificacao;
                if (tipoId === 'identificado' && incidente.userId) {
                  sendMessage({
                    recipientId: incidente.userId,
                    subject: 'Feedback recebido sobre seu relato',
                    content: `O comitê enviou um feedback sobre seu relato ${incidente.protocolo}. Acesse o sistema para visualizar.`,
                    priority: 'normal',
                  });
                  createSystemNotification({
                    category: 'incidente',
                    subject: `Feedback sobre seu relato ${incidente.protocolo}`,
                    content: `O comitê enviou um feedback sobre seu relato. Acesse o sistema para visualizar.`,
                    senderName: 'Comitê de Ética',
                    priority: 'normal',
                    actionUrl: 'incidenteDetalhe',
                    actionLabel: 'Ver Feedback',
                    actionParams: { id: incidenteId },
                    recipientId: incidente.userId,
                  });
                }
              } catch (err) {
                console.error('[IncidenteGestao] Erro ao enviar feedback:', err);
                toast({ title: 'Erro ao enviar feedback. Tente novamente.', variant: 'destructive' });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            leftIcon={<Send />}
          >
            Enviar Feedback
          </Button>
        </div>
      </div>
    </div>
  );
}
