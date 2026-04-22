import { describe, it, expect, vi } from 'vitest';
import { notifyNovoConteudoEducacao } from '../../services/notificationService';

describe('notifyNovoConteudoEducacao', () => {
  it('tipo=curso: subject e content apropriados', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'curso',
      titulo: 'Anestesia Pediátrica Avançada',
      entityId: 'cur-42',
      recipientIds: ['u1', 'u2'],
    });
    const payload = notify.mock.calls[0][0];
    expect(payload.subject).toBe('Nova curso publicada: Anestesia Pediátrica Avançada');
    expect(payload.content).toContain('Anestesia Pediátrica Avançada');
    expect(payload.content).toContain('curso');
    expect(payload.recipientIds).toEqual(['u1', 'u2']);
  });

  it('tipo=trilha: label trilha', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'trilha',
      titulo: 'ANEST 2026',
      entityId: 't-1',
      recipientIds: ['u1'],
    });
    expect(notify.mock.calls[0][0].subject).toBe('Nova trilha publicada: ANEST 2026');
  });

  it('tipo=modulo: label módulo', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'modulo',
      titulo: 'Via Aérea Difícil',
      entityId: 'm-1',
      recipientIds: ['u1'],
    });
    expect(notify.mock.calls[0][0].subject).toBe('Nova módulo publicada: Via Aérea Difícil');
  });

  it('tipo=aula: label aula', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'aula',
      titulo: 'Sugamadex',
      entityId: 'a-1',
      recipientIds: ['u1'],
    });
    expect(notify.mock.calls[0][0].subject).toBe('Nova aula publicada: Sugamadex');
  });

  it('actionParams inclui tipo e entityId para deep-link', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'curso',
      titulo: 'X',
      entityId: 'e-1',
      recipientIds: ['u1'],
    });
    const payload = notify.mock.calls[0][0];
    expect(payload.actionUrl).toBe('educacao');
    expect(payload.actionParams).toEqual({ tipo: 'curso', entityId: 'e-1' });
    expect(payload.relatedEntityType).toBe('curso');
    expect(payload.relatedEntityId).toBe('e-1');
  });

  it('filtra recipientIds falsy', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'curso',
      titulo: 'X',
      entityId: 'e-1',
      recipientIds: ['u1', null, '', 'u2'],
    });
    expect(notify.mock.calls[0][0].recipientIds).toEqual(['u1', 'u2']);
  });

  it('category é educacao', () => {
    const notify = vi.fn();
    notifyNovoConteudoEducacao(notify, {
      tipo: 'curso',
      titulo: 'X',
      entityId: 'e-1',
      recipientIds: ['u1'],
    });
    expect(notify.mock.calls[0][0].category).toBe('educacao');
  });
});
