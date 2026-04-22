/**
 * canManageTrades — gate principal de visibilidade do card "Trocas".
 *
 * Cenários:
 *   - Funcionária com email cadastrado: vê o card mesmo SEM permission no Firestore.
 *   - Anestesista (não funcionária + sem permission): NÃO vê.
 *   - Tec-enfermagem com permission sobreaviso-materno: vê.
 *   - Admin/Coordenador: vê.
 *   - Usuário sem dados: NÃO vê.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { now: vi.fn() },
}));
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../services/firestoreSubscriptionHelper', () => ({
  createFirestoreSubscription: vi.fn(() => ({ cleanup: vi.fn() })),
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: vi.fn() }));
vi.mock('@/design-system/components/anest/admin-only', () => ({
  isAdministrator: (user) => !!user?.isAdmin,
}));

import { canManageTrades } from '../../hooks/useTrocaSobreaviso';

describe('canManageTrades — gate de visibilidade', () => {
  describe('Funcionárias por email (devem ver SEM permission)', () => {
    it('Marta vê pelo email cadastrado', () => {
      expect(canManageTrades({ email: 'martaa0804@gmail.com', role: null })).toBe(true);
    });

    it('Mari (recém-adicionada) vê pelo email', () => {
      expect(canManageTrades({ email: 'maritania051@gmail.com', role: null })).toBe(true);
    });

    it('Renata vê pelo email', () => {
      expect(canManageTrades({ email: 'renatagracielalucca@gmail.com' })).toBe(true);
    });

    it('Saionara vê pelo email mesmo sem permission no Firestore', () => {
      expect(canManageTrades({
        email: 'saionararebelatto@gmail.com',
        role: 'tec-enfermagem',
        permissions: { 'sobreaviso-materno': false },
      })).toBe(true);
    });
  });

  describe('Roles administrativos', () => {
    it('isAdmin vê', () => {
      expect(canManageTrades({ email: 'admin@a.com', isAdmin: true })).toBe(true);
    });

    it('isCoordenador vê', () => {
      expect(canManageTrades({ email: 'coord@a.com', isCoordenador: true })).toBe(true);
    });

    it('role administrador vê', () => {
      expect(canManageTrades({ email: 'a@a.com', role: 'administrador' })).toBe(true);
    });

    it('role coordenador vê', () => {
      expect(canManageTrades({ email: 'c@a.com', role: 'coordenador' })).toBe(true);
    });
  });

  describe('Tec-enfermagem com permission explícita (caminho legado)', () => {
    it('vê com role + permission', () => {
      expect(canManageTrades({
        email: 'outra@hospital.com',
        role: 'tec-enfermagem',
        permissions: { 'sobreaviso-materno': true },
      })).toBe(true);
    });

    it('NÃO vê sem permission', () => {
      expect(canManageTrades({
        email: 'outra@hospital.com',
        role: 'tec-enfermagem',
      })).toBe(false);
    });

    it('role colaborador-materno (legado) vê', () => {
      expect(canManageTrades({
        email: 'cm@hospital.com',
        role: 'colaborador-materno',
      })).toBe(true);
    });
  });

  describe('Bloqueio para outros usuários', () => {
    it('Anestesista comum NÃO vê', () => {
      expect(canManageTrades({
        email: 'wguime@yahoo.com.br',
        role: 'anestesista',
      })).toBe(false);
    });

    it('Residente NÃO vê', () => {
      expect(canManageTrades({
        email: 'residente@hospital.com',
        role: 'residente',
      })).toBe(false);
    });

    it('Visitante NÃO vê', () => {
      expect(canManageTrades({
        email: 'visitante@x.com',
        role: 'visitante',
      })).toBe(false);
    });

    it('Sem usuário NÃO vê', () => {
      expect(canManageTrades(null)).toBe(false);
      expect(canManageTrades(undefined)).toBe(false);
      expect(canManageTrades({})).toBe(false);
    });
  });
});
