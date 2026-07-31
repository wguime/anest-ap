/**
 * hospitaisTecnicas2026
 * Escala automática de técnicas de enfermagem (HRO + UNIMED + Plantão Pago)
 * apenas em finais de semana e feriados.
 * Fonte: Colaboradores/Hospitais 2026.04.docx + 2026.05.docx + 2026.06.docx + ESCALA JULHO.docx + Escala 2026-08.docx
 *
 * Regras:
 *   - UNIMED (07h–15h): sábados e feriados. Domingo NÃO tem.
 *   - HRO (07h–15h): sábados, domingos, feriados.
 *   - Plantão Pago (15h–23h): sábados, domingos, feriados.
 *   - Rollover do card: sempre às 07h (antes → ontem, depois → hoje).
 *
 * Dias úteis: card continua alimentado pelos dados do Firestore (useStaff).
 */
import { toDateKey, isDiaNaoUtil, getProximoDiaUtil } from './residencia2026';

export const FUNCIONARIAS_HOSPITAIS = [
  { id: 'marta',    nome: 'Marta',    email: 'martaa0804@gmail.com' },
  { id: 'renata',   nome: 'Renata',   email: 'renatagracielalucca@gmail.com' },
  { id: 'luciana',  nome: 'Luciana',  email: 'lutona3112@hotmail.com' },
  { id: 'elisete',  nome: 'Elisete',  email: 'elibelinha3@gmail.com' },
  { id: 'saionara', nome: 'Saionara', email: 'saionararebelatto@gmail.com' },
  { id: 'mari',     nome: 'Mari',     email: 'maritania051@gmail.com' },
];

export const TURNO_MANHA      = '07:00 - 15:00';
export const TURNO_TARDE      = '15:00 - 23:00';
export const TURNO_FUNC_UNIMED = '07:00 - 19:00';

