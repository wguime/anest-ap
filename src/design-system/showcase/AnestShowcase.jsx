// AnestShowcase.jsx
// Showcase visual dos componentes específicos ANEST - Fase 5.8

import { useState } from 'react';
import {
  Calculator,
  AlertTriangle,
  Wrench,
  Target,
  Settings,
  Heart,
  Activity,
  Stethoscope,
  Syringe,
  Baby,
  Shield,
} from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';

// Componentes base
import { Header } from '../components/anest/header';
import { SearchBar } from '../components/anest/search-bar';
import { ComunicadosCard } from '../components/anest/comunicados-card';
import { QuickLinksGrid } from '../components/anest/quick-links-grid';
import { PlantaoListItem } from '../components/anest/plantao-list-item';
import { FeriasListItem } from '../components/anest/ferias-list-item';
import { SectionCard } from '../components/anest/section-card';
import { BottomNav } from '../components/anest/bottom-nav';

// Novos componentes Fase 5.8
import { NotificationBell } from '../components/anest/notification-bell';
import { PlantaoCard } from '../components/anest/plantao-card';
import { FeriasCard } from '../components/anest/ferias-card';
import { ComunicadoCard } from '../components/anest/comunicado-card';
import { ROPProgressCard } from '../components/anest/rop-progress-card';
import { KPICard } from '../components/anest/kpi-card';
import { CalculadoraCard } from '../components/anest/calculadora-card';

// ============================================================================
// DADOS DE EXEMPLO
// ============================================================================

const COMUNICADOS = [
  'Novo protocolo de sedação pediátrica disponível',
  'Atualização da escala de dezembro publicada',
];

const QUICK_LINKS = [
  { label: 'Calculadoras', icon: <Calculator />, onClick: () => {} },
  { label: 'Reportar', icon: <AlertTriangle />, onClick: () => {} },
  { label: 'Manutenção', icon: <Wrench />, onClick: () => {} },
  { label: 'Desafio ROPs', icon: <Target />, onClick: () => {} },
];

