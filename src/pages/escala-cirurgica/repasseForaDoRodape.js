/**
 * "COMO {B} ENTRA?" — a pergunta do repasse para quem NÃO está no rodapé daquele hospital
 * naquele turno (dono 10–11/11/2026, modelo B de `.tmp/analise-escala-2026-11/modelos-2/`).
 *
 * Princípio do dono: "a ordem de liberação do rodapé SEMPRE deve ser respeitada; se ela
 * for desrespeitada por motivo de troca deve haver perguntas sobre os motivos — se o
 * usuário irá assumir a posição do colega, se está vindo como ajuda…".
 *
 * Medido de 26/09 a 10/11: 85% dos repasses são entre colegas do MESMO rodapé e não mexem
 * na ordem — esses seguem sem pergunta. Os outros 97 foram para alguém de fora da fila, e
 * 53 deles sem ninguém dizer se era ajuda ou substituição: quem recebia entrava no fim
 * (saindo antes) e quem passava ficava "Livre" na vaga (19/10, HRO: Klisman recebeu as
 * cirurgias da Cristina, 6ª, e saiu antes de quatro colegas; a 6ª nunca foi liberada).
 *
 * Substitui o interruptor "Assumir também a posição de X na fila" (nascia desligado e não
 * dizia o efeito) e a pergunta "Os dois trocaram de hospital?" de 27/10 (só cobria quem
 * estava no rodapé de OUTRO hospital com quem passa ficando sem cirurgia).
 *
 * Puro: quem chama passa as escalas carregadas e o resolver do roster. As frases são a
 * VERSÃO CURTA aprovada (cabem em 3 linhas a 375 px). Nada vem marcado.
 */
import { FDS_HOSPITAL } from '@/lib/escalaFds'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { casosTransferiveis, localizarSlotRodape, planoExecucaoTroca, rodapeDoTurno } from './utils'

const HOSP = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }
const rotuloHosp = (h) => HOSP[h] || h
/** "do HRO", "da Unimed" / "no HRO", "na Unimed". */
export const doHospital = (h) => `${h === 'unimed' ? 'da' : 'do'} ${rotuloHosp(h)}`
export const noHospital = (h) => `${h === 'unimed' ? 'na' : 'no'} ${rotuloHosp(h)}`
const TURNO_NOME = { matutino: 'manhã', vespertino: 'tarde' }

const posicaoDoSlot = (esc, slot, turno) => (slot ? rodapeDoTurno(esc?.ordemLiberacao, slot.turno || turno).indexOf(slot.nome) + 1 : 0)

/**
 * A situação de quem RECEBE as cirurgias. `null` = a pergunta não existe: quem recebe já
 * está na fila daqui, a fila é a única do fim de semana, o hospital não tem rodapé no
 * turno (Materno) ou não há alguém com login recebendo.
 *
 * @param {object} p
 * @param {object} p.escalas       escalas carregadas da data ({ hro, unimed, materno })
 * @param {object} p.escala        a escala onde as cirurgias estão
 * @param {string} p.turno         'matutino' | 'vespertino'
 * @param {(nome: string) => (string|null)} p.resolverUid
 * @param {{uid?: string|null, nome?: string}} p.quemPassa   quem responde hoje (pode não haver)
 * @param {{uid: string, nome: string, apelido?: string}} p.quemRecebe
 * @param {string[]} [p.idsPassando]  cirurgias que mudam de mãos agora
 * @returns {null | { slotA: object|null, la: {hospital: string, posicao: number}|null,
 *   semCirurgiaAqui: boolean, opcoes: Array<'ajuda'|'assume'|'trocaram'>, turno: string }}
 */
export function situacaoDeQuemRecebe({ escalas, escala, turno, resolverUid, quemPassa, quemRecebe, idsPassando = [] }) {
  if (!escala?.id || !quemRecebe?.uid) return null
  // sem turno informado (chamada legada), vale o turno onde quem passa tem posição
  if (turno !== 'matutino' && turno !== 'vespertino') {
    turno = (quemPassa?.uid || quemPassa?.nome) ? localizarSlotRodape(escala, quemPassa, resolverUid, null)?.turno : null
    if (!turno) return null
  }
  if (escala.hospital === FDS_HOSPITAL || escalas?.[FDS_HOSPITAL]) return null // fila única: outra regra (05/09)
  if (!rodapeDoTurno(escala.ordemLiberacao, turno).length) return null
  if (quemPassa?.uid && quemPassa.uid === quemRecebe.uid) return null
  if (localizarSlotRodape(escala, quemRecebe, resolverUid, turno)) return null

  let la = null
  for (const [h, esc] of Object.entries(escalas || {})) {
    if (!esc?.id || esc.id === escala.id || h === FDS_HOSPITAL) continue
    const slot = localizarSlotRodape(esc, quemRecebe, resolverUid, turno)
    if (slot) { la = { hospital: h, posicao: posicaoDoSlot(esc, slot, turno) }; break }
  }

  const temQuemPassa = !!(quemPassa?.uid || String(quemPassa?.nome || '').trim())
  const slot = temQuemPassa ? localizarSlotRodape(escala, quemPassa, resolverUid, turno) : null
  const slotA = slot ? { ...slot, posicao: posicaoDoSlot(escala, slot, turno) } : null
  const passando = new Set(idsPassando)
  const semCirurgiaAqui = !!slotA
    && !casosTransferiveis(escala, quemPassa, resolverUid, turno).some((id) => !passando.has(id))
  // só há posição em jogo quando quem passa é da fila daqui e fica sem cirurgia aberta;
  // quem já tem posição em outro hospital não "assume" (27/10: não existe troca de um lado só)
  const opcoes = ['ajuda', ...(slotA && semCirurgiaAqui ? [la ? 'trocaram' : 'assume'] : [])]
  return { slotA, la, semCirurgiaAqui, opcoes, turno }
}

