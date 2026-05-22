import { useState, useEffect, useId, Suspense, lazy } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"

import { BottomNav, ErrorBoundary, useToast } from "@/design-system"
import { PageLoadingFallback } from "@/design-system/components/anest/page-loading-fallback"
import { SearchToggleButton } from "@/design-system/components/anest/search-toggle-button"
import { SearchBar } from "@/design-system/components/anest/search-bar"
import { Collapsible, CollapsibleContent } from "@/design-system/components/ui/collapsible"

import { ReloadPrompt } from "./components/ReloadPrompt"
import { NetworkStatusBanner } from "./components/NetworkStatusBanner"
import { PushNotificationOptIn } from "./components/PushNotificationOptIn"
import { useOfflineQueueFlush } from "./hooks/useOfflineQueueFlush"

// CalculatorShowcase é o maior arquivo do app (~2.5k linhas, 76 calculadoras
// inline). Carrega sob demanda quando user abre /calculadoras.
const CalculatorShowcase = lazy(() =>
  import("@/design-system/showcase/CalculatorShowcase").then((m) => ({
    default: m.CalculatorShowcase,
  }))
)
import { pageVariants, pageTransition, prefersReducedMotion } from "@/design-system/utils/motion"

import { ChevronLeft } from "lucide-react"

import { useUser } from "./contexts/UserContext"
import { useCateterPeridural } from "./contexts/CateterPeridualContext"
import { reportError } from "@/services/errorReporting"
import { SUB_CARD_PARENT } from "./data/rolePermissionTemplates"
import { isBulkImportEnabled } from "./utils/featureFlags"
import { useActivityTracking } from "./hooks/useActivityTracking"
import { useLockPortraitOrientation } from "./hooks/useLockPortraitOrientation"
import { PrivacyPolicyModal } from "./components/PrivacyPolicyModal"
import { canAccessCentroGestao, canAccessIncidentManagement } from "./pages/management/utils/incidentAccess"
// ─── Eager imports (paths diretos, não via barrel) ───────────────────────────
// Páginas críticas (initial path, hubs de navegação).
// Importadas via path direto (NÃO via "./pages") para evitar que o barrel
// estático do `pages/index.js` puxe as páginas pesadas pro main bundle.
// LoginPage e Verificar* vivem em main.jsx (gate de auth + URLs públicas).
import HomePage from "./pages/HomePage"
import GestaoPage from "./pages/GestaoPage"
import MenuPage from "./pages/MenuPage"
import QualidadePage from "./pages/QualidadePage"

// Páginas frequentes mas não-críticas — lazy mesmo (perfil, comunicados,
// pendências, notícias, etc.). Comunicados é a maior (1.8k linhas).
const ProfilePage = lazy(() => import("./pages/ProfilePage"))
const ComunicadosPage = lazy(() => import("./pages/ComunicadosPage"))
const PendenciasPage = lazy(() => import("./pages/PendenciasPage"))
const NoticiasPage = lazy(() => import("./pages/NoticiasPage"))
const NoticiaDetalhePage = lazy(() => import("./pages/NoticiaDetalhePage"))
const CategoriaNoticiasPage = lazy(() => import("./pages/CategoriaNoticiasPage"))
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"))

// ─── Lazy imports — rotas pesadas/secundárias ────────────────────────────────
// Cada `lazy()` cria um chunk próprio. Reduz main bundle e Time-To-Interactive
// em mobile. Path direto evita o problema do barrel `./pages` que força tudo
// pro main chunk (Vite warning: "dynamically imported but also statically
// imported by pages/index.js"). Mantemos os defaults onde existem; subpáginas
// que são named exports usam `.then(m => ({ default: m.X }))`.

// Detalhe / docs (PDF viewer pesado)
const DocumentoDetalhePage = lazy(() => import("./pages/DocumentoDetalhePage"))
const BibliotecaPage = lazy(() => import("./pages/BibliotecaPage"))
const GestaoDocumentalPage = lazy(() => import("./pages/GestaoDocumentalPage"))

// Centro de Gestão / Admin
const CentroGestaoPage = lazy(() => import("./pages/management/CentroGestaoPage"))
const BulkImportPage = lazy(() => import("./pages/management/BulkImportPage"))
const AuditTrailPage = lazy(() => import("./pages/management/documents/AuditTrailPage"))

