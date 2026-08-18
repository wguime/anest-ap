/**
 * Hora padrão das posições assistenciais (SRPA).
 *
 * Nasceu de um erro visível na escala de 18/08: a SRPA da Unimed foi publicada
 * às 07:30, e o dono corrigiu — ela entra às 09:00. O mapa nunca traz esse
 * horário (34 das 37 publicações com SRPA vieram sem hora nenhuma), então não
 * adianta esperar da extração: é regra da casa, e o lugar dela é o código.
 *
 * O caso que este teste guarda de verdade é o do TURNO: a hora decide o turno na
 * publicação, e carimbar 09:00 numa importação vespertina jogaria a SRPA para
 * fora da escala da tarde — a posição sumiria em silêncio, que é pior do que a
 * linha sem horário.
 */
import { describe, expect, it } from 'vitest'
import { aplicarHoraPadraoPosicoes, ehPosicaoAssistencial } from '../../lib/escalaCirurgicaItens'

const srpa = (extra = {}) => ({ sala: 'SRPA', bloco: 'srpa', anestesista: 'LEANDRO', posicaoAssistencial: true, ...extra })
const cirurgia = (extra = {}) => ({ sala: 'CC - Sala 1', hora: '07:30', procedimento: 'Colecistectomia', cirurgiao: 'Fulano', ...extra })

describe('hora padrão da SRPA', () => {
  it('carimba 09:00 na SRPA da Unimed pela manhã', () => {
    const [pos] = aplicarHoraPadraoPosicoes([srpa()], 'unimed', 'matutino')
    expect(pos.hora).toBe('09:00')
    expect(ehPosicaoAssistencial(pos)).toBe(true)
  })

  it('não carimba no vespertino — 09:00 tiraria a SRPA do turno da tarde', () => {
    expect(aplicarHoraPadraoPosicoes([srpa()], 'unimed', 'vespertino')[0].hora).toBeUndefined()
  })

  it('é regra da Unimed: HRO e Materno passam intactos', () => {
    expect(aplicarHoraPadraoPosicoes([srpa()], 'hro', 'matutino')[0].hora).toBeUndefined()
    expect(aplicarHoraPadraoPosicoes([srpa()], 'materno', 'matutino')[0].hora).toBeUndefined()
  })

  it('respeita a hora que a escala trouxe — o carimbo só preenche o vazio', () => {
    expect(aplicarHoraPadraoPosicoes([srpa({ hora: '07:00' })], 'unimed', 'matutino')[0].hora).toBe('07:00')
  })

  it('não toca em cirurgia nenhuma', () => {
    const [caso] = aplicarHoraPadraoPosicoes([cirurgia({ hora: '' })], 'unimed', 'matutino')
    expect(caso.hora).toBe('')
  })

  // Posição assistencial que não é SRPA (a edge devolve o local livre) fica de
  // fora: 09:00 é o horário da SRPA, não de toda posição de apoio.
  it('não carimba posição assistencial de outro local', () => {
    const [pos] = aplicarHoraPadraoPosicoes([srpa({ sala: 'Consultório', bloco: '' })], 'unimed', 'matutino')
    expect(pos.hora).toBeUndefined()
  })

  it('reconhece a SRPA pelo nome da sala, sem depender do bloco', () => {
    const [pos] = aplicarHoraPadraoPosicoes([{ sala: 'SRPA', anestesista: 'LEANDRO' }], 'unimed', 'matutino')
    expect(pos.hora).toBe('09:00')
  })
})
