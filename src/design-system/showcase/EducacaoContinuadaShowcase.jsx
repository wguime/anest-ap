// EducacaoContinuadaShowcase.jsx
// Showcase dos componentes do sistema de Educacao Continuada

import { useState, useMemo } from 'react';
import {
  BookOpen,
  GraduationCap,
  GitBranch,
  Video,
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  Trophy,
  Star,
  Target,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Users,
  Award,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Progress,
  VideoPlayer,
  AudioPlayer,
} from '../components';
import { cn } from '../utils/tokens';

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      card: '#FFFFFF',
      cardHighlight: '#E8F5E9',
    },
    green: {
      dark: '#004225',
      medium: '#006837',
    },
    text: {
      primary: '#000000',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: {
      default: '#C8E6C9',
    },
  },
  dark: {
    background: {
      darkest: '#0A0F0D',
      card: '#1A2420',
      cardLight: '#243530',
    },
    green: {
      primary: '#2ECC71',
      muted: '#1E8449',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8B0',
      muted: '#6B8178',
    },
    border: {
      default: '#2A3F36',
    },
  },
};

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_CURSOS = [
  {
    id: 'curso-1',
    titulo: 'Boas Praticas na Prevencao de Infeccoes',
    descricao: 'Infeccao de Sitio Cirurgico: Como a Anestesia pode fazer a diferenca',
    banner: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
    status: 'em_andamento',
    progresso: 65,
    duracaoMinutos: 45,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2025-01-01'),
    modulosCompletos: ['mod-1', 'mod-2'],
    modulos: [
      { id: 'mod-1', titulo: 'Introducao' },
      { id: 'mod-2', titulo: 'Fatores de Risco' },
      { id: 'mod-3', titulo: 'Prevencao' },
    ],
  },
  {
    id: 'curso-2',
    titulo: 'Gerenciamento de Residuos de Saude',
    descricao: 'Meio Ambiente e Responsabilidade Social',
    banner: null,
    status: 'nao_iniciado',
    progresso: 0,
    duracaoMinutos: 15,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2025-01-10'),
    modulosCompletos: [],
    modulos: [{ id: 'mod-rs-1', titulo: 'Gerenciamento' }],
  },
  {
    id: 'curso-3',
    titulo: 'Protecao Radiologica',
    descricao: 'Seguranca em ambientes com radiacao',
    status: 'concluido',
    progresso: 100,
    duracaoMinutos: 60,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2024-10-01'),
    modulosCompletos: ['mod-pr-1', 'mod-pr-2', 'mod-pr-3'],
    modulos: [
      { id: 'mod-pr-1', titulo: 'Fundamentos' },
      { id: 'mod-pr-2', titulo: 'Praticas' },
      { id: 'mod-pr-3', titulo: 'Avaliacao' },
    ],
  },
];

const MOCK_TRILHAS = [
  {
    id: 'trilha-1',
    titulo: 'Onboarding - Novos Colaboradores',
    descricao: 'Trilha obrigatoria para integracao de novos funcionarios',
    obrigatoria: true,
    tiposUsuario: ['anestesiologista', 'enfermeiro', 'tec-enfermagem'],
    cursos: ['curso-1', 'curso-2'],
    prazoConclusao: 30,
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'trilha-2',
    titulo: 'Seguranca do Paciente',
    descricao: 'Praticas essenciais de seguranca hospitalar',
    obrigatoria: false,
    tiposUsuario: ['anestesiologista', 'enfermeiro'],
    cursos: ['curso-1', 'curso-3'],
    prazoConclusao: null,
    createdAt: new Date('2024-12-01'),
  },
];

const MOCK_AULAS = [
  { id: 'aula-1', titulo: 'Introducao a Seguranca', tipo: 'youtube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', duracao: 10 },
  { id: 'aula-2', titulo: 'Procedimentos Basicos', tipo: 'video', url: '/videos/procedimentos.mp4', duracao: 15 },
  { id: 'aula-3', titulo: 'Podcast: Casos Clinicos', tipo: 'audio', url: '/audio/casos.mp3', duracao: 20 },
];

