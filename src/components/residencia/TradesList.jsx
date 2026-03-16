/**
 * TradesList
 * Lista de trocas de plantão com filtros e animações.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Plus, CalendarClock } from 'lucide-react';
import TradeCard from './TradeCard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aceita', label: 'Aceitas' },
  { key: 'rejeitada', label: 'Rejeitadas' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterChip({ label, active, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-black shadow-sm'
          : 'bg-white dark:bg-[#1A2420] text-[#006837] dark:text-[#2ECC71] border border-[#C8E6C9] dark:border-[#2A3F36]'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
          active
            ? 'bg-white/25 text-white dark:bg-black/20 dark:text-black'
            : 'bg-[#E8F5E9] dark:bg-[#1A2F23] text-[#006837] dark:text-[#2ECC71]'
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
      <div className="w-20 h-20 rounded-2xl bg-[#E8F5E9] dark:bg-[#1A2F23] flex items-center justify-center mb-5">
        {isFiltered ? (
          <CalendarClock className="w-9 h-9 text-[#006837]/60 dark:text-[#2ECC71]/60" />
        ) : (
          <ArrowLeftRight className="w-9 h-9 text-[#006837]/60 dark:text-[#2ECC71]/60" />
        )}
      </div>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">
        {isFiltered ? 'Nenhuma troca nesse filtro' : 'Nenhuma troca ainda'}
      </p>
      <p className="text-sm text-[#9CA3AF] dark:text-[#6B8178] max-w-[240px]">
        {isFiltered
          ? 'Tente outro filtro ou crie uma nova solicitação.'
          : 'Solicite uma troca de plantão e ela aparecerá aqui.'}
      </p>
      {onCreateNew && !isFiltered && (
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-black text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TradesList({
  trades = [],
  pendingTrades = [],
  currentUserId,
  onAccept,
  onReject,
  onCancel,
  onCreateNew,
}) {
  const [filter, setFilter] = useState('todas');

  // Combine trades + pendingTrades, deduplicate by codigo
  const allTrades = useMemo(() => {
    const map = new Map();

    trades.forEach(t => {
      if (t.codigo) map.set(t.codigo, t);
    });

    pendingTrades.forEach(t => {
      if (t.codigo && !map.has(t.codigo)) {
        map.set(t.codigo, t);
      }
    });

    return Array.from(map.values());
  }, [trades, pendingTrades]);

  // Count per status
  const counts = useMemo(() => {
    const c = { todas: allTrades.length, pendente: 0, aceita: 0, rejeitada: 0 };
    allTrades.forEach(t => {
      if (c[t.status] !== undefined) c[t.status]++;
    });
    return c;
  }, [allTrades]);

  // Apply filter
  const filteredTrades = useMemo(() => {
    if (filter === 'todas') return allTrades;
    return allTrades.filter(t => t.status === filter);
  }, [allTrades, filter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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

      {/* Trade cards list */}
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
                <TradeCard
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

export default TradesList;
