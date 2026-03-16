// Dados mockados dos atalhos rápidos disponíveis
// Baseado nas funcionalidades do App legado ANEST

// Categorias de atalhos
export const CATEGORIAS = [
  { id: 'ferramentas', label: 'Ferramentas', icon: 'Wrench' },
  { id: 'gestao', label: 'Gestão', icon: 'Briefcase' },
  { id: 'qualidade', label: 'Qualidade', icon: 'Shield' },
  { id: 'documentos', label: 'Documentos', icon: 'FileText' },
  { id: 'educacao', label: 'Educação', icon: 'GraduationCap' },
  { id: 'organizacao', label: 'Organização', icon: 'Network' },
  { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare' },
];

// Todos os atalhos disponíveis (30 opções)
export const ATALHOS_DISPONIVEIS = [
  // Ferramentas (2)
  {
    id: 'calculadoras',
    label: 'Calculadoras',
    icon: 'Calculator',
    categoria: 'ferramentas',
    descricao: 'Doses e escalas clínicas',
  },
  {
    id: 'criteriosUti',
    label: 'Critérios UTI',
    icon: 'ClipboardList',
    categoria: 'ferramentas',
    descricao: 'Triagem UTI pós-operatória',
  },
  {
    id: 'manutencao',
    label: 'Manutenção',
    icon: 'Wrench',
    categoria: 'ferramentas',
    descricao: 'Abrir chamado técnico',
  },

  // Gestão (4)
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: 'DollarSign',
    categoria: 'gestao',
    descricao: 'Gestão financeira',
  },
  {
    id: 'escalas',
    label: 'Escalas',
    icon: 'CalendarDays',
    categoria: 'gestao',
    descricao: 'Escalas médicas',
  },
  {
    id: 'qualidade-hub',
    label: 'Qualidade',
    icon: 'ShieldCheck',
    categoria: 'gestao',
    descricao: 'Painel de qualidade',
  },
  {
    id: 'faturamento',
    label: 'Faturamento',
    icon: 'Receipt',
    categoria: 'gestao',
    descricao: 'Notas e eventos',
  },

  // Qualidade (7)
  {
    id: 'reportar',
    label: 'Reportar',
    icon: 'AlertTriangle',
    categoria: 'qualidade',
    descricao: 'Incidentes e riscos',
  },
  {
    id: 'indicadores',
    label: 'Indicadores',
    icon: 'TrendingUp',
    categoria: 'qualidade',
    descricao: 'KPIs e métricas',
  },
  {
    id: 'auditorias',
    label: 'Auditorias',
    icon: 'ClipboardCheck',
    categoria: 'qualidade',
    descricao: 'Conformidade',
  },
  {
    id: 'etica',
    label: 'Ética',
    icon: 'Scale',
    categoria: 'qualidade',
    descricao: 'Bioética',
  },
  {
    id: 'desastres',
    label: 'Desastres',
    icon: 'ShieldAlert',
    categoria: 'qualidade',
    descricao: 'Emergências',
  },
  {
    id: 'incidentes',
    label: 'Incidentes',
    icon: 'AlertOctagon',
    categoria: 'qualidade',
    descricao: 'Gestão de incidentes',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: 'FileBarChart',
    categoria: 'qualidade',
    descricao: 'Relatórios de segurança',
  },

  // Documentos (4)
  {
    id: 'protocolos',
    label: 'Protocolos',
    icon: 'BookOpen',
    categoria: 'documentos',
    descricao: 'POPs e guias',
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    icon: 'Library',
    categoria: 'documentos',
    descricao: 'Todos os documentos',
  },
  {
    id: 'infeccao',
    label: 'Infecção',
    icon: 'Bug',
    categoria: 'documentos',
    descricao: 'Controle IRAS',
  },
  {
    id: 'gestao-documental',
    label: 'Gestão Docs',
    icon: 'FolderOpen',
    categoria: 'documentos',
    descricao: 'Gestão documental',
  },

  // Educação (4)
  {
    id: 'rops',
    label: 'Desafio ROPs',
    icon: 'Target',
    categoria: 'educacao',
    descricao: 'Quiz gamificado',
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    icon: 'Headphones',
    categoria: 'educacao',
    descricao: 'Áudio aulas',
  },
  {
    id: 'residencia',
    label: 'Residência',
    icon: 'GraduationCap',
    categoria: 'educacao',
    descricao: 'Calendário médico',
  },
  {
    id: 'educacao-continuada',
    label: 'Ed. Continuada',
    icon: 'BookMarked',
    categoria: 'educacao',
    descricao: 'Cursos e treinamentos',
  },
  {
    id: 'ranking-rops',
    label: 'Ranking',
    icon: 'Trophy',
    categoria: 'educacao',
    descricao: 'Ranking ROPs',
  },

  // Organização (3)
  {
    id: 'organograma',
    label: 'Organograma',
    icon: 'Network',
    categoria: 'organizacao',
    descricao: 'Estrutura 2025',
  },
  {
    id: 'comites',
    label: 'Comitês',
    icon: 'Users',
    categoria: 'organizacao',
    descricao: 'Regimentos',
  },
  {
    id: 'reunioes',
    label: 'Reuniões',
    icon: 'Calendar',
    categoria: 'organizacao',
    descricao: 'Agenda de reuniões',
  },

  // Comunicação (4)
  {
    id: 'comunicados',
    label: 'Comunicados',
    icon: 'Megaphone',
    categoria: 'comunicacao',
    descricao: 'Últimos avisos',
  },
  {
    id: 'pendencias',
    label: 'Pendências',
    icon: 'ClipboardList',
    categoria: 'comunicacao',
    descricao: 'Minhas tarefas',
  },
  {
    id: 'mensagens',
    label: 'Mensagens',
    icon: 'Mail',
    categoria: 'comunicacao',
    descricao: 'Caixa de entrada',
  },
  {
    id: 'meus-relatos',
    label: 'Meus Relatos',
    icon: 'FileSearch',
    categoria: 'comunicacao',
    descricao: 'Incidentes reportados',
  },
];

// Atalhos padrão (4 atalhos iniciais)
export const ATALHOS_PADRAO = ['calculadoras', 'reportar', 'manutencao', 'rops'];

// Limite máximo de atalhos
export const MAX_ATALHOS = 4;

// Helper para buscar atalho por ID
export const getAtalhoById = (id) => {
  return ATALHOS_DISPONIVEIS.find((a) => a.id === id);
};

// Helper para buscar atalhos por categoria
export const getAtalhosByCategoria = (categoriaId) => {
  return ATALHOS_DISPONIVEIS.filter((a) => a.categoria === categoriaId);
};

// Helper para carregar atalhos salvos
export const carregarAtalhosSalvos = () => {
  try {
    const saved = localStorage.getItem('anest_atalhos');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validar que os IDs salvos ainda existem
      const validIds = parsed.filter((id) =>
        ATALHOS_DISPONIVEIS.some((a) => a.id === id)
      );
      if (validIds.length === MAX_ATALHOS) {
        return validIds;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar atalhos:', e);
  }
  return ATALHOS_PADRAO;
};

// Helper para salvar atalhos
export const salvarAtalhos = (ids) => {
  try {
    localStorage.setItem('anest_atalhos', JSON.stringify(ids));
    return true;
  } catch (e) {
    console.error('Erro ao salvar atalhos:', e);
    return false;
  }
};
