import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  User,
  Clock,
  Shield,
  Users,
  Plus,
  Save,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Send,
  Lock,
  EyeOff,
  Eye,
  Search,
  Link2,
  Timer,
  Calendar,
} from 'lucide-react';
import {
  STATUS_CONFIG,
  DENUNCIA_TYPES,
  IDENTIFICATION_TYPES,
  PRIORIDADES_INTERNAS,
  CLASSIFICACOES_INTERNAS,
  MEMBROS_COMITE,
} from '@/data/incidentesConfig';
import { createRcaTemplate, getRiskLevel, getNextDeadline, RISK_DEADLINES_LEGEND } from '@/data/rcaConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useMessages } from '@/contexts/MessagesContext';
import { notifyDeadlineReminder } from '@/services/notificationService';
import { Button, Select, DatePicker, Textarea, Timeline, useToast } from '@/design-system';
import ExpandableSection from './components/ExpandableSection';
import RcaSection from './components/RcaSection';
import RopVinculacao from './components/RopVinculacao';

// Info row component
function InfoRow({ label, value, highlight = false, sensitive = false }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-xs text-muted-foreground sm:w-40 flex-shrink-0">
        {label}:
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${highlight ? 'font-medium text-primary' : sensitive ? 'text-[#92400E] dark:text-warning' : 'text-foreground'}`}>
          {value}
        </span>
        {sensitive && (
          <Lock className="w-3 h-3 text-warning" />
        )}
      </div>
    </div>
  );
}


export default function DenunciaGestaoPage({ onNavigate, goBack, params, denunciaId: propDenunciaId }) {
  const { denuncias, getDenunciaById, updateGestaoInterna, updateStatus } = useIncidents();
  const { incidentResponsibles } = useUsersManagement();

  // Find denuncia by ID
  const denunciaId = propDenunciaId || params?.id || 'den-001';
  const denuncia = getDenunciaById(denunciaId) || denuncias[0];
  const returnTo = params?.returnTo;

  // Internal management state - load from gestaoInterna (where updateGestaoInterna saves)
  const gi = denuncia?.gestaoInterna || {};
  const [gestao, setGestao] = useState({
    responsavelAnalise: gi.responsavelAnalise || '',
    prioridadeInterna: gi.prioridadeInterna || 'alta',
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
    const gi = denuncia?.gestaoInterna || {};
    const historico = gi.historicoStatus || denuncia?.admin?.historicoStatus || [];
    const currentStatus = historico.length > 0 ? historico[0].status : denuncia?.status;
    return getNextDeadline(gestao.rca, historico, currentStatus, denuncia?.createdAt);
  }, [gestao.rca, denuncia]);

  // Send deadline reminder on mount when deadline is ≤1 day away
  useEffect(() => {
    if (!deadlineInfo || !denuncia) return;
    const { nextDeadline, nextStatus, riskLevel } = deadlineInfo;
    const now = new Date();
    const msLeft = nextDeadline.getTime() - now.getTime();
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);

    if (daysLeft > 1) return;

    const storageKey = `deadline_notified_${denunciaId}_${nextStatus}`;
    if (localStorage.getItem(storageKey)) return;

    const nextStatusLabel = STATUS_CONFIG[nextStatus]?.label || nextStatus;
    const deadlineFormatted = nextDeadline.toLocaleDateString('pt-BR');
    const protocolo = denuncia.protocolo || denuncia.trackingCode || denunciaId;

    notifyDeadlineReminder(createSystemNotification, {
      protocolo,
      nextStatusLabel,
      deadline: deadlineFormatted,
      riskLevel: riskLevel.label,
      tipo: 'denuncia',
      recipientId: gestao.responsavelAnalise || undefined,
    });

    if (gestao.responsavelAnalise) {
      sendMessage({
        recipientId: gestao.responsavelAnalise,
        subject: `Prazo amanhã: ${protocolo}`,
        content: `A denúncia ${protocolo} tem prazo para "${nextStatusLabel}" em ${deadlineFormatted}. Nível de risco: ${riskLevel.label}. Acesse a gestão do caso para tomar as ações necessárias.`,
        priority: 'urgente',
      });
    }

    localStorage.setItem(storageKey, 'true');
  }, [deadlineInfo, denunciaId]);

  const statusConfig = STATUS_CONFIG[denuncia.status] || STATUS_CONFIG.pending;
  const tipoConfig = DENUNCIA_TYPES.find(t => t.value === denuncia.denuncia?.tipo) || {};
  const identificacaoConfig = IDENTIFICATION_TYPES[denuncia.denunciante?.tipoIdentificacao] || {};

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGestaoInterna(denunciaId, {
        ...gestao,
        ultimaAtualizacao: new Date().toISOString(),
      });
      toast({ title: 'Alterações salvas com sucesso!', variant: 'success' });
    } catch (err) {
      console.error('[DenunciaGestao] Erro ao salvar:', err);
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
      await updateGestaoInterna(denunciaId, {
        ...gestao,
        acoes: updatedAcoes,
        ultimaAtualizacao: new Date().toISOString(),
      });
      setGestao(prev => ({ ...prev, acoes: updatedAcoes }));
      setNovaAcao('');
      setShowAddAcao(false);
    } catch (err) {
      console.error('[DenunciaGestao] Erro ao adicionar ação:', err);
    }
  };

  // Determina se dados do denunciante são visíveis baseado no tipo de identificação
  const isDadosDenuncianteVisiveis = denuncia.denunciante?.tipoIdentificacao === 'identificado';
  const isDadosConfidenciais = denuncia.denunciante?.tipoIdentificacao === 'confidencial';

  const handleBack = () => {
    if (returnTo === 'painel-etica') {
      onNavigate('permissions', { initialSection: 'incidentes' });
    } else if (goBack) {
      goBack();
    } else {
      onNavigate('denunciaDetalhe', { id: denuncia.id });
    }
  };

  // Header via createPortal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Gestão da Denúncia
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Header Card - Status e Info Principal */}
        <div className="bg-white dark:bg-muted rounded-2xl p-4 border border-[#E5E7EB] dark:border-border mb-4">
          {/* Linha 1: Titulo + Status */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-bold text-foreground leading-snug">
              {denuncia.denuncia?.titulo || 'Denúncia'}
            </h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: `${statusConfig.color}15`, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
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
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: `${identificacaoConfig.color}15`, color: identificacaoConfig.color }}
            >
              {denuncia.denunciante?.tipoIdentificacao === 'anonimo' && <EyeOff className="w-3 h-3" />}
              {denuncia.denunciante?.tipoIdentificacao === 'confidencial' && <Lock className="w-3 h-3" />}
              {denuncia.denunciante?.tipoIdentificacao === 'identificado' && <Eye className="w-3 h-3" />}
              {identificacaoConfig.label}
            </span>
          </div>
        </div>

        {/* Banner - Área Restrita */}
        <div className="mb-4 p-3 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-warning/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-warning" />
            <p className="text-xs font-medium text-[#92400E] dark:text-warning">
              Área Restrita - Comitê de Ética
            </p>
          </div>
          <p className="text-xs text-[#A16207] dark:text-warning mt-1">
            As informações abaixo são de uso exclusivo do Comitê de Ética. Respeite a confidencialidade do denunciante.
          </p>
        </div>

        {/* Card de Prazo Limite */}
        <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-muted border border-[#E5E7EB] dark:border-border">
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
                  <h3 className="text-sm font-semibold text-foreground">Prazo Limite</h3>
                  <span
                    className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${urgencyColor}20`, color: urgencyColor }}
                  >
                    {urgencyLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Próxima etapa</span>
                    <span className="text-sm font-medium text-foreground">{nextStatusLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prazo da próxima etapa</span>
                    <span className="text-sm font-medium" style={{ color: urgencyColor }}>
                      {deadlineInfo.nextDeadline.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Prazo final (encerramento)</span>
                    <span className="text-sm font-medium text-foreground">
                      {deadlineInfo.finalDeadline.toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Nível de risco</span>
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
                <Timer className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Prazo Limite</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] dark:bg-muted text-muted-foreground">
                  Pendente
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Preencha a classificação de risco na Análise de Causa Raiz (RCA) para calcular os prazos automaticamente.
              </p>
            </>
          )}
        </div>

        {/* Legenda de Prazos por Nível de Risco */}
        <div className="mb-4 rounded-2xl bg-white dark:bg-muted border border-[#E5E7EB] dark:border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F9FAFB] dark:bg-[#0D1F17] border-b border-[#E5E7EB] dark:border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                <span className="text-xs font-medium text-foreground">
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
          <ExpandableSection
            title="Dados do Denunciante"
            icon={User}
            defaultOpen={isDadosDenuncianteVisiveis}
            warning={isDadosConfidenciais}
          >
            {denuncia.denunciante?.tipoIdentificacao === 'anonimo' ? (
              <div className="flex items-center gap-2 py-2">
                <EyeOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Denúncia anônima - Dados não disponíveis
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {isDadosConfidenciais && (
                  <div className="mb-3 p-2 rounded-lg bg-[#FEF3C7] dark:bg-[#78350F]/20">
                    <p className="text-xs text-[#92400E] dark:text-warning">
                      <strong>Dados Confidenciais:</strong> Acesso restrito apenas ao gestor externo.
                    </p>
                  </div>
                )}
                <InfoRow label="Nome" value={denuncia.denunciante?.nome || 'Não informado'} sensitive={isDadosConfidenciais} />
                <InfoRow label="Email" value={denuncia.denunciante?.email || 'Não informado'} sensitive={isDadosConfidenciais} />
                <InfoRow label="Gênero" value={denuncia.denunciante?.genero || 'Não informado'} />
              </div>
            )}
          </ExpandableSection>

          <ExpandableSection title="Detalhes da Denúncia" icon={ShieldAlert} defaultOpen>
            <div className="space-y-3">
              <InfoRow label="Tipo" value={tipoConfig.label} highlight />
              <InfoRow label="Título" value={denuncia.denuncia?.titulo} />
              <InfoRow label="Data do Ocorrido" value={formatDate(denuncia.denuncia?.dataOcorrencia)} />
              <div className="mt-3 p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#0D1F17]">
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm text-foreground">
                  {denuncia.denuncia?.descricao}
                </p>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection title="Pessoas Envolvidas" icon={Users}>
            <div className="space-y-3">
              <InfoRow label="Envolvidos" value={denuncia.denuncia?.pessoasEnvolvidas || 'Não informado'} />
              <InfoRow label="Cargo/Função" value={denuncia.denuncia?.denunciadoCargo || 'Não informado'} />
              <InfoRow label="Setor" value={denuncia.denuncia?.denunciadoSetor || 'Não informado'} />
              <InfoRow label="Local de Trabalho" value={denuncia.denuncia?.denunciadoLocal || 'Não informado'} />
              <InfoRow label="Testemunhas" value={denuncia.denuncia?.testemunhas || 'Não informado'} />
            </div>
          </ExpandableSection>

          <ExpandableSection title="Impacto e Consequências" icon={AlertCircle}>
            <div className="space-y-3">
              <InfoRow label="Impacto Observado" value={denuncia.denuncia?.impacto || 'Não informado'} />
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
                label="Recomendações"
                value={gestao.recomendacoes}
                onChange={(v) => updateGestao('recomendacoes', v)}
                placeholder="Recomendações e medidas a serem tomadas..."
                rows={3}
              />

              <Textarea
                label="Feedback ao Relator (visível ao relator)"
                value={gestao.feedbackAoRelator}
                onChange={(v) => updateGestao('feedbackAoRelator', v)}
                placeholder="Mensagem que será enviada ao denunciante (respeitando anonimato)..."
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
              incidenteTipo={denuncia.denuncia?.tipo}
              onChange={handleRopsChange}
              isDenuncia
            />
          </ExpandableSection>

          <ExpandableSection title="Histórico de Status" icon={Clock}>
            {(() => {
              const STATUS_FLOW = ['pending', 'in_review', 'investigating', 'action_required', 'resolved', 'closed'];
              const gi = denuncia.gestaoInterna || {};
              const historico = gi.historicoStatus || denuncia.admin?.historicoStatus || [];

              const pastItems = historico.length > 0
                ? historico.map((item, index) => ({
                    id: `status-${index}`,
                    title: STATUS_CONFIG[item.status]?.label || item.status,
                    description: `por ${item.usuario || item.user || 'Sistema'}${item.observacao ? ` — ${item.observacao}` : ''}`,
                    timestamp: new Date(item.data || item.date).toLocaleString('pt-BR'),
                    status: index === 0 ? 'active' : 'completed',
                  }))
                : [{
                    id: 'status-initial',
                    title: statusConfig.label,
                    timestamp: new Date(denuncia.createdAt).toLocaleString('pt-BR'),
                    status: 'active',
                  }];

              const currentStatus = historico.length > 0 ? historico[0].status : denuncia.status;
              const currentIdx = STATUS_FLOW.indexOf(currentStatus);
              const lastDate = historico.length > 0
                ? new Date(historico[0].data || historico[0].date)
                : new Date(denuncia.createdAt);

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

              return <Timeline items={[...pastItems, ...futureSteps]} size="sm" />;
            })()}
          </ExpandableSection>

          <ExpandableSection title="Ações Realizadas" icon={CheckCircle2}>
            <div>
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={() => setShowAddAcao(!showAddAcao)}
                  className="flex items-center gap-1 text-xs font-medium text-primary"
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
                      className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAcao}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white dark:text-primary-foreground text-xs font-medium"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma ação registrada ainda.
              </p>
            </div>
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
                await updateGestaoInterna(denunciaId, {
                  ...gestao,
                  ultimaAtualizacao: new Date().toISOString(),
                });
                toast({ title: 'Feedback enviado com sucesso!', variant: 'success' });
                // Notify reporter if identified
                const tipoId = denuncia.denunciante?.tipoIdentificacao;
                if (tipoId === 'identificado' && denuncia.userId) {
                  sendMessage({
                    recipientId: denuncia.userId,
                    subject: 'Feedback recebido sobre sua denúncia',
                    content: `O comitê enviou um feedback sobre sua denúncia ${denuncia.protocolo || denuncia.trackingCode}. Acesse o sistema para visualizar.`,
                    priority: 'normal',
                  });
                  createSystemNotification({
                    category: 'incidente',
                    subject: `Feedback sobre sua denúncia`,
                    content: `O comitê enviou um feedback sobre sua denúncia. Acesse o sistema para visualizar.`,
                    senderName: 'Comitê de Ética',
                    priority: 'normal',
                    actionUrl: 'denunciaDetalhe',
                    actionLabel: 'Ver Feedback',
                    actionParams: { id: denunciaId },
                    recipientId: denuncia.userId,
                  });
                }
              } catch (err) {
                console.error('[DenunciaGestao] Erro ao enviar feedback:', err);
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