// Educação
const EducacaoPage = lazy(() => import("./pages/EducacaoPage"))
const EducacaoContinuadaPage = lazy(() =>
  import("./pages/educacao/EducacaoContinuadaPage").then((m) => ({ default: m.default || m.EducacaoContinuadaPage }))
)
const TrilhaDetalhePage = lazy(() =>
  import("./pages/educacao/TrilhaDetalhePage").then((m) => ({ default: m.default || m.TrilhaDetalhePage }))
)
const CursoDetalhePage = lazy(() =>
  import("./pages/educacao/CursoDetalhePage").then((m) => ({ default: m.default || m.CursoDetalhePage }))
)
const CertificadosPage = lazy(() =>
  import("./pages/educacao/CertificadosPage").then((m) => ({ default: m.default || m.CertificadosPage }))
)
const PontosPage = lazy(() =>
  import("./pages/educacao/PontosPage").then((m) => ({ default: m.default || m.PontosPage }))
)
const AulaPlayerPage = lazy(() =>
  import("./pages/educacao/AulaPlayerPage").then((m) => ({ default: m.default || m.AulaPlayerPage }))
)

// Admin Educação
const AdminAulasPage = lazy(() =>
  import("./pages/educacao/admin/AdminAulasPage").then((m) => ({ default: m.default || m.AdminAulasPage }))
)
const AdminTrilhasPage = lazy(() =>
  import("./pages/educacao/admin/AdminTrilhasPage").then((m) => ({ default: m.default || m.AdminTrilhasPage }))
)
const AdminConteudoPage = lazy(() =>
  import("./pages/educacao/admin/AdminConteudoPage").then((m) => ({ default: m.default || m.AdminConteudoPage }))
)
const ControleEducacaoPage = lazy(() =>
  import("./pages/educacao/admin/ControleEducacaoPage").then((m) => ({ default: m.default || m.ControleEducacaoPage }))
)
const CategoriasManagerPage = lazy(() =>
  import("./pages/educacao/admin/CategoriasManagerPage").then((m) => ({ default: m.default || m.CategoriasManagerPage }))
)

// ROPs (Desafio + Quiz)
const ROPsDesafioPage = lazy(() =>
  import("./pages/rops/ROPsDesafioPage").then((m) => ({ default: m.default || m.ROPsDesafioPage }))
)
const ROPsChoiceMenuPage = lazy(() =>
  import("./pages/rops/ROPsChoiceMenuPage").then((m) => ({ default: m.default || m.ROPsChoiceMenuPage }))
)
const ROPsSubdivisoesPage = lazy(() =>
  import("./pages/rops/ROPsSubdivisoesPage").then((m) => ({ default: m.default || m.ROPsSubdivisoesPage }))
)
const ROPsQuizPage = lazy(() =>
  import("./pages/rops/ROPsQuizPage").then((m) => ({ default: m.default || m.ROPsQuizPage }))
)
const ROPsPodcastsPage = lazy(() =>
  import("./pages/rops/ROPsPodcastsPage").then((m) => ({ default: m.default || m.ROPsPodcastsPage }))
)
const ROPsRankingPage = lazy(() =>
  import("./pages/rops/ROPsRankingPage").then((m) => ({ default: m.default || m.ROPsRankingPage }))
)
const ROPsDesafioDiarioPage = lazy(() =>
  import("./pages/rops/ROPsDesafioDiarioPage").then((m) => ({ default: m.default || m.ROPsDesafioDiarioPage }))
)

// Painel / Escalas / Residência
const PainelGestaoPage = lazy(() => import("./pages/PainelGestaoPage"))
const EscalasPage = lazy(() => import("./pages/EscalasPage"))
const GerenciarResidenciaPage = lazy(() => import("./pages/GerenciarResidenciaPage"))
const ResidenciaHubPage = lazy(() => import("./pages/ResidenciaHubPage"))
const ResidenciaAssistentePage = lazy(() => import("./pages/ResidenciaAssistentePage"))
const TrocasPlantaoPage = lazy(() => import("./pages/TrocasPlantaoPage"))
const ConsultaPlantoesPage = lazy(() => import("./pages/ConsultaPlantoesPage"))
const EscalasFuncionariasHubPage = lazy(() => import("./pages/EscalasFuncionariasHubPage"))
const ConsultaSobreavisoPage = lazy(() => import("./pages/ConsultaSobreavisoPage"))
const TrocasSobreavisoPage = lazy(() => import("./pages/TrocasSobreavisoPage"))
const TrocasPlantaoHospitalarPage = lazy(() => import("./pages/TrocasPlantaoHospitalarPage"))
const AdminTodasTrocasFuncionariasPage = lazy(() => import("./pages/AdminTodasTrocasFuncionariasPage"))
const AdminTodasTrocasResidenciaPage = lazy(() => import("./pages/AdminTodasTrocasResidenciaPage"))

