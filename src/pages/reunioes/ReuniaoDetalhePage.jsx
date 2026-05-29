import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, useToast, ConfirmDialog, Tabs, TabsList, TabsTrigger, TabsContent, PageSkeleton } from '@/design-system';
import { PageHeader } from '@/components';
import { AlertCircle, MoreVertical, Upload, CheckCircle, ShieldCheck, XCircle } from 'lucide-react';
import reunioesService, { STATUS_CONFIG } from '@/services/reunioesService';
import UploadAtaModal from '@/components/reunioes/UploadAtaModal';
import UploadSubsidioModal from '@/components/reunioes/UploadSubsidioModal';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useMessages } from '@/contexts/MessagesContext';
import ViewPdfModal from '@/components/etica/ViewPdfModal';
import { TIPOS_REUNIAO, TIPO_BADGE_CONFIG } from '@/constants/reunioes';
import { ContextoTab, CheckinTab, PresencaTab, DocumentosTab, HistoricoTab, DeliberacoesTab } from '@/components/reunioes/tabs';
import { formatDate, formatDateTime } from '@/components/reunioes/tabs/utils';
import { cn } from '@/design-system/utils/tokens';
import {
  buildReuniaoStatusPayload,
  buildReuniaoCancelPayload,
  buildReuniaoDocumentoPayload,
  buildDeliberacaoAbertaPayload,
  buildDeliberacaoFechadaPayload,
} from '@/utils/reuniaoNotifications';

