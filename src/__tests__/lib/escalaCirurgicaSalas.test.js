import { describe, expect, it } from 'vitest'
import { chaveSalaHro, LOCAIS_BASE, normalizarSalaHro, salasDoHospital } from '@/pages/escala-cirurgica/utils'

describe('salas HRO na conferência', () => {
  it('normaliza blocos e locais especiais sem perder a sala', () => {
    expect(normalizarSalaHro('BLOCO A 2')).toBe('Bloco A - Sala 2')
    expect(normalizarSalaHro('BLOCO M 3')).toBe('Bloco M - Sala 3')
    expect(normalizarSalaHro('IOSC')).toBe('IOSC')
    expect(normalizarSalaHro('HO')).toBe('Hospital de Olhos')
  })

  it('oferece todas as salas HRO em ordem operacional e mantém as salas em uso', () => {
    const salas = salasDoHospital('hro', [{ sala: 'Bloco M - Sala 3' }, { sala: 'IOSC' }])
    expect(salas.indexOf('Bloco A - Sala 1')).toBeLessThan(salas.indexOf('Bloco M - Sala 3'))
    expect(salas.indexOf('Bloco M - Sala 3')).toBeLessThan(salas.indexOf('IOSC'))
    expect(salas).toContain('Hospital de Olhos')
    expect(salas).toContain('Bloco A - Sala 2')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Sala numérica do HRO = BLOCO A (dono 2026-08-20): "Sala 1" e "Bloco M - Sala 1"
// são salas DIFERENTES em blocos diferentes, e o rótulo curto obrigava a saber de
// cor qual era qual. Todo rótulo numérico passa a nomear o bloco; a forma curta
// saiu da lista de escolha e continua valendo como a MESMA sala nas escalas já
// publicadas (decisão: não reescrever escala publicada).
// ════════════════════════════════════════════════════════════════════════════
describe('numéricas do HRO nomeiam o bloco (dono 20/08)', () => {
  it('a lista de escolha não tem mais o rótulo curto', () => {
    const base = LOCAIS_BASE.hro
    expect(base.filter((s) => /^Sala \d/.test(s))).toEqual([])
    expect(base).toContain('Bloco A - Sala 1')
    expect(base).toContain('Bloco A - Sala 9')
    expect(base).toContain('Bloco M - Sala 1')
    // uma entrada por sala: "Sala 1" e "Bloco A - Sala 1" não convivem mais
    expect(base.filter((s) => chaveSalaHro(s) === 'SALA 1')).toHaveLength(1)
  })

  it('a importação grava o bloco na sala numérica', () => {
    expect(normalizarSalaHro('Sala 1')).toBe('Bloco A - Sala 1')
    expect(normalizarSalaHro('SALA 3')).toBe('Bloco A - Sala 3')
    expect(normalizarSalaHro('Sala 9')).toBe('Bloco A - Sala 9')
  })

  it('os sufixos de 20/08 sobrevivem ao prefixo', () => {
    expect(normalizarSalaHro('CO')).toBe('Bloco A - Sala 7 - CO')
    expect(normalizarSalaHro('Sala 7')).toBe('Bloco A - Sala 7 - CO')
    expect(normalizarSalaHro('EMERGENCIA')).toBe('Bloco A - Sala 5 - Emergência')
    expect(normalizarSalaHro('Sala 5 - Emergência')).toBe('Bloco A - Sala 5 - Emergência')
    // Sala 5 sem "Emergência" segue sendo Sala 5 (as duas grafias existem em produção)
    expect(normalizarSalaHro('Sala 5')).toBe('Bloco A - Sala 5')
  })

  // Idempotência: a normalização roda na importação, no "Adicionar caso" e no
  // "Mudar sala" — um rótulo já canônico passa por ela várias vezes.
  it('é idempotente — inclusive no rótulo com sufixo', () => {
    for (const s of ['Bloco A - Sala 1', 'Bloco A - Sala 7 - CO', 'Bloco A - Sala 5 - Emergência', 'Bloco M - Sala 3', 'Bloco M', 'Bloco A']) {
      expect(normalizarSalaHro(s)).toBe(s)
      expect(normalizarSalaHro(normalizarSalaHro(s))).toBe(s)
    }
  })

  it('"Bloco A" sozinho (seção sem número) não vira chave vazia', () => {
    expect(chaveSalaHro('Bloco A')).toBe('BLOCO A')
    expect(chaveSalaHro('Bloco A - Sala 4')).toBe(chaveSalaHro('Sala 4'))
    expect(chaveSalaHro('Bloco M - Sala 4')).not.toBe(chaveSalaHro('Sala 4'))
  })

  it('a ordem do quadro não muda com o prefixo', () => {
    const salas = salasDoHospital('hro', [])
    expect(salas.indexOf('Bloco A - Sala 4')).toBeLessThan(salas.indexOf('Bloco A - Sala 8'))
    expect(salas.indexOf('Bloco A - Sala 9')).toBeLessThan(salas.indexOf('Bloco M - Sala 1'))
    expect(salas.indexOf('Bloco M - Sala 4')).toBeLessThan(salas.indexOf('Hemodinâmica'))
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