// Reuniões
const ReunioesPage = lazy(() => import("./pages/ReunioesPage"))
const ReuniaoDetalhePage = lazy(() => import("./pages/reunioes/ReuniaoDetalhePage"))

// Relatórios (PDF generation pesada)
const RelatoriosPage = lazy(() => import("./pages/RelatoriosPage"))
const RelatorioTrimestralPage = lazy(() =>
  import("./pages/relatorios/RelatorioTrimestralPage").then((m) => ({ default: m.default || m.RelatorioTrimestralPage }))
)
const RelatorioIncidentesPage = lazy(() =>
  import("./pages/relatorios/RelatorioIncidentesPage").then((m) => ({ default: m.default || m.RelatorioIncidentesPage }))
)
const RelatorioIndicadoresPage = lazy(() =>
  import("./pages/relatorios/RelatorioIndicadoresPage").then((m) => ({ default: m.default || m.RelatorioIndicadoresPage }))
)
const RelatorioDetalhePage = lazy(() =>
  import("./pages/relatorios/RelatorioDetalhePage").then((m) => ({ default: m.default || m.RelatorioDetalhePage }))
)

// Comitês / Auditorias hub
const ComitesPage = lazy(() => import("./pages/ComitesPage"))
const AuditoriasPage = lazy(() => import("./pages/AuditoriasPage"))

// Páginas de nível secundário
const FinanceiroPage = lazy(() => import("./pages/FinanceiroPage"))
const OrganogramaPage = lazy(() => import("./pages/OrganogramaPage"))
const EticaBioeticaPage = lazy(() => import("./pages/EticaBioeticaPage"))
const DesastresPage = lazy(() => import("./pages/DesastresPage"))
const PersonalizarAtalhosPage = lazy(() => import("./pages/PersonalizarAtalhosPage"))

// Incidentes / Denúncias (formulários pesados)
const IncidentesPage = lazy(() =>
  import("./pages/incidents/IncidentesPage").then((m) => ({ default: m.default || m.IncidentesPage }))
)
const NovoIncidentePage = lazy(() =>
  import("./pages/incidents/NovoIncidentePage").then((m) => ({ default: m.default || m.NovoIncidentePage }))
)
const NovaDenunciaPage = lazy(() =>
  import("./pages/incidents/NovaDenunciaPage").then((m) => ({ default: m.default || m.NovaDenunciaPage }))
)
const MeusRelatosPage = lazy(() =>
  import("./pages/incidents/MeusRelatosPage").then((m) => ({ default: m.default || m.MeusRelatosPage }))
)
const QRCodeGeneratorPage = lazy(() =>
  import("./pages/incidents/QRCodeGeneratorPage").then((m) => ({ default: m.default || m.QRCodeGeneratorPage }))
)
const AcompanhamentoIncidentePage = lazy(() =>
  import("./pages/incidents/AcompanhamentoIncidentePage").then((m) => ({ default: m.default || m.AcompanhamentoIncidentePage }))
)
const AcompanhamentoDenunciaPage = lazy(() =>
  import("./pages/incidents/AcompanhamentoDenunciaPage").then((m) => ({ default: m.default || m.AcompanhamentoDenunciaPage }))
)
const IncidenteGestaoPage = lazy(() =>
  import("./pages/incidents/IncidenteGestaoPage").then((m) => ({ default: m.default || m.IncidenteGestaoPage }))
)
const DenunciaGestaoPage = lazy(() =>
  import("./pages/incidents/DenunciaGestaoPage").then((m) => ({ default: m.default || m.DenunciaGestaoPage }))
)
const IncidenteDetalhePage = lazy(() =>
  import("./pages/incidents/IncidenteDetalhePage").then((m) => ({ default: m.default || m.IncidenteDetalhePage }))
)
const DenunciaDetalhePage = lazy(() =>
  import("./pages/incidents/DenunciaDetalhePage").then((m) => ({ default: m.default || m.DenunciaDetalhePage }))
)
const RastrearRelatoPage = lazy(() =>
  import("./pages/incidents/RastrearRelatoPage").then((m) => ({ default: m.default || m.RastrearRelatoPage }))
)

