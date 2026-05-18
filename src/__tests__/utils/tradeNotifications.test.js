/**
 * Testes das notificações de troca de plantão.
 * Simula os 8 residentes criando/aceitando/rejeitando/cancelando trocas
 * e verifica que as mensagens corretas seriam enviadas aos envolvidos.
 */
import { describe, it, expect } from 'vitest';
import { buildTradeNotificationContent, getTradeNotificationRecipients, buildTradeNotificationPayload } from '../../utils/tradeNotifications';

const R = {
  augusto:   { uid: 'uid-augusto',   residenteId: 'r1-augusto',   nome: 'Augusto' },
  guilherme: { uid: 'uid-guilherme', residenteId: 'r1-guilherme', nome: 'Guilherme' },
  roosewelt: { uid: 'uid-roosewelt', residenteId: 'r1-roosewelt', nome: 'Roosewelt' },
  daniel:    { uid: 'uid-daniel',    residenteId: 'r2-daniel',    nome: 'Daniel' },
  jacinta:   { uid: 'uid-jacinta',   residenteId: 'r2-jacinta',   nome: 'Jacinta' },
  rodrigo:   { uid: 'uid-rodrigo',   residenteId: 'r2-rodrigo',   nome: 'Rodrigo' },
  raffaela:  { uid: 'uid-raffaela',  residenteId: 'r3-raffaela',  nome: 'Raffaela' },
  wagner:    { uid: 'uid-wagner',    residenteId: 'r3-wagner',    nome: 'Wagner' },
};

const ALL_RESIDENTE_IDS = Object.values(R).map((r) => r.residenteId);

function makeTrade(overrides = {}) {
  return {
    codigo: 'TR100001',
    solicitanteId: R.daniel.uid,
    solicitanteNome: R.daniel.nome,
    solicitanteResidenteId: R.daniel.residenteId,
    dataPlantao: '2026-05-15',
    dataDesejada: null,
    destinatarioId: null,
    destinatarioNome: null,
    descricao: 'Compromisso pessoal',
    status: 'pendente',
    ...overrides,
  };
}

