/**
 * sobreavisoMaterno2026
 * Escala de sobreaviso materno 01/abr/2026 → 31/ago/2026 (153 dias).
 * Fonte: Colaboradores/Sobreaviso materno 2026.04.docx + 2026.05.docx + 2026.06.docx + JULHO SOBREAVISO HC.docx + Escala 2026-08.docx
 *
 * Regra de sobreaviso:
 *   - Sempre 12h, das 19h às 07h do dia seguinte.
 *   - Rollover do card: sempre às 07h (antes → ontem, depois → hoje).
 */
import { toDateKey } from './residencia2026';

export const FUNCIONARIAS_SOBREAVISO = [
  { id: 'marta',    nome: 'Marta',    cargo: 'Enfermeira',           email: 'martaa0804@gmail.com' },
  { id: 'renata',   nome: 'Renata',   cargo: 'Enfermeira',           email: 'renatagracielalucca@gmail.com' },
  { id: 'luciana',  nome: 'Luciana',  cargo: 'Enfermeira',           email: 'lutona3112@hotmail.com' },
  { id: 'elisete',  nome: 'Elisete',  cargo: 'Enfermeira',           email: 'elibelinha3@gmail.com' },
  { id: 'saionara', nome: 'Saionara', cargo: 'Enfermeira',           email: 'saionararebelatto@gmail.com' },
  { id: 'mari',     nome: 'Mari',     cargo: 'Técnica de Enfermagem', email: 'maritania051@gmail.com' },
];

export const SOBREAVISO_MATERNO_2026 = {
  // Abril 2026
  '2026-04-01': 'marta',
  '2026-04-02': 'renata',
  '2026-04-03': 'luciana',
  '2026-04-04': 'renata',
  '2026-04-05': 'elisete',
  '2026-04-06': 'marta',
  '2026-04-07': 'luciana',
  '2026-04-08': 'marta',
  '2026-04-09': 'renata',
  '2026-04-10': 'renata',
  '2026-04-11': 'elisete',
  '2026-04-12': 'elisete',
  '2026-04-13': 'saionara',
  '2026-04-14': 'marta',
  '2026-04-15': 'renata',
  '2026-04-16': 'luciana',
  '2026-04-17': 'marta',
  '2026-04-18': 'saionara',
  '2026-04-19': 'elisete',
  '2026-04-20': 'saionara',
  '2026-04-21': 'elisete',
  '2026-04-22': 'luciana',
  '2026-04-23': 'saionara',
  '2026-04-24': 'marta',
  '2026-04-25': 'elisete',
  '2026-04-26': 'luciana',
  '2026-04-27': 'saionara',
  '2026-04-28': 'luciana',
  '2026-04-29': 'saionara',
  '2026-04-30': 'renata',
  // Maio 2026
  '2026-05-01': 'saionara',
  '2026-05-02': 'elisete',
  '2026-05-03': 'elisete',
  '2026-05-04': 'renata',
  '2026-05-05': 'saionara',
  '2026-05-06': 'luciana',
  '2026-05-07': 'renata',
  '2026-05-08': 'marta',
  '2026-05-09': 'renata',
  '2026-05-10': 'elisete',
  '2026-05-11': 'luciana',
  '2026-05-12': 'marta',
  '2026-05-13': 'saionara',
  '2026-05-14': 'marta',
  '2026-05-15': 'luciana',
  '2026-05-16': 'marta',
  '2026-05-17': 'elisete',
  '2026-05-18': 'marta',
  '2026-05-19': 'renata',
  '2026-05-20': 'saionara',
  '2026-05-21': 'luciana',
  '2026-05-22': 'renata',
  '2026-05-23': 'saionara',
  '2026-05-24': 'elisete',
  '2026-05-25': 'marta',
  '2026-05-26': 'luciana',
  '2026-05-27': 'renata',
  '2026-05-28': 'saionara',
  '2026-05-29': 'luciana',
  '2026-05-30': 'elisete',
  '2026-05-31': 'elisete',
  // Junho 2026
  '2026-06-01': 'saionara',
  '2026-06-02': 'marta',
  '2026-06-03': 'luciana',
  '2026-06-04': 'elisete',
  '2026-06-05': 'renata',
  '2026-06-06': 'elisete',
  '2026-06-07': 'elisete',
  '2026-06-08': 'marta',
  '2026-06-09': 'luciana',
  '2026-06-10': 'renata',
  '2026-06-11': 'saionara',
  '2026-06-12': 'renata',
  '2026-06-13': 'luciana',
  '2026-06-14': 'elisete',
  '2026-06-15': 'renata',
  '2026-06-16': 'saionara',
  '2026-06-17': 'marta',
  '2026-06-18': 'luciana',
  '2026-06-19': 'saionara',
  '2026-06-20': 'elisete',
  '2026-06-21': 'marta',
  '2026-06-22': 'marta',
  '2026-06-23': 'luciana',
  '2026-06-24': 'renata',
  '2026-06-25': 'saionara',
  '2026-06-26': 'marta',
  '2026-06-27': 'elisete',
  '2026-06-28': 'saionara',
  '2026-06-29': 'renata',
  '2026-06-30': 'luciana',
  // Julho 2026
  '2026-07-01': 'renata',
  '2026-07-02': 'saionara',
  '2026-07-03': 'luciana',
  '2026-07-04': 'elisete',
  '2026-07-05': 'elisete',
  '2026-07-06': 'marta',
  '2026-07-07': 'saionara',
  '2026-07-08': 'luciana',
  '2026-07-09': 'renata',
  '2026-07-10': 'saionara',
  '2026-07-11': 'luciana',
  '2026-07-12': 'elisete',
  '2026-07-13': 'marta',
  '2026-07-14': 'luciana',
  '2026-07-15': 'renata',
  '2026-07-16': 'saionara',
  '2026-07-17': 'luciana',
  '2026-07-18': 'marta',
  '2026-07-19': 'elisete',
  '2026-07-20': 'saionara',
  '2026-07-21': 'renata',
  '2026-07-22': 'marta',
  '2026-07-23': 'luciana',
  '2026-07-24': 'renata',
  '2026-07-25': 'elisete',
  '2026-07-26': 'elisete',
  '2026-07-27': 'marta',
  '2026-07-28': 'luciana',
  '2026-07-29': 'renata',
  '2026-07-30': 'saionara',
  '2026-07-31': 'marta',
  '2026-08-01': 'elisete',
  '2026-08-02': 'elisete',
  '2026-08-03': 'saionara',
  '2026-08-04': 'saionara',
  '2026-08-05': 'luciana',
  '2026-08-06': 'marta',
  '2026-08-07': 'saionara',
  '2026-08-08': 'renata',
  '2026-08-09': 'elisete',
  '2026-08-10': 'saionara',
  '2026-08-11': 'saionara',
  '2026-08-12': 'luciana',
  '2026-08-13': 'saionara',
  '2026-08-14': 'luciana',
  '2026-08-15': 'renata',
  '2026-08-16': 'elisete',
  '2026-08-17': 'marta',
  '2026-08-18': 'luciana',
  '2026-08-19': 'renata',
  '2026-08-20': 'marta',
  '2026-08-21': 'renata',
  '2026-08-22': 'luciana',
  '2026-08-23': 'renata',
  '2026-08-24': 'luciana',
  '2026-08-25': 'renata',
  '2026-08-26': 'marta',
  '2026-08-27': 'renata',
  '2026-08-28': 'marta',
  '2026-08-29': 'elisete',
  '2026-08-30': 'elisete',
  '2026-08-31': 'marta',
};