// KPI (charts pesados)
const KpiInfeccaoPage = lazy(() =>
  import("./pages/kpi/KpiInfeccaoPage").then((m) => ({ default: m.default || m.KpiInfeccaoPage }))
)
const KpiAdesaoPage = lazy(() =>
  import("./pages/kpi/KpiAdesaoPage").then((m) => ({ default: m.default || m.KpiAdesaoPage }))
)
const KpiEventosPage = lazy(() =>
  import("./pages/kpi/KpiEventosPage").then((m) => ({ default: m.default || m.KpiEventosPage }))
)
const KpiSatisfacaoPage = lazy(() =>
  import("./pages/kpi/KpiSatisfacaoPage").then((m) => ({ default: m.default || m.KpiSatisfacaoPage }))
)
const KpiTempoPage = lazy(() =>
  import("./pages/kpi/KpiTempoPage").then((m) => ({ default: m.default || m.KpiTempoPage }))
)
const KpiMedicamentosPage = lazy(() =>
  import("./pages/kpi/KpiMedicamentosPage").then((m) => ({ default: m.default || m.KpiMedicamentosPage }))
)
const KpiDataEntryPage = lazy(() =>
  import("./pages/kpi/KpiDataEntryPage").then((m) => ({ default: m.default || m.KpiDataEntryPage }))
)
const KpiHistoricoPage = lazy(() =>
  import("./pages/kpi/KpiHistoricoPage").then((m) => ({ default: m.default || m.KpiHistoricoPage }))
)
const KpiIndicadorDetalhePage = lazy(() =>
  import("./pages/kpi/KpiIndicadorDetalhePage").then((m) => ({ default: m.default || m.KpiIndicadorDetalhePage }))
)
const KpiDashboardOverview = lazy(() =>
  import("./pages/kpi/KpiDashboardOverview").then((m) => ({ default: m.default || m.KpiDashboardOverview }))
)

// Ética
const DilemasPage = lazy(() =>
  import("./pages/etica/DilemasPage").then((m) => ({ default: m.default || m.DilemasPage }))
)
const ParecerUtiPage = lazy(() =>
  import("./pages/etica/ParecerUtiPage").then((m) => ({ default: m.default || m.ParecerUtiPage }))
)
const DiretrizesPage = lazy(() =>
  import("./pages/etica/DiretrizesPage").then((m) => ({ default: m.default || m.DiretrizesPage }))
)
const EmissaoParecerPage = lazy(() =>
  import("./pages/etica/EmissaoParecerPage").then((m) => ({ default: m.default || m.EmissaoParecerPage }))
)
const CodigoEticaPage = lazy(() =>
  import("./pages/etica/CodigoEticaPage").then((m) => ({ default: m.default || m.CodigoEticaPage }))
)

// Auditorias
const HigieneMaosPage = lazy(() =>
  import("./pages/auditorias/HigieneMaosPage").then((m) => ({ default: m.default || m.HigieneMaosPage }))
)
const UsoMedicamentosPage = lazy(() =>
  import("./pages/auditorias/UsoMedicamentosPage").then((m) => ({ default: m.default || m.UsoMedicamentosPage }))
)
const AbreviaturasPage = lazy(() =>
  import("./pages/auditorias/AbreviaturasPage").then((m) => ({ default: m.default || m.AbreviaturasPage }))
)
const AuditoriasOperacionaisPage = lazy(() =>
  import("./pages/auditorias/AuditoriasOperacionaisPage").then((m) => ({ default: m.default || m.AuditoriasOperacionaisPage }))
)
const AuditoriasConformidadePage = lazy(() =>
  import("./pages/auditorias/AuditoriasConformidadePage").then((m) => ({ default: m.default || m.AuditoriasConformidadePage }))
)
const PoliticaGestaoQualidadePage = lazy(() =>
  import("./pages/auditorias/PoliticaGestaoQualidadePage").then((m) => ({ default: m.default || m.PoliticaGestaoQualidadePage }))
)
const PoliticaDisclosurePage = lazy(() =>
  import("./pages/auditorias/PoliticaDisclosurePage").then((m) => ({ default: m.default || m.PoliticaDisclosurePage }))
)
const RelatorioAuditoriasRopsPage = lazy(() =>
  import("./pages/auditorias/RelatorioAuditoriasRopsPage").then((m) => ({ default: m.default || m.RelatorioAuditoriasRopsPage }))
)

