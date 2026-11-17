/**
 * Escala Numérica — a VISTA de um dia/turno, exatamente como a tela de consulta monta
 * (`src/pages/escala-numerica/EscalaNumericaPage.jsx`): ordem da numérica → pós-plantão
 * (manhã sobe P1/P2, tarde marca) → férias e ausências MARCADAS (ninguém sai) → lugar vago
 * de quem subiu para o plantão em outro card. Feriado = fila única.
 *
 * Mora em src/lib (pura, dataset por parâmetro) para a tela e a API externa (edge api-v1,
 * cópia gerada por scripts/gerar-libs-numerica-api-v1.mjs) usarem O MESMO código.
 * Regras: `.claude/rules/escala-numerica.md`.
 */
import { montarOrdem, anotarFerias, casarNomeComLegenda, HOSPITAIS_NUMERICA } from './escalaNumerica.js'
import { aplicarPosPlantaoManha, marcarPosPlantaoTarde } from './posPlantao.js'

/**
 * `montarOrdem` com `ferias: null` sempre acusa "férias não conferidas" — correto para a
 * conferência, errado aqui, onde as férias são consultadas à parte e viram marca. As outras
 * pendências (identidade em feriado, Louise duplicada) continuam valendo e aparecem.
 */
export const pendenciasReais = (pendencias = []) => pendencias.filter((p) => !/^Férias NÃO conferidas/.test(p))

/**
 * Quem subiu para o P1/P2 sai da coluna que a numérica lhe deu (dono 03/09). No card de onde
 * saiu fica o LUGAR VAGO, na posição em que estaria — "informe que a posição original seria no
 * Materno no card do Materno, para evitar confusão" (dono 07/10). Sem número de posição (a
 * coluna foi renumerada) e fora da conta de quem trabalha. Só quando muda de card: quem sobe
 * dentro do próprio hospital continua à vista no mesmo card.
 */
function lugarVago(m) {
  return { lugarVago: true, numero: m.numero, nome: m.nome, destino: m.hospital, postoPlantao: m.postoPlantao }
}
export function marcarLugaresVagos(blocos, brutos, movidos = []) {
  return blocos.map((b) => {
    const saidas = movidos.filter((m) => m.origem?.hospital === b.hospital && m.hospital !== b.hospital)
    if (!saidas.length) return b
    const original = brutos.find((x) => x.hospital === b.hospital)?.lista || []
    let lista = [...b.lista]
    for (const m of saidas) {
      // logo depois do último que vinha antes dele na numérica e continua na coluna
      const ancora = original.slice(0, m.origem.posicao - 1).reverse()
        .map((o) => lista.findIndex((p) => !p.lugarVago && p.numero === o.numero && p.nome === o.nome))
        .find((i) => i >= 0)
      const i = ancora === undefined ? 0 : ancora + 1
      lista = [...lista.slice(0, i), lugarVago(m), ...lista.slice(i)]
    }
    return { ...b, lista }
  })
}
export function marcarVagosNoConsultorio(consultorio, original = [], movidos = []) {
  const saidas = movidos.filter((m) => m.origem?.hospital === 'consultorio')
  if (!saidas.length) return consultorio
  return original.map((o) => {
    const m = saidas.find((s) => s.numero === o.numero)
    return m ? lugarVago(m) : consultorio.find((c) => c.numero === o.numero && c.nome === o.nome)
  }).filter(Boolean)
}

/**
 * A lista de um turno, como a tela mostra. Função e não `useMemo` porque a impressão do dia
 * inteiro monta os DOIS turnos com as mesmas regras (pós-plantão antes das férias).
 */
/**
 * Licença no Pega Plantão (dono 07/10: "descontar, mostrando 'ausente'"). Mesmo casamento de
 * nomes das férias. Numa DUPLA só marca se os dois estiverem fora: a regra "férias da dupla são
 * juntas" (21/09) é de férias; licença de um não diz nada do outro, que segura a posição.
 */
export function anotarAusentes(lista, ausentes) {
  if (!Array.isArray(ausentes) || !ausentes.length) return lista
  return lista.map((p) => {
    if (p.lugarVago) return p
    const nomes = String(p.nome).split(' / ').map((n) => n.trim()).filter(Boolean)
    return nomes.every((n) => ausentes.some((a) => casarNomeComLegenda(n, a))) ? { ...p, ausente: true } : p
  })
}

export function montarVistaNumerica(dadosNumerica, dataISO, turno, ferias, noturnos, ausentes = null) {
  // qualquer hospital serve de sonda: fim de semana, fora da vigência e feriado (fila única)
  // respondem igual para os três
  const base = montarOrdem(dadosNumerica, { data: dataISO, hospital: 'hro', turno, ferias: null })
  if (!base.ok) return { tipo: 'vazio', motivo: base.motivo, aviso: base.aviso }
  if (base.filaUnica) {
    return {
      tipo: 'feriado',
      feriado: base.feriado,
      lista: anotarAusentes(anotarFerias(base.lista, ferias), ausentes),
      pendencias: pendenciasReais(base.pendencias),
    }
  }
  const brutos = HOSPITAIS_NUMERICA.map((hospital) => {
    const r = montarOrdem(dadosNumerica, { data: dataISO, hospital, turno, ferias: null })
    return { hospital, lista: r.lista, pendencias: pendenciasReais(r.pendencias) }
  })
  // pós-plantão ANTES das férias: a manhã muda quem está em cada coluna, e marcar antes
  // de mover deixaria a marca na posição velha
  const pp = turno === 'matutino'
    // quem fez a noite e não trabalha no dia (férias OU licença) não sobe para a 2ª
    ? aplicarPosPlantaoManha(dadosNumerica, brutos, base.consultorio, noturnos, {
      ferias: Array.isArray(ferias) || Array.isArray(ausentes) ? [...(ferias || []), ...(ausentes || [])] : null,
    })
    : marcarPosPlantaoTarde(brutos, base.consultorio, noturnos)
  const blocos = pp.blocos.map((b) => ({ ...b, lista: anotarAusentes(anotarFerias(b.lista, ferias), ausentes) }))
  // o consultório não entra na FILA, mas quem está nele também tira férias (dono 03/09):
  // a marca vale para os três hospitais E para o consultório
  const consultorio = anotarAusentes(anotarFerias(pp.consultorio, ferias), ausentes)
  return {
    tipo: 'dia',
    // o lugar vago entra DEPOIS das férias: ele não é ninguém trabalhando ali, não leva marca
    blocos: marcarLugaresVagos(blocos, brutos, pp.movidos),
    consultorio: marcarVagosNoConsultorio(consultorio, base.consultorio, pp.movidos),
    diaSemana: base.diaSemana,
    pendencias: [...new Set(brutos.flatMap((b) => b.pendencias))],
  }
}
