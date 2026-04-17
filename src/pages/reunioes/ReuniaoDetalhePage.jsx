import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
  Badge,
  Timeline,
  Button,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Textarea,
  useToast,
  cn,
} from '@/design-system';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  AlertCircle,
  MoreVertical,
  Download,
  Eye,
  Upload,
  CheckCircle,
  UserCheck,
  Edit3,
  CheckSquare,
  Square,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import reunioesService, { STATUS_CONFIG } from '@/services/reunioesService';
import UploadAtaModal from '@/components/reunioes/UploadAtaModal';
import UploadSubsidioModal from '@/components/reunioes/UploadSubsidioModal';
import CheckinCodeDisplay from '@/components/reunioes/CheckinCodeDisplay';
import CheckinCodeInput from '@/components/reunioes/CheckinCodeInput';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import ViewPdfModal from '@/components/etica/ViewPdfModal';

// Tipos de reunião (importado de ReunioesPage.jsx)
const TIPOS_REUNIAO = [
  { id: 'comite_qualidade', title: 'Comitê de Qualidade', color: '#059669' },
  { id: 'reuniao_equipe', title: 'Reunião de Equipe', color: '#2563eb' },
  { id: 'morbimortalidade', title: 'Morbimortalidade', color: '#dc2626' },
  { id: 'sessao_cientifica', title: 'Sessão Científica', color: '#7c3aed' },
  { id: 'planejamento', title: 'Planejamento', color: '#f59e0b' },
  { id: 'auditoria_interna', title: 'Auditoria Interna', color: '#64748b' },
];

const PERFIS_CONVOCADOS = [
  { key: 'anestesiologista', label: 'Anestesiologista', color: '#2563eb' },
  { key: 'medico-residente', label: 'Médico Residente', color: '#8b5cf6' },
  { key: 'enfermeiro', label: 'Enfermeiro', color: '#10b981' },
  { key: 'tec-enfermagem', label: 'Téc. Enfermagem', color: '#06b6d4' },
  { key: 'farmaceutico', label: 'Farmacêutico', color: '#ec4899' },
  { key: 'colaborador', label: 'Colaborador', color: '#6366f1' },
  { key: 'secretaria', label: 'Secretária', color: '#f59e0b' },
];

