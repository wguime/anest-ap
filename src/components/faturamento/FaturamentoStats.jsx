/**
 * FaturamentoStats - Cards de estatísticas do faturamento
 * Seguindo o padrão visual do KPICard do design system ANEST
 */
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock } from 'lucide-react';

export function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, color = '#004225' }) {
  const isPositive = trend === 'up';

  // Background colors based on accent color
  const getAccentBg = () => {
    switch (color) {
      case '#34C759': return 'bg-[#E8F5E9] dark:bg-[#1E3A2F]';
      case '#DC2626': return 'bg-[#FFEBEE] dark:bg-[#3F1E1E]';
      case '#F59E0B': return 'bg-[#FFF3E0] dark:bg-[#3F2E1E]';
      default: return 'bg-[#E8F5E9] dark:bg-[#1E3A2F]';
    }
  };

  const getIconColor = () => {
    switch (color) {
      case '#34C759': return 'text-[#006837] dark:text-[#2ECC71]';
      case '#DC2626': return 'text-[#C62828] dark:text-[#E74C3C]';
      case '#F59E0B': return 'text-[#E65100] dark:text-[#F59E0B]';
      default: return 'text-[#006837] dark:text-[#2ECC71]';
    }
  };

  return (
    <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none">
      {/* Header: Icon + Trend */}
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getAccentBg()}`}>
            <Icon className={`w-5 h-5 ${getIconColor()}`} />
          </div>
        )}
        {trend && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-[#34C759]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#DC2626]" />
            )}
            <span className={`text-[11px] font-semibold ${isPositive ? 'text-[#34C759]' : 'text-[#DC2626]'}`}>
              {trendValue}%
            </span>
          </div>
        )}
      </div>

      {/* Title + Value */}
      <div className="space-y-1">
        <p className="text-[12px] font-medium text-[#6B7280] dark:text-[#A3B8B0]">{title}</p>
        <p className="text-[20px] font-bold text-[#004225] dark:text-white leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B8178]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function FaturamentoStats({ stats, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        title="Produzido"
        value={stats.produzidoFormatado || 'R$ 0,00'}
        subtitle="Este mês"
        icon={DollarSign}
        trend={stats.produzido?.variacao > 0 ? 'up' : stats.produzido?.variacao < 0 ? 'down' : null}
        trendValue={Math.abs(stats.produzido?.variacao || 0).toFixed(1)}
        color="#004225"
      />

      <StatCard
        title="Recebido"
        value={stats.recebidoFormatado || 'R$ 0,00'}
        subtitle="Este mês"
        icon={TrendingUp}
        trend={stats.recebido?.variacao > 0 ? 'up' : stats.recebido?.variacao < 0 ? 'down' : null}
        trendValue={Math.abs(stats.recebido?.variacao || 0).toFixed(1)}
        color="#34C759"
      />

      <StatCard
        title="Glosas"
        value={stats.glosasFormatado || 'R$ 0,00'}
        subtitle={`${stats.glosas?.percentual?.toFixed(1) || 0}% do total`}
        icon={AlertTriangle}
        color="#DC2626"
      />

      <StatCard
        title="Over"
        value={stats.overFormatado || 'R$ 0,00'}
        subtitle="A receber"
        icon={Clock}
        color="#F59E0B"
      />
    </div>
  );
}

export function FaturamentoQuickStats({ stats }) {
  if (!stats) return null;

  const items = [
    { value: stats.eventosAbertos || 0, label: 'Eventos', color: '#004225' },
    { value: stats.notasPendentes || 0, label: 'Notas', color: '#F59E0B' },
    { value: stats.lotesPendentes || 0, label: 'Lotes', color: '#2E8B57' },
    { value: stats.recursosAbertos || 0, label: 'Recursos', color: '#DC2626' },
  ];

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-[#004225] dark:text-white mb-3">
        Resumo Rápido
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center p-3 bg-white dark:bg-[#1A2420] rounded-xl border border-[#A5D6A7] dark:border-[#2A3F36] min-h-[70px]"
          >
            <p
              className="text-[18px] font-bold leading-none"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] mt-1 text-center">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FaturamentoStats;
