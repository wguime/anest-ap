/**
 * residencia2026
 * Tabela estática da rotação de residentes em 2026 (01/mar/2026 → 28/fev/2027).
 * Fonte: Residentes/2026 Estágios.pdf
 */

export const RESIDENTES_2026 = [
  { id: 'r1-augusto',   nome: 'Augusto',   ano: 'R1', email: 'augusto.mombelli@gmail.com' },
  { id: 'r1-guilherme', nome: 'Guilherme', ano: 'R1', email: 'guilherme.d.trentin@gmail.com' },
  { id: 'r1-roosewelt', nome: 'Roosewelt', ano: 'R1', email: 'roosewelt_1996@hotmail.com' },
  { id: 'r2-daniel',    nome: 'Daniel',    ano: 'R2', email: 'danielffk99@gmail.com' },
  { id: 'r2-jacinta',   nome: 'Jacinta',   ano: 'R2', email: 'jacinta.goergen@gmail.com' },
  { id: 'r2-rodrigo',   nome: 'Rodrigo',   ano: 'R2', email: 'rodrigomeireleslopes@gmail.com' },
  { id: 'r3-raffaela',  nome: 'Raffaela',  ano: 'R3', email: 'raffanehls@gmail.com' },
  { id: 'r3-wagner',    nome: 'Wagner',    ano: 'R3', email: 'wagnermissio@hotmail.com' },
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
 * Siglas específicas ("APA", "GO", "UTI") permanecem maiúsculas quando aparecem como palavra inteira.
 * Ex.: "CX GERAL" → "Cx Geral", "GO/EMERG" → "GO/Emerg", "URO/PROCTO" → "Uro/Procto".
 */
const ACRONIMOS_MAIUSCULOS = new Set(['APA', 'GO', 'UTI']);

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
 *   00:00 – 10:59 → hoje · manhã
 *   11:00 – 17:59 → hoje · tarde
 *   18:00 – 23:59 → amanhã · manhã (rollover)
 *
 * Quando `feriadosSet` é fornecido e o dia resultante for não-útil
 * (sábado, domingo ou feriado), o slot avança para o próximo dia útil
 * com turno 'manha' — válido durante todo o dia não-útil.
 */
export function getSlotEfetivo(now = new Date(), feriadosSet = null) {
  const d = new Date(now);
  const h = d.getHours();
  let candidate;
  let turno;
  if (h >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    candidate = d;
    turno = 'manha';
  } else {
    d.setHours(0, 0, 0, 0);
    candidate = d;
    turno = h >= 11 ? 'tarde' : 'manha';
  }
  if (feriadosSet && isDiaNaoUtil(candidate, feriadosSet)) {
    return { date: getProximoDiaUtil(candidate, feriadosSet), turno: 'manha' };
  }
  return { date: candidate, turno };
}

/**
 * Data "do dia seguinte a partir das 18h" — usado pelos cards de escalas
 * (Estágios, Técnicas de Enfermagem, Secretárias) que mostram a escala do
 * dia corrente até 17:59 e a do próximo dia de 18:00 em diante.
 *
 * Quando `feriadosSet` é fornecido e a data resultante for não-útil,
 * avança para o próximo dia útil.
 */
export function getEscalaCardDate(now = new Date(), feriadosSet = null) {
  const d = new Date(now);
  if (d.getHours() >= 18) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  if (feriadosSet && isDiaNaoUtil(d, feriadosSet)) {
    return getProximoDiaUtil(d, feriadosSet);
  }
  return d;
}

/**
 * Retorna o próximo dia útil a partir de `dateInput` (inclusive).
 * Se o dia já é útil, retorna ele mesmo (à meia-noite).
 */
export function getProximoDiaUtil(dateInput, feriadosSet) {
  const d = dateInput instanceof Date
    ? new Date(dateInput)
    : new Date(`${dateInput}T12:00:00`);
  d.setHours(0, 0, 0, 0);
  while (isDiaNaoUtil(d, feriadosSet)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Verdadeiro quando a data (já efetiva para o card, pós-rollover 18h) é
 * sábado, domingo ou feriado. Usado para ocultar os cards "Estágios
 * Residência" e "Secretárias" em dias sem expediente.
 *
 * @param {string|Date} dateInput — dateKey 'YYYY-MM-DD' ou Date.
 * @param {Set<string>} feriadosSet — ex.: FERIADOS_2026 de plantao2026.js.
 */
export function isDiaNaoUtil(dateInput, feriadosSet) {
  if (!dateInput) return false;
  const key = typeof dateInput === 'string' ? dateInput : toDateKey(dateInput);
  const d = typeof dateInput === 'string'
    ? new Date(`${dateInput}T12:00:00`)
    : dateInput instanceof Date ? dateInput : new Date(dateInput);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true;
  if (feriadosSet && feriadosSet.has && feriadosSet.has(key)) return true;
  return false;
}

export function slotKey(slot) {
  return `${toDateKey(slot.date)}-${slot.turno}`;
}