const PLANTOES = [
  { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00' },
  { hospital: 'Hospital São Lucas', data: 'Terça, 17 Dez', hora: '19:00' },
  { hospital: 'Hospital Regional', data: 'Quinta, 19 Dez', hora: '07:00' },
  { hospital: 'Hospital Municipal', data: 'Sábado, 21 Dez', hora: '13:00' },
];

const FERIAS = [
  { nome: 'Dr. Carlos Silva', periodo: '20/12 - 05/01' },
  { nome: 'Dra. Ana Costa', periodo: '23/12 - 10/01' },
  { nome: 'Dr. Pedro Santos', periodo: '26/12 - 08/01' },
];

const NAV_ITEMS = [
  { icon: 'Home', active: true },
  { icon: 'Shield', active: false },
  { icon: 'FileText', active: false },
  { icon: 'Menu', active: false },
];

const COMUNICADOS_LISTA = [
  {
    titulo: 'Novo protocolo de sedação pediátrica',
    resumo: 'Atualização importante sobre os procedimentos de sedação em pacientes pediátricos.',
    data: '28 Dez 2025',
    isNew: true,
    prioridade: 'alta',
  },
  {
    titulo: 'Escala de janeiro publicada',
    resumo: 'A escala de plantões do mês de janeiro já está disponível para consulta.',
    data: '27 Dez 2025',
    isNew: true,
    prioridade: 'normal',
  },
  {
    titulo: 'Manutenção programada',
    resumo: 'O sistema ficará indisponível no dia 02/01 das 02h às 06h para manutenção.',
    data: '25 Dez 2025',
    isNew: false,
    prioridade: 'urgente',
  },
];

const ROPS_PROGRESS = [
  { area: 'Cultura de Segurança', progresso: 85, questoesRespondidas: 17, totalQuestoes: 20, ultimaAtividade: 'Hoje', pontos: 850 },
  { area: 'Comunicação', progresso: 60, questoesRespondidas: 12, totalQuestoes: 20, ultimaAtividade: 'Ontem', pontos: 600 },
  { area: 'Uso de Medicamentos', progresso: 100, questoesRespondidas: 25, totalQuestoes: 25, ultimaAtividade: '3 dias', pontos: 1250, nivel: 'Expert' },
  { area: 'Prevenção de Infecções', progresso: 40, questoesRespondidas: 8, totalQuestoes: 20, ultimaAtividade: '1 semana' },
];

const KPIS = [
  { titulo: 'Taxa de Infecção', valor: 2.3, meta: 3.0, unidade: '%', tendencia: 'down', periodo: 'Dezembro 2025', isLowerBetter: true },
  { titulo: 'Satisfação do Paciente', valor: 92, meta: 85, unidade: '%', tendencia: 'up', periodo: 'Q4 2025', isLowerBetter: false },
  { titulo: 'Tempo Médio de Espera', valor: 18, meta: 15, unidade: 'min', tendencia: 'up', periodo: 'Dezembro 2025', isLowerBetter: true },
  { titulo: 'Taxa de Readmissão', valor: 4.5, meta: 5.0, unidade: '%', tendencia: 'stable', periodo: 'Dezembro 2025', isLowerBetter: true },
];

const CALCULADORAS = [
  { nome: 'Goldman Risk', descricao: 'Risco cardíaco perioperatório', icon: <Heart />, categoria: 'Risco', isFavorite: true, ultimoUso: 'Hoje' },
  { nome: 'MEWS', descricao: 'Modified Early Warning Score', icon: <Activity />, categoria: 'Avaliação', isFavorite: false, ultimoUso: 'Ontem' },
  { nome: 'Escala de Morse', descricao: 'Risco de queda hospitalar', icon: <Shield />, categoria: 'Qmentum', isFavorite: true },
  { nome: 'Apfel Score', descricao: 'Risco de náusea pós-operatória', icon: <Stethoscope />, categoria: 'Anestesia', isFavorite: false },
  { nome: 'Doses Pediátricas', descricao: 'Cálculo de doses por peso', icon: <Baby />, categoria: 'Pediatria', isFavorite: false },
  { nome: 'Diluição de Drogas', descricao: 'Concentração e infusão', icon: <Syringe />, categoria: 'Dosagem', isFavorite: true },
];

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function ShowcaseSection({ title, description, children, fullWidth = false }) {
  const { isDark } = useTheme();

  return (
    <div className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2"
        style={{
          color: isDark ? '#FFFFFF' : '#000000',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mb-3 md:mb-4"
          style={{
            color: isDark ? '#A3B8B0' : '#6B7280',
          }}
        >
          {description}
        </p>
      )}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: isDark ? '#1A2420' : '#E8F5E9',
          padding: fullWidth ? '0' : undefined,
          border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
          overflow: 'visible',
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
    <div className="hidden md:block" style={{ marginTop: '16px', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}`,
            }}
          >
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Prop
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Tipo
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Descrição
            </th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${isDark ? '#2A3F36' : '#F3F4F6'}`,
              }}
            >
              <td
                style={{
                  padding: '8px',
                  fontFamily: 'monospace',
                  color: isDark ? '#2ECC71' : '#006837',
                }}
              >
                {prop.name}
              </td>
              <td
                style={{
                  padding: '8px',
                  color: isDark ? '#6B8178' : '#9CA3AF',
                }}
              >
                {prop.type}
              </td>
              <td
                style={{
                  padding: '8px',
                  color: isDark ? '#FFFFFF' : '#000000',
                }}
              >
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
// SHOWCASES DE COMPONENTES EXISTENTES
// ============================================================================

function HeaderShowcase() {
  return (
    <ShowcaseSection
      title="📌 Header"
      description="Header com saudação, notificações e avatar do usuário"
    >
      <div className="p-2 sm:p-3 md:p-4" style={{ background: 'inherit' }}>
        <Header
          greeting="Olá, Dr. João"
          userName="João Martins"
          notificationCount={5}
          onNotificationClick={() => alert('Notificações!')}
          onAvatarClick={() => alert('Perfil!')}
        />
      </div>

      <PropsTable
        props={[
          { name: 'greeting', type: 'string', description: 'Texto de saudação' },
          { name: 'userName', type: 'string', description: 'Nome para gerar iniciais do avatar' },
          { name: 'notificationCount', type: 'number', description: 'Contador de notificações' },
          { name: 'onNotificationClick', type: 'function', description: 'Callback ao clicar no sino' },
          { name: 'onAvatarClick', type: 'function', description: 'Callback ao clicar no avatar' },
          { name: 'avatarSrc', type: 'string', description: 'URL da imagem do avatar (opcional)' },
        ]}
      />
    </ShowcaseSection>
  );
}

function SearchBarShowcase() {
  const [searchValue, setSearchValue] = useState('');

  return (
    <ShowcaseSection
      title="🔍 SearchBar"
      description="Barra de busca com ícone e estilo iOS"
    >
      <SearchBar
        placeholder="Buscar protocolos, comunicados..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        onSubmit={() => alert(`Buscando: ${searchValue}`)}
      />

      <PropsTable
        props={[
          { name: 'placeholder', type: 'string', description: 'Texto de placeholder' },
          { name: 'value', type: 'string', description: 'Valor controlado' },
          { name: 'onChange', type: 'function', description: 'Callback ao digitar' },
          { name: 'onSubmit', type: 'function', description: 'Callback ao submeter' },
        ]}
      />
    </ShowcaseSection>
  );
}

function ComunicadosCardShowcase() {
  return (
    <ShowcaseSection
      title="📢 ComunicadosCard"
      description="Card destacado para comunicados importantes"
    >
      <ComunicadosCard
        label="ÚLTIMOS"
        title="Comunicados"
        badgeText="3 novos"
        items={COMUNICADOS}
        onViewAll={() => alert('Ver todos comunicados')}
      />

      <PropsTable
        props={[
          { name: 'label', type: 'string', description: 'Label superior (ex: ÚLTIMOS)' },
          { name: 'title', type: 'string', description: 'Título do card' },
          { name: 'badgeText', type: 'string', description: 'Texto do badge' },
          { name: 'items', type: 'string[]', description: 'Lista de comunicados' },
          { name: 'onViewAll', type: 'function', description: 'Callback para ver todos' },
        ]}
      />
    </ShowcaseSection>
  );
}

function QuickLinksGridShowcase() {
  return (
    <ShowcaseSection
      title="⚡ QuickLinksGrid"
      description="Grid de atalhos rápidos estilo iPhone"
    >
      <QuickLinksGrid
        title="Atalhos Rápidos"
        items={QUICK_LINKS}
        onCustomize={() => alert('Personalizar!')}
      />

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Título da seção' },
          { name: 'items', type: 'array', description: 'Array de { label, icon, onClick }' },
          { name: 'onCustomize', type: 'function', description: 'Callback para personalizar' },
        ]}
      />
    </ShowcaseSection>
  );
}

function PlantaoListItemShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="📅 PlantaoListItem"
      description="Item de lista para plantões com ícone Calendar e cores variadas"
    >
      <div className="px-2 sm:px-4">
        {PLANTOES.map((plantao, i) => (
          <PlantaoListItem
            key={i}
            hospital={plantao.hospital}
            data={plantao.data}
            hora={plantao.hora}
            index={i}
            isLast={i === PLANTOES.length - 1}
            onClick={() => alert(`Plantão: ${plantao.hospital}`)}
          />
        ))}
      </div>

      <div
        className="mt-4 pt-4"
        style={{ borderTop: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}` }}
      >
        <PropsTable
          props={[
            { name: 'hospital', type: 'string', description: 'Nome do hospital' },
            { name: 'data', type: 'string', description: 'Data do plantão' },
            { name: 'hora', type: 'string', description: 'Horário do plantão' },
            { name: 'index', type: 'number', description: 'Índice para cor de fundo variada' },
            { name: 'bgColor', type: 'string', description: 'Cor de fundo customizada (sobrescreve index)' },
            { name: 'isLast', type: 'boolean', description: 'Se é o último item (sem divisor)' },
            { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          ]}
        />
      </div>
    </ShowcaseSection>
  );
}

function FeriasListItemShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="🏖️ FeriasListItem"
      description="Item de lista para férias programadas com ícone User"
    >
      <div className="px-2 sm:px-4">
        {FERIAS.map((ferias, i) => (
          <FeriasListItem
            key={i}
            nome={ferias.nome}
            periodo={ferias.periodo}
            isLast={i === FERIAS.length - 1}
            onClick={() => alert(`Férias: ${ferias.nome}`)}
          />
        ))}
      </div>

      <div
        className="mt-4 pt-4"
        style={{ borderTop: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}` }}
      >
        <PropsTable
          props={[
            { name: 'nome', type: 'string', description: 'Nome do médico' },
            { name: 'periodo', type: 'string', description: 'Período das férias' },
            { name: 'isLast', type: 'boolean', description: 'Se é o último item (sem divisor)' },
            { name: 'showDivider', type: 'boolean', description: 'Forçar mostrar/ocultar divisor' },
            { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          ]}
        />
      </div>
    </ShowcaseSection>
  );
}

