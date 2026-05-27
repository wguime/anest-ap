import { describe, it, expect } from 'vitest';
import {
  buildReuniaoNotificationPayload,
  buildReuniaoUpdatePayload,
  buildReuniaoCancelPayload,
  buildReuniaoStatusPayload,
  buildReuniaoDocumentoPayload,
  buildReuniaoParticipantePayload,
  buildDeliberacaoAbertaPayload,
  buildDeliberacaoFechadaPayload,
} from '../../utils/reuniaoNotifications';

// ========================================================================
// Shared helpers
// ========================================================================

const BASE_REUNIAO_ID = 'reu-123';
const BASE_TITULO = 'Comitê de Qualidade';
const BASE_RECIPIENTS = ['u1', 'u2', 'u3'];

/** Every payload builder should share these base fields */
function expectBaseFields(payload, reuniaoId = BASE_REUNIAO_ID) {
  expect(payload.category).toBe('reuniao');
  expect(payload.actionUrl).toBe('reuniaoDetalhe');
  expect(payload.actionLabel).toBe('Ver Reunião');
  expect(payload.actionParams).toEqual({ id: reuniaoId });
  expect(payload.relatedEntityType).toBe('reuniao');
  expect(payload.relatedEntityId).toBe(reuniaoId);
}

// ========================================================================
// 1. buildReuniaoNotificationPayload (criação)
// ========================================================================

describe('buildReuniaoNotificationPayload', () => {
  const baseArgs = {
    reuniaoId: BASE_REUNIAO_ID,
    titulo: BASE_TITULO,
    dataReuniao: new Date('2026-05-15T00:00:00'),
    horario: '14:00',
    local: 'Sala 1',
    tipoLabel: 'Comitê',
    perfilLabels: 'Coordenadores, Anestesiologistas',
    recipientIds: BASE_RECIPIENTS,
  };

  it('inclui recipientIds não-vazio (fix principal)', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expect(payload.recipientIds).toEqual(['u1', 'u2', 'u3']);
    expect(payload.recipientIds.length).toBe(3);
  });

  it('define actionUrl e actionParams para deep-link ao reuniao detalhe', () => {
    const payload = buildReuniaoNotificationPayload(baseArgs);
    expectBaseFields(payload);
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

// ========================================================================
// 2. buildReuniaoUpdatePayload (reagendamento / edição)
// ========================================================================

describe('buildReuniaoUpdatePayload', () => {
  it('monta subject e content corretamente', () => {
    const payload = buildReuniaoUpdatePayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      changeDescription: 'Data alterada de 15/05 para 20/05.',
      recipientIds: BASE_RECIPIENTS,
    });
    expectBaseFields(payload);
    expect(payload.subject).toBe(`Reunião atualizada: ${BASE_TITULO}`);
    expect(payload.content).toBe('Data alterada de 15/05 para 20/05.');
    expect(payload.priority).toBe('normal');
  });

  it('filtra recipientIds falsy', () => {
    const payload = buildReuniaoUpdatePayload({
      reuniaoId: 'r1',
      titulo: 'T',
      changeDescription: 'x',
      recipientIds: [null, 'u1', ''],
    });
    expect(payload.recipientIds).toEqual(['u1']);
  });
});

// ========================================================================
// 3. buildReuniaoCancelPayload
// ========================================================================

describe('buildReuniaoCancelPayload', () => {
  it('priority é alta', () => {
    const payload = buildReuniaoCancelPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      recipientIds: BASE_RECIPIENTS,
    });
    expectBaseFields(payload);
    expect(payload.priority).toBe('alta');
    expect(payload.subject).toContain('cancelada');
  });

  it('inclui motivo quando fornecido', () => {
    const payload = buildReuniaoCancelPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      motivo: 'Falta de quórum',
      recipientIds: BASE_RECIPIENTS,
    });
    expect(payload.content).toContain('Falta de quórum');
  });

  it('sem motivo, content não tem "Motivo:"', () => {
    const payload = buildReuniaoCancelPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      recipientIds: BASE_RECIPIENTS,
    });
    expect(payload.content).not.toContain('Motivo:');
  });
});

// ========================================================================
// 4. buildReuniaoStatusPayload
// ========================================================================

describe('buildReuniaoStatusPayload', () => {
  it('mapeia status para label legível', () => {
    const payload = buildReuniaoStatusPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      newStatus: 'em_andamento',
      recipientIds: BASE_RECIPIENTS,
    });
    expectBaseFields(payload);
    expect(payload.content).toContain('Em Andamento');
    expect(payload.priority).toBe('normal');
  });

  it('fallback para status desconhecido usa string crua', () => {
    const payload = buildReuniaoStatusPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      newStatus: 'custom_status',
      recipientIds: BASE_RECIPIENTS,
    });
    expect(payload.content).toContain('custom_status');
  });
});

// ========================================================================
// 5. buildReuniaoDocumentoPayload
// ========================================================================

describe('buildReuniaoDocumentoPayload', () => {
  it('monta payload para ata', () => {
    const payload = buildReuniaoDocumentoPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      tipoDocumento: 'ata',
      docTitulo: 'Ata Final',
      recipientIds: BASE_RECIPIENTS,
    });
    expectBaseFields(payload);
    expect(payload.subject).toContain('Ata');
    expect(payload.content).toContain('Ata Final');
    expect(payload.priority).toBe('normal');
  });

  it('monta payload para subsidio sem docTitulo', () => {
    const payload = buildReuniaoDocumentoPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      tipoDocumento: 'subsidio',
      recipientIds: BASE_RECIPIENTS,
    });
    expect(payload.subject).toContain('Subsídio');
    expect(payload.content).not.toContain('undefined');
  });

  it('fallback para tipo desconhecido usa string crua', () => {
    const payload = buildReuniaoDocumentoPayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      tipoDocumento: 'relatorio',
      recipientIds: BASE_RECIPIENTS,
    });
    expect(payload.subject).toContain('relatorio');
  });
});

