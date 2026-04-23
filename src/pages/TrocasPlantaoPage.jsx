/**
 * TrocasPlantaoPage
 * Página standalone para gerenciar trocas de plantão.
 * Notifica usuários envolvidos via inbox (createSystemNotification + recipientIds).
 */
import { useState, useCallback } from 'react';
import { Button, Modal, Spinner, useToast } from '@/design-system';
import { PageHeader } from '../components';
import { useResidencia } from '../hooks/useResidencia';
import { useTrocaPlantao, getResidenteFirebaseUid } from '../hooks/useTrocaPlantao';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import TradeRequestForm from '../components/residencia/TradeRequestForm';
import TradesList from '../components/residencia/TradesList';
import { Plus } from 'lucide-react';
import {
  buildTradeNotificationContent,
  getTradeNotificationRecipients,
} from '../utils/tradeNotifications';

const TRADE_FORM_ID = 'trade-request-form';

export default function TrocasPlantaoPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  const { user, firebaseUser } = useUser();
  const { residentes } = useResidencia();
  const { trades, pendingTrades, loading, createTrade, acceptTrade, rejectTrade, cancelTrade, canManageTrades, userResidenteId } = useTrocaPlantao();
  const { createSystemNotification } = useMessages();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userFirstName = user?.firstName || 'Um residente';

  // Helper: dispara notificação direcionada para os UIDs envolvidos.
  const notifyTrade = useCallback(async ({ recipientIds, subject, content }) => {
    if (!recipientIds || recipientIds.length === 0) return;
    try {
      await createSystemNotification({
        category: 'plantao',
        subject,
        content,
        priority: 'alta',
        actionUrl: 'trocasPlantao',
        actionLabel: 'Ver Troca',
        recipientIds,
      });
    } catch (err) {
      console.warn('Erro ao notificar troca:', err);
    }
  }, [createSystemNotification]);

  // Resolve residenteIds → Firebase UIDs para notificação direcionada a destinatário(s).
  const residenteIdsToUids = useCallback(async (residenteIds) => {
    const uids = await Promise.all((residenteIds || []).map((id) => getResidenteFirebaseUid(id)));
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

      const targetResidenteIds = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: userResidenteId,
        allResidenteIds: residentes.filter((r) => r.nome).map((r) => r.id),
      });
      const recipientIds = await residenteIdsToUids(targetResidenteIds);
      const { subject, content } = buildTradeNotificationContent('created', trade, { actorFirstName: userFirstName });
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
        const { subject, content } = buildTradeNotificationContent('accepted', trade, { actorFirstName: userFirstName });
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
        const { subject, content } = buildTradeNotificationContent('rejected', trade, { actorFirstName: userFirstName });
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
      const targetResidenteIds = getTradeNotificationRecipients('cancelled', trade, { actorResidenteId: userResidenteId });
      if (targetResidenteIds.length > 0) {
        const recipientIds = await residenteIdsToUids(targetResidenteIds);
        const { subject, content } = buildTradeNotificationContent('cancelled', trade, { actorFirstName: userFirstName });
        notifyTrade({ recipientIds, subject, content });
      }
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title="Trocas de Plantão" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {!canManageTrades && (
          <div className="bg-muted rounded-2xl p-3 mb-4 text-center">
            <p className="text-xs text-primary">
              Somente residentes podem solicitar ou responder trocas de plantão.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <TradesList
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

      {/* FAB para criar nova troca — só quando há trades (empty state já tem CTA) */}
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

      {/* Modal do formulário — botões no footer (padrão do app) */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Solicitação de Troca"
        description="Preencha os dados para solicitar uma troca ou cobertura"
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
          <TradeRequestForm
            formId={TRADE_FORM_ID}
            onSubmit={handleSubmit}
            residentes={residentes}
            userResidenteId={userResidenteId}
            loading={submitting}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
