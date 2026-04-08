import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Supabase client — capture Edge Function invocations
// ============================================================================
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import {
  notifyNewIncidentEmail,
  notifyNewDenunciaEmail,
} from '../../services/emailNotificationService';

// ============================================================================
// Helpers
// ============================================================================
const LONG_TEXT = 'A'.repeat(500); // 500 characters
const SHORT_TEXT = 'Descrição curta do incidente';

function baseIncidentPayload(descricao) {
  return {
    protocolo: 'INC-20260408-0001',
    tipoIdentificacao: 'identificado',
    notificanteName: 'Dr. Teste',
    notificanteEmail: 'dr@teste.com',
    notificanteFuncao: 'Anestesiologista',
    notificanteSetor: 'Centro Cirúrgico',
    severidade: 'moderada',
    categoriaIncidente: 'medicacao',
    descricaoResumo: descricao,
  };
}

function baseDenunciaPayload(descricao) {
  return {
    protocolo: 'DEN-20260408-0001',
    tipoIdentificacao: 'anonimo',
    notificanteName: '',
    notificanteEmail: '',
    categoriaDenuncia: 'assedio',
    descricaoResumo: descricao,
  };
}

// ============================================================================
// Tests
// ============================================================================
describe('emailNotificationService', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  // --------------------------------------------------------------------------
  // notifyNewIncidentEmail
  // --------------------------------------------------------------------------
  describe('notifyNewIncidentEmail', () => {
    it('deve enviar descrição completa (>200 chars) sem truncar', async () => {
      await notifyNewIncidentEmail(baseIncidentPayload(LONG_TEXT));

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const [fnName, options] = mockInvoke.mock.calls[0];
      expect(fnName).toBe('notify-incident');

      const body = options.body;
      expect(body.descricaoResumo).toBe(LONG_TEXT);
      expect(body.descricaoResumo.length).toBe(500);
    });

    it('deve enviar descrição curta sem alteração', async () => {
      await notifyNewIncidentEmail(baseIncidentPayload(SHORT_TEXT));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe(SHORT_TEXT);
    });

    it('deve enviar string vazia quando descricaoResumo é undefined', async () => {
      await notifyNewIncidentEmail(baseIncidentPayload(undefined));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe('');
    });

    it('deve enviar string vazia quando descricaoResumo é null', async () => {
      await notifyNewIncidentEmail(baseIncidentPayload(null));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe('');
    });

    it('deve omitir dados pessoais para relatos confidenciais', async () => {
      await notifyNewIncidentEmail({
        ...baseIncidentPayload(LONG_TEXT),
        tipoIdentificacao: 'confidencial',
      });

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.notificanteName).toBe('');
      expect(body.notificanteEmail).toBe('');
      expect(body.notificanteFuncao).toBe('');
      expect(body.notificanteSetor).toBe('');
      // Descrição deve continuar completa
      expect(body.descricaoResumo).toBe(LONG_TEXT);
    });

    it('deve chamar edge function notify-incident com tipo incidente', async () => {
      await notifyNewIncidentEmail(baseIncidentPayload(SHORT_TEXT));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.tipo).toBe('incidente');
      expect(body.protocolo).toBe('INC-20260408-0001');
    });

    it('não deve lançar erro quando edge function falha', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'SMTP error' } });

      await expect(
        notifyNewIncidentEmail(baseIncidentPayload(SHORT_TEXT))
      ).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // notifyNewDenunciaEmail
  // --------------------------------------------------------------------------
  describe('notifyNewDenunciaEmail', () => {
    it('deve enviar descrição completa (>200 chars) sem truncar', async () => {
      await notifyNewDenunciaEmail(baseDenunciaPayload(LONG_TEXT));

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const [fnName, options] = mockInvoke.mock.calls[0];
      expect(fnName).toBe('notify-incident');

      const body = options.body;
      expect(body.descricaoResumo).toBe(LONG_TEXT);
      expect(body.descricaoResumo.length).toBe(500);
    });

    it('deve enviar descrição curta sem alteração', async () => {
      await notifyNewDenunciaEmail(baseDenunciaPayload(SHORT_TEXT));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe(SHORT_TEXT);
    });

    it('deve enviar string vazia quando descricaoResumo é undefined', async () => {
      await notifyNewDenunciaEmail(baseDenunciaPayload(undefined));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.descricaoResumo).toBe('');
    });

    it('deve chamar edge function notify-incident com tipo denuncia', async () => {
      await notifyNewDenunciaEmail(baseDenunciaPayload(SHORT_TEXT));

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.tipo).toBe('denuncia');
      expect(body.protocolo).toBe('DEN-20260408-0001');
    });

    it('deve omitir dados pessoais para relatos confidenciais', async () => {
      await notifyNewDenunciaEmail({
        ...baseDenunciaPayload(LONG_TEXT),
        tipoIdentificacao: 'confidencial',
      });

      const body = mockInvoke.mock.calls[0][1].body;
      expect(body.notificanteName).toBe('');
      expect(body.notificanteEmail).toBe('');
      expect(body.descricaoResumo).toBe(LONG_TEXT);
    });

    it('não deve lançar erro quando edge function falha', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'SMTP error' } });

      await expect(
        notifyNewDenunciaEmail(baseDenunciaPayload(SHORT_TEXT))
      ).resolves.not.toThrow();
    });
  });
});
