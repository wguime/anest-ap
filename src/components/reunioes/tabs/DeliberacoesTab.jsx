import { useState, useEffect } from 'react';
import { SectionCard, Button, EmptyState, useToast } from '@/design-system';
import { Vote, Plus } from 'lucide-react';
import reunioesService from '@/services/reunioesService';
import VotacaoCard from '@/components/reunioes/VotacaoCard';
import NovaDeliberacaoModal from '@/components/reunioes/NovaDeliberacaoModal';

/**
 * DeliberacoesTab — Real-time list of deliberações (resolutions/voting items)
 * for a meeting. Supports creating new deliberações and voting.
 */
export default function DeliberacoesTab({
  reuniao,
  reuniaoId,
  user,
  canManageAll,
  allUsers,
}) {
  const { toast } = useToast();

  const [deliberacoes, setDeliberacoes] = useState([]);
  const [showNovaModal, setShowNovaModal] = useState(false);

  // Real-time subscription to deliberações
  useEffect(() => {
    if (!reuniaoId) return;

    const unsubscribe = reunioesService.subscribeToDeliberacoes(reuniaoId, (data) => {
      setDeliberacoes(data);
    });

    return () => unsubscribe();
  }, [reuniaoId]);

  // Reload handler for VotacaoCard (noop since we have real-time subscription,
  // but kept for consistency and as a fallback trigger)
  const handleReload = async () => {
    try {
      const data = await reunioesService.getDeliberacoes(reuniaoId);
      setDeliberacoes(data);
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao carregar deliberações', description: error.message });
    }
  };

  const canCreate = canManageAll && reuniao?.status === 'em_andamento';

  // Empty state description varies by meeting status
  const emptyDescription = (() => {
    if (reuniao?.status === 'em_andamento') {
      return canManageAll
        ? 'Crie a primeira deliberação para iniciar a votação.'
        : 'O organizador ainda não criou deliberações para esta reunião.';
    }
    if (reuniao?.status === 'concluida') {
      return 'Nenhuma deliberação foi registrada nesta reunião.';
    }
    return 'Deliberações estarão disponíveis quando a reunião estiver em andamento.';
  })();

  return (
    <>
      <SectionCard
        title="Deliberações"
        subtitle={`${deliberacoes.length} deliberação(ões)`}
        headerAction={canCreate ? (
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowNovaModal(true)}
            aria-label="Criar nova deliberação"
          >
            Nova
          </Button>
        ) : null}
      >
        {deliberacoes.length === 0 ? (
          <EmptyState
            icon={Vote}
            title="Nenhuma deliberação"
            description={emptyDescription}
          />
        ) : (
          <div className="space-y-3">
            {deliberacoes.map(delib => (
              <VotacaoCard
                key={delib.id}
                deliberacao={delib}
                user={user}
                canManageAll={canManageAll}
                allUsers={allUsers}
                reuniao={reuniao}
                onReload={handleReload}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <NovaDeliberacaoModal
        open={showNovaModal}
        onClose={() => setShowNovaModal(false)}
        reuniaoId={reuniaoId}
        user={user}
        onSuccess={handleReload}
      />
    </>
  );
}