// Desastres
const EmergenciaIncendioPage = lazy(() =>
  import("./pages/desastres/EmergenciaIncendioPage").then((m) => ({ default: m.default || m.EmergenciaIncendioPage }))
)
const EmergenciaVitimasPage = lazy(() =>
  import("./pages/desastres/EmergenciaVitimasPage").then((m) => ({ default: m.default || m.EmergenciaVitimasPage }))
)
const EmergenciaPanePage = lazy(() =>
  import("./pages/desastres/EmergenciaPanePage").then((m) => ({ default: m.default || m.EmergenciaPanePage }))
)
const EmergenciaQuimicoPage = lazy(() =>
  import("./pages/desastres/EmergenciaQuimicoPage").then((m) => ({ default: m.default || m.EmergenciaQuimicoPage }))
)
const EmergenciaInundacaoPage = lazy(() =>
  import("./pages/desastres/EmergenciaInundacaoPage").then((m) => ({ default: m.default || m.EmergenciaInundacaoPage }))
)
const EmergenciaBombaPage = lazy(() =>
  import("./pages/desastres/EmergenciaBombaPage").then((m) => ({ default: m.default || m.EmergenciaBombaPage }))
)
const PlanoManualPage = lazy(() =>
  import("./pages/desastres/PlanoManualPage").then((m) => ({ default: m.default || m.PlanoManualPage }))
)
const PlanoTimesPage = lazy(() =>
  import("./pages/desastres/PlanoTimesPage").then((m) => ({ default: m.default || m.PlanoTimesPage }))
)
const PlanoApoioPage = lazy(() =>
  import("./pages/desastres/PlanoApoioPage").then((m) => ({ default: m.default || m.PlanoApoioPage }))
)
const PlanoSimuladoPage = lazy(() =>
  import("./pages/desastres/PlanoSimuladoPage").then((m) => ({ default: m.default || m.PlanoSimuladoPage }))
)

// Faturamento
const FaturamentoPage = lazy(() =>
  import("./pages/faturamento/FaturamentoPage").then((m) => ({ default: m.default || m.FaturamentoPage }))
)
const FaturamentoDashboardPage = lazy(() =>
  import("./pages/faturamento/FaturamentoDashboardPage").then((m) => ({ default: m.default || m.FaturamentoDashboardPage }))
)
const FaturamentoEventosPage = lazy(() =>
  import("./pages/faturamento/EventosPage").then((m) => ({ default: m.default || m.EventosPage }))
)
const FaturamentoNovoEventoPage = lazy(() =>
  import("./pages/faturamento/NovoEventoPage").then((m) => ({ default: m.default || m.NovoEventoPage }))
)
const FaturamentoEventoDetalhePage = lazy(() =>
  import("./pages/faturamento/EventoDetalhePage").then((m) => ({ default: m.default || m.EventoDetalhePage }))
)
const FaturamentoNotasPage = lazy(() =>
  import("./pages/faturamento/NotasPage").then((m) => ({ default: m.default || m.NotasPage }))
)
const FaturamentoNotaDetalhePage = lazy(() =>
  import("./pages/faturamento/NotaDetalhePage").then((m) => ({ default: m.default || m.NotaDetalhePage }))
)
const FaturamentoNovaNotaPage = lazy(() =>
  import("./pages/faturamento/NovaNotaPage").then((m) => ({ default: m.default || m.NovaNotaPage }))
)
const FaturamentoConveniosPage = lazy(() =>
  import("./pages/faturamento/ConveniosPage").then((m) => ({ default: m.default || m.ConveniosPage }))
)

// Comunicação (mensagens internas)
const InboxPage = lazy(() => import("./pages/communication/InboxPage"))
const MessageDetailPage = lazy(() => import("./pages/communication/MessageDetailPage"))

