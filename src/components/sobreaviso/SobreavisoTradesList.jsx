/**
 * SobreavisoTradesList
 * Lista de trocas de sobreaviso com filtros + animação.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Plus, CalendarClock } from 'lucide-react';
import SobreavisoTradeCard from './SobreavisoTradeCard';

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aceita', label: 'Aceitas' },
  { key: 'rejeitada', label: 'Rejeitadas' },
];

function FilterChip({ label, active, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-primary text-white dark:text-black shadow-sm'
          : 'bg-card text-primary border border-border'
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
          active
            ? 'bg-white/30 text-white dark:bg-black/40 dark:text-black'
            : 'bg-primary text-white dark:bg-primary dark:text-black'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ filter, onCreateNew }) {
  const isFiltered = filter !== 'todas';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
        {isFiltered ? (
          <CalendarClock className="w-9 h-9 text-primary/60 dark:text-primary/60" />
        ) : (
          <ArrowLeftRight className="w-9 h-9 text-primary/60 dark:text-primary/60" />
        )}
      </div>
      <p className="text-base font-semibold text-foreground mb-1">
        {isFiltered ? 'Nenhuma troca nesse filtro' : 'Nenhuma troca ainda'}
      </p>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        {isFiltered
          ? 'Tente outro filtro ou crie uma nova solicitação.'
          : 'Solicite uma troca de sobreaviso e ela aparecerá aqui.'}
      </p>
      {onCreateNew && !isFiltered && (
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white dark:text-black text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação
        </button>
      )}
    </div>
  );
}

export function SobreavisoTradesList({
  trades = [],
  pendingTrades = [],
  currentUserId,
  onAccept,
  onReject,
  onCancel,
  onCreateNew,
}) {
  const [filter, setFilter] = useState('todas');

  const allTrades = useMemo(() => {
    const map = new Map();
    trades.forEach(t => { if (t.codigo) map.set(t.codigo, t); });
    pendingTrades.forEach(t => {
      if (t.codigo && !map.has(t.codigo)) map.set(t.codigo, t);
    });
    return Array.from(map.values());
  }, [trades, pendingTrades]);

  const counts = useMemo(() => {
    const c = { todas: allTrades.length, pendente: 0, aceita: 0, rejeitada: 0 };
    allTrades.forEach(t => {
      if (c[t.status] !== undefined) c[t.status]++;
    });
    return c;
  }, [allTrades]);

  const filteredTrades = useMemo(() => {
    if (filter === 'todas') return allTrades;
    return allTrades.filter(t => t.status === filter);
  }, [allTrades, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
        {FILTERS.map(f => (
          <FilterChip
            key={f.key}
            label={f.label}
            active={filter === f.key}
            count={counts[f.key] || 0}
            onClick={() => setFilter(f.key)}
          />
        ))}
      </div>

      {filteredTrades.length === 0 ? (
        <EmptyState filter={filter} onCreateNew={onCreateNew} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filteredTrades.map(trade => (
              <motion.div
                key={trade.codigo || trade.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <SobreavisoTradeCard
                  trade={trade}
                  currentUserId={currentUserId}
                  onAccept={onAccept}
                  onReject={onReject}
                  onCancel={onCancel}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default SobreavisoTradesList;