// ---------------------------------------------------------------------------
// Base ativa: estático (histórico congelado) + meses publicados no Firestore
// (escalasFuncionarias/{YYYY-MM}) por cima — mês publicado SUBSTITUI o mês
// inteiro do estático (permite remoções; nada "vaza" de um doc parcial).
// Alimentada pelo EscalasFuncionariasBaseContext; sem provider (testes/functions
// fora do app) permanece = estático.
// ---------------------------------------------------------------------------
let BASE_ATIVA = SOBREAVISO_MATERNO_2026;

/** @param {Object} mesesFirestore — { 'YYYY-MM': { 'YYYY-MM-DD': funcionariaId } } */
export function setSobreavisoBaseDinamica(mesesFirestore = {}) {
  const merged = { ...SOBREAVISO_MATERNO_2026 };
  for (const [mes, dados] of Object.entries(mesesFirestore)) {
    for (const key of Object.keys(merged)) {
      if (key.startsWith(mes)) delete merged[key];
    }
    Object.assign(merged, dados || {});
  }
  BASE_ATIVA = merged;
}

export function getSobreavisoBase() {
  return BASE_ATIVA;
}

export function getHorarioSobreaviso() {
  return { inicio: '19:00', fim: '07:00', duracao: 12 };
}

export function getSobreavisoEfetivo(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 7) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getFuncionariaById(id) {
  if (!id) return null;
  return FUNCIONARIAS_SOBREAVISO.find((f) => f.id === id) || null;
}

export function getSobreavisoParaData(date) {
  const key = toDateKey(date);
  const funcionariaId = BASE_ATIVA[key];
  if (!funcionariaId) return null;
  const f = getFuncionariaById(funcionariaId);
  if (!f) return null;
  return { ...f, data: key, horario: getHorarioSobreaviso() };
}

/**
 * Lista todas as datas (a partir de fromDateKey) em que a funcionária está
 * escalada para sobreaviso, aplicando overrides de sobreavisoMaternoDiario.
 */
export function getDatasDaSobreavisista(funcionariaId, fromDateKey, overrides = {}) {
  if (!funcionariaId) return [];
  return Object.keys(BASE_ATIVA)
    .filter((key) => {
      if (key < fromDateKey) return false;
      const escaladoId = overrides[key] || BASE_ATIVA[key];
      return escaladoId === funcionariaId;
    })
    .sort();
}