function SectionCardShowcase() {
  return (
    <ShowcaseSection
      title="📋 SectionCard"
      description="Card de seção com título, ação e conteúdo"
    >
      <SectionCard
        title="Plantões"
        subtitle="PRÓXIMOS"
        action={{
          label: 'Ver todos',
          icon: <Settings size={14} />,
          onClick: () => alert('Ver todos!'),
        }}
        badge={{ text: '4', variant: 'success' }}
      >
        <div style={{ color: 'inherit', fontSize: '14px' }}>
          Conteúdo da seção aqui. Pode ser qualquer elemento React.
        </div>
      </SectionCard>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Título principal' },
          { name: 'subtitle', type: 'string', description: 'Subtítulo/label superior' },
          { name: 'action', type: 'object', description: '{ label, icon, onClick }' },
          { name: 'badge', type: 'object', description: '{ text, variant }' },
          { name: 'variant', type: 'string', description: 'default | highlight' },
          { name: 'children', type: 'ReactNode', description: 'Conteúdo do card' },
        ]}
      />
    </ShowcaseSection>
  );
}

function BottomNavShowcase() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('Home');

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    active: item.icon === activeTab,
  }));

  return (
    <ShowcaseSection
      title="📱 BottomNav"
      description="Navegação inferior fixa estilo iOS"
    >
      <div
        style={{
          position: 'relative',
          height: '120px',
          background: isDark ? '#111916' : '#F0FFF4',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <BottomNav
            items={items}
            onItemClick={(item) => setActiveTab(item.icon)}
            style={{ position: 'relative' }}
          />
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'items', type: 'array', description: 'Array de { icon, active, href }' },
          { name: 'onItemClick', type: 'function', description: 'Callback ao clicar em item' },
        ]}
      />
    </ShowcaseSection>
  );
}

// ============================================================================
// NOVOS SHOWCASES - FASE 5.8
// ============================================================================

function NotificationBellShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="🔔 NotificationBell (NOVO)"
      description="Sino de notificações standalone com badge e animação"
    >
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={0}
            onClick={() => alert('Sem notificações')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Sem notificações
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={5}
            onClick={() => alert('5 notificações')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Com badge
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={150}
            onClick={() => alert('150 notificações')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            99+ (overflow)
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={3}
            hasUrgent={true}
            onClick={() => alert('Notificação urgente!')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Urgente (pulsa)
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={2}
            size="sm"
            onClick={() => alert('Pequeno')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Tamanho sm
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <NotificationBell
            count={8}
            size="lg"
            onClick={() => alert('Grande')}
          />
          <p style={{ fontSize: '12px', marginTop: '8px', color: isDark ? '#A3B8B0' : '#6B7280' }}>
            Tamanho lg
          </p>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'count', type: 'number', description: 'Número de notificações (0 oculta badge)' },
          { name: 'hasUrgent', type: 'boolean', description: 'Ativa animação de pulso' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          { name: 'size', type: "'sm' | 'default' | 'lg'", description: 'Tamanho do componente' },
        ]}
      />
    </ShowcaseSection>
  );
}

function PlantaoCardShowcase() {
  return (
    <ShowcaseSection
      title="📅 PlantaoCard (NOVO)"
      description="Card wrapper que agrupa lista de plantões com header e ações"
    >
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        <PlantaoCard
          title="Plantões"
          subtitle="PRÓXIMOS"
          items={PLANTOES}
          onViewAll={() => alert('Ver todos plantões')}
          onItemClick={(item) => alert(`Clicou em: ${item.hospital}`)}
        />

        <PlantaoCard
          title="Plantões"
          subtitle="CONFIRMADOS"
          items={PLANTOES.slice(0, 2)}
          variant="highlight"
          showBadge={true}
        />

        <PlantaoCard
          title="Plantões"
          subtitle="AGUARDANDO"
          items={[]}
        />
      </div>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Título do card' },
          { name: 'subtitle', type: 'string', description: 'Subtítulo/label superior' },
          { name: 'items', type: 'array', description: 'Array de { hospital, data, hora }' },
          { name: 'maxItems', type: 'number', description: 'Máximo de itens exibidos (default: 4)' },
          { name: 'onViewAll', type: 'function', description: 'Callback para ver todos' },
          { name: 'onItemClick', type: 'function', description: 'Callback ao clicar em item' },
          { name: 'variant', type: "'default' | 'highlight'", description: 'Variante visual' },
        ]}
      />
    </ShowcaseSection>
  );
}

