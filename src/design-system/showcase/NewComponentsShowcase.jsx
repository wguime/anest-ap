// NewComponentsShowcase.jsx
// Showcase visual dos novos componentes migrados - Fase Design System

import { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Settings,
  UserPlus,
  Heart,
  Activity,
  AlertTriangle,
  Shield,
  Thermometer,
  Brain,
  Lock,
  Unlock,
  Wrench,
  Layers,
  Target,
  BarChart3,
  Sparkles,
  CircleDot,
  Check,
  X,
  User,
  Crown,
  FileText,
  Compass,
  Palette,
  Stethoscope,
} from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';

// Novos componentes - Navigation
import { BackButton } from '../components/anest/back-button';

// Novos componentes - Permission Controls
import {
  AdminOnly,
  RequirePermission,
  RoleGate,
  CanCreate,
  CanEdit,
  CanDelete,
} from '../components/anest/admin-only';

// Novos componentes - Admin Buttons
import {
  AddButton,
  AddDocumentButton,
  EditButton,
  DeleteButton,
  UploadButton,
  SettingsButton,
  AddUserButton,
  AdminActionBar,
} from '../components/anest/admin-buttons';

// Novos componentes - Clinical Calculators
import { ScoreTracker, ScoreTrackerMini } from '../components/anest/score-tracker';
import { RiskFactorCard, RiskFactorGroup } from '../components/anest/risk-factor-card';

// Componentes UI existentes com extensões
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { WidgetCard } from '../components/ui/widget-card';
import { AnimatedBackground } from '../components/ui/animated-background';
import { Carousel, CarouselSlide } from '../components/ui/carousel';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

// ============================================================================
// DESIGN SYSTEM TOKENS - Cores oficiais
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      card: '#FFFFFF',
      cardElevated: '#E8F5E9',
      cardHighlight: '#D4EDDA',
      cardAccent: '#C8E6C9',
    },
    green: {
      darkest: '#002215',
      dark: '#004225',
      medium: '#006837',
      bright: '#2E8B57',
      light: '#9BC53D',
    },
    text: {
      primary: '#000000',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: {
      default: '#C8E6C9',
      strong: '#A5D6A7',
      divider: '#E8F5E9',
    },
    status: {
      error: '#DC2626',
      warning: '#F59E0B',
      success: '#34C759',
    },
  },
  dark: {
    background: {
      primary: '#111916',
      darkest: '#0A0F0D',
      card: '#1A2420',
      cardHover: '#212D28',
      cardHighlight: '#212D28',
      cardLight: '#243530',
    },
    green: {
      primary: '#2ECC71',
      light: '#58D68D',
      muted: '#1E8449',
      dark: '#145A32',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8B0',
      muted: '#6B8178',
    },
    border: {
      default: '#2A3F36',
      strong: '#344840',
    },
    status: {
      error: '#E74C3C',
      warning: '#F39C12',
      success: '#2ECC71',
    },
  },
};

// Helper para pegar tokens
const getToken = (isDark, path) => {
  const mode = isDark ? 'dark' : 'light';
  const keys = path.split('.');
  let value = TOKENS[mode];
  for (const key of keys) {
    value = value?.[key];
  }
  return value;
};

// ============================================================================
// DADOS DE EXEMPLO
// ============================================================================

const MOCK_ADMIN_USER = {
  role: 'Administrador',
  customPermissions: {
    'doc-create': true,
    'doc-edit': true,
    'doc-delete': true,
    'admin-panel': true,
  },
};

const MOCK_REGULAR_USER = {
  role: 'anestesiologista',
  customPermissions: {},
};