export default function ReuniaoDetalhePage({ onNavigate, reuniaoId, user }) {
  const { toast } = useToast();
  const { users: allUsers } = useUsersManagement();
  const { createSystemNotification } = useMessages();
  const [reuniao, setReuniao] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPDF, setShowPDF] = useState(false);
  const [currentPDF, setCurrentPDF] = useState(null);
  const [showUploadAtaModal, setShowUploadAtaModal] = useState(false);
  const [showUploadSubsidioModal, setShowUploadSubsidioModal] = useState(false);
  const [statusHistorico, setStatusHistorico] = useState([]);
  const [activatingCheckin, setActivatingCheckin] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // --- Data loaders ---
  const loadReuniao = useCallback(async () => {
    try { setLoading(true); setReuniao(await reunioesService.getReuniaoById(reuniaoId)); }
    catch (e) { console.error('Erro ao carregar reunião:', e); }
    finally { setLoading(false); }
  }, [reuniaoId]);

  const loadDocumentos = useCallback(async () => {
    try { setDocumentos(await reunioesService.getDocumentos(reuniaoId)); }
    catch (e) { console.error('Erro ao carregar documentos:', e); }
  }, [reuniaoId]);

  const loadStatusHistorico = useCallback(async () => {
    try { setStatusHistorico(await reunioesService.getStatusHistorico(reuniaoId)); }
    catch (e) { console.error('Erro ao carregar histórico:', e); }
  }, [reuniaoId]);

  useEffect(() => { loadReuniao(); loadDocumentos(); loadStatusHistorico(); }, [loadReuniao, loadDocumentos, loadStatusHistorico]);

  useEffect(() => {
    if (!reuniaoId) return;
    const unsub = reunioesService.subscribeToReuniao(reuniaoId, setReuniao);
    return () => unsub();
  }, [reuniaoId]);

  // --- Derived values ---
  const uid = user?.uid || user?.id;
  const callerInfo = useMemo(() => ({
    uid, displayName: user?.nome || user?.displayName || user?.email,
    email: user?.email, role: user?.role, isAdmin: user?.isAdmin, isCoordenador: user?.isCoordenador,
  }), [user, uid]);

  const isOrganizer = reuniao?.createdBy === uid;
  const isParticipant = !!reuniao?.participantesIds?.includes(uid);

  const canManageAll = useMemo(() => {
    if (!user) return false;
    const r = (user.role || '').toLowerCase();
    return !!(isOrganizer || user.isAdmin || user.isCoordenador || r === 'administrador' || r === 'coordenador');
  }, [user, isOrganizer]);

  const tipoConfig = useMemo(() => reuniao ? (TIPOS_REUNIAO.find(t => t.id === reuniao.tipoReuniao) || TIPOS_REUNIAO[0]) : null, [reuniao]);
  const statusConfig = useMemo(() => reuniao ? (STATUS_CONFIG[reuniao.status] || STATUS_CONFIG.agendada) : null, [reuniao]);

  const canUploadSubsidio = useMemo(() => {
    if (!reuniao || reuniao.status === 'cancelada' || reuniao.status === 'concluida') return false;
    const d = new Date(reuniao.dataReuniao);
    if (reuniao.horario) { const [h, m] = reuniao.horario.split(':').map(Number); d.setHours(h, m, 0, 0); }
    return new Date() < new Date(d.getTime() - 3600000);
  }, [reuniao]);

  const canUploadAta = useMemo(() => {
    if (!reuniao || reuniao.status === 'cancelada') return false;
    return new Date() >= new Date(reuniao.dataReuniao);
  }, [reuniao]);

  const canEditPresenca = useMemo(() => {
    if (!reuniao?.participantesIds?.length || reuniao.status === 'cancelada') return false;
    if (reuniao.status === 'em_andamento' || reuniao.status === 'concluida') return true;
    return new Date() >= new Date(reuniao.dataReuniao);
  }, [reuniao]);

  // --- Handlers ---
  const handleActivateCheckin = useCallback(async () => {
    try { setActivatingCheckin(true); await reunioesService.activateCheckin(reuniaoId, callerInfo); }
    catch (e) { toast({ title: 'Erro ao ativar check-in', description: e.message, variant: 'destructive' }); }
    finally { setActivatingCheckin(false); }
  }, [reuniaoId, toast, callerInfo]);

  const handleDeactivateCheckin = useCallback(async () => {
    try { await reunioesService.deactivateCheckin(reuniaoId, callerInfo); toast({ variant: 'success', title: 'Check-in encerrado e presenca sincronizada' }); }
    catch (e) { toast({ title: 'Erro ao encerrar check-in', description: e.message, variant: 'destructive' }); }
  }, [reuniaoId, toast, callerInfo]);

  // --- Notification helpers (non-blocking) ---
  const getRecipientIds = useCallback(() => {
    return (reuniao?.participantesIds || []).filter(id => id && id !== uid);
  }, [reuniao, uid]);

  const safeNotify = useCallback(async (payload) => {
    if (!payload.recipientIds?.length) return;
    try { await createSystemNotification(payload); }
    catch (err) { console.warn('[ReuniaoDetalhe] Falha ao enviar notificacao:', err); }
  }, [createSystemNotification]);

  const handleStatusChange = useCallback(async (newStatus) => {
    try {
      await reunioesService.updateStatus(reuniaoId, newStatus, callerInfo, 'Status alterado via interface');
      await loadReuniao();
      await loadStatusHistorico();
      // Notify participants about status change
      const recipientIds = getRecipientIds();
      const titulo = reuniao?.titulo || '';
      if (newStatus === 'cancelada') {
        safeNotify(buildReuniaoCancelPayload({ reuniaoId, titulo, recipientIds }));
      } else {
        safeNotify(buildReuniaoStatusPayload({ reuniaoId, titulo, newStatus, recipientIds }));
      }
    } catch (e) {
      console.error('Erro ao alterar status:', e);
      toast({ title: 'Erro ao alterar status', description: e.message, variant: 'destructive' });
    }
  }, [reuniaoId, callerInfo, loadReuniao, loadStatusHistorico, toast, getRecipientIds, safeNotify, reuniao]);

  const handleOpenPDF = useCallback((doc) => { setCurrentPDF({ url: doc.arquivoUrl, title: doc.titulo }); setShowPDF(true); }, []);

  // --- Dropdown actions ---
  const availableActions = useMemo(() => {
    if (!reuniao || !statusConfig) return [];
    const a = [];
    statusConfig.nextStates.forEach(ns => {
      const nc = STATUS_CONFIG[ns];
      if (!nc) return;
      a.push(ns === 'cancelada'
        ? { label: `Alterar para ${nc.label}`, icon: CheckCircle, action: () => setConfirmAction({ title: 'Cancelar reunião', description: 'Esta ação não pode ser desfeita. A reunião ficará em modo somente leitura.', confirmText: 'Cancelar reunião', variant: 'danger', onConfirm: () => handleStatusChange(ns) }) }
        : { label: `Alterar para ${nc.label}`, icon: CheckCircle, action: () => handleStatusChange(ns) }
      );
    });
    if (canUploadAta) a.push({ label: 'Adicionar Ata', action: () => setShowUploadAtaModal(true), icon: Upload, primary: true });
    if (canUploadSubsidio) a.push({ label: 'Adicionar Subsídio', action: () => setShowUploadSubsidioModal(true), icon: Upload });
    if (canManageAll && reuniao.status === 'em_andamento' && !reuniao.checkinAtivo) a.push({ label: activatingCheckin ? 'Ativando check-in...' : 'Iniciar Check-in', action: handleActivateCheckin, icon: ShieldCheck });
    if (canManageAll && reuniao.checkinAtivo) a.push({ label: 'Encerrar Check-in', icon: XCircle, action: () => setConfirmAction({ title: 'Encerrar check-in', description: 'Ao encerrar, os check-ins realizados serão sincronizados com a lista de presença.', confirmText: 'Encerrar check-in', variant: 'danger', onConfirm: handleDeactivateCheckin }) });
    return a;
  }, [reuniao, statusConfig, canUploadAta, canUploadSubsidio, canManageAll, activatingCheckin, handleActivateCheckin, handleDeactivateCheckin, handleStatusChange]);

  // --- Header ---
  const header = (
    <PageHeader
      title="Detalhes da Reunião"
      onBack={() => onNavigate('reunioes')}
      actions={
        availableActions.length > 0 ? (
          <DropdownMenu>
            <DropdownTrigger asChild>
              <button
                type="button"
                aria-label="Mais ações da reunião"
                className="p-2 rounded-xl hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <MoreVertical className="w-5 h-5 text-primary" aria-hidden="true" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="end" minWidth={280}>
              {availableActions.map((act, i) => (
                <DropdownItem
                  key={i}
                  onClick={act.action}
                  icon={act.icon ? <act.icon className="w-4 h-4" /> : undefined}
                  className={act.primary ? 'font-semibold text-primary' : ''}
                >
                  {act.label}
                </DropdownItem>
              ))}
            </DropdownContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  );

  if (loading) return (
    <div className="min-h-dvh bg-background pb-24">
      {header}
      <PageSkeleton variant="detail" header={false} />
    </div>
  );

  if (!reuniao) return (
    <div className="min-h-dvh bg-background pb-24">
      {header}
      <div className="flex items-center justify-center py-12"><div className="text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Reunião não encontrada</h3>
        <button type="button" onClick={() => onNavigate('reunioes')} className="text-primary font-medium">Voltar para a lista</button>
      </div></div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {header}
      <div className="px-4 sm:px-5 py-4 space-y-4">
        {reuniao.status === 'concluida' && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
            <p className="text-xs text-success">Reunião concluída — somente leitura. Você pode adicionar ata pelo menu ⋮</p>
          </div>
        )}
        {reuniao.status === 'cancelada' && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">Reunião cancelada — somente leitura.</p>
          </div>
        )}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-foreground leading-snug flex-1">{reuniao.titulo}</h2>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-current" />{statusConfig.label}</Badge>
          </div>
          {tipoConfig && (
            <Badge
              variant={TIPO_BADGE_CONFIG[reuniao.tipoReuniao]?.variant || 'secondary'}
              badgeStyle={TIPO_BADGE_CONFIG[reuniao.tipoReuniao]?.badgeStyle || 'subtle'}
              dot
            >
              {tipoConfig.title}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="contexto" variant="underline">
          <TabsList>
            <TabsTrigger value="contexto">Contexto</TabsTrigger>
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="presenca">Presença</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="deliberacoes">Deliberações</TabsTrigger>
          </TabsList>
          <TabsContent value="contexto" className="pt-4">
            <ContextoTab reuniao={reuniao} tipoConfig={tipoConfig} formatDate={formatDate} />
          </TabsContent>
          <TabsContent value="checkin" className="pt-4">
            <CheckinTab reuniao={reuniao} user={user} isOrganizer={isOrganizer} isParticipant={isParticipant} allUsers={allUsers} onDeactivateCheckin={handleDeactivateCheckin} />
          </TabsContent>
          <TabsContent value="presenca" className="pt-4">
            <PresencaTab reuniao={reuniao} reuniaoId={reuniaoId} user={user} canManageAll={canManageAll} isParticipant={isParticipant} canEditPresenca={canEditPresenca} allUsers={allUsers} onReload={loadReuniao} />
          </TabsContent>
          <TabsContent value="documentos" className="pt-4">
            <DocumentosTab documentos={documentos} canUploadSubsidio={canUploadSubsidio} canUploadAta={canUploadAta} onOpenPDF={handleOpenPDF} onShowUploadSubsidio={() => setShowUploadSubsidioModal(true)} onShowUploadAta={() => setShowUploadAtaModal(true)} formatDateTime={formatDateTime} />
          </TabsContent>
          <TabsContent value="historico" className="pt-4">
            <HistoricoTab statusHistorico={statusHistorico} formatDateTime={formatDateTime} />
          </TabsContent>
          <TabsContent value="deliberacoes" className="pt-4">
            <DeliberacoesTab
              reuniao={reuniao}
              reuniaoId={reuniaoId}
              user={user}
              canManageAll={canManageAll}
              isParticipant={isParticipant}
              allUsers={allUsers}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ViewPdfModal open={showPDF} onClose={() => { setShowPDF(false); setCurrentPDF(null); }} documento={currentPDF} title={currentPDF?.title} />
      <UploadAtaModal isOpen={showUploadAtaModal} onClose={() => setShowUploadAtaModal(false)} reuniaoId={reuniaoId} user={user} onSuccess={() => {
        setShowUploadAtaModal(false); loadReuniao(); loadDocumentos(); loadStatusHistorico();
        safeNotify(buildReuniaoDocumentoPayload({ reuniaoId, titulo: reuniao?.titulo || '', tipoDocumento: 'ata', recipientIds: getRecipientIds() }));
      }} />
      <UploadSubsidioModal isOpen={showUploadSubsidioModal} onClose={() => setShowUploadSubsidioModal(false)} reuniaoId={reuniaoId} user={user} onSuccess={() => {
        setShowUploadSubsidioModal(false); loadDocumentos();
        safeNotify(buildReuniaoDocumentoPayload({ reuniaoId, titulo: reuniao?.titulo || '', tipoDocumento: 'subsidio', recipientIds: getRecipientIds() }));
      }} />
      <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.title} description={confirmAction?.description} confirmText={confirmAction?.confirmText} variant={confirmAction?.variant} onConfirm={async () => { await confirmAction?.onConfirm?.(); setConfirmAction(null); }} />
    </div>
  );
}
