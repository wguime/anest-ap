/**
 * Helpers de calendário das telas Escala Numérica e Feriados.
 *
 * Moram fora dos componentes por dois motivos: o Fast Refresh do Vite só funciona em arquivo
 * que exporta SÓ componentes, e a página de Feriados precisava de `paraISO` sem importar a
 * outra página (import de página para página é acoplamento que ninguém quer manter).
 */

/** Data local → 'AAAA-MM-DD' sem passar por UTC (toISOString desloca o dia no fuso -03). */
export const paraISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const DIA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** 'AAAA-MM-DD' → 'dd/mm'. */
export const paraBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Feriados do dataset em ordem de data, com o dia da semana e se já passaram. */
export function listarFeriados(dados, hojeISO) {
  return Object.entries(dados?.feriados?.dias || {})
    .map(([data, f]) => ({
      data,
      nome: f.nome,
      br: paraBr(data),
      diaSemana: DIA_LONGO[new Date(`${data}T12:00:00`).getDay()],
      passado: data < hojeISO,
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}
