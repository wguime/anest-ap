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

  describe('H. Robustness', () => {
    it('H1 evento inválido lança erro', () => {
      expect(() => buildSobreavisoNotificationContent('bogus', makeTrade())).toThrow();
    });

    it('H2 actorFirstName ausente usa fallback', () => {
      const { content } = buildSobreavisoNotificationContent('created', makeTrade());
      expect(content).toContain('Uma funcionária');
    });

    it('H3 trade sem código usa placeholder', () => {
      const { content } = buildSobreavisoNotificationContent('created', { dataSobreaviso: '2026-04-15' }, { actorFirstName: 'Marta' });
      expect(content).toContain('—');
    });
  });
});
