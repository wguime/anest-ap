import { ATALHOS_DISPONIVEIS } from './atalhosConfig';

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

// Busca em todas as fontes de dados
export function searchAll(query) {
  if (!query || !query.trim()) {
    return { pages: [], documents: [] };
  }

  const q = normalize(query.trim());

  const pages = ATALHOS_DISPONIVEIS.filter((a) => {
    const haystack = normalize(`${a.label} ${a.descricao} ${a.categoria}`);
    return haystack.includes(q);
  }).map((a) => ({
    ...a,
    route: navigationMap[a.id] || null,
  }));

  // Document search is handled by Supabase via useSearch hook
  return { pages, documents: [] };
}
