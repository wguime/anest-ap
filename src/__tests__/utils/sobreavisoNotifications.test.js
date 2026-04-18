/**
 * Testes das notificações de troca de sobreaviso materno.
 * Simula as 5 funcionárias criando/aceitando/rejeitando/cancelando trocas.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSobreavisoNotificationContent,
  getSobreavisoNotificationRecipients,
  buildSobreavisoNotificationPayload,
} from '../../utils/sobreavisoNotifications';

const F = {
  marta:    { uid: 'uid-marta',    funcionariaId: 'marta',    nome: 'Marta' },
  renata:   { uid: 'uid-renata',   funcionariaId: 'renata',   nome: 'Renata' },
  luciana:  { uid: 'uid-luciana',  funcionariaId: 'luciana',  nome: 'Luciana' },
  elisete:  { uid: 'uid-elisete',  funcionariaId: 'elisete',  nome: 'Elisete' },
  saionara: { uid: 'uid-saionara', funcionariaId: 'saionara', nome: 'Saionara' },
};

const ALL_FUNCIONARIA_IDS = Object.values(F).map((f) => f.funcionariaId);

function makeTrade(overrides = {}) {
  return {
    codigo: 'SB100001',
    solicitanteId: F.marta.uid,
    solicitanteNome: F.marta.nome,
    solicitanteFuncionariaId: F.marta.funcionariaId,
    dataSobreaviso: '2026-04-15',
    dataDesejada: null,
    destinatarioId: null,
    destinatarioNome: null,
    descricao: 'Compromisso pessoal',
    status: 'pendente',
    ...overrides,
  };
}

describe('sobreavisoNotifications — funcionárias trocando sobreavisos', () => {
  describe('A. Created — cobertura aberta', () => {
    const trade = makeTrade();

    it('A1 subject/content', () => {
      const { subject, content } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: 'Marta' });
      expect(subject).toBe('Nova solicitação de cobertura de sobreaviso');
      expect(content).toContain('Marta');
      expect(content).toContain('15/04/2026');
      expect(content).toContain('SB100001');
    });

    it('A2 recipients — 4 outras funcionárias', () => {
      const targets = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.marta.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(targets).toHaveLength(4);
      expect(targets).not.toContain(F.marta.funcionariaId);
      expect(targets).toContain(F.saionara.funcionariaId);
    });
  });

  describe('B. Created — cobertura direcionada', () => {
    const trade = makeTrade({
      solicitanteId: F.renata.uid,
      solicitanteFuncionariaId: F.renata.funcionariaId,
      dataSobreaviso: '2026-05-10',
      destinatarioId: F.elisete.funcionariaId,
      destinatarioNome: F.elisete.nome,
    });

    it('B1 subject', () => {
      const { subject } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: 'Renata' });
      expect(subject).toBe('Nova solicitação de cobertura de sobreaviso');
    });

    it('B2 recipients — só destinatária', () => {
      const targets = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.renata.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(targets).toEqual([F.elisete.funcionariaId]);
    });
  });

  describe('C. Created — swap bidirecional', () => {
    const trade = makeTrade({
      solicitanteId: F.luciana.uid,
      solicitanteFuncionariaId: F.luciana.funcionariaId,
      dataSobreaviso: '2026-04-10',
      dataDesejada: '2026-05-10',
      destinatarioId: F.elisete.funcionariaId,
      destinatarioNome: F.elisete.nome,
    });

    it('C1 subject/content', () => {
      const { subject, content } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: 'Luciana' });
      expect(subject).toBe('Nova solicitação de troca de sobreaviso');
      expect(content).toContain('10/04/2026');
      expect(content).toContain('10/05/2026');
      expect(content).toContain('trocar');
    });

    it('C2 recipients — só destinatária', () => {
      const targets = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.luciana.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(targets).toEqual([F.elisete.funcionariaId]);
    });
  });

  describe('D. Accepted', () => {
    it('D1 cobertura — avisa solicitante', () => {
      const trade = makeTrade();
      const { subject, content } = buildSobreavisoNotificationContent('accepted', trade, { actorFirstName: 'Elisete' });
      expect(subject).toBe('Sua troca de sobreaviso foi aceita');
      expect(content).toContain('cobrir');

      const targets = getSobreavisoNotificationRecipients('accepted', trade);
      expect(targets).toEqual([F.marta.funcionariaId]);
    });

    it('D2 swap — content reflete troca', () => {
      const trade = makeTrade({ dataDesejada: '2026-05-20' });
      const { content } = buildSobreavisoNotificationContent('accepted', trade, { actorFirstName: 'Saionara' });
      expect(content).toContain('trocar');
      expect(content).toContain('15/04/2026');
      expect(content).toContain('20/05/2026');
    });
  });

  describe('E. Rejected', () => {
    it('E1 subject/content', () => {
      const trade = makeTrade();
      const { subject, content } = buildSobreavisoNotificationContent('rejected', trade, { actorFirstName: 'Renata' });
      expect(subject).toBe('Sua troca de sobreaviso foi rejeitada');
      expect(content).toContain('Renata');
      expect(content).toContain('SB100001');
    });
  });

  describe('F. Cancelled', () => {
    it('F1 direcionada — notifica destinatária', () => {
      const trade = makeTrade({ destinatarioId: F.luciana.funcionariaId });
      const targets = getSobreavisoNotificationRecipients('cancelled', trade);
      expect(targets).toEqual([F.luciana.funcionariaId]);
    });

    it('F2 aberta — não notifica ninguém', () => {
      const trade = makeTrade({ destinatarioId: null });
      const targets = getSobreavisoNotificationRecipients('cancelled', trade);
      expect(targets).toEqual([]);
    });
  });

  describe('G. Payload integration', () => {
    it('G1 buildPayload combina content + recipientIds', () => {
      const trade = makeTrade();
      const payload = buildSobreavisoNotificationPayload('created', trade, { actorFirstName: 'Marta' }, [F.saionara.uid, F.elisete.uid]);
      expect(payload.category).toBe('sobreaviso');
      expect(payload.priority).toBe('alta');
      expect(payload.actionUrl).toBe('trocasSobreaviso');
      expect(payload.recipientIds).toEqual([F.saionara.uid, F.elisete.uid]);
      expect(payload.subject).toContain('cobertura');
    });
  });

  describe('H. End-to-end com 5 funcionárias', () => {
    it('H1 Marta cria cobertura aberta → 4 outras funcionárias notificadas', () => {
      const trade = makeTrade({
        solicitanteId: F.marta.uid,
        solicitanteFuncionariaId: F.marta.funcionariaId,
        dataSobreaviso: '2026-04-20',
      });
      const { subject, content } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: 'Marta' });
      expect(subject).toContain('cobertura');
      expect(content).toContain('Marta');

      const targets = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.marta.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(targets).toHaveLength(4);
      expect(targets).not.toContain(F.marta.funcionariaId);
      expect(targets).toEqual(
        expect.arrayContaining([
          F.renata.funcionariaId, F.luciana.funcionariaId, F.elisete.funcionariaId, F.saionara.funcionariaId,
        ])
      );
    });

    it('H2 Renata direciona a Elisete — só Elisete; Elisete aceita — só Renata', () => {
      const trade = makeTrade({
        codigo: 'SB200',
        solicitanteId: F.renata.uid,
        solicitanteFuncionariaId: F.renata.funcionariaId,
        dataSobreaviso: '2026-04-25',
        destinatarioId: F.elisete.funcionariaId,
        destinatarioNome: 'Elisete',
      });

      // Criação — só Elisete
      const alvosCreate = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.renata.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(alvosCreate).toEqual([F.elisete.funcionariaId]);

      // Aceite por Elisete — só Renata
      const alvosAccept = getSobreavisoNotificationRecipients('accepted', trade);
      expect(alvosAccept).toEqual([F.renata.funcionariaId]);

      const { subject: acceptSubj } = buildSobreavisoNotificationContent('accepted', trade, { actorFirstName: 'Elisete' });
      expect(acceptSubj).toContain('aceita');
    });

    it('H3 Luciana cria swap direcionado a Saionara — só Saionara; Saionara rejeita — só Luciana', () => {
      const trade = makeTrade({
        codigo: 'SB300',
        solicitanteId: F.luciana.uid,
        solicitanteFuncionariaId: F.luciana.funcionariaId,
        dataSobreaviso: '2026-04-11',
        dataDesejada: '2026-04-18',
        destinatarioId: F.saionara.funcionariaId,
        destinatarioNome: 'Saionara',
      });

      const alvosCreate = getSobreavisoNotificationRecipients('created', trade, {
        actorFuncionariaId: F.luciana.funcionariaId,
        allFuncionariaIds: ALL_FUNCIONARIA_IDS,
      });
      expect(alvosCreate).toEqual([F.saionara.funcionariaId]);

      const { subject: createSubj, content: createContent } = buildSobreavisoNotificationContent('created', trade, { actorFirstName: 'Luciana' });
      expect(createSubj).toBe('Nova solicitação de troca de sobreaviso');
      expect(createContent).toContain('11/04/2026');
      expect(createContent).toContain('18/04/2026');

      const alvosReject = getSobreavisoNotificationRecipients('rejected', trade);
      expect(alvosReject).toEqual([F.luciana.funcionariaId]);

      const { subject: rejectSubj } = buildSobreavisoNotificationContent('rejected', trade, { actorFirstName: 'Saionara' });
      expect(rejectSubj).toContain('rejeitada');
    });

    it('H4 Elisete cria swap aberta não é permitida — mas swap direcionado com aceite reflete datas', () => {
      const trade = makeTrade({
        codigo: 'SB400',
        solicitanteId: F.elisete.uid,
        solicitanteFuncionariaId: F.elisete.funcionariaId,
        dataSobreaviso: '2026-05-02',
        dataDesejada: '2026-05-16',
        destinatarioId: F.saionara.funcionariaId,
        destinatarioNome: 'Saionara',
      });
      const { content } = buildSobreavisoNotificationContent('accepted', trade, { actorFirstName: 'Saionara' });
      expect(content).toContain('02/05/2026');
      expect(content).toContain('16/05/2026');
      expect(content).toContain('trocar');
    });

    it('H5 Marta cancela troca direcionada — só destinatária notificada; aberta não notifica', () => {
      const direcionada = makeTrade({
        codigo: 'SB500',
        solicitanteId: F.marta.uid,
        solicitanteFuncionariaId: F.marta.funcionariaId,
        destinatarioId: F.renata.funcionariaId,
      });
      expect(getSobreavisoNotificationRecipients('cancelled', direcionada)).toEqual([F.renata.funcionariaId]);

      const aberta = makeTrade({
        codigo: 'SB501',
        solicitanteId: F.marta.uid,
        solicitanteFuncionariaId: F.marta.funcionariaId,
        destinatarioId: null,
      });
      expect(getSobreavisoNotificationRecipients('cancelled', aberta)).toEqual([]);

      const { subject } = buildSobreavisoNotificationContent('cancelled', direcionada, { actorFirstName: 'Marta' });
      expect(subject).toContain('cancelada');
    });
  });

  describe('I. Robustness', () => {
    it('I1 evento inválido lança erro', () => {
      expect(() => buildSobreavisoNotificationContent('bogus', makeTrade())).toThrow();
    });

    it('I2 actorFirstName ausente usa fallback', () => {
      const { content } = buildSobreavisoNotificationContent('created', makeTrade());
      expect(content).toContain('Uma funcionária');
    });

    it('I3 trade sem código usa placeholder', () => {
      const { content } = buildSobreavisoNotificationContent('created', { dataSobreaviso: '2026-04-15' }, { actorFirstName: 'Marta' });
      expect(content).toContain('—');
    });
  });
});
