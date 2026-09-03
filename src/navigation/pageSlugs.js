/**
 * Fundação F2 (Etapa A) — mapa página interna ↔ slug de URL (flat, kebab-case).
 *
 * O app navega por nomes internos de página (cases do switch em App.jsx,
 * muitos em camelCase). A URL pública usa kebab-case: /centro-gestao,
 * /kpi-dashboard. Este módulo é a única fonte da conversão nos dois sentidos.
 *
 * Regras:
 * - slug = kebab-case do nome interno (nomes já kebab passam intactos)
 * - '/' ⇄ 'home' (home não vira /home na barra de endereço)
 * - aliases que colidem no mesmo slug (incidenteGestao → incidente-gestao):
 *   o reverse map prefere o nome que já é igual ao slug (canônico)
 * - slug desconhecido → null (caller decide o fallback)
 *
 * O teste src/__tests__/navigation/pageSlugs.test.js extrai os cases reais de
 * App.jsx e garante que esta lista não drifta do switch.
 */

/** Todos os cases de renderAppPage() em App.jsx (fonte: switch, 2026-06-10). */
export const PAGES = [
  'abreviaturas',
  'acompanhamentoDenuncia',
  'acompanhamentoIncidente',
  'adminAulas',
  'adminConteudo',
  'adminTodasTrocasFuncionarias',
  'adminTodasTrocasResidencia',
  'adminTrilhas',
  'assistenteResidencia',
  'auditoriaResultado',
  'auditorias',
  'auditoriasConformidade',
  'auditoriasInterativas',
  'auditoriasOperacionais',
  'auditTrail',
  'aulaPlayer',
  'autoavaliacao',
  'autoavaliacaoArea',
  'autoavaliacaoRelatorio',
  'autoavaliacaoRop',
  'biblioteca',
  'codificacaoAnestesica',
  'escalaCirurgica',
  'escalaNumerica',
  'feriados',
  'extratoFerias',
  'bulkImport',
  'calculadoras',
  'categoria-noticias',
  'categorias-manager',
  'cateterDetalhe',
  'cateteresPeridural',
  'cirurgiasParticulares',
  'novaCirurgiaParticular',
  'centroGestao',
  'certificados',
  'codigoEtica',
  'comites',
  'comunicados',
  'consultaPlantoes',
  'consultaSobreaviso',
  'controleEducacao',
  'criteriosUti',
  'cursoDetalhe',
  'dashboard',
  'dashboardExecutivo',
  'denuncia-gestao',
  'denunciaDetalhe',
  'denunciaGestao',
  'desastres',
  'escalaBraden',
  'dilemas',
  'diretrizes',
  'documento-detalhe',
  'educacao',
  'educacaoContinuada',
  'emergenciaBomba',
  'emergenciaIncendio',
  'emergenciaInundacao',
  'emergenciaPane',
  'emergenciaQuimico',
  'emergenciaVitimas',
  'emissaoParecer',
  'escalas',
  'escalasFuncionarias',
  'eticaBioetica',
  'execucaoAuditoria',
  'faturamento',
  'faturamentoConvenios',
  'faturamentoDashboard',
  'faturamentoEventoDetalhe',
  'faturamentoEventos',
  'faturamentoNotaDetalhe',
  'faturamentoNotas',
  'faturamentoNovaNota',
  'faturamentoNovoEvento',
  'financeiro',
  'gerenciarResidencia',
  'gestao',
  'gestaoDocumental',
  'higieneMaos',
  'home',
  'inbox',
  'incidente-gestao',
  'incidenteDetalhe',
  'incidenteGestao',
  'incidentes',
  'kpiAdesao',
  'kpiDashboard',
  'kpiDataEntry',
  'kpiEventos',
  'kpiHistorico',
  'kpiIndicadorDetalhe',
  'kpiInfeccao',
  'kpiMedicamentos',
  'kpiSatisfacao',
  'kpiTempo',
  'menu',
  'menuPage',
  'messageDetail',
  'meusRelatos',
  'noticia-detalhe',
  'noticias',
  'novaAuditoria',
  'novaDenuncia',
  'novoCateter',
  'novoIncidente',
  'novoPlanoAcao',
  'organograma',
  'painelGestao',
  'parecerUti',
  'pendencias',
  'permissions',
  'personalizarAtalhos',
  'planoAcaoDetalhe',
  'planoApoio',
  'planoManual',
  'planosAcao',
  'planoSimulado',
  'planoTimes',
  'politicaDisclosure',
  'politicaGestaoQualidade',
  'pontos',
  'profile',
  'qrcodeGenerator',
  'qualidade',
  'rastrearRelato',
  'relatorioAuditoriasRops',
  'relatorioDetalhe',
  'relatorioIncidentes',
  'relatorioIndicadores',
  'relatorios',
  'relatoriosEducacao',
  'relatorioTrimestral',
  'refeicaoUnimed',
  'residencia',
  'reuniaoDetalhe',
  'reunioes',
  'ropsChoiceMenu',
  'ropsDesafio',
  'ropsDesafioDiario',
  'ropsPodcasts',
  'ropsQuiz',
  'ropsRanking',
  'ropsSubdivisoes',
  'searchResults',
  'trilhaDetalhe',
  'trocasPlantao',
  'trocasPlantaoHospitalar',
  'trocasSobreaviso',
  'usoMedicamentos',
]

