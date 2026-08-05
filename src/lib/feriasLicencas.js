/**
 * Licenças que o Comitê de Ética aplica sobre as férias (dono 05/08).
 *
 * MATERNIDADE: 120 dias corridos e a cota do ano vigente cai para 20 dias
 * úteis. Não é calculada aqui — é um ajuste de cota que o Comitê registra.
 *
 * PATERNIDADE: o dia do parto e o dia seguinte; caindo em fim de semana ou
 * feriado, apenas o primeiro dia útil subsequente.
 *
 * ⚠️ Interpretação da regra (confirmar com o dono se divergir): a licença
 * cobre os dias ÚTEIS entre o parto e o dia seguinte — parto na terça rende
 * terça+quarta, parto na sexta rende só a sexta (sábado o pai já não
 * trabalharia). Quando NENHUM dos dois é útil (parto no sábado, ou em feriado
 * emendado), cai na segunda parte da regra e rende um único dia: o primeiro
 * dia útil subsequente.
 */

import { ehFimDeSemana } from './extratoFerias'

/** Soma dias a uma data ISO (meio-dia UTC evita virada por fuso). */
function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Dia útil = não é fim de semana nem feriado do grupo. */
export function ehDiaUtil(iso, feriados = new Set()) {
  return !ehFimDeSemana(iso) && !feriados.has(iso)
}

/**
 * Dias de licença-paternidade a partir da data do parto.
 *
 * @param {object} args
 * @param {string} args.dataParto ISO (YYYY-MM-DD)
 * @param {Set<string>} [args.feriados] feriados do grupo no ano
 * @returns {string[]} datas ISO em ordem (1 ou 2 dias)
 */
export function diasLicencaPaternidade({ dataParto, feriados = new Set() }) {
  if (!dataParto || !/^\d{4}-\d{2}-\d{2}$/.test(dataParto)) return []

  const candidatos = [dataParto, somarDias(dataParto, 1)]
  const uteis = candidatos.filter((d) => ehDiaUtil(d, feriados))
  if (uteis.length > 0) return uteis

  // Parto em fim de semana/feriado (e o dia seguinte também): a regra dá
  // apenas o primeiro dia útil subsequente.
  let d = somarDias(dataParto, 1)
  // Guarda contra feriados encadeados mal cadastrados — 14 dias já cobre
  // qualquer emenda real e evita laço infinito se `feriados` vier poluído.
  for (let i = 0; i < 14; i++) {
    if (ehDiaUtil(d, feriados)) return [d]
    d = somarDias(d, 1)
  }
  return []
}

/** Cota do ano em que a pessoa teve licença-maternidade (regra do grupo). */
export const COTA_LICENCA_MATERNIDADE = 20
