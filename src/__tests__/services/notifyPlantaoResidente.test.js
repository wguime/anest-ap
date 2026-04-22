import { describe, it, expect, vi } from 'vitest';
import { notifyPlantaoResidenteReminder } from '../../services/notificationService';

describe('notifyPlantaoResidenteReminder', () => {
  const baseArgs = {
    setor: 'Plantão Residência (12h)',
    horario: '19:00',
    dataPlantao: '15/05/2026',
    recipientId: 'uid-residente-1',
    relatedEntityId: 'plantao-residencia_2026-05-15_r2-daniel_1day',
  };

  it('D-1: subject e content de véspera + priority normal', () => {
    const notify = vi.fn();
    notifyPlantaoResidenteReminder(notify, { ...baseArgs, tipoLembrete: '1day' });
    const payload = notify.mock.calls[0][0];
    expect(payload.subject).toBe('Plantão amanhã: Plantão Residência (12h)');
    expect(payload.content).toContain('amanhã');
    expect(payload.content).toContain('15/05/2026');
    expect(payload.content).toContain('19:00');
    expect(payload.priority).toBe('normal');
  });

  it('D-0: subject "em 1 hora" + priority alta', () => {
    const notify = vi.fn();
    notifyPlantaoResidenteReminder(notify, { ...baseArgs, tipoLembrete: '1hour' });
    const payload = notify.mock.calls[0][0];
    expect(payload.subject).toBe('Plantão em 1 hora: Plantão Residência (12h)');
    expect(payload.priority).toBe('alta');
  });

  it('actionUrl e relatedEntityType direcionam à residência', () => {
    const notify = vi.fn();
    notifyPlantaoResidenteReminder(notify, { ...baseArgs, tipoLembrete: '1day' });
    const payload = notify.mock.calls[0][0];
    expect(payload.actionUrl).toBe('residencia');
    expect(payload.actionLabel).toBe('Ver Residência');
    expect(payload.actionParams).toEqual({ dataPlantao: '15/05/2026' });
    expect(payload.relatedEntityType).toBe('plantao-residencia');
    expect(payload.relatedEntityId).toBe(baseArgs.relatedEntityId);
  });

  it('recipientId e senderName corretos', () => {
    const notify = vi.fn();
    notifyPlantaoResidenteReminder(notify, { ...baseArgs, tipoLembrete: '1day' });
    const payload = notify.mock.calls[0][0];
    expect(payload.recipientId).toBe('uid-residente-1');
    expect(payload.senderName).toBe('Escala de Residência');
    expect(payload.category).toBe('plantao');
  });
});
