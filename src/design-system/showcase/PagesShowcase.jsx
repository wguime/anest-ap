// PagesShowcase.jsx
// Showcase para visualização das páginas do app

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Home, User, Shield, ClipboardList, Smartphone, Monitor, Tablet, Megaphone, DollarSign, Calendar, TrendingDown, TrendingUp, Network, Scale, Users, FileSearch, FileBarChart, ShieldAlert, BookOpen, FileText, LogIn, Settings, AlertTriangle, QrCode, Search, UserCog, Calculator, ChevronLeft, GraduationCap, Target, Trophy, Video, GitBranch, BarChart3, MessageSquare } from 'lucide-react';
import { CalculatorShowcase } from './CalculatorShowcase';
import { useTheme } from '../hooks/useTheme.jsx';
import { ToastProvider } from '../components/ui/toast.jsx';
import { BottomNav } from '../components/anest';
import { UserProvider } from '../../contexts/UserContext';
import { EventAlertsProvider } from '../../contexts/EventAlertsContext';
import { IncidentsProvider } from '../../contexts/IncidentsContext';
import { DocumentsProvider } from '../../contexts/DocumentsContext';
import { MessagesProvider } from '../../contexts/MessagesContext';
import {
  HomePage,
  ProfilePage,
  CentroGestaoPage,
  PendenciasPage,
  ComunicadosPage,
  GestaoPage,
  QualidadePage,
  FinanceiroPage,
  EscalasPage,
  ReunioesPage,
  EducacaoPage,
  // Páginas Educação Continuada
  EducacaoContinuadaPage,
  CursoDetalhePage,
  CertificadosPage,
  PontosPage,
  AulaPlayerPage,
  // Admin Educação Continuada
  AdminConteudoPage,
  AdminAulasPage,
  AdminTrilhasPage,
  ControleEducacaoPage,
  // Páginas ROPs
  ROPsDesafioPage,
  ROPsChoiceMenuPage,
  ROPsSubdivisoesPage,
  ROPsQuizPage,
  ROPsPodcastsPage,
  ROPsRankingPage,
  PainelGestaoPage,
  OrganogramaPage,
  EticaBioeticaPage,
  ComitesPage,
  AuditoriasPage,
  RelatoriosPage,
  DesastresPage,
  BibliotecaPage,
  DocumentoDetalhePage,
  LoginPage,
  PersonalizarAtalhosPage,
  MenuPage,
  // Gestão de Incidentes
  IncidentesPage,
  NovoIncidentePage,
  NovaDenunciaPage,
  IncidenteDetalhePage,
  DenunciaDetalhePage,
  QRCodeGeneratorPage,
  RastrearRelatoPage,
  MeusRelatosPage,
  IncidenteGestaoPage,
  DenunciaGestaoPage,
  AcompanhamentoIncidentePage,
  AcompanhamentoDenunciaPage,
  // Sub-páginas KPI
  KpiInfeccaoPage,
  KpiAdesaoPage,
  KpiEventosPage,
  KpiSatisfacaoPage,
  KpiTempoPage,
  KpiMedicamentosPage,
  // Sub-páginas Comitês - agora ComitesPage é a página única
  // Sub-páginas Ética
  DilemasPage,
  ParecerUtiPage,
  DiretrizesPage,
  EmissaoParecerPage,
  CodigoEticaPage,
  // Sub-páginas Auditorias
  HigieneMaosPage,
  UsoMedicamentosPage,
  AbreviaturasPage,
  AuditoriasOperacionaisPage,
  AuditoriasConformidadePage,
  // Politicas Institucionais
  PoliticaGestaoQualidadePage,
  PoliticaDisclosurePage,
  RelatorioAuditoriasRopsPage,
  // Sub-páginas Relatórios
  RelatorioTrimestralPage,
  RelatorioIncidentesPage,
  RelatorioIndicadoresPage,
  // Sub-páginas Desastres
  EmergenciaIncendioPage,
  EmergenciaVitimasPage,
  EmergenciaPanePage,
  EmergenciaQuimicoPage,
  EmergenciaInundacaoPage,
  EmergenciaBombaPage,
  PlanoManualPage,
  PlanoTimesPage,
  PlanoApoioPage,
  PlanoSimuladoPage,
  // Comunicação
  InboxPage,
  MessageDetailPage,
  // Gestão Documental, Trilhas, Residência, Relatórios
  GestaoDocumentalPage,
  TrilhaDetalhePage,
  GerenciarResidenciaPage,
  RelatorioDetalhePage,
  // Faturamento
  FaturamentoPage,
  FaturamentoDashboardPage,
  FaturamentoEventosPage,
  FaturamentoNovoEventoPage,
  FaturamentoEventoDetalhePage,
  FaturamentoNotasPage,
  FaturamentoNotaDetalhePage,
  FaturamentoNovaNotaPage,
  FaturamentoConveniosPage,
} from '../../pages';

// ============================================================================
// CALCULADORAS PAGE WRAPPER (para uso no showcase)
// ============================================================================

