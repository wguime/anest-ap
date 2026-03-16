// PlantoesShowcase.jsx
// Showcase dos componentes de Plantoes e Ferias integrados com API Pega Plantao

import { useState } from 'react';
import {
  Calendar,
  User,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  Palmtree,
} from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';
import { PlantaoCard } from '../components/anest/plantao-card';
import { PlantaoListItem } from '../components/anest/plantao-list-item';
import { FeriasCard } from '../components/anest/ferias-card';
import { FeriasListItem } from '../components/anest/ferias-list-item';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

// ============================================================================
// DADOS DE EXEMPLO
// ============================================================================

const MOCK_PLANTOES = [
  { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00' },
  { hospital: 'Hospital Sao Lucas', data: 'Terca, 17 Dez', hora: '19:00' },
  { hospital: 'Hospital Regional', data: 'Quinta, 19 Dez', hora: '07:00' },
  { hospital: 'Hospital Municipal', data: 'Sabado, 21 Dez', hora: '13:00' },
  { hospital: 'Hospital Universitario', data: 'Domingo, 22 Dez', hora: '07:00' },
];

const MOCK_FERIAS = [
  { nome: 'Dr. Carlos Silva', periodo: '20/12 - 05/01' },
  { nome: 'Dra. Ana Costa', periodo: '23/12 - 10/01' },
  { nome: 'Dr. Pedro Santos', periodo: '26/12 - 08/01' },
  { nome: 'Dra. Maria Oliveira', periodo: '27/12 - 12/01' },
];

// ============================================================================
// TOKENS DE DESIGN
// ============================================================================

const TOKENS = {
  light: {
    background: { primary: '#F0FFF4', cardHighlight: '#E8F5E9' },
    green: { dark: '#004225', medium: '#006837' },
    text: { primary: '#000000', secondary: '#6B7280', muted: '#9CA3AF' },
    border: { default: '#A5D6A7' },
    status: { success: '#34C759', warning: '#F59E0B', error: '#DC2626' },
  },
  dark: {
    background: { primary: '#111916', cardHighlight: '#212D28' },
    green: { primary: '#2ECC71', muted: '#1E8449' },
    text: { primary: '#FFFFFF', secondary: '#A3B8B0', muted: '#6B8178' },
    border: { default: '#2A3F36' },
    status: { success: '#2ECC71', warning: '#F39C12', error: '#E74C3C' },
  },
};

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function ShowcaseSection({ title, icon: Icon, description, children }) {
  const { isDark } = useTheme();
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2 flex items-center gap-2"
        style={{ color: tokens.text.primary }}
      >
        {Icon && <Icon className="w-5 h-5" style={{ color: isDark ? tokens.green.primary : tokens.green.medium }} />}
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-3 md:mb-4" style={{ color: tokens.text.secondary }}>
          {description}
        </p>
      )}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: tokens.background.cardHighlight,
          border: `1px solid ${tokens.border.default}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function APIStatusBadge({ isConnected, usandoMock }) {
  if (usandoMock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" />
        Dados Mock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" />
      API Conectada
    </span>
  );
}

function PropsTable({ props }) {
  const { isDark } = useTheme();
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="hidden md:block mt-4 overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: tokens.text.secondary }}>Prop</th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: tokens.text.secondary }}>Tipo</th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: tokens.text.secondary }}>Descricao</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
              <td style={{ padding: '8px', fontFamily: 'monospace', color: isDark ? tokens.green.primary : tokens.green.medium }}>{prop.name}</td>
              <td style={{ padding: '8px', color: tokens.text.muted }}>{prop.type}</td>
              <td style={{ padding: '8px', color: tokens.text.primary }}>{prop.description}</td>
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

function PlantaoCardShowcase() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <ShowcaseSection
      title="PlantaoCard"
      icon={Calendar}
      description="Card wrapper que agrupa lista de plantoes com header, badge e acoes. Integrado com API Pega Plantao."
    >
      <div className="flex items-center gap-2 mb-4">
        <APIStatusBadge usandoMock={true} />
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="flex items-center gap-1">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        <PlantaoCard
          title="Plantoes"
          subtitle="HOJE"
          items={MOCK_PLANTOES.slice(0, 4)}
          onViewAll={() => alert('Ver todos plantoes')}
          onItemClick={(item) => alert(`Plantao: ${item.hospital}`)}
        />

        <PlantaoCard
          title="Plantoes"
          subtitle="CONFIRMADOS"
          items={MOCK_PLANTOES.slice(0, 2)}
          variant="highlight"
        />

        <PlantaoCard
          title="Plantoes"
          subtitle="PROXIMA SEMANA"
          items={[]}
        />
      </div>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Titulo do card' },
          { name: 'subtitle', type: 'string', description: 'Subtitulo/label superior' },
          { name: 'items', type: 'array', description: 'Array de { hospital, data, hora }' },
          { name: 'maxItems', type: 'number', description: 'Maximo de itens exibidos (default: 4)' },
          { name: 'onViewAll', type: 'function', description: 'Callback para ver todos' },
          { name: 'onItemClick', type: 'function', description: 'Callback ao clicar em item' },
          { name: 'variant', type: "'default' | 'highlight'", description: 'Variante visual' },
        ]}
      />
    </ShowcaseSection>
  );
}

function PlantaoListItemShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="PlantaoListItem"
      icon={Clock}
      description="Item individual de plantao com icone Calendar e cores variadas"
    >
      <div className="max-w-md bg-white dark:bg-[#1A2420] rounded-xl p-4">
        {MOCK_PLANTOES.map((plantao, i) => (
          <PlantaoListItem
            key={i}
            hospital={plantao.hospital}
            data={plantao.data}
            hora={plantao.hora}
            index={i}
            isLast={i === MOCK_PLANTOES.length - 1}
            onClick={() => alert(`Plantao: ${plantao.hospital}`)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'hospital', type: 'string', description: 'Nome do hospital/local' },
          { name: 'data', type: 'string', description: 'Data formatada' },
          { name: 'hora', type: 'string', description: 'Horario do plantao' },
          { name: 'index', type: 'number', description: 'Indice para cor de fundo variada' },
          { name: 'bgColor', type: 'string', description: 'Cor de fundo customizada' },
          { name: 'isLast', type: 'boolean', description: 'Se e o ultimo item' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
        ]}
      />
    </ShowcaseSection>
  );
}

function FeriasCardShowcase() {
  return (
    <ShowcaseSection
      title="FeriasCard"
      icon={Palmtree}
      description="Card wrapper para lista de ferias/licencas. Integrado com API Pega Plantao (afastamentos)."
    >
      <div className="flex items-center gap-2 mb-4">
        <APIStatusBadge usandoMock={true} />
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        <FeriasCard
          title="Ferias Programadas"
          subtitle="EQUIPE"
          items={MOCK_FERIAS}
          onViewAll={() => alert('Ver todas as ferias')}
          onItemClick={(item) => alert(`Ferias: ${item.nome}`)}
        />

        <FeriasCard
          title="Licencas"
          subtitle="VIGENTES"
          items={MOCK_FERIAS.slice(0, 1)}
          variant="highlight"
        />

        <FeriasCard
          title="Ferias"
          subtitle="JANEIRO"
          items={[]}
        />
      </div>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Titulo do card' },
          { name: 'subtitle', type: 'string', description: 'Subtitulo/label superior' },
          { name: 'items', type: 'array', description: 'Array de { nome, periodo } ou { nome, inicio, fim }' },
          { name: 'maxItems', type: 'number', description: 'Maximo de itens (default: 3)' },
          { name: 'onViewAll', type: 'function', description: 'Callback para ver todos' },
          { name: 'onItemClick', type: 'function', description: 'Callback ao clicar em item' },
          { name: 'variant', type: "'default' | 'highlight'", description: 'Variante visual' },
        ]}
      />
    </ShowcaseSection>
  );
}

function FeriasListItemShowcase() {
  return (
    <ShowcaseSection
      title="FeriasListItem"
      icon={User}
      description="Item individual de ferias com icone User"
    >
      <div className="max-w-md bg-white dark:bg-[#1A2420] rounded-xl p-4">
        {MOCK_FERIAS.map((ferias, i) => (
          <FeriasListItem
            key={i}
            nome={ferias.nome}
            periodo={ferias.periodo}
            showDivider={i < MOCK_FERIAS.length - 1}
            onClick={() => alert(`Ferias: ${ferias.nome}`)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'nome', type: 'string', description: 'Nome do profissional' },
          { name: 'periodo', type: 'string', description: 'Periodo das ferias' },
          { name: 'showDivider', type: 'boolean', description: 'Mostrar divisor' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
        ]}
      />
    </ShowcaseSection>
  );
}

function LoadingStatesShowcase() {
  const { isDark } = useTheme();
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <ShowcaseSection
      title="Loading States"
      icon={RefreshCw}
      description="Estados de carregamento para os cards de plantoes e ferias"
    >
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Skeleton para Plantoes */}
        <div className="bg-white dark:bg-[#1A2420] rounded-[20px] p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5 py-3.5">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton para Ferias */}
        <div className="bg-white dark:bg-[#1A2420] rounded-[20px] p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5 py-3.5">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShowcaseSection>
  );
}

function APIIntegrationShowcase() {
  const { isDark } = useTheme();
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <ShowcaseSection
      title="Integracao API Pega Plantao"
      icon={Building2}
      description="Diagrama do fluxo de dados entre a API e os componentes"
    >
      <div className="space-y-4 text-sm" style={{ color: tokens.text.primary }}>
        <div className="p-4 rounded-lg bg-white dark:bg-[#1A2420]" style={{ border: `1px solid ${tokens.border.default}` }}>
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Fluxo de Autenticacao
          </h4>
          <ol className="list-decimal list-inside space-y-1" style={{ color: tokens.text.secondary }}>
            <li>App inicia requisicao via hook (usePlantoesHoje)</li>
            <li>TokenManager verifica se token existe e e valido</li>
            <li>Se expirado, tenta refresh com refresh_token</li>
            <li>Se falhar, autentica com Basic Auth (ClientId:ClientSecret)</li>
            <li>Token salvo em sessionStorage (expira em 10 min)</li>
          </ol>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#1A2420]" style={{ border: `1px solid ${tokens.border.default}` }}>
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Sistema de Cache
          </h4>
          <ul className="list-disc list-inside space-y-1" style={{ color: tokens.text.secondary }}>
            <li>TTL: 5 minutos</li>
            <li>Cache em memoria (Map)</li>
            <li>Invalidacao por pattern</li>
            <li>Fallback automatico para mock em caso de erro</li>
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#1A2420]" style={{ border: `1px solid ${tokens.border.default}` }}>
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            Endpoints Utilizados
          </h4>
          <ul className="list-disc list-inside space-y-1 font-mono text-xs" style={{ color: tokens.text.muted }}>
            <li>POST /token - Autenticacao</li>
            <li>GET /api/v1/plantoes - Listar plantoes</li>
            <li>GET /api/v1/profissionais/{'{cod}'}/afastamentos - Ferias/licencas</li>
            <li>GET /api/v1/locais - Listar locais</li>
            <li>GET /api/v1/grupos - Listar grupos</li>
          </ul>
        </div>
      </div>
    </ShowcaseSection>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function PlantoesShowcase() {
  const { isDark } = useTheme();
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: tokens.background.primary,
        minHeight: '100vh',
        color: tokens.text.primary,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Calendar className="w-7 h-7" style={{ color: isDark ? tokens.green.primary : tokens.green.medium }} />
        Plantoes & Ferias
      </h2>
      <p className="text-sm mb-4" style={{ color: tokens.text.secondary }}>
        {isDark ? 'Dark Mode' : 'Light Mode'} - Componentes de plantoes e ferias integrados com API Pega Plantao
      </p>

      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8"
        style={{
          background: tokens.background.cardHighlight,
          color: isDark ? tokens.green.primary : tokens.green.medium,
        }}
      >
        <Calendar className="w-4 h-4" />
        4 componentes - API v1.7
      </div>

      <PlantaoCardShowcase />
      <PlantaoListItemShowcase />
      <FeriasCardShowcase />
      <FeriasListItemShowcase />
      <LoadingStatesShowcase />
      <APIIntegrationShowcase />
    </div>
  );
}

export default PlantoesShowcase;