const RISK_FACTORS_MORSE = [
  { id: 'quedas', title: 'Histórico de quedas', description: 'Paciente caiu nos últimos 3 meses', points: 25 },
  { id: 'diagnostico', title: 'Diagnóstico secundário', description: 'Mais de um diagnóstico médico', points: 15 },
  { id: 'deambulacao', title: 'Auxílio na deambulação', description: 'Usa muletas, bengala ou andador', points: 15, severity: 'moderado' },
  { id: 'iv', title: 'Terapia IV / Dispositivo', description: 'Cateter IV heparinizado ou salinizado', points: 20 },
  { id: 'marcha', title: 'Marcha comprometida', description: 'Fraca ou com dificuldade', points: 20, severity: 'alto' },
  { id: 'mental', title: 'Estado mental alterado', description: 'Superestima capacidade ou esquece limitações', points: 15 },
];

// Cores do carousel usando tokens do Design System
const CAROUSEL_ITEMS = [
  {
    id: 1,
    title: 'Novo protocolo disponível',
    description: 'Protocolo de sedação pediátrica atualizado',
    // Light: green.medium, Dark: green.primary
    lightColor: '#006837',
    darkColor: '#2ECC71',
  },
  {
    id: 2,
    title: 'Escala de janeiro',
    description: 'A escala do mês está disponível para consulta',
    // Light: green.dark, Dark: green.muted
    lightColor: '#004225',
    darkColor: '#1E8449',
  },
  {
    id: 3,
    title: 'Treinamento obrigatório',
    description: 'Complete o treinamento de segurança até dia 15',
    // Light: status.error, Dark: status.error
    lightColor: '#DC2626',
    darkColor: '#E74C3C',
  },
];

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function SectionIcon({ icon: Icon, isDark }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-md mr-2"
      style={{
        background: isDark ? TOKENS.dark.green.dark : TOKENS.light.green.dark,
        color: isDark ? TOKENS.dark.green.primary : '#FFFFFF',
      }}
    >
      <Icon className="w-4 h-4" />
    </span>
  );
}

function ShowcaseSection({ title, icon: Icon, description, children, fullWidth = false }) {
  const { isDark } = useTheme();

  return (
    <div className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2 flex items-center"
        style={{ color: getToken(isDark, 'text.primary') }}
      >
        {Icon && <SectionIcon icon={Icon} isDark={isDark} />}
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mb-3 md:mb-4"
          style={{ color: getToken(isDark, 'text.secondary') }}
        >
          {description}
        </p>
      )}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: getToken(isDark, 'background.cardHighlight'),
          padding: fullWidth ? '0' : undefined,
          border: `1px solid ${getToken(isDark, 'border.strong')}`,
          overflow: 'hidden',
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${getToken(isDark, 'border.default')}` }}>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: getToken(isDark, 'text.secondary') }}>Prop</th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: getToken(isDark, 'text.secondary') }}>Tipo</th>
            <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: getToken(isDark, 'text.secondary') }}>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${getToken(isDark, 'border.default')}` }}>
              <td style={{
                padding: '8px',
                fontFamily: 'monospace',
                color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium
              }}>
                {prop.name}
              </td>
              <td style={{ padding: '8px', color: getToken(isDark, 'text.muted') }}>{prop.type}</td>
              <td style={{ padding: '8px', color: getToken(isDark, 'text.primary') }}>{prop.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToggleButton({ active, onClick, icon: Icon, label, isDark }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      style={{
        background: active
          ? (isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark)
          : (isDark ? TOKENS.dark.border.default : TOKENS.light.background.cardHighlight),
        color: active
          ? (isDark ? TOKENS.dark.background.darkest : '#FFFFFF')
          : (isDark ? TOKENS.dark.text.secondary : TOKENS.light.text.secondary),
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatusBadge({ variant, children, isDark }) {
  const styles = {
    success: {
      background: isDark ? TOKENS.dark.green.dark : TOKENS.light.background.cardHighlight,
      color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium,
      border: `1px solid ${isDark ? TOKENS.dark.green.muted : TOKENS.light.border.strong}`,
    },
    locked: {
      background: isDark ? TOKENS.dark.border.default : TOKENS.light.background.cardElevated,
      color: getToken(isDark, 'text.secondary'),
      border: `1px solid ${getToken(isDark, 'border.default')}`,
    },
  };

  const style = styles[variant] || styles.locked;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={style}
    >
      {variant === 'success' && <Check className="w-3 h-3" />}
      {variant === 'locked' && <Lock className="w-3 h-3" />}
      {children}
    </span>
  );
}

// ============================================================================
// SHOWCASES DOS NOVOS COMPONENTES
// ============================================================================

function BackButtonShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="BackButton"
      icon={ArrowLeft}
      description="Botão de navegação para retornar à tela anterior - migrado do legado"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-center">
          <BackButton onClick={() => alert('Voltar!')} />
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Arrow (padrão)</p>
        </div>

        <div className="text-center">
          <BackButton variant="chevron" onClick={() => alert('Voltar!')} />
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Chevron</p>
        </div>

        <div className="text-center">
          <BackButton size="sm" onClick={() => alert('Voltar!')} />
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Pequeno</p>
        </div>

        <div className="text-center">
          <BackButton size="lg" onClick={() => alert('Voltar!')} />
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Grande</p>
        </div>

        <div className="text-center">
          <BackButton showLabel onClick={() => alert('Voltar!')}>Voltar</BackButton>
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Com label</p>
        </div>

        <div className="text-center">
          <BackButton disabled onClick={() => alert('Voltar!')} />
          <p className="text-xs mt-2" style={{ color: getToken(isDark, 'text.secondary') }}>Desabilitado</p>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'variant', type: "'arrow' | 'chevron'", description: 'Estilo do ícone' },
          { name: 'size', type: "'sm' | 'default' | 'lg'", description: 'Tamanho do botão' },
          { name: 'showLabel', type: 'boolean', description: 'Mostrar texto junto ao ícone' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          { name: 'disabled', type: 'boolean', description: 'Desabilitar botão' },
        ]}
      />
    </ShowcaseSection>
  );
}