const MOCK_TREE_DATA = [
  {
    id: 'trilha-1',
    type: 'trilha',
    titulo: 'Onboarding - Novos Colaboradores',
    obrigatoria: true,
    ativo: true,
    children: [
      {
        id: 'curso-1',
        type: 'curso',
        titulo: 'Boas Praticas na Prevencao de Infeccoes',
        ativo: true,
        children: [
          {
            id: 'mod-1',
            type: 'modulo',
            titulo: 'Introducao',
            ativo: true,
            children: [
              { id: 'aula-1', type: 'aula', titulo: 'Video: Conceitos Basicos', ativo: true },
              { id: 'aula-2', type: 'aula', titulo: 'Quiz: Avaliacao Inicial', ativo: true },
            ],
          },
          {
            id: 'mod-2',
            type: 'modulo',
            titulo: 'Fatores de Risco',
            ativo: true,
            children: [
              { id: 'aula-3', type: 'aula', titulo: 'Video: Identificacao de Riscos', ativo: true },
            ],
          },
        ],
      },
    ],
  },
];

const TIPOS_USUARIO = {
  // Aliases legados (para compatibilidade com dados antigos)
  medico: { label: 'Anestesiologista', cor: '#2563eb' },
  tecnico_enfermagem: { label: 'Téc. Enfermagem', cor: '#06b6d4' },
  residente: { label: 'Médico Residente', cor: '#8b5cf6' },

  // Cargos canonicos
  anestesiologista: { label: 'Anestesiologista', cor: '#2563eb' },
  'medico-residente': { label: 'Médico Residente', cor: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', cor: '#10b981' },
  'tec-enfermagem': { label: 'Téc. Enfermagem', cor: '#06b6d4' },
};

// ============================================================================
// COMPONENTES DO SISTEMA DE EDUCACAO
// ============================================================================

// StatusBadge - Badge de status para cursos e trilhas
function StatusBadge({ status }) {
  const config = {
    nao_iniciado: { label: 'NAO INICIADO', variant: 'secondary' },
    em_andamento: { label: 'EM ANDAMENTO', variant: 'warning' },
    concluido: { label: 'CONCLUIDO', variant: 'success' },
    aprovado: { label: 'APROVADO', variant: 'success' },
  };

  const { label, variant } = config[status] || config.nao_iniciado;

  return (
    <Badge variant={variant} badgeStyle="solid" className="uppercase text-xs">
      {label}
    </Badge>
  );
}

// CursoCard - Card de exibicao de curso
function CursoCard({ curso, onClick }) {
  const buttonText = {
    nao_iniciado: 'INICIAR',
    em_andamento: 'CONTINUAR',
    concluido: 'VER CERTIFICADO',
  }[curso.status] || 'VER DETALHES';

  const completedModulos = curso.modulosCompletos?.length || 0;

  const formatDuracao = (minutos) => {
    if (minutos < 60) return `${minutos}min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  };

  return (
    <Card className="overflow-hidden">
      {/* Banner */}
      <div
        className={cn(
          "relative h-36 p-4 flex flex-col",
          !curso.banner && "bg-gradient-to-br from-[#004225] via-[#006837] to-[#2E8B57]"
        )}
        style={{
          backgroundImage: curso.banner ? `url(${curso.banner})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {curso.banner && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        )}
        <div className="absolute top-4 right-4 opacity-20">
          <div className="w-16 h-16 rounded-full border-4 border-white/30" />
        </div>
        <div className="relative z-10">
          <StatusBadge status={curso.status} />
        </div>
        <h3
          className="relative z-10 mt-auto text-white text-lg font-bold leading-tight line-clamp-2"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        >
          {curso.titulo}
        </h3>
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-4">
        <p className="text-base text-foreground font-medium line-clamp-2">
          {curso.descricao}
        </p>

        <Button
          onClick={onClick}
          variant={curso.status === 'nao_iniciado' ? 'warning' : 'default'}
          className="w-full"
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          {buttonText}
        </Button>

        <p className="text-sm text-muted-foreground">
          Voce completou <span className="font-bold text-foreground">{completedModulos} aulas</span>.
        </p>

        <Progress value={curso.progresso} size="sm" className="h-2" />

        <div className="bg-muted/30 rounded-xl p-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="warning" badgeStyle="solid" className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              META: {curso.metaPorcentagem}%
            </Badge>
            <Badge variant="secondary" badgeStyle="solid" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuracao(curso.duracaoMinutos)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Curso liberado em{' '}
            <span className="font-bold text-foreground">
              {curso.dataLiberacao.toLocaleDateString('pt-BR')}
            </span>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// TrilhaCard - Card de trilha de aprendizado
function TrilhaCard({ trilha, progresso = 45, onClick, compact = false }) {
  const status = progresso === 100 ? 'concluida' : progresso > 0 ? 'em_andamento' : 'nao_iniciada';

  const statusConfig = {
    concluida: { label: 'Concluida', variant: 'success', icon: CheckCircle },
    urgente: { label: '7 dias restantes', variant: 'warning', icon: AlertTriangle },
    em_andamento: { label: 'Em Andamento', variant: 'info', icon: Clock },
    nao_iniciada: { label: 'Nao Iniciada', variant: 'secondary', icon: BookOpen },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const tiposLabels = trilha.tiposUsuario.map((t) => TIPOS_USUARIO[t]?.label || t).join(', ');

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl',
          'bg-card border border-border',
          'hover:bg-muted/50 transition-colors text-left'
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            trilha.obrigatoria ? 'bg-warning/10' : 'bg-muted'
          )}
        >
          <GitBranch className={cn('w-5 h-5', trilha.obrigatoria ? 'text-warning' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{trilha.titulo}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Progress value={progresso} size="xs" className="flex-1 h-1" />
            <span className="text-xs text-muted-foreground">{progresso}%</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  return (
    <Card variant="interactive" onClick={onClick} className="overflow-hidden">
      {trilha.obrigatoria && (
        <div className="bg-warning/10 px-4 py-2 border-b border-warning/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-warning">Trilha Obrigatoria</span>
          </div>
        </div>
      )}

      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
              status === 'concluida' ? 'bg-success/10' : 'bg-primary/10'
            )}
          >
            <GitBranch className={cn('w-6 h-6', status === 'concluida' ? 'text-success' : 'text-primary')} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{trilha.titulo}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{trilha.descricao}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={config.variant} badgeStyle="subtle">
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
          <Badge variant="secondary" badgeStyle="subtle">
            <BookOpen className="w-3 h-3 mr-1" />
            {trilha.cursos.length} cursos
          </Badge>
          {trilha.prazoConclusao && (
            <Badge variant="secondary" badgeStyle="subtle">
              <Clock className="w-3 h-3 mr-1" />
              Prazo: {trilha.prazoConclusao} dias
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium text-foreground">{progresso}%</span>
          </div>
          <Progress value={progresso} size="sm" className="h-2" />
        </div>

        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Para:</span> {tiposLabels}
        </div>

        <Button
          variant={status === 'concluida' ? 'outline' : 'default'}
          className="w-full"
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          {status === 'concluida' ? 'Ver Detalhes' : progresso > 0 ? 'Continuar' : 'Iniciar'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ContentTreeNode - No da arvore hierarquica
function ContentTreeNode({ node, level = 0, expandedNodes, onToggle }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  const NODE_ICONS = {
    trilha: GitBranch,
    curso: BookOpen,
    modulo: FolderOpen,
    aula: Video,
  };

  const NODE_COLORS = {
    trilha: 'text-purple-500',
    curso: 'text-blue-500',
    modulo: 'text-orange-500',
    aula: 'text-green-500',
  };

  const Icon = NODE_ICONS[node.type] || Video;
  const iconColor = NODE_COLORS[node.type] || 'text-gray-500';

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          'hover:bg-muted/50'
        )}
        style={{ marginLeft: level * 24 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn('w-5 h-5 flex items-center justify-center rounded', hasChildren ? 'cursor-pointer' : 'cursor-default')}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', 'bg-primary/10')}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>

        <span className="font-medium truncate flex-1">{node.titulo}</span>

        {node.obrigatoria && (
          <Badge variant="warning" badgeStyle="subtle" className="text-xs">
            Obrigatoria
          </Badge>
        )}

        {hasChildren && (
          <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
            {node.children.length}
          </Badge>
        )}

        <CheckCircle className="w-4 h-4 text-green-500 opacity-50" />
      </div>

      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {node.children.map((child) => (
            <ContentTreeNode key={child.id} node={child} level={level + 1} expandedNodes={expandedNodes} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

// ContentTree - Arvore hierarquica completa
function ContentTree({ data }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['trilha-1', 'curso-1']));

  const onToggle = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button size="sm" variant="ghost" onClick={() => setExpandedNodes(new Set(['trilha-1', 'curso-1', 'mod-1', 'mod-2']))}>
          Expandir Tudo
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setExpandedNodes(new Set())}>
          Colapsar Tudo
        </Button>
      </div>
      {data.map((node) => (
        <ContentTreeNode key={node.id} node={node} expandedNodes={expandedNodes} onToggle={onToggle} />
      ))}
    </div>
  );
}

// StatWidget - Widget de estatisticas
function StatWidget({ icon: Icon, value, label, color = 'text-primary', trend }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className={cn('w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center', 'bg-primary/10')}>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {trend !== undefined && (
        <p className={cn('text-xs mt-1', trend >= 0 ? 'text-green-500' : 'text-red-500')}>
          {trend >= 0 ? '+' : ''}
          {trend}% este mes
        </p>
      )}
    </div>
  );
}

// EmptyState - Estado vazio
function EmptyState({ icon: Icon = BookOpen, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

// LoadingState - Estado de carregamento
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

// ============================================================================
// SHOWCASE SECTION WRAPPER
// ============================================================================

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="mb-12">
      <h2 className="text-xl font-bold mb-2" style={{ color: t.text.primary }}>
        {title}
      </h2>
      {description && (
        <p className="text-sm mb-4" style={{ color: t.text.secondary }}>
          {description}
        </p>
      )}
      <div
        className="rounded-2xl p-6 border"
        style={{
          background: isDark ? TOKENS.dark.background.card : TOKENS.light.background.card,
          borderColor: t.border.default,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SHOWCASE COMPONENT
// ============================================================================

export function EducacaoContinuadaShowcase() {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  const handleCardClick = () => {
    alert('Navegacao para pagina de detalhe');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: t.text.primary }}>
            Educacao Continuada
          </h1>
        </div>
        <p className="text-base" style={{ color: t.text.secondary }}>
          Componentes do sistema de cursos, trilhas e acompanhamento de progresso
        </p>
      </div>

      {/* 1. Estrutura de Dados */}
      <ShowcaseSection
        title="1. Estrutura de Dados"
        description="Modelo hierarquico LMS: Trilha > Curso > Modulo > Aula. Dados normalizados no Firestore."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/30">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-500" />
                Trilha (Learning Path)
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- titulo, descricao</li>
                <li>- tiposUsuario[] (medico, enfermeiro...)</li>
                <li>- cursoIds[] (referencias)</li>
                <li>- obrigatoria, prazoConclusao</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Curso
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- titulo, descricao, banner</li>
                <li>- duracaoMinutos, categoria</li>
                <li>- moduloIds[] (referencias)</li>
                <li>- pontosAoCompletar</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-orange-500" />
                Modulo
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- titulo, tipo, duracao</li>
                <li>- cursoId (referencia pai)</li>
                <li>- aulaIds[] (referencias)</li>
                <li>- ordem, ativo</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Video className="w-4 h-4 text-green-500" />
                Aula
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- titulo, tipo (youtube/vimeo/video/audio)</li>
                <li>- url, duracao, thumbnail</li>
                <li>- moduloId (referencia pai)</li>
                <li>- ordem, ativo</li>
              </ul>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* 2. StatusBadge */}
      <ShowcaseSection
        title="2. StatusBadge"
        description="Badge para indicar o status de cursos e trilhas. Cores semanticas para cada estado."
      >
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="nao_iniciado" />
          <StatusBadge status="em_andamento" />
          <StatusBadge status="concluido" />
          <StatusBadge status="aprovado" />
        </div>
      </ShowcaseSection>

      {/* 3. CursoCard */}
      <ShowcaseSection
        title="3. CursoCard"
        description="Card de exibicao de curso com banner, status, progresso e metadados."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_CURSOS.map((curso) => (
            <CursoCard key={curso.id} curso={curso} onClick={handleCardClick} />
          ))}
        </div>
      </ShowcaseSection>

      {/* 4. TrilhaCard */}
      <ShowcaseSection
        title="4. TrilhaCard"
        description="Card de trilha de aprendizado com indicador de obrigatoriedade e progresso agregado."
      >
        <div className="space-y-6">
          <h4 className="text-sm font-semibold text-muted-foreground">Versao Completa:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_TRILHAS.map((trilha, index) => (
              <TrilhaCard key={trilha.id} trilha={trilha} progresso={index === 0 ? 45 : 100} onClick={handleCardClick} />
            ))}
          </div>

          <h4 className="text-sm font-semibold text-muted-foreground mt-6">Versao Compacta (para listas):</h4>
          <div className="space-y-2 max-w-md">
            {MOCK_TRILHAS.map((trilha, index) => (
              <TrilhaCard key={trilha.id} trilha={trilha} progresso={index === 0 ? 45 : 100} onClick={handleCardClick} compact />
            ))}
          </div>
        </div>
      </ShowcaseSection>

      {/* 5. ContentTree */}
      <ShowcaseSection
        title="5. ContentTree"
        description="Arvore hierarquica para navegacao e gestao de conteudo. Suporta expansao/colapsamento e acoes."
      >
        <div className="bg-muted/20 rounded-xl p-4">
          <ContentTree data={MOCK_TREE_DATA} />
        </div>
      </ShowcaseSection>

      {/* 6. Player de Midia */}
      <ShowcaseSection
        title="6. Player de Midia"
        description="Tipos de midia suportados: YouTube, Vimeo, video local e audio."
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">YouTube Embed:</h4>
            <div className="max-w-2xl">
              <VideoPlayer type="youtube" videoId="dQw4w9WgXcQ" title="Video Educacional" />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Player de Audio:</h4>
            <div className="max-w-lg">
              <AudioPlayer
                src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                title="Podcast: Seguranca do Paciente"
                artist="ANEST Educacao"
                showSkipButtons
                variant="card"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-xs font-medium">YouTube</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-xs font-medium">Vimeo</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-xs font-medium">Video Local</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <Play className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-xs font-medium">Audio</p>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* 7. Stats Widgets */}
      <ShowcaseSection
        title="7. Widgets de Estatisticas"
        description="Widgets para exibicao de metricas do dashboard de educacao."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatWidget icon={BookOpen} value="12" label="Cursos Ativos" color="text-blue-500" />
          <StatWidget icon={Users} value="847" label="Alunos Matriculados" color="text-green-500" trend={12} />
          <StatWidget icon={Award} value="234" label="Certificados Emitidos" color="text-purple-500" />
          <StatWidget icon={TrendingUp} value="78%" label="Taxa de Conclusao" color="text-orange-500" trend={-3} />
        </div>
      </ShowcaseSection>

      {/* 8. Gamificacao */}
      <ShowcaseSection
        title="8. Integracao com Gamificacao"
        description="Sistema de pontos, certificados e badges integrado ao progresso de cursos."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
            <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">2.850</p>
            <p className="text-sm text-muted-foreground">Pontos Totais</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <Award className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">5</p>
            <p className="text-sm text-muted-foreground">Certificados</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <Star className="w-8 h-8 text-purple-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">3</p>
            <p className="text-sm text-muted-foreground">Conquistas</p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-muted/30">
          <h4 className="font-semibold text-sm mb-3">Sistema de Pontos:</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Conclusao de curso: <span className="font-bold text-foreground">+pontosAoCompletar</span>
            </li>
            <li className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Conclusao de trilha obrigatoria: <span className="font-bold text-foreground">+50 bonus</span>
            </li>
            <li className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Certificado emitido automaticamente ao concluir curso
            </li>
          </ul>
        </div>
      </ShowcaseSection>

      {/* 9. Estados Vazios e Loading */}
      <ShowcaseSection
        title="9. Estados de UI"
        description="Componentes para estados vazios e carregamento."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-muted/20 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Estado Vazio:</h4>
            <EmptyState
              icon={BookOpen}
              title="Nenhum curso encontrado"
              description="Voce ainda nao esta matriculado em nenhum curso. Explore as trilhas disponiveis."
            />
          </div>
          <div className="bg-muted/20 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Carregando:</h4>
            <LoadingState />
          </div>
        </div>
      </ShowcaseSection>

      {/* 10. Tipos de Usuario */}
      <ShowcaseSection
        title="10. Filtro por Tipo de Usuario"
        description="Conteudo filtrado automaticamente baseado no tipo de usuario logado."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(TIPOS_USUARIO).map(([key, config]) => (
            <div
              key={key}
              className="p-3 rounded-xl border border-border text-center"
              style={{ borderLeftWidth: 4, borderLeftColor: config.cor }}
            >
              <Users className="w-6 h-6 mx-auto mb-2" style={{ color: config.cor }} />
              <p className="text-sm font-medium">{config.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 rounded-xl bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <strong>Fluxo:</strong> Usuario faz login {'->'} Sistema carrega tipoUsuario do perfil {'->'} Filtra trilhas
            disponiveis {'->'} Exibe cursos obrigatorios + opcionais {'->'} Rastreia progresso individual
          </p>
        </div>
      </ShowcaseSection>

      {/* Guia de Uso */}
      <div
        className="mt-8 p-4 rounded-xl"
        style={{
          background: isDark ? TOKENS.dark.background.card : '#E8F5E9',
          border: `1px solid ${t.border.default}`,
        }}
      >
        <h3 className="font-semibold mb-2" style={{ color: t.text.primary }}>
          Guia de Uso
        </h3>
        <ul className="text-sm space-y-1" style={{ color: t.text.secondary }}>
          <li>
            <strong>CursoCard:</strong> Use para exibir cursos em grid. Recebe curso e onClick.
          </li>
          <li>
            <strong>TrilhaCard:</strong> Card de trilha com progresso. Prop compact para versao inline.
          </li>
          <li>
            <strong>StatusBadge:</strong> Badge de status (nao_iniciado, em_andamento, concluido).
          </li>
          <li>
            <strong>ContentTree:</strong> Arvore hierarquica para admin. Props: data, onEdit, onDelete, onAdd.
          </li>
          <li>
            <strong>AulaPlayer:</strong> Player unificado com tracking. Suporta youtube, vimeo, video, audio.
          </li>
          <li>
            <strong>useEducacaoData:</strong> Hook para CRUD de conteudo (integrado com Firestore).
          </li>
          <li>
            <strong>useProgressoUsuario:</strong> Hook para progresso individual (marcacao de aulas, conclusao).
          </li>
        </ul>
      </div>

      {/* Props Reference */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: t.border.default }}
            >
              <th className="text-left py-2 px-4 font-semibold" style={{ color: t.text.primary }}>
                Componente
              </th>
              <th className="text-left py-2 px-4 font-semibold" style={{ color: t.text.primary }}>
                Props Principais
              </th>
              <th className="text-left py-2 px-4 font-semibold" style={{ color: t.text.primary }}>
                Descricao
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-4 font-mono text-primary">CursoCard</td>
              <td className="py-2 px-4 text-muted-foreground">curso, onClick</td>
              <td className="py-2 px-4 text-muted-foreground">Card de curso com progresso</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-mono text-primary">TrilhaCard</td>
              <td className="py-2 px-4 text-muted-foreground">trilha, progresso, compact</td>
              <td className="py-2 px-4 text-muted-foreground">Card de trilha de aprendizado</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-mono text-primary">StatusBadge</td>
              <td className="py-2 px-4 text-muted-foreground">status</td>
              <td className="py-2 px-4 text-muted-foreground">Badge de status semantico</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-mono text-primary">ContentTree</td>
              <td className="py-2 px-4 text-muted-foreground">data, readOnly, onEdit, onDelete</td>
              <td className="py-2 px-4 text-muted-foreground">Arvore hierarquica de conteudo</td>
            </tr>
            <tr>
              <td className="py-2 px-4 font-mono text-primary">AulaPlayer</td>
              <td className="py-2 px-4 text-muted-foreground">aula, cursoId, onProgress, onComplete</td>
              <td className="py-2 px-4 text-muted-foreground">Player de midia com tracking</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EducacaoContinuadaShowcase;