function CalculadorasPage({ onNavigate, goBack }) {
  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header - rendered directly (no portal) for showcase compatibility */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
        <div className="px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-[70px]">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </button>
            </div>
            <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
              Calculadoras
            </h1>
            <div className="min-w-[70px]" />
          </div>
        </div>
      </nav>
      <div className="h-14" aria-hidden="true" />
      <div className="px-4 sm:px-5 py-4">
        <CalculatorShowcase />
      </div>
    </div>
  );
}

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      card: '#FFFFFF',
      cardHighlight: '#D4EDDA',
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
// CONFIGURAÇÃO DAS PÁGINAS
// ============================================================================

const PAGES = [
  {
    id: 'login',
    label: 'Login',
    description: 'Página de autenticação split-screen com Firebase Auth',
    Icon: LogIn,
    Component: LoginPage,
  },
  {
    id: 'home',
    label: 'Home',
    description: 'Dashboard principal com Plantões, Férias, Residência',
    Icon: Home,
    Component: HomePage,
  },
  {
    id: 'profile',
    label: 'Perfil',
    description: 'Dados do usuário, Caixa de Mensagens, Configurações',
    Icon: User,
    Component: ProfilePage,
  },
  {
    id: 'menu',
    label: 'Menu',
    description: 'Menu principal com widgets (Calculadoras)',
    Icon: Settings,
    Component: MenuPage,
  },
  {
    id: 'calculadoras',
    label: 'Calculadoras',
    description: 'Calculadoras médicas (pediatria, hemodinâmica, UTI, etc)',
    Icon: Calculator,
    Component: CalculadorasPage,
  },
  {
    id: 'permissions',
    label: 'Centro de Gestão',
    description: 'Usuários com sincronização de responsáveis, Documentos, Painel de Ética (incidentes/denúncias), Residência',
    Icon: UserCog,
    Component: CentroGestaoPage,
  },
  {
    id: 'centroGestao',
    label: 'Centro de Gestão (Alt)',
    description: 'Alias para Centro de Gestão - use "permissions" como rota principal',
    Icon: UserCog,
    Component: CentroGestaoPage,
    hidden: true, // Alias - rota principal é 'permissions'
  },
  {
    id: 'pendencias',
    label: 'Pendências',
    description: 'Comunicados, Documentos e ROPs pendentes',
    Icon: ClipboardList,
    Component: PendenciasPage,
  },
  {
    id: 'comunicados',
    label: 'Comunicados',
    description: 'Listagem, visualização e gestão de comunicados',
    Icon: Megaphone,
    Component: ComunicadosPage,
  },
  // Páginas de Gestão
  {
    id: 'gestao',
    label: 'Gestão',
    description: 'Hub de gestão: Incidentes, Biblioteca, Financeiro, Escalas, Qualidade',
    Icon: Shield,
    Component: GestaoPage,
  },
  {
    id: 'qualidade',
    label: 'Qualidade',
    description: 'Painel, Organograma, Ética, Comitês, Auditorias, Relatórios, Desastres',
    Icon: Shield,
    Component: QualidadePage,
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Gestão financeira do serviço',
    Icon: DollarSign,
    Component: FinanceiroPage,
  },
  {
    id: 'escalas',
    label: 'Escalas',
    description: 'Gestão de escalas médicas',
    Icon: Calendar,
    Component: EscalasPage,
  },
  {
    id: 'reunioes',
    label: 'Reuniões',
    description: 'Gestão de reuniões',
    Icon: Users,
    Component: ReunioesPage,
  },
  // Comunicação / Mensagens
  {
    id: 'inbox',
    label: 'Caixa de Mensagens',
    description: 'Mensagens privadas, notificações do sistema, rastreamento de denúncias',
    Icon: MessageSquare,
    Component: InboxPage,
  },
  {
    id: 'messageDetail',
    label: 'Detalhe da Mensagem',
    description: 'Visualização completa de mensagem ou notificação com thread e ações',
    Icon: MessageSquare,
    Component: MessageDetailPage,
    hidden: true,
  },
  // Página de Educação
  {
    id: 'educacao',
    label: 'Educação',
    description: 'Educação Continuada, Desafio ROPs, Residência Médica',
    Icon: GraduationCap,
    Component: EducacaoPage,
  },
  // Sub-páginas Educação Continuada
  {
    id: 'educacaoContinuada',
    label: 'Educação Continuada',
    description: 'Cursos, trilhas e certificados de capacitação',
    Icon: BookOpen,
    Component: EducacaoContinuadaPage,
  },
  { id: 'cursoDetalhe', label: 'Detalhe do Curso', Component: CursoDetalhePage, Icon: FileText, hidden: true },
  { id: 'aulaPlayer', label: 'Player de Aula', Component: AulaPlayerPage, Icon: Video, hidden: true },
  { id: 'certificados', label: 'Certificados', Component: CertificadosPage, Icon: FileText, hidden: true },
  { id: 'pontos', label: 'Extrato de Pontos', Component: PontosPage, Icon: Trophy, hidden: true },
  // Admin - Educação Continuada
  {
    id: 'adminConteudo',
    label: 'Admin: Conteúdo',
    description: 'CRUD completo de trilhas, cursos, módulos e aulas',
    Icon: Settings,
    Component: AdminConteudoPage,
  },
  {
    id: 'adminAulas',
    label: 'Admin: Aulas',
    description: 'CRUD de aulas (YouTube, Vimeo, local, áudio)',
    Icon: Video,
    Component: AdminAulasPage,
  },
  {
    id: 'adminTrilhas',
    label: 'Admin: Trilhas',
    description: 'Gerenciar trilhas de aprendizado por tipo de usuário',
    Icon: GitBranch,
    Component: AdminTrilhasPage,
  },
  {
    id: 'controleEducacao',
    label: 'Controle Educação',
    description: 'Tracking de conformidade por curso/aula para acreditação Qmentum',
    Icon: ClipboardList,
    Component: ControleEducacaoPage,
  },
  // Páginas ROPs (Desafio)
  {
    id: 'ropsDesafio',
    label: 'Desafio ROPs',
    description: '6 áreas temáticas, 32 ROPs, 640 questões gamificadas',
    Icon: Target,
    Component: ROPsDesafioPage,
  },
  { id: 'ropsChoiceMenu', label: 'Escolha ROPs', Component: ROPsChoiceMenuPage, Icon: Target, hidden: true },
  { id: 'ropsSubdivisoes', label: 'ROPs da Área', Component: ROPsSubdivisoesPage, Icon: FileText, hidden: true },
  { id: 'ropsQuiz', label: 'Quiz ROP', Component: ROPsQuizPage, Icon: Target, hidden: true },
  { id: 'ropsPodcasts', label: 'Podcasts ROPs', Component: ROPsPodcastsPage, Icon: Target, hidden: true },
  {
    id: 'ropsRanking',
    label: 'Ranking ROPs',
    description: 'Compare sua pontuação com outros participantes',
    Icon: Trophy,
    Component: ROPsRankingPage,
  },
  // Sub-páginas de Qualidade
  {
    id: 'painelGestao',
    label: 'Painel de Gestão',
    description: '21 KPIs monitorados com status, gráficos e edição admin',
    Icon: TrendingUp,
    Component: PainelGestaoPage,
  },
  {
    id: 'organograma',
    label: 'Organograma',
    description: 'Estrutura organizacional 2025',
    Icon: Network,
    Component: OrganogramaPage,
  },
  {
    id: 'eticaBioetica',
    label: 'Ética e Bioética',
    description: '5 áreas: Dilemas, Parecer UTI, Diretrizes, Emissão de Parecer, Código de Ética',
    Icon: Scale,
    Component: EticaBioeticaPage,
  },
  {
    id: 'comites',
    label: 'Comitês',
    description: '9 comitês: Governança, Operações, Qualidade e Educação',
    Icon: Users,
    Component: ComitesPage,
  },
  {
    id: 'auditorias',
    label: 'Auditorias',
    description: 'Auditorias operacionais, conformidade e politicas institucionais',
    Icon: FileSearch,
    Component: AuditoriasPage,
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    description: 'Trimestrais, Incidentes e Indicadores de Qualidade',
    Icon: FileBarChart,
    Component: RelatoriosPage,
  },
  {
    id: 'desastres',
    label: 'Desastres',
    description: 'Planos de emergência',
    Icon: ShieldAlert,
    Component: DesastresPage,
  },
  // Sub-páginas KPI (hidden - acessível via navegação)
  { id: 'kpiInfeccao', label: 'KPI Infecção', Component: KpiInfeccaoPage, Icon: TrendingDown, hidden: true },
  { id: 'kpiAdesao', label: 'KPI Adesão', Component: KpiAdesaoPage, Icon: TrendingUp, hidden: true },
  { id: 'kpiEventos', label: 'KPI Eventos', Component: KpiEventosPage, Icon: AlertTriangle, hidden: true },
  { id: 'kpiSatisfacao', label: 'KPI Satisfação', Component: KpiSatisfacaoPage, Icon: TrendingUp, hidden: true },
  { id: 'kpiTempo', label: 'KPI Tempo', Component: KpiTempoPage, Icon: TrendingUp, hidden: true },
  { id: 'kpiMedicamentos', label: 'KPI Medicamentos', Component: KpiMedicamentosPage, Icon: TrendingDown, hidden: true },
  // Sub-páginas Comitês - agora ComitesPage é a página única (não há mais subpáginas)
  // Sub-páginas Ética (hidden - acessível via navegação)
  { id: 'dilemas', label: 'Dilemas Bioéticos', Component: DilemasPage, Icon: Scale, hidden: true },
  { id: 'parecerUti', label: 'Parecer Ético UTI', Component: ParecerUtiPage, Icon: FileText, hidden: true },
  { id: 'diretrizes', label: 'Diretrizes Institucionais', Component: DiretrizesPage, Icon: FileText, hidden: true },
  { id: 'emissaoParecer', label: 'Emissão de Parecer', Component: EmissaoParecerPage, Icon: FileText, hidden: true },
  { id: 'codigoEtica', label: 'Código de Ética', Component: CodigoEticaPage, Icon: BookOpen, hidden: true },
  // Sub-páginas Auditorias (hidden - acessível via navegação)
  { id: 'higieneMaos', label: 'Higiene das Mãos', Component: HigieneMaosPage, Icon: ClipboardList, hidden: true },
  { id: 'usoMedicamentos', label: 'Uso de Medicamentos', Component: UsoMedicamentosPage, Icon: ClipboardList, hidden: true },
  { id: 'abreviaturas', label: 'Abreviaturas Perigosas', Component: AbreviaturasPage, Icon: ClipboardList, hidden: true },
  { id: 'auditoriasOperacionais', label: 'Auditorias Operacionais', Component: AuditoriasOperacionaisPage, Icon: ClipboardList, hidden: true },
  { id: 'auditoriasConformidade', label: 'Conformidade e Políticas', Component: AuditoriasConformidadePage, Icon: FileSearch, hidden: true },
  // Politicas Institucionais (hidden - acessível via navegação)
  { id: 'politicaGestaoQualidade', label: 'Política de Gestão da Qualidade', Component: PoliticaGestaoQualidadePage, Icon: Shield, hidden: true },
  { id: 'politicaDisclosure', label: 'Política de Disclosure', Component: PoliticaDisclosurePage, Icon: FileSearch, hidden: true },
  { id: 'relatorioAuditoriasRops', label: 'Relatório Auditorias ROPs', Component: RelatorioAuditoriasRopsPage, Icon: FileBarChart, hidden: true },
  // Sub-páginas Relatórios (hidden - acessível via navegação)
  { id: 'relatorioTrimestral', label: 'Relatório Trimestral', Component: RelatorioTrimestralPage, Icon: FileBarChart, hidden: true },
  { id: 'relatorioIncidentes', label: 'Consolidado Incidentes', Component: RelatorioIncidentesPage, Icon: AlertTriangle, hidden: true },
  { id: 'relatorioIndicadores', label: 'Indicadores de Qualidade', Component: RelatorioIndicadoresPage, Icon: TrendingUp, hidden: true },
  // Sub-páginas Desastres - Emergências (hidden - acessível via navegação)
  { id: 'emergenciaIncendio', label: 'Incêndio/Abandono', Component: EmergenciaIncendioPage, Icon: ShieldAlert, hidden: true },
  { id: 'emergenciaVitimas', label: 'Múltiplas Vítimas', Component: EmergenciaVitimasPage, Icon: Users, hidden: true },
  { id: 'emergenciaPane', label: 'Pane Elétrica', Component: EmergenciaPanePage, Icon: ShieldAlert, hidden: true },
  { id: 'emergenciaQuimico', label: 'Desastre Químico', Component: EmergenciaQuimicoPage, Icon: ShieldAlert, hidden: true },
  { id: 'emergenciaInundacao', label: 'Inundação', Component: EmergenciaInundacaoPage, Icon: ShieldAlert, hidden: true },
  { id: 'emergenciaBomba', label: 'Ameaça de Bomba', Component: EmergenciaBombaPage, Icon: ShieldAlert, hidden: true },
  // Sub-páginas Desastres - Planos (hidden - acessível via navegação)
  { id: 'planoManual', label: 'Manual de Gestão', Component: PlanoManualPage, Icon: BookOpen, hidden: true },
  { id: 'planoTimes', label: 'Times de Gerenciamento', Component: PlanoTimesPage, Icon: Users, hidden: true },
  { id: 'planoApoio', label: 'Apoio Psicológico', Component: PlanoApoioPage, Icon: Users, hidden: true },
  { id: 'planoSimulado', label: 'Simulado SRPA', Component: PlanoSimuladoPage, Icon: ClipboardList, hidden: true },
  // Biblioteca de Documentos
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    description: 'Biblioteca de documentos com busca e filtro por setor',
    Icon: BookOpen,
    Component: BibliotecaPage,
  },
  {
    id: 'documento-detalhe',
    label: 'Detalhe do Documento',
    description: 'Visualização detalhada do documento com histórico de versões',
    Icon: FileText,
    Component: DocumentoDetalhePage,
    hidden: true, // Não aparece na lista, só via navegação
  },
  // Configurações
  {
    id: 'personalizarAtalhos',
    label: 'Personalizar Atalhos',
    description: 'Escolha 4 atalhos rápidos para seu painel inicial',
    Icon: Settings,
    Component: PersonalizarAtalhosPage,
  },
  // Gestão de Incidentes e Denúncias
  {
    id: 'incidentes',
    label: 'Canal de Relatos',
    description: 'Interface para usuários reportarem incidentes e denúncias',
    Icon: AlertTriangle,
    Component: IncidentesPage,
  },
  {
    id: 'novoIncidente',
    label: 'Novo Incidente',
    description: 'Formulário 4 steps - dados salvos no IncidentsContext (SSOT)',
    Icon: AlertTriangle,
    Component: NovoIncidentePage,
  },
  {
    id: 'novaDenuncia',
    label: 'Nova Denúncia',
    description: 'Canal confidencial - dados salvos no IncidentsContext (SSOT)',
    Icon: ShieldAlert,
    Component: NovaDenunciaPage,
  },
  {
    id: 'incidenteDetalhe',
    label: 'Detalhe do Incidente',
    description: 'Visualização detalhada com timeline e ações',
    Icon: AlertTriangle,
    Component: IncidenteDetalhePage,
    hidden: true, // Acessível via navegação interna
  },
  {
    id: 'denunciaDetalhe',
    label: 'Detalhe da Denúncia',
    description: 'Visualização e acompanhamento da denúncia',
    Icon: ShieldAlert,
    Component: DenunciaDetalhePage,
    hidden: true, // Acessível via navegação interna
  },
  {
    id: 'qrcodeGenerator',
    label: 'Gerador QR Code',
    description: 'Gera QR codes para notificação rápida de incidentes',
    Icon: QrCode,
    Component: QRCodeGeneratorPage,
  },
  {
    id: 'rastrearRelato',
    label: 'Rastrear Relato',
    description: 'Consultar status do relato pelo código de rastreio',
    Icon: Search,
    Component: RastrearRelatoPage,
    hidden: true, // Removido da interface do usuário
  },
  {
    id: 'meusRelatos',
    label: 'Meus Relatos',
    description: 'Relatos do usuário logado (filtrados por userId via IncidentsContext)',
    Icon: FileText,
    Component: MeusRelatosPage,
  },
  // Páginas de Gestão Interna (Comitê de Ética)
  {
    id: 'incidente-gestao',
    label: 'Gestão de Incidente',
    description: 'Área do Comitê de Ética - Voltar retorna ao Painel de Ética',
    Icon: UserCog,
    Component: IncidenteGestaoPage,
    hidden: true, // Acessível via navegação interna
  },
  {
    id: 'denuncia-gestao',
    label: 'Gestão de Denúncia',
    description: 'Área do Comitê de Ética - Voltar retorna ao Painel de Ética',
    Icon: UserCog,
    Component: DenunciaGestaoPage,
    hidden: true, // Acessível via navegação interna
  },
  // Páginas de Acompanhamento (acessíveis via Meus Relatos)
  {
    id: 'acompanhamentoIncidente',
    label: 'Acompanhar Incidente',
    description: 'Página de acompanhamento de incidente pelo usuário',
    Icon: AlertTriangle,
    Component: AcompanhamentoIncidentePage,
    hidden: true, // Acessível via navegação interna
  },
  {
    id: 'acompanhamentoDenuncia',
    label: 'Acompanhar Denúncia',
    description: 'Página de acompanhamento de denúncia pelo usuário',
    Icon: ShieldAlert,
    Component: AcompanhamentoDenunciaPage,
    hidden: true, // Acessível via navegação interna
  },
  // Gestão Documental
  {
    id: 'gestaoDocumental',
    label: 'Gestão Documental',
    description: 'Gestão e controle de documentos institucionais',
    Icon: FileText,
    Component: GestaoDocumentalPage,
  },
  // Trilha Detalhe
  { id: 'trilhaDetalhe', label: 'Detalhe da Trilha', Component: TrilhaDetalhePage, Icon: GitBranch, hidden: true },
  // Gerenciar Residência
  {
    id: 'gerenciarResidencia',
    label: 'Gerenciar Residência',
    description: 'Administração do programa de residência médica',
    Icon: Settings,
    Component: GerenciarResidenciaPage,
  },
  // Relatório Detalhe
  { id: 'relatorioDetalhe', label: 'Detalhe do Relatório', Component: RelatorioDetalhePage, Icon: FileBarChart, hidden: true },
  // Faturamento
  {
    id: 'faturamento',
    label: 'Faturamento',
    description: 'Gestão financeira de eventos, notas e convênios',
    Icon: DollarSign,
    Component: FaturamentoPage,
  },
  { id: 'faturamentoDashboard', label: 'Dashboard Faturamento', Component: FaturamentoDashboardPage, Icon: BarChart3, hidden: true },
  { id: 'faturamentoEventos', label: 'Eventos', Component: FaturamentoEventosPage, Icon: Calendar, hidden: true },
  { id: 'faturamentoNovoEvento', label: 'Novo Evento', Component: FaturamentoNovoEventoPage, Icon: Calendar, hidden: true },
  { id: 'faturamentoEventoDetalhe', label: 'Detalhe do Evento', Component: FaturamentoEventoDetalhePage, Icon: FileBarChart, hidden: true },
  { id: 'faturamentoNotas', label: 'Notas Fiscais', Component: FaturamentoNotasPage, Icon: FileText, hidden: true },
  { id: 'faturamentoNotaDetalhe', label: 'Detalhe da Nota', Component: FaturamentoNotaDetalhePage, Icon: FileText, hidden: true },
  { id: 'faturamentoNovaNota', label: 'Nova Nota Fiscal', Component: FaturamentoNovaNotaPage, Icon: FileText, hidden: true },
  { id: 'faturamentoConvenios', label: 'Convênios', Component: FaturamentoConveniosPage, Icon: DollarSign, hidden: true },
];

