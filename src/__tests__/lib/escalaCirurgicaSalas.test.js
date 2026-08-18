import { describe, expect, it } from 'vitest'
import { normalizarSalaHro, salasDoHospital } from '@/pages/escala-cirurgica/utils'

describe('salas HRO na conferência', () => {
  it('normaliza blocos e locais especiais sem perder a sala', () => {
    expect(normalizarSalaHro('BLOCO A 2')).toBe('Bloco A - Sala 2')
    expect(normalizarSalaHro('BLOCO M 3')).toBe('Bloco M - Sala 3')
    expect(normalizarSalaHro('IOSC')).toBe('IOSC')
    expect(normalizarSalaHro('HO')).toBe('Hospital de Olhos')
  })

  it('oferece todas as salas HRO em ordem operacional e mantém as salas em uso', () => {
    const salas = salasDoHospital('hro', [{ sala: 'Bloco M - Sala 3' }, { sala: 'IOSC' }])
    expect(salas.indexOf('Sala 1')).toBeLessThan(salas.indexOf('Bloco M - Sala 3'))
    expect(salas.indexOf('Bloco M - Sala 3')).toBeLessThan(salas.indexOf('IOSC'))
    expect(salas).toContain('Hospital de Olhos')
    expect(salas).toContain('Bloco A - Sala 2')
  })
})

/**
 * Exibição enxuta no card do quadro (dono 17/08).
 * Os dois helpers são de EXIBIÇÃO: o dado original continua no caso, porque a
 * família de convênio, o auto-import de cirurgia particular e a conferência
 * dependem do texto como veio da escala.
 */
import { convenioExibicao, idadeExibicao } from '@/pages/escala-cirurgica/utils'

describe('convenioExibicao — Unimed é só "Unimed"', () => {
  it('corta o complemento de qualquer Unimed', () => {
    expect(convenioExibicao('Unimed Chapecó - VD')).toBe('Unimed')
    expect(convenioExibicao('UNIMED INTERCÂMBIO ESTADUAL')).toBe('Unimed')
    expect(convenioExibicao('Unimed Fundação')).toBe('Unimed')
  })
  it('escreve os demais na grafia dos outros badges, preservando sigla', () => {
    // padrão do DS: "Iniciada", "Passa para tarde" — frase, com sigla intacta
    expect(convenioExibicao('PARTICULAR')).toBe('Particular')
    expect(convenioExibicao('SUS')).toBe('SUS')
    expect(convenioExibicao('BRF')).toBe('BRF')
    expect(convenioExibicao('Intercâmbio Mercosul')).toBe('Intercâmbio Mercosul')
    expect(convenioExibicao('Particular')).toBe('Particular')
    expect(convenioExibicao('')).toBe('')
  })
})

describe('idadeExibicao — anos, exceto no primeiro ano de vida', () => {
  it('deixa só os anos de quem já fez 1 ano', () => {
    expect(idadeExibicao('54a 1m 9d')).toBe('54a')
    expect(idadeExibicao('46a 11m 14')).toBe('46a')
    expect(idadeExibicao('32a 0m 7d')).toBe('32a')
    expect(idadeExibicao('6a')).toBe('6a')
  })
  it('mantém meses e dias de quem não fez 1 ano — ali eles mudam a conduta', () => {
    expect(idadeExibicao('0a 6m 8d')).toBe('6m 8d')
    expect(idadeExibicao('0a 11m')).toBe('11m')
  })
  it('formato desconhecido volta inteiro — melhor estranho que inventado', () => {
    expect(idadeExibicao('3m')).toBe('3m')
    expect(idadeExibicao('RN')).toBe('RN')
    expect(idadeExibicao('')).toBe('')
  })
})
