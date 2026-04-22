/**
 * PlantaoTradesList
 * Lista de trocas de plantão hospitalar com filtros + animação.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Plus, CalendarClock, Inbox, Clock, CheckCircle2, XCircle } from 'lucide-react';
import PlantaoTradeCard from './PlantaoTradeCard';

const FILTERS = [
  { key: 'todas', label: 'Todas', icon: Inbox },
  { key: 'pendente', label: 'Pendentes', icon: Clock },
  { key: 'aceita', label: 'Aceitas', icon: CheckCircle2 },
  { key: 'rejeitada', label: 'Rejeitadas', icon: XCircle },
];

function FilterChip({ label, icon: Icon, active, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink min-w-0 inline-flex items-center justify-center py-2 px-3 rounded-full transition-all duration-200 ease-in-out ${
        active
          ? 'flex-[3] gap-2 bg-primary text-white dark:text-black shadow-sm'
          : 'flex-1 bg-secondary text-muted-foreground'
      }`}
      aria-label={label}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {active && (
        <span className="text-[13px] font-semibold whitespace-nowrap">{label}</span>
      )}
      {active && count > 0 && (
        <span className="text-[11px] font-bold opacity-90">{count}</span>
      )}
      {!active && count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[10px] font-bold px-1 bg-primary text-white dark:bg-primary dark:text-black">
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
      <p className="text-sm text-muted-foreground max-w-[260px]">
        {isFiltered
          ? 'Tente outro filtro ou crie uma nova solicitação.'
          : 'Solicite uma troca de plantão (FDS/feriado) e ela aparecerá aqui.'}
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

export function PlantaoTradesList({
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
    trades.forEach((t) => { if (t.codigo) map.set(t.codigo, t); });
    pendingTrades.forEach((t) => {
      if (t.codigo && !map.has(t.codigo)) map.set(t.codigo, t);
    });
    return Array.from(map.values());
  }, [trades, pendingTrades]);

  const counts = useMemo(() => {
    const c = { todas: allTrades.length, pendente: 0, aceita: 0, rejeitada: 0 };
    allTrades.forEach((t) => {
      if (c[t.status] !== undefined) c[t.status]++;
    });
    return c;
  }, [allTrades]);

  const filteredTrades = useMemo(() => {
    if (filter === 'todas') return allTrades;
    return allTrades.filter((t) => t.status === filter);
  }, [allTrades, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 w-full overflow-visible pt-1.5">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            icon={f.icon}
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
            {filteredTrades.map((trade) => (
              <motion.div
                key={trade.codigo || trade.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <PlantaoTradeCard
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

export default PlantaoTradesList;