// ============================================================================
// VIEWPORTS PARA PREVIEW
// ============================================================================

const VIEWPORTS = [
  { id: 'mobile', label: 'Mobile', width: 375, Icon: Smartphone },
  { id: 'tablet', label: 'Tablet', width: 768, Icon: Tablet },
  { id: 'desktop', label: 'Desktop', width: 1024, Icon: Monitor },
];

// ============================================================================
// MAPEAMENTO DE PÁGINAS PARA BOTTOMNAV
// ============================================================================

const PAGE_TO_NAV = {
  // Home Section
  home: 'home',
  pendencias: 'home',
  comunicados: 'home',
  // Shield/Gestão Section
  gestao: 'shield',
  qualidade: 'shield',
  financeiro: 'shield',
  escalas: 'shield',
  reunioes: 'shield',
  painelGestao: 'shield',
  organograma: 'shield',
  eticaBioetica: 'shield',
  comites: 'shield',
  auditorias: 'shield',
  relatorios: 'shield',
  desastres: 'shield',
  biblioteca: 'shield',
  'documento-detalhe': 'shield',
  incidentes: 'shield',
  novoIncidente: 'shield',
  novaDenuncia: 'shield',
  incidenteDetalhe: 'shield',
  denunciaDetalhe: 'shield',
  qrcodeGenerator: 'shield',
  rastrearRelato: 'shield',
  meusRelatos: 'shield',
  'incidente-gestao': 'shield',
  'denuncia-gestao': 'shield',
  acompanhamentoIncidente: 'shield',
  acompanhamentoDenuncia: 'shield',
  // Sub-páginas KPI
  kpiInfeccao: 'shield',
  kpiAdesao: 'shield',
  kpiEventos: 'shield',
  kpiSatisfacao: 'shield',
  kpiTempo: 'shield',
  kpiMedicamentos: 'shield',
  // Sub-páginas Comitês - agora ComitesPage é a página única (não há mais subpáginas)
  // Sub-páginas Ética
  dilemas: 'shield',
  parecerUti: 'shield',
  diretrizes: 'shield',
  emissaoParecer: 'shield',
  codigoEtica: 'shield',
  // Sub-páginas Auditorias
  higieneMaos: 'shield',
  usoMedicamentos: 'shield',
  abreviaturas: 'shield',
  auditoriasOperacionais: 'shield',
  auditoriasConformidade: 'shield',
  // Politicas Institucionais
  politicaGestaoQualidade: 'shield',
  politicaDisclosure: 'shield',
  relatorioAuditoriasRops: 'shield',
  // Sub-páginas Relatórios
  relatorioTrimestral: 'shield',
  relatorioIncidentes: 'shield',
  relatorioIndicadores: 'shield',
  // Sub-páginas Desastres
  emergenciaIncendio: 'shield',
  emergenciaVitimas: 'shield',
  emergenciaPane: 'shield',
  emergenciaQuimico: 'shield',
  emergenciaInundacao: 'shield',
  emergenciaBomba: 'shield',
  planoManual: 'shield',
  planoTimes: 'shield',
  planoApoio: 'shield',
  planoSimulado: 'shield',
  // Education Section
  educacao: 'education',
  ropsDesafio: 'education',
  ropsChoiceMenu: 'education',
  ropsSubdivisoes: 'education',
  ropsQuiz: 'education',
  ropsPodcasts: 'education',
  ropsRanking: 'education',
  residencia: 'education',
  educacaoContinuada: 'education',
  cursoDetalhe: 'education',
  aulaPlayer: 'education',
  certificados: 'education',
  pontos: 'education',
  adminConteudo: 'education',
  adminAulas: 'education',
  adminTrilhas: 'education',
  controleEducacao: 'education',
  // Gestão Documental
  gestaoDocumental: 'shield',
  // Educação
  trilhaDetalhe: 'education',
  // Relatórios
  relatorioDetalhe: 'shield',
  // Faturamento
  faturamento: 'shield',
  faturamentoDashboard: 'shield',
  faturamentoEventos: 'shield',
  faturamentoNovoEvento: 'shield',
  faturamentoEventoDetalhe: 'shield',
  faturamentoNotas: 'shield',
  faturamentoNotaDetalhe: 'shield',
  faturamentoNovaNota: 'shield',
  faturamentoConvenios: 'shield',
  // Menu Section
  gerenciarResidencia: 'menu',
  profile: 'menu',
  permissions: 'menu',
  centroGestao: 'menu',
  personalizarAtalhos: 'menu',
  login: 'menu',
  calculadoras: 'menu',
  menu: 'menu',
  inbox: 'menu',
  messageDetail: 'menu',
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function PagesShowcase() {
  const { isDark } = useTheme();
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageParams, setPageParams] = useState(null);
  const [viewport, setViewport] = useState('mobile');
  const [activeNav, setActiveNav] = useState('home');
  const [navigationHistory, setNavigationHistory] = useState([]);
  const scrollContainerRef = useRef(null);

  // Reset quando o componente é montado/remontado (clique na sidebar)
  useEffect(() => {
    setSelectedPage(null);
    setPageParams(null);
    setViewport('mobile');
    setActiveNav('home');
    setNavigationHistory([]);
  }, []);

  // Sincronizar activeNav com a página selecionada
  useEffect(() => {
    if (selectedPage && PAGE_TO_NAV[selectedPage]) {
      setActiveNav(PAGE_TO_NAV[selectedPage]);
    }
  }, [selectedPage]);

  // Scroll para o topo quando a página muda
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [selectedPage]);

  // Função de navegação com histórico
  const handleNavigate = (page, params = null) => {
    if (PAGES.find((p) => p.id === page)) {
      // Salvar página atual no histórico antes de navegar
      if (selectedPage) {
        setNavigationHistory(prev => [...prev, {
          page: selectedPage,
          params: pageParams
        }]);
      }
      setSelectedPage(page);
      setPageParams(params);
    }
  };

  // Função para voltar usando o histórico
  const goBack = () => {
    if (navigationHistory.length === 0) {
      // Sem histórico, volta para a lista de páginas
      setSelectedPage(null);
      setPageParams(null);
      setActiveNav('home');
      return;
    }

    // Pegar última entrada do histórico
    const newHistory = [...navigationHistory];
    const previous = newHistory.pop();

    setNavigationHistory(newHistory);
    setSelectedPage(previous.page);
    setPageParams(previous.params);

    // Atualizar activeNav
    if (previous.page && PAGE_TO_NAV[previous.page]) {
      setActiveNav(PAGE_TO_NAV[previous.page]);
    }
  };

  // Handler de navegação do BottomNav
  const handleBottomNavClick = (item) => {
    setActiveNav(item.id);
    switch (item.id) {
      case 'home':
        setSelectedPage('home');
        setPageParams(null);
        break;
      case 'shield':
        setSelectedPage('gestao');
        setPageParams(null);
        break;
      case 'education':
        setSelectedPage('educacao');
        setPageParams(null);
        break;
      case 'menu':
        setSelectedPage('menu');
        setPageParams(null);
        break;
      default:
        break;
    }
  };

  const t = isDark ? TOKENS.dark : TOKENS.light;

  // Se uma página está selecionada, mostra o preview
  if (selectedPage) {
    const page = PAGES.find((p) => p.id === selectedPage);
    const PageComponent = page?.Component;
    const currentViewport = VIEWPORTS.find((v) => v.id === viewport);

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header com voltar e viewport selector */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedPage(null)}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: isDark ? TOKENS.dark.background.card : TOKENS.light.card,
              color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark,
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: t.text.primary }}
              >
                {page?.label}
              </h2>
              <p
                className="text-sm"
                style={{ color: t.text.secondary }}
              >
                {page?.description}
              </p>
            </div>

            {/* Viewport selector */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: isDark ? TOKENS.dark.background.card : '#E8F5E9' }}
            >
              {VIEWPORTS.map((vp) => {
                const VpIcon = vp.Icon;
                const isActive = viewport === vp.id;
                return (
                  <button
                    key={vp.id}
                    onClick={() => setViewport(vp.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium"
                    style={{
                      background: isActive
                        ? isDark
                          ? TOKENS.dark.green.primary
                          : TOKENS.light.green.dark
                        : 'transparent',
                      color: isActive
                        ? isDark
                          ? TOKENS.dark.background.darkest
                          : '#FFFFFF'
                        : t.text.secondary,
                    }}
                  >
                    <VpIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{vp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview Container */}
        <div
          className="rounded-2xl overflow-hidden mx-auto transition-all duration-300 relative"
          style={{
            maxWidth: viewport === 'desktop' ? '100%' : `${currentViewport?.width}px`,
            maxHeight: 'calc(100vh - 220px)',
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${t.border.default}`,
            zIndex: 1,
          }}
        >
          {/* Device Frame */}
          <div
            className="h-6 flex items-center justify-center gap-2"
            style={{ background: isDark ? '#1A1A1A' : '#E5E5E5' }}
          >
            <div
              className="w-12 h-1 rounded-full"
              style={{ background: isDark ? '#333' : '#CCC' }}
            />
          </div>

          {/* Page Content - estrutura idêntica ao App.jsx */}
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto relative"
            style={{
              height: viewport === 'mobile' ? '667px' : viewport === 'tablet' ? '800px' : '600px',
              background: isDark ? TOKENS.dark.background.darkest : TOKENS.light.background.primary,
            }}
          >
            {/* Providers na mesma ordem do main.jsx */}
            <ToastProvider>
              <UserProvider forceMock>
                <DocumentsProvider>
                  <IncidentsProvider>
                    <EventAlertsProvider>
                      <MessagesProvider>
                        {/* Container com background igual ao App.jsx (sem min-h-screen para evitar conflito) */}
                        <div className="bg-[#F0FFF4] dark:bg-[#111916]">
                          {PageComponent && (
                            <PageComponent
                              onNavigate={handleNavigate}
                              goBack={goBack}
                              params={pageParams}
                              // Props específicos para CentroGestaoPage
                              initialSection={pageParams?.initialSection || 'usuarios'}
                              // Props específicos para páginas de acompanhamento e gestão
                              incidenteId={pageParams?.id}
                              denunciaId={pageParams?.id}
                              // Props específicos para páginas de ROPs
                              areaKey={pageParams?.areaKey}
                              ropKey={pageParams?.ropKey}
                              // Props para cursos
                              cursoId={pageParams?.cursoId}
                            />
                          )}
                        </div>
                      </MessagesProvider>
                    </EventAlertsProvider>
                  </IncidentsProvider>
                </DocumentsProvider>
              </UserProvider>
            </ToastProvider>
          </div>

          {/* BottomNav - Fixo no rodapé do preview */}
          <div
            className="border-t"
            style={{
              background: isDark ? TOKENS.dark.background.card : '#FFFFFF',
              borderColor: isDark ? TOKENS.dark.border.default : TOKENS.light.border.default,
            }}
          >
            <BottomNav
              items={[
                { icon: 'Home', active: activeNav === 'home', id: 'home' },
                { icon: 'Shield', active: activeNav === 'shield', id: 'shield' },
                { icon: 'GraduationCap', active: activeNav === 'education', id: 'education' },
                { icon: 'Menu', active: activeNav === 'menu', id: 'menu' },
              ]}
              onItemClick={handleBottomNavClick}
            />
          </div>
        </div>

        {/* Info */}
        <div
          className="mt-4 text-center text-xs"
          style={{ color: t.text.muted }}
        >
          Viewport: {currentViewport?.width}px
        </div>
      </div>
    );
  }

  // Lista de páginas disponíveis
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ color: t.text.primary }}
        >
          Páginas do App
        </h1>
        <p
          className="text-base"
          style={{ color: t.text.secondary }}
        >
          Visualize as páginas implementadas do ANEST v2.0
        </p>
      </div>

      {/* Grid de páginas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {PAGES.filter((p) => !p.hidden).map((page) => {
          const PageIcon = page.Icon;
          return (
            <button
              key={page.id}
              onClick={() => setSelectedPage(page.id)}
              className="p-6 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: isDark ? TOKENS.dark.background.card : '#FFFFFF',
                border: `1px solid ${t.border.default}`,
                boxShadow: isDark
                  ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: isDark
                    ? `linear-gradient(135deg, ${TOKENS.dark.green.primary} 0%, ${TOKENS.dark.green.muted} 100%)`
                    : `linear-gradient(135deg, ${TOKENS.light.green.medium} 0%, ${TOKENS.light.green.dark} 100%)`,
                }}
              >
                <PageIcon className="w-6 h-6 text-white" />
              </div>

              {/* Title */}
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: t.text.primary }}
              >
                {page.label}
              </h3>

              {/* Description */}
              <p
                className="text-sm"
                style={{ color: t.text.secondary }}
              >
                {page.description}
              </p>

              {/* View button hint */}
              <div
                className="mt-4 text-xs font-medium"
                style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
              >
                Clique para visualizar
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Section */}
      <div
        className="mt-8 p-4 rounded-xl"
        style={{
          background: isDark ? TOKENS.dark.background.card : '#E8F5E9',
          border: `1px solid ${t.border.default}`,
        }}
      >
        <h3
          className="font-semibold mb-2"
          style={{ color: t.text.primary }}
        >
          Sobre as Páginas
        </h3>
        <ul
          className="text-sm space-y-1"
          style={{ color: t.text.secondary }}
        >
          <li>
            <strong>Home:</strong> Dashboard com cards de Plantões e Férias (estrutura legado), Estágios Residência
          </li>
          <li>
            <strong>Perfil:</strong> Upload de foto, Caixa de Mensagens (placeholder), configurações
          </li>
          <li>
            <strong>Centro de Gestão:</strong> Usuários (com sincronização de responsáveis via Editar Permissões), Documentos, Incidentes (Responsáveis e Painel de Ética), Residência
          </li>
          <li>
            <strong>Painel de Ética:</strong> Incidentes e denúncias do contexto global com navegação para páginas de gestão
          </li>
          <li>
            <strong>Pendências:</strong> Comunicados, Documentos e ROPs pendentes com filtros
          </li>
          <li>
            <strong>Comunicados:</strong> Listagem completa, filtros, visualização detalhada e gestão admin
          </li>
          <li>
            <strong>Canal de Relatos:</strong> Interface para usuários reportarem incidentes e denúncias
          </li>
          <li>
            <strong>Novo Incidente:</strong> Formulário 4 steps com dados salvos no contexto global (IncidentsContext)
          </li>
          <li>
            <strong>Nova Denúncia:</strong> Canal confidencial com opção de anonimato, dados salvos no contexto global
          </li>
          <li>
            <strong>Meus Relatos:</strong> Filtra incidentes e denúncias do usuário logado via IncidentsContext
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PagesShowcase;
