import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Supabase client — capture DB inserts + Edge Function invocations
// ============================================================================
const mockInvoke = vi.fn(() => Promise.resolve({ data: null, error: null }));
let insertChainData = null;

function createInsertChain(data) {
  const chain = {
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({
      data: { ...data, protocolo: data?.protocolo || 'INC-20260408-0001' },
      error: null,
    })),
  };
  return chain;
}

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn((row) => {
        insertChainData = row;
        return createInsertChain(row);
      }),
    })),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

// Need to dynamically import AFTER mocks are set up
const { default: service } = await import('../../services/supabaseIncidentsService');

// ============================================================================
// Helpers
// ============================================================================
const LONG_DESCRICAO = 'B'.repeat(800); // 800 chars — well above old 200 limit

function buildIncidenteData(descricao) {
  return {
    source: 'app',
    notificante: {
      tipoIdentificacao: 'identificado',
      nome: 'Dr. Teste',
      email: 'dr@teste.com',
      funcao: 'Anestesiologista',
      setor: 'Centro Cirúrgico',
    },
    incidente: {
      descricao,
      tipo: 'medicacao',
      severidade: 'moderada',
      data: '2026-04-08',
      local: 'Sala 3',
      setor: 'Centro Cirúrgico',
    },
    impacto: {},
    contextoAnest: {},
  };
}

function buildDenunciaData(descricao) {
  return {
    source: 'app',
    denunciante: {
      tipoIdentificacao: 'anonimo',
      nome: '',
      email: '',
    },
    denunciaData: {
      descricao,
      tipo: 'assedio',
      titulo: 'Denúncia de teste',
    },
    impacto: {},
  };
}

// ============================================================================
// Tests: createIncidente → email payload must contain full description
// ============================================================================
describe('supabaseIncidentsService — email notification payload', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    insertChainData = null;
  });

  describe('createIncidente', () => {
    it('deve passar descrição completa (800 chars) para notificação por email', async () => {
      await service.createIncidente(buildIncidenteData(LONG_DESCRICAO));

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const body = mockInvoke.mock.calls[0][1].body;

      // A descrição NÃO deve ser truncada
      expect(body.descricaoResumo).toBe(LONG_DESCRICAO);
      expect(body.descricaoResumo.length).toBe(800);
    });

    it('deve passar descrição curta intacta', async () => {
      const shortDesc = 'Incidente simples';
      await service.createIncidente(buildIncidenteData(shortDesc));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe(shortDesc);
    });

    it('deve lidar com descrição undefined sem erro', async () => {
      await service.createIncidente(buildIncidenteData(undefined));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe('');
    });

    it('deve preservar texto com caracteres especiais', async () => {
      const specialText = 'Paciente apresentou reação <alérgica> ao fármaco "Propofol" & necessitou intubação de emergência às 14h30.';
      await service.createIncidente(buildIncidenteData(specialText));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe(specialText);
    });
  });

  describe('createDenuncia', () => {
    it('deve passar descrição completa (800 chars) para notificação por email', async () => {
      await service.createDenuncia(buildDenunciaData(LONG_DESCRICAO));

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const body = mockInvoke.mock.calls[0][1].body;

      // A descrição NÃO deve ser truncada
      expect(body.descricaoResumo).toBe(LONG_DESCRICAO);
      expect(body.descricaoResumo.length).toBe(800);
    });

    it('deve passar descrição curta intacta', async () => {
      const shortDesc = 'Denúncia simples';
      await service.createDenuncia(buildDenunciaData(shortDesc));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe(shortDesc);
    });

    it('deve lidar com descrição undefined sem erro', async () => {
      await service.createDenuncia(buildDenunciaData(undefined));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe('');
    });
  });
});
