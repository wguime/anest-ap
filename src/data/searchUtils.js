import { ATALHOS_DISPONIVEIS } from './atalhosConfig';
import { getActiveCalculators } from '@/design-system/data/calculator-definitions';

// Mapeamento atalho → rota (espelha HomePage.jsx)
const navigationMap = {
  calculadoras: 'calculadoras',
  reportar: 'gestao',
  manutencao: 'gestao',
  rops: 'ropsDesafio',
  checklist: 'gestao',
  conciliacao: 'gestao',
  indicadores: 'painelGestao',
  auditorias: 'auditorias',
  etica: 'eticaBioetica',
  desastres: 'desastres',
  medicamentos: 'gestao',
  protocolos: 'biblioteca',
  biblioteca: 'biblioteca',
  infeccao: 'gestao',
  podcasts: 'ropsPodcasts',
  residencia: 'residencia',
  organograma: 'organograma',
  comites: 'comites',
  comunicados: 'comunicados',
  pendencias: 'pendencias',
  financeiro: 'financeiro',
  escalas: 'escalas',
  'qualidade-hub': 'qualidade',
  'educacao-continuada': 'educacaoContinuada',
  reunioes: 'reunioes',
  faturamento: 'faturamento',
  incidentes: 'incidentes',
  relatorios: 'relatorios',
  'gestao-documental': 'gestaoDocumental',
  'ranking-rops': 'ropsRanking',
  mensagens: 'inbox',
  'meus-relatos': 'meusRelatos',
};

// Normaliza string removendo acentos e convertendo para minúscula
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Busca em todas as fontes de dados.
//
// `pages` cobre dois grupos:
//   1. Atalhos de navegação (ATALHOS_DISPONIVEIS) — seções de alto nível.
//   2. Calculadoras clínicas ativas — abrem direto a calc via
//      route 'calculadoras' + params.calcId (HomePage repassa ao onNavigate).
//
// `documents` é resolvido fora daqui (React): a Home injeta via
// DocumentsContext.searchAllDocuments e a SearchResultsPage via useSearch —
// searchAll é pura (sem React) e não tem acesso ao cache de documentos.
export function searchAll(query) {
  if (!query || !query.trim()) {
    return { pages: [], documents: [] };
  }

  const q = normalize(query.trim());

  const atalhos = ATALHOS_DISPONIVEIS.filter((a) => {
    const haystack = normalize(`${a.label} ${a.descricao} ${a.categoria}`);
    return haystack.includes(q);
  }).map((a) => ({
    ...a,
    route: navigationMap[a.id] || null,
  }));

  // Calculadoras clínicas ativas (match por título/subtítulo).
  const calculadoras = getActiveCalculators()
    .filter((c) => {
      const haystack = normalize(`${c.title} ${c.subtitle || ''}`);
      return haystack.includes(q);
    })
    .map((c) => ({
      id: `calc-${c.id}`,
      label: c.title,
      descricao: c.subtitle,
      icon: 'Calculator',
      route: 'calculadoras',
      params: { calcId: c.id },
    }));

  return { pages: [...atalhos, ...calculadoras], documents: [] };
}
