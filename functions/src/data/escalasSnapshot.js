/**
 * Escalas Snapshot — FROZEN (fallback histórico até ago/2026).
 *
 * Desde ago/2026 os meses novos são publicados pelo import in-app na coleção
 * Firestore `escalasFuncionarias/{YYYY-MM}` — escalaReminders.js carrega essa
 * coleção por cima deste snapshot (loadEscalaBase), então NÃO sincronizar mais
 * escalas aqui. As listas FUNCIONARIAS_* (emails p/ mapear uid) continuam em
 * uso; mudou funcionária = atualizar aqui E no client. O snapshot de escalas
 * fica inerte assim que o cron só consultar datas >= set/2026 (removível num
 * cleanup futuro).
 */

const FUNCIONARIAS_SOBREAVISO = [
  { id: 'marta',    nome: 'Marta',    email: 'martaa0804@gmail.com' },
  { id: 'renata',   nome: 'Renata',   email: 'renatagracielalucca@gmail.com' },
  { id: 'luciana',  nome: 'Luciana',  email: 'lutona3112@hotmail.com' },
  { id: 'elisete',  nome: 'Elisete',  email: 'elibelinha3@gmail.com' },
  { id: 'saionara', nome: 'Saionara', email: 'saionararebelatto@gmail.com' },
  { id: 'mari',     nome: 'Mari',     email: 'maritania051@gmail.com' },
];

const FUNCIONARIAS_HOSPITAIS = [
  { id: 'marta',    nome: 'Marta',    email: 'martaa0804@gmail.com' },
  { id: 'renata',   nome: 'Renata',   email: 'renatagracielalucca@gmail.com' },
  { id: 'luciana',  nome: 'Luciana',  email: 'lutona3112@hotmail.com' },
  { id: 'elisete',  nome: 'Elisete',  email: 'elibelinha3@gmail.com' },
  { id: 'saionara', nome: 'Saionara', email: 'saionararebelatto@gmail.com' },
  { id: 'mari',     nome: 'Mari',     email: 'maritania051@gmail.com' },
];

const SOBREAVISO_MATERNO_2026 = {
  '2026-04-01': 'marta',    '2026-04-02': 'renata',   '2026-04-03': 'luciana',
  '2026-04-04': 'renata',   '2026-04-05': 'elisete',  '2026-04-06': 'marta',
  '2026-04-07': 'luciana',  '2026-04-08': 'marta',    '2026-04-09': 'renata',
  '2026-04-10': 'renata',   '2026-04-11': 'elisete',  '2026-04-12': 'elisete',
  '2026-04-13': 'saionara', '2026-04-14': 'marta',    '2026-04-15': 'renata',
  '2026-04-16': 'luciana',  '2026-04-17': 'marta',    '2026-04-18': 'saionara',
  '2026-04-19': 'elisete',  '2026-04-20': 'saionara', '2026-04-21': 'elisete',
  '2026-04-22': 'luciana',  '2026-04-23': 'saionara', '2026-04-24': 'marta',
  '2026-04-25': 'elisete',  '2026-04-26': 'luciana',  '2026-04-27': 'saionara',
  '2026-04-28': 'luciana',  '2026-04-29': 'saionara', '2026-04-30': 'renata',
  '2026-05-01': 'saionara', '2026-05-02': 'elisete',  '2026-05-03': 'elisete',
  '2026-05-04': 'renata',   '2026-05-05': 'saionara', '2026-05-06': 'luciana',
  '2026-05-07': 'renata',   '2026-05-08': 'marta',    '2026-05-09': 'renata',
  '2026-05-10': 'elisete',  '2026-05-11': 'luciana',  '2026-05-12': 'marta',
  '2026-05-13': 'saionara', '2026-05-14': 'marta',    '2026-05-15': 'luciana',
  '2026-05-16': 'marta',    '2026-05-17': 'elisete',  '2026-05-18': 'marta',
  '2026-05-19': 'renata',   '2026-05-20': 'saionara', '2026-05-21': 'luciana',
  '2026-05-22': 'renata',   '2026-05-23': 'saionara', '2026-05-24': 'elisete',
  '2026-05-25': 'marta',    '2026-05-26': 'luciana',  '2026-05-27': 'renata',
  '2026-05-28': 'saionara', '2026-05-29': 'luciana',  '2026-05-30': 'elisete',
  '2026-05-31': 'elisete',
};

// Escala automática FDS/feriados (HRO + UNIMED + Plantão Pago)
const HOSPITAIS_2026 = {
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
};

const HOSPITAL_FIELD_TO_KEY = { hro: 'hro', unimed: 'unimed', plantaoPago: 'plantao_pago' };
const HOSPITAL_FIELD_TO_TURNO = { hro: 'manha', unimed: 'manha', plantaoPago: 'tarde' };

module.exports = {
  FUNCIONARIAS_SOBREAVISO,
  FUNCIONARIAS_HOSPITAIS,
  SOBREAVISO_MATERNO_2026,
  HOSPITAIS_2026,
  HOSPITAL_FIELD_TO_KEY,
  HOSPITAL_FIELD_TO_TURNO,
};
