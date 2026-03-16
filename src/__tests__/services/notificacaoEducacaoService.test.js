import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
vi.mock('../../pages/educacao/data/educacaoUtils', () => ({
  calcularDiasRestantes: vi.fn(),
}));

import { calcularDiasRestantes } from '../../pages/educacao/data/educacaoUtils';
import {
  gerarNotificacoesEducacao,
  notificarTreinamentoVencido,
  notificarCertificadoExpirando,
} from '../../services/notificacaoEducacaoService';

// ============================================================================
// Helpers
// ============================================================================
function makeTrilha(overrides = {}) {
  return {
    id: 'trilha-1',
    titulo: 'Trilha Obrigatoria',
    obrigatoria: true,
    prazoConclusao: 30,
    ativo: true,
    cursos: ['curso-1'],
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeCurso(overrides = {}) {
  return {
    id: 'curso-1',
    titulo: 'Curso A',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================
describe('notificacaoEducacaoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // gerarNotificacoesEducacao
  // --------------------------------------------------------------------------
  describe('gerarNotificacoesEducacao', () => {
    it('returns warning notification when curso is expiring (< 7 days)', () => {
      calcularDiasRestantes.mockReturnValue(5);

      const result = gerarNotificacoesEducacao({
        trilhas: [makeTrilha()],
        cursos: [makeCurso()],
        progressos: [{ cursoId: 'curso-1', progresso: 50 }],
        userId: 'user-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0].tipo).toBe('warning');
      expect(result[0].cursoId).toBe('curso-1');
      expect(result[0].trilhaId).toBe('trilha-1');
      expect(result[0].diasRestantes).toBe(5);
      expect(result[0].mensagem).toContain('5 dias');
    });

    it('returns error notification when curso is overdue (negative days)', () => {
      calcularDiasRestantes.mockReturnValue(-3);

      const result = gerarNotificacoesEducacao({
        trilhas: [makeTrilha()],
        cursos: [makeCurso()],
        progressos: [],
        userId: 'user-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0].tipo).toBe('error');
      expect(result[0].diasRestantes).toBe(-3);
      expect(result[0].mensagem).toContain('atrasado');
      expect(result[0].mensagem).toContain('3 dias');
    });

    it('generates no notification when trilha has no prazoConclusao', () => {
      const result = gerarNotificacoesEducacao({
        trilhas: [makeTrilha({ prazoConclusao: null })],
        cursos: [makeCurso()],
        progressos: [],
        userId: 'user-1',
      });

      expect(result).toHaveLength(0);
      expect(calcularDiasRestantes).not.toHaveBeenCalled();
    });

    it('filters out cursos already completed (progresso >= 100)', () => {
      calcularDiasRestantes.mockReturnValue(3);

      const result = gerarNotificacoesEducacao({
        trilhas: [makeTrilha()],
        cursos: [makeCurso()],
        progressos: [{ cursoId: 'curso-1', progresso: 100 }],
        userId: 'user-1',
      });

      expect(result).toHaveLength(0);
    });

    it('returns multiple notifications for multiple cursos', () => {
      calcularDiasRestantes
        .mockReturnValueOnce(-2)  // curso-1 overdue
        .mockReturnValueOnce(4);  // curso-2 expiring

      const trilha = makeTrilha({ cursos: ['curso-1', 'curso-2'] });
      const cursos = [
        makeCurso({ id: 'curso-1', titulo: 'Curso A' }),
        makeCurso({ id: 'curso-2', titulo: 'Curso B' }),
      ];

      const result = gerarNotificacoesEducacao({
        trilhas: [trilha],
        cursos,
        progressos: [],
        userId: 'user-1',
      });

      expect(result).toHaveLength(2);
      // Errors should be sorted first
      expect(result[0].tipo).toBe('error');
      expect(result[1].tipo).toBe('warning');
    });

    it('returns empty array with no errors for empty inputs', () => {
      const result = gerarNotificacoesEducacao({
        trilhas: [],
        cursos: [],
        progressos: [],
        userId: 'user-1',
      });

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // notificarTreinamentoVencido
  // --------------------------------------------------------------------------
  describe('notificarTreinamentoVencido', () => {
    it('calls notify callback with correct payload', () => {
      const notify = vi.fn();

      notificarTreinamentoVencido(notify, {
        gestorId: 'gestor-1',
        userId: 'user-1',
        userName: 'Joao',
        trilhaTitulo: 'Trilha X',
      });

      expect(notify).toHaveBeenCalledTimes(1);
      const payload = notify.mock.calls[0][0];
      expect(payload.category).toBe('educacao');
      expect(payload.subject).toContain('vencido');
      expect(payload.priority).toBe('urgente');
      expect(payload.dismissable).toBe(false);
    });

    it('includes gestorId, userId and trilhaTitulo in notification', () => {
      const notify = vi.fn();

      notificarTreinamentoVencido(notify, {
        gestorId: 'gestor-abc',
        userId: 'user-xyz',
        userName: 'Maria',
        trilhaTitulo: 'Seguranca do Paciente',
      });

      const payload = notify.mock.calls[0][0];
      expect(payload.recipientId).toBe('gestor-abc');
      expect(payload.content).toContain('Maria');
      expect(payload.content).toContain('Seguranca do Paciente');
    });
  });

  // --------------------------------------------------------------------------
  // notificarCertificadoExpirando
  // --------------------------------------------------------------------------
  describe('notificarCertificadoExpirando', () => {
    it('calls notify callback with correct payload', () => {
      const notify = vi.fn();

      notificarCertificadoExpirando(notify, {
        userId: 'user-1',
        certificadoTitulo: 'BLS Avancado',
        diasRestantes: 15,
      });

      expect(notify).toHaveBeenCalledTimes(1);
      const payload = notify.mock.calls[0][0];
      expect(payload.category).toBe('educacao');
      expect(payload.subject).toContain('expirando');
      expect(payload.recipientId).toBe('user-1');
      expect(payload.dismissable).toBe(true);
    });

    it('message includes certificadoTitulo and diasRestantes', () => {
      const notify = vi.fn();

      notificarCertificadoExpirando(notify, {
        userId: 'user-2',
        certificadoTitulo: 'ACLS Provider',
        diasRestantes: 5,
      });

      const payload = notify.mock.calls[0][0];
      expect(payload.content).toContain('ACLS Provider');
      expect(payload.content).toContain('5 dia');
      // 5 days -> urgente priority
      expect(payload.priority).toBe('urgente');
    });
  });
});