function PermissionControlsShowcase() {
  const { isDark } = useTheme();
  const [currentUser, setCurrentUser] = useState(MOCK_ADMIN_USER);

  return (
    <ShowcaseSection
      title="Permission Controls"
      icon={Lock}
      description="Componentes para controle de acesso baseado em permissões"
    >
      <div className="mb-4 flex gap-2">
        <ToggleButton
          active={(currentUser.role || '').toLowerCase() === 'administrador'}
          onClick={() => setCurrentUser(MOCK_ADMIN_USER)}
          icon={Shield}
          label="Admin"
          isDark={isDark}
        />
        <ToggleButton
          active={(currentUser.role || '').toLowerCase() === 'anestesiologista'}
          onClick={() => setCurrentUser(MOCK_REGULAR_USER)}
          icon={User}
          label="Usuário Normal"
          isDark={isDark}
        />
      </div>

      <p className="text-sm mb-4" style={{ color: getToken(isDark, 'text.secondary') }}>
        Usuário atual: <strong>{currentUser.role}</strong> - Alterne para ver como os componentes reagem
      </p>

      <div className="space-y-4">
        <div
          className="p-3 rounded-lg"
          style={{ background: getToken(isDark, 'background.cardLight') || getToken(isDark, 'background.cardHighlight') }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: getToken(isDark, 'text.primary') }}>
            AdminOnly - Só admins veem:
          </p>
          <AdminOnly user={currentUser} fallback={<StatusBadge variant="locked" isDark={isDark}>Apenas administradores</StatusBadge>}>
            <StatusBadge variant="success" isDark={isDark}>Você é admin!</StatusBadge>
          </AdminOnly>
        </div>

        <div
          className="p-3 rounded-lg"
          style={{ background: getToken(isDark, 'background.cardLight') || getToken(isDark, 'background.cardHighlight') }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: getToken(isDark, 'text.primary') }}>
            RequirePermission - Permissão específica:
          </p>
          <RequirePermission user={currentUser} permission="doc-create" fallback={<StatusBadge variant="locked" isDark={isDark}>Sem permissão de criar</StatusBadge>}>
            <StatusBadge variant="success" isDark={isDark}>Pode criar documentos</StatusBadge>
          </RequirePermission>
        </div>

        <div
          className="p-3 rounded-lg"
          style={{ background: getToken(isDark, 'background.cardLight') || getToken(isDark, 'background.cardHighlight') }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: getToken(isDark, 'text.primary') }}>
            RoleGate - Roles específicos:
          </p>
          <RoleGate user={currentUser} roles={['Administrador', 'Coordenador']} fallback={<StatusBadge variant="locked" isDark={isDark}>Apenas Admins/Coordenadores</StatusBadge>}>
            <StatusBadge variant="success" isDark={isDark}>Role autorizado</StatusBadge>
          </RoleGate>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'user', type: 'object', description: 'Objeto do usuário com role e permissions' },
          { name: 'permission', type: 'string', description: 'Chave da permissão (RequirePermission)' },
          { name: 'roles', type: 'string[]', description: 'Array de roles permitidos (RoleGate)' },
          { name: 'fallback', type: 'ReactNode', description: 'Conteúdo alternativo se não tiver permissão' },
          { name: 'children', type: 'ReactNode', description: 'Conteúdo protegido' },
        ]}
      />
    </ShowcaseSection>
  );
}

function AdminButtonsShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="Admin Buttons"
      icon={Wrench}
      description="Botões especializados para ações administrativas com verificação de permissão integrada"
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Botões individuais:
          </p>
          <div className="flex flex-wrap gap-3">
            <AddButton user={MOCK_ADMIN_USER} onClick={() => alert('Adicionar!')}>
              Novo Item
            </AddButton>

            <AddDocumentButton user={MOCK_ADMIN_USER} category="protocolos" onClick={() => alert('Novo documento!')}>
              Novo Protocolo
            </AddDocumentButton>

            <EditButton user={MOCK_ADMIN_USER} onClick={() => alert('Editar!')}>
              Editar
            </EditButton>

            <EditButton user={MOCK_ADMIN_USER} iconOnly onClick={() => alert('Editar!')} />

            <DeleteButton user={MOCK_ADMIN_USER} confirmMessage="Confirma exclusão?" onClick={() => alert('Excluído!')}>
              Excluir
            </DeleteButton>

            <DeleteButton user={MOCK_ADMIN_USER} iconOnly onClick={() => alert('Excluído!')} />

            <UploadButton user={MOCK_ADMIN_USER} onFileSelect={(file) => alert(`Arquivo: ${file.name}`)}>
              Upload
            </UploadButton>

            <SettingsButton user={MOCK_ADMIN_USER} onClick={() => alert('Configurações!')} />

            <AddUserButton user={MOCK_ADMIN_USER} onClick={() => alert('Novo usuário!')}>
              Novo Usuário
            </AddUserButton>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            AdminActionBar - Barra de ações agrupadas:
          </p>
          <AdminActionBar
            user={MOCK_ADMIN_USER}
            category="documentos"
            onAdd={() => alert('Adicionar')}
            onEdit={() => alert('Editar')}
            onDelete={() => alert('Excluir')}
          />
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Sem permissão (usuário normal):
          </p>
          <div className="flex flex-wrap gap-3">
            <AddButton user={MOCK_REGULAR_USER} onClick={() => {}}>Não aparece</AddButton>
            <DeleteButton user={MOCK_REGULAR_USER} onClick={() => {}}>Não aparece</DeleteButton>
            <span className="text-sm italic" style={{ color: getToken(isDark, 'text.muted') }}>
              (botões ocultos para usuários sem permissão)
            </span>
          </div>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'user', type: 'object', description: 'Usuário para verificar permissões' },
          { name: 'category', type: 'string', description: 'Categoria do documento (opcional)' },
          { name: 'onClick', type: 'function', description: 'Callback ao clicar' },
          { name: 'iconOnly', type: 'boolean', description: 'Mostrar apenas ícone' },
          { name: 'size', type: "'sm' | 'default' | 'lg'", description: 'Tamanho do botão' },
          { name: 'confirmMessage', type: 'string', description: 'Mensagem de confirmação (DeleteButton)' },
        ]}
      />
    </ShowcaseSection>
  );
}

