/**
 * Shared formatters for Reuniao detail tabs.
 */
import { formatDate as fmtDate } from '@/utils/formatters';

/** Format date to long Brazilian format (e.g., "26 de maio de 2026") */
export function formatDate(date) {
  if (!date) return '';
  try {
    const d = date?.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
    return fmtDate(d, 'long');
  } catch { return ''; }
}

/** Format date+time to short Brazilian format (e.g., "26 de mai., 14:30") */
export function formatDateTime(date) {
  if (!date) return '';
  try {
    const d = date?.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
    return fmtDate(d, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/** Resolve an array of IDs into sorted { id, nome } objects */
export function sortIdsByNome(ids, participantesData) {
  if (!ids?.length) return [];
  return ids
    .map(id => participantesData.find(u => u.id === id) || { id, nome: id })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
