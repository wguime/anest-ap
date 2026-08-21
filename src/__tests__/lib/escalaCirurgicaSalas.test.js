import { describe, expect, it } from 'vitest'
import { chaveSalaHro, LOCAIS_BASE, normalizarSalaHro, salasDoHospital } from '@/pages/escala-cirurgica/utils'

describe('salas HRO na conferência', () => {
  it('normaliza blocos e locais especiais sem perder a sala', () => {
    expect(normalizarSalaHro('BLOCO A 2')).toBe('Sala 2') // bloco A é implícito
    expect(normalizarSalaHro('BLOCO M 3')).toBe('Bloco M - Sala 3') // o M fica
    expect(normalizarSalaHro('IOSC')).toBe('IOSC')
    expect(normalizarSalaHro('HO')).toBe('Hospital de Olhos')
  })

  it('oferece todas as salas HRO em ordem operacional e mantém as salas em uso', () => {
    const salas = salasDoHospital('hro', [{ sala: 'Bloco M - Sala 3' }, { sala: 'IOSC' }])
    expect(salas.indexOf('Sala 1')).toBeLessThan(salas.indexOf('Bloco M - Sala 3'))
    expect(salas.indexOf('Bloco M - Sala 3')).toBeLessThan(salas.indexOf('IOSC'))
    expect(salas).toContain('Hospital de Olhos')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// RÓTULO CURTO, BLOCO IMPLÍCITO (dono 2026-08-21: "ficou muito poluído").
// A sala do HRO é do bloco A, a 5 é a Emergência e a 7 é o CO — mas isso NÃO vai
// para o rótulo: a tela repete a sala em cada card do quadro e da fila. A lista
// tem UMA entrada por sala, só o número, e o app segue reconhecendo as grafias
// longas que as escalas já publicadas gravaram.
// ════════════════════════════════════════════════════════════════════════════
describe('salas do HRO: rótulo curto, bloco implícito (dono 21/08)', () => {
  it('a lista de escolha tem uma entrada por sala, só o número', () => {
    const base = LOCAIS_BASE.hro
    expect(base.filter((s) => /^Sala \d/.test(s)))
      .toEqual(['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala 7', 'Sala 8', 'Sala 9'])
    // nada de "Bloco A - …", "Sala 5 - Emergência" nem "Sala 7 - CO" na escolha
    expect(base.filter((s) => /^Bloco A/.test(s))).toEqual([])
    expect(base.some((s) => /Emerg|- CO$/.test(s))).toBe(false)
    expect(base).toContain('Bloco M - Sala 1') // no bloco M o bloco FICA
  })

  it('a importação grava só o número, venha o texto como vier', () => {
    expect(normalizarSalaHro('Sala 1')).toBe('Sala 1')
    expect(normalizarSalaHro('SALA 3')).toBe('Sala 3')
    expect(normalizarSalaHro('Bloco A - Sala 4')).toBe('Sala 4')
    expect(normalizarSalaHro('Sala 5 - Emergência')).toBe('Sala 5')
    expect(normalizarSalaHro('Sala 7 - CO')).toBe('Sala 7')
  })

  it('o papel escrito no lugar do número continua sabido', () => {
    // o mapa do HRO escreve "CO"/"EMERGENCIA" na coluna Leito em vez do número
    expect(normalizarSalaHro('CO')).toBe('Sala 7')
    expect(normalizarSalaHro('EMERGENCIA')).toBe('Sala 5')
  })

  // Idempotência: a normalização roda na importação, no "Adicionar caso" e no
  // "Mudar sala" — um rótulo já canônico passa por ela várias vezes.
  it('é idempotente', () => {
    for (const s of ['Sala 1', 'Sala 5', 'Sala 7', 'Bloco M - Sala 3', 'Bloco M', 'Bloco A', 'IOSC']) {
      expect(normalizarSalaHro(s)).toBe(s)
      expect(normalizarSalaHro(normalizarSalaHro(s))).toBe(s)
    }
  })

  // Escala publicada NÃO é reescrita: produção tem as três grafias da mesma sala.
  // Sem a identidade única, a sala vira dois blocos no quadro e duas entradas no
  // seletor — e, no contrato de urgência, duas vagas.
  it('as grafias antigas apontam para a MESMA sala', () => {
    expect(chaveSalaHro('Sala 7 - CO')).toBe(chaveSalaHro('Sala 7'))
    expect(chaveSalaHro('Sala 5 - Emergência')).toBe(chaveSalaHro('Sala 5'))
    expect(chaveSalaHro('Bloco A - Sala 4')).toBe(chaveSalaHro('Sala 4'))
    expect(chaveSalaHro('Bloco M - Sala 4')).not.toBe(chaveSalaHro('Sala 4'))
    expect(chaveSalaHro('Bloco A')).toBe('BLOCO A') // seção sem número não vira chave vazia
  })

  it('escala antiga não oferece a mesma sala duas vezes no seletor', () => {
    const out = salasDoHospital('hro', [{ sala: 'Sala 7 - CO' }])
    expect(out).toContain('Sala 7 - CO') // a grafia do DIA vence
    expect(out).not.toContain('Sala 7')
    expect(out).toContain('Sala 6') // as demais seguem canônicas
  })

  it('a ordem do quadro segue o número', () => {
    const salas = salasDoHospital('hro', [])
    expect(salas.indexOf('Sala 4')).toBeLessThan(salas.indexOf('Sala 8'))
    expect(salas.indexOf('Sala 9')).toBeLessThan(salas.indexOf('Bloco M - Sala 1'))
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
