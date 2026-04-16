/**
 * residencia2026
 * Tabela estática da rotação de residentes em 2026 (01/mar/2026 → 28/fev/2027).
 * Fonte: Residentes/2026 Estágios.pdf
 */

export const RESIDENTES_2026 = [
  { id: 'r1-augusto',   nome: 'Augusto',   ano: 'R1' },
  { id: 'r1-guilherme', nome: 'Guilherme', ano: 'R1' },
  { id: 'r1-roosewelt', nome: 'Roosewelt', ano: 'R1' },
  { id: 'r2-daniel',    nome: 'Daniel',    ano: 'R2' },
  { id: 'r2-jacinta',   nome: 'Jacinta',   ano: 'R2' },
  { id: 'r2-rodrigo',   nome: 'Rodrigo',   ano: 'R2' },
  { id: 'r3-raffaela',  nome: 'Raffaela',  ano: 'R3' },
  { id: 'r3-wagner',    nome: 'Wagner',    ano: 'R3' },
];

const q = (wagner, raffaela, daniel, jacinta, rodrigo, augusto, guilherme, roosewelt) => ({
  'r3-wagner':    wagner,
  'r3-raffaela':  raffaela,
  'r2-daniel':    daniel,
  'r2-jacinta':   jacinta,
  'r2-rodrigo':   rodrigo,
  'r1-augusto':   augusto,
  'r1-guilherme': guilherme,
  'r1-roosewelt': roosewelt,
});

export const ROTACOES_2026 = [
  { inicio: '2026-03-01', fim: '2026-03-15', estagios: q('TORÁCICA','APA','BLOQUEIOS','NEURO','GO/EMERG','ADAPTAÇÃO','ADAPTAÇÃO','ADAPTAÇÃO') },
  { inicio: '2026-03-16', fim: '2026-03-31', estagios: q('SRPA','GO/EMERG','NEURO','APA','BLOQUEIOS','ADAPTAÇÃO','ADAPTAÇÃO','ADAPTAÇÃO') },
  { inicio: '2026-04-01', fim: '2026-04-15', estagios: q('INFANTIL','TORÁCICA','APA','ONCO','NEURO','URO/PROCTO','ORTOPEDIA','CX GERAL') },
  { inicio: '2026-04-16', fim: '2026-04-30', estagios: q('ONCO','NEURO','TORÁCICA','INFANTIL','APA','ORTOPEDIA','GO/EMERG','URO/PROCTO') },
  { inicio: '2026-05-01', fim: '2026-05-15', estagios: q('APA','OPTATIVO','UTI','SRPA','TORÁCICA','CX/GERAL','URO/PROCTO','ORTOPEDIA') },
  { inicio: '2026-05-16', fim: '2026-05-30', estagios: q('NEURO','OPTATIVO','UTI','ONCO','FÉRIAS','ORTOPEDIA','APA','GO/EMERG') },
  { inicio: '2026-06-01', fim: '2026-06-15', estagios: q('BLOQUEIO','INFANTIL','ONCO','FÉRIAS','UTI','GO/EMERG','CX GERAL','APA') },
  { inicio: '2026-06-16', fim: '2026-06-30', estagios: q('TORÁCICA','NEURO','INFANTIL','BLOQUEIO','UTI','APA','GO/EMERG','FÉRIAS') },
  { inicio: '2026-07-01', fim: '2026-07-15', estagios: q('ONCO','BLOQUEIO','NEURO','UTI','INFANTIL','FÉRIAS','APA','SRPA') },
  { inicio: '2026-07-16', fim: '2026-07-31', estagios: q('INFANTIL','TORÁCICA','FÉRIAS','UTI','APA','CX GERAL','ORTOPEDIA','GO/EMERG') },
  { inicio: '2026-08-01', fim: '2026-08-15', estagios: q('TORÁCICA','ONCO','GO/EMERG','INFANTIL','NEURO','UTI','FERIAS','APA') },
  { inicio: '2026-08-16', fim: '2026-08-31', estagios: q('NEURO','OPTATIVO','INFANTIL','APA','ONCO','UTI','CX GERAL','ORTOPEDIA') },
  { inicio: '2026-09-01', fim: '2026-09-15', estagios: q('OPTATIVO','FÉRIAS','APA','TORÁCICA','NEURO','ORTOPEDIA','URO/PROCTO','UTI') },
  { inicio: '2026-09-16', fim: '2026-09-30', estagios: q('INFANTIL','ONCO','NEURO','FÉRIAS','SRPA','APA','ORTOPEDIA','UTI') },
  { inicio: '2026-10-01', fim: '2026-10-15', estagios: q('ONCO','INFANTIL','FÉRIAS','NEURO','APA','URO/PROCTO','UTI','CX GERAL') },
  { inicio: '2026-10-16', fim: '2026-10-31', estagios: q('FÉRIAS','BLOQUEIO','NEURO','ONCO','TORÁCICA','SRPA','UTI','APA') },
  { inicio: '2026-11-01', fim: '2026-11-15', estagios: q('NEURO','IMAGEM/BRAQUI','INFANTIL','APA','BLOQUEIO','GO/EMERG','CX GERAL','FÉRIAS') },
  { inicio: '2026-11-16', fim: '2026-11-30', estagios: q('OPTATIVO','INFANTIL','APA','TORÁCICA','FÉRIAS','CX GERAL','SRPA','ORTOPEDIA') },
  { inicio: '2026-12-01', fim: '2026-12-15', estagios: q('GO/EMERG','TORÁCICA','BLOQUEIO','NEURO','ONCO','APA','FÉRIAS','SRPA') },
  { inicio: '2026-12-16', fim: '2026-12-31', estagios: q('INFANTIL','SRPA','TORÁCICA','GO/EMERG','NEURO','CX GERAL','ORTOPEDIA','URO/PROCTO') },
  { inicio: '2027-01-01', fim: '2027-01-15', estagios: q('ONCO','FÉRIAS','ONCO','TORÁCICA','INFANTIL','ORTOPEDIA','APA','CX GERAL') },
  { inicio: '2027-01-16', fim: '2027-01-31', estagios: q('FÉRIAS','UNIMED','SRPA','NEURO','ONCO','APA','CX GERAL','ORTOPEDIA') },
  { inicio: '2027-02-01', fim: '2027-02-15', estagios: q('UNIMED','ONCO','TORÁCICA','BLOQUEIO','INFANTIL','FÉRIAS','SRPA','APA') },
  { inicio: '2027-02-16', fim: '2027-02-28', estagios: q('BLOQUEIO','NEURO','ONCO','INFANTIL','TORÁCICA','SRPA','APA','CX GERAL') },
];

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getQuinzenaParaData(date) {
  const key = toDateKey(date);
  return ROTACOES_2026.find(r => key >= r.inicio && key <= r.fim) || null;
}

