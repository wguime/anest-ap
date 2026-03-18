// DataDisplayShowcase.jsx
// Showcase visual dos componentes de exibição de dados - Fase 6

import { useState } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  BarChart3,
  Target,
  Stethoscope,
  Shield,
  HeartPulse,
  Syringe,
  ClipboardCheck,
  FileCheck,
} from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';

// Components
import { Table } from '../components/ui/table';
import { DataGrid } from '../components/ui/data-grid';
import { Calendar } from '../components/ui/calendar';
import { Timeline, TimelineItem } from '../components/ui/timeline';
import { DonutChart } from '../components/ui/donut-chart';
import { KPICard } from '../components/anest/kpi-card';
import { KPIDataProvider, useKPIData, KPIEditor } from '../components/anest';
import { Badge } from '../components/ui/badge';

// ============================================================================
// DADOS DE EXEMPLO
// ============================================================================

const TABLE_DATA = [
  { id: 1, name: 'João Silva', email: 'joao@hospital.com', role: 'Anestesiologista', status: 'Ativo', lastAccess: '2025-12-28' },
  { id: 2, name: 'Maria Santos', email: 'maria@hospital.com', role: 'Coordenador', status: 'Ativo', lastAccess: '2025-12-28' },
  { id: 3, name: 'Pedro Costa', email: 'pedro@hospital.com', role: 'Médico Residente', status: 'Férias', lastAccess: '2025-12-20' },
  { id: 4, name: 'Ana Oliveira', email: 'ana@hospital.com', role: 'Anestesiologista', status: 'Ativo', lastAccess: '2025-12-27' },
  { id: 5, name: 'Carlos Lima', email: 'carlos@hospital.com', role: 'Médico Residente', status: 'Inativo', lastAccess: '2025-12-15' },
  { id: 6, name: 'Beatriz Alves', email: 'beatriz@hospital.com', role: 'Enfermeiro', status: 'Ativo', lastAccess: '2025-12-28' },
  { id: 7, name: 'Ricardo Ferreira', email: 'ricardo@hospital.com', role: 'Anestesiologista', status: 'Ativo', lastAccess: '2025-12-26' },
  { id: 8, name: 'Fernanda Souza', email: 'fernanda@hospital.com', role: 'Coordenador', status: 'Licença', lastAccess: '2025-12-10' },
];

const TABLE_COLUMNS = [
  { key: 'name', header: 'Nome', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'role', header: 'Cargo', sortable: true },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (value) => {
      const variants = {
        Ativo: 'success',
        Inativo: 'destructive',
        Férias: 'warning',
        Licença: 'default',
      };
      return <Badge variant={variants[value] || 'default'}>{value}</Badge>;
    },
  },
  { key: 'lastAccess', header: 'Último Acesso', sortable: true },
];

const CALENDAR_EVENTS = [
  { date: new Date(2025, 11, 25), label: 'Natal', color: '#DC2626' },
  { date: new Date(2025, 11, 31), label: 'Ano Novo', color: '#F59E0B' },
  { date: new Date(2025, 11, 28), label: 'Plantão João', color: '#006837' },
  { date: new Date(2025, 11, 29), label: 'Reunião Equipe', color: '#3B82F6' },
  { date: new Date(2025, 11, 30), label: 'Treinamento', color: '#8B5CF6' },
];

const TIMELINE_ITEMS = [
  { title: 'Pedido recebido', description: 'Solicitação de exame registrada', status: 'completed', timestamp: '08:00' },
  { title: 'Em análise', description: 'Equipe avaliando a solicitação', status: 'completed', timestamp: '09:30' },
  { title: 'Aprovado', description: 'Exame aprovado pelo coordenador', status: 'completed', timestamp: '10:15' },
  { title: 'Agendamento', description: 'Aguardando confirmação da data', status: 'active', timestamp: '11:00' },
  { title: 'Realização', description: 'Exame será realizado', status: 'pending' },
  { title: 'Resultado', description: 'Laudo disponível em até 48h', status: 'pending' },
];

const BAR_CHART_DATA = [
  { label: 'Jan', value: 120 },
  { label: 'Fev', value: 180 },
  { label: 'Mar', value: 150 },
  { label: 'Abr', value: 220 },
  { label: 'Mai', value: 190 },
  { label: 'Jun', value: 250 },
];

