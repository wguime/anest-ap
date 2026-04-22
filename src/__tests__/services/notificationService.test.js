import { describe, it, expect, vi } from 'vitest';
import { notifyComunicadoPublicado, notifyAcaoRequerida } from '../../services/notificationService';

describe('notificationService — comunicados', () => {
  describe('notifyComunicadoPublicado', () => {
    it('inclui actionParams com comunicadoId para deep-link', () => {
      const notify = vi.fn();
      notifyComunicadoPublicado(notify, {
        titulo: 'Plantão de sábado',
        tipo: 'Importante',
        recipientIds: ['user-1', 'user-2'],
        comunicadoId: 'com-123',
      });

      expect(notify).toHaveBeenCalledTimes(1);
      const payload = notify.mock.calls[0][0];
      expect(payload.actionUrl).toBe('comunicados');
      expect(payload.actionParams).toEqual({ comunicadoId: 'com-123' });
      expect(payload.relatedEntityType).toBe('comunicado');
      expect(payload.relatedEntityId).toBe('com-123');
      expect(payload.recipientIds).toEqual(['user-1', 'user-2']);
    });

    it('envia para todos os recipientIds informados', () => {
      const notify = vi.fn();
      const recipientIds = ['u1', 'u2', 'u3', 'u4', 'u5'];
      notifyComunicadoPublicado(notify, {
        titulo: 'Aviso geral',
        tipo: 'Geral',
        recipientIds,
        comunicadoId: 'com-42',
      });
      expect(notify.mock.calls[0][0].recipientIds).toHaveLength(5);
      expect(notify.mock.calls[0][0].recipientIds).toEqual(recipientIds);
    });

    it('mapeia prioridade por tipo', () => {
      const notify = vi.fn();
      notifyComunicadoPublicado(notify, { titulo: 'x', tipo: 'Urgente', recipientIds: ['u1'], comunicadoId: 'c1' });
      expect(notify.mock.calls[0][0].priority).toBe('urgente');
      expect(notify.mock.calls[0][0].dismissable).toBe(false);

      notify.mockClear();
      notifyComunicadoPublicado(notify, { titulo: 'x', tipo: 'Importante', recipientIds: ['u1'], comunicadoId: 'c1' });
      expect(notify.mock.calls[0][0].priority).toBe('alta');

      notify.mockClear();
      notifyComunicadoPublicado(notify, { titulo: 'x', tipo: 'Geral', recipientIds: ['u1'], comunicadoId: 'c1' });
      expect(notify.mock.calls[0][0].priority).toBe('normal');
      expect(notify.mock.calls[0][0].dismissable).toBe(true);
    });

    it('actionParams é null quando comunicadoId não é fornecido (retro-compat)', () => {
      const notify = vi.fn();
      notifyComunicadoPublicado(notify, {
        titulo: 'x',
        tipo: 'Geral',
        recipientIds: ['u1'],
      });
      expect(notify.mock.calls[0][0].actionParams).toBeNull();
      expect(notify.mock.calls[0][0].relatedEntityId).toBeNull();
    });

    it('subject inclui tipo e titulo', () => {
      const notify = vi.fn();
      notifyComunicadoPublicado(notify, {
        titulo: 'Escala nova',
        tipo: 'Informativo',
        recipientIds: ['u1'],
        comunicadoId: 'c1',
      });
      expect(notify.mock.calls[0][0].subject).toBe('Informativo: Escala nova');
    });

    it('category é sempre comunicado', () => {
      const notify = vi.fn();
      notifyComunicadoPublicado(notify, {
        titulo: 'x',
        tipo: 'Geral',
        recipientIds: ['u1'],
        comunicadoId: 'c1',
      });
      expect(notify.mock.calls[0][0].category).toBe('comunicado');
    });
  });

  describe('notifyAcaoRequerida', () => {
    it('inclui actionParams com comunicadoId', () => {
      const notify = vi.fn();
      notifyAcaoRequerida(notify, {
        comunicadoTitle: 'Assinar termo',
        acao: 'Ler e confirmar',
        recipientIds: ['u1', 'u2'],
        comunicadoId: 'com-99',
      });
      const payload = notify.mock.calls[0][0];
      expect(payload.actionParams).toEqual({ comunicadoId: 'com-99' });
      expect(payload.relatedEntityId).toBe('com-99');
      expect(payload.priority).toBe('alta');
      expect(payload.dismissable).toBe(false);
      expect(payload.recipientIds).toEqual(['u1', 'u2']);
    });
  });
});