function TabsVariantsShowcase() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('todos');

  return (
    <ShowcaseSection
      title="Tabs - Novas Variantes"
      icon={Layers}
      description="Componente Tabs com variantes pills e underline"
    >
      <div className="space-y-8">
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            variant="pills" - Filtros estilo pill:
          </p>
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="pills">
            <TabsList>
              <TabsTrigger value="todos" badge={12}>Todos</TabsTrigger>
              <TabsTrigger value="pendentes" badge={5}>Pendentes</TabsTrigger>
              <TabsTrigger value="concluidos" badge={7}>Concluídos</TabsTrigger>
              <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
            </TabsList>
            <TabsContent value="todos" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Mostrando todos os itens (12)</p>
            </TabsContent>
            <TabsContent value="pendentes" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Mostrando pendentes (5)</p>
            </TabsContent>
            <TabsContent value="concluidos" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Mostrando concluídos (7)</p>
            </TabsContent>
            <TabsContent value="arquivados" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Mostrando arquivados</p>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            variant="underline" - Estilo sublinhado:
          </p>
          <Tabs defaultValue="visao-geral" variant="underline">
            <TabsList>
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="config" disabled>Configurações</TabsTrigger>
            </TabsList>
            <TabsContent value="visao-geral" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Conteúdo da visão geral</p>
            </TabsContent>
            <TabsContent value="detalhes" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Conteúdo dos detalhes</p>
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <p className="text-sm" style={{ color: getToken(isDark, 'text.primary') }}>Conteúdo do histórico</p>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            variant="default" - Padrão (comparação):
          </p>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'variant', type: "'default' | 'pills' | 'underline'", description: 'Estilo visual das abas' },
          { name: 'value', type: 'string', description: 'Tab ativa (controlado)' },
          { name: 'defaultValue', type: 'string', description: 'Tab inicial (não controlado)' },
          { name: 'onValueChange', type: 'function', description: 'Callback ao mudar tab' },
          { name: 'badge', type: 'number | string', description: 'Badge contador no TabsTrigger' },
        ]}
      />
    </ShowcaseSection>
  );
}

