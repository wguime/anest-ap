import { useState, useEffect, Suspense } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"

import {
  BottomNav,
  Spinner,
  useToast,
} from "@/design-system"

import { ReloadPrompt } from "./components/ReloadPrompt"
import { NetworkStatusBanner } from "./components/NetworkStatusBanner"

import { CalculatorShowcase } from "@/design-system/showcase/CalculatorShowcase"
import { pageVariants, pageTransition, prefersReducedMotion } from "@/design-system/utils/motion"

import {
  ChevronLeft,
} from "lucide-react"

import { useUser } from "./contexts/UserContext"
import { SUB_CARD_PARENT } from "./data/rolePermissionTemplates"
import { useActivityTracking } from "./hooks/useActivityTracking"
import { useLockPortraitOrientation } from "./hooks/useLockPortraitOrientation"
import { PrivacyPolicyModal } from "./components/PrivacyPolicyModal"
import LoginPage from "./pages/LoginPage"
import {
  HomePage,
  GestaoPage,
  ProfilePage,
  BibliotecaPage,
  DocumentoDetalhePage,
  CentroGestaoPage,
  IncidentesPage,
  NovoIncidentePage,
  NovaDenunciaPage,
  MeusRelatosPage,
  QRCodeGeneratorPage,
  AcompanhamentoIncidentePage,
  AcompanhamentoDenunciaPage,
  IncidenteGestaoPage,
  DenunciaGestaoPage,
  MenuPage,
  ReunioesPage,
  ReuniaoDetalhePage,
  EducacaoPage,
  NoticiasPage,
  NoticiaDetalhePage,
  CategoriaNoticiasPage,
  UptodatePage,
  UptodateDetalhePage,
  EducacaoContinuadaPage,
  TrilhaDetalhePage,
  CursoDetalhePage,
  CertificadosPage,
  VerificarCertificadoPage,
  PontosPage,
  AulaPlayerPage,
  // Admin Educação
  AdminAulasPage,
  AdminTrilhasPage,
  AdminConteudoPage,
  ControleEducacaoPage,
  ROPsDesafioPage,
  ROPsChoiceMenuPage,
  ROPsSubdivisoesPage,
  ROPsQuizPage,
  ROPsPodcastsPage,
  ROPsRankingPage,
  QualidadePage,
  PainelGestaoPage,
  EscalasPage,
  GerenciarResidenciaPage,
  ResidenciaHubPage,
  ResidenciaAssistentePage,
  TrocasPlantaoPage,
  ConsultaPlantoesPage,
  EscalasFuncionariasHubPage,
  ConsultaSobreavisoPage,
  TrocasSobreavisoPage,
  TrocasPlantaoHospitalarPage,
  AdminTodasTrocasFuncionariasPage,
  AdminTodasTrocasResidenciaPage,
  RelatoriosPage,
  RelatorioTrimestralPage,
  RelatorioIncidentesPage,
  RelatorioIndicadoresPage,
  RelatorioDetalhePage,
  ComitesPage,
  GestaoDocumentalPage,
  AuditoriasPage,
  FinanceiroPage,
  ComunicadosPage,
  PendenciasPage,
  OrganogramaPage,
  EticaBioeticaPage,
  DesastresPage,
  PersonalizarAtalhosPage,
  SearchResultsPage,
  IncidenteDetalhePage,
  DenunciaDetalhePage,
  RastrearRelatoPage,
  // KPI
  KpiInfeccaoPage,
  KpiAdesaoPage,
  KpiEventosPage,
  KpiSatisfacaoPage,
  KpiTempoPage,
  KpiMedicamentosPage,
  // Ética
  DilemasPage,
  ParecerUtiPage,
  DiretrizesPage,
  EmissaoParecerPage,
  CodigoEticaPage,
  // Auditorias
  HigieneMaosPage,
  UsoMedicamentosPage,
  AbreviaturasPage,
  AuditoriasOperacionaisPage,
  AuditoriasConformidadePage,
  PoliticaGestaoQualidadePage,
  PoliticaDisclosurePage,
  RelatorioAuditoriasRopsPage,
  // Desastres
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
  // Comunicacao
  InboxPage,
  MessageDetailPage,
  // Audit Trail
  AuditTrailPage,
  // Planos de Acao (PDCA)
  PlanosAcaoPage,
  NovoPlanoPage,
  PlanoAcaoDetalhePage,
  // KPI Data Entry & Dashboard
  KpiDataEntryPage,
  KpiHistoricoPage,
  KpiIndicadorDetalhePage,
  KpiDashboardOverview,
  // Auditorias Interativas (F5)
  AuditoriasInterativasPage,
  NovaAuditoriaPage,
  ExecucaoAuditoriaPage,
  AuditoriaResultadoPage,
  // Autoavaliacao Qmentum (F6)
  AutoavaliacaoPage,
  AutoavaliacaoAreaPage,
  AutoavaliacaoRopPage,
  AutoavaliacaoRelatorioPage,
  // Dashboard Executivo (F8)
  DashboardExecutivoPage,
  // Criterios UTI
  CriteriosUTIPage,
  // Cateter Peridural
  CateteresPeridualPage,
  NovoCateterPage,
  CateterDetalhePage,
} from "./pages"

import { EducacaoDataProvider } from "./pages/educacao/hooks"

// Componente wrapper para página de Calculadoras
function CalculadorasPageWrapper({ onNavigate, goBack }) {
  // Estado da calculadora selecionada é gerenciado aqui para que o botão
  // "Voltar" do header feche o detalhe antes de sair da página
  const [selectedCalcId, setSelectedCalcId] = useState(null);

  const handleBack = () => {
    if (selectedCalcId) {
      setSelectedCalcId(null); // Fecha detalhe, volta pra lista de calculadoras
    } else {
      goBack(); // Sai da página
    }
  };

  const headerTitle = selectedCalcId ? 'Calculadoras' : 'Calculadoras';

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {headerTitle}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Header via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para compensar header fixo */}
      <div className="h-14" aria-hidden="true" />

      {/* Conteúdo da página - CalculatorShowcase (controlled) */}
      <div className="px-4 sm:px-5 py-4">
        <CalculatorShowcase
          selectedCalc={selectedCalcId}
          onSelectedCalcChange={setSelectedCalcId}
        />
      </div>
    </div>
  );
}

