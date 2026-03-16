/**
 * helpers/mocks.js
 * Factory de mocks reutilizáveis para testes de Educação Continuada
 */

// ============================================================================
// USER
// ============================================================================

export function mockUser(overrides = {}) {
  return {
    uid: 'test-uid-123',
    displayName: 'Test User',
    email: 'test@test.com',
    isAdmin: false,
    role: 'anestesiologista',
    permissions: {},
    ...overrides,
  };
}

// ============================================================================
// AULA
// ============================================================================

export function mockAula(overrides = {}) {
  return {
    id: 'aula-1',
    titulo: 'Aula de Teste',
    descricao: 'Descrição da aula de teste',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duracao: 30, // minutos
    thumbnail: null,
    moduloId: 'modulo-1',
    cursoId: 'curso-1',
    ordem: 1,
    ativo: true,
    statusPublicacao: 'published',
    effectiveVisibility: 'PUBLIC',
    ...overrides,
  };
}

// ============================================================================
// CURSO
// ============================================================================

export function mockCurso(overrides = {}) {
  return {
    id: 'curso-1',
    titulo: 'Curso de Teste',
    descricao: 'Descrição do curso de teste',
    duracaoMinutos: 120,
    obrigatorio: false,
    categoriaId: 'sem-categoria',
    ativo: true,
    statusPublicacao: 'published',
    effectiveVisibility: 'PUBLIC',
    pontosAoCompletar: 100,
    maxTentativas: 3,
    tempoLimiteMinutos: null,
    tipoCreditoEducacao: 'geral',
    creditosHoras: null,
    ...overrides,
  };
}

// ============================================================================
// TRILHA
// ============================================================================

export function mockTrilha(overrides = {}) {
  return {
    id: 'trilha-1',
    titulo: 'Trilha de Teste',
    descricao: 'Descrição da trilha de teste',
    cursos: ['curso-1', 'curso-2'],
    obrigatoria: false,
    prazoConclusao: null,
    ativo: true,
    statusPublicacao: 'published',
    effectiveVisibility: 'PUBLIC',
    tiposUsuario: ['anestesiologista', 'enfermeiro'],
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ============================================================================
// CERTIFICADO
// ============================================================================

export function mockCertificado(overrides = {}) {
  return {
    id: 'cert-uuid-123',
    userId: 'test-uid-123',
    userNome: 'Test User',
    cursoId: 'curso-1',
    cursoTitulo: 'Curso de Teste',
    cargaHoraria: '2h',
    dataConclusao: new Date('2025-06-15'),
    dataEmissao: new Date('2025-06-15'),
    dataEmissaoISO: '2025-06-15T12:00:00.000Z',
    validoAte: new Date('2026-06-15'),
    assinaturaHMAC: 'mock-hmac-signature',
    status: 'valido',
    tipoCreditoEducacao: 'geral',
    creditosHoras: 2,
    ...overrides,
  };
}

// ============================================================================
// PROGRESSO
// ============================================================================

export function mockProgresso(overrides = {}) {
  return {
    cursoId: 'curso-1',
    status: 'em_andamento',
    progresso: 50,
    percentual: 50,
    aulasAssistidas: ['aula-1'],
    pontos: 0,
    notaQuiz: null,
    dataConclusao: null,
    dataLimite: null,
    ...overrides,
  };
}

// ============================================================================
// FIRESTORE MOCK
// ============================================================================

export function mockFirestore() {
  return {
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() =>
      Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })
    ),
    getDoc: vi.fn(() =>
      Promise.resolve({ exists: () => false, data: () => null, id: 'mock-id' })
    ),
    getDocsFromServer: vi.fn(() =>
      Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    documentId: vi.fn(),
    writeBatch: vi.fn(() => ({
      update: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    })),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    arrayUnion: vi.fn((...args) => ({ _type: 'arrayUnion', values: args })),
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
    deleteField: vi.fn(() => ({ _type: 'deleteField' })),
    onSnapshot: vi.fn(),
    Timestamp: {
      now: vi.fn(() => ({
        seconds: Date.now() / 1000,
        toDate: () => new Date(),
      })),
      fromDate: vi.fn((d) => ({
        seconds: d.getTime() / 1000,
        toDate: () => d,
      })),
    },
  };
}

// ============================================================================
// QUIZ PERGUNTAS
// ============================================================================

export function mockPerguntas(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    texto: `Pergunta ${i + 1}?`,
    opcoes: [`Opção A${i}`, `Opção B${i}`, `Opção C${i}`, `Opção D${i}`],
    respostaCorreta: 0, // always first option
  }));
}
