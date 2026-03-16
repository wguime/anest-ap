/**
 * educacaoService.pure.test.js
 * Tests for pure/synchronous functions exported by educacaoService.
 * No real Firebase calls — only top-level import mocks so the module loads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase (required because educacaoService imports at top level) ───
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  documentId: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  increment: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  deleteField: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('../../config/firebase', () => ({ db: {} }));

// ─── Import the functions under test ────────────────────────────────────────
import {
  getUserBadges,
  calcularBonusPontos,
  hasEducacaoPermission,
  getComplianceSummary,
  isEntityAccessible,
  calculateAndPersistVisibility,
  BADGE_DEFINITIONS,
  TIPOS_USUARIO,
  EDUCACAO_PERMISSIONS,
} from '../../services/educacaoService';

// =============================================================================
// getUserBadges
// =============================================================================
describe('getUserBadges', () => {
  // Test 1: primeiro_curso — 1 concluido
  it('unlocks primeiro_curso when at least 1 progresso is concluido', () => {
    const progressos = [{ status: 'concluido', cursoId: 'c1', dataConclusao: new Date('2025-06-01') }];
    const badges = getUserBadges(progressos, [], []);
    const badge = badges.find(b => b.id === 'primeiro_curso');
    expect(badge.unlocked).toBe(true);
    expect(badge.unlockedAt).toEqual(new Date('2025-06-01'));
  });

  // Test 2: nota_maxima — quiz 100%
  it('unlocks nota_maxima when a concluido progresso has notaQuiz >= 100', () => {
    const progressos = [{ status: 'concluido', cursoId: 'c1', notaQuiz: 100 }];
    const badges = getUserBadges(progressos, [], []);
    const badge = badges.find(b => b.id === 'nota_maxima');
    expect(badge.unlocked).toBe(true);
  });

  // Test 3: trilha_completa — trilha concluida
  it('unlocks trilha_completa when a trilhaProgresso has status concluido', () => {
    const trilhaProgressos = [{ status: 'concluido' }];
    const badges = getUserBadges([], [], trilhaProgressos);
    const badge = badges.find(b => b.id === 'trilha_completa');
    expect(badge.unlocked).toBe(true);
  });

  // Test 4: streak_7 — always false (computed externally)
  it('never unlocks streak_7 (computed externally)', () => {
    const progressos = Array.from({ length: 20 }, (_, i) => ({
      status: 'concluido',
      cursoId: `c${i}`,
      notaQuiz: 100,
    }));
    const badges = getUserBadges(progressos, [], []);
    const badge = badges.find(b => b.id === 'streak_7');
    expect(badge.unlocked).toBe(false);
  });

  // Test 5: sem progressos — empty arrays → 0 unlocked badges
  it('returns 0 unlocked badges when all arrays are empty', () => {
    const badges = getUserBadges([], [], []);
    const unlocked = badges.filter(b => b.unlocked);
    expect(unlocked).toHaveLength(0);
  });

  // Test 6: multiple badges — various conditions
  it('unlocks multiple badges when conditions are met', () => {
    const progressos = Array.from({ length: 5 }, (_, i) => ({
      status: 'concluido',
      cursoId: `c${i}`,
      notaQuiz: i === 0 ? 100 : 80,
      dataConclusao: new Date('2025-06-01'),
      dataLimite: new Date('2025-07-01'),
    }));
    const trilhaProgressos = [{ status: 'concluido' }];
    const badges = getUserBadges(progressos, [], trilhaProgressos);

    expect(badges.find(b => b.id === 'primeiro_curso').unlocked).toBe(true);
    expect(badges.find(b => b.id === 'nota_maxima').unlocked).toBe(true);
    expect(badges.find(b => b.id === 'trilha_completa').unlocked).toBe(true);
    expect(badges.find(b => b.id === 'cinco_cursos').unlocked).toBe(true);
    expect(badges.find(b => b.id === 'madrugador').unlocked).toBe(true);
  });

  // Test 26: completista — all mandatory courses completed
  it('unlocks completista when all obrigatorio cursos are concluidos', () => {
    const cursos = [
      { id: 'c1', obrigatorio: true },
      { id: 'c2', obrigatorio: true },
      { id: 'c3', obrigatorio: false },
    ];
    const progressos = [
      { status: 'concluido', cursoId: 'c1' },
      { status: 'concluido', cursoId: 'c2' },
    ];
    const badges = getUserBadges(progressos, cursos, []);
    const badge = badges.find(b => b.id === 'completista');
    expect(badge.unlocked).toBe(true);
  });
});

// =============================================================================
// calcularBonusPontos
// =============================================================================
describe('calcularBonusPontos', () => {
  // Test 7: nota > 90% → 20% bonus
  it('gives 20% bonus when notaQuiz > 90', () => {
    const bonus = calcularBonusPontos(100, 95);
    expect(bonus).toBe(20);
  });

  // Test 8: conclusao antes do prazo → 10% bonus
  it('gives 10% bonus when dataConclusao is before dataLimite', () => {
    const bonus = calcularBonusPontos(100, 70, new Date('2025-06-01'), new Date('2025-07-01'));
    expect(bonus).toBe(10);
  });

  // Test 9: ambos bonus → 30%
  it('gives 30% bonus when both nota > 90 and before deadline', () => {
    const bonus = calcularBonusPontos(100, 95, new Date('2025-06-01'), new Date('2025-07-01'));
    expect(bonus).toBe(30);
  });

  // Test 10: sem bonus — nota 70%, atrasado
  it('returns 0 when nota <= 90 and dataConclusao >= dataLimite', () => {
    const bonus = calcularBonusPontos(100, 70, new Date('2025-07-15'), new Date('2025-07-01'));
    expect(bonus).toBe(0);
  });

  // Test 25: pontosBase 0 → 0 + bonus = 0
  it('returns 0 when pontosBase is 0 even with bonus conditions met', () => {
    const bonus = calcularBonusPontos(0, 100, new Date('2025-06-01'), new Date('2025-07-01'));
    expect(bonus).toBe(0);
  });
});

// =============================================================================
// hasEducacaoPermission
// =============================================================================
describe('hasEducacaoPermission', () => {
  // Test 11: admin always true
  it('returns true for admin user regardless of permission', () => {
    const user = { isAdmin: true, permissions: {} };
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.VIEW)).toBe(true);
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.MANAGE)).toBe(true);
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.REPORTS)).toBe(true);
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.PUBLISH)).toBe(true);
  });

  // Test 12: user com permissao
  it('returns true when user has the specific permission', () => {
    const user = {
      isAdmin: false,
      permissions: { [EDUCACAO_PERMISSIONS.VIEW]: true },
    };
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.VIEW)).toBe(true);
  });

  // Test 13: user sem permissao
  it('returns false when user does not have the permission', () => {
    const user = {
      isAdmin: false,
      permissions: { [EDUCACAO_PERMISSIONS.VIEW]: true },
    };
    expect(hasEducacaoPermission(user, EDUCACAO_PERMISSIONS.MANAGE)).toBe(false);
  });
});

// =============================================================================
// getComplianceSummary
// =============================================================================
describe('getComplianceSummary', () => {
  const baseDate = new Date('2025-01-01');

  // Test 14: todos conformes — 100% compliance
  it('returns 100% compliance when all users completed all mandatory courses', () => {
    const usuarios = [{ id: 'u1' }, { id: 'u2' }];
    const trilhas = [
      {
        id: 't1',
        obrigatoria: true,
        prazoConclusao: 90,
        ativo: true,
        cursos: ['c1'],
        createdAt: baseDate,
      },
    ];
    const progressosPorUsuario = {
      u1: [{ cursoId: 'c1', progresso: 100 }],
      u2: [{ cursoId: 'c1', progresso: 100 }],
    };

    const result = getComplianceSummary(usuarios, trilhas, progressosPorUsuario);
    expect(result.totalUsuarios).toBe(2);
    expect(result.emConformidade).toBe(2);
    expect(result.parcialmenteConformes).toBe(0);
    expect(result.naoConformes).toBe(0);
    expect(result.porcentagemConformidade).toBe(100);
  });

  // Test 15: mix — parcial + nao conforme
  it('returns mixed compliance when some users are partial and some overdue', () => {
    const usuarios = [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }];
    const trilhas = [
      {
        id: 't1',
        obrigatoria: true,
        prazoConclusao: 30,
        ativo: true,
        cursos: ['c1', 'c2'],
        createdAt: new Date('2024-01-01'), // long ago, so courses are overdue
      },
    ];
    const progressosPorUsuario = {
      u1: [
        { cursoId: 'c1', progresso: 100 },
        { cursoId: 'c2', progresso: 100 },
      ],
      u2: [
        { cursoId: 'c1', progresso: 50 },
        { cursoId: 'c2', progresso: 50 },
      ],
      u3: [],
    };

    const result = getComplianceSummary(usuarios, trilhas, progressosPorUsuario);
    expect(result.totalUsuarios).toBe(3);
    expect(result.emConformidade).toBe(1); // u1 completed all
    // u2 and u3 have overdue courses (prazoConclusao=30 from 2024-01-01)
    expect(result.naoConformes).toBeGreaterThanOrEqual(1);
  });

  // Test 16: sem usuarios — returns zeros
  it('returns zeros when there are no users', () => {
    const trilhas = [
      {
        id: 't1',
        obrigatoria: true,
        prazoConclusao: 30,
        ativo: true,
        cursos: ['c1'],
        createdAt: baseDate,
      },
    ];

    const result = getComplianceSummary([], trilhas, {});
    expect(result.totalUsuarios).toBe(0);
    expect(result.emConformidade).toBe(0);
    expect(result.porcentagemConformidade).toBe(0);
  });

  // Test 24: progressos parciais — correct partial calculation
  it('counts partially-compliant users correctly (some progress, not overdue)', () => {
    // Use a future-ish base date so the deadline hasn't passed
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

    const usuarios = [{ id: 'u1' }];
    const trilhas = [
      {
        id: 't1',
        obrigatoria: true,
        prazoConclusao: 60, // 60 days from recentDate = still in time
        ativo: true,
        cursos: ['c1', 'c2'],
        createdAt: recentDate,
      },
    ];
    const progressosPorUsuario = {
      u1: [
        { cursoId: 'c1', progresso: 100 },
        { cursoId: 'c2', progresso: 50 },
      ],
    };

    const result = getComplianceSummary(usuarios, trilhas, progressosPorUsuario);
    expect(result.parcialmenteConformes).toBe(1);
    expect(result.emConformidade).toBe(0);
    expect(result.naoConformes).toBe(0);
  });
});

// =============================================================================
// EDUCACAO_PERMISSIONS constants
// =============================================================================
describe('EDUCACAO_PERMISSIONS', () => {
  // Test 17: VIEW, MANAGE, REPORTS, PUBLISH defined
  it('defines VIEW, MANAGE, REPORTS, and PUBLISH permission strings', () => {
    expect(EDUCACAO_PERMISSIONS.VIEW).toBe('educacao-view');
    expect(EDUCACAO_PERMISSIONS.MANAGE).toBe('educacao-manage');
    expect(EDUCACAO_PERMISSIONS.REPORTS).toBe('educacao-reports');
    expect(EDUCACAO_PERMISSIONS.PUBLISH).toBe('educacao-publish');
  });
});

// =============================================================================
// BADGE_DEFINITIONS
// =============================================================================
describe('BADGE_DEFINITIONS', () => {
  // Test 18: 8 badges with id/titulo/descricao
  it('contains exactly 8 badge definitions each with id, titulo, and descricao', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(8);
    BADGE_DEFINITIONS.forEach(badge => {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('titulo');
      expect(badge).toHaveProperty('descricao');
      expect(typeof badge.id).toBe('string');
      expect(typeof badge.titulo).toBe('string');
      expect(typeof badge.descricao).toBe('string');
    });
  });
});

// =============================================================================
// isEntityAccessible
// =============================================================================
describe('isEntityAccessible', () => {
  // Test 19: publicado + ativo → true
  it('returns true for a published and active entity', () => {
    const entity = { statusPublicacao: 'published', ativo: true };
    expect(isEntityAccessible(entity)).toBe(true);
  });

  // Test 20: rascunho (draft) → false
  it('returns false for a draft entity', () => {
    const entity = { statusPublicacao: 'draft', ativo: true };
    expect(isEntityAccessible(entity)).toBe(false);
  });

  // Test 21: inativo → false
  it('returns false for an inactive entity', () => {
    const entity = { statusPublicacao: 'published', ativo: false };
    expect(isEntityAccessible(entity)).toBe(false);
  });
});

// =============================================================================
// calculateAndPersistVisibility
// =============================================================================
describe('calculateAndPersistVisibility', () => {
  // Test 22: correct inheritance via computeEffectiveVisibility
  it('returns effective visibility based on entity and ancestry', () => {
    // Entity with INHERIT (default) + parent with RESTRICTED
    const entity = { visibilityMode: 'INHERIT' };
    const ancestry = [
      { visibilityMode: 'RESTRICTED', allowedUserTypes: ['anestesiologista', 'enfermeiro'] },
    ];
    const result = calculateAndPersistVisibility(entity, ancestry);
    expect(result.effectiveVisibility).toBe('RESTRICTED');
    expect(result.effectiveAllowedUserTypes).toEqual(['anestesiologista', 'enfermeiro']);
  });

  it('returns PUBLIC when entity is explicitly PUBLIC', () => {
    const entity = { visibilityMode: 'PUBLIC' };
    const result = calculateAndPersistVisibility(entity, []);
    expect(result.effectiveVisibility).toBe('PUBLIC');
    expect(result.effectiveAllowedUserTypes).toEqual([]);
  });

  it('defaults to PUBLIC when entire chain is INHERIT', () => {
    const entity = { visibilityMode: 'INHERIT' };
    const ancestry = [
      { visibilityMode: 'INHERIT' },
      { visibilityMode: 'INHERIT' },
    ];
    const result = calculateAndPersistVisibility(entity, ancestry);
    expect(result.effectiveVisibility).toBe('PUBLIC');
    expect(result.effectiveAllowedUserTypes).toEqual([]);
  });
});

// =============================================================================
// TIPOS_USUARIO
// =============================================================================
describe('TIPOS_USUARIO', () => {
  // Test 23: all types defined
  it('defines all expected user types with label and color', () => {
    const expectedKeys = [
      'anestesiologista',
      'medico-residente',
      'enfermeiro',
      'tec-enfermagem',
      'farmaceutico',
      'colaborador',
      'coordenador',
      'secretaria',
    ];

    expectedKeys.forEach(key => {
      expect(TIPOS_USUARIO).toHaveProperty(key);
      expect(TIPOS_USUARIO[key]).toHaveProperty('label');
      expect(TIPOS_USUARIO[key]).toHaveProperty('color');
    });
  });
});
