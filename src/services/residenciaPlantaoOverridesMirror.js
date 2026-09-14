/**
 * Espelho em Supabase dos overrides de plantão da residência.
 *
 * A fonte da verdade continua sendo o Firestore (`residenciaPlantaoDiario`), que
 * as telas leem. Mas quem manda o lembrete "Plantão amanhã" aos residentes é a
 * edge `schedule-shift-reminders` (pg_cron, 3×/dia), e a edge NÃO lê Firestore:
 * ela consulta `residencia_plantao_diario_overrides` e, sem a linha, cai na
 * tabela estática. A tabela não existia até 14/09/2026 — por isso em julho o
 * lembrete do dia 19 foi para quem já tinha trocado pelo 20, e em setembro dois
 * residentes recebiam "plantão amanhã" para o mesmo dia (a edge avisava o da
 * tabela, o hook do admin avisava o da troca).
 *
 * Toda escrita no Firestore (aceite de troca, ajuste manual, volta à base) passa
 * por aqui também. Best-effort: falha aqui NÃO desfaz a troca (o Firestore já
 * gravou) — fica no console, e o lembrete daquele dia pode sair para o residente
 * da tabela. `updated_by` é o UID real de quem gravou (audit trail).
 */
import { supabase } from '@/config/supabase';

const TABELA = 'residencia_plantao_diario_overrides';

/**
 * @param {Array<{dateKey: string, residenteOverride?: string|null, origem?: string, trocaId?: string|null}>} entries
 *   Entrada sem `residenteOverride` = a data voltou à tabela estática (apaga a linha).
 * @param {string} userId — Firebase UID de quem gravou
 */
export async function espelharOverridesResidencia(entries, userId) {
  const upserts = [];
  const remocoes = [];
  for (const entry of entries || []) {
    if (!entry?.dateKey) continue;
    if (!entry.residenteOverride) {
      remocoes.push(entry.dateKey);
      continue;
    }
    upserts.push({
      data_plantao: entry.dateKey,
      residente_override: entry.residenteOverride,
      origem: entry.origem || 'manual',
      troca_id: entry.trocaId || null,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    });
  }

  try {
    if (upserts.length > 0) {
      const { error } = await supabase.from(TABELA).upsert(upserts, { onConflict: 'data_plantao' });
      if (error) throw error;
    }
    if (remocoes.length > 0) {
      const { error } = await supabase.from(TABELA).delete().in('data_plantao', remocoes);
      if (error) throw error;
    }
    return { success: true, error: null };
  } catch (error) {
    const message = error?.message || String(error);
    console.warn('[residenciaPlantaoOverridesMirror] espelho Supabase falhou (Firestore já gravou):', message);
    return { success: false, error: message };
  }
}

export default espelharOverridesResidencia;