function FeriasCardShowcase() {
  return (
    <ShowcaseSection
      title="🏖️ FeriasCard (NOVO)"
      description="Card wrapper que agrupa lista de férias/licenças"
    >
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        <FeriasCard
          title="Férias Programadas"
          subtitle="EQUIPE"
          items={FERIAS}
          onViewAll={() => alert('Ver todas as férias')}
          onItemClick={(item) => alert(`Clicou em: ${item.nome}`)}
        />

        <FeriasCard
          title="Licenças"
          subtitle="VIGENTES"
          items={FERIAS.slice(0, 1)}
          variant="highlight"
        />

        <FeriasCard
          title="Férias"
          subtitle="JANEIRO"
          items={[]}
        />
      </div>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Título do card' },
          { name: 'subtitle', type: 'string', description: 'Subtítulo/label superior' },
          { name: 'items', type: 'array', description: 'Array de { nome, periodo } ou { nome, inicio, fim }' },
          { name: 'maxItems', type: 'number', description: 'Máximo de itens (default: 3)' },
          { name: 'onViewAll', type: 'function', description: 'Callback para ver todos' },
          { name: 'onItemClick', type: 'function', description: 'Callback ao clicar em item' },
          { name: 'variant', type: "'default' | 'highlight'", description: 'Variante visual' },
        ]}
      />
    </ShowcaseSection>
  );
}