// BottomNav principal. Labels pt-BR ficam no BottomNav (bottom-nav.jsx) via DEFAULT_LABELS por ícone.
function AppBottomNav({ activeNav, onNavClick }) {
  return (
    <BottomNav
      items={[
        { icon: "Home", label: "Início", active: activeNav === "home", id: "home" },
        { icon: "Shield", label: "Gestão", active: activeNav === "shield", id: "shield" },
        { icon: "GraduationCap", label: "Educação", active: activeNav === "education", id: "education" },
        { icon: "Menu", label: "Menu", active: activeNav === "menu", id: "menu" },
      ]}
      onItemClick={onNavClick}
    />
  )
}

// Componente do App principal
function App() {
  const { user, isAuthenticated, isLoading, needsLgpdConsent, acceptLgpd } = useUser()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState("home")
  const [activeNav, setActiveNav] = useState("home")
  const [pageParams, setPageParams] = useState(null)
  const [navigationHistory, setNavigationHistory] = useState([])

  // Activity tracking
  const { trackPageView } = useActivityTracking()

  // Trava orientação em portrait (best-effort — cobre Android Chrome PWA;
  // iOS Safari usa fallback visual via RotateDeviceOverlay)
  useLockPortraitOrientation()

  // Handle /verificar/:uuid deep-link (QR code scan from certificate)
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/verificar\/([a-zA-Z0-9_-]+)$/i);
    if (match) {
      setCurrentPage('verificarCertificado');
      setPageParams({ uuid: match[1] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for Supabase token errors and show toast to user
  useEffect(() => {
    let lastToastTime = 0
    const handleTokenError = () => {
      const now = Date.now()
      // Throttle: show at most once every 30 seconds
      if (now - lastToastTime < 30000) return
      lastToastTime = now
      toast({
        title: 'Erro de conexao',
        description: 'Nao foi possivel autenticar com o servidor. Recarregue a pagina.',
        variant: 'error',
        duration: 10000,
        action: {
          label: 'Recarregar',
          onClick: () => window.location.reload(),
        },
      })
    }
    window.addEventListener('supabase-token-error', handleTokenError)
    return () => window.removeEventListener('supabase-token-error', handleTokenError)
  }, [toast])

  // Scroll para o topo quando a página muda + track page view
  // Also clear any stuck overflow:hidden on body (safety net for modals that didn't clean up)
  useEffect(() => {
    document.body.style.overflow = ''
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    trackPageView(currentPage)
  }, [currentPage, trackPageView])

  // BUG-04 fix: Reset state when unauthenticated (moved out of render to avoid state updates during render)
  // Public pages that don't require authentication
  const PUBLIC_PAGES = ['home', 'verificarCertificado'];
  useEffect(() => {
    if (!isAuthenticated && !PUBLIC_PAGES.includes(currentPage)) {
      if (currentPage !== 'home') setCurrentPage('home')
      if (activeNav !== 'home') setActiveNav('home')
      setNavigationHistory([])
      setPageParams(null)
    }
  }, [isAuthenticated])

  // BUG-08 fix: centroGestao access guard (moved out of render to avoid side effects during render)
  // Also allows: incident responsibles, users with residencia-edit or tec-enf-secretaria-edit
  useEffect(() => {
    if (currentPage === 'centroGestao') {
      const isAdminOrCoord = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()));
      const hasSpecialAccess = !!(
        user?.incidentSettings?.isResponsible ||
        user?.permissions?.['residencia-edit'] ||
        user?.permissions?.['tec-enf-secretaria-edit']
      );
      if (!isAdminOrCoord && !hasSpecialAccess) {
        toast({ title: 'Acesso negado', description: 'Voce nao tem permissao para acessar o Centro de Gestao.', variant: 'destructive' });
        // Navigate back: pop from history or go home
        setNavigationHistory(prev => {
          if (prev.length === 0) {
            if (currentPage !== 'home') {
              setCurrentPage('home')
              setPageParams(null)
              setActiveNav('home')
            }
            return prev
          }
          const newHistory = [...prev]
          const previous = newHistory.pop()
          if (currentPage !== previous.page) setCurrentPage(previous.page)
          setPageParams(previous.params)
          return newHistory
        })
      }
    }
  }, [currentPage, user, toast])

  // Card permission route guard — maps page names to NAV_STRUCTURE card IDs
  const PAGE_TO_CARD = {
    // Home section
    comunicados: 'comunicados',
    pendencias: 'pendencias',
    inbox: 'inbox',
    // Gestao section — top-level
    incidentes: 'incidentes',
    biblioteca: 'biblioteca',
    qualidade: 'qualidade',
    painelGestao: 'painel_gestao',
    planosAcao: 'planos_acao',
    auditorias: 'auditorias',
    auditoriasInterativas: 'auditorias_interativas',
    autoavaliacao: 'autoavaliacao',
    relatorios: 'relatorios',
    organograma: 'organograma',
    eticaBioetica: 'etica_bioetica',
    comites: 'comites',
    desastres: 'desastres',
    gestaoDocumental: 'gestao_documental',
    faturamento: 'faturamento',
    escalas: 'escalas',
    reunioes: 'reunioes',
    reuniaoDetalhe: 'reunioes',
    // Gestao sub-pages (own card IDs in NAV_STRUCTURE)
    novoIncidente: 'relatar_notificacao',
    novaDenuncia: 'fazer_denuncia',
    meusRelatos: 'meus_relatos',
    qrcodeGenerator: 'qrcode_generator',
    // Gestao sub-pages (inherit parent card)
    acompanhamentoIncidente: 'incidentes',
    acompanhamentoDenuncia: 'incidentes',
    'incidente-gestao': 'incidentes',
    'denuncia-gestao': 'incidentes',
    incidenteGestao: 'incidentes',
    denunciaGestao: 'incidentes',
    incidenteDetalhe: 'incidentes',
    denunciaDetalhe: 'incidentes',
    rastrearRelato: 'meus_relatos',
    novoPlanoAcao: 'planos_acao',
    planoAcaoDetalhe: 'planos_acao',
    // KPI sub-pages (each KPI has its own sub-card under painel_gestao)
    kpiInfeccao: 'kpi_infeccao',
    kpiAdesao: 'kpi_adesao',
    kpiEventos: 'kpi_eventos',
    kpiSatisfacao: 'kpi_satisfacao',
    kpiTempo: 'kpi_tempo',
    kpiMedicamentos: 'kpi_medicamentos',
    // Utility KPI pages inherit the parent card (no dedicated sub-card)
    kpiDataEntry: 'painel_gestao',
    kpiHistorico: 'painel_gestao',
    kpiIndicadorDetalhe: 'painel_gestao',
    // Relatorios sub-pages
    relatorioTrimestral: 'rel_trimestral',
    relatorioIncidentes: 'rel_incidentes',
    relatorioIndicadores: 'rel_indicadores',
    relatorioDetalhe: 'relatorios',
    // Auditorias sub-pages (Auditorias Interativas is a separate top-level card)
    novaAuditoria: 'auditorias_interativas',
    execucaoAuditoria: 'auditorias_interativas',
    auditoriaResultado: 'auditorias_interativas',
    higieneMaos: 'aud_higiene_maos',
    usoMedicamentos: 'aud_uso_medicamentos',
    abreviaturas: 'aud_abreviaturas',
    auditoriasOperacionais: 'aud_operacionais',
    auditoriasConformidade: 'aud_conformidade',
    // Audit-support pages inherit parent card
    auditTrail: 'auditorias',
    politicaGestaoQualidade: 'auditorias',
    politicaDisclosure: 'auditorias',
    relatorioAuditoriasRops: 'auditorias',
    // Autoavaliacao sub-pages (no sub-cards — flat)
    autoavaliacaoArea: 'autoavaliacao',
    autoavaliacaoRop: 'autoavaliacao',
    autoavaliacaoRelatorio: 'autoavaliacao',
    // Etica sub-pages
    dilemas: 'dilemas',
    parecerUti: 'parecer_uti',
    diretrizes: 'diretrizes',
    emissaoParecer: 'emissao_parecer',
    codigoEtica: 'codigo_etica',
    // Desastres sub-pages
    emergenciaIncendio: 'emerg_incendio',
    emergenciaVitimas: 'emerg_vitimas',
    emergenciaPane: 'emerg_pane',
    emergenciaQuimico: 'emerg_quimico',
    emergenciaInundacao: 'emerg_inundacao',
    emergenciaBomba: 'emerg_bomba',
    planoManual: 'plano_manual',
    planoTimes: 'plano_times',
    planoApoio: 'plano_apoio',
    planoSimulado: 'plano_simulado',
    // Faturamento sub-pages
    faturamentoDashboard: 'fat_dashboard',
    faturamentoEventos: 'fat_eventos',
    faturamentoNovoEvento: 'fat_eventos',
    faturamentoEventoDetalhe: 'fat_eventos',
    faturamentoNotas: 'fat_notas',
    faturamentoNotaDetalhe: 'fat_notas',
    faturamentoNovaNota: 'fat_notas',
    faturamentoConvenios: 'fat_convenios',
    financeiro: 'financeiro',
    // Faturamento utility pages inherit parent
    faturamentoLotes: 'faturamento',
    faturamentoCobrancas: 'faturamento',
    faturamentoRecursos: 'faturamento',
    faturamentoHospitais: 'faturamento',
    faturamentoCirurgioes: 'faturamento',
    faturamentoAnestesistas: 'faturamento',
    // Dashboard section
    dashboardExecutivo: 'dashboard_executivo',
    kpiDashboard: 'dashboard_executivo',
    // Educacao section — admin pages mapped to dedicated sub-cards
    educacaoContinuada: 'educacao_continuada',
    trilhaDetalhe: 'ec_trilhas',
    cursoDetalhe: 'ec_trilhas',
    certificados: 'ec_certificados',
    pontos: 'ec_pontos',
    aulaPlayer: 'ec_trilhas',
    adminTrilhas: 'ec_admin_trilhas',
    adminAulas: 'ec_admin_aulas',
    adminConteudo: 'ec_admin_conteudo',
    ropsDesafio: 'rops_desafio',
    ropsChoiceMenu: 'rops_desafio',
    ropsSubdivisoes: 'rops_desafio',
    ropsQuiz: 'rops_quiz',
    ropsPodcasts: 'rops_podcasts',
    ropsRanking: 'rops_ranking',
    residencia: 'residencia',
    gerenciarResidencia: 'res_gerenciar',
    assistenteResidencia: 'res_assistente',
    trocasPlantao: 'res_trocas_plantao',
    consultaPlantoes: 'res_consulta_plantoes',
    // Menu section
    calculadoras: 'calculadoras',
    criteriosUti: 'criterios_uti',
    cateteresPeridural: 'cateter_peridural',
    novoCateter: 'cp_novo',
    cateterDetalhe: 'cp_listagem',
    escalasFuncionarias: 'escalas_sobreaviso',
    consultaSobreaviso: 'consulta_sobreaviso',
    trocasSobreaviso: 'trocas_sobreaviso',
    trocasPlantaoHospitalar: 'trocas_sobreaviso',
    adminTodasTrocasFuncionarias: 'trocas_sobreaviso',
    adminTodasTrocasResidencia: 'res_trocas_plantao',
  };

  useEffect(() => {
    const cardId = PAGE_TO_CARD[currentPage];
    if (!cardId) return;
    if (user?.isAdmin || user?.isCoordenador) return;
    if (!user?.permissions) return;

    // Cascade: if the page maps to a sub-card and the parent is explicitly OFF,
    // block even when the sub-card itself is undefined or true.
    const parentId = SUB_CARD_PARENT[cardId];
    const parentBlocked = parentId && user.permissions[parentId] === false;
    const selfBlocked = user.permissions[cardId] === false;

    if (parentBlocked || selfBlocked) {
      console.warn(`[RouteGuard] Acesso negado: page="${currentPage}" cardId="${cardId}" parentBlocked=${!!parentBlocked}`);
      toast({ title: 'Acesso restrito', description: 'Voce nao tem permissao para acessar esta secao.', variant: 'destructive' });
      if (currentPage !== 'home') {
        setCurrentPage('home');
        setActiveNav('home');
        setPageParams(null);
        setNavigationHistory([]);
      }
    }
  }, [currentPage, user, toast])

  // Loading state - mostra spinner enquanto verifica autenticação
  // Paginas publicas (verificacao de certificado) nao precisam esperar auth
  if (isLoading && currentPage !== 'verificarCertificado') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  // Pagina publica de verificacao de certificado — renderizada standalone (sem nav, sem layout do app)
  if (currentPage === 'verificarCertificado') {
    return (
      <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-background"><Spinner size="lg" /></div>}>
        <VerificarCertificadoPage certificadoId={pageParams?.uuid} />
      </Suspense>
    )
  }

  // Se não autenticado, mostra LoginPage
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // LGPD: exibir modal de consentimento no primeiro login
  if (needsLgpdConsent) {
    return (
      <div className="min-h-dvh bg-background">
        <PrivacyPolicyModal onClose={() => acceptLgpd()} />
      </div>
    )
  }

  // Handler de navegação
  const handleNavigate = (page, params = null, fromParamsOverride = undefined) => {
    // Parsear formato "page:id" (ex: "comunicados:com-123")
    if (typeof page === 'string' && page.includes(':')) {
      const [actualPage, ...rest] = page.split(':');
      const id = rest.join(':');
      page = actualPage;
      params = params || { comunicadoId: id };
    }

    // Salvar estado atual no histórico ANTES de navegar.
    // fromParamsOverride permite à página de origem capturar estado interno
    // (ex.: aba de hospital ativo) para restauração via goBack().
    if (currentPage) {
      setNavigationHistory(prev => [...prev, {
        page: currentPage,
        params: fromParamsOverride !== undefined ? fromParamsOverride : pageParams
      }])
    }

    setCurrentPage(page)
    setPageParams(params)
    // Atualizar activeNav baseado na página
    if (['permissions', 'centroGestao', 'inbox', 'messageDetail', 'profile'].includes(page)) setActiveNav(null)
    else if (page === 'home') setActiveNav('home')
    else if (['pendencias', 'comunicados', 'searchResults'].includes(page)) setActiveNav('home')
    else if (['dashboardExecutivo', 'painelGestao', 'kpiDashboard'].includes(page)) setActiveNav('dashboard')
    else if (['gestao', 'qualidade', 'comites', 'gestaoDocumental', 'incidentes', 'novoIncidente', 'novaDenuncia', 'meusRelatos', 'qrcodeGenerator', 'acompanhamentoIncidente', 'acompanhamentoDenuncia', 'incidente-gestao', 'denuncia-gestao', 'incidenteGestao', 'denunciaGestao', 'biblioteca', 'documento-detalhe', 'reunioes', 'reuniaoDetalhe', 'escalas', 'relatorios', 'relatorioTrimestral', 'relatorioIncidentes', 'relatorioIndicadores', 'relatorioDetalhe', 'auditorias', 'faturamento', 'faturamentoDashboard', 'faturamentoEventos', 'faturamentoNovoEvento', 'faturamentoEventoDetalhe', 'faturamentoNotas', 'faturamentoNotaDetalhe', 'faturamentoNovaNota', 'faturamentoConvenios', 'faturamentoLotes', 'faturamentoCobrancas', 'faturamentoRecursos', 'faturamentoHospitais', 'faturamentoCirurgioes', 'faturamentoAnestesistas', 'financeiro', 'organograma', 'eticaBioetica', 'desastres', 'incidenteDetalhe', 'denunciaDetalhe', 'rastrearRelato', 'kpiInfeccao', 'kpiAdesao', 'kpiEventos', 'kpiSatisfacao', 'kpiTempo', 'kpiMedicamentos', 'kpiDataEntry', 'kpiHistorico', 'kpiIndicadorDetalhe', 'planosAcao', 'novoPlanoAcao', 'planoAcaoDetalhe', 'dilemas', 'parecerUti', 'diretrizes', 'emissaoParecer', 'codigoEtica', 'higieneMaos', 'usoMedicamentos', 'abreviaturas', 'auditoriasOperacionais', 'auditoriasConformidade', 'politicaGestaoQualidade', 'politicaDisclosure', 'relatorioAuditoriasRops', 'emergenciaIncendio', 'emergenciaVitimas', 'emergenciaPane', 'emergenciaQuimico', 'emergenciaInundacao', 'emergenciaBomba', 'planoManual', 'planoTimes', 'planoApoio', 'planoSimulado', 'auditTrail', 'auditoriasInterativas', 'novaAuditoria', 'execucaoAuditoria', 'auditoriaResultado', 'autoavaliacao', 'autoavaliacaoArea', 'autoavaliacaoRop', 'autoavaliacaoRelatorio'].includes(page)) setActiveNav('shield')
    else if (['educacao', 'ropsDesafio', 'ropsChoiceMenu', 'ropsSubdivisoes', 'ropsQuiz', 'ropsPodcasts', 'ropsRanking', 'residencia', 'educacaoContinuada', 'cursoDetalhe', 'aulaPlayer', 'certificados', 'pontos', 'adminAulas', 'adminTrilhas', 'adminConteudo', 'relatoriosEducacao', 'controleEducacao', 'assistenteResidencia', 'trocasPlantao', 'consultaPlantoes'].includes(page)) setActiveNav('education')
    else if (['calculadoras', 'criteriosUti', 'menuPage', 'menu', 'gerenciarResidencia', 'personalizarAtalhos', 'cateteresPeridural', 'novoCateter', 'cateterDetalhe', 'escalasFuncionarias', 'consultaSobreaviso', 'trocasSobreaviso', 'trocasPlantaoHospitalar', 'adminTodasTrocasFuncionarias', 'adminTodasTrocasResidencia'].includes(page)) setActiveNav('menu')

    // Scroll para o topo da página
    window.scrollTo(0, 0)
  }

  // Função para voltar para a página anterior
  const goBack = () => {
    if (navigationHistory.length === 0) {
      // Sem histórico, voltar para home
      setCurrentPage('home')
      setPageParams(null)
      setActiveNav('home')
      window.scrollTo(0, 0)
      return
    }

    // Pegar última entrada do histórico
    const newHistory = [...navigationHistory]
    const previous = newHistory.pop()

    setNavigationHistory(newHistory)
    setCurrentPage(previous.page)
    setPageParams(previous.params)

    // Atualizar activeNav baseado na página anterior
    if (['permissions', 'centroGestao', 'inbox', 'messageDetail', 'profile'].includes(previous.page)) setActiveNav(null)
    else if (previous.page === 'home') setActiveNav('home')
    else if (['pendencias', 'comunicados', 'searchResults'].includes(previous.page)) setActiveNav('home')
    else if (['dashboardExecutivo', 'painelGestao', 'kpiDashboard'].includes(previous.page)) setActiveNav('dashboard')
    else if (['gestao', 'qualidade', 'comites', 'gestaoDocumental', 'incidentes', 'novoIncidente', 'novaDenuncia', 'meusRelatos', 'qrcodeGenerator', 'acompanhamentoIncidente', 'acompanhamentoDenuncia', 'incidente-gestao', 'denuncia-gestao', 'incidenteGestao', 'denunciaGestao', 'biblioteca', 'documento-detalhe', 'reunioes', 'reuniaoDetalhe', 'escalas', 'relatorios', 'relatorioTrimestral', 'relatorioIncidentes', 'relatorioIndicadores', 'relatorioDetalhe', 'auditorias', 'faturamento', 'faturamentoDashboard', 'faturamentoEventos', 'faturamentoNovoEvento', 'faturamentoEventoDetalhe', 'faturamentoNotas', 'faturamentoNotaDetalhe', 'faturamentoNovaNota', 'faturamentoConvenios', 'financeiro', 'organograma', 'eticaBioetica', 'desastres', 'incidenteDetalhe', 'denunciaDetalhe', 'rastrearRelato', 'kpiInfeccao', 'kpiAdesao', 'kpiEventos', 'kpiSatisfacao', 'kpiTempo', 'kpiMedicamentos', 'kpiDataEntry', 'kpiHistorico', 'kpiIndicadorDetalhe', 'planosAcao', 'novoPlanoAcao', 'planoAcaoDetalhe', 'dilemas', 'parecerUti', 'diretrizes', 'emissaoParecer', 'codigoEtica', 'higieneMaos', 'usoMedicamentos', 'abreviaturas', 'auditoriasOperacionais', 'auditoriasConformidade', 'politicaGestaoQualidade', 'politicaDisclosure', 'relatorioAuditoriasRops', 'emergenciaIncendio', 'emergenciaVitimas', 'emergenciaPane', 'emergenciaQuimico', 'emergenciaInundacao', 'emergenciaBomba', 'planoManual', 'planoTimes', 'planoApoio', 'planoSimulado', 'auditTrail', 'auditoriasInterativas', 'novaAuditoria', 'execucaoAuditoria', 'auditoriaResultado', 'autoavaliacao', 'autoavaliacaoArea', 'autoavaliacaoRop', 'autoavaliacaoRelatorio'].includes(previous.page)) setActiveNav('shield')
    else if (['educacao', 'ropsDesafio', 'ropsChoiceMenu', 'ropsSubdivisoes', 'ropsQuiz', 'ropsPodcasts', 'ropsRanking', 'residencia', 'educacaoContinuada', 'cursoDetalhe', 'aulaPlayer', 'certificados', 'pontos', 'adminAulas', 'adminTrilhas', 'adminConteudo', 'relatoriosEducacao', 'controleEducacao', 'assistenteResidencia', 'trocasPlantao', 'consultaPlantoes'].includes(previous.page)) setActiveNav('education')
    else if (['calculadoras', 'criteriosUti', 'menuPage', 'menu', 'gerenciarResidencia', 'personalizarAtalhos', 'cateteresPeridural', 'novoCateter', 'cateterDetalhe', 'escalasFuncionarias', 'consultaSobreaviso', 'trocasSobreaviso', 'trocasPlantaoHospitalar', 'adminTodasTrocasFuncionarias', 'adminTodasTrocasResidencia'].includes(previous.page)) setActiveNav('menu')

    // Scroll para o topo da página
    window.scrollTo(0, 0)
  }

  // Handler do BottomNav
  const handleNavClick = (item) => {
    setActiveNav(item.id)
    // BUG-03 fix: reset pageParams and navigationHistory on nav click
    setPageParams(null)
    setNavigationHistory([])
    switch (item.id) {
      case 'home':
        setCurrentPage('home')
        break
      case 'shield':
        setCurrentPage('gestao')
        break
      case 'dashboard':
        setCurrentPage('dashboardExecutivo')
        break
      case 'education':
        setCurrentPage('educacao')
        break
      case 'menu':
        setCurrentPage('menuPage')
        break
      default:
        break
    }
  }

  // Renderizar página atual do app
  const renderAppPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />
      case 'gestao':
        return <GestaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'profile':
        return <ProfilePage onNavigate={handleNavigate} goBack={goBack} />
      case 'biblioteca':
        return <BibliotecaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'documento-detalhe': {
        const docIsAdmin = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()));
        return <DocumentoDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} isAdmin={docIsAdmin} />
      }
      case 'qualidade':
        return <QualidadePage onNavigate={handleNavigate} goBack={goBack} />
      case 'comites':
        return <ComitesPage onNavigate={handleNavigate} goBack={goBack} />
      case 'gestaoDocumental':
        return <GestaoDocumentalPage onNavigate={handleNavigate} goBack={goBack} />
      case 'painelGestao':
        return <PainelGestaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'escalas':
        return <EscalasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'permissions':
        return <CentroGestaoPage onNavigate={handleNavigate} goBack={goBack} initialSection={pageParams?.initialSection || 'usuarios'} />
      case 'menuPage':
        return <MenuPage onNavigate={handleNavigate} goBack={goBack} />
      case 'calculadoras':
        return <CalculadorasPageWrapper onNavigate={handleNavigate} goBack={goBack} />
      case 'criteriosUti':
        return <CriteriosUTIPage onNavigate={handleNavigate} goBack={goBack} />
      // Cateter Peridural
      case 'cateteresPeridural':
        return <CateteresPeridualPage key={`cateter-${pageParams?.hospital || 'unimed'}`} onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'novoCateter':
        return <NovoCateterPage onNavigate={handleNavigate} goBack={goBack} />
      case 'cateterDetalhe':
        return <CateterDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // Páginas de Incidentes
      case 'incidentes':
        return <IncidentesPage onNavigate={handleNavigate} goBack={goBack} />
      case 'novoIncidente':
        return <NovoIncidentePage onNavigate={handleNavigate} goBack={goBack} />
      case 'novaDenuncia':
        return <NovaDenunciaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'meusRelatos':
        return <MeusRelatosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'qrcodeGenerator':
        return <QRCodeGeneratorPage onNavigate={handleNavigate} goBack={goBack} />
      case 'acompanhamentoIncidente':
        return <AcompanhamentoIncidentePage onNavigate={handleNavigate} goBack={goBack} incidenteId={pageParams?.id} />
      case 'acompanhamentoDenuncia':
        return <AcompanhamentoDenunciaPage onNavigate={handleNavigate} goBack={goBack} denunciaId={pageParams?.id} />
      case 'incidente-gestao':
        return <IncidenteGestaoPage onNavigate={handleNavigate} goBack={goBack} incidenteId={pageParams?.id} params={pageParams} />
      case 'denuncia-gestao':
        return <DenunciaGestaoPage onNavigate={handleNavigate} goBack={goBack} denunciaId={pageParams?.id} params={pageParams} />
      case 'reunioes':
        return <ReunioesPage onNavigate={handleNavigate} goBack={goBack} user={user} />
      case 'reuniaoDetalhe':
        return <ReuniaoDetalhePage onNavigate={handleNavigate} goBack={goBack} reuniaoId={pageParams?.id} user={user} />
      case 'educacao':
        return <EducacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'noticias':
        return <NoticiasPage key="noticias" onNavigate={handleNavigate} goBack={goBack} />
      case 'noticia-detalhe':
        return <NoticiaDetalhePage key={`noticia-${pageParams?.noticiaId}`} noticiaId={pageParams?.noticiaId} onNavigate={handleNavigate} goBack={goBack} />
      case 'categoria-noticias':
        return <CategoriaNoticiasPage key={`cat-${pageParams?.category}`} category={pageParams?.category} onNavigate={handleNavigate} goBack={goBack} />
      case 'uptodate':
        return <UptodatePage key="uptodate" onNavigate={handleNavigate} goBack={goBack} />
      case 'uptodate-detalhe':
        return <UptodateDetalhePage key={`uptodate-${pageParams?.topicId}`} topicId={pageParams?.topicId} onNavigate={handleNavigate} goBack={goBack} />
      case 'educacaoContinuada':
        return <EducacaoContinuadaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'trilhaDetalhe':
        return <TrilhaDetalhePage onNavigate={handleNavigate} goBack={goBack} trilhaId={pageParams?.trilhaId} />
      case 'cursoDetalhe':
        return <CursoDetalhePage onNavigate={handleNavigate} goBack={goBack} cursoId={pageParams?.cursoId} />
      case 'certificados':
        return <CertificadosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'verificarCertificado':
        return <VerificarCertificadoPage certificadoId={pageParams?.uuid} />
      case 'pontos':
        return <PontosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'aulaPlayer':
        return <AulaPlayerPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // Admin Educação (protegido por role)
      case 'adminAulas':
        return <AdminAulasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'adminTrilhas':
        return <AdminTrilhasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'adminConteudo':
        return <AdminConteudoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatoriosEducacao':
        return <ControleEducacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'controleEducacao':
        return <ControleEducacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'ropsDesafio':
        return <ROPsDesafioPage onNavigate={handleNavigate} goBack={goBack} />
      case 'ropsChoiceMenu':
        return <ROPsChoiceMenuPage onNavigate={handleNavigate} goBack={goBack} areaKey={pageParams?.areaKey} />
      case 'ropsSubdivisoes':
        return <ROPsSubdivisoesPage onNavigate={handleNavigate} goBack={goBack} areaKey={pageParams?.areaKey} />
      case 'ropsQuiz':
        return <ROPsQuizPage onNavigate={handleNavigate} goBack={goBack} areaKey={pageParams?.areaKey} ropKey={pageParams?.ropKey} />
      case 'ropsPodcasts':
        return <ROPsPodcastsPage onNavigate={handleNavigate} goBack={goBack} areaKey={pageParams?.areaKey} />
      case 'ropsRanking':
        return <ROPsRankingPage onNavigate={handleNavigate} goBack={goBack} />
      case 'gerenciarResidencia':
        return <GerenciarResidenciaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'assistenteResidencia':
        return <ResidenciaAssistentePage onNavigate={handleNavigate} goBack={goBack} />
      case 'trocasPlantao':
        return <TrocasPlantaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'consultaPlantoes':
        return <ConsultaPlantoesPage onNavigate={handleNavigate} goBack={goBack} />
      // Escalas Funcionárias (sobreaviso + hospitais + consultório)
      case 'escalasFuncionarias':
        return <EscalasFuncionariasHubPage onNavigate={handleNavigate} goBack={goBack} />
      case 'consultaSobreaviso':
        return <ConsultaSobreavisoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'trocasSobreaviso':
        return <TrocasSobreavisoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'trocasPlantaoHospitalar':
        return <TrocasPlantaoHospitalarPage key="trocasPlantaoHospitalar" onNavigate={handleNavigate} goBack={goBack} />
      case 'adminTodasTrocasFuncionarias':
        return <AdminTodasTrocasFuncionariasPage key="adminTodasTrocasFuncionarias" goBack={goBack} />
      case 'adminTodasTrocasResidencia':
        return <AdminTodasTrocasResidenciaPage key="adminTodasTrocasResidencia" goBack={goBack} />
      // Páginas de Relatórios
      case 'relatorios':
        return <RelatoriosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatorioTrimestral':
        return <RelatorioTrimestralPage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatorioIncidentes':
        return <RelatorioIncidentesPage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatorioIndicadores':
        return <RelatorioIndicadoresPage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatorioDetalhe':
        return <RelatorioDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'auditorias':
        return <AuditoriasPage onNavigate={handleNavigate} goBack={goBack} />
      // Comunicacao
      case 'inbox':
        return <InboxPage onNavigate={handleNavigate} goBack={goBack} />
      case 'messageDetail':
        return <MessageDetailPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // Faturamento
      case 'faturamento':
        return <FaturamentoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoDashboard':
        return <FaturamentoDashboardPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoEventos':
        return <FaturamentoEventosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoNovoEvento':
        return <FaturamentoNovoEventoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoNotas':
        return <FaturamentoNotasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoConvenios':
        return <FaturamentoConveniosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'faturamentoEventoDetalhe':
        return <FaturamentoEventoDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'faturamentoNotaDetalhe':
        return <FaturamentoNotaDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'faturamentoNovaNota':
        return <FaturamentoNovaNotaPage onNavigate={handleNavigate} goBack={goBack} />
      // Páginas de nível principal
      case 'financeiro':
        return <FinanceiroPage onNavigate={handleNavigate} goBack={goBack} />
      case 'comunicados':
        return <ComunicadosPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'pendencias':
        return <PendenciasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'organograma':
        return <OrganogramaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'eticaBioetica':
        return <EticaBioeticaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'desastres':
        return <DesastresPage onNavigate={handleNavigate} goBack={goBack} />
      case 'personalizarAtalhos':
        return <PersonalizarAtalhosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'centroGestao': {
        // BUG-08 fix: access guard moved to useEffect to avoid side effects during render
        const isAdminOrCoord = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()));
        const hasSpecialCentroAccess = !!(
          user?.incidentSettings?.isResponsible ||
          user?.permissions?.['residencia-edit'] ||
          user?.permissions?.['tec-enf-secretaria-edit']
        );
        if (!isAdminOrCoord && !hasSpecialCentroAccess) return null;
        return <CentroGestaoPage onNavigate={handleNavigate} goBack={goBack} initialSection={pageParams?.initialSection || 'usuarios'} />;
      }
      case 'incidenteDetalhe':
        return <IncidenteDetalhePage onNavigate={handleNavigate} goBack={goBack} incidenteId={pageParams?.id} />
      case 'denunciaDetalhe':
        return <DenunciaDetalhePage onNavigate={handleNavigate} goBack={goBack} denunciaId={pageParams?.id} />
      case 'rastrearRelato':
        return <RastrearRelatoPage onNavigate={handleNavigate} goBack={goBack} />
      // KPI
      case 'kpiInfeccao':
        return <KpiInfeccaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiAdesao':
        return <KpiAdesaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiEventos':
        return <KpiEventosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiSatisfacao':
        return <KpiSatisfacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiTempo':
        return <KpiTempoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiMedicamentos':
        return <KpiMedicamentosPage onNavigate={handleNavigate} goBack={goBack} />
      // Ética
      case 'dilemas':
        return <DilemasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'parecerUti':
        return <ParecerUtiPage onNavigate={handleNavigate} goBack={goBack} />
      case 'diretrizes':
        return <DiretrizesPage onNavigate={handleNavigate} goBack={goBack} />
      case 'emissaoParecer':
        return <EmissaoParecerPage onNavigate={handleNavigate} goBack={goBack} />
      case 'codigoEtica':
        return <CodigoEticaPage onNavigate={handleNavigate} goBack={goBack} />
      // Auditorias
      case 'higieneMaos':
        return <HigieneMaosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'usoMedicamentos':
        return <UsoMedicamentosPage onNavigate={handleNavigate} goBack={goBack} />
      case 'abreviaturas':
        return <AbreviaturasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'auditoriasOperacionais':
        return <AuditoriasOperacionaisPage onNavigate={handleNavigate} goBack={goBack} />
      case 'auditoriasConformidade':
        return <AuditoriasConformidadePage onNavigate={handleNavigate} goBack={goBack} />
      case 'politicaGestaoQualidade':
        return <PoliticaGestaoQualidadePage onNavigate={handleNavigate} goBack={goBack} />
      case 'politicaDisclosure':
        return <PoliticaDisclosurePage onNavigate={handleNavigate} goBack={goBack} />
      case 'relatorioAuditoriasRops':
        return <RelatorioAuditoriasRopsPage onNavigate={handleNavigate} goBack={goBack} />
      // Desastres
      case 'emergenciaIncendio':
        return <EmergenciaIncendioPage onNavigate={handleNavigate} goBack={goBack} />
      case 'emergenciaVitimas':
        return <EmergenciaVitimasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'emergenciaPane':
        return <EmergenciaPanePage onNavigate={handleNavigate} goBack={goBack} />
      case 'emergenciaQuimico':
        return <EmergenciaQuimicoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'emergenciaInundacao':
        return <EmergenciaInundacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'emergenciaBomba':
        return <EmergenciaBombaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'planoManual':
        return <PlanoManualPage onNavigate={handleNavigate} goBack={goBack} />
      case 'planoTimes':
        return <PlanoTimesPage onNavigate={handleNavigate} goBack={goBack} />
      case 'planoApoio':
        return <PlanoApoioPage onNavigate={handleNavigate} goBack={goBack} />
      case 'planoSimulado':
        return <PlanoSimuladoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'searchResults':
        return <SearchResultsPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // Aliases de navegação (nomes alternativos usados por componentes internos)
      case 'menu':
        return <MenuPage onNavigate={handleNavigate} goBack={goBack} />
      case 'residencia':
        return <ResidenciaHubPage onNavigate={handleNavigate} goBack={goBack} />
      case 'incidenteGestao':
        return <IncidenteGestaoPage onNavigate={handleNavigate} goBack={goBack} incidenteId={pageParams?.id} params={pageParams} />
      case 'denunciaGestao':
        return <DenunciaGestaoPage onNavigate={handleNavigate} goBack={goBack} denunciaId={pageParams?.id} params={pageParams} />
      // Planos de Acao (PDCA)
      case 'planosAcao':
        return <PlanosAcaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'novoPlanoAcao':
        return <NovoPlanoPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'planoAcaoDetalhe':
        return <PlanoAcaoDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // KPI Data Entry & Dashboard
      case 'kpiDataEntry':
        return <KpiDataEntryPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiHistorico':
        return <KpiHistoricoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'kpiIndicadorDetalhe':
        return <KpiIndicadorDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'kpiDashboard':
        return <KpiDashboardOverview onNavigate={handleNavigate} goBack={goBack} />
      // Audit Trail
      case 'auditTrail':
        return <AuditTrailPage onNavigate={handleNavigate} goBack={goBack} />
      // Auditorias Interativas (F5)
      case 'auditoriasInterativas':
        return <AuditoriasInterativasPage onNavigate={handleNavigate} goBack={goBack} />
      case 'novaAuditoria':
        return <NovaAuditoriaPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'execucaoAuditoria':
        return <ExecucaoAuditoriaPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'auditoriaResultado':
        return <AuditoriaResultadoPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      // Autoavaliacao Qmentum (F6)
      case 'autoavaliacao':
        return <AutoavaliacaoPage onNavigate={handleNavigate} goBack={goBack} />
      case 'autoavaliacaoArea':
        return <AutoavaliacaoAreaPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'autoavaliacaoRop':
        return <AutoavaliacaoRopPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
      case 'autoavaliacaoRelatorio':
        return <AutoavaliacaoRelatorioPage onNavigate={handleNavigate} goBack={goBack} />
      // Dashboard Executivo (F8)
      case 'dashboard':
      case 'dashboardExecutivo':
        return <DashboardExecutivoPage onNavigate={handleNavigate} goBack={goBack} />
      default:
        return <HomePage onNavigate={handleNavigate} />
    }
  }

  // Renderiza o app principal com navegação
  return (
    <div className="min-h-dvh bg-background text-foreground dark:bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1500] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>

      {/* Banner de status de rede (offline/lento) */}
      <NetworkStatusBanner />

      {/* Prompt de atualizacao do Service Worker */}
      <ReloadPrompt />

      {/* Container limita largura no desktop (mobile = 100% width) */}
      <main id="main-content" tabIndex={-1} className="container focus:outline-none">
      <EducacaoDataProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-dvh"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentPage}
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={prefersReducedMotion() ? { duration: 0 } : pageTransition}
            >
              {renderAppPage()}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </EducacaoDataProvider>
      </main>

      {/* TODO BUG-06: This global BottomNav may duplicate with per-page BottomNav instances.
          Most pages (63+) render their own BottomNav via the documented createPortal pattern.
          This causes double BottomNav on those pages. Architectural decision needed:
          either remove this global one and ensure ALL pages render their own,
          or remove per-page instances and keep only this global one. */}
      {/* BottomNav fixo (escondido no AulaPlayerPage para não cobrir controles do YouTube) */}
      {currentPage !== 'aulaPlayer' && (
        <AppBottomNav
          activeNav={activeNav}
          onNavClick={handleNavClick}
        />
      )}

      {/* Overlay para bloquear modo paisagem (exceto em fullscreen e AulaPlayerPage) */}
      {currentPage !== 'aulaPlayer' && (
        <div className="landscape-block-overlay">
          <div className="w-16 h-16 mb-4 text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M12 18h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Gire seu dispositivo
          </h2>
          <p className="text-sm text-muted-foreground">
            Este aplicativo funciona melhor em modo retrato.
            <br />
            Para assistir vídeos em tela cheia, use o botão de expandir.
          </p>
        </div>
      )}
    </div>
  )
}

export default App