export default function ReuniaoDetalhePage({ onNavigate, reuniaoId, user }) {
  const { toast } = useToast();
  const { users: allUsers } = useUsersManagement();
  const [reuniao, setReuniao] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPDF, setShowPDF] = useState(false);
  const [currentPDF, setCurrentPDF] = useState(null);
  const [showUploadAtaModal, setShowUploadAtaModal] = useState(false);
  const [showUploadSubsidioModal, setShowUploadSubsidioModal] = useState(false);
  const [statusHistorico, setStatusHistorico] = useState([]);
  const [editingPresenca, setEditingPresenca] = useState(false);
  const [presentes, setPresentes] = useState([]);
  const [savingPresenca, setSavingPresenca] = useState(false);
  const [activatingCheckin, setActivatingCheckin] = useState(false);
  const [justificativaFalta, setJustificativaFalta] = useState('');
  const [mostrandoFormFalta, setMostrandoFormFalta] = useState(false);

  // Carregar dados da reunião
  useEffect(() => {
    loadReuniao();
    loadDocumentos();
    loadStatusHistorico();
  }, [reuniaoId]);

  const loadReuniao = async () => {
    try {
      setLoading(true);
      const data = await reunioesService.getReuniaoById(reuniaoId);
      setReuniao(data);
    } catch (error) {
      console.error('Erro ao carregar reunião:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentos = async () => {
    try {
      const docs = await reunioesService.getDocumentos(reuniaoId);
      setDocumentos(docs);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  const loadStatusHistorico = async () => {
    try {
      const historico = await reunioesService.getStatusHistorico(reuniaoId);
      setStatusHistorico(historico);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  // Real-time subscription for check-in updates
  useEffect(() => {
    if (!reuniaoId) return;
    const unsubscribe = reunioesService.subscribeToReuniao(reuniaoId, (data) => {
      setReuniao(data);
    });
    return () => unsubscribe();
  }, [reuniaoId]);

  // Check-in derived values
  const isOrganizer = useMemo(() => {
    if (!reuniao || !user) return false;
    return reuniao.createdBy === (user.uid || user.id);
  }, [reuniao, user]);

  const isParticipant = useMemo(() => {
    if (!reuniao || !user) return false;
    return reuniao.participantesIds?.includes(user.uid || user.id);
  }, [reuniao, user]);

  const hasCheckedIn = useMemo(() => {
    if (!reuniao || !user) return false;
    return !!reuniao.checkins?.[user.uid || user.id];
  }, [reuniao, user]);

  const checkinCount = useMemo(() => {
    return Object.keys(reuniao?.checkins || {}).length;
  }, [reuniao]);

  const callerInfo = useMemo(() => ({
    uid: user?.uid || user?.id,
    displayName: user?.nome || user?.displayName || user?.email,
    email: user?.email,
    role: user?.role,
    isAdmin: user?.isAdmin,
    isCoordenador: user?.isCoordenador,
  }), [user]);

  const handleActivateCheckin = useCallback(async () => {
    try {
      setActivatingCheckin(true);
      await reunioesService.activateCheckin(reuniaoId, callerInfo);
    } catch (error) {
      toast({ title: 'Erro ao ativar check-in', description: error.message, variant: 'destructive' });
    } finally {
      setActivatingCheckin(false);
    }
  }, [reuniaoId, toast, callerInfo]);

  const handleDeactivateCheckin = useCallback(async () => {
    try {
      await reunioesService.deactivateCheckin(reuniaoId, callerInfo);
      toast({ variant: 'success', title: 'Check-in encerrado e presenca sincronizada' });
    } catch (error) {
      toast({ title: 'Erro ao encerrar check-in', description: error.message, variant: 'destructive' });
    }
  }, [reuniaoId, toast, callerInfo]);

  // Config do tipo de reunião
  const tipoConfig = useMemo(() => {
    if (!reuniao) return null;
    return TIPOS_REUNIAO.find(t => t.id === reuniao.tipoReuniao) || TIPOS_REUNIAO[0];
  }, [reuniao]);

  // Config do status atual
  const statusConfig = useMemo(() => {
    if (!reuniao) return null;
    return STATUS_CONFIG[reuniao.status] || STATUS_CONFIG.agendada;
  }, [reuniao]);

  // Check if subsídio upload is allowed (up to 1h before meeting)
  const canUploadSubsidio = useMemo(() => {
    if (!reuniao || reuniao.status === 'cancelada' || reuniao.status === 'concluida') return false;
    const meetingDate = reuniao.dataReuniao instanceof Date ? new Date(reuniao.dataReuniao) : new Date(reuniao.dataReuniao);
    if (reuniao.horario) {
      const [hours, minutes] = reuniao.horario.split(':').map(Number);
      meetingDate.setHours(hours, minutes, 0, 0);
    }
    const oneHourBefore = new Date(meetingDate.getTime() - 60 * 60 * 1000);
    return new Date() < oneHourBefore;
  }, [reuniao]);

  // Check if ata upload is allowed (after meeting date)
  const canUploadAta = useMemo(() => {
    if (!reuniao || reuniao.status === 'cancelada') return false;
    const meetingDate = reuniao.dataReuniao instanceof Date ? new Date(reuniao.dataReuniao) : new Date(reuniao.dataReuniao);
    return new Date() >= meetingDate;
  }, [reuniao]);

  // Init presentes from saved data (empty by default — users must explicitly confirm)
  useEffect(() => {
    setPresentes(Array.isArray(reuniao?.presentes) ? reuniao.presentes : []);
  }, [reuniao]);

  // Admin / coordenador pode gerenciar presença de todos; participante registra só a si mesmo
  const canManageAll = useMemo(() => {
    if (!user) return false;
    const roleKey = (user?.role || '').toLowerCase();
    return !!(
      reuniao?.createdBy === (user.uid || user.id) ||
      user?.isAdmin ||
      user?.isCoordenador ||
      roleKey === 'administrador' ||
      roleKey === 'coordenador'
    );
  }, [reuniao, user]);

  // Self-presença do participante: presente / ausente / nao-registrado
  // "ausente" só quando há justificativa própria — se o uid foi parar em faltantes
  // por outro fluxo (bulk save do admin ou deactivateCheckin), tratamos como "nao-registrado"
  // para permitir o participante escolher seu próprio status.
  const selfPresencaStatus = useMemo(() => {
    const uid = user?.uid || user?.id;
    if (!uid) return 'nao-registrado';
    if (reuniao?.presentes?.includes(uid)) return 'presente';
    if (reuniao?.faltantes?.includes(uid) && reuniao?.justificativasFaltas?.[uid]) {
      return 'ausente';
    }
    return 'nao-registrado';
  }, [reuniao, user]);

  const handleSelfPresenca = useCallback(async (present, justificativa = '') => {
    try {
      setSavingPresenca(true);
      await reunioesService.registerSelfPresenca(
        reuniaoId,
        user?.uid || user?.id,
        present,
        justificativa
      );
      setMostrandoFormFalta(false);
      if (present) setJustificativaFalta('');
      toast({
        variant: 'success',
        title: present ? 'Presença confirmada!' : 'Ausência registrada',
      });
      await loadReuniao();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao registrar', description: error.message });
    } finally {
      setSavingPresenca(false);
    }
  }, [reuniaoId, user, toast]);

  // Hidrata a justificativa quando o próprio usuário está marcado como ausente
  useEffect(() => {
    const uid = user?.uid || user?.id;
    if (!uid) return;
    if (reuniao?.justificativasFaltas?.[uid]) {
      setJustificativaFalta(reuniao.justificativasFaltas[uid]);
    } else if (!reuniao?.faltantes?.includes(uid)) {
      setJustificativaFalta('');
    }
  }, [reuniao, user]);

  // Get participant data from allUsers
  const participantesData = useMemo(() => {
    if (!reuniao?.participantesIds?.length) return [];
    return reuniao.participantesIds.map(id => {
      const user = allUsers.find(u => u.id === id);
      return { id, nome: user?.nome || user?.email || id, role: user?.role };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [reuniao, allUsers]);

  // Helper: resolve IDs → { id, nome } ordenados por nome (pt-BR)
  const sortIdsByNome = useCallback((ids) => {
    if (!ids?.length) return [];
    return ids
      .map(id => {
        const p = participantesData.find(u => u.id === id);
        return p || { id, nome: id };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [participantesData]);

  const presentesOrdenados = useMemo(() => sortIdsByNome(reuniao?.presentes), [reuniao, sortIdsByNome]);
  const faltantesOrdenados = useMemo(() => sortIdsByNome(reuniao?.faltantes), [reuniao, sortIdsByNome]);
  const checkinsOrdenados = useMemo(
    () => sortIdsByNome(Object.keys(reuniao?.checkins || {})),
    [reuniao, sortIdsByNome]
  );

  // Can edit attendance after meeting date or when in progress/completed
  const canEditPresenca = useMemo(() => {
    if (!reuniao?.participantesIds?.length) return false;
    if (reuniao.status === 'cancelada') return false;
    if (reuniao.status === 'em_andamento' || reuniao.status === 'concluida') return true;
    const meetingDate = reuniao.dataReuniao instanceof Date ? new Date(reuniao.dataReuniao) : new Date(reuniao.dataReuniao);
    return new Date() >= meetingDate;
  }, [reuniao]);

  // Ações disponíveis baseadas no status atual
  const availableActions = useMemo(() => {
    if (!reuniao || !statusConfig) return [];

    const actions = [];

    // Transições de status permitidas
    statusConfig.nextStates.forEach(nextStatus => {
      const nextConfig = STATUS_CONFIG[nextStatus];
      if (nextConfig) {
        actions.push({
          label: `Alterar para ${nextConfig.label}`,
          action: () => handleStatusChange(nextStatus),
          icon: CheckCircle,
        });
      }
    });

    // Ação: Adicionar ata (disponível após a data da reunião, exceto cancelada)
    if (canUploadAta) {
      actions.push({
        label: 'Adicionar Ata',
        action: () => setShowUploadAtaModal(true),
        icon: Upload,
        primary: true,
      });
    }

    // Ação: Adicionar subsídio (disponível até 1h antes)
    if (canUploadSubsidio) {
      actions.push({
        label: 'Adicionar Subsídio',
        action: () => setShowUploadSubsidioModal(true),
        icon: Upload,
      });
    }

    // Ação: Iniciar Check-in (só organizador/admin, reunião em_andamento, ainda não ativo)
    if (canManageAll && reuniao.status === 'em_andamento' && !reuniao.checkinAtivo) {
      actions.push({
        label: activatingCheckin ? 'Ativando check-in...' : 'Iniciar Check-in',
        action: handleActivateCheckin,
        icon: ShieldCheck,
      });
    }

    // Ação: Encerrar Check-in (só organizador/admin, check-in ativo)
    if (canManageAll && reuniao.checkinAtivo) {
      actions.push({
        label: 'Encerrar Check-in',
        action: handleDeactivateCheckin,
        icon: XCircle,
      });
    }

    return actions;
  }, [reuniao, statusConfig, canUploadAta, canUploadSubsidio, canManageAll, activatingCheckin, handleActivateCheckin, handleDeactivateCheckin]);

  // Handler para mudança de status
  const handleStatusChange = async (newStatus) => {
    try {
      await reunioesService.updateStatus(reuniaoId, newStatus, {}, 'Status alterado via interface');
      await loadReuniao();
      await loadStatusHistorico();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({ title: 'Erro ao alterar status', description: error.message, variant: 'destructive' });
    }
  };

  // Handler para abrir PDF
  const handleOpenPDF = (doc) => {
    setCurrentPDF({
      url: doc.arquivoUrl,
      title: doc.titulo,
    });
    setShowPDF(true);
  };

  // Handler para salvar presença (gerencial — organizador/admin)
  const handleSavePresenca = async () => {
    try {
      setSavingPresenca(true);
      const faltantesIds = participantesData.filter(p => !presentes.includes(p.id)).map(p => p.id);

      // Preserva apenas as justificativas de quem AINDA está em faltantes
      const previas = reuniao?.justificativasFaltas || {};
      const justificativasFaltas = {};
      for (const id of faltantesIds) {
        if (previas[id]) justificativasFaltas[id] = previas[id];
      }

      await reunioesService.updateReuniao(reuniaoId, {
        presentes,
        faltantes: faltantesIds,
        justificativasFaltas,
      });
      setEditingPresenca(false);
      toast({ variant: 'success', title: 'Presença registrada!' });
      await loadReuniao();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSavingPresenca(false);
    }
  };

  // Formatação de data (handles Date, Firestore Timestamp, or string)
  const formatDate = (date) => {
    if (!date) return '';
    try {
      const d = date?.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch { return ''; }
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    try {
      const d = date?.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch { return ''; }
  };

  // Agrupar documentos por tipo
  const documentosPorTipo = useMemo(() => {
    const grupos = {
      subsidio: [],
      pauta: [],
      ata: [],
      outros: [],
    };

    documentos.forEach(doc => {
      const tipo = doc.tipoDocumento || 'outros';
      if (grupos[tipo]) {
        grupos[tipo].push(doc);
      } else {
        grupos.outros.push(doc);
      }
    });

    return grupos;
  }, [documentos]);

  // Preparar itens da timeline
  const timelineItems = useMemo(() => {
    return statusHistorico.map((item, index) => {
      const config = STATUS_CONFIG[item.newStatus] || STATUS_CONFIG.agendada;

      return {
        id: item.id,
        title: `${config.label}${item.comment ? ` - ${item.comment}` : ''}`,
        description: `Por ${item.userName}`,
        timestamp: formatDateTime(item.timestamp),
        status: index === 0 ? 'active' : 'completed',
      };
    });
  }, [statusHistorico]);

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('reunioes')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Detalhes da Reunião
          </h1>
          <div className="min-w-[70px] flex justify-end">
            {availableActions.length > 0 && (
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    className="p-2 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-primary" />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" minWidth={280}>
                  {availableActions.map((action, index) => (
                    <DropdownItem
                      key={index}
                      onClick={action.action}
                      icon={action.icon ? <action.icon className="w-4 h-4" /> : undefined}
                      className={action.primary ? 'font-semibold text-primary' : ''}
                    >
                      {action.label}
                    </DropdownItem>
                  ))}
                </DropdownContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!reuniao) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Reunião não encontrada
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('reunioes')}
              className="text-primary font-medium"
            >
              Voltar para a lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Banner de reunião concluída */}
        {(reuniao.status === 'concluida' || reuniao.status === 'cancelada') && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border-strong">
            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-primary">
              {reuniao.status === 'concluida'
                ? 'Reunião concluída — somente leitura. Você pode adicionar ata pelo menu ⋮'
                : 'Reunião cancelada — somente leitura.'}
            </p>
          </div>
        )}

        {/* Header Card com Título, Status e Informações Principais */}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          {/* Linha 1: Título + Badge Status */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-foreground leading-snug flex-1">
              {reuniao.titulo}
            </h2>
            <Badge
              variant={statusConfig.variant}
              className="flex items-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: `${statusConfig.color}15`, color: statusConfig.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig.color }} />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Linha 2: Tipo de Reunião */}
          {tipoConfig && (
            <div className="mb-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${tipoConfig.color}15`, color: tipoConfig.color }}
              >
                {tipoConfig.title}
              </span>
            </div>
          )}

          {/* Grid de Informações */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-medium text-foreground">
                  {formatDate(reuniao.dataReuniao)}
                </p>
              </div>
            </div>

            {reuniao.horario && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="font-medium text-foreground">
                    {reuniao.horario}
                  </p>
                </div>
              </div>
            )}

            {reuniao.local && (
              <div className="flex items-start gap-2 col-span-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="font-medium text-foreground">
                    {reuniao.local}
                  </p>
                </div>
              </div>
            )}

            {(reuniao.destinatariosTipos?.length > 0 || reuniao.participantesIds?.length > 0) && (
              <div className="flex items-start gap-2 col-span-2">
                <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Convocados</p>
                  {reuniao.destinatariosTipos?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {reuniao.destinatariosTipos.map(key => {
                        const perfil = PERFIS_CONVOCADOS.find(p => p.key === key);
                        if (!perfil) return null;
                        return (
                          <span
                            key={key}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: perfil.color }}
                          >
                            {perfil.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-sm font-medium text-foreground mt-1">
                    {reuniao.participantesIds?.length || 0} profissionais
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seção: Contexto/Pauta */}
        {(reuniao.contexto || reuniao.pauta) && (
          <SectionCard
            title="Contexto/Pauta"
            icon={FileText}
          >
            <div className="space-y-3">
              {reuniao.contexto && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {reuniao.contexto}
                  </p>
                </div>
              )}
              {reuniao.pauta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pauta</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {reuniao.pauta}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Seção: Check-in de Presença — só renderiza quando admin ativou */}
        {reuniao.checkinAtivo && participantesData.length > 0 && (
          <SectionCard
            title="Check-in de Presença"
            subtitle={`${checkinCount} de ${participantesData.length} confirmados`}
            icon={ShieldCheck}
          >
            {/* Organizador: mostra o código + lista live */}
            {isOrganizer && (
              <>
                <CheckinCodeDisplay
                  seed={reuniao.checkinSeed}
                  onDeactivate={handleDeactivateCheckin}
                />
                {checkinCount > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Check-ins realizados ({checkinCount})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {checkinsOrdenados.map(p => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          {p.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Participante: input do código ou confirmação */}
            {!isOrganizer && isParticipant && (
              hasCheckedIn ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Presenca confirmada!
                  </p>
                </div>
              ) : (
                <CheckinCodeInput
                  reuniaoId={reuniaoId}
                  userId={user?.uid || user?.id}
                  onSuccess={() => {}}
                />
              )
            )}

            {/* Observador não-convocado */}
            {!isOrganizer && !isParticipant && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Check-in ativo. Voce nao esta na lista de participantes.
              </p>
            )}
          </SectionCard>
        )}

        {/* Seção: Presença (Manual) — participante registra só a si mesmo; organizador/admin gerencia todos */}
        {canEditPresenca && participantesData.length > 0 && (canManageAll || isParticipant) && (
          <SectionCard
            title={canManageAll ? 'Presença (Manual)' : 'Minha Presença'}
            subtitle={canManageAll
              ? `${reuniao.presentes?.length || 0} presentes, ${reuniao.faltantes?.length || 0} faltantes`
              : 'Confirme sua própria participação nesta reunião'
            }
          >
            {/* ─── Modo participante: self-service ─── */}
            {!canManageAll && isParticipant && (() => {
              const justificativaValida = justificativaFalta.trim().length >= 3;
              const readOnly = reuniao.status === 'concluida';

              // Formulário de justificativa (exibido ao clicar "Não participei" ou "Editar justificativa")
              if (mostrandoFormFalta) {
                return (
                  <div className="space-y-3">
                    <Textarea
                      label="Justificativa da ausência *"
                      placeholder="Descreva o motivo da sua ausência (mínimo 3 caracteres)"
                      value={justificativaFalta}
                      onChange={setJustificativaFalta}
                      rows={3}
                      maxLength={500}
                      showCount
                      disabled={savingPresenca}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMostrandoFormFalta(false);
                          const uid = user?.uid || user?.id;
                          setJustificativaFalta(reuniao?.justificativasFaltas?.[uid] || '');
                        }}
                        disabled={savingPresenca}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSelfPresenca(false, justificativaFalta)}
                        disabled={savingPresenca || !justificativaValida}
                        className="flex-1"
                      >
                        {savingPresenca ? 'Salvando...' : 'Registrar ausência'}
                      </Button>
                    </div>
                  </div>
                );
              }

              if (selfPresencaStatus === 'presente') {
                return (
                  <div className="space-y-3">
                    <div className="flex flex-col items-center gap-2 py-4">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Sua presença está confirmada
                      </p>
                    </div>
                    {!readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMostrandoFormFalta(true)}
                        disabled={savingPresenca}
                        className="w-full"
                      >
                        Registrar ausência
                      </Button>
                    )}
                  </div>
                );
              }

              if (selfPresencaStatus === 'ausente') {
                const uid = user?.uid || user?.id;
                const textoSalvo = reuniao?.justificativasFaltas?.[uid] || '';
                return (
                  <div className="space-y-3">
                    <div className="flex flex-col items-center gap-2 py-2">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        Você registrou ausência
                      </p>
                    </div>
                    {textoSalvo && (
                      <div className="rounded-xl bg-muted/60 border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Justificativa:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{textoSalvo}</p>
                      </div>
                    )}
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMostrandoFormFalta(true)}
                          disabled={savingPresenca}
                          className="flex-1"
                        >
                          Editar justificativa
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSelfPresenca(true)}
                          disabled={savingPresenca}
                          className="flex-1"
                        >
                          {savingPresenca ? 'Salvando...' : 'Confirmar presença'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }

              // nao-registrado
              return (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <UserCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Confirme sua participação nesta reunião.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMostrandoFormFalta(true)}
                      disabled={savingPresenca}
                      className="flex-1"
                    >
                      Não participei
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSelfPresenca(true)}
                      disabled={savingPresenca}
                      className="flex-1"
                    >
                      {savingPresenca ? 'Salvando...' : 'Estou presente'}
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* ─── Modo organizador/admin: gerencia lista completa ─── */}
            {canManageAll && !editingPresenca && (
              <div>
                {reuniao.presentes?.length || reuniao.faltantes?.length ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-foreground">
                        Presentes ({reuniao.presentes?.length || 0})
                      </span>
                    </div>
                    {presentesOrdenados.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {presentesOrdenados.map(p => (
                          <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {p.nome}
                          </span>
                        ))}
                      </div>
                    )}
                    {reuniao.faltantes?.length > 0 && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-sm font-medium text-foreground">
                            Faltantes ({reuniao.faltantes.length})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {faltantesOrdenados.map(p => {
                            const justificativa = reuniao.justificativasFaltas?.[p.id];
                            return (
                              <div
                                key={p.id}
                                className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-900/40"
                              >
                                <span className="font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
                                  {p.nome}
                                </span>
                                {justificativa ? (
                                  <span className="text-red-700/80 dark:text-red-400/80 flex-1 whitespace-pre-wrap">
                                    — {justificativa}
                                  </span>
                                ) : (
                                  <span className="italic text-red-700/60 dark:text-red-400/60 flex-1">
                                    — sem justificativa
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditingPresenca(true)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar Presença
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <UserCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Nenhuma presença registrada ainda. Participantes podem confirmar pela própria conta.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setEditingPresenca(true)}>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Registrar Presença
                    </Button>
                  </div>
                )}
              </div>
            )}

            {canManageAll && editingPresenca && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {presentes.length} de {participantesData.length} presentes
                  </p>
                  <button
                    type="button"
                    onClick={() => setPresentes(
                      presentes.length === participantesData.length
                        ? []
                        : participantesData.map(p => p.id)
                    )}
                    className="text-xs text-primary hover:underline"
                  >
                    {presentes.length === participantesData.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                    {participantesData.map(p => {
                      const isPresent = presentes.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPresentes(prev =>
                            prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                          )}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            isPresent ? 'bg-primary/5' : 'hover:bg-muted/50'
                          )}
                        >
                          {isPresent ? (
                            <CheckSquare className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                          ) : (
                            <Square className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={cn(
                            'text-sm truncate',
                            isPresent ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}>
                            {p.nome}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPresenca(false);
                      setPresentes(Array.isArray(reuniao?.presentes) ? reuniao.presentes : []);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePresenca}
                    disabled={savingPresenca}
                    className="flex-1"
                  >
                    {savingPresenca ? 'Salvando...' : 'Salvar Presença'}
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* Seção: Documentos de Subsídio */}
        <SectionCard
          title="Documentos de Subsídio"
          subtitle={
            documentosPorTipo.subsidio.length > 0
              ? `${documentosPorTipo.subsidio.length} documento(s)`
              : canUploadSubsidio
                ? 'Envie documentos de apoio para a reunião'
                : 'Prazo para envio encerrado'
          }
        >
          {documentosPorTipo.subsidio.length > 0 ? (
            <div className="space-y-2">
              {documentosPorTipo.subsidio.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border"
                >
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.titulo}
                    </p>
                    {doc.descricao && (
                      <p className="text-xs text-muted-foreground">
                        {doc.descricao}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPDF(doc)}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4 text-primary" />
                    </button>
                    <a
                      href={doc.arquivoUrl}
                      download
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4 text-primary" />
                    </a>
                  </div>
                </div>
              ))}
              {canUploadSubsidio && (
                <Button
                  onClick={() => setShowUploadSubsidioModal(true)}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Adicionar Subsídio
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              {canUploadSubsidio ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhum subsídio anexado. Adicione documentos de apoio para a reunião.
                  </p>
                  <Button
                    onClick={() => setShowUploadSubsidioModal(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Adicionar Subsídio
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Prazo para envio de subsídios encerrado.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Seção: Ata da Reunião */}
        <SectionCard
          title="Ata da Reunião"
          subtitle={
            documentosPorTipo.ata.length > 0
              ? `${documentosPorTipo.ata.length} ata(s)`
              : 'Nenhuma ata anexada'
          }
        >
          {documentosPorTipo.ata.length > 0 ? (
            <div className="space-y-2">
              {documentosPorTipo.ata.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border-strong"
                >
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado por {doc.uploadedByName} em {formatDateTime(doc.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPDF(doc)}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4 text-primary" />
                    </button>
                    <a
                      href={doc.arquivoUrl}
                      download
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4 text-primary" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              {canUploadAta ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhuma ata foi anexada a esta reunião ainda.
                  </p>
                  <Button
                    onClick={() => setShowUploadAtaModal(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Adicionar Ata
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ata poderá ser adicionada após a data da reunião.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Seção: Timeline de Status */}
        {timelineItems.length > 0 && (
          <SectionCard
            title="Histórico de Status"
            subtitle="Linha do tempo da reunião"
          >
            <Timeline
              items={timelineItems}
              orientation="vertical"
              size="default"
              animated={false}
            />
          </SectionCard>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <ViewPdfModal
        open={showPDF}
        onClose={() => { setShowPDF(false); setCurrentPDF(null); }}
        documento={currentPDF}
        title={currentPDF?.title}
      />

      {/* Upload Ata Modal */}
      <UploadAtaModal
        isOpen={showUploadAtaModal}
        onClose={() => setShowUploadAtaModal(false)}
        reuniaoId={reuniaoId}
        user={user}
        onSuccess={() => {
          setShowUploadAtaModal(false);
          loadReuniao();
          loadDocumentos();
          loadStatusHistorico();
        }}
      />

      {/* Upload Subsídio Modal */}
      <UploadSubsidioModal
        isOpen={showUploadSubsidioModal}
        onClose={() => setShowUploadSubsidioModal(false)}
        reuniaoId={reuniaoId}
        user={user}
        onSuccess={() => {
          setShowUploadSubsidioModal(false);
          loadDocumentos();
        }}
      />
    </div>
  );
}