// Planos de Ação (PDCA)
const PlanosAcaoPage = lazy(() =>
  import("./pages/planos-acao/PlanosAcaoPage").then((m) => ({ default: m.default || m.PlanosAcaoPage }))
)
const NovoPlanoPage = lazy(() =>
  import("./pages/planos-acao/NovoPlanoPage").then((m) => ({ default: m.default || m.NovoPlanoPage }))
)
const PlanoAcaoDetalhePage = lazy(() =>
  import("./pages/planos-acao/PlanoAcaoDetalhePage").then((m) => ({ default: m.default || m.PlanoAcaoDetalhePage }))
)

// Auditorias Interativas (F5)
const AuditoriasInterativasPage = lazy(() =>
  import("./pages/auditorias-interativas/AuditoriasInterativasPage").then((m) => ({ default: m.default || m.AuditoriasInterativasPage }))
)
const NovaAuditoriaPage = lazy(() =>
  import("./pages/auditorias-interativas/NovaAuditoriaPage").then((m) => ({ default: m.default || m.NovaAuditoriaPage }))
)
const ExecucaoAuditoriaPage = lazy(() =>
  import("./pages/auditorias-interativas/ExecucaoAuditoriaPage").then((m) => ({ default: m.default || m.ExecucaoAuditoriaPage }))
)
const AuditoriaResultadoPage = lazy(() =>
  import("./pages/auditorias-interativas/AuditoriaResultadoPage").then((m) => ({ default: m.default || m.AuditoriaResultadoPage }))
)

// Autoavaliação Qmentum (F6)
const AutoavaliacaoPage = lazy(() =>
  import("./pages/autoavaliacao/AutoavaliacaoPage").then((m) => ({ default: m.default || m.AutoavaliacaoPage }))
)
const AutoavaliacaoAreaPage = lazy(() =>
  import("./pages/autoavaliacao/AutoavaliacaoAreaPage").then((m) => ({ default: m.default || m.AutoavaliacaoAreaPage }))
)
const AutoavaliacaoRopPage = lazy(() =>
  import("./pages/autoavaliacao/AutoavaliacaoRopPage").then((m) => ({ default: m.default || m.AutoavaliacaoRopPage }))
)
const AutoavaliacaoRelatorioPage = lazy(() =>
  import("./pages/autoavaliacao/AutoavaliacaoRelatorioPage").then((m) => ({ default: m.default || m.AutoavaliacaoRelatorioPage }))
)

// Dashboard Executivo (F8) — charts pesados
const DashboardExecutivoPage = lazy(() => import("./pages/dashboard/DashboardExecutivoPage"))

// Critérios UTI
const CriteriosUTIPage = lazy(() => import("./pages/CriteriosUTIPage"))

// Cateter Peridural
const CateteresPeridualPage = lazy(() =>
  import("./pages/cateter-peridural/CateteresPeridualPage").then((m) => ({ default: m.default || m.CateteresPeridualPage }))
)
const NovoCateterPage = lazy(() =>
  import("./pages/cateter-peridural/NovoCateterPage").then((m) => ({ default: m.default || m.NovoCateterPage }))
)
const CateterDetalhePage = lazy(() =>
  import("./pages/cateter-peridural/CateterDetalhePage").then((m) => ({ default: m.default || m.CateterDetalhePage }))
)

import { EducacaoDataProvider } from "./pages/educacao/hooks"