function WidgetCardSelectedShowcase() {
  const { isDark } = useTheme();
  const [selectedCards, setSelectedCards] = useState(['card2']);

  const toggleCard = (id) => {
    setSelectedCards((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <ShowcaseSection
      title="WidgetCard - Estado Selected"
      icon={Target}
      description="WidgetCard com nova prop selected para cenários de multi-seleção"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <WidgetCard
          icon={<Heart />}
          title="Goldman Risk"
          subtitle="Risco cardíaco"
          variant="interactive"
          selected={selectedCards.includes('card1')}
          onClick={() => toggleCard('card1')}
        />
        <WidgetCard
          icon={<Activity />}
          title="MEWS Score"
          subtitle="Early Warning"
          variant="interactive"
          selected={selectedCards.includes('card2')}
          onClick={() => toggleCard('card2')}
        />
        <WidgetCard
          icon={<Shield />}
          title="Morse Scale"
          subtitle="Risco de queda"
          variant="interactive"
          selected={selectedCards.includes('card3')}
          onClick={() => toggleCard('card3')}
        />
        <WidgetCard
          icon={<Thermometer />}
          title="Apfel Score"
          subtitle="NVPO"
          variant="interactive"
          selected={selectedCards.includes('card4')}
          showCheckmark={true}
          onClick={() => toggleCard('card4')}
        />
      </div>

      <p className="mt-4 text-sm" style={{ color: getToken(isDark, 'text.secondary') }}>
        Selecionados: {selectedCards.length > 0 ? selectedCards.join(', ') : 'nenhum'}
        <br />
        <span className="text-xs">(O último card tem showCheckmark=false)</span>
      </p>

      <PropsTable
        props={[
          { name: 'selected', type: 'boolean', description: 'Estado selecionado do card' },
          { name: 'showCheckmark', type: 'boolean', description: 'Mostrar checkmark quando selecionado (default: true)' },
          { name: 'variant', type: 'string', description: 'Use "interactive" para cards clicáveis' },
        ]}
      />
    </ShowcaseSection>
  );
}

function ScoreTrackerShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="ScoreTracker"
      icon={BarChart3}
      description="Componente para exibir pontuação de calculadoras clínicas com indicador de risco"
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Variante completa:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScoreTracker
              label="Escala de Morse"
              score={25}
              maxScore={125}
              riskLevel="baixo"
              riskDescription="Implementar precauções padrão de segurança"
            />
            <ScoreTracker
              label="MEWS Score"
              score={6}
              maxScore={14}
              riskLevel="alto"
              riskDescription="Avaliar necessidade de UTI"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Níveis de risco:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreTracker score={15} maxScore={100} riskLevel="baixo" showProgress={false} />
            <ScoreTracker score={45} maxScore={100} riskLevel="medio" showProgress={false} />
            <ScoreTracker score={75} maxScore={100} riskLevel="alto" showProgress={false} />
            <ScoreTracker score={95} maxScore={100} riskLevel="critico" showProgress={false} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Variante compacta:
          </p>
          <div className="space-y-2 max-w-md">
            <ScoreTracker label="Goldman Risk" score={12} maxScore={50} riskLevel="medio" compact />
            <ScoreTracker label="Apfel Score" score={3} maxScore={4} riskLevel="alto" compact />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            ScoreTrackerMini (inline):
          </p>
          <div className="flex flex-wrap gap-3">
            <ScoreTrackerMini score={25} maxScore={100} riskLevel="baixo" />
            <ScoreTrackerMini score={55} maxScore={100} riskLevel="medio" />
            <ScoreTrackerMini score={80} maxScore={100} riskLevel="alto" />
            <ScoreTrackerMini score={95} maxScore={100} riskLevel="critico" />
          </div>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'score', type: 'number', description: 'Pontuação atual' },
          { name: 'maxScore', type: 'number', description: 'Pontuação máxima' },
          { name: 'riskLevel', type: "'baixo' | 'medio' | 'alto' | 'critico'", description: 'Nível de risco' },
          { name: 'label', type: 'string', description: 'Label/título' },
          { name: 'riskDescription', type: 'string', description: 'Descrição do risco' },
          { name: 'showProgress', type: 'boolean', description: 'Mostrar barra de progresso' },
          { name: 'compact', type: 'boolean', description: 'Variante compacta' },
        ]}
      />
    </ShowcaseSection>
  );
}

function RiskFactorCardShowcase() {
  const { isDark } = useTheme();
  const [selectedFactors, setSelectedFactors] = useState(['quedas', 'iv']);
  // State for individual cards demo
  const [card1Selected, setCard1Selected] = useState(true);
  const [card2Selected, setCard2Selected] = useState(false);
  const [card3Selected, setCard3Selected] = useState(false);

  return (
    <ShowcaseSection
      title="RiskFactorCard"
      icon={AlertTriangle}
      description="Cards selecionáveis para fatores de risco em calculadoras clínicas"
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Cards individuais (clique para selecionar):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
            <RiskFactorCard
              title="Histórico de quedas"
              description="Paciente caiu nos últimos 3 meses"
              points={25}
              selected={card1Selected}
              onSelect={setCard1Selected}
            />
            <RiskFactorCard
              title="Déficit sensorial"
              description="Alteração visual ou auditiva"
              points={15}
              severity="moderado"
              selected={card2Selected}
              onSelect={setCard2Selected}
            />
            <RiskFactorCard
              title="Estado mental alterado"
              description="Confusão ou desorientação"
              points={20}
              severity="alto"
              selected={card3Selected}
              onSelect={setCard3Selected}
            />
            <RiskFactorCard
              title="Item desabilitado"
              description="Este item não pode ser selecionado"
              points={10}
              disabled
              onSelect={() => {}}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            RiskFactorGroup - Escala de Morse completa:
          </p>
          <div className="max-w-xl">
            <RiskFactorGroup
              factors={RISK_FACTORS_MORSE}
              selectedFactors={selectedFactors}
              onSelectionChange={setSelectedFactors}
              type="checkbox"
            />
          </div>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'title', type: 'string', description: 'Título do fator de risco' },
          { name: 'description', type: 'string', description: 'Descrição detalhada' },
          { name: 'points', type: 'number', description: 'Pontuação do fator' },
          { name: 'severity', type: "'leve' | 'moderado' | 'alto'", description: 'Severidade (opcional)' },
          { name: 'selected', type: 'boolean', description: 'Estado selecionado' },
          { name: 'onSelect', type: 'function', description: 'Callback ao selecionar' },
          { name: 'type', type: "'checkbox' | 'radio' | 'boolean'", description: 'Tipo de seleção' },
        ]}
      />
    </ShowcaseSection>
  );
}

function AnimatedBackgroundShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="AnimatedBackground"
      icon={Sparkles}
      description="Fundo animado decorativo para telas especiais (login, etc.)"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative h-40 rounded-xl overflow-hidden">
          <AnimatedBackground variant="circles" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-medium text-sm px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: '#FFFFFF'
              }}
            >
              circles
            </span>
          </div>
        </div>

        <div className="relative h-40 rounded-xl overflow-hidden">
          <AnimatedBackground variant="dots" dotCount={8} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-medium text-sm px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: '#FFFFFF'
              }}
            >
              dots
            </span>
          </div>
        </div>

        <div className="relative h-40 rounded-xl overflow-hidden">
          <AnimatedBackground variant="gradient" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-medium text-sm px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: '#FFFFFF'
              }}
            >
              gradient
            </span>
          </div>
        </div>

        <div className="relative h-40 rounded-xl overflow-hidden">
          <AnimatedBackground variant="mesh" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-medium text-sm px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: '#FFFFFF'
              }}
            >
              mesh
            </span>
          </div>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'variant', type: "'circles' | 'dots' | 'gradient' | 'mesh' | 'combined'", description: 'Tipo de animação' },
          { name: 'dotCount', type: 'number', description: 'Número de dots (variant=dots)' },
          { name: 'className', type: 'string', description: 'Classes adicionais' },
        ]}
      />
    </ShowcaseSection>
  );
}