const primeiro = (nome) => titleCaseNome(String(nome || '').trim()).split(/\s+/)[0] || ''

/**
 * Os textos da pergunta. Primeiro nome dos dois — com o MESMO primeiro nome, o nome que
 * a tela já usa (`nomeA`/`nomeB` inteiros), senão a frase não diz quem é quem.
 * @returns {{ titulo: string, aviso: string|null, opcoes: Array<{id: string, rotulo: string, efeito: string}>,
 *   botao: (escolha: string|null) => string }}
 */
export function textosComoEntra({ situacao, hospital, turno, nomeA, nomeB }) {
  const iguais = primeiro(nomeA) && primeiro(nomeA) === primeiro(nomeB)
  const A = iguais ? nomeA : primeiro(nomeA)
  const B = iguais ? nomeB : primeiro(nomeB)
  const { slotA, la, semCirurgiaAqui, opcoes } = situacao
  const t = TURNO_NOME[turno] || 'manhã'
  const m = slotA?.posicao || 0
  const segueA = slotA && m ? ` ${A} segue ${m}º.` : ''
  const efeitoAjuda = (la
    ? `${B} segue ${la.posicao}º ${noHospital(la.hospital)}. Aqui entra no fim como Ajuda (${rotuloHosp(la.hospital)}) e sai antes do rodapé.`
    : `${B} está fora da escala. Entra no fim como Ajuda e sai antes do rodapé.`) + segueA
  const EFEITO = {
    ajuda: efeitoAjuda,
    assume: `${B} passa a ser o ${m}º ${doHospital(hospital)}. ${A} sai da fila desta ${t}.`,
    trocaram: la ? `${B} fica com o ${m}º ${doHospital(hospital)}; ${A}, com o ${la.posicao}º ${doHospital(la.hospital)}. As cirurgias vão junto.` : '',
  }
  const ROTULO = {
    ajuda: 'Veio AJUDAR',
    assume: `ASSUME a posição de ${A} na fila`,
    trocaram: 'Os dois TROCARAM de hospital hoje',
  }
  const BOTAO = {
    ajuda: `${B} entra como ajuda`,
    assume: `${B} assume o ${m}º`,
    trocaram: `Trocar ${A} ⇄ ${B}`,
  }
  const naoEsta = `${B} não está na fila ${doHospital(hospital)} nesta ${t}`
  const soAjuda = opcoes.length === 1
  return {
    titulo: `${naoEsta}. Como ${B} entra?`,
    // uma resposta só: não é pergunta, é aviso — com o porquê quando há posição em jogo
    aviso: soAjuda
      ? `${naoEsta}${slotA && !semCirurgiaAqui ? ` e ${A} continua com outra cirurgia aqui` : ''}. Por isso ${B} entra como ajuda: ${efeitoAjuda}`
      : null,
    opcoes: opcoes.map((id) => ({ id, rotulo: ROTULO[id], efeito: EFEITO[id] })),
    botao: (escolha) => (soAjuda ? BOTAO.ajuda : BOTAO[escolha] || `Escolha como ${B} entra`),
    nomes: { A, B },
  }
}

/**
 * Os LADOS da execução para "assume" e "trocaram" — o mesmo formato do `TrocaSheet`
 * (`executarSubstituicao`). "Ajuda" não tem lados: é o repasse de sempre.
 * @returns {{ lados: object[], limparTroca: object[] }}
 */
export function ladosDeComoEntra({ escolha, situacao, escalas, escala, turno, resolverUid, quemPassa, quemRecebe, idsPassando = [] }) {
  if (escolha === 'assume' && situacao?.slotA) {
    const { slotA } = situacao
    return { limparTroca: [], lados: [{
      hospital: escala.hospital, escalaId: escala.id,
      // o turno da ESCRITA é o do slot achado, nunca o da tela (D3)
      turno: slotA.turno || turno,
      chaveSlot: slotA.chave, nomeSlot: slotA.nome, posicao: slotA.posicao,
      tipo: 'assuncao',
      de: { uid: quemPassa.uid || null, nome: quemPassa.nome, apelido: quemPassa.apelido || slotA.nome },
      para: { uid: quemRecebe.uid, nome: quemRecebe.nome, apelido: quemRecebe.apelido },
      casoIds: idsPassando.filter(Boolean),
    }] }
  }
  if (escolha === 'trocaram') {
    // a posição de A em jogo é a DESTA escala (âncora, dono 13/08); a de B, onde ele estiver
    const plano = planoExecucaoTroca({ escalas, resolverUid, a: quemPassa, b: quemRecebe, turno, escalaAncora: escala.id })
    const ehDeB = (l) => (l.de?.uid && quemRecebe.uid ? l.de.uid === quemRecebe.uid : false)
    return {
      limparTroca: plano?.limparTroca || [],
      lados: (plano?.lados || []).map((l) => ({ ...l, tipo: 'entre_hospitais' })).sort((x, y) => ehDeB(x) - ehDeB(y)),
    }
  }
  return { lados: [], limparTroca: [] }
}