// Componente wrapper para página de Calculadoras
function CalculadorasPageWrapper({ _onNavigate, goBack }) {
  // Estado da calculadora selecionada é gerenciado aqui para que o botão
  // "Voltar" do header feche o detalhe antes de sair da página
  const [selectedCalcId, setSelectedCalcId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchPanelId = useId();

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm('');
  };

  const handleBack = () => {
    if (selectedCalcId) {
      setSelectedCalcId(null); // Fecha detalhe, volta pra lista de calculadoras
    } else {
      goBack(); // Sai da página
    }
  };

  // Esconde o toggle de busca na tela de detalhe (não faz sentido buscar lá)
  const showSearchToggle = !selectedCalcId;

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
            Calculadoras
          </h1>
          <div className="min-w-[70px] flex justify-end">
            {showSearchToggle && (
              <SearchToggleButton
                size="sm"
                active={searchOpen}
                onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
                controlsId={searchPanelId}
              />
            )}
          </div>
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
        {/* Busca collapsable (toggle via lupa no header) */}
        {showSearchToggle && (
          <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
            <CollapsibleContent>
              <div id={searchPanelId} className="mb-3">
                <SearchBar
                  placeholder="Buscar calculadora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onSubmit={() => { document.activeElement?.blur(); }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Suspense fallback={<PageLoadingFallback />}>
          <CalculatorShowcase
            selectedCalc={selectedCalcId}
            onSelectedCalcChange={setSelectedCalcId}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />
        </Suspense>
      </div>
    </div>
  );
}

// BottomNav principal. Labels pt-BR ficam no BottomNav (bottom-nav.jsx) via DEFAULT_LABELS por ícone.
function AppBottomNav({ activeNav, onNavClick, menuBadge = false }) {
  return (
    <BottomNav
      items={[
        { icon: "Home", label: "Início", active: activeNav === "home", id: "home" },
        { icon: "Shield", label: "Gestão", active: activeNav === "shield", id: "shield" },
        { icon: "GraduationCap", label: "Educação", active: activeNav === "education", id: "education" },
        { icon: "Menu", label: "Menu", active: activeNav === "menu", id: "menu", badge: menuBadge },
      ]}
      onItemClick={onNavClick}
    />
  )
}

// Componente do App principal
function App() {
  const { user, isAuthenticated, needsLgpdConsent, acceptLgpd } = useUser()
  const { toast } = useToast()
  const { cateteres } = useCateterPeridural()
  const hasActiveCateterPeridural = cateteres.some((c) => c.status === 'ativo')
  const [currentPage, setCurrentPage] = useState("home")
  const [activeNav, setActiveNav] = useState("home")
  const [pageParams, setPageParams] = useState(null)
  const [navigationHistory, setNavigationHistory] = useState([])

  // Activity tracking
  const { trackPageView } = useActivityTracking()

  // Trava orientação em portrait (best-effort — cobre Android Chrome PWA;
  // iOS Safari usa fallback visual via RotateDeviceOverlay)
  useLockPortraitOrientation()

  // Sprint 10 / F6.2: drena fila de mutations offline ao mount + 'online' event.
  useOfflineQueueFlush()

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

  // Listener para falhas de autorizacao no signup/reconcile. Dispatched por UserContext
  // quando rpc_create_profile retorna 'Email not authorized'.
  useEffect(() => {
    let lastToastTime = 0
    const handleNotAuthorized = (event) => {
      const now = Date.now()
      if (now - lastToastTime < 30000) return
      lastToastTime = now
      const email = event?.detail?.email
      toast({
        title: 'Conta nao autorizada',
        description: email
          ? `O email ${email} nao esta na lista de autorizados. Solicite ao administrador para liberar seu acesso.`
          : 'Seu email nao esta na lista de autorizados. Solicite ao administrador para liberar seu acesso.',
        variant: 'error',
        duration: 12000,
      })
    }
    window.addEventListener('auth-not-authorized', handleNotAuthorized)
    return () => window.removeEventListener('auth-not-authorized', handleNotAuthorized)
  }, [toast])

  // Scroll para o topo quando a página muda + track page view
  // Also clear any stuck overflow:hidden on body (safety net for modals that didn't clean up)
  useEffect(() => {
    document.body.style.overflow = ''
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    trackPageView(currentPage)
  }, [currentPage, trackPageView])

  // BUG-04 fix: Reset state when unauthenticated. Defense-in-depth — App now only
  // mounts with isAuthenticated=true (gated by AuthGatedProviders in main.jsx),
  // so this effect mostly handles the logout transition before unmount.
  useEffect(() => {
    if (!isAuthenticated && currentPage !== 'home') {
      setCurrentPage('home')
      setActiveNav('home')
      setNavigationHistory([])
      setPageParams(null)
    }
  }, [isAuthenticated])

  // BUG-08 fix: centroGestao access guard (moved out of render to avoid side effects during render)
  // Also allows: incident responsibles, users with residencia-edit or tec-enf-secretaria-edit
  useEffect(() => {
    // Páginas de gestão de incidentes/denúncias: SOMENTE admin pleno ou responsável.
    // Coordenadores comuns NÃO têm acesso (políticas LGPD/sigilo).
    const INCIDENT_MGMT_PAGES = ['incidente-gestao', 'denuncia-gestao'];
    if (INCIDENT_MGMT_PAGES.includes(currentPage)) {
      if (!canAccessIncidentManagement(user)) {
        toast({ title: 'Acesso negado', description: 'Apenas administradores e responsaveis por incidentes podem acessar.', variant: 'destructive' });
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
        return
      }
    }

    if (currentPage === 'centroGestao') {
      if (!canAccessCentroGestao(user)) {
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
    ropsDesafioDiario: 'rops_desafio',
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

  // Auth gating (spinner durante isLoading, LoginPage se !isAuthenticated, e
  // detecção de URLs públicas /verificar/...) é feito em main.jsx pelo
  // AuthGatedProviders + PublicRouteOrApp. App só monta com isAuthenticated=true.

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
    else if (['educacao', 'ropsDesafio', 'ropsDesafioDiario', 'ropsChoiceMenu', 'ropsSubdivisoes', 'ropsQuiz', 'ropsPodcasts', 'ropsRanking', 'residencia', 'educacaoContinuada', 'cursoDetalhe', 'aulaPlayer', 'certificados', 'pontos', 'adminAulas', 'adminTrilhas', 'adminConteudo', 'relatoriosEducacao', 'controleEducacao', 'assistenteResidencia', 'trocasPlantao', 'consultaPlantoes'].includes(page)) setActiveNav('education')
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
    else if (['educacao', 'ropsDesafio', 'ropsDesafioDiario', 'ropsChoiceMenu', 'ropsSubdivisoes', 'ropsQuiz', 'ropsPodcasts', 'ropsRanking', 'residencia', 'educacaoContinuada', 'cursoDetalhe', 'aulaPlayer', 'certificados', 'pontos', 'adminAulas', 'adminTrilhas', 'adminConteudo', 'relatoriosEducacao', 'controleEducacao', 'assistenteResidencia', 'trocasPlantao', 'consultaPlantoes'].includes(previous.page)) setActiveNav('education')
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

      case 'bulkImport': {
        const bulkIsAdmin = !!(user?.isAdmin || user?.isCoordenador || ['administrador','coordenador'].includes((user?.role||'').toLowerCase()))
        if (!isBulkImportEnabled() || !bulkIsAdmin) {
          return <div className="p-8 text-center text-foreground"><p>Acesso negado.</p></div>
        }
        return <BulkImportPage key="bulk-import" goBack={goBack} />
      }
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
      case 'educacaoContinuada':
        return <EducacaoContinuadaPage onNavigate={handleNavigate} goBack={goBack} />
      case 'trilhaDetalhe':
        return <TrilhaDetalhePage onNavigate={handleNavigate} goBack={goBack} trilhaId={pageParams?.trilhaId} />
      case 'cursoDetalhe':
        return <CursoDetalhePage onNavigate={handleNavigate} goBack={goBack} cursoId={pageParams?.cursoId} />
      case 'certificados':
        return <CertificadosPage onNavigate={handleNavigate} goBack={goBack} />
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
      case 'categorias-manager':
        return <CategoriasManagerPage key="categorias-manager" {...pageParams} onNavigate={handleNavigate} goBack={goBack} />
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
      case 'ropsDesafioDiario':
        return <ROPsDesafioDiarioPage onNavigate={handleNavigate} goBack={goBack} />
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
        if (!canAccessCentroGestao(user)) return null;
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

      {/* Banner opt-in push notifications (Sprint 21 — v5.0.0). Self-gated:
          só aparece se user logado, browser suporta push, permission='default',
          e não foi dispensado nos últimos 7 dias. */}
      {isAuthenticated && <PushNotificationOptIn />}

      {/* Prompt de atualizacao do Service Worker */}
      <ReloadPrompt />

      {/* Container limita largura no desktop (mobile = 100% width) */}
      <main id="main-content" tabIndex={-1} className="container focus:outline-none">
      <EducacaoDataProvider>
        <ErrorBoundary
          key={currentPage}
          onError={(error, errorInfo) =>
            reportError(error, {
              componentStack: errorInfo?.componentStack,
              route: currentPage,
              fatal: false,
            })
          }
        >
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
        </ErrorBoundary>
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
          menuBadge={hasActiveCateterPeridural}
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