export const HOSPITAIS_2026 = {
  // Abril 2026
  '2026-04-03': { unimed: 'Renata',   hro: 'Luciana',  plantaoPago: 'Mari',     label: 'Sexta-Feira Santa' },
  '2026-04-04': { unimed: 'Mari',     hro: 'Renata',   plantaoPago: 'Luciana',  label: null },
  '2026-04-05': { unimed: null,       hro: 'Renata',   plantaoPago: 'Mari',     label: null },
  '2026-04-11': { unimed: 'Elisete',  hro: 'Luciana',  plantaoPago: 'Renata',   label: null },
  '2026-04-12': { unimed: null,       hro: 'Luciana',  plantaoPago: 'Renata',   label: null },
  '2026-04-18': { unimed: 'Elisete',  hro: 'Mari',     plantaoPago: 'Saionara', label: null },
  '2026-04-19': { unimed: null,       hro: 'Saionara', plantaoPago: 'Mari',     label: null },
  '2026-04-21': { unimed: 'Saionara', hro: 'Elisete',  plantaoPago: 'Luciana',  label: 'Tiradentes' },
  '2026-04-25': { unimed: 'Saionara', hro: 'Elisete',  plantaoPago: 'Marta',    label: null },
  '2026-04-26': { unimed: null,       hro: 'Marta',    plantaoPago: 'Saionara', label: null },
  // Maio 2026
  '2026-05-01': { unimed: 'Saionara', hro: 'Elisete',  plantaoPago: 'Mari',     label: 'Dia do Trabalho' },
  '2026-05-02': { unimed: 'Mari',     hro: 'Elisete',  plantaoPago: 'Saionara', label: null },
  '2026-05-03': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Saionara', label: null },
  '2026-05-09': { unimed: 'Renata',   hro: 'Marta',    plantaoPago: 'Luciana',  label: null },
  '2026-05-10': { unimed: null,       hro: 'Marta',    plantaoPago: 'Luciana',  label: null },
  '2026-05-16': { unimed: 'Marta',    hro: 'Mari',     plantaoPago: 'Luciana',  label: null },
  '2026-05-17': { unimed: null,       hro: 'Luciana',  plantaoPago: 'Mari',     label: null },
  '2026-05-23': { unimed: 'Luciana',  hro: 'Saionara', plantaoPago: 'Renata',   label: null },
  '2026-05-24': { unimed: null,       hro: 'Renata',   plantaoPago: 'Saionara', label: null },
  '2026-05-30': { unimed: 'Elisete',  hro: 'Renata',   plantaoPago: 'Mari',     label: null },
  '2026-05-31': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Renata',   label: null },
  // Junho 2026
  '2026-06-04': { unimed: 'Elisete',  hro: 'Luciana',  plantaoPago: 'Renata',   label: 'Corpus Christi' },
  '2026-06-06': { unimed: 'Luciana',  hro: 'Elisete',  plantaoPago: 'Renata',   label: null },
  '2026-06-07': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Renata',   label: null },
  '2026-06-13': { unimed: 'Mari',     hro: 'Luciana',  plantaoPago: 'Renata',   label: null },
  '2026-06-14': { unimed: null,       hro: 'Luciana',  plantaoPago: 'Mari',     label: null },
  '2026-06-20': { unimed: 'Saionara', hro: 'Elisete',  plantaoPago: 'Marta',    label: null },
  '2026-06-21': { unimed: null,       hro: 'Marta',    plantaoPago: 'Saionara', label: null },
  '2026-06-27': { unimed: 'Elisete',  hro: 'Mari',     plantaoPago: 'Saionara', label: null },
  '2026-06-28': { unimed: null,       hro: 'Saionara', plantaoPago: 'Mari',     label: null },
  // Julho 2026
  '2026-07-04': { unimed: 'Luciana',  hro: 'Elisete',  plantaoPago: 'Saionara', label: null },
  '2026-07-05': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Luciana',  label: null },
  '2026-07-11': { unimed: 'Mari',     hro: 'Luciana',  plantaoPago: 'Renata',   label: null },
  '2026-07-12': { unimed: null,       hro: 'Renata',   plantaoPago: 'Mari',     label: null },
  '2026-07-18': { unimed: 'Marta',    hro: 'Mari',     plantaoPago: 'Saionara', label: null },
  '2026-07-19': { unimed: null,       hro: 'Marta',    plantaoPago: 'Saionara', label: null },
  '2026-07-25': { unimed: 'Elisete',  hro: 'Renata',   plantaoPago: 'Luciana',  label: null },
  '2026-07-26': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Renata',   label: null },
  '2026-08-01': { unimed: 'Elisete',  hro: 'Saionara', plantaoPago: 'Luciana',  label: null },
  '2026-08-02': { unimed: null,       hro: 'Luciana',  plantaoPago: 'Saionara', label: null },
  '2026-08-08': { unimed: 'Mari',     hro: 'Renata',   plantaoPago: 'Saionara', label: null },
  '2026-08-09': { unimed: null,       hro: 'Saionara', plantaoPago: 'Mari',     label: null },
  '2026-08-15': { unimed: 'Renata',   hro: 'Elisete',  plantaoPago: 'Marta',    label: null },
  '2026-08-16': { unimed: null,       hro: 'Marta',    plantaoPago: 'Renata',   label: null },
  '2026-08-22': { unimed: 'Mari',     hro: 'Luciana',  plantaoPago: 'Renata',   label: null },
  '2026-08-23': { unimed: null,       hro: 'Renata',   plantaoPago: 'Mari',     label: null },
  '2026-08-25': { unimed: 'Renata',   hro: 'Elisete',  plantaoPago: 'Luciana',  label: 'DIA DO MUNICÍPIO' },
  '2026-08-29': { unimed: 'Elisete',  hro: 'Mari',     plantaoPago: 'Luciana',  label: null },
  '2026-08-30': { unimed: null,       hro: 'Elisete',  plantaoPago: 'Luciana',  label: null },
};

// ---------------------------------------------------------------------------
// Base ativa: estático (histórico congelado) + meses publicados no Firestore
// (escalasFuncionarias/{YYYY-MM}) por cima — mês publicado SUBSTITUI o mês
// inteiro do estático. Alimentada pelo EscalasFuncionariasBaseContext.
// ---------------------------------------------------------------------------
let BASE_ATIVA = HOSPITAIS_2026;

/** @param {Object} mesesFirestore — { 'YYYY-MM': { 'YYYY-MM-DD': {unimed,hro,plantaoPago,label} } } */
export function setHospitaisBaseDinamica(mesesFirestore = {}) {
  const merged = { ...HOSPITAIS_2026 };
  for (const [mes, dados] of Object.entries(mesesFirestore)) {
    for (const key of Object.keys(merged)) {
      if (key.startsWith(mes)) delete merged[key];
    }
    Object.assign(merged, dados || {});
  }
  BASE_ATIVA = merged;
}