describe('tradeNotifications — residentes trocando plantões', () => {
  // =========================================================================
  describe('A. Created — cobertura unidirecional (aberta)', () => {
    const trade = makeTrade({
      solicitanteId: R.daniel.uid,
      solicitanteResidenteId: R.daniel.residenteId,
      dataPlantao: '2026-05-15',
      destinatarioId: null,
    });

    it('A1 subject/content — cobertura', () => {
      const { subject, content } = buildTradeNotificationContent('created', trade, {
        actorFirstName: 'Daniel',
      });
      expect(subject).toBe('Nova solicitação de cobertura de plantão');
      expect(content).toContain('Daniel');
      expect(content).toContain('15/05/2026');
      expect(content).toContain('TR100001');
      expect(content).not.toContain('trocar');
    });

    it('A2 recipients — todos os 7 outros residentes', () => {
      const targets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.daniel.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(targets).toHaveLength(7);
      expect(targets).not.toContain(R.daniel.residenteId); // exclui o próprio solicitante
      expect(targets).toContain(R.raffaela.residenteId);
      expect(targets).toContain(R.wagner.residenteId);
    });
  });

  // =========================================================================
  describe('B. Created — cobertura direcionada', () => {
    const trade = makeTrade({
      solicitanteId: R.wagner.uid,
      solicitanteResidenteId: R.wagner.residenteId,
      dataPlantao: '2026-06-20',
      destinatarioId: R.jacinta.residenteId,
      destinatarioNome: R.jacinta.nome,
    });

    it('B1 recipients — só Jacinta', () => {
      const targets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.wagner.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(targets).toEqual([R.jacinta.residenteId]);
    });
  });

  // =========================================================================
  describe('C. Created — swap bidirecional', () => {
    const trade = makeTrade({
      codigo: 'TR200001',
      solicitanteId: R.wagner.uid,
      solicitanteResidenteId: R.wagner.residenteId,
      dataPlantao: '2026-05-10',
      dataDesejada: '2026-05-14',
      destinatarioId: R.daniel.residenteId,
      destinatarioNome: R.daniel.nome,
    });

    it('C1 subject/content — menciona ambas as datas', () => {
      const { subject, content } = buildTradeNotificationContent('created', trade, {
        actorFirstName: 'Wagner',
      });
      expect(subject).toBe('Nova solicitação de troca de plantão');
      expect(content).toContain('Wagner');
      expect(content).toContain('trocar');
      expect(content).toContain('10/05/2026');
      expect(content).toContain('14/05/2026');
      expect(content).toContain('TR200001');
    });

    it('C2 recipients — só o destinatário Daniel', () => {
      const targets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.wagner.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(targets).toEqual([R.daniel.residenteId]);
    });
  });

  // =========================================================================
  describe('D. Accepted', () => {
    it('D1 cobertura — subject e conteúdo', () => {
      const trade = makeTrade({
        codigo: 'TR300001',
        solicitanteId: R.daniel.uid,
        solicitanteResidenteId: R.daniel.residenteId,
        dataPlantao: '2026-07-01',
        dataDesejada: null,
      });
      const { subject, content } = buildTradeNotificationContent('accepted', trade, {
        actorFirstName: 'Raffaela',
      });
      expect(subject).toBe('Sua troca foi aceita');
      expect(content).toContain('Raffaela');
      expect(content).toContain('cobrir');
      expect(content).toContain('01/07/2026');
      expect(content).toContain('TR300001');
    });

    it('D2 swap — subject e conteúdo menciona ambas as datas', () => {
      const trade = makeTrade({
        codigo: 'TR300002',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-05-10',
        dataDesejada: '2026-05-14',
        destinatarioId: R.daniel.residenteId,
      });
      const { content } = buildTradeNotificationContent('accepted', trade, {
        actorFirstName: 'Daniel',
      });
      expect(content).toContain('Daniel');
      expect(content).toContain('trocar');
      expect(content).toContain('10/05/2026');
      expect(content).toContain('14/05/2026');
    });

    it('D3 recipients — só o solicitante', () => {
      const trade = makeTrade({ solicitanteResidenteId: R.daniel.residenteId });
      const targets = getTradeNotificationRecipients('accepted', trade, {
        actorResidenteId: R.raffaela.residenteId,
      });
      expect(targets).toEqual([R.daniel.residenteId]);
    });
  });

  // =========================================================================
  describe('E. Rejected', () => {
    it('E1 subject e conteúdo', () => {
      const trade = makeTrade({
        codigo: 'TR400001',
        solicitanteResidenteId: R.daniel.residenteId,
      });
      const { subject, content } = buildTradeNotificationContent('rejected', trade, {
        actorFirstName: 'Augusto',
      });
      expect(subject).toBe('Sua troca foi rejeitada');
      expect(content).toContain('Augusto');
      expect(content).toContain('rejeitou');
      expect(content).toContain('TR400001');
    });

    it('E2 recipients — só o solicitante', () => {
      const trade = makeTrade({ solicitanteResidenteId: R.roosewelt.residenteId });
      const targets = getTradeNotificationRecipients('rejected', trade, {
        actorResidenteId: R.augusto.residenteId,
      });
      expect(targets).toEqual([R.roosewelt.residenteId]);
    });
  });

  // =========================================================================
  describe('F. Cancelled', () => {
    it('F1 subject e conteúdo', () => {
      const trade = makeTrade({
        codigo: 'TR500001',
        destinatarioId: R.jacinta.residenteId,
      });
      const { subject, content } = buildTradeNotificationContent('cancelled', trade, {
        actorFirstName: 'Daniel',
      });
      expect(subject).toBe('Troca de plantão cancelada');
      expect(content).toContain('Daniel');
      expect(content).toContain('cancelou');
      expect(content).toContain('TR500001');
    });

    it('F2 cancelou direcionada — recipients = destinatário', () => {
      const trade = makeTrade({
        solicitanteResidenteId: R.daniel.residenteId,
        destinatarioId: R.jacinta.residenteId,
      });
      const targets = getTradeNotificationRecipients('cancelled', trade, {
        actorResidenteId: R.daniel.residenteId,
      });
      expect(targets).toEqual([R.jacinta.residenteId]);
    });

    it('F3 cancelou aberta — recipients vazio', () => {
      const trade = makeTrade({
        solicitanteResidenteId: R.daniel.residenteId,
        destinatarioId: null,
      });
      const targets = getTradeNotificationRecipients('cancelled', trade, {
        actorResidenteId: R.daniel.residenteId,
      });
      expect(targets).toEqual([]);
    });
  });

  // =========================================================================
  describe('G. Payload completo (integração dos builders)', () => {
    it('G1 payload para troca direcionada — tudo correto', () => {
      const trade = makeTrade({
        codigo: 'TR900001',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-05-10',
        dataDesejada: '2026-05-14',
        destinatarioId: R.daniel.residenteId,
      });

      const payload = buildTradeNotificationPayload(
        'created',
        trade,
        { actorFirstName: 'Wagner' },
        [R.daniel.uid]
      );

      expect(payload).toMatchObject({
        category: 'plantao',
        priority: 'alta',
        actionUrl: 'trocasPlantao',
        actionLabel: 'Ver Troca',
        subject: 'Nova solicitação de troca de plantão',
        recipientIds: [R.daniel.uid],
      });
      expect(payload.content).toContain('Wagner');
      expect(payload.content).toContain('10/05/2026');
      expect(payload.content).toContain('14/05/2026');
    });
  });

  // =========================================================================
  describe('H. Fluxo end-to-end (8 residentes)', () => {
    it('H1 Daniel cria cobertura aberta → notifica 7 residentes + Raffaela aceita → Daniel recebe', () => {
      // Passo 1: Daniel cria
      const trade1 = makeTrade({
        codigo: 'TRE2E001',
        solicitanteId: R.daniel.uid,
        solicitanteResidenteId: R.daniel.residenteId,
        dataPlantao: '2026-07-15',
        destinatarioId: null,
      });

      const createdTargets = getTradeNotificationRecipients('created', trade1, {
        actorResidenteId: R.daniel.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(createdTargets).toHaveLength(7);
      expect(createdTargets).not.toContain(R.daniel.residenteId);

      // Passo 2: Raffaela aceita
      const tradeAceita = { ...trade1, status: 'aceita', respondidoPorId: R.raffaela.uid };
      const acceptedTargets = getTradeNotificationRecipients('accepted', tradeAceita, {
        actorResidenteId: R.raffaela.residenteId,
      });
      expect(acceptedTargets).toEqual([R.daniel.residenteId]);

      const { subject, content } = buildTradeNotificationContent('accepted', tradeAceita, {
        actorFirstName: 'Raffaela',
      });
      expect(subject).toBe('Sua troca foi aceita');
      expect(content).toContain('Raffaela');
      expect(content).toContain('15/07/2026');
    });

    it('H2 Wagner propõe swap para Daniel → só Daniel notificado → Daniel rejeita → Wagner notificado', () => {
      // Passo 1: Wagner propõe
      const trade = makeTrade({
        codigo: 'TRE2E002',
        solicitanteId: R.wagner.uid,
        solicitanteResidenteId: R.wagner.residenteId,
        dataPlantao: '2026-08-10',
        dataDesejada: '2026-08-14',
        destinatarioId: R.daniel.residenteId,
      });

      const createdTargets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.wagner.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(createdTargets).toEqual([R.daniel.residenteId]);

      // Passo 2: Daniel rejeita
      const rejTargets = getTradeNotificationRecipients('rejected', trade, {
        actorResidenteId: R.daniel.residenteId,
      });
      expect(rejTargets).toEqual([R.wagner.residenteId]);

      const { subject, content } = buildTradeNotificationContent('rejected', trade, {
        actorFirstName: 'Daniel',
      });
      expect(subject).toBe('Sua troca foi rejeitada');
      expect(content).toContain('Daniel');
    });

    it('H3 Jacinta cria direcionada a Rodrigo → cancela antes → Rodrigo recebe cancelamento', () => {
      const trade = makeTrade({
        codigo: 'TRE2E003',
        solicitanteId: R.jacinta.uid,
        solicitanteResidenteId: R.jacinta.residenteId,
        dataPlantao: '2026-09-05',
        destinatarioId: R.rodrigo.residenteId,
      });

      // Jacinta cria → Rodrigo notificado
      const created = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.jacinta.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(created).toEqual([R.rodrigo.residenteId]);

      // Jacinta cancela → Rodrigo notificado
      const cancelTargets = getTradeNotificationRecipients('cancelled', trade, {
        actorResidenteId: R.jacinta.residenteId,
      });
      expect(cancelTargets).toEqual([R.rodrigo.residenteId]);

      const { subject, content } = buildTradeNotificationContent('cancelled', trade, {
        actorFirstName: 'Jacinta',
      });
      expect(subject).toBe('Troca de plantão cancelada');
      expect(content).toContain('Jacinta');
      expect(content).toContain('cancelou');
    });

    it('H4 Augusto cria cobertura aberta → ninguém aceita → Augusto cancela → ninguém é notificado', () => {
      const trade = makeTrade({
        codigo: 'TRE2E004',
        solicitanteId: R.augusto.uid,
        solicitanteResidenteId: R.augusto.residenteId,
        destinatarioId: null,
      });

      const cancelTargets = getTradeNotificationRecipients('cancelled', trade, {
        actorResidenteId: R.augusto.residenteId,
      });
      expect(cancelTargets).toEqual([]);
    });

    it('H5 Ninguém pode se auto-notificar (create: solicitante não aparece na lista)', () => {
      const trade = makeTrade({
        solicitanteId: R.roosewelt.uid,
        solicitanteResidenteId: R.roosewelt.residenteId,
        destinatarioId: null,
      });
      const targets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.roosewelt.residenteId,
        allResidenteIds: ALL_RESIDENTE_IDS,
      });
      expect(targets).not.toContain(R.roosewelt.residenteId);
    });
  });

  // =========================================================================
  describe('I. Robustez de input', () => {
    it('I1 evento inválido lança erro', () => {
      expect(() => buildTradeNotificationContent('foo', makeTrade(), {})).toThrow();
    });

    it('I2 trade null — gera conteúdo genérico sem crashar', () => {
      const { subject } = buildTradeNotificationContent('created', null, {});
      expect(subject).toBeTruthy();
    });

    it('I3 sem actorFirstName — usa fallback genérico', () => {
      const { content } = buildTradeNotificationContent('created', makeTrade(), {});
      expect(content).toContain('Um residente');
    });

    it('I4 allResidenteIds vazio em created aberta → recipients vazio', () => {
      const trade = makeTrade({ destinatarioId: null });
      const targets = getTradeNotificationRecipients('created', trade, {
        actorResidenteId: R.daniel.residenteId,
        allResidenteIds: [],
      });
      expect(targets).toEqual([]);
    });
  });
});
