/**
 * Espelho Supabase dos overrides da residência — o que a edge de lembretes lê.
 *
 * O contrato é o da edge `schedule-shift-reminders`: linha por `data_plantao`
 * com `residente_override`. Volta à base (sem residente) apaga a linha. E a
 * falha do espelho NUNCA vira erro para quem aceitou a troca — o Firestore já
 * gravou; ela só é registrada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sb = vi.hoisted(() => {
  const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const inFn = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const del = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ upsert, delete: del }));
  return { upsert, inFn, del, from };
});

vi.mock('@/config/supabase', () => ({ supabase: { from: sb.from }, default: { from: sb.from } }));

import { espelharOverridesResidencia } from '../../services/residenciaPlantaoOverridesMirror';

beforeEach(() => {
  vi.clearAllMocks();
  sb.upsert.mockResolvedValue({ data: null, error: null });
  sb.inFn.mockResolvedValue({ data: null, error: null });
});

describe('espelharOverridesResidencia', () => {
  it('swap aceito vira duas linhas em residencia_plantao_diario_overrides', async () => {
    const r = await espelharOverridesResidencia([
      { dateKey: '2026-07-19', residenteOverride: 'r1-roosewelt', origem: 'troca', trocaId: 'TR475677' },
      { dateKey: '2026-07-26', residenteOverride: 'r1-augusto', origem: 'troca', trocaId: 'TR475677' },
    ], 'uid-roosewelt');

    expect(r.success).toBe(true);
    expect(sb.from).toHaveBeenCalledWith('residencia_plantao_diario_overrides');
    expect(sb.upsert).toHaveBeenCalledTimes(1);
    const [linhas, opts] = sb.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: 'data_plantao' });
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      data_plantao: '2026-07-19', residente_override: 'r1-roosewelt', origem: 'troca', troca_id: 'TR475677', updated_by: 'uid-roosewelt',
    });
    expect(linhas[1]).toMatchObject({ data_plantao: '2026-07-26', residente_override: 'r1-augusto' });
    expect(sb.del).not.toHaveBeenCalled();
  });

  it('volta à tabela (sem residente) apaga a linha; ajuste manual sem origem grava "manual"', async () => {
    await espelharOverridesResidencia([
      { dateKey: '2026-07-20' },
      { dateKey: '2026-07-21', residenteOverride: 'r1-roosewelt' },
    ], 'uid-admin');

    expect(sb.inFn).toHaveBeenCalledWith('data_plantao', ['2026-07-20']);
    expect(sb.upsert.mock.calls[0][0][0]).toMatchObject({ data_plantao: '2026-07-21', origem: 'manual', troca_id: null });
  });

  it('entrada sem data é ignorada e lista vazia não toca o banco', async () => {
    const r = await espelharOverridesResidencia([{ residenteOverride: 'r1-augusto' }], 'uid');
    expect(r.success).toBe(true);
    expect(sb.upsert).not.toHaveBeenCalled();
    expect(sb.del).not.toHaveBeenCalled();
  });

  it('falha do Supabase não estoura: devolve success=false e avisa no console', async () => {
    sb.upsert.mockResolvedValueOnce({ data: null, error: { message: 'RLS' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await espelharOverridesResidencia([{ dateKey: '2026-07-19', residenteOverride: 'r1-roosewelt' }], 'uid');
    expect(r).toEqual({ success: false, error: 'RLS' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
