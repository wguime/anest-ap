/**
 * Tests for src/utils/plantaoHospitalarNotifications.js
 *
 * Funções puras que montam payload de notificação por evento do ciclo de
 * vida de uma troca de plantão hospitalar (FDS/feriado):
 * created / accepted / rejected / cancelled × cobertura vs troca (swap)
 * × escopo slot vs dia inteiro. Espelha o estilo de tradeNotifications.test.js.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPlantaoHospitalarNotificationContent,
  getPlantaoHospitalarNotificationRecipients,
  PLANTAO_NOTIF_META,
  __internal,
} from '../../utils/plantaoHospitalarNotifications';

const F = {
  ana:    'func-ana',
  bia:    'func-bia',
  carla:  'func-carla',
  denise: 'func-denise',
};
const ALL_IDS = Object.values(F);

function makeTrade(overrides = {}) {
  return {
    codigo: 'PH100001',
    escopo: 'slot',
    hospital: 'hro',
    turno: 'manha',
    dataPlantao: '2026-06-20',
    dataDesejada: null,
    hospitalDesejado: null,
    turnoDesejado: null,
    destinatarioId: null,
    solicitanteFuncionariaId: F.ana,
    ...overrides,
  };
}

// ===========================================================================
// buildPlantaoHospitalarNotificationContent
// ===========================================================================
describe('plantaoHospitalarNotifications — conteúdo', () => {
  it('evento inválido lança erro', () => {
    expect(() => buildPlantaoHospitalarNotificationContent('updated', makeTrade()))
      .toThrow('Evento inválido: updated');
    expect(() => buildPlantaoHospitalarNotificationContent(undefined, makeTrade()))
      .toThrow(/Evento inválido/);
  });

  describe('created — cobertura (sem dataDesejada)', () => {
    it('subject de cobertura + slot formatado + código', () => {
      const { subject, content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade(),
        { actorFirstName: 'Ana' }
      );
      expect(subject).toBe('Nova solicitação de cobertura de plantão');
      expect(content).toBe(
        'Ana pede cobertura para HRO (07h–15h) de 20/06/2026. Código: PH100001'
      );
    });

    it('escopo dia → "o dia DD/MM/AAAA" (sem hospital/turno)', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ escopo: 'dia' }),
        { actorFirstName: 'Ana' }
      );
      expect(content).toContain('o dia 20/06/2026');
      expect(content).not.toContain('HRO');
    });

    it('sem ctx → actor default "Uma funcionária"; sem código → "—"', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ codigo: undefined })
      );
      expect(content).toContain('Uma funcionária');
      expect(content).toContain('Código: —');
    });

    it('hospital/turno fora do mapa passam raw (fallback de label)', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ hospital: 'hospital-x', turno: 'noite' }),
        { actorFirstName: 'Bia' }
      );
      expect(content).toContain('hospital-x (noite)');
    });

    it('labels conhecidos: unimed e plantao_pago + turno tarde', () => {
      const unimed = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ hospital: 'unimed', turno: 'tarde' })
      );
      expect(unimed.content).toContain('UNIMED (15h–23h)');
      const pago = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ hospital: 'plantao_pago' })
      );
      expect(pago.content).toContain('Plantão Pago (07h–15h)');
    });
  });

  describe('created — troca bidirecional (com dataDesejada)', () => {
    it('subject de troca + oferta e retorno formatados', () => {
      const { subject, content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({
          dataDesejada: '2026-06-27',
          hospitalDesejado: 'unimed',
          turnoDesejado: 'tarde',
        }),
        { actorFirstName: 'Ana' }
      );
      expect(subject).toBe('Nova solicitação de troca de plantão');
      expect(content).toBe(
        'Ana quer trocar HRO (07h–15h) de 20/06/2026 por UNIMED (15h–23h) de 27/06/2026. Código: PH100001'
      );
    });

    it('escopo dia em ambas as pontas', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ escopo: 'dia', dataDesejada: '2026-06-27' })
      );
      expect(content).toContain('trocar o dia 20/06/2026 por o dia 27/06/2026');
    });
  });

  describe('accepted', () => {
    it('cobertura: "aceitou cobrir"', () => {
      const { subject, content } = buildPlantaoHospitalarNotificationContent(
        'accepted',
        makeTrade(),
        { actorFirstName: 'Bia' }
      );
      expect(subject).toBe('Sua troca de plantão foi aceita');
      expect(content).toBe('Bia aceitou cobrir HRO (07h–15h) de 20/06/2026. Código: PH100001');
    });

    it('swap: "aceitou trocar X por Y"', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'accepted',
        makeTrade({
          dataDesejada: '2026-06-27',
          hospitalDesejado: 'hro',
          turnoDesejado: 'manha',
        }),
        { actorFirstName: 'Bia' }
      );
      expect(content).toBe(
        'Bia aceitou trocar HRO (07h–15h) de 20/06/2026 por HRO (07h–15h) de 27/06/2026. Código: PH100001'
      );
    });
  });

  describe('rejected / cancelled', () => {
    it('rejected: mesma mensagem para cobertura e swap (só código)', () => {
      const cobertura = buildPlantaoHospitalarNotificationContent(
        'rejected',
        makeTrade(),
        { actorFirstName: 'Carla' }
      );
      const swap = buildPlantaoHospitalarNotificationContent(
        'rejected',
        makeTrade({ dataDesejada: '2026-06-27' }),
        { actorFirstName: 'Carla' }
      );
      expect(cobertura.subject).toBe('Sua troca de plantão foi rejeitada');
      expect(cobertura.content).toBe(
        'Carla rejeitou sua solicitação (PH100001). Você pode criar outra.'
      );
      expect(swap.content).toBe(cobertura.content);
    });

    it('cancelled: subject e content com código', () => {
      const { subject, content } = buildPlantaoHospitalarNotificationContent(
        'cancelled',
        makeTrade(),
        { actorFirstName: 'Ana' }
      );
      expect(subject).toBe('Troca de plantão cancelada');
      expect(content).toBe('Ana cancelou a solicitação de troca (PH100001).');
    });
  });

  describe('LGPD — sem vazamento de dados de paciente ou nome completo', () => {
    it('campos extras (paciente, nome completo) no trade NUNCA entram no payload', () => {
      // O módulo não lida com paciente; este teste é guarda de regressão LGPD:
      // mesmo que o objeto trade carregue dados sensíveis, eles não podem
      // vazar para subject/content da notificação.
      const dirty = makeTrade({
        pacienteNome: 'João da Silva Sauro',
        pacienteIniciais: 'J.S.S.',
        solicitanteNomeCompleto: 'Ana Beatriz de Oliveira Santos',
        cpf: '123.456.789-00',
      });
      for (const event of __internal.EVENTS) {
        const { subject, content } = buildPlantaoHospitalarNotificationContent(
          event,
          dirty,
          { actorFirstName: 'Ana' }
        );
        const payload = `${subject} ${content}`;
        expect(payload).not.toContain('João da Silva Sauro');
        expect(payload).not.toContain('Ana Beatriz de Oliveira Santos');
        expect(payload).not.toContain('123.456.789-00');
      }
    });

    it('actor é só primeiro nome vindo do ctx (nunca nome completo derivado do trade)', () => {
      const { content } = buildPlantaoHospitalarNotificationContent(
        'created',
        makeTrade({ solicitanteNomeCompleto: 'Ana Beatriz de Oliveira Santos' }),
        { actorFirstName: 'Ana' }
      );
      expect(content.startsWith('Ana ')).toBe(true);
      expect(content).not.toContain('Beatriz');
    });
  });
});

// ===========================================================================
// getPlantaoHospitalarNotificationRecipients
// ===========================================================================
describe('plantaoHospitalarNotifications — recipients', () => {
  describe('created', () => {
    it('direcionada: só o destinatário', () => {
      const targets = getPlantaoHospitalarNotificationRecipients(
        'created',
        makeTrade({ destinatarioId: F.bia }),
        { actorFuncionariaId: F.ana, allFuncionariaIds: ALL_IDS }
      );
      expect(targets).toEqual([F.bia]);
    });

    it('aberta: todas menos a autora', () => {
      const targets = getPlantaoHospitalarNotificationRecipients(
        'created',
        makeTrade(),
        { actorFuncionariaId: F.ana, allFuncionariaIds: ALL_IDS }
      );
      expect(targets).toEqual([F.bia, F.carla, F.denise]);
      expect(targets).not.toContain(F.ana);
    });

    it('aberta: ids falsy são filtrados', () => {
      const targets = getPlantaoHospitalarNotificationRecipients(
        'created',
        makeTrade(),
        { actorFuncionariaId: F.ana, allFuncionariaIds: [F.bia, null, '', undefined, F.carla] }
      );
      expect(targets).toEqual([F.bia, F.carla]);
    });

    it('sem ctx → lista vazia (default allFuncionariaIds = [])', () => {
      expect(getPlantaoHospitalarNotificationRecipients('created', makeTrade())).toEqual([]);
    });
  });

  describe('accepted / rejected', () => {
    it('vão para a solicitante', () => {
      const trade = makeTrade({ solicitanteFuncionariaId: F.ana });
      expect(
        getPlantaoHospitalarNotificationRecipients('accepted', trade, {
          actorFuncionariaId: F.bia,
        })
      ).toEqual([F.ana]);
      expect(
        getPlantaoHospitalarNotificationRecipients('rejected', trade, {
          actorFuncionariaId: F.bia,
        })
      ).toEqual([F.ana]);
    });

    it('sem solicitanteFuncionariaId → []', () => {
      const trade = makeTrade({ solicitanteFuncionariaId: null });
      expect(getPlantaoHospitalarNotificationRecipients('accepted', trade)).toEqual([]);
      expect(getPlantaoHospitalarNotificationRecipients('rejected', trade)).toEqual([]);
    });
  });

  describe('cancelled', () => {
    it('vai para a destinatária quando a troca era direcionada', () => {
      expect(
        getPlantaoHospitalarNotificationRecipients(
          'cancelled',
          makeTrade({ destinatarioId: F.carla })
        )
      ).toEqual([F.carla]);
    });

    it('troca aberta cancelada → ninguém é notificado', () => {
      expect(
        getPlantaoHospitalarNotificationRecipients('cancelled', makeTrade())
      ).toEqual([]);
    });
  });

  it('evento desconhecido → [] (não lança, diferente do builder de conteúdo)', () => {
    expect(
      getPlantaoHospitalarNotificationRecipients('updated', makeTrade(), {
        allFuncionariaIds: ALL_IDS,
      })
    ).toEqual([]);
  });
});

// ===========================================================================
// PLANTAO_NOTIF_META + __internal
// ===========================================================================
describe('plantaoHospitalarNotifications — metadados', () => {
  it('PLANTAO_NOTIF_META tem o shape consumido pelo dispatcher', () => {
    expect(PLANTAO_NOTIF_META).toEqual({
      CATEGORY: 'plantao-hospitalar',
      PRIORITY: 'alta',
      ACTION_URL: 'trocasPlantaoHospitalar',
      ACTION_LABEL: 'Ver Troca',
    });
  });

  it('__internal.EVENTS cobre os 4 eventos do ciclo de vida', () => {
    expect(__internal.EVENTS).toEqual(['created', 'accepted', 'rejected', 'cancelled']);
  });

  it('__internal.formatDateBR: ISO → DD/MM/AAAA; vazio/null → ""', () => {
    expect(__internal.formatDateBR('2026-06-20')).toBe('20/06/2026');
    expect(__internal.formatDateBR('')).toBe('');
    expect(__internal.formatDateBR(null)).toBe('');
  });

  it('__internal.formatSlot: labels conhecidos e fallback raw', () => {
    expect(__internal.formatSlot('hro', 'manha')).toBe('HRO (07h–15h)');
    expect(__internal.formatSlot('clinica-y', 'madrugada')).toBe('clinica-y (madrugada)');
  });
});