function ComunicadoCardShowcase() {
  return (
    <ShowcaseSection
      title="📣 ComunicadoCard (NOVO)"
      description="Card individual de comunicado com prioridade e status de leitura"
    >
      <div className="grid gap-3 md:gap-4">
        {COMUNICADOS_LISTA.map((comunicado, i) => (
          <ComunicadoCard
            key={i}
            titulo={comunicado.titulo}
            resumo={comunicado.resumo}
            data={comunicado.data}
            isNew={comunicado.isNew}
            prioridade={comunicado.prioridade}
            onClick={() => alert(`Abrindo: ${comunicado.titulo}`)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'titulo', type: 'string', description: 'Título do comunicado' },
          { name: 'resumo', type: 'string', description: 'Resumo/prévia do conteúdo' },
          { name: 'data', type: 'string', description: 'Data de publicação' },
          { name: 'isNew', type: 'boolean', description: 'Indica se é novo (não lido)' },
          { name: 'prioridade', type: "'normal' | 'alta' | 'urgente'", description: 'Nível de prioridade' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
        ]}
      />
    </ShowcaseSection>
  );
}

function ROPProgressCardShowcase() {
  return (
    <ShowcaseSection
      title="🎯 ROPProgressCard (NOVO)"
      description="Card de progresso em áreas dos ROPs (Required Organizational Practices)"
    >
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        {ROPS_PROGRESS.map((rop, i) => (
          <ROPProgressCard
            key={i}
            area={rop.area}
            progresso={rop.progresso}
            questoesRespondidas={rop.questoesRespondidas}
            totalQuestoes={rop.totalQuestoes}
            ultimaAtividade={rop.ultimaAtividade}
            pontos={rop.pontos}
            nivel={rop.nivel}
            onClick={() => alert(`Abrindo: ${rop.area}`)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'area', type: 'string', description: 'Nome da área ROP' },
          { name: 'progresso', type: 'number', description: 'Percentual de progresso (0-100)' },
          { name: 'questoesRespondidas', type: 'number', description: 'Questões respondidas' },
          { name: 'totalQuestoes', type: 'number', description: 'Total de questões' },
          { name: 'ultimaAtividade', type: 'string', description: 'Última atividade' },
          { name: 'pontos', type: 'number', description: 'Pontos acumulados (opcional)' },
          { name: 'nivel', type: 'string', description: 'Nível do usuário (opcional)' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
        ]}
      />
    </ShowcaseSection>
  );
}

function KPICardShowcase() {
  return (
    <ShowcaseSection
      title="📊 KPICard (NOVO)"
      description="Card de indicador de qualidade com valor, meta e tendência"
    >
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {KPIS.map((kpi, i) => (
          <KPICard
            key={i}
            titulo={kpi.titulo}
            valor={kpi.valor}
            meta={kpi.meta}
            unidade={kpi.unidade}
            tendencia={kpi.tendencia}
            periodo={kpi.periodo}
            isLowerBetter={kpi.isLowerBetter}
            onClick={() => alert(`Abrindo: ${kpi.titulo}`)}
            onInfoClick={() => alert(`Info: ${kpi.titulo}`)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'titulo', type: 'string', description: 'Nome do indicador' },
          { name: 'valor', type: 'number', description: 'Valor atual' },
          { name: 'meta', type: 'number', description: 'Meta a atingir' },
          { name: 'unidade', type: 'string', description: 'Unidade de medida (%, min, etc)' },
          { name: 'tendencia', type: "'up' | 'down' | 'stable'", description: 'Tendência do indicador' },
          { name: 'periodo', type: 'string', description: 'Período de referência' },
          { name: 'isLowerBetter', type: 'boolean', description: 'Se valor menor é melhor (default: true)' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          { name: 'onInfoClick', type: 'function', description: 'Callback do botão de info' },
        ]}
      />
    </ShowcaseSection>
  );
}

function CalculadoraCardShowcase() {
  const [favorites, setFavorites] = useState(
    CALCULADORAS.reduce((acc, calc) => ({ ...acc, [calc.nome]: calc.isFavorite }), {})
  );

  const toggleFavorite = (nome) => {
    setFavorites((prev) => ({ ...prev, [nome]: !prev[nome] }));
  };

  return (
    <ShowcaseSection
      title="🧮 CalculadoraCard (NOVO)"
      description="Card de calculadora médica com ícone, categoria e favoritos"
    >
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        {CALCULADORAS.map((calc, i) => (
          <CalculadoraCard
            key={i}
            nome={calc.nome}
            descricao={calc.descricao}
            icon={calc.icon}
            categoria={calc.categoria}
            isFavorite={favorites[calc.nome]}
            ultimoUso={calc.ultimoUso}
            onClick={() => alert(`Abrindo: ${calc.nome}`)}
            onFavoriteClick={() => toggleFavorite(calc.nome)}
          />
        ))}
      </div>

      <PropsTable
        props={[
          { name: 'nome', type: 'string', description: 'Nome da calculadora' },
          { name: 'descricao', type: 'string', description: 'Descrição breve' },
          { name: 'icon', type: 'ReactNode', description: 'Ícone (Lucide ou custom)' },
          { name: 'categoria', type: 'string', description: 'Categoria (Avaliação, Dosagem, etc)' },
          { name: 'isFavorite', type: 'boolean', description: 'Se está nos favoritos' },
          { name: 'ultimoUso', type: 'string', description: 'Último uso (opcional)' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          { name: 'onFavoriteClick', type: 'function', description: 'Callback do botão favorito' },
          { name: 'size', type: "'sm' | 'default' | 'lg'", description: 'Tamanho do card' },
        ]}
      />
    </ShowcaseSection>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function AnestShowcase() {
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
        📱 Componentes ANEST
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: isDark ? '#A3B8B0' : '#6B7280',
          marginBottom: '16px',
        }}
      >
        {isDark ? 'Dark Mode' : 'Light Mode'} - Componentes compostos específicos do ANEST
      </p>

      {/* Badge de versão */}
      <div
        className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold mb-6 md:mb-8"
        style={{
          background: isDark ? '#243530' : '#D4EDDA',
          color: isDark ? '#2ECC71' : '#006837',
        }}
      >
        ✨ Fase 5.8 Completa - 7 novos componentes
      </div>

      {/* Seção de novos componentes */}
      <h3
        className="text-base font-bold mb-6"
        style={{ color: isDark ? '#2ECC71' : '#006837' }}
      >
        🆕 Novos Componentes - Fase 5.8
      </h3>

      <NotificationBellShowcase />
      <PlantaoCardShowcase />
      <FeriasCardShowcase />
      <ComunicadoCardShowcase />
      <ROPProgressCardShowcase />
      <KPICardShowcase />
      <CalculadoraCardShowcase />

      {/* Componentes existentes */}
      <h3
        className="text-base font-bold mb-6"
        style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}
      >
        📦 Componentes Base (Fases anteriores)
      </h3>

      <HeaderShowcase />
      <SearchBarShowcase />
      <ComunicadosCardShowcase />
      <QuickLinksGridShowcase />
      <PlantaoListItemShowcase />
      <FeriasListItemShowcase />
      <SectionCardShowcase />
      <BottomNavShowcase />
    </div>
  );
}

export default AnestShowcase;
