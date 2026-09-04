import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Trava da auditoria 04/09/2026 — envio de relato pelo app.
//
// O INSERT direto em `incidentes` com `.select()` (RETURNING) passava pelas
// policies de SELECT; relato ANÔNIMO tem user_id NULL e, para quem não é
// admin, o Postgres devolvia 42501 "new row violates row-level security
// policy". Nenhum não-admin conseguia enviar relato anônimo. O envio agora é
// a RPC rpc_submit_incidente (SECURITY DEFINER), que decide anonimato e
// user_id no servidor. Este teste impede a volta do insert direto.
// ============================================================================
const mockRpc = vi.fn();
const mockFrom = vi.fn(() => {
  throw new Error('createIncidente/createDenuncia não devem inserir direto na tabela');
});
const mockInvoke = vi.fn(() => Promise.resolve({ data: null, error: null }));

vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args),
    functions: { invoke: (...args) => mockInvoke(...args) },
  },
}));

const { default: service } = await import('../../services/supabaseIncidentsService');

function rpcRow(params, extra = {}) {
  return {
    id: 'a1b2c3',
    tipo: params.p_tipo,
    source: params.p_source,
    status: params.p_status,
    protocolo: params.p_protocolo || 'GEN-0001',
    tracking_code: 'ANEST-2026-XYZ12345',
    user_id: null,
    created_at: '2026-09-04T17:00:00.000Z',
    ...extra,
  };
}

describe('supabaseIncidentsService — envio via rpc_submit_incidente', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockClear();
    mockInvoke.mockClear();
    mockRpc.mockImplementation((_name, params) => Promise.resolve({ data: rpcRow(params), error: null }));
  });

  it('denúncia ANÔNIMA vai pela RPC, sem user_id decidido no cliente', async () => {
    const result = await service.createDenuncia({
      source: 'interno',
      protocolo: 'DEN-20260904-0001',
      denunciante: { tipoIdentificacao: 'anonimo' },
      denuncia: { tipo: 'assedio', descricao: 'relato' },
      attachments: [{ name: 'evidencia-1.pdf', path: 'denuncias-anon/DEN-20260904-0001/u.pdf', size: 10, type: 'application/pdf' }],
    }, { userId: 'uid-do-cliente' });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [name, params] = mockRpc.mock.calls[0];
    expect(name).toBe('rpc_submit_incidente');
    expect(params).toMatchObject({
      p_tipo: 'denuncia',
      p_source: 'interno',
      p_protocolo: 'DEN-20260904-0001',
      p_denunciante: { tipoIdentificacao: 'anonimo' },
      p_denuncia_data: { tipo: 'assedio', descricao: 'relato' },
    });
    // Anonimato e autor são do servidor: nenhum user_id sai do cliente.
    expect(Object.keys(params).some((k) => /user_id|userId/i.test(k))).toBe(false);
    expect(params.p_attachments).toEqual([
      { name: 'evidencia-1.pdf', path: 'denuncias-anon/DEN-20260904-0001/u.pdf', size: 10, type: 'application/pdf' },
    ]);
    // A linha volta em camelCase com o tracking_code gerado pelo trigger.
    expect(result.trackingCode).toBe('ANEST-2026-XYZ12345');
    expect(result.protocolo).toBe('DEN-20260904-0001');
  });

  it('incidente identificado leva never event, contexto e gestão interna', async () => {
    await service.createIncidente({
      source: 'interno',
      protocolo: 'INC-20260904-0002',
      notificante: { tipoIdentificacao: 'identificado', nome: 'Dra. Teste', email: 't@t.com' },
      incidente: { tipo: 'medicacao', descricao: 'x', severidade: 'grave' },
      contextoAnest: { fase: 'inducao' },
      gestaoInterna: { historicoStatus: [] },
      isNeverEvent: true,
      neverEventCode: 'NE-01',
      lgpdConsentAt: '2026-09-04T16:00:00.000Z',
    });

    const [, params] = mockRpc.mock.calls[0];
    expect(params).toMatchObject({
      p_tipo: 'incidente',
      p_notificante: { tipoIdentificacao: 'identificado', nome: 'Dra. Teste', email: 't@t.com' },
      p_incidente_data: { tipo: 'medicacao', descricao: 'x', severidade: 'grave' },
      p_contexto_anest: { fase: 'inducao' },
      p_gestao_interna: { historicoStatus: [] },
      p_is_never_event: true,
      p_never_event_code: 'NE-01',
      p_lgpd_consent_at: '2026-09-04T16:00:00.000Z',
    });
  });

  it('never event sem código não manda flag ligada', async () => {
    await service.createIncidente({
      notificante: { tipoIdentificacao: 'anonimo' },
      incidente: { tipo: 'queda', descricao: 'y' },
      isNeverEvent: true,
    });
    const [, params] = mockRpc.mock.calls[0];
    expect(params.p_is_never_event).toBe(true);
    expect(params.p_never_event_code).toBeNull();
  });

  it('erro da RPC vira exceção com o contexto e não dispara e-mail', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'caller not authenticated' } });
    await expect(service.createDenuncia({ denunciante: { tipoIdentificacao: 'anonimo' }, denuncia: {} }))
      .rejects.toThrow(/createDenuncia: caller not authenticated/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('e-mail sai com o protocolo devolvido pelo banco', async () => {
    mockRpc.mockImplementationOnce((_n, params) => Promise.resolve({ data: rpcRow(params, { protocolo: 'DEN-DB-9999' }), error: null }));
    await service.createDenuncia({ denunciante: { tipoIdentificacao: 'identificado', nome: 'A' }, denuncia: { tipo: 'etica', descricao: 'z' } });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0][1].body.protocolo).toBe('DEN-DB-9999');
  });
});
