/**
 * resumirRodape — a lista que a secretária confere contra a FOTO do rodapé
 * antes de publicar (dono 11/08: "difícil de analisar").
 *
 * O que cada posição precisa responder: quem é, que papel a posição carrega e
 * se essa pessoa tem cirurgia no lote. A contagem é o detector barato da
 * extração torta — nome no rodapé com zero casos costuma ter perdido a linha
 * para outra pessoa (Didomenico e Melo sumiram assim do IOSC em 23/07).
 */
import { describe, it, expect } from 'vitest'
import { resumirRodape } from '@/pages/escala-cirurgica/utils'

const caso = (anestesista, extra = {}) => ({ anestesista, ...extra })

describe('resumirRodape', () => {
  const RODAPE = ['NATHALIA', 'ERLEI', 'FERNANDO', 'CURY']

  it('numera a ordem e marca as duas regras posicionais', () => {
    const linhas = resumirRodape(RODAPE, [])
    expect(linhas.map((l) => l.i)).toEqual([0, 1, 2, 3])
    expect(linhas[0].papel).toBe('plantonista')
    expect(linhas[3].papel).toBe('sai 1º')     // último = plantão do turno seguinte
    expect(linhas[1].papel).toBeNull()
    expect(linhas[2].papel).toBeNull()
  })

  it('nome sozinho no rodapé não vira plantonista E "sai 1º" ao mesmo tempo', () => {
    expect(resumirRodape(['NATHALIA'], []).map((l) => l.papel)).toEqual(['plantonista'])
  })

  it('conta os casos de cada nome — por vínculo e por texto', () => {
    const resolver = (n) => (String(n).trim().toUpperCase() === 'CURY' ? 'uid-cury' : null)
    const casos = [
      caso('CURY', { anestesistaUserId: 'uid-cury' }),
      caso('CURY', { anestesistaUserId: 'uid-cury' }),
      caso('ERLEI'),
    ]
    const linhas = resumirRodape(RODAPE, casos, resolver)
    expect(linhas.map((l) => l.casos)).toEqual([0, 1, 0, 2])
  })

  it('dupla na MESMA cirurgia conta para as duas', () => {
    const linhas = resumirRodape(['RAQUEL', 'GABRIELA'], [caso('RAQUEL + GABRIELA')])
    expect(linhas.map((l) => l.casos)).toEqual([1, 1])
  })

  it('linha sem dono não conta para ninguém', () => {
    const linhas = resumirRodape(RODAPE, [caso('?'), caso('//'), caso('')])
    expect(linhas.every((l) => l.casos === 0)).toBe(true)
  })

  it('marca quem foi declarado como ajuda de outro hospital', () => {
    const linhas = resumirRodape(RODAPE, [], null, ['cury'])
    expect(linhas.map((l) => l.ajuda)).toEqual([false, false, false, true])
  })

  it('tolera entradas vazias', () => {
    expect(resumirRodape([], [])).toEqual([])
    expect(resumirRodape(null, null)).toEqual([])
  })
})
