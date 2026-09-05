import { describe, it, expect } from 'vitest';
import { getResponsaveisOptIn, buildNewIncidentNotificationPayload, buildStatusChangeNotificationPayload } from '../../utils/incidentesResponsaveis';

describe('getResponsaveisOptIn', () => {
  const lista = [
    { id: 'a', receberIncidentes: true, receberDenuncias: false, notificarApp: true },
    { id: 'b', receberIncidentes: false, receberDenuncias: true, notificarApp: true },
    { id: 'c', receberIncidentes: true, receberDenuncias: true, notificarApp: false },
    { id: 'd', receberIncidentes: true, receberDenuncias: true },
    { receberIncidentes: true, receberDenuncias: true, notificarApp: true },
  ];

  it('incidente: só quem optou por incidentes e avisa no app', () => {
    expect(getResponsaveisOptIn(lista, 'incidente')).toEqual(['a', 'd']);
  });

  it('denúncia: só quem optou por denúncias e avisa no app', () => {
    expect(getResponsaveisOptIn(lista, 'denuncia')).toEqual(['b', 'd']);
  });

  it('notificarApp=false fica fora; ausente conta como ligado', () => {
    expect(getResponsaveisOptIn(lista, 'incidente')).not.toContain('c');
    expect(getResponsaveisOptIn(lista, 'incidente')).toContain('d');
  });

  it('não cai para admin/coordenador — flags de cargo são ignoradas', () => {
    const admins = [{ id: 'adm', isAdmin: true }, { id: 'coord', isCoordenador: true, role: 'coordenador' }];
    expect(getResponsaveisOptIn(admins, 'denuncia')).toEqual([]);
  });

  it('ignora sem id e aceita lista vazia ou undefined', () => {
    expect(getResponsaveisOptIn([], 'incidente')).toEqual([]);
    expect(getResponsaveisOptIn(undefined, 'incidente')).toEqual([]);
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
