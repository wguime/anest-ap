// Exports centralizados das páginas
export { default as HomePage } from './HomePage';
export { default as ProfilePage } from './ProfilePage';
export { default as PendenciasPage } from './PendenciasPage';
export { default as ComunicadosPage } from './ComunicadosPage';
export { default as MenuPage } from './MenuPage';

// Centro de Gestão (Management Center) - New modular architecture
export { CentroGestaoPage } from './management';

// Páginas de Gestão
export { default as GestaoPage } from './GestaoPage';
export { default as QualidadePage } from './QualidadePage';
export { default as FinanceiroPage } from './FinanceiroPage';
export { default as EscalasPage } from './EscalasPage';
export { default as ReunioesPage } from './ReunioesPage';
export { default as GerenciarResidenciaPage } from './GerenciarResidenciaPage';
export { default as ResidenciaHubPage } from './ResidenciaHubPage';
export { default as ResidenciaAssistentePage } from './ResidenciaAssistentePage';
export { default as TrocasPlantaoPage } from './TrocasPlantaoPage';

// Página de Educação
export { default as EducacaoPage } from './EducacaoPage';

// Sub-páginas Educação Continuada
export {
  EducacaoContinuadaPage,
  TrilhaDetalhePage,
  CursoDetalhePage,
  CertificadosPage,
  PontosPage,
  AulaPlayerPage,
  VerificarCertificadoPage,
  // Admin pages
  AdminAulasPage,
  AdminTrilhasPage,
  AdminConteudoPage,
  RelatoriosEducacaoPage,
  ControleEducacaoPage,
} from './educacao';

// Páginas ROPs (Desafio)
export {
  ROPsDesafioPage,
  ROPsChoiceMenuPage,
  ROPsSubdivisoesPage,
  ROPsQuizPage,
  ROPsPodcastsPage,
  ROPsRankingPage,
} from './rops';

// Sub-páginas de Qualidade
export { default as PainelGestaoPage } from './PainelGestaoPage';
export { default as OrganogramaPage } from './OrganogramaPage';
export { default as EticaBioeticaPage } from './EticaBioeticaPage';
export { default as ComitesPage } from './ComitesPage';
export { default as GestaoDocumentalPage } from './GestaoDocumentalPage';
export { default as AuditoriasPage } from './AuditoriasPage';
export { default as RelatoriosPage } from './RelatoriosPage';
export { default as DesastresPage } from './DesastresPage';

// Sub-páginas KPI
export {
  KpiInfeccaoPage,
  KpiAdesaoPage,
  KpiEventosPage,
  KpiSatisfacaoPage,
  KpiTempoPage,
  KpiMedicamentosPage,
} from './kpi';

// Sub-páginas Comitês removidas - agora ComitesPage é a página única

// Sub-páginas Ética
export {
  DilemasPage,
  ParecerUtiPage,
  DiretrizesPage,
  EmissaoParecerPage,
  CodigoEticaPage,
} from './etica';

// Sub-páginas Auditorias
export {
  HigieneMaosPage,
  UsoMedicamentosPage,
  AbreviaturasPage,
  AuditoriasOperacionaisPage,
  AuditoriasConformidadePage,
  // Politicas Institucionais
  PoliticaGestaoQualidadePage,
  PoliticaDisclosurePage,
  RelatorioAuditoriasRopsPage,
} from './auditorias';

// Sub-páginas Relatórios
export {
  RelatorioTrimestralPage,
  RelatorioIncidentesPage,
  RelatorioIndicadoresPage,
  RelatorioDetalhePage,
} from './relatorios';

// Sub-páginas Desastres
export {
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
} from './desastres';

// Biblioteca de Documentos
export { default as BibliotecaPage } from './BibliotecaPage';
export { default as DocumentoDetalhePage } from './DocumentoDetalhePage';

// Critérios UTI
export { default as CriteriosUTIPage } from './CriteriosUTIPage';

// Autenticação
export { default as LoginPage } from './LoginPage';

// Configurações
export { default as PersonalizarAtalhosPage } from './PersonalizarAtalhosPage';
export { default as SearchResultsPage } from './SearchResultsPage';

// Gestão de Incidentes e Denúncias
export {
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
} from './incidents';

// Audit Trail
export { default as AuditTrailPage } from './management/documents/AuditTrailPage';

// Comunicacao / Mensagens
export { default as InboxPage } from './communication/InboxPage';
export { default as MessageDetailPage } from './communication/MessageDetailPage';

// Planos de Acao (PDCA)
export {
  PlanosAcaoPage,
  NovoPlanoPage,
  PlanoAcaoDetalhePage,
} from './planos-acao';

// KPI Data Entry & Dashboard
export {
  KpiDataEntryPage,
  KpiHistoricoPage,
  KpiIndicadorDetalhePage,
  KpiDashboardOverview,
} from './kpi';

// Faturamento
export {
  FaturamentoPage,
  FaturamentoDashboardPage,
  EventosPage as FaturamentoEventosPage,
  NovoEventoPage as FaturamentoNovoEventoPage,
  EventoDetalhePage as FaturamentoEventoDetalhePage,
  NotasPage as FaturamentoNotasPage,
  NotaDetalhePage as FaturamentoNotaDetalhePage,
  NovaNotaPage as FaturamentoNovaNotaPage,
  ConveniosPage as FaturamentoConveniosPage,
} from './faturamento';

// Auditorias Interativas (F5)
export {
  AuditoriasInterativasPage,
  NovaAuditoriaPage,
  ExecucaoAuditoriaPage,
  AuditoriaResultadoPage,
} from './auditorias-interativas';

// Autoavaliacao Qmentum (F6)
export {
  AutoavaliacaoPage,
  AutoavaliacaoAreaPage,
  AutoavaliacaoRopPage,
  AutoavaliacaoRelatorioPage,
} from './autoavaliacao';

// Dashboard Executivo (F8)
export { default as DashboardExecutivoPage } from './dashboard/DashboardExecutivoPage';

// Reunião Detalhe
export { default as ReuniaoDetalhePage } from './reunioes/ReuniaoDetalhePage';

// Cateter Peridural
export {
  CateteresPeridualPage,
  NovoCateterPage,
  CateterDetalhePage,
} from './cateter-peridural';