export function getHospitaisBase() {
  return BASE_ATIVA;
}

export function getHospitaisEfetivo(now = new Date(), feriadosSet = null) {
  // Card roda 00:00–17:59 = hoje / 18:00–23:59 = amanhã.
  // Em FDS/feriados (quando feriadosSet é informado), avança até o próximo dia útil.
  const d = new Date(now);
  if (d.getHours() >= 18) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  if (feriadosSet && isDiaNaoUtil(d, feriadosSet)) {
    return getProximoDiaUtil(d, feriadosSet);
  }
  return d;
}

export function getHospitaisParaData(date) {
  const key = toDateKey(date);
  const entry = BASE_ATIVA[key];
  if (!entry) return null;
  return { ...entry, data: key };
}

/** Retorna true se a data tem escala automática cadastrada (FDS ou feriado). */
export function isDiaAutomaticoHospitais(date) {
  return !!BASE_ATIVA[toDateKey(date)];
}

/**
 * Aplica overrides da coleção `hospitaisDiario` sobre a escala base.
 * @param {Date} date
 * @param {Object} overrides — mapa { '{data}_{hospital}_{turno}': funcionariaId }
 * @returns {Object|null} entry com nomes finais das funcionárias por slot
 */
const HOSPITAL_TO_FIELD = { hro: 'hro', unimed: 'unimed', plantao_pago: 'plantaoPago' };
const FIELD_TO_HOSPITAL = { hro: 'hro', unimed: 'unimed', plantaoPago: 'plantao_pago' };
const FIELD_TO_TURNO = { hro: 'manha', unimed: 'manha', plantaoPago: 'tarde' };

export function getHospitaisEfetivos(date, overrides = {}) {
  const base = getHospitaisParaData(date);
  if (!base) return null;
  const result = { ...base };
  ['hro', 'unimed', 'plantaoPago'].forEach((field) => {
    const hospital = FIELD_TO_HOSPITAL[field];
    const turno = FIELD_TO_TURNO[field];
    const overrideId = overrides[`${base.data}_${hospital}_${turno}`];
    if (overrideId) {
      const f = FUNCIONARIAS_HOSPITAIS.find((x) => x.id === overrideId);
      if (f) result[field] = f.nome;
    }
  });
  return result;
}

export { HOSPITAL_TO_FIELD, FIELD_TO_HOSPITAL, FIELD_TO_TURNO };

/**
 * Retorna lista de slots em que a funcionária está escalada na data informada.
 * Considera overrides de hospitaisDiario sobre a escala base.
 * @returns {Array<{hospital: 'hro'|'unimed'|'plantao_pago', turno: 'manha'|'tarde'}>}
 */
export function getSlotsFuncionariaNaData(funcionariaId, dateKey, overrides = {}) {
  const escala = BASE_ATIVA[dateKey];
  if (!escala) return [];
  const nome = FUNCIONARIAS_HOSPITAIS.find((f) => f.id === funcionariaId)?.nome;
  if (!nome) return [];
  const slots = [];
  ['hro', 'unimed', 'plantaoPago'].forEach((field) => {
    const hospital = FIELD_TO_HOSPITAL[field];
    const turno = FIELD_TO_TURNO[field];
    const overrideId = overrides[`${dateKey}_${hospital}_${turno}`];
    const escaladoId = overrideId
      || FUNCIONARIAS_HOSPITAIS.find((f) => f.nome === escala[field])?.id;
    if (escaladoId === funcionariaId) {
      slots.push({ hospital, turno });
    }
  });
  return slots;
}

/**
 * Lista todas as datas (futuras a partir de fromDateKey) em que a funcionária
 * está escalada em algum slot hospitalar, considerando overrides.
 */
export function getDatasDaFuncionariaHospitais(funcionariaId, fromDateKey, overrides = {}) {
  if (!funcionariaId) return [];
  return Object.keys(BASE_ATIVA)
    .filter((key) => key >= fromDateKey && getSlotsFuncionariaNaData(funcionariaId, key, overrides).length > 0)
    .sort();
}