const DONUT_CHART_DATA = [
  { label: 'Cultura de Segurança', value: 35, color: '#006837' },
  { label: 'Comunicação', value: 25, color: '#3B82F6' },
  { label: 'Medicamentos', value: 20, color: '#F59E0B' },
  { label: 'Infecções', value: 15, color: '#EC4899' },
  { label: 'Outros', value: 5, color: '#6B7280' },
];

const LINE_CHART_DATA = [
  { label: 'Jan', value: 65 },
  { label: 'Fev', value: 72 },
  { label: 'Mar', value: 68 },
  { label: 'Abr', value: 85 },
  { label: 'Mai', value: 78 },
  { label: 'Jun', value: 92 },
];

const SPARKLINE_DATA = [10, 25, 18, 30, 22, 35, 28, 42, 38, 45];

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function ShowcaseSection({ title, description, children, fullWidth = false }) {
  const { isDark } = useTheme();

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3
        style={{
          fontSize: '18px',
          fontWeight: 700,
          marginBottom: '8px',
          color: isDark ? '#FFFFFF' : '#000000',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '14px',
            color: isDark ? '#A3B8B0' : '#6B7280',
            marginBottom: '16px',
          }}
        >
          {description}
        </p>
      )}
      <div
        className={fullWidth ? 'rounded-xl md:rounded-2xl overflow-hidden' : 'p-4 md:p-6 rounded-xl md:rounded-2xl overflow-hidden'}
        style={{
          background: isDark ? '#1A2420' : '#E8F5E9',
          border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PropsTable({ props }) {
  const { isDark } = useTheme();

  return (
    <div style={{ marginTop: '16px', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${isDark ? '#2A3F36' : '#C8E6C9'}` }}>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: isDark ? '#A3B8B0' : '#6B7280' }}>
              Prop
            </th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: isDark ? '#A3B8B0' : '#6B7280' }}>
              Tipo
            </th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: isDark ? '#A3B8B0' : '#6B7280' }}>
              Descrição
            </th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${isDark ? '#2A3F36' : '#C8E6C9'}` }}>
              <td style={{ padding: '8px', fontFamily: 'monospace', color: isDark ? '#2ECC71' : '#006837' }}>
                {prop.name}
              </td>
              <td style={{ padding: '8px', color: isDark ? '#6B8178' : '#9CA3AF' }}>
                {prop.type}
              </td>
              <td style={{ padding: '8px', color: isDark ? '#FFFFFF' : '#000000' }}>
                {prop.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// SHOWCASES
// ============================================================================

function TableShowcase() {
  const { isDark } = useTheme();
  const [mobileMode, setMobileMode] = useState('auto');

  return (
    <ShowcaseSection
      title="📋 Table"
      description="Tabela com ordenação, busca integrada e layouts mobile adaptativos"
    >
      {/* Mobile Layout Selector */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2" style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}>
          Layout Mobile
        </h4>
        <div className="flex flex-wrap gap-2">
          {['auto', 'scroll', 'cards', 'accordion'].map((mode) => (
            <button
              key={mode}
              onClick={() => setMobileMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                mobileMode === mode
                  ? 'bg-primary text-white dark:bg-primary dark:text-foreground'
                  : 'bg-card dark:bg-muted text-muted-foreground'
              }`}
            >
              {mode === 'auto' ? '🔄 Auto' : mode === 'scroll' ? '↔️ Scroll' : mode === 'cards' ? '📱 Cards' : '📂 Accordion'}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: isDark ? '#6B8178' : '#9CA3AF' }}>
          {mobileMode === 'auto' && 'Automaticamente usa Cards no mobile e Scroll no desktop'}
          {mobileMode === 'scroll' && 'Mantém tabela tradicional com scroll horizontal'}
          {mobileMode === 'cards' && 'Cada linha vira um card empilhado verticalmente'}
          {mobileMode === 'accordion' && 'Mostra colunas principais e expande para ver detalhes'}
        </p>
      </div>

      <Table
        columns={TABLE_COLUMNS}
        data={TABLE_DATA}
        searchable
        searchPlaceholder="Buscar usuários..."
        onRowClick={(row) => alert(`Clicou em: ${row.name}`)}
        striped
        mobileLayout={mobileMode}
        accordionPrimaryColumns={2}
      />

      <PropsTable
        props={[
          { name: 'columns', type: 'array', description: 'Array de { key, header, sortable, render }' },
          { name: 'data', type: 'array', description: 'Array de objetos com os dados' },
          { name: 'searchable', type: 'boolean', description: 'Habilita busca global' },
          { name: 'sortable', type: 'boolean', description: 'Habilita ordenação' },
          { name: 'selectable', type: 'boolean', description: 'Habilita seleção de linhas' },
          { name: 'striped', type: 'boolean', description: 'Alterna cores das linhas' },
          { name: 'loading', type: 'boolean', description: 'Exibe skeleton de loading' },
          { name: 'onRowClick', type: 'function', description: 'Callback ao clicar em linha' },
          { name: 'mobileLayout', type: 'string', description: "'auto' | 'scroll' | 'cards' | 'accordion'" },
          { name: 'mobileBreakpoint', type: 'number', description: 'Breakpoint em px (padrão: 640)' },
          { name: 'accordionPrimaryColumns', type: 'number', description: 'Colunas visíveis no accordion (padrão: 2)' },
        ]}
      />
    </ShowcaseSection>
  );
}

function DataGridShowcase() {
  const { isDark } = useTheme();
  const [mobileMode, setMobileMode] = useState('auto');

  return (
    <ShowcaseSection
      title="📊 DataGrid"
      description="Grid avançado com filtros, paginação, ações em lote e layouts mobile"
    >
      {/* Mobile Layout Selector */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2" style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}>
          Layout Mobile
        </h4>
        <div className="flex flex-wrap gap-2">
          {['auto', 'scroll', 'cards', 'accordion'].map((mode) => (
            <button
              key={mode}
              onClick={() => setMobileMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                mobileMode === mode
                  ? 'bg-primary text-white dark:bg-primary dark:text-foreground'
                  : 'bg-card dark:bg-muted text-muted-foreground'
              }`}
            >
              {mode === 'auto' ? '🔄 Auto' : mode === 'scroll' ? '↔️ Scroll' : mode === 'cards' ? '📱 Cards' : '📂 Accordion'}
            </button>
          ))}
        </div>
      </div>

      <DataGrid
        columns={TABLE_COLUMNS}
        data={TABLE_DATA}
        searchable
        filterable
        paginated
        pageSize={5}
        selectable
        mobileLayout={mobileMode}
        accordionPrimaryColumns={2}
        onRefresh={() => alert('Atualizar dados')}
        onExport={(data) => alert(`Exportar ${data.length} registros`)}
        bulkActions={[
          { label: 'Excluir', icon: <AlertTriangle className="h-4 w-4" />, onClick: (rows) => alert(`Excluir ${rows.length}`) },
        ]}
      />

      <PropsTable
        props={[
          { name: 'columns', type: 'array', description: 'Colunas da tabela' },
          { name: 'data', type: 'array', description: 'Dados' },
          { name: 'searchable', type: 'boolean', description: 'Busca global' },
          { name: 'filterable', type: 'boolean', description: 'Filtros por coluna' },
          { name: 'paginated', type: 'boolean', description: 'Paginação' },
          { name: 'pageSize', type: 'number', description: 'Itens por página' },
          { name: 'selectable', type: 'boolean', description: 'Seleção de linhas' },
          { name: 'bulkActions', type: 'array', description: 'Ações em lote' },
          { name: 'onRefresh', type: 'function', description: 'Callback atualizar' },
          { name: 'onExport', type: 'function', description: 'Callback exportar' },
          { name: 'mobileLayout', type: 'string', description: "'auto' | 'scroll' | 'cards' | 'accordion'" },
          { name: 'mobileBreakpoint', type: 'number', description: 'Breakpoint em px (padrão: 640)' },
          { name: 'accordionPrimaryColumns', type: 'number', description: 'Colunas no accordion (padrão: 2)' },
        ]}
      />
    </ShowcaseSection>
  );
}

function CalendarShowcase() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <ShowcaseSection
      title="📅 Calendar"
      description="Calendário com eventos e seleção de datas"
    >
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Calendar
          selected={selectedDate}
          onSelect={setSelectedDate}
          events={CALENDAR_EVENTS}
        />

        <div style={{ flex: 1, minWidth: '250px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Data selecionada:
          </h4>
          <p style={{ fontSize: '16px', fontWeight: 700 }}>
            {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'selected', type: 'Date', description: 'Data selecionada' },
          { name: 'onSelect', type: 'function', description: 'Callback ao selecionar' },
          { name: 'events', type: 'array', description: 'Array de { date, label, color }' },
          { name: 'minDate', type: 'Date', description: 'Data mínima' },
          { name: 'maxDate', type: 'Date', description: 'Data máxima' },
          { name: 'disabledDates', type: 'Date[]', description: 'Datas desabilitadas' },
          { name: 'weekStartsOn', type: 'number', description: '0=Dom, 1=Seg' },
        ]}
      />
    </ShowcaseSection>
  );
}

function TimelineShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="⏱️ Timeline"
      description="Linha do tempo com status e animações"
    >
      <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-2">
        {/* Vertical */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Vertical (padrão)
          </h4>
          <Timeline items={TIMELINE_ITEMS} />
        </div>

        {/* Horizontal */}
        <div className="overflow-x-auto">
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Horizontal
          </h4>
          <Timeline
            items={TIMELINE_ITEMS.slice(0, 4)}
            orientation="horizontal"
            size="sm"
          />
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'items', type: 'array', description: 'Array de { title, description, status, timestamp }' },
          { name: 'orientation', type: "'vertical' | 'horizontal'", description: 'Orientação' },
          { name: 'size', type: "'sm' | 'default' | 'lg'", description: 'Tamanho' },
          { name: 'animated', type: 'boolean', description: 'Animações' },
        ]}
      />
    </ShowcaseSection>
  );
}

