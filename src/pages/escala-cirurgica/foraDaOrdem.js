/**
 * Anestesista FORA DA ORDEM numa cirurgia lançada à mão (dono 15/10/2026, modelo A
 * de `.tmp/confirmar-anestesista-fora-da-ordem.html`).
 *
 * "ao acrescentar cirurgias de urgência e for acrescentado anestesista que não é o
 * próximo a ser chamado ou algum anestesista que está trabalhando envie uma mensagem
 * confirmando se está correto a inclusão de anestesista fora da ordem estabelecida."
 *
 * Origem: 15/10, HRO da manhã. Às 11h28 a urgência da Sala 5 foi para o Rafael (do
 * rodapé da Unimed) com a Karine (10º do HRO) sem cirurgia desde 11h19 e não
 * liberada; às 12h06 a da Sala 7 foi para o Oscar (6º da Unimed) com o Klisman (9º)
 * livre. Nada avisava quem lançava.
 *
 * O PRÓXIMO A SER CHAMADO é o 1º LIVRE DE CIMA PARA BAIXO (escolha do dono): a
 * liberação corre de baixo para cima, então a urgência vai para quem sairia por
 * último — e ninguém fica "Livre" esperando no meio dos liberados. Livre = está na
 * fila daqui (rodapé ou ajuda em azul), não foi liberado, não tem cirurgia aberta
 * no turno em hospital nenhum e não está declarado como ajuda em outro hospital.
 *
 * Só informa e pede confirmação: nada é bloqueado e a fila não muda por causa dela.
 * Puro (sem React) — quem chama passa as escalas carregadas e o resolver do roster.
 */
import { casoConcluido } from '@/lib/escalaCirurgicaStatus'
import { FDS_HOSPITAL } from '@/lib/escalaFds'
import { filtrarPorTurno, normNome, rodapeDoTurno } from './utils'

const HOSPITAL_LABEL = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }
const TURNOS_DO_DIA = ['matutino', 'vespertino']