function CarouselShowcase() {
  const { isDark } = useTheme();

  return (
    <ShowcaseSection
      title="Carousel"
      icon={CircleDot}
      description="Carrossel de slides com indicadores e navegação"
    >
      <div className="space-y-8">
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Carrossel de comunicados:
          </p>
          <Carousel autoplay autoplayInterval={5000} showControls={false}>
            {CAROUSEL_ITEMS.map((item) => (
              <CarouselSlide key={item.id}>
                <div
                  className="p-6 rounded-xl"
                  style={{
                    background: isDark ? item.darkColor : item.lightColor,
                    color: '#FFFFFF',
                  }}
                >
                  <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                  <p className="text-sm opacity-90">{item.description}</p>
                </div>
              </CarouselSlide>
            ))}
          </Carousel>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Sem controles e indicadores:
          </p>
          <Carousel showControls={false} showIndicators={false}>
            {CAROUSEL_ITEMS.map((item) => (
              <CarouselSlide key={item.id}>
                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: isDark ? item.darkColor : item.lightColor,
                    color: '#FFFFFF',
                  }}
                >
                  <p className="font-medium">{item.title}</p>
                </div>
              </CarouselSlide>
            ))}
          </Carousel>
        </div>

        <div>
          <p className="text-sm font-medium mb-3" style={{ color: getToken(isDark, 'text.secondary') }}>
            Múltiplos slides visíveis:
          </p>
          <Carousel slidesToShow={2} gap={16} showControls={false}>
            {CAROUSEL_ITEMS.map((item) => (
              <CarouselSlide key={item.id}>
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: isDark ? item.darkColor : item.lightColor,
                    color: '#FFFFFF',
                  }}
                >
                  <h4 className="font-bold mb-1">{item.title}</h4>
                  <p className="text-xs opacity-90">{item.description}</p>
                </div>
              </CarouselSlide>
            ))}
          </Carousel>
        </div>
      </div>

      <PropsTable
        props={[
          { name: 'autoplay', type: 'boolean', description: 'Ativar reprodução automática' },
          { name: 'autoplayInterval', type: 'number', description: 'Intervalo em ms (default: 5000)' },
          { name: 'showControls', type: 'boolean', description: 'Mostrar setas de navegação' },
          { name: 'showIndicators', type: 'boolean', description: 'Mostrar indicadores de slide' },
          { name: 'slidesToShow', type: 'number', description: 'Número de slides visíveis' },
          { name: 'gap', type: 'number', description: 'Espaçamento entre slides' },
          { name: 'loop', type: 'boolean', description: 'Loop infinito' },
          { name: 'onSlideChange', type: 'function', description: 'Callback ao mudar slide' },
        ]}
      />
    </ShowcaseSection>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function NewComponentsShowcase() {
  const { isDark } = useTheme();

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: getToken(isDark, 'background.primary'),
        minHeight: '100vh',
        color: getToken(isDark, 'text.primary'),
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2
        className="flex items-center gap-2"
        style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}
      >
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${TOKENS.dark.green.primary} 0%, ${TOKENS.dark.green.muted} 100%)`
              : `linear-gradient(135deg, ${TOKENS.light.green.medium} 0%, ${TOKENS.light.green.dark} 100%)`,
            color: isDark ? TOKENS.dark.background.darkest : '#FFFFFF',
          }}
        >
          <Plus className="w-5 h-5" />
        </span>
        Novos Componentes - Design System
      </h2>
      <p style={{ fontSize: '14px', color: getToken(isDark, 'text.secondary'), marginBottom: '16px' }}>
        {isDark ? 'Dark Mode' : 'Light Mode'} - Componentes migrados do legado e novas extensões
      </p>

      {/* Badge de versão */}
      <div
        className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold mb-6 md:mb-8"
        style={{
          background: getToken(isDark, 'background.cardLight') || getToken(isDark, 'background.cardHighlight'),
          color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium
        }}
      >
        <Sparkles className="w-4 h-4" />
        12 novos componentes / extensões
      </div>

      {/* Componentes de Navegação */}
      <h3
        className="text-base font-bold mb-6 flex items-center gap-2"
        style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
      >
        <Compass className="w-5 h-5" />
        Navegação
      </h3>
      <BackButtonShowcase />

      {/* Controles de Permissão */}
      <h3
        className="text-base font-bold mb-6 mt-8 flex items-center gap-2"
        style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
      >
        <Lock className="w-5 h-5" />
        Controle de Acesso
      </h3>
      <PermissionControlsShowcase />
      <AdminButtonsShowcase />

      {/* Componentes de UI */}
      <h3
        className="text-base font-bold mb-6 mt-8 flex items-center gap-2"
        style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
      >
        <Palette className="w-5 h-5" />
        Extensões de UI
      </h3>
      <TabsVariantsShowcase />
      <WidgetCardSelectedShowcase />

      {/* Calculadoras Clínicas */}
      <h3
        className="text-base font-bold mb-6 mt-8 flex items-center gap-2"
        style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
      >
        <Stethoscope className="w-5 h-5" />
        Calculadoras Clínicas
      </h3>
      <ScoreTrackerShowcase />
      <RiskFactorCardShowcase />

      {/* Decorativos */}
      <h3
        className="text-base font-bold mb-6 mt-8 flex items-center gap-2"
        style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
      >
        <Sparkles className="w-5 h-5" />
        Decorativos
      </h3>
      <AnimatedBackgroundShowcase />
      <CarouselShowcase />
    </div>
  );
}

export default NewComponentsShowcase;
