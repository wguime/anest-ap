// Utility functions and constants for Educacao Continuada
// (Extracted from mockEducacaoData.js — mock data arrays removed)

// Tipos de midia suportados
export const TIPOS_MIDIA = {
  youtube: { label: 'YouTube', icon: 'Youtube' },
  vimeo: { label: 'Vimeo', icon: 'Video' },
  video: { label: 'Video Local', icon: 'Video' },
  audio: { label: 'Audio', icon: 'Headphones' },
  document: { label: 'Arquivo (PDF/PPT/HTML)', icon: 'FileText' },
  text: { label: 'Texto / Leitura', icon: 'FileText' },
  link: { label: 'Link Externo', icon: 'ExternalLink' },
};

// Tipos de módulo unificados
export const TIPOS_MODULO = {
  conteudo: { label: 'Conteúdo', icon: 'BookOpen' },
  video: { label: 'Vídeo', icon: 'Video' },
  leitura: { label: 'Leitura', icon: 'FileText' },
  quiz: { label: 'Quiz', icon: 'HelpCircle' },
  pratico: { label: 'Prático', icon: 'Wrench' },
};

// Tipos de usuario (re-export para conveniencia)
export const TIPOS_USUARIO = {
  medico: { label: 'Anestesiologista', cor: '#2563eb' }, // alias legado
  anestesiologista: { label: 'Anestesiologista', cor: '#2563eb' },
  residente: { label: 'Medico Residente', cor: '#8b5cf6' }, // alias legado
  'medico-residente': { label: 'Medico Residente', cor: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', cor: '#10b981' },
  tecnico_enfermagem: { label: 'Tec. Enfermagem', cor: '#06b6d4' }, // alias legado
  'tec-enfermagem': { label: 'Tec. Enfermagem', cor: '#06b6d4' },
  secretaria: { label: 'Secretaria', cor: '#f59e0b' },
  farmaceutico: { label: 'Farmaceutico', cor: '#ec4899' },
  administrativo: { label: 'Colaborador', cor: '#6366f1' }, // alias legado
  colaborador: { label: 'Colaborador', cor: '#6366f1' },
  coordenador: { label: 'Coordenador', cor: '#16a085' },
};

// Categorias de cursos (config constants, not real mock data)
export const mockCategorias = [
  { id: 'sem-categoria', nome: 'Sem categoria', quantidade: 3 },
  { id: 'seguranca-paciente', nome: 'Seguranca do Paciente', quantidade: 0 },
  { id: 'controle-infeccao', nome: 'Controle de Infeccao', quantidade: 0 },
  { id: 'anestesiologia', nome: 'Anestesiologia', quantidade: 0 },
  { id: 'qualidade', nome: 'Qualidade', quantidade: 0 },
  { id: 'obrigatorio', nome: 'Obrigatorio', quantidade: 0 },
];

// Tipos de crédito de educação continuada (CE/CME)
export const CREDIT_TYPE_LABELS = {
  geral: 'Geral',
  CME: 'CME',
  enfermagem: 'Enfermagem',
  tecnico: 'Técnico',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getStatusLabel = (status) => {
  const labels = {
    nao_iniciado: 'Nao Iniciado',
    em_andamento: 'Em Andamento',
    concluido: 'Concluido',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    expirado: 'Expirado',
    atrasado: 'Atrasado',
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

// Extrair ID do YouTube de varias formas de URL
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
  // Fallback: se a string parece um video ID puro (11 chars alfanumericos/dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
};

// Extrair ID do Vimeo
export const extractVimeoId = (url) => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

// Calcular progresso da trilha para um usuario
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

// Verificar se visualizacao esta concluida (regra 90%)
export const isVisualizacaoConcluida = (progressoPorcentagem) => {
  return progressoPorcentagem >= 90;
};

// Filtrar trilhas por tipo de usuario
export const filtrarTrilhasPorTipoUsuario = (trilhas, tipoUsuario) => {
  return trilhas.filter(t => t.tiposUsuario.includes(tipoUsuario) && t.ativo);
};

// Calcular dias restantes para prazo
// Para trilhas de orientação, usa dataAdmissao do colaborador em vez de dataLiberacao da trilha
export const calcularDiasRestantes = (dataLiberacao, prazoConclusao, dataAdmissao) => {
  if (!prazoConclusao) return null;
  const dataBase = dataAdmissao || dataLiberacao;
  if (!dataBase) return null;
  const raw = typeof dataBase?.toDate === 'function' ? dataBase.toDate()
    : typeof dataBase?.seconds === 'number' ? new Date(dataBase.seconds * 1000)
    : dataBase;
  const dataLimite = new Date(raw);
  dataLimite.setDate(dataLimite.getDate() + prazoConclusao);
  const hoje = new Date();
  const diff = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============================================
// HELPERS DE NAVEGACAO
// ============================================

/**
 * Obtem os modulos de um curso
 * @param {string} cursoId - ID do curso
 * @param {Array} modulos - Array de modulos
 * @returns {Array} Modulos do curso ordenados
 */
export const getModulosByCurso = (cursoId, modulos = []) => {
  return modulos
    .filter(m => m.cursoId === cursoId)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

/**
 * Obtem as aulas de um modulo
 * @param {string} moduloId - ID do modulo
 * @param {Array} aulas - Array de aulas
 * @returns {Array} Aulas do modulo ordenadas
 */
export const getAulasByModulo = (moduloId, aulas = []) => {
  return aulas
    .filter(a => a.moduloId === moduloId && a.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

/**
 * Obtem as aulas de um curso (via modulos)
 * @param {string} cursoId - ID do curso
 * @param {Array} aulas - Array de aulas
 * @param {Array} modulos - Array de modulos
 * @returns {Array} Aulas do curso ordenadas por modulo e ordem
 */
export const getAulasByCurso = (cursoId, aulas = [], modulos = []) => {
  const modulosIds = getModulosByCurso(cursoId, modulos).map(m => m.id);
  return aulas
    .filter(a => modulosIds.includes(a.moduloId) && a.ativo !== false)
    .sort((a, b) => {
      // Ordenar primeiro por modulo, depois por ordem dentro do modulo
      const modAIndex = modulosIds.indexOf(a.moduloId);
      const modBIndex = modulosIds.indexOf(b.moduloId);
      if (modAIndex !== modBIndex) return modAIndex - modBIndex;
      return (a.ordem || 0) - (b.ordem || 0);
    });
};

/**
 * Obtem todas as aulas de uma trilha (agregacao de todos os cursos)
 * @param {string} trilhaId - ID da trilha
 * @param {Array} trilhas - Array de trilhas
 * @param {Array} cursos - Array de cursos
 * @param {Array} aulas - Array de aulas
 * @param {Array} modulos - Array de modulos
 * @returns {Array} Aulas da trilha ordenadas por curso
 */
export const getAulasByTrilha = (
  trilhaId,
  trilhas = [],
  cursos = [],
  aulas = [],
  modulos = []
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
 * Obtem os cursos de uma trilha
 * @param {string} trilhaId - ID da trilha
 * @param {Array} trilhas - Array de trilhas
 * @param {Array} cursos - Array de cursos
 * @returns {Array} Cursos da trilha na ordem definida
 */
export const getCursosByTrilha = (trilhaId, trilhas = [], cursos = []) => {
  const trilha = trilhas.find(t => t.id === trilhaId);
  if (!trilha) return [];

  return trilha.cursos
    .map(cursoId => cursos.find(c => c.id === cursoId))
    .filter(Boolean);
};

/**
 * Obtem o modulo de uma aula
 * @param {string} aulaId - ID da aula
 * @param {Array} aulas - Array de aulas
 * @param {Array} modulos - Array de modulos
 * @returns {Object|null} Modulo da aula
 */
export const getModuloByAula = (aulaId, aulas = [], modulos = []) => {
  const aula = aulas.find(a => a.id === aulaId);
  if (!aula) return null;
  return modulos.find(m => m.id === aula.moduloId) || null;
};

/**
 * Obtem o curso de uma aula
 * @param {string} aulaId - ID da aula
 * @param {Array} aulas - Array de aulas
 * @param {Array} cursos - Array de cursos
 * @returns {Object|null} Curso da aula
 */
export const getCursoByAula = (aulaId, aulas = [], cursos = []) => {
  const aula = aulas.find(a => a.id === aulaId);
  if (!aula) return null;
  return cursos.find(c => c.id === aula.cursoId) || null;
};

/**
 * Constroi a estrutura hierarquica completa: Trilhas -> Cursos -> Modulos -> Aulas
 * @param {Array} trilhas - Array de trilhas
 * @param {Array} cursos - Array de cursos
 * @param {Array} modulos - Array de modulos
 * @param {Array} aulas - Array de aulas
 * @returns {Array} Estrutura hierarquica completa
 */
export const buildContentTree = (
  trilhas = [],
  cursos = [],
  modulos = [],
  aulas = []
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
 * Conta totais para estatisticas
 */
export const getContentStats = (
  trilhas = [],
  cursos = [],
  modulos = [],
  aulas = []
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
