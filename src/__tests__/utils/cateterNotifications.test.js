import { describe, it, expect } from 'vitest';
import { getCateterRecipients, pacienteIniciais, buildCateterNotificationPayload } from '../../utils/cateterNotifications';

describe('getCateterRecipients', () => {
  const makeUser = (overrides = {}) => ({
    id: overrides.id || 'u',
    active: overrides.active !== false,
    role: 'colaborador',
    ...overrides,
  });

  it('inclui anestesiologistas e residentes ativos', () => {
    const users = [
      makeUser({ id: 'a', role: 'anestesiologista' }),
      makeUser({ id: 'b', role: 'medico-residente' }),
      makeUser({ id: 'c', role: 'enfermeiro' }),
      makeUser({ id: 'd', role: 'coordenador' }),
    ];
    expect(getCateterRecipients(users).sort()).toEqual(['a', 'b']);
  });

  it('exclui inativos mesmo com role certo', () => {
    const users = [
      makeUser({ id: 'a', role: 'anestesiologista', active: false }),
      makeUser({ id: 'b', role: 'medico-residente' }),
    ];
    expect(getCateterRecipients(users)).toEqual(['b']);
  });

  it('exclui usuários sem id', () => {
    const users = [
      { role: 'anestesiologista' },
      makeUser({ id: 'b', role: 'anestesiologista' }),
    ];
    expect(getCateterRecipients(users)).toEqual(['b']);
  });

  it('retorna vazio se lista vazia/invalida', () => {
    expect(getCateterRecipients([])).toEqual([]);
    expect(getCateterRecipients(null)).toEqual([]);
    expect(getCateterRecipients(undefined)).toEqual([]);
  });
});

describe('pacienteIniciais', () => {
  it('retorna iniciais 2 letras do primeiro e último nome', () => {
    expect(pacienteIniciais('João da Silva')).toBe('JS');
    expect(pacienteIniciais('Maria Pereira')).toBe('MP');
  });

  it('ignora conectivos como "de", "da", "dos"', () => {
    expect(pacienteIniciais('Maria Lúcia dos Santos')).toBe('MS');
    expect(pacienteIniciais('José de Oliveira')).toBe('JO');
  });

  it('nome único → 1 letra', () => {
    expect(pacienteIniciais('Maria')).toBe('MM');
  });

  it('nome vazio/undefined → string vazia', () => {
    expect(pacienteIniciais('')).toBe('');
    expect(pacienteIniciais(undefined)).toBe('');
    expect(pacienteIniciais(null)).toBe('');
  });
});

describe('buildCateterNotificationPayload', () => {
  const baseArgs = {
    cateterId: 'cat-123',
    pacienteNome: 'João da Silva',
    hospital: 'hro',
    setor: 'CC',
    recipientIds: ['r1', 'r2'],
  };

  it('evento novo: priority alta, subject genérico, iniciais no content', () => {
    const p = buildCateterNotificationPayload({ evento: 'novo', ...baseArgs });
    expect(p.subject).toBe('Novo cateter peridural registrado');
    expect(p.priority).toBe('alta');
    expect(p.content).toContain('JS');
    expect(p.content).toContain('HRO');
    expect(p.content).toContain('CC');
  });

  it('evento evolucao: inclui dia PO', () => {
    const p = buildCateterNotificationPayload({ evento: 'evolucao', diaPo: 2, ...baseArgs });
    expect(p.subject).toBe('Evolução de cateter peridural');
    expect(p.content).toContain('2º PO');
    expect(p.priority).toBe('normal');
  });

  it('evento retirada: subject correto', () => {
    const p = buildCateterNotificationPayload({ evento: 'retirada', ...baseArgs });
    expect(p.subject).toBe('Cateter peridural retirado');
  });

  it('LGPD: content não contém o nome completo do paciente', () => {
    const p = buildCateterNotificationPayload({ evento: 'novo', ...baseArgs });
    expect(p.content).not.toContain('João');
    expect(p.content).not.toContain('Silva');
  });

  it('actionUrl/actionParams apontam ao cateterDetalhe', () => {
    const p = buildCateterNotificationPayload({ evento: 'novo', ...baseArgs });
    expect(p.actionUrl).toBe('cateterDetalhe');
    expect(p.actionParams).toEqual({ cateterId: 'cat-123' });
    expect(p.relatedEntityType).toBe('cateter-peridural');
  });

  it('relatedEntityId é ÚNICO por evento (não colide no índice único parcial)', () => {
    // Regressão: usar só o cateterId fazia novo/evolucao/retirada do mesmo cateter
    // colidirem em (related_entity_type, related_entity_id, recipient_id) e o batch
    // falhava silenciosamente — notificações de cateter paravam de chegar.
    const novo = buildCateterNotificationPayload({ evento: 'novo', ...baseArgs });
    const ev1 = buildCateterNotificationPayload({ evento: 'evolucao', followupId: 'fu-1', ...baseArgs });
    const ev2 = buildCateterNotificationPayload({ evento: 'evolucao', followupId: 'fu-2', ...baseArgs });
    const ret = buildCateterNotificationPayload({ evento: 'retirada', ...baseArgs });
    const ids = [novo, ev1, ev2, ret].map((p) => p.relatedEntityId);
    expect(new Set(ids).size).toBe(4); // todos distintos
    expect(ev1.relatedEntityId).toBe('cateter_evolucao_fu-1');
    expect(novo.relatedEntityId).toBe('cateter_cat-123_novo');
  });

  it('filtra recipientIds falsy', () => {
    const p = buildCateterNotificationPayload({
      evento: 'novo',
      ...baseArgs,
      recipientIds: ['r1', null, '', 'r2'],
    });
    expect(p.recipientIds).toEqual(['r1', 'r2']);
  });

  it('category é cateter', () => {
    const p = buildCateterNotificationPayload({ evento: 'novo', ...baseArgs });
    expect(p.category).toBe('cateter');
  });
});