/**
 * Formata o nome do estágio para exibição: cada palavra com primeira letra maiúscula.
 * Siglas específicas ("APA", "GO") permanecem maiúsculas quando aparecem como palavra inteira.
 * Ex.: "CX GERAL" → "Cx Geral", "GO/EMERG" → "GO/Emerg", "URO/PROCTO" → "Uro/Procto".
 */
const ACRONIMOS_MAIUSCULOS = new Set(['APA', 'GO']);

export function formatEstagio(s) {
  if (!s) return s;
  return s.replace(/([\p{L}]+)/gu, (word) => {
    const upper = word.toUpperCase();
    if (ACRONIMOS_MAIUSCULOS.has(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function getEstagiosParaData(date) {
  const quinzena = getQuinzenaParaData(date);
  return RESIDENTES_2026.map((r) => {
    const raw = quinzena ? (quinzena.estagios[r.id] || null) : null;
    return { ...r, estagio: raw ? formatEstagio(raw) : null };
  });
}

/**
 * Calcula o "slot efetivo" a partir do relógio atual:
 *   00:00 – 11:59 → hoje · manhã
 *   12:00 – 18:59 → hoje · tarde
 *   19:00 – 23:59 → amanhã · manhã (rollover)
 */
export function getSlotEfetivo(now = new Date()) {
  const d = new Date(now);
  const h = d.getHours();
  if (h >= 19) {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return { date: d, turno: 'manha' };
  }
  d.setHours(0, 0, 0, 0);
  return { date: d, turno: h >= 12 ? 'tarde' : 'manha' };
}

export function slotKey(slot) {
  return `${toDateKey(slot.date)}-${slot.turno}`;
}
