/**
 * liberacaoDaPessoa — "esta PESSOA foi liberada?" pela fonte única (09/11/2026).
 *
 * Recorte de 23/10: o Klisman assumiu a posição do Rodnei às 09:02 e foi liberado
 * nela às 10:46. A marca fica na chave da POSIÇÃO (`matutino:<uid do Rodnei>`). O
 * aviso de horário e a confirmação "fora da ordem" liam pela chave da pessoa: o
 * Rodnei (operando na Unimed) saía como liberado e o Klisman (que foi embora) não.
 */
import { describe, it, expect } from 'vitest'
import { liberacaoDaPessoa } from '@/lib/filaLiberacao'
import { avaliarEscolhaAnestesista, filaParaChamar, proximoAChamar } from '@/pages/escala-cirurgica/foraDaOrdem'

const marca = { liberadoEm: '2026-10-23T13:46:00Z', por: 'x' }
const pessoa = (uid, nome) => ({ uid, chaves: [uid, nome], mesmoNome: (n) => n === nome })
const RODNEI = pessoa('u-rod', 'RODNEI')
const KLISMAN = pessoa('u-kli', 'KLISMAN')

describe('liberacaoDaPessoa', () => {
  const escala = {
    liberacoes: { 'matutino:u-rod': marca },
    linhaOverrides: { 'matutino:u-rod': { assumidaPor: { uid: 'u-kli', nome: 'Klisman' } } },
  }

  it('quem ASSUMIU a posição é o liberado; o dono antigo da vaga não', () => {
    expect(liberacaoDaPessoa(escala, 'matutino', KLISMAN)).toBe(marca)
    expect(liberacaoDaPessoa(escala, 'matutino', RODNEI)).toBeNull()
  })

  it('sem posição assumida vale a marca da própria posição (uid ou nome)', () => {
    expect(liberacaoDaPessoa({ liberacoes: { 'matutino:u-rod': marca } }, 'matutino', RODNEI)).toBe(marca)
    expect(liberacaoDaPessoa({ liberacoes: { 'matutino:RODNEI': marca } }, 'matutino', RODNEI)).toBe(marca)
    expect(liberacaoDaPessoa({ liberacoes: { 'matutino:u-rod': marca } }, 'matutino', KLISMAN)).toBeNull()
  })

  it('o outro turno não vaza: manhã liberada não libera a tarde', () => {
    expect(liberacaoDaPessoa(escala, 'vespertino', KLISMAN)).toBeNull()
    expect(liberacaoDaPessoa({ liberacoes: { 'matutino:u-rod': marca } }, 'vespertino', RODNEI)).toBeNull()
  })

  it('marcador do repasse ({ escalado: true }) nunca é liberação', () => {
    expect(liberacaoDaPessoa({ liberacoes: { 'matutino:u-rod': { escalado: true } } }, 'matutino', RODNEI)).toBeNull()
  })

  it('swap: cada um responde pela posição que ocupa', () => {
    const swap = {
      liberacoes: { 'matutino:u-rod': marca },
      linhaOverrides: {
        'matutino:u-rod': { assumidaPor: { uid: 'u-kli', nome: 'Klisman' } },
        'matutino:u-kli': { assumidaPor: { uid: 'u-rod', nome: 'Rodnei' } },
      },
    }
    expect(liberacaoDaPessoa(swap, 'matutino', KLISMAN)).toBe(marca)
    expect(liberacaoDaPessoa(swap, 'matutino', RODNEI)).toBeNull()
  })

  it('assumidaPor sem uid casa pelo nome', () => {
    const e = { liberacoes: { 'matutino:u-rod': marca }, linhaOverrides: { 'matutino:u-rod': { assumidaPor: { nome: 'KLISMAN' } } } }
    expect(liberacaoDaPessoa(e, 'matutino', pessoa(null, 'KLISMAN'))).toBe(marca)
    expect(liberacaoDaPessoa(e, 'matutino', RODNEI)).toBeNull()
  })

  it('escala vazia ou sem mapas não quebra', () => {
    expect(liberacaoDaPessoa(null, 'matutino', RODNEI)).toBeNull()
    expect(liberacaoDaPessoa({}, 'matutino', RODNEI)).toBeNull()
  })
})

describe('fora da ordem — a fila para chamar respeita a posição assumida', () => {
  const UID = { RAUL: 'u-raul', RODNEI: 'u-rod', KARINE: 'u-kar', DIEGO: 'u-die' }
  const resolverUid = (n) => UID[String(n || '').toUpperCase().trim()] || null
  // Raul (do rodapé da Unimed) assumiu a 1ª posição do HRO, que era do Rodnei
  const hro = {
    id: 'hro', hospital: 'hro', data: '2026-11-09',
    ordemLiberacao: { matutino: ['RODNEI', 'KARINE', 'DIEGO'] },
    ajudaExterna: {}, liberacoes: {},
    linhaOverrides: { 'matutino:u-rod': { assumidaPor: { uid: 'u-raul', nome: 'RAUL' } } },
    casos: [
      { id: 'k1', turno: 'matutino', sala: 'S2', anestesista: 'KARINE', anestesistaUserId: 'u-kar', statusCirurgia: 'iniciada' },
      { id: 'd1', turno: 'matutino', sala: 'S3', anestesista: 'DIEGO', anestesistaUserId: 'u-die', statusCirurgia: 'iniciada' },
    ],
  }
  const unimed = {
    id: 'uni', hospital: 'unimed', data: '2026-11-09',
    ordemLiberacao: { matutino: ['RAUL'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
    casos: [{ id: 'r1', turno: 'matutino', sala: 'U1', anestesista: 'RODNEI', anestesistaUserId: 'u-rod', statusCirurgia: 'iniciada' }],
  }
  const escalas = { hro, unimed, materno: null }

  it('quem assumiu a 1ª posição está na fila daqui, na posição 1', () => {
    const fila = filaParaChamar({ escalas, escala: hro, turno: 'matutino', resolverUid })
    expect(fila[0]).toMatchObject({ uid: 'u-raul', posicao: 1, liberado: false, aberta: null })
    expect(fila.some((l) => l.uid === 'u-rod')).toBe(false)
    expect(proximoAChamar(fila)).toMatchObject({ uid: 'u-raul' })
  })

  it('lançar a urgência para ele NÃO é fora da ordem', () => {
    const r = avaliarEscolhaAnestesista({ escalas, escala: hro, turno: 'matutino', pessoa: { uid: 'u-raul', nome: 'RAUL' }, resolverUid })
    expect(r.foraDaOrdem).toBe(false)
    expect(r.motivos).toEqual([])
  })

  it('o dono antigo da vaga, operando em outro hospital, não é sugerido nem tido como livre', () => {
    const r = avaliarEscolhaAnestesista({ escalas, escala: hro, turno: 'matutino', pessoa: { uid: 'u-rod', nome: 'RODNEI' }, resolverUid })
    expect(r.foraDaOrdem).toBe(true)
    expect(r.motivos.some((m) => m.tipo === 'trabalhando')).toBe(true)
    expect(r.proximo.uid).toBe('u-raul')
  })

  it('a marca da posição assumida vale para quem a ocupa', () => {
    const liberada = { ...hro, liberacoes: { 'matutino:u-rod': marca } }
    const fila = filaParaChamar({ escalas: { ...escalas, hro: liberada }, escala: liberada, turno: 'matutino', resolverUid })
    expect(fila[0]).toMatchObject({ uid: 'u-raul', liberado: true })
  })
})
