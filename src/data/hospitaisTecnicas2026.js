/**
 * hospitaisTecnicas2026
 * Escala automática de técnicas de enfermagem (HRO + UNIMED + Plantão Pago)
 * apenas em finais de semana e feriados.
 * Fonte: Colaboradores/Hospitais 2026.04.docx + 2026.05.docx
 *
 * Regras:
 *   - UNIMED (07h–15h): sábados e feriados. Domingo NÃO tem.
 *   - HRO (07h–15h): sábados, domingos, feriados.
 *   - Plantão Pago (15h–23h): sábados, domingos, feriados.
 *   - Rollover do card: sempre às 07h (antes → ontem, depois → hoje).
 *
 * Dias úteis: card continua alimentado pelos dados do Firestore (useStaff).
 */
import { toDateKey } from './residencia2026';

export const FUNCIONARIAS_HOSPITAIS = [
  { id: 'marta',    nome: 'Marta' },
  { id: 'renata',   nome: 'Renata' },
  { id: 'luciana',  nome: 'Luciana' },
  { id: 'elisete',  nome: 'Elisete' },
  { id: 'saionara', nome: 'Saionara' },
  { id: 'mari',     nome: 'Mari' },
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
};

export function getHospitaisEfetivo(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 7) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getHospitaisParaData(date) {
  const key = toDateKey(date);
  const entry = HOSPITAIS_2026[key];
  if (!entry) return null;
  return { ...entry, data: key };
}

/** Retorna true se a data tem escala automática cadastrada (FDS ou feriado). */
export function isDiaAutomaticoHospitais(date) {
  return !!HOSPITAIS_2026[toDateKey(date)];
}