function ChartsShowcase() {
  const { isDark } = useTheme();

  // Professional color palette (Carbon/shadcn inspired, WCAG compliant)
  const statusData = [
    { label: 'Concluído', value: 72 },
    { label: 'Pendente', value: 28 },
  ];

  const departmentData = [
    { label: 'UTI', value: 35 },
    { label: 'Centro Cirúrgico', value: 28 },
    { label: 'Ambulatório', value: 22 },
    { label: 'Enfermaria', value: 15 },
  ];

  const analysisData = [
    { label: 'Cultura de Segurança', value: 32 },
    { label: 'Comunicação', value: 26 },
    { label: 'Medicamentos', value: 22 },
    { label: 'Infecções', value: 12 },
    { label: 'Riscos', value: 8 },
  ];

  return (
    <ShowcaseSection
      title="📈 Charts"
      description="Gráficos profissionais com animações spring e cores acessíveis"
    >
      {/* Donut Charts - Size Variants */}
      <div style={{ marginBottom: '48px' }}>
        <h4 style={{
          fontSize: '15px',
          fontWeight: 600,
          marginBottom: '6px',
          color: isDark ? '#FFFFFF' : '#18181B'
        }}>
          DonutChart
        </h4>
        <p style={{
          fontSize: '12px',
          color: isDark ? '#A1A1AA' : '#71717A',
          marginBottom: '24px'
        }}>
          Baseado em Adobe Spectrum, Carbon Design System e shadcn/ui
        </p>

        {/* Size Comparison - Clean Layout */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 items-start justify-items-center gap-8 lg:gap-6 p-4 md:p-8 rounded-xl md:rounded-2xl mb-6"
          style={{
          background: isDark ? '#09090B' : '#FAFAFA',
          }}
        >
          {/* Small */}
          <div className="flex flex-col items-center min-w-0">
            <DonutChart
              data={statusData}
              size="sm"
              showLegend={false}
              totalLabel="Status"
            />
            <div style={{ marginTop: '12px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: isDark ? '#71717A' : '#A1A1AA',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                SM • 160px
              </span>
            </div>
          </div>

          {/* Medium */}
          <div className="flex flex-col items-center relative min-w-0">
              <span style={{
                position: 'absolute',
                top: '-8px',
              right: 'calc(50% - 90px)',
                background: isDark ? '#2DD4BF' : '#0F766E',
                color: isDark ? '#09090B' : '#FFFFFF',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 700,
              textTransform: 'uppercase',
              zIndex: 10
              }}>
                Padrão
              </span>
            <DonutChart
              data={departmentData}
              size="md"
              showLegend={false}
              totalLabel="Total"
            />
            <div style={{ marginTop: '12px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: isDark ? '#71717A' : '#A1A1AA',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                MD • 180px
              </span>
            </div>
          </div>

          {/* Large */}
          <div className="flex flex-col items-center min-w-0">
            <DonutChart
              data={analysisData}
              size="lg"
              showLegend={false}
              totalLabel="ROPs"
            />
            <div style={{ marginTop: '12px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: isDark ? '#71717A' : '#A1A1AA',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                LG • 220px
              </span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {[
            'Spring animation',
            'WCAG 3:1+ contrast',
            'Keyboard nav',
            'Max 5 segments'
          ].map((feature, i) => (
            <span key={i} style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: isDark ? '#27272A' : '#F4F4F5',
              color: isDark ? '#A1A1AA' : '#71717A'
            }}>
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* With Legend Examples - New Design */}
      <div style={{ marginBottom: '32px' }}>
        <h4 style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
          color: isDark ? '#A1A1AA' : '#71717A'
        }}>
          Com Legenda Interativa
        </h4>
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 md:p-6 rounded-xl md:rounded-2xl"
          style={{
          background: isDark ? '#09090B' : '#FAFAFA',
          }}
        >
          <div className="flex justify-center min-w-0">
            <DonutChart
              data={departmentData}
              size="md"
              totalLabel="Por Setor"
            />
          </div>
          <div className="flex justify-center min-w-0">
            <DonutChart
              data={analysisData}
              size="lg"
              totalLabel="Análise ROPs"
            />
          </div>
        </div>
      </div>

      {/* NOTE: Other chart components (SimpleLineChart, SimpleBarChart, SparklineChart, CircularProgress, SimpleAreaChart) 
          were replaced by shadcn/ui charts. Use Recharts directly with ChartContainer for these visualizations. */}

      <PropsTable
        props={[
          { name: 'data', type: 'array', description: 'Array de { label, value, color? }' },
          { name: 'title', type: 'string', description: 'Título do gráfico' },
          { name: 'subtitle', type: 'string', description: 'Subtítulo (DonutChart)' },
          { name: 'size', type: "'sm' | 'md' | 'lg' | number", description: 'Tamanho do gráfico' },
          { name: 'legendPosition', type: "'bottom' | 'right'", description: 'Posição da legenda (DonutChart)' },
          { name: 'series', type: 'array', description: 'Múltiplas séries { key, color, label } (AreaChart)' },
          { name: 'gradient', type: 'boolean', description: 'Usar gradiente (CircularProgress)' },
          { name: 'showYAxis', type: 'boolean', description: 'Exibe eixo Y com valores (LineChart)' },
          { name: 'smooth', type: 'boolean', description: 'Linhas suaves com curvas bezier (LineChart)' },
          { name: 'horizontal', type: 'boolean', description: 'Barras horizontais (BarChart)' },
          { name: 'interactive', type: 'boolean', description: 'Hover e clique nos segmentos' },
          { name: 'onSegmentClick', type: 'function', description: 'Callback ao clicar em segmento' },
          { name: 'formatValue', type: 'function', description: 'Função custom para formatar valores' },
        ]}
      />
    </ShowcaseSection>
  );
}

// Ícones para cada KPI (mapeamento por ID)
const kpiIcons = {
  'taxa-infeccao': <Shield />,
  'satisfacao-paciente': <HeartPulse />,
  'adesao-checklist': <ClipboardCheck />,
  'tempo-espera': <Clock />,
  'higiene-maos': <Activity />,
  'eventos-adversos': <FileCheck />,
};

// Componente interno que consome o contexto
function KPICardShowcaseContent() {
  const { isDark } = useTheme();
  const { kpis } = useKPIData();

  return (
    <>
      {/* Editor de KPIs */}
      <ShowcaseSection
        title="Editor de Indicadores"
        description="Edite os dados dos KPIs - as alterações refletem nos cards abaixo"
      >
        <KPIEditor />
      </ShowcaseSection>

      <ShowcaseSection
        title="KPICard"
        description="Cards de Indicadores de Qualidade - Dados vêm do KPIDataContext (clique para ver detalhes)"
      >
        {/* KPI Cards from Context */}
        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
          Indicadores (dados do KPIDataProvider)
        </h4>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 mb-8">
          {kpis.map((kpi) => (
            <KPICard
              key={kpi.id}
              titulo={kpi.titulo}
              valor={kpi.valor}
              meta={kpi.meta}
              metaLabel={kpi.metaLabel}
              unidade={kpi.unidade}
              periodo={kpi.periodo}
              icon={kpiIcons[kpi.id] || <Target />}
              accentColor={kpi.accentColor}
              isLowerBetter={kpi.isLowerBetter}
              historico={kpi.historico}
              mesesLabels={kpi.mesesLabels}
            />
          ))}
        </div>

        {/* Exemplo de KPI estático para referência */}
        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
          Exemplo Estático (sem contexto)
        </h4>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 mb-8">
          <KPICard
            titulo="Indicador Manual"
            valor={85}
            meta={80}
            metaLabel="≥80%"
            unidade="%"
            periodo="Dezembro"
            icon={<BarChart3 />}
            accentColor="green"
            isLowerBetter={false}
            descricao="Este card não usa o contexto"
          />
        </div>

        <PropsTable
          props={[
            { name: 'titulo', type: 'string', description: 'Título do indicador' },
            { name: 'valor', type: 'number', description: 'Valor atual do KPI' },
            { name: 'meta', type: 'number', description: 'Valor numérico da meta' },
            { name: 'metaLabel', type: 'string', description: 'Label da meta (ex: ≥95%, ≤2%)' },
            { name: 'unidade', type: 'string', description: 'Unidade de medida (%, pontos, etc)' },
            { name: 'periodo', type: 'string', description: 'Mês base do indicador' },
            { name: 'icon', type: 'ReactNode', description: 'Ícone Lucide' },
            { name: 'accentColor', type: "'green' | 'blue' | 'orange' | 'red' | 'purple' | 'cyan'", description: 'Cor do fundo do ícone' },
            { name: 'status', type: "'conforme' | 'parcial' | 'nao-conforme'", description: 'Status manual (calculado automaticamente se não passar)' },
            { name: 'isLowerBetter', type: 'boolean', description: 'true = menor é melhor (ex: taxa de infecção)' },
            { name: 'tendencia', type: "'up' | 'down' | 'stable'", description: 'Tendência do indicador' },
            { name: 'historico', type: 'number[]', description: 'Array com valores mensais (habilita modal)' },
            { name: 'mesesLabels', type: 'string[]', description: 'Labels dos meses para o gráfico' },
            { name: 'descricao', type: 'string', description: 'Descrição adicional' },
            { name: 'onClick', type: 'function', description: 'Callback customizado ao clicar' },
          ]}
        />
      </ShowcaseSection>
    </>
  );
}

// Wrapper que provê o contexto
function KPICardShowcase() {
  return (
    <KPIDataProvider>
      <KPICardShowcaseContent />
    </KPIDataProvider>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function DataDisplayShowcase() {
  const { isDark } = useTheme();

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? '#111916' : '#F0FFF4',
        minHeight: '100vh',
        color: isDark ? '#FFFFFF' : '#000000',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        📊 Data Display
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: isDark ? '#A3B8B0' : '#6B7280',
          marginBottom: '16px',
        }}
      >
        {isDark ? 'Dark Mode' : 'Light Mode'} - Componentes para exibição de dados
      </p>

      {/* Badge de versão */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '20px',
          background: isDark ? '#243530' : '#FFFFFF',
          marginBottom: '32px',
          fontSize: '13px',
          fontWeight: 600,
          color: isDark ? '#2ECC71' : '#006837',
        }}
      >
        ✨ Fase 6 Completa - 6 novos componentes
      </div>

      <TableShowcase />
      <DataGridShowcase />
      <CalendarShowcase />
      <TimelineShowcase />
      <ChartsShowcase />
      <KPICardShowcase />
    </div>
  );
}

export default DataDisplayShowcase;
