// Mock data for Educacao Continuada

// Tipos de mídia suportados
export const TIPOS_MIDIA = {
  youtube: { label: 'YouTube', icon: 'Youtube' },
  vimeo: { label: 'Vimeo', icon: 'Video' },
  video: { label: 'Vídeo Local', icon: 'Video' },
  audio: { label: 'Áudio', icon: 'Headphones' },
  document: { label: 'Arquivo (PDF/PPT)', icon: 'FileText' },
};

// Tipos de usuário (re-export para conveniência)
export const TIPOS_USUARIO = {
  medico: { label: 'Anestesiologista', cor: '#2563eb' }, // alias legado
  anestesiologista: { label: 'Anestesiologista', cor: '#2563eb' },
  residente: { label: 'Médico Residente', cor: '#8b5cf6' }, // alias legado
  'medico-residente': { label: 'Médico Residente', cor: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', cor: '#10b981' },
  tecnico_enfermagem: { label: 'Téc. Enfermagem', cor: '#06b6d4' }, // alias legado
  'tec-enfermagem': { label: 'Téc. Enfermagem', cor: '#06b6d4' },
  secretaria: { label: 'Secretária', cor: '#f59e0b' },
  farmaceutico: { label: 'Farmacêutico', cor: '#ec4899' },
  administrativo: { label: 'Colaborador', cor: '#6366f1' }, // alias legado
  colaborador: { label: 'Colaborador', cor: '#6366f1' },
  coordenador: { label: 'Coordenador', cor: '#16a085' },
};

// ============================================
// MÓDULOS (Entidade separada)
// ============================================
export const mockModulos = [
  // Módulos do curso-boas-praticas
  { id: 'mod-bp-1', cursoId: 'curso-boas-praticas', titulo: 'Introducao', tipo: 'video', duracao: 15, ordem: 1, ativo: true },
  { id: 'mod-bp-2', cursoId: 'curso-boas-praticas', titulo: 'Fatores de Risco', tipo: 'video', duracao: 15, ordem: 2, ativo: true },
  { id: 'mod-bp-3', cursoId: 'curso-boas-praticas', titulo: 'Prevencao', tipo: 'quiz', duracao: 15, ordem: 3, ativo: true },
  // Módulos do curso-residuos-saude
  { id: 'mod-rs-1', cursoId: 'curso-residuos-saude', titulo: 'Gerenciamento de Residuos de Saude', tipo: 'video', duracao: 15, ordem: 1, ativo: true },
  // Módulos do curso-protecao-radiologica
  { id: 'mod-pr-1', cursoId: 'curso-protecao-radiologica', titulo: 'Fundamentos', tipo: 'video', duracao: 20, ordem: 1, ativo: true },
  { id: 'mod-pr-2', cursoId: 'curso-protecao-radiologica', titulo: 'Praticas de Protecao', tipo: 'video', duracao: 20, ordem: 2, ativo: true },
  { id: 'mod-pr-3', cursoId: 'curso-protecao-radiologica', titulo: 'Avaliacao Final', tipo: 'quiz', duracao: 20, ordem: 3, ativo: true },
];

export const mockCursos = [
  {
    id: 'curso-boas-praticas',
    titulo: 'Boas Praticas na Prevencao de Infeccoes de Sitio Cirurgico',
    descricao: 'Infeccao de Sitio Cirurgico: Como a Anestesia pode fazer a diferenca',
    banner: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
    cor: '#1976D2',
    categoriaId: 'sem-categoria',
    duracaoMinutos: 45,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2025-01-01'),
    obrigatorio: true,
    ativo: true,
    conteudos: [
      'Conceitos basicos de infeccao',
      'Fatores de risco',
      'Medidas preventivas',
      'Papel da anestesia',
      'Protocolos de seguranca'
    ],
    // Módulos agora referenciados via mockModulos
    modulos: [
      { id: 'mod-bp-1', titulo: 'Introducao', tipo: 'video', duracao: 15 },
      { id: 'mod-bp-2', titulo: 'Fatores de Risco', tipo: 'video', duracao: 15 },
      { id: 'mod-bp-3', titulo: 'Prevencao', tipo: 'quiz', duracao: 15 }
    ],
    pontosAoCompletar: 3.0,
    ordem: 1
  },
  {
    id: 'curso-residuos-saude',
    titulo: 'Gerenciamento de Residuos de Saude',
    descricao: 'Meio Ambiente e Responsabilidade Social',
    banner: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&q=80',
    cor: '#2E7D32',
    categoriaId: 'sem-categoria',
    duracaoMinutos: 15,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2025-12-09'),
    obrigatorio: false,
    ativo: true,
    conteudos: [
      'Conceito de Residuos de Saude',
      'RDC no 222',
      'Classificacao de Residuos',
      'Grupo A; Grupo B; Grupo E',
      'Residuos especiais',
      'Importancia do Descarte correto'
    ],
    modulos: [
      { id: 'mod-rs-1', titulo: 'Gerenciamento de Residuos de Saude', tipo: 'video', duracao: 15 }
    ],
    pontosAoCompletar: 2.0,
    ordem: 2
  },
  {
    id: 'curso-protecao-radiologica',
    titulo: 'Protecao Radiologica',
    descricao: 'Seguranca em ambientes com radiacao',
    banner: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&q=80',
    cor: '#F57C00',
    categoriaId: 'sem-categoria',
    duracaoMinutos: 60,
    metaPorcentagem: 100,
    dataLiberacao: new Date('2025-10-01'),
    obrigatorio: false,
    ativo: true,
    conteudos: [
      'Principios de radioprotecao',
      'EPIs necessarios',
      'Limites de exposicao',
      'Monitoramento individual'
    ],
    modulos: [
      { id: 'mod-pr-1', titulo: 'Fundamentos', tipo: 'video', duracao: 20 },
      { id: 'mod-pr-2', titulo: 'Praticas de Protecao', tipo: 'video', duracao: 20 },
      { id: 'mod-pr-3', titulo: 'Avaliacao Final', tipo: 'quiz', duracao: 20 }
    ],
    pontosAoCompletar: 2.11,
    ordem: 3
  }
];

export const mockProgressos = [
  {
    id: 'prog-1',
    cursoId: 'curso-boas-praticas',
    status: 'em_andamento',
    progresso: 30,
    modulosCompletos: ['mod-1'],
    dataInicio: new Date('2025-01-15'),
    dataConclusao: null,
    pontos: 0
  },
  {
    id: 'prog-2',
    cursoId: 'curso-protecao-radiologica',
    status: 'concluido',
    progresso: 100,
    modulosCompletos: ['mod-1', 'mod-2', 'mod-3'],
    dataInicio: new Date('2025-11-01'),
    dataConclusao: new Date('2025-11-24'),
    pontos: 2.11
  }
];

export const mockCategorias = [
  { id: 'sem-categoria', nome: 'Sem categoria', quantidade: 3 },
  { id: 'seguranca-paciente', nome: 'Segurança do Paciente', quantidade: 0 },
  { id: 'controle-infeccao', nome: 'Controle de Infecção', quantidade: 0 },
  { id: 'anestesiologia', nome: 'Anestesiologia', quantidade: 0 },
  { id: 'qualidade', nome: 'Qualidade', quantidade: 0 },
  { id: 'obrigatorio', nome: 'Obrigatório', quantidade: 0 },
];

export const mockCertificados = [
  {
    id: 'cert-1',
    cursoId: 'curso-protecao-radiologica',
    cursoTitulo: 'Protecao Radiologica',
    cargaHoraria: '1h',
    dataConclusao: new Date('2025-11-24'),
    pdfUrl: null,
    emitido: true
  },
  {
    id: 'cert-2',
    cursoId: 'curso-hiperglicemia',
    cursoTitulo: 'Protocolo - Manejo de Hiperglicemia',
    cargaHoraria: '1h',
    dataConclusao: new Date('2025-11-24'),
    pdfUrl: null,
    emitido: true
  }
];

// Helper functions
export const getStatusLabel = (status) => {
  const labels = {
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    expirado: 'Expirado'
  };
  return labels[status] || status;
};

export const formatDuracao = (minutos) => {
  if (!minutos) return '-';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
};

export const formatData = (data) => {
  if (!data) return '-';
  // Handle Firestore Timestamps (have .toDate() method)
  const raw = typeof data?.toDate === 'function' ? data.toDate()
    : typeof data?.seconds === 'number' ? new Date(data.seconds * 1000)
    : data;
  const dateObj = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleDateString('pt-BR');
};

// ============================================
// AULAS (Vídeos, Áudios)
// ============================================
export const mockAulas = [
  {
    id: 'aula-1',
    cursoId: 'curso-boas-praticas',
    moduloId: 'mod-bp-1',
    titulo: 'Introdução ao Curso',
    descricao: 'Apresentação geral do conteúdo sobre prevenção de infecções',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duracao: 15,
    thumbnail: null,
    ordem: 1,
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'aula-2',
    cursoId: 'curso-boas-praticas',
    moduloId: 'mod-bp-2',
    titulo: 'Fatores de Risco',
    descricao: 'Identificação dos principais fatores de risco para ISC',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duracao: 15,
    thumbnail: null,
    ordem: 2,
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'aula-3',
    cursoId: 'curso-residuos-saude',
    moduloId: 'mod-rs-1',
    titulo: 'Gerenciamento de Resíduos',
    descricao: 'Conceitos e práticas de gerenciamento de resíduos de saúde',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
    duracao: 15,
    thumbnail: null,
    ordem: 1,
    ativo: true,
    createdAt: new Date('2025-12-09'),
    updatedAt: new Date('2025-12-09'),
  },
  {
    id: 'aula-4',
    cursoId: 'curso-protecao-radiologica',
    moduloId: 'mod-pr-1',
    titulo: 'Fundamentos de Radioproteção',
    descricao: 'Princípios básicos de proteção radiológica',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    duracao: 20,
    thumbnail: null,
    ordem: 1,
    ativo: true,
    createdAt: new Date('2025-10-01'),
    updatedAt: new Date('2025-10-01'),
  },
];

// ============================================
// TRILHAS PERSONALIZADAS
// ============================================
export const mockTrilhas = [
  {
    id: 'trilha-onboarding-enfermagem',
    titulo: 'Onboarding - Enfermagem',
    descricao: 'Treinamento inicial obrigatório para equipe de enfermagem',
    tiposUsuario: ['enfermeiro', 'tec-enfermagem'],
    obrigatoria: true,
    prazoConclusao: 30, // dias
    cursos: ['curso-boas-praticas', 'curso-residuos-saude'],
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'trilha-onboarding-medicos',
    titulo: 'Onboarding - Médicos',
    descricao: 'Treinamento inicial obrigatório para médicos',
    tiposUsuario: ['anestesiologista'],
    obrigatoria: true,
    prazoConclusao: 30,
    cursos: ['curso-boas-praticas', 'curso-protecao-radiologica'],
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'trilha-seguranca-geral',
    titulo: 'Segurança Geral',
    descricao: 'Treinamentos de segurança para todos os colaboradores',
    tiposUsuario: ['anestesiologista', 'enfermeiro', 'tec-enfermagem', 'secretaria', 'farmaceutico', 'colaborador'],
    obrigatoria: false,
    prazoConclusao: null,
    cursos: ['curso-residuos-saude'],
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'trilha-radiologia',
    titulo: 'Proteção Radiológica',
    descricao: 'Capacitação em proteção radiológica para equipes que trabalham com radiação',
    tiposUsuario: ['anestesiologista', 'tec-enfermagem'],
    obrigatoria: false,
    prazoConclusao: 60,
    cursos: ['curso-protecao-radiologica'],
    ativo: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
];

// ============================================
// VISUALIZAÇÕES (Tracking)
// ============================================
export const mockVisualizacoes = [
  {
    id: 'view-1',
    userId: 'user-001',
    aulaId: 'aula-1',
    cursoId: 'curso-boas-praticas',
    status: 'concluido',
    progressoPorcentagem: 100,
    tempoAssistido: 900, // segundos
    duracaoTotal: 900,
    iniciadoEm: new Date('2025-01-15T10:00:00'),
    ultimoAcesso: new Date('2025-01-15T10:15:00'),
    concluidoEm: new Date('2025-01-15T10:15:00'),
    dispositivo: 'desktop',
    navegador: 'Chrome 120',
  },
  {
    id: 'view-2',
    userId: 'user-001',
    aulaId: 'aula-2',
    cursoId: 'curso-boas-praticas',
    status: 'em_andamento',
    progressoPorcentagem: 45,
    tempoAssistido: 405, // segundos
    duracaoTotal: 900,
    iniciadoEm: new Date('2025-01-16T14:00:00'),
    ultimoAcesso: new Date('2025-01-16T14:07:00'),
    concluidoEm: null,
    dispositivo: 'mobile',
    navegador: 'Safari 17',
  },
  {
    id: 'view-3',
    userId: 'user-002',
    aulaId: 'aula-1',
    cursoId: 'curso-boas-praticas',
    status: 'nao_iniciado',
    progressoPorcentagem: 0,
    tempoAssistido: 0,
    duracaoTotal: 900,
    iniciadoEm: null,
    ultimoAcesso: null,
    concluidoEm: null,
    dispositivo: null,
    navegador: null,
  },
];

// ============================================
// USUÁRIOS MOCK (para relatórios)
// ============================================
export const mockUsuarios = [
  {
    id: 'user-001',
    nome: 'João Silva',
    email: 'joao.silva@anest.com',
    tipoUsuario: 'anestesiologista',
    role: 'admin',
    ativo: true,
  },
  {
    id: 'user-002',
    nome: 'Maria Santos',
    email: 'maria.santos@anest.com',
    tipoUsuario: 'enfermeiro',
    role: 'user',
    ativo: true,
  },
  {
    id: 'user-003',
    nome: 'Ana Costa',
    email: 'ana.costa@anest.com',
    tipoUsuario: 'tec-enfermagem',
    role: 'user',
    ativo: true,
  },
  {
    id: 'user-004',
    nome: 'Pedro Oliveira',
    email: 'pedro.oliveira@anest.com',
    tipoUsuario: 'anestesiologista',
    role: 'editor',
    ativo: true,
  },
  {
    id: 'user-005',
    nome: 'Carla Ferreira',
    email: 'carla.ferreira@anest.com',
    tipoUsuario: 'secretaria',
    role: 'user',
    ativo: true,
  },
  {
    id: 'user-006',
    nome: 'Lucas Mendes',
    email: 'lucas.mendes@anest.com',
    tipoUsuario: 'medico-residente',
    role: 'user',
    ativo: true,
  },
  {
    id: 'user-007',
    nome: 'Fernanda Lima',
    email: 'fernanda.lima@anest.com',
    tipoUsuario: 'medico-residente',
    role: 'user',
    ativo: true,
  },
];

// ============================================
// HELPERS
// ============================================

// Extrair ID do YouTube de várias formas de URL
export const extractYouTubeId = (url) => {
  if (!url) return null;
  const str = String(url).trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) return match[1];
  }
  // Fallback: se a string parece um video ID puro (11 chars alfanuméricos/dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
};

