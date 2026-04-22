import { describe, it, expect } from 'vitest';
import { buildReuniaoNotificationPayload } from '../../utils/reuniaoNotifications';

describe('buildReuniaoNotificationPayload', () => {
  const baseArgs = {
    reuniaoId: 'reu-123',
    titulo: 'Comitê de Qualidade',
    dataReuniao: new Date('2026-05-15T00:00:00'),
    horario: '14:00',
    local: 'Sala 1',
    tipoLabel: 'Comitê',
    perfilLabels: 'Coordenadores, Anestesiologistas',
    recipientIds: ['u1', 'u2', 'u3'],
  };

  it('inclui recipientIds não-vazio (fix principal)', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.recipientIds).toEqual(['u1', 'u2', 'u3']);
    expect(payload.recipientIds.length).toBe(3);
  });

  it('define actionUrl e actionParams para deep-link ao reuniao detalhe', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.actionUrl).toBe('reuniaoDetalhe');
    expect(payload.actionParams).toEqual({ id: 'reu-123' });
    expect(payload.relatedEntityType).toBe('reuniao');
    expect(payload.relatedEntityId).toBe('reu-123');
  });

  it('subject inclui título', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.subject).toBe('Nova reunião agendada: Comitê de Qualidade');
  });

  it('content inclui tipo, data, horário, local e convocados', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.content).toContain('Comitê');
    expect(payload.content).toContain('14:00');
    expect(payload.content).toContain('Sala 1');
    expect(payload.content).toContain('Coordenadores, Anestesiologistas');
  });

  it('content omite convocados quando perfilLabels ausente', () => {
    const payload = buildReuniaoNotificationPayload({ ...baseArgs, perfilLabels: '' });
    expect(payload.content).not.toContain('Convocados');
  });

  it('filtra recipientIds falsy (null/undefined/"")', () => {
    const payload = buildReuniaoNotificationPayload({
      ...baseArgs,
      recipientIds: ['u1', '', null, 'u2', undefined],
    });
    expect(payload.recipientIds).toEqual(['u1', 'u2']);
  });

  it('category é reuniao e priority normal', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.category).toBe('reuniao');
    expect(payload.priority).toBe('normal');
  });

  it('tipoLabel opcional — fallback para "Reunião"', () => {
    const payload = buildReuniaoNotificationPayload({ ...baseArgs, tipoLabel: undefined });
    expect(payload.content).toMatch(/^Reunião agendada/);
  });
});
