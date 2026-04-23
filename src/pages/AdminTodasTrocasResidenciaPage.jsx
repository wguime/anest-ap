/**
 * AdminTodasTrocasResidenciaPage
 * Visão administrativa (read-only) de TODAS as trocas de plantão de residência.
 *
 * Acesso restrito: somente admin/coord (gate aplicado no Hub que renderiza o card).
 */
import { Spinner } from '@/design-system';
import { PageHeader } from '../components';
import { useUser } from '../contexts/UserContext';
import { useAllResidenciaTrades } from '../hooks/useAllTrades';
import TradesList from '../components/residencia/TradesList';

export default function AdminTodasTrocasResidenciaPage({ goBack }) {
  const { firebaseUser } = useUser();
  const { trades, loading } = useAllResidenciaTrades();

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title="Todas as Trocas — Residência" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        <div className="bg-muted/40 rounded-2xl p-3 mb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Visão administrativa — todas as trocas de plantão de todos os residentes.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <TradesList
            trades={trades}
            pendingTrades={[]}
            currentUserId={firebaseUser?.uid}
          />
        )}
      </div>
    </div>
  );
}
