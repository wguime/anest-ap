/**
 * TrocasPlantaoHospitalarPage
 * Página standalone para gerenciar trocas de plantão hospitalar (FDS/feriados).
 * Notifica usuárias envolvidas via inbox (createSystemNotification + recipientIds).
 */
import { useState, useCallback } from 'react';
import { Button, Modal, Spinner, useToast } from '@/design-system';
import { PageHeader } from '../components';
import { useTrocaPlantaoHospitalar, getFuncionariaHospitalarFirebaseUid } from '../hooks/useTrocaPlantaoHospitalar';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import PlantaoTradeRequestForm from '../components/hospitais/PlantaoTradeRequestForm';
import PlantaoTradesList from '../components/hospitais/PlantaoTradesList';
import { FUNCIONARIAS_HOSPITAIS } from '../data/hospitaisTecnicas2026';
import { Plus } from 'lucide-react';
import {
  buildPlantaoHospitalarNotificationContent,
  getPlantaoHospitalarNotificationRecipients,
  PLANTAO_NOTIF_META,
} from '../utils/plantaoHospitalarNotifications';

const TRADE_FORM_ID = 'plantao-hospitalar-trade-request-form';

export default function TrocasPlantaoHospitalarPage({ goBack }) {
  const { toast } = useToast();
  const { user, firebaseUser } = useUser();
  const {
    trades,
    pendingTrades,
    loading,
    createTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    canManageTrades,
    userFuncionariaId,
    isAdminOrCoord,
  } = useTrocaPlantaoHospitalar();
  const { createSystemNotification } = useMessages();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userFirstName = user?.firstName || 'Uma funcionária';

  const notifyTrade = useCallback(async ({ recipientIds, subject, content }) => {
    if (!recipientIds || recipientIds.length === 0) return;
    try {
      await createSystemNotification({
        category: PLANTAO_NOTIF_META.CATEGORY,
        subject,
        content,
        priority: PLANTAO_NOTIF_META.PRIORITY,
        actionUrl: PLANTAO_NOTIF_META.ACTION_URL,
        actionLabel: PLANTAO_NOTIF_META.ACTION_LABEL,
        recipientIds,
      });
    } catch (err) {
      console.warn('Erro ao notificar troca plantão hospitalar:', err);
    }
  }, [createSystemNotification]);

  const funcionariaIdsToUids = useCallback(async (funcionariaIds) => {
    const uids = await Promise.all((funcionariaIds || []).map((id) => getFuncionariaHospitalarFirebaseUid(id)));
    return uids.filter(Boolean);
  }, []);

  const handleSubmit = async (tradeData) => {
    setSubmitting(true);
    const { success, trade, error } = await createTrade(tradeData);
    setSubmitting(false);

    if (success && trade) {
      setShowForm(false);
      toast({
        title: 'Troca criada',
        description: `Código: ${trade.codigo}`,
        variant: 'success',
      });

      const targetFuncionariaIds = getPlantaoHospitalarNotificationRecipients('created', trade, {
        actorFuncionariaId: trade.solicitanteFuncionariaId,
        allFuncionariaIds: FUNCIONARIAS_HOSPITAIS.map((f) => f.id),
      });
      const recipientIds = await funcionariaIdsToUids(targetFuncionariaIds);
      const { subject, content } = buildPlantaoHospitalarNotificationContent('created', trade, { actorFirstName: userFirstName });
      notifyTrade({ recipientIds, subject, content });
    } else {
      toast({
        title: 'Erro',
        description: error || 'Não foi possível criar a troca',
        variant: 'destructive',
      });
    }
  };

  const handleAccept = async (codigo) => {
    const { success, error, trade } = await acceptTrade(codigo);
    if (success) {
      toast({ title: 'Troca aceita', description: `Código: ${codigo}`, variant: 'success' });
      if (trade?.solicitanteId) {
        const { subject, content } = buildPlantaoHospitalarNotificationContent('accepted', trade, { actorFirstName: userFirstName });
        notifyTrade({ recipientIds: [trade.solicitanteId], subject, content });
      }
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  const handleReject = async (codigo) => {
    const { success, error, trade } = await rejectTrade(codigo);
    if (success) {
      toast({ title: 'Troca rejeitada', description: `Código: ${codigo}`, variant: 'default' });
      if (trade?.solicitanteId) {
        const { subject, content } = buildPlantaoHospitalarNotificationContent('rejected', trade, { actorFirstName: userFirstName });
        notifyTrade({ recipientIds: [trade.solicitanteId], subject, content });
      }
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  const handleCancel = async (codigo) => {
    const { success, error, trade } = await cancelTrade(codigo);
    if (success) {
      toast({ title: 'Troca cancelada', description: `Código: ${codigo}`, variant: 'default' });
      const targetFuncionariaIds = getPlantaoHospitalarNotificationRecipients('cancelled', trade, { actorFuncionariaId: trade.solicitanteFuncionariaId });
      if (targetFuncionariaIds.length > 0) {
        const recipientIds = await funcionariaIdsToUids(targetFuncionariaIds);
        const { subject, content } = buildPlantaoHospitalarNotificationContent('cancelled', trade, { actorFirstName: userFirstName });
        notifyTrade({ recipientIds, subject, content });
      }
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title="Trocas de Plantão (FDS/Feriado)" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {!canManageTrades && (
          <div className="bg-muted rounded-2xl p-3 mb-4 text-center">
            <p className="text-xs text-primary">
              Somente funcionárias escaladas em hospitais ou admin/coordenador podem solicitar ou responder trocas.
            </p>
          </div>
        )}

        {canManageTrades && !userFuncionariaId && !isAdminOrCoord && (
          <div className="bg-warning/10 border border-warning/40 rounded-2xl p-3 mb-4">
            <p className="text-xs text-foreground">
              Sua conta (<strong>{user?.email || 'sem email'}</strong>) ainda não foi vinculada à escala hospitalar. Avise o coordenador para corrigir o cadastro.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <PlantaoTradesList
            trades={trades}
            pendingTrades={pendingTrades}
            currentUserId={firebaseUser?.uid}
            onAccept={canManageTrades ? handleAccept : undefined}
            onReject={canManageTrades ? handleReject : undefined}
            onCancel={handleCancel}
            onCreateNew={canManageTrades ? () => setShowForm(true) : undefined}
          />
        )}
      </div>

      {canManageTrades && trades.length > 0 && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="fixed right-5 w-14 h-14 rounded-full bg-primary text-white dark:text-black shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity active:scale-95 z-40"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Nova troca"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Solicitação de Troca de Plantão"
        description="Preencha os dados para solicitar uma troca ou cobertura de plantão"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form={TRADE_FORM_ID} loading={submitting}>
              Solicitar
            </Button>
          </>
        }
      >
        <Modal.Body>
          <PlantaoTradeRequestForm
            formId={TRADE_FORM_ID}
            onSubmit={handleSubmit}
            funcionarias={FUNCIONARIAS_HOSPITAIS}
            userFuncionariaId={userFuncionariaId}
            isAdminOrCoord={isAdminOrCoord}
            loading={submitting}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