// ========================================================================
// 6. buildReuniaoParticipantePayload
// ========================================================================

describe('buildReuniaoParticipantePayload', () => {
  it('adicionado — priority normal', () => {
    const payload = buildReuniaoParticipantePayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      action: 'adicionado',
      recipientIds: ['u4'],
    });
    expectBaseFields(payload);
    expect(payload.subject).toContain('adicionado');
    expect(payload.priority).toBe('normal');
  });

  it('removido — priority alta', () => {
    const payload = buildReuniaoParticipantePayload({
      reuniaoId: BASE_REUNIAO_ID,
      titulo: BASE_TITULO,
      action: 'removido',
      recipientIds: ['u4'],
    });
    expect(payload.subject).toContain('removido');
    expect(payload.priority).toBe('alta');
  });
});

// ========================================================================
// 7. buildDeliberacaoAbertaPayload
// ========================================================================

describe('buildDeliberacaoAbertaPayload', () => {
  const baseArgs = {
    reuniaoId: BASE_REUNIAO_ID,
    titulo: BASE_TITULO,
    deliberacaoNumero: 'DEL-2026-0001',
    deliberacaoTitulo: 'Protocolo de Segurança',
    recipientIds: BASE_RECIPIENTS,
  };

  it('monta subject com título da deliberação', () => {
    const payload = buildDeliberacaoAbertaPayload(baseArgs);
    expectBaseFields(payload);
    expect(payload.subject).toBe('Votação aberta: Protocolo de Segurança');
  });

  it('content inclui número, título da reunião e chamada para votar', () => {
    const payload = buildDeliberacaoAbertaPayload(baseArgs);
    expect(payload.content).toContain('DEL-2026-0001');
    expect(payload.content).toContain(BASE_TITULO);
    expect(payload.content).toContain('Registre seu voto');
  });

  it('priority é normal', () => {
    const payload = buildDeliberacaoAbertaPayload(baseArgs);
    expect(payload.priority).toBe('normal');
  });

  it('filtra recipientIds falsy', () => {
    const payload = buildDeliberacaoAbertaPayload({
      ...baseArgs,
      recipientIds: ['u1', null, '', 'u2', undefined],
    });
    expect(payload.recipientIds).toEqual(['u1', 'u2']);
  });

  it('category é reuniao e actionUrl é reuniaoDetalhe', () => {
    const payload = buildDeliberacaoAbertaPayload(baseArgs);
    expect(payload.category).toBe('reuniao');
    expect(payload.actionUrl).toBe('reuniaoDetalhe');
  });
});

// ========================================================================
// 8. buildDeliberacaoFechadaPayload
// ========================================================================

describe('buildDeliberacaoFechadaPayload', () => {
  const baseArgs = {
    reuniaoId: BASE_REUNIAO_ID,
    titulo: BASE_TITULO,
    deliberacaoNumero: 'DEL-2026-0003',
    deliberacaoTitulo: 'Aquisição de Equipamento',
    resultado: 'aprovada',
    recipientIds: BASE_RECIPIENTS,
  };

  it('mapeia resultado "aprovada" para label "Aprovada"', () => {
    const payload = buildDeliberacaoFechadaPayload(baseArgs);
    expectBaseFields(payload);
    expect(payload.subject).toBe('Deliberação Aprovada: Aquisição de Equipamento');
    expect(payload.content).toContain('Aprovada');
  });

  it('mapeia resultado "rejeitada" para label "Rejeitada"', () => {
    const payload = buildDeliberacaoFechadaPayload({ ...baseArgs, resultado: 'rejeitada' });
    expect(payload.subject).toContain('Rejeitada');
    expect(payload.content).toContain('Rejeitada');
  });

  it('mapeia resultado "adiada" para label "Adiada"', () => {
    const payload = buildDeliberacaoFechadaPayload({ ...baseArgs, resultado: 'adiada' });
    expect(payload.subject).toContain('Adiada');
    expect(payload.content).toContain('Adiada');
  });

  it('fallback para resultado desconhecido usa string crua', () => {
    const payload = buildDeliberacaoFechadaPayload({ ...baseArgs, resultado: 'custom_result' });
    expect(payload.subject).toContain('custom_result');
    expect(payload.content).toContain('custom_result');
  });

  it('content inclui número da deliberação e título da reunião', () => {
    const payload = buildDeliberacaoFechadaPayload(baseArgs);
    expect(payload.content).toContain('DEL-2026-0003');
    expect(payload.content).toContain(BASE_TITULO);
    expect(payload.content).toContain('encerrada');
  });

  it('priority é normal', () => {
    const payload = buildDeliberacaoFechadaPayload(baseArgs);
    expect(payload.priority).toBe('normal');
  });

  it('filtra recipientIds falsy', () => {
    const payload = buildDeliberacaoFechadaPayload({
      ...baseArgs,
      recipientIds: [null, 'u1', undefined],
    });
    expect(payload.recipientIds).toEqual(['u1']);
  });
});
