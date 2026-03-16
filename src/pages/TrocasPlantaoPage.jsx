/**
 * TrocasPlantaoPage
 * Página standalone para gerenciar trocas de plantão
 */
import { useState } from 'react';
import { Modal, Spinner, useToast } from '@/design-system';
import { PageHeader } from '../components';
import { useResidencia } from '../hooks/useResidencia';
import { useTrocaPlantao } from '../hooks/useTrocaPlantao';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import TradeRequestForm from '../components/residencia/TradeRequestForm';
import TradesList from '../components/residencia/TradesList';
import { Plus } from 'lucide-react';

export default function TrocasPlantaoPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  const { user, firebaseUser } = useUser();
  const { residentes } = useResidencia();
  const { trades, pendingTrades, loading, createTrade, acceptTrade, rejectTrade, cancelTrade, canManageTrades } = useTrocaPlantao();
  const { createSystemNotification } = useMessages();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      createSystemNotification({
        category: 'plantao',
        subject: 'Nova solicitação de troca de plantão',
        content: `${user?.firstName || 'Um residente'} solicita troca para ${tradeData.dataPlantao}. Código: ${trade.codigo}`,
        priority: 'alta',
        actionUrl: 'trocasPlantao',
        actionLabel: 'Ver Troca',
      });
    } else {
      toast({
        title: 'Erro',
        description: error || 'Não foi possível criar a troca',
        variant: 'destructive',
      });
    }
  };

  const handleAccept = async (codigo) => {
    const { success, error } = await acceptTrade(codigo);
    if (success) {
      toast({ title: 'Troca aceita', description: `Código: ${codigo}`, variant: 'success' });
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  const handleReject = async (codigo) => {
    const { success, error } = await rejectTrade(codigo);
    if (success) {
      toast({ title: 'Troca rejeitada', description: `Código: ${codigo}`, variant: 'default' });
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  const handleCancel = async (codigo) => {
    const { success, error } = await cancelTrade(codigo);
    if (success) {
      toast({ title: 'Troca cancelada', description: `Código: ${codigo}`, variant: 'default' });
    } else {
      toast({ title: 'Erro', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F0FFF4] dark:bg-[#111916]">
      <PageHeader title="Trocas de Plantão" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {!canManageTrades && (
          <div className="bg-[#E8F5E9] dark:bg-[#1A2F23] rounded-2xl p-3 mb-4 text-center">
            <p className="text-xs text-[#006837] dark:text-[#2ECC71]">
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
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-black shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity active:scale-95 z-40"
          aria-label="Nova troca"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modal do formulário */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Solicitação de Troca"
        description="Preencha os dados para solicitar uma troca de plantão"
        size="md"
      >
        <Modal.Body>
          <TradeRequestForm
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            residentes={residentes}
            loading={submitting}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
