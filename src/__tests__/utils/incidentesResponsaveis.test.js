import { describe, it, expect } from 'vitest';
import { getResponsaveisIncidentes, buildNewIncidentNotificationPayload, buildStatusChangeNotificationPayload } from '../../utils/incidentesResponsaveis';

describe('getResponsaveisIncidentes', () => {
  const makeUser = (overrides = {}) => ({
    id: overrides.id || 'u-default',
    active: overrides.active !== false,
    isAdmin: false,
    isCoordenador: false,
    role: 'anestesiologista',
    ...overrides,
  });

  it('retorna apenas usuários com isAdmin=true', () => {
    const users = [
      makeUser({ id: 'a', isAdmin: true }),
      makeUser({ id: 'b' }),
    ];
    expect(getResponsaveisIncidentes(users)).toEqual(['a']);
  });

  it('retorna usuários com isCoordenador=true', () => {
    const users = [
      makeUser({ id: 'a' }),
      makeUser({ id: 'b', isCoordenador: true }),
    ];
    expect(getResponsaveisIncidentes(users)).toEqual(['b']);
  });

  it('retorna usuários com role=coordenador', () => {
    const users = [
      makeUser({ id: 'a' }),
      makeUser({ id: 'b', role: 'coordenador' }),
    ];
    expect(getResponsaveisIncidentes(users)).toEqual(['b']);
  });

  it('ignora usuários inativos', () => {
    const users = [
      makeUser({ id: 'a', isAdmin: true, active: false }),
      makeUser({ id: 'b', isAdmin: true }),
    ];
    expect(getResponsaveisIncidentes(users)).toEqual(['b']);
  });

  it('ignora usuários sem id', () => {
    const users = [
      { isAdmin: true },
      makeUser({ id: 'b', isAdmin: true }),
    ];
    expect(getResponsaveisIncidentes(users)).toEqual(['b']);
  });

  it('retorna vazio se não há responsáveis', () => {
    const users = [makeUser({ id: 'a' }), makeUser({ id: 'b' })];
    expect(getResponsaveisIncidentes(users)).toEqual([]);
  });

  it('aceita lista vazia ou undefined', () => {
    expect(getResponsaveisIncidentes([])).toEqual([]);
    expect(getResponsaveisIncidentes(undefined)).toEqual([]);
    expect(getResponsaveisIncidentes(null)).toEqual([]);
  });
});

describe('buildNewIncidentNotificationPayload', () => {
  it('incidente: subject genérico sem dados sensíveis', () => {
    const payload = buildNewIncidentNotificationPayload({
      tipo: 'incidente',
      protocolo: 'ANEST-INC-2026-ABC123',
      incidenteId: 'id-1',
      recipientIds: ['r1', 'r2'],
    });
    expect(payload.subject).toBe('Novo incidente registrado');
    expect(payload.content).toBe('Incidente protocolo ANEST-INC-2026-ABC123 registrado — requer análise.');
    expect(payload.category).toBe('incidente');
    expect(payload.actionUrl).toBe('incidentes');
    expect(payload.relatedEntityType).toBe('incidente');
    expect(payload.recipientIds).toEqual(['r1', 'r2']);
  });

  it('denúncia: subject genérico e actionUrl=denuncias', () => {
    const payload = buildNewIncidentNotificationPayload({
      tipo: 'denuncia',
      protocolo: 'ANEST-DEN-2026-XYZ',
      incidenteId: 'id-2',
      recipientIds: ['r1'],
    });
    expect(payload.subject).toBe('Nova denúncia registrada');
    expect(payload.content).toBe('Denúncia protocolo ANEST-DEN-2026-XYZ registrado — requer análise.');
    expect(payload.actionUrl).toBe('denuncias');
    expect(payload.relatedEntityType).toBe('denuncia');
  });

  it('NÃO inclui nome, descrição, tipo específico ou dados do paciente', () => {
    const payload = buildNewIncidentNotificationPayload({
      tipo: 'incidente',
      protocolo: 'ANEST-INC-001',
      incidenteId: 'id-1',
      recipientIds: ['r1'],
    });
    // Só o protocolo pode aparecer no content
    expect(payload.content.toLowerCase()).not.toContain('paciente');
    expect(payload.content.toLowerCase()).not.toContain('erro');
    expect(payload.content.toLowerCase()).not.toContain('medicamento');
    expect(payload.subject.toLowerCase()).not.toContain('erro');
  });

  it('actionParams inclui protocolo e incidenteId', () => {
    const payload = buildNewIncidentNotificationPayload({
      tipo: 'incidente',
      protocolo: 'P-123',
      incidenteId: 'inc-abc',
      recipientIds: ['r1'],
    });
    expect(payload.actionParams).toEqual({ protocolo: 'P-123', incidenteId: 'inc-abc' });
  });

  it('filtra recipientIds falsy', () => {
    const payload = buildNewIncidentNotificationPayload({
      tipo: 'incidente',
      protocolo: 'P-1',
      recipientIds: ['r1', '', null, 'r2'],
    });
    expect(payload.recipientIds).toEqual(['r1', 'r2']);
  });
});

describe('buildStatusChangeNotificationPayload', () => {
  it('não expõe descrição, só protocolo e novo status', () => {
    const payload = buildStatusChangeNotificationPayload({
      tipo: 'incidente',
      protocolo: 'ANEST-INC-001',
      incidenteId: 'id-1',
      newStatus: 'em_analise',
      recipientIds: ['r1'],
    });
    expect(payload.subject).toBe('Status atualizado: ANEST-INC-001');
    expect(payload.content).toContain('ANEST-INC-001');
    expect(payload.content).toContain('em_analise');
    expect(payload.recipientIds).toEqual(['r1']);
  });
});
