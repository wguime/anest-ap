import { describe, expect, it } from 'vitest'
import { chaveSalaHro, LOCAIS_BASE, normalizarSalaHro, normalizarSalaUnimed, salasDoHospital } from '@/pages/escala-cirurgica/utils'

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


// ════════════════════════════════════════════════════════════════════════════
// UNIMED: A NUMÉRICA SOZINHA É DO CENTRO CIRÚRGICO (dono 2026-08-25).
// Relato: "na escala Unimed não está saindo com a Sala, está aparecendo apenas
// um número abaixo do nome do hospital". O mapa da Unimed rotula a coluna ora
// com "CENTRO CIRÚRGICO - SALA 1", ora com "SALA 1", ora só com "1" — e as duas
// últimas passavam direto pelo normalizador, que devolvia o texto cru. Os 22
// casos da Unimed no feriado de 25/08 saíram assim.
//
// O prejuízo não é só o rótulo: a Unimed não tem uma `chaveSalaHro` que colapse
// grafias, então "6" e "CC - Sala 6" são DUAS salas — dois blocos no quadro e
// duas entradas no seletor.
// ════════════════════════════════════════════════════════════════════════════
describe('salas da Unimed: a numérica sozinha é o Centro Cirúrgico (dono 25/08)', () => {
  it('o número cru vira a sala do CC — era o que o card mostrava como "6"', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(normalizarSalaUnimed(String(n))).toBe(`CC - Sala ${n}`)
    }
    // "SALA 4" é o mesmo defeito com o prefixo escrito (produção, 19/08)
    expect(normalizarSalaUnimed('SALA 4')).toBe('CC - Sala 4')
    // sufixo do equipamento não cria uma segunda sala 10
    expect(normalizarSalaUnimed('10 ROBOTICA')).toBe('CC - Sala 10')
  })

  it('o bloco obstétrico NÃO é absorvido pela regra do CC', () => {
    // é o que torna seguro assumir "número solto = Centro Cirúrgico": o CO vem
    // sempre rotulado no mapa, e a regra dele corre antes
    expect(normalizarSalaUnimed('CO - Sala 3')).toBe('CO - Sala 3')
    expect(normalizarSalaUnimed('CO - CESAREA')).toBe('CO - Cesárea')
    expect(normalizarSalaUnimed('CENTRO OBSTETRICO 2')).toBe('CO - Sala 2')
  })

  it('zero à esquerda é a MESMA sala (produção tem "CC - Sala 01" e "CC - Sala 1")', () => {
    expect(normalizarSalaUnimed('CC - Sala 06')).toBe('CC - Sala 6')
    expect(normalizarSalaUnimed('CO - Sala 03')).toBe('CO - Sala 3')
    expect(normalizarSalaUnimed('06')).toBe('CC - Sala 6')
  })

  it('é idempotente e não toca nos locais que não são sala numerada', () => {
    for (const s of ['CC - Sala 6', 'CO - Cesárea', 'Hemodinâmica', 'SRPA', 'Exames',
      'Imagem', 'Consultório', 'Umanitá', 'Accurata']) {
      expect(normalizarSalaUnimed(s)).toBe(s)
      expect(normalizarSalaUnimed(normalizarSalaUnimed(s))).toBe(s)
    }
    // texto que não é sala volta como veio — o normalizador não inventa sala
    expect(normalizarSalaUnimed('MATERNO')).toBe('MATERNO')
    expect(normalizarSalaUnimed('')).toBe('')
  })

  it('a sala normalizada casa com a lista de escolha, sem duplicar a sala', () => {
    const casos = [{ sala: normalizarSalaUnimed('6') }, { sala: normalizarSalaUnimed('SALA 6') }]
    const salas = salasDoHospital('unimed', casos)
    expect(salas.filter((s) => s === 'CC - Sala 6')).toHaveLength(1)
    expect(salas).not.toContain('6')
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

describe('seção-clínica corrige a sala numérica (dono 27/08)', () => {
  // "na escala do HRO várias vezes está lendo as salas do IOSC como sendo Sala
  // 1, 2, 3 do HRO": a regra existe no prompt desde 24/07, mas quando a leitura
  // escorrega a linha do IOSC cai na Sala 1 do HRO — junto de OUTRO anestesista.
  // O bloco vem da mesma leitura e resolve sem depender de acerto de sala.
  it('IOSC com "Sala 1" vira IOSC — não a Sala 1 do HRO', () => {
    expect(normalizarSalaHro('Sala 1', 'iosc')).toBe('IOSC')
    expect(normalizarSalaHro('SALA 3', 'iosc')).toBe('IOSC')
  })

  it('Hospital de Olhos e Centro de Coluna seguem a mesma regra', () => {
    expect(normalizarSalaHro('Sala 2', 'ho')).toBe('Hospital de Olhos')
    expect(normalizarSalaHro('Sala 1', 'ccoluna')).toBe('Centro de Coluna')
  })

  it('sala VAZIA numa seção-clínica também assume o nome da seção', () => {
    expect(normalizarSalaHro('', 'iosc')).toBe('IOSC')
  })

  it('a sala já correta não muda', () => {
    expect(normalizarSalaHro('IOSC', 'iosc')).toBe('IOSC')
  })

  it('sem bloco de seção, a sala numérica continua sendo do HRO', () => {
    // o bloco normal é o caso comum — a correção não pode roubar salas do HRO
    expect(normalizarSalaHro('Sala 1', 'normal')).toBe('Sala 1')
    expect(normalizarSalaHro('Sala 1')).toBe('Sala 1')
    expect(normalizarSalaHro('Sala 1', 'exames')).toBe('Sala 1')
  })

  it('sala NOMEADA dentro da seção é preservada (só a numérica é interna)', () => {
    // "Hemodinâmica" numa linha marcada iosc é erro de bloco, não de sala:
    // trocar por "IOSC" apagaria o local que a leitura acertou
    expect(normalizarSalaHro('HEMO', 'iosc')).toBe('Hemodinâmica')
  })
})