const partesDoCaso = (c) => String(c?.anestesista || '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
const semDono = (c) => c?.semAnestesista || partesDoCaso(c).every((p) => !normNome(p) || /^[?/]+$/.test(p))

/** A pessoa ({ uid, nome }) é este nome do rodapé/ajuda? */
const casaNome = (pessoa, nome, resolverUid) => {
  const n = normNome(nome)
  if (!n) return false
  if (pessoa.uid && resolverUid?.(nome) === pessoa.uid) return true
  return n === normNome(pessoa.nome)
}

/** O caso é da pessoa? O login gravado manda; dupla e legado caem no nome. */
const casoDa = (pessoa, c, resolverUid) => {
  if (c?.anestesistaUserId && pessoa.uid) return c.anestesistaUserId === pessoa.uid
  return partesDoCaso(c).some((p) => casaNome(pessoa, p, resolverUid))
}

/** Marca de liberação (não o `{ escalado: true }` do repasse) — mesma leitura da fila. */
const marcaLiberacao = (escala, turno, pessoa, nome, resolverUid) => {
  const chaves = [pessoa.uid, resolverUid?.(nome), normNome(nome), normNome(pessoa.nome)]
  for (const k of chaves) {
    if (!k) continue
    const v = escala?.liberacoes?.[`${turno}:${k}`] ?? escala?.liberacoes?.[k]
    if (v && v.escalado !== true) return v
  }
  return null
}

const horaDe = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/** A regra vale para esta escala? Dia útil, turno do dia, com fila publicada. */
export function foraDaOrdemSeAplica({ escalas, escala, turno }) {
  if (!escala || !TURNOS_DO_DIA.includes(turno)) return false
  if (escala.hospital === FDS_HOSPITAL || escalas?.[FDS_HOSPITAL]) return false // FDS: fila única, outra regra
  return rodapeDoTurno(escala.ordemLiberacao, turno).length > 0
}

/**
 * A fila daqui, de cima para baixo, com o estado de cada um: rodapé na ordem e depois
 * a ajuda em azul que não está nele.
 * `ignorarCasos` = ids de casos que estão MUDANDO de dono (a troca no detalhe): a
 * cirurgia que vai sair da pessoa não a torna "ocupada".
 */
export function filaParaChamar({ escalas, escala, turno, resolverUid, ignorarCasos = [] }) {
  const ignorar = new Set(ignorarCasos)
  const rodape = rodapeDoTurno(escala?.ordemLiberacao, turno)
  const azuis = rodapeDoTurno(escala?.ajudaExterna, turno)
  const nomes = [...rodape]
  for (const a of azuis) if (!nomes.some((n) => normNome(n) === normNome(a))) nomes.push(a)
  const outras = Object.entries(escalas || {}).filter(([h, e]) => e && h !== FDS_HOSPITAL)
  return nomes.map((nome, i) => {
    const pessoa = { uid: resolverUid?.(nome) || null, nome }
    const lib = marcaLiberacao(escala, turno, pessoa, nome, resolverUid)
    const aberta = situacaoNoTurno({ escalas, turno, pessoa, resolverUid, ignorar }).aberta
    const emprestada = outras.some(([h, e]) => h !== escala.hospital
      && rodapeDoTurno(e.ajudaExterna, turno).some((n) => casaNome(pessoa, n, resolverUid)))
    return { nome, uid: pessoa.uid, posicao: i + 1, liberado: !!lib, liberadoEm: lib?.liberadoEm || null, aberta, emprestada }
  })
}

/** Cirurgias da pessoa no turno, nos hospitais carregados: a 1ª aberta e o último término. */
function situacaoNoTurno({ escalas, turno, pessoa, resolverUid, ignorar }) {
  let aberta = null
  let ultimoTermino = null
  for (const [h, e] of Object.entries(escalas || {})) {
    if (!e || h === FDS_HOSPITAL) continue
    for (const c of filtrarPorTurno(e.casos || [], turno)) {
      if (ignorar?.has(c.id) || c.isContinuacao || semDono(c) || !casoDa(pessoa, c, resolverUid)) continue
      if (!casoConcluido(c)) {
        if (!aberta) aberta = { sala: c.sala || '', hospital: h, hospitalLabel: HOSPITAL_LABEL[h] || h, status: c.statusCirurgia || 'agendada', hora: c.hora || '' }
      } else if (c.terminoReal && (!ultimoTermino || c.terminoReal > ultimoTermino)) {
        ultimoTermino = c.terminoReal
      }
    }
  }
  return { aberta, ultimoTermino }
}

/**
 * O 1º livre de cima para baixo na fila daqui, ou null se não há ninguém livre.
 * `excluir` = uids que não podem ser o próximo: quem está PASSANDO a cirurgia
 * adiante (sem a cirurgia ele ficaria "livre" e seria sugerido para ela mesma).
 */
export function proximoAChamar(fila, excluir = []) {
  const fora = new Set(excluir.filter(Boolean))
  return fila.find((l) => !l.liberado && !l.aberta && !l.emprestada && !(l.uid && fora.has(l.uid))) || null
}

/**
 * Avalia quem foi escolhido para a cirurgia nova (ou para assumir a cirurgia).
 *
 * @param {object} p
 * @param {object} p.escalas  as escalas carregadas da data ({ hro, unimed, materno })
 * @param {object} p.escala   a escala onde a cirurgia entra
 * @param {string} p.turno
 * @param {{uid?: string|null, nome: string}} p.pessoa  quem foi escolhido
 * @param {(nome: string) => string|null} p.resolverUid
 * @param {string[]} [p.ignorarCasos]  casos que estão mudando de dono
 * @param {string[]} [p.quemSai]  uids de quem está passando a cirurgia (não é sugerido)
 * @returns {{ foraDaOrdem: boolean, motivos: object[], proximo: object|null, resumo: {emCirurgia: number, liberados: number} } | null}
 *   null quando a regra não se aplica (FDS, noite, escala sem fila).
 */
export function avaliarEscolhaAnestesista({ escalas, escala, turno, pessoa, resolverUid, ignorarCasos = [], quemSai = [] }) {
  if (!pessoa?.uid && !normNome(pessoa?.nome)) return null
  if (!foraDaOrdemSeAplica({ escalas, escala, turno })) return null
  const ignorar = new Set(ignorarCasos)
  const fila = filaParaChamar({ escalas, escala, turno, resolverUid, ignorarCasos })
  const proximo = proximoAChamar(fila, quemSai)
  const minha = fila.find((l) => (pessoa.uid && l.uid === pessoa.uid) || casaNome(pessoa, l.nome, resolverUid)) || null
  const motivos = []

  if (minha?.liberado) motivos.push({ tipo: 'liberado', hora: horaDe(minha.liberadoEm) })
  const { aberta } = situacaoNoTurno({ escalas, turno, pessoa, resolverUid, ignorar })
  if (aberta) motivos.push({ tipo: 'trabalhando', ...aberta })
  if (!minha) {
    for (const [h, e] of Object.entries(escalas || {})) {
      if (!e || h === escala.hospital || h === FDS_HOSPITAL) continue
      const rod = rodapeDoTurno(e.ordemLiberacao, turno)
      const i = rod.findIndex((n) => casaNome(pessoa, n, resolverUid))
      if (i >= 0) {
        motivos.push({ tipo: 'outroHospital', hospital: h, hospitalLabel: HOSPITAL_LABEL[h] || h, posicao: i + 1, plantao: h !== 'materno' && rod.length > 1 && i === rod.length - 1 })
        break
      }
    }
  }
  const ehProximo = !!proximo && !!minha && proximo.posicao === minha.posicao
  const foraDaOrdem = proximo ? !ehProximo : motivos.length > 0
  const resumo = {
    emCirurgia: fila.filter((l) => l.aberta && !l.liberado).length,
    liberados: fila.filter((l) => l.liberado).length,
  }
  let proximoInfo = null
  if (proximo) {
    const { ultimoTermino } = situacaoNoTurno({ escalas, turno, pessoa: { uid: proximo.uid, nome: proximo.nome }, resolverUid, ignorar })
    proximoInfo = { ...proximo, livreDesde: ultimoTermino }
  }
  return { foraDaOrdem, motivos, proximo: proximoInfo, resumo }
}