// Extrair ID do Vimeo
export const extractVimeoId = (url) => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

// Calcular progresso da trilha para um usuário
export const calcularProgressoTrilha = (trilha, userId, visualizacoes, cursos, aulas) => {
  const cursosNaTrilha = cursos.filter(c => trilha.cursos.includes(c.id));
  if (cursosNaTrilha.length === 0) return 0;

  let totalAulas = 0;
  let aulasConcluidas = 0;

  cursosNaTrilha.forEach(curso => {
    const aulasNoCurso = aulas.filter(a => a.cursoId === curso.id);
    totalAulas += aulasNoCurso.length;

    aulasNoCurso.forEach(aula => {
      const vis = visualizacoes.find(v => v.userId === userId && v.aulaId === aula.id);
      if (vis && vis.status === 'concluido') {
        aulasConcluidas++;
      }
    });
  });

  return totalAulas > 0 ? Math.round((aulasConcluidas / totalAulas) * 100) : 0;
};

// Verificar se visualização está concluída (regra 90%)
export const isVisualizacaoConcluida = (progressoPorcentagem) => {
  return progressoPorcentagem >= 90;
};

// Filtrar trilhas por tipo de usuário
export const filtrarTrilhasPorTipoUsuario = (trilhas, tipoUsuario) => {
  return trilhas.filter(t => t.tiposUsuario.includes(tipoUsuario) && t.ativo);
};

