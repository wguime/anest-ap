/**
 * AdminTodasTrocasFuncionariasPage
 * Visão administrativa (read-only) de TODAS as trocas das funcionárias —
 * sobreaviso materno + plantão hospitalar (FDS/feriado).
 *
 * Acesso restrito: somente admin/coord (gate aplicado no Hub que renderiza o card).
 */
import { useState } from 'react';
import { Spinner } from '@/design-system';
import { PageHeader } from '../components';
import { useUser } from '../contexts/UserContext';
import { useAllSobreavisoTrades, useAllPlantaoHospitalarTrades } from '../hooks/useAllTrades';
import SobreavisoTradesList from '../components/sobreaviso/SobreavisoTradesList';
import PlantaoTradesList from '../components/hospitais/PlantaoTradesList';

const TABS = [
  { key: 'sobreaviso', label: 'Sobreaviso' },
  { key: 'hospitalar', label: 'Plantão Hospitalar' },
];

function TabButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 rounded-full text-sm font-semibold transition-all ${
        active
          ? 'bg-primary text-white dark:text-black shadow-sm'
          : 'bg-card text-primary border border-border'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full text-[11px] font-bold px-1.5 ${
          active ? 'bg-white/25 text-white dark:bg-black/30 dark:text-black' : 'bg-primary/15 text-primary'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function AdminTodasTrocasFuncionariasPage({ goBack }) {
  const { firebaseUser } = useUser();
  const [tab, setTab] = useState('sobreaviso');

  const sobr = useAllSobreavisoTrades();
  const hosp = useAllPlantaoHospitalarTrades();

  const loading = sobr.loading || hosp.loading;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Todas as Trocas — Funcionárias" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        <div className="bg-muted/40 rounded-2xl p-3 mb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Visão administrativa — todas as trocas de todas as funcionárias.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              count={t.key === 'sobreaviso' ? sobr.trades.length : hosp.trades.length}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : tab === 'sobreaviso' ? (
          <SobreavisoTradesList
            trades={sobr.trades}
            pendingTrades={[]}
            currentUserId={firebaseUser?.uid}
          />
        ) : (
          <PlantaoTradesList
            trades={hosp.trades}
            pendingTrades={[]}
            currentUserId={firebaseUser?.uid}
          />
        )}
      </div>
    </div>
  );
}
