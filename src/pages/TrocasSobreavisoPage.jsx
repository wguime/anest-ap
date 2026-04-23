/**
 * TrocasSobreavisoPage
 * Página standalone para gerenciar trocas de sobreaviso materno.
 * Notifica usuárias envolvidas via inbox (createSystemNotification + recipientIds).
 */
import { useState, useCallback } from 'react';
import { Button, Modal, Spinner, useToast } from '@/design-system';
import { PageHeader } from '../components';
import { useTrocaSobreaviso, getFuncionariaFirebaseUid } from '../hooks/useTrocaSobreaviso';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import SobreavisoTradeRequestForm from '../components/sobreaviso/SobreavisoTradeRequestForm';
import SobreavisoTradesList from '../components/sobreaviso/SobreavisoTradesList';
import { FUNCIONARIAS_SOBREAVISO } from '../data/sobreavisoMaterno2026';
import { Plus } from 'lucide-react';
import {
  buildSobreavisoNotificationContent,
  getSobreavisoNotificationRecipients,
} from '../utils/sobreavisoNotifications';

const TRADE_FORM_ID = 'sobreaviso-trade-request-form';

export default function TrocasSobreavisoPage({ goBack }) {
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
  } = useTrocaSobreaviso();
  const { createSystemNotification } = useMessages();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userFirstName = user?.firstName || 'Uma funcionária';

  const notifyTrade = useCallback(async ({ recipientIds, subject, content }) => {
    if (!recipientIds || recipientIds.length === 0) return;
    try {
      await createSystemNotification({
        category: 'sobreaviso',
        subject,
        content,
        priority: 'alta',
        actionUrl: 'trocasSobreaviso',
        actionLabel: 'Ver Troca',
        recipientIds,
      });
    } catch (err) {
      console.warn('Erro ao notificar troca sobreaviso:', err);
    }
  }, [createSystemNotification]);

  const funcionariaIdsToUids = useCallback(async (funcionariaIds) => {
    const uids = await Promise.all((funcionariaIds || []).map((id) => getFuncionariaFirebaseUid(id)));
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

      const targetFuncionariaIds = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: trade.solicitanteFuncionariaId,
        allFuncionariaIds: FUNCIONARIAS_SOBREAVISO.map((f) => f.id),
      });
      const recipientIds = await funcionariaIdsToUids(targetFuncionariaIds);
      const { subject, content } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: userFirstName });
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
        const { subject, content } = buildSobreavisoNotificationContent('accepted', trade, { actorFirstName: userFirstName });
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
        const { subject, content } = buildSobreavisoNotificationContent('rejected', trade, { actorFirstName: userFirstName });
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
      const targetFuncionariaIds = getSobreavisoNotificationRecipients('cancelled', trade, { actorFuncionariaId: trade.solicitanteFuncionariaId });
      if (targetFuncionariaIds.length > 0) {
        const recipientIds = await funcionariaIdsToUids(targetFuncionariaIds);
        const { subject, content } = buildSobreavisoNotificationContent('cancelled', trade, { actorFirstName: userFirstName });
        notifyTrade({ recipientIds, subject, content });
      }
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title="Trocas de Sobreaviso" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {!canManageTrades && (
          <div className="bg-muted rounded-2xl p-3 mb-4 text-center">
            <p className="text-xs text-primary">
              Somente funcionárias de sobreaviso materno ou admin/coordenador podem solicitar ou responder trocas.
            </p>
          </div>
        )}

        {canManageTrades && !userFuncionariaId && !isAdminOrCoord && (
          <div className="bg-warning/10 border border-warning/40 rounded-2xl p-3 mb-4">
            <p className="text-xs text-foreground">
              Sua conta (<strong>{user?.email || 'sem email'}</strong>) ainda não foi vinculada à escala de sobreaviso. Avise o coordenador para corrigir o cadastro — você poderá visualizar trocas mas não conseguirá aceitar/criar até a vinculação ser feita.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <SobreavisoTradesList
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
        title="Nova Solicitação de Troca"
        description="Preencha os dados para solicitar uma troca ou cobertura de sobreaviso"
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
          <SobreavisoTradeRequestForm
            formId={TRADE_FORM_ID}
            onSubmit={handleSubmit}
            funcionarias={FUNCIONARIAS_SOBREAVISO}
            userFuncionariaId={userFuncionariaId}
            isAdminOrCoord={isAdminOrCoord}
            loading={submitting}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