// Calcular dias restantes para prazo
export const calcularDiasRestantes = (dataLiberacao, prazoConclusao) => {
  if (!prazoConclusao) return null;
  const dataLimite = new Date(dataLiberacao);
  dataLimite.setDate(dataLimite.getDate() + prazoConclusao);
  const hoje = new Date();
  const diff = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============================================
// HELPERS DE NAVEGAÇÃO
// ============================================

/**
 * Obtém os módulos de um curso
 * @param {string} cursoId - ID do curso
 * @param {Array} modulos - Array de módulos (opcional, usa mockModulos por padrão)
 * @returns {Array} Módulos do curso ordenados
 */
export const getModulosByCurso = (cursoId, modulos = mockModulos) => {
  return modulos
    .filter(m => m.cursoId === cursoId)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

/**
 * Obtém as aulas de um módulo
 * @param {string} moduloId - ID do módulo
 * @param {Array} aulas - Array de aulas (opcional, usa mockAulas por padrão)
 * @returns {Array} Aulas do módulo ordenadas
 */
export const getAulasByModulo = (moduloId, aulas = mockAulas) => {
  return aulas
    .filter(a => a.moduloId === moduloId && a.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

/**
 * Obtém as aulas de um curso (via módulos)
 * @param {string} cursoId - ID do curso
 * @param {Array} aulas - Array de aulas (opcional)
 * @param {Array} modulos - Array de módulos (opcional)
 * @returns {Array} Aulas do curso ordenadas por módulo e ordem
 */
export const getAulasByCurso = (cursoId, aulas = mockAulas, modulos = mockModulos) => {
  const modulosIds = getModulosByCurso(cursoId, modulos).map(m => m.id);
  return aulas
    .filter(a => modulosIds.includes(a.moduloId) && a.ativo !== false)
    .sort((a, b) => {
      // Ordenar primeiro por módulo, depois por ordem dentro do módulo
      const modAIndex = modulosIds.indexOf(a.moduloId);
      const modBIndex = modulosIds.indexOf(b.moduloId);
      if (modAIndex !== modBIndex) return modAIndex - modBIndex;
      return (a.ordem || 0) - (b.ordem || 0);
    });
};

/**
 * Obtém todas as aulas de uma trilha (agregação de todos os cursos)
 * @param {string} trilhaId - ID da trilha
 * @param {Array} trilhas - Array de trilhas (opcional)
 * @param {Array} cursos - Array de cursos (opcional)
 * @param {Array} aulas - Array de aulas (opcional)
 * @param {Array} modulos - Array de módulos (opcional)
 * @returns {Array} Aulas da trilha ordenadas por curso
 */
export const getAulasByTrilha = (
  trilhaId,
  trilhas = mockTrilhas,
  cursos = mockCursos,
  aulas = mockAulas,
  modulos = mockModulos
) => {
  const trilha = trilhas.find(t => t.id === trilhaId);
  if (!trilha) return [];

  const result = [];
  trilha.cursos.forEach(cursoId => {
    const cursosAulas = getAulasByCurso(cursoId, aulas, modulos);
    result.push(...cursosAulas);
  });

  return result;
};

/**
 * Obtém os cursos de uma trilha
 * @param {string} trilhaId - ID da trilha
 * @param {Array} trilhas - Array de trilhas (opcional)
 * @param {Array} cursos - Array de cursos (opcional)
 * @returns {Array} Cursos da trilha na ordem definida
 */
export const getCursosByTrilha = (trilhaId, trilhas = mockTrilhas, cursos = mockCursos) => {
  const trilha = trilhas.find(t => t.id === trilhaId);
  if (!trilha) return [];

  return trilha.cursos
    .map(cursoId => cursos.find(c => c.id === cursoId))
    .filter(Boolean);
};

/**
 * Obtém o módulo de uma aula
 * @param {string} aulaId - ID da aula
 * @param {Array} aulas - Array de aulas (opcional)
 * @param {Array} modulos - Array de módulos (opcional)
 * @returns {Object|null} Módulo da aula
 */
export const getModuloByAula = (aulaId, aulas = mockAulas, modulos = mockModulos) => {
  const aula = aulas.find(a => a.id === aulaId);
  if (!aula) return null;
  return modulos.find(m => m.id === aula.moduloId) || null;
};

/**
 * Obtém o curso de uma aula
 * @param {string} aulaId - ID da aula
 * @param {Array} aulas - Array de aulas (opcional)
 * @param {Array} cursos - Array de cursos (opcional)
 * @returns {Object|null} Curso da aula
 */
export const getCursoByAula = (aulaId, aulas = mockAulas, cursos = mockCursos) => {
  const aula = aulas.find(a => a.id === aulaId);
  if (!aula) return null;
  return cursos.find(c => c.id === aula.cursoId) || null;
};

/**
 * Constrói a estrutura hierárquica completa: Trilhas → Cursos → Módulos → Aulas
 * @param {Array} trilhas - Array de trilhas (opcional)
 * @param {Array} cursos - Array de cursos (opcional)
 * @param {Array} modulos - Array de módulos (opcional)
 * @param {Array} aulas - Array de aulas (opcional)
 * @returns {Array} Estrutura hierárquica completa
 */
export const buildContentTree = (
  trilhas = mockTrilhas,
  cursos = mockCursos,
  modulos = mockModulos,
  aulas = mockAulas
) => {
  return trilhas.map(trilha => ({
    ...trilha,
    type: 'trilha',
    children: trilha.cursos
      .map(cursoId => {
        const curso = cursos.find(c => c.id === cursoId);
        if (!curso) return null;

        const cursoModulos = getModulosByCurso(curso.id, modulos);
        return {
          ...curso,
          type: 'curso',
          children: cursoModulos.map(modulo => ({
            ...modulo,
            type: 'modulo',
            children: getAulasByModulo(modulo.id, aulas).map(aula => ({
              ...aula,
              type: 'aula',
            })),
          })),
        };
      })
      .filter(Boolean),
  }));
};

/**
 * Conta totais para estatísticas
 */
export const getContentStats = (
  trilhas = mockTrilhas,
  cursos = mockCursos,
  modulos = mockModulos,
  aulas = mockAulas
) => {
  return {
    totalTrilhas: trilhas.length,
    totalCursos: cursos.length,
    totalModulos: modulos.length,
    totalAulas: aulas.filter(a => a.ativo !== false).length,
    trilhasAtivas: trilhas.filter(t => t.ativo !== false).length,
    cursosAtivos: cursos.filter(c => c.ativo !== false).length,
  };
};
