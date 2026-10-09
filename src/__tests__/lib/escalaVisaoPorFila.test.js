/**
 * Visão "Por fila" da conferência no desktop (dono 09/10/2026, modelo C).
 *
 * O que trava: cada pessoa do rodapé, NA ORDEM, com as cirurgias dela; o "//" herda o
 * dono do bloco; dupla "A + B" aparece nas duas; "?" vai para o grupo sem anestesista;
 * quem tem caso e não está na ordem não some (vai para "fora"); nota de local
 * ("MATHEUS (CONSULT)") vira campo, não parte do nome; os índices são os da tela.
 */
import { describe, it, expect } from 'vitest'
import { montarVisaoPorFila } from '@/lib/escalaVisaoPorFila'

const ROSTER = { RAUL: 'u-raul', 'GUILHERME X': 'u-gx', MAURICIO: 'u-mau', MATHEUS: 'u-mat' }
const resolver = (n) => ROSTER[String(n || '').toUpperCase().trim()] || null
const caso = (sala, anestesista, extra = {}) => ({ sala, anestesista, hora: '13:00', procedimento: 'X', ...extra })

describe('montarVisaoPorFila', () => {
  it('pessoas na ordem do rodapé, cada uma com as suas cirurgias', () => {
    const casos = [caso('Sala 8', 'MAURICIO'), caso('Imagem', 'RAUL'), caso('Sala 8', 'MAURICIO')]
    const v = montarVisaoPorFila({ casos, ordem: ['RAUL', 'EDUARDO', 'MAURICIO'], resolver })
    expect(v.pessoas.map((p) => [p.nome, p.indices])).toEqual([['RAUL', [1]], ['EDUARDO', []], ['MAURICIO', [0, 2]]])
    expect(v.pessoas[0].papel).toBe('plantonista')
    expect(v.pessoas[2].papel).toBe('sai1')
    expect(v.semAnestesista).toEqual([])
    expect(v.fora).toEqual([])
  })

  it('casa pelo login escolhido na conferência, não pelo texto importado', () => {
    // a leitura trouxe "GUIL" e a secretária escolheu o login do Guilherme X
    const casos = [caso('Sala 4', 'GUILHERME X', { anestesistaUserId: 'u-gx' })]
    const v = montarVisaoPorFila({ casos, ordem: ['GUILHERME X'], resolver })
    expect(v.pessoas[0].indices).toEqual([0])
  })

  it('"//" herda o dono do bloco', () => {
    const casos = [caso('Sala 1', 'FERNANDO'), caso('Sala 1', '//')]
    const v = montarVisaoPorFila({ casos, ordem: ['FERNANDO'], grupos: ['g1', 'g1'], resolver })
    expect(v.pessoas[0].indices).toEqual([0, 1])
  })

  it('dupla "A + B" aparece nas duas pessoas', () => {
    const casos = [caso('Hemodinâmica', 'RAUL + MAURICIO')]
    const v = montarVisaoPorFila({ casos, ordem: ['RAUL', 'MAURICIO'], resolver })
    expect(v.pessoas.map((p) => p.indices)).toEqual([[0], [0]])
  })

  it('"?" e semAnestesista vão para o grupo sem anestesista', () => {
    const casos = [caso('Sala 3', '?'), caso('Sala 5', 'JOAO', { semAnestesista: true })]
    const v = montarVisaoPorFila({ casos, ordem: ['RAUL'], resolver })
    expect(v.semAnestesista).toEqual([0, 1])
  })

  it('quem tem caso e não está na ordem não some', () => {
    const casos = [caso('Exames', 'CRISTINA'), caso('Exames', 'CRISTINA')]
    const v = montarVisaoPorFila({ casos, ordem: ['RAUL'], resolver })
    expect(v.fora).toEqual([{ chave: 'CRISTINA', uid: null, nome: 'CRISTINA', ajuda: false, indices: [0, 1] }])
  })

  it('nota de local é campo próprio e não atrapalha o casamento', () => {
    const casos = [caso('Sala 2', 'MATHEUS')]
    const v = montarVisaoPorFila({ casos, ordem: ['RAUL', 'MATHEUS (CONSULT)'], resolver })
    expect(v.pessoas[1]).toMatchObject({ nome: 'MATHEUS', nota: 'CONSULT', indices: [0] })
  })

  it('ajuda marcada: na ordem leva o selo; fora da ordem e sem caso ainda aparece', () => {
    const v = montarVisaoPorFila({ casos: [], ordem: ['RAUL', 'ALEXANDRE S'], ajuda: ['ALEXANDRE S', 'OSCAR'], resolver })
    expect(v.pessoas[1].ajuda).toBe(true)
    expect(v.fora).toEqual([{ chave: 'OSCAR', uid: null, nome: 'OSCAR', ajuda: true, indices: [] }])
  })

  it('nome repetido no rodapé: as cirurgias ficam na primeira posição', () => {
    const casos = [caso('Sala 8', 'MAURICIO')]
    const v = montarVisaoPorFila({ casos, ordem: ['MAURICIO', 'RAUL', 'MAURICIO'], resolver })
    expect(v.pessoas.map((p) => p.indices)).toEqual([[0], [], []])
  })
})
