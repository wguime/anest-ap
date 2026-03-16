import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  KPICard,
  BottomNav,
  AdminOnly,
  KPIDataProvider,
  useKPIData,
  KPIEditor,
} from '@/design-system/components/anest';
import { Modal, Button } from '@/design-system/components/ui';
import {
  ChevronLeft,
  GraduationCap,
  // Icons for KPIs
  CalendarCheck,
  HeartPulse,
  Clock,
  AlertCircle,
  ArrowLeftRight,
  Building2,
  TrendingUp,
  CheckCircle,
  Skull,
  ClipboardCheck,
  Wind,
  Frown,
  Syringe,
  Timer,
  Pill,
  RotateCcw,
  Brain,
  Thermometer,
  Shield,
  ClipboardList,
  BarChart3,
  Pencil,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import {
  indicadores2025,
  MESES_LABELS,
  ICON_MAP,
  COLOR_MAP,
  parseMeta,
  DATA_YEAR,
} from '@/data/indicadores-2025';

// Mapa de componentes de icones Lucide
const ICON_COMPONENTS = {
  CalendarCheck,
  HeartPulse,
  Clock,
  AlertCircle,
  ArrowLeftRight,
  Building2,
  TrendingUp,
  CheckCircle,
  Skull,
  ClipboardCheck,
  Wind,
  Frown,
  Syringe,
  Timer,
  Pill,
  RotateCcw,
  Brain,
  Thermometer,
  Shield,
  ClipboardList,
};

// Transformar indicadores2025 para o formato do KPIDataProvider
const transformIndicadoresToKPIs = () => {
  return indicadores2025.map((ind) => {
    const metaParsed = parseMeta(ind.metaLabel);
    const isLowerBetter = ['<=', '<', 'zero', 'ratioMax'].includes(metaParsed.op);

    // Encontrar o último valor não-null e seu índice
    let lastValidValue = null;
    let lastValidIndex = -1;
    for (let i = ind.meses.length - 1; i >= 0; i--) {
      if (ind.meses[i] !== null && ind.meses[i] !== undefined) {
        lastValidValue = ind.meses[i];
        lastValidIndex = i;
        break;
      }
    }

    // Determinar o período baseado no último mês com dados
    const periodoMes = lastValidIndex >= 0 ? MESES_LABELS[lastValidIndex] : 'N/A';

    return {
      id: ind.id,
      titulo: ind.titulo,
      valor: lastValidValue ?? 0,
      meta: metaParsed.target,
      metaLabel: ind.metaLabel,
      unidade: ind.unidade,
      periodo: periodoMes,
      accentColor: COLOR_MAP[ind.id] || 'green',
      isLowerBetter,
      historico: ind.meses,
      mesesLabels: MESES_LABELS,
    };
  });
};

// Dados iniciais transformados
const initialKPIs = transformIndicadoresToKPIs();

// Meses por extenso para subtítulo
const MESES_EXTENSO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Componente interno que consome o contexto KPI
function PainelGestaoContent({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { user } = useUser();
  const { kpis } = useKPIData();

  // Calcular o range de meses com dados para o subtítulo
  const dataPeriodLabel = useMemo(() => {
    let firstMonth = 11;
    let lastMonth = 0;
    let hasData = false;
    kpis.forEach((kpi) => {
      if (!kpi.historico) return;
      kpi.historico.forEach((val, i) => {
        if (val !== null && val !== undefined) {
          hasData = true;
          if (i < firstMonth) firstMonth = i;
          if (i > lastMonth) lastMonth = i;
        }
      });
    });
    if (!hasData) return '';
    if (firstMonth === lastMonth) return `Dados de ${MESES_EXTENSO[firstMonth]}`;
    return `Dados de ${MESES_EXTENSO[firstMonth]} a ${MESES_EXTENSO[lastMonth]}`;
  }, [kpis]);

  // Processar KPIs para exibição
  const processedKPIs = useMemo(() => {
    return kpis.map((kpi) => {
      const iconName = ICON_MAP[kpi.id];
      const IconComponent = ICON_COMPONENTS[iconName] || TrendingUp;

      // Calcular status
      let status = 'conforme';
      if (kpi.isLowerBetter) {
        if (kpi.valor > kpi.meta * 1.1) status = 'nao-conforme';
        else if (kpi.valor > kpi.meta) status = 'parcial';
      } else {
        if (kpi.valor < kpi.meta * 0.9) status = 'nao-conforme';
        else if (kpi.valor < kpi.meta) status = 'parcial';
      }

      return {
        ...kpi,
        IconComponent,
        status,
      };
    });
  }, [kpis]);

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('qualidade')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Painel de Gestão
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Titulo da secao + acoes admin */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h2 className="text-lg font-bold text-[#004225] dark:text-white mb-1">
                Indicadores de Qualidade {DATA_YEAR}
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
                {kpis.length} KPIs monitorados{dataPeriodLabel ? ` - ${dataPeriodLabel}` : ''}
              </p>
            </div>
          </div>

          {/* Admin action buttons */}
          <AdminOnly user={user}>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('kpiDashboard')}
                leftIcon={<BarChart3 className="w-3.5 h-3.5" />}
              >
                Dashboard KPIs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(true)}
                leftIcon={<Pencil className="w-3.5 h-3.5" />}
              >
                Gerenciar
              </Button>
            </div>
          </AdminOnly>
        </div>

        {/* Grid de KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {processedKPIs.map((kpi) => (
            <KPICard
              key={kpi.id}
              titulo={kpi.titulo}
              valor={kpi.valor}
              meta={kpi.meta}
              metaLabel={kpi.metaLabel}
              unidade={kpi.unidade}
              periodo={kpi.periodo}
              icon={<kpi.IconComponent />}
              accentColor={kpi.accentColor}
              status={kpi.status}
              isLowerBetter={kpi.isLowerBetter}
              historico={kpi.historico}
              mesesLabels={kpi.mesesLabels}
            />
          ))}
        </div>
      </div>

      {/* BottomNav */}
      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]"
                fill="none"
              />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />

      {/* Modal do Gerenciador de Indicadores (Admin) */}
      <Modal
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title="Gerenciador de Indicadores"
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto pb-6">
          <KPIEditor />
        </div>
      </Modal>
    </div>
  );
}

// Componente principal com Provider
export default function PainelGestaoPage({ onNavigate }) {
  return (
    <KPIDataProvider
      initialData={initialKPIs}
      storageKey={`painel-gestao-indicadores-${DATA_YEAR}`}
    >
      <PainelGestaoContent onNavigate={onNavigate} />
    </KPIDataProvider>
  );
}