/** camelCase → kebab-case ('centroGestao' → 'centro-gestao'). Idempotente para nomes já kebab. */
export function toKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

const PAGE_TO_SLUG = {}
const SLUG_TO_PAGE = {}
for (const page of PAGES) {
  const slug = toKebab(page)
  PAGE_TO_SLUG[page] = slug
  // Colisão de alias (incidenteGestao vs incidente-gestao): o nome que já é
  // igual ao slug é o canônico no sentido URL → página.
  if (!(slug in SLUG_TO_PAGE) || page === slug) {
    SLUG_TO_PAGE[slug] = page
  }
}

/**
 * F2 Etapa B — páginas cujo param crítico vira segmento de path
 * (/documento-detalhe/:documentoId). Key = página canônica (igual ao slug),
 * value = nome do param em pageParams. Páginas fora deste mapa seguem com
 * params só em location.state (não sobrevivem a "abrir em nova aba").
 */
export const PAGE_PARAM = {
  'documento-detalhe': 'documentoId',
  'noticia-detalhe': 'noticiaId',
}

/**
 * Página interna → path da URL. 'home' → '/'. Página desconhecida cai no
 * kebab dela (forward é total). Se a página tem PAGE_PARAM e params traz o
 * valor, ele vira segundo segmento (encodado); ausente → path base (a página
 * tolera params null).
 */
export function pageToPath(page, params = null) {
  const base = page === 'home' ? '/' : `/${PAGE_TO_SLUG[page] ?? toKebab(page)}`
  const paramKey = PAGE_PARAM[page]
  const value = paramKey ? params?.[paramKey] : undefined
  if (value === undefined || value === null || value === '') return base
  return `${base}/${encodeURIComponent(String(value))}`
}

/** Path da URL → página interna. '/' → 'home'. Slug desconhecido → null. */
export function pathToPage(pathname) {
  return parsePath(pathname).page
}

/**
 * Path da URL → { page, params }. page === null para slug desconhecido.
 * params vem do segmento de path quando a página tem PAGE_PARAM (decodado);
 * null quando não há segmento, a página não usa param de path, ou o slug é
 * desconhecido. Segmentos além do param continuam ignorados.
 */
export function parsePath(pathname) {
  const segments = String(pathname ?? '').replace(/^\/+/, '').split('/')
  const slug = segments[0]
  const page = !slug ? 'home' : (SLUG_TO_PAGE[slug] ?? null)
  if (page === null) return { page: null, params: null }
  const paramKey = PAGE_PARAM[page]
  const raw = segments[1]
  if (!paramKey || !raw) return { page, params: null }
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    // %-sequência malformada digitada na barra: usa o segmento cru
  }
  return { page, params: { [paramKey]: value } }
}
