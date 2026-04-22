/**
 * Funcionaria Resolver
 * Helper compartilhado entre useTrocaSobreaviso e useTrocaPlantaoHospitalar
 * para resolver o id da funcionária a partir do email do usuário logado.
 */
import { FUNCIONARIAS_SOBREAVISO } from '../data/sobreavisoMaterno2026';
import { FUNCIONARIAS_HOSPITAIS } from '../data/hospitaisTecnicas2026';

const warnedEmails = new Set();

function normalizeEmail(value) {
  return (value || '').toLowerCase().trim();
}

export function resolveFuncionariaId(user, funcionarias) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;
  const match = funcionarias.find((f) => normalizeEmail(f.email) === email);
  if (!match && !warnedEmails.has(email)) {
    warnedEmails.add(email);
    const expected = funcionarias.map((f) => f.email).filter(Boolean).join(', ');
    console.warn(`[funcionariaResolver] Email "${email}" não encontrado. Esperados: ${expected}`);
  }
  return match?.id || null;
}

export function isFuncionariaPorEmail(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  return FUNCIONARIAS_SOBREAVISO.some((f) => normalizeEmail(f.email) === email)
      || FUNCIONARIAS_HOSPITAIS.some((f) => normalizeEmail(f.email) === email);
}
