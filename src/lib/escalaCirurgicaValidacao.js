/**
 * Espelho, no cliente, das regras que o BANCO recusa ao publicar a escala cirúrgica.
 *
 * Até 02/09 o banco era o único guardião: um paciente com três letras seguidas derrubava o
 * INSERT do hospital inteiro, no meio da publicação em lote, com uma mensagem que não dizia
 * qual linha. A conferência existe para consertar o que a leitura trouxe torto — então ela
 * precisa conhecer a regra ANTES, e apontar a sala e o caso.
 *
 * Puro e sem React: as mesmas funções valem na aba, no portão do `publicar()` e nos testes.
 * Cada regra aqui tem um CHECK correspondente na migration citada — mudou lá, muda aqui.
 */

import { ehIniciaisAceitas, INICIAIS_MAX } from './escalaCirurgicaPaciente'

/** `20260729210000_escala_caso_termino_previsto.sql` — "HH:MM" ou vazio. */
const TERMINO_OK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
/** `20260628200000_escala_cirurgica.sql` — tipo da cirurgia. */
export const TIPOS_CASO = ['eletiva', 'urgencia', 'emergencia']
/** `20260818140000_escala_caso_gravidade.sql` — gravidade da urgência (ou vazia). */
export const GRAVIDADES_CASO = ['imediata', 'urgente', 'aguarda']

const txt = (v) => String(v ?? '').trim()

/** Rótulo curto do caso para a mensagem: "CC - Sala 5 · 2º caso". */
export function rotuloDoCaso(caso, indiceNaSala) {
  const sala = txt(caso?.sala) || 'sem sala'
  return indiceNaSala > 0 ? `${sala} · ${indiceNaSala + 1}º caso` : sala
}

/**
 * O que o banco recusaria neste caso. `horaValida` decide se a hora entra na conta — quem
 * chama passa a mesma função que a página já usa (`turnoDeHora`), para não duplicar a regra
 * de "AS/A seguir" nem o formato aceito.
 */
export function validarCasoParaPublicacao(caso, { horaValida } = {}) {
  const erros = []
  const iniciais = txt(caso?.pacienteIniciais)
  if (!ehIniciaisAceitas(iniciais)) {
    // "nome em vez de iniciais" vem primeiro mesmo quando o valor também estoura o tamanho:
    // é a correção que a pessoa precisa fazer ("MARIA DA SILVA" é as duas coisas).
    erros.push({
      campo: 'pacienteIniciais',
      motivo: /\p{L}{3,}/u.test(iniciais)
        ? 'paciente com nome em vez de iniciais'
        : `paciente com mais de ${INICIAIS_MAX} caracteres`,
    })
  }
  const termino = txt(caso?.terminoPrevisto)
  if (termino && !TERMINO_OK.test(termino)) erros.push({ campo: 'terminoPrevisto', motivo: 'término previsto fora de HH:MM' })
  const tipo = txt(caso?.tipo)
  if (tipo && !TIPOS_CASO.includes(tipo)) erros.push({ campo: 'tipo', motivo: `tipo "${tipo}" não existe` })
  const gravidade = txt(caso?.gravidade)
  if (gravidade && !GRAVIDADES_CASO.includes(gravidade)) erros.push({ campo: 'gravidade', motivo: `gravidade "${gravidade}" não existe` })
  const hora = txt(caso?.hora)
  if (hora && typeof horaValida === 'function' && !horaValida(hora)) {
    erros.push({ campo: 'hora', motivo: `hora "${hora}" não é um horário` })
  }
  return erros
}

/**
 * Varre a lista já EDITADA (não a leitura original — foi assim que a hora corrigida na tela
 * não destravava o publicar) e devolve um bloqueio por campo, com o endereço do caso.
 */
export function validarCasosParaPublicacao(casos, opts = {}) {
  const porSala = new Map()
  const bloqueios = []
  ;(casos || []).forEach((caso, indice) => {
    const sala = txt(caso?.sala)
    const naSala = porSala.get(sala) ?? 0
    porSala.set(sala, naSala + 1)
    for (const e of validarCasoParaPublicacao(caso, opts)) {
      bloqueios.push({ ...e, indice, sala, indiceNaSala: naSala, onde: rotuloDoCaso(caso, naSala) })
    }
  })
  return bloqueios
}

/** Uma linha por bloqueio, no formato que a conferência e a folha mostram. */
export const textoBloqueio = (b) => `${b.onde}: ${b.motivo}`

/**
 * Resumo para o placar da aba: quantos e a primeira frase.
 * Sem bloqueio nenhum devolve `{ total: 0 }` — a aba segue como está.
 */
export function resumirBloqueiosDeCampo(bloqueios) {
  const total = (bloqueios || []).length
  if (!total) return { total: 0, texto: '' }
  const [primeiro] = bloqueios
  return {
    total,
    texto: total === 1 ? textoBloqueio(primeiro) : `${textoBloqueio(primeiro)} (e mais ${total - 1})`,
  }
}
