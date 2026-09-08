/**
 * Travas da pontuação do eval da Vision (Onda 4, item 4.1).
 *
 * Um eval errado é pior que nenhum: ele autoriza uma mudança ruim com um número
 * na mão. Estes testes travam as três formas de o placar mentir que a auditoria
 * de 02/09 deixaria passar:
 *   - contar como "achou" um caso cuja sala foi corrigida (casamento frouxo);
 *   - dar rodapé certo quando os nomes estão todos lá mas na ordem trocada — a
 *     ordem de liberação é a ordem, não o conjunto;
 *   - premiar quem inventa (nome fora do mapa, caso a mais) sem registrar.
 */
import { describe, it, expect } from 'vitest'
import {
  horaChave, primeiroNome, casarCasos, compararOrdem, compararConjunto,
  pontuarLeitura, agregar, custoDaLeitura,
} from './escalaVisionEval.mjs'

describe('chaves de comparação', () => {
  it('canoniza hora escrita de todo jeito', () => {
    expect(horaChave('7:30')).toBe('07:30')
    expect(horaChave('07h30')).toBe('07:30')
    expect(horaChave('07:30')).toBe('07:30')
    expect(horaChave('A SEGUIR')).toBe('AS')
    expect(horaChave('as')).toBe('AS')
    expect(horaChave('')).toBe('')
  })

  it('colapsa o nome no primeiro, sem acento e sem o prefixo Ped', () => {
    expect(primeiroNome('Ped. Janaína')).toBe('JANAINA')
    expect(primeiroNome('GUILHERME M ELO')).toBe('GUILHERME')
    expect(primeiroNome('João H.')).toBe('JOAO')
  })
})

describe('casamento de casos', () => {
  const esperados = [
    { sala: 'Sala 1', hora: '07:30', iniciais: 'M.S.', procedimento: 'COLECISTECTOMIA', anestesista: 'ANA' },
    { sala: 'Hemodinâmica', hora: '09:00', iniciais: 'J.P.', procedimento: 'ANGIOPLASTIA', anestesista: 'BETO' },
  ]

  it('casa por sala+hora+iniciais e reconhece o caso que sumiu', () => {
    const { pares, faltando } = casarCasos(esperados, [
      { sala: 'SALA1', hora: '7:30', pacienteIniciais: 'M.S.', procedimento: 'COLECISTECTOMIA', anestesista: 'ANA' },
    ])
    expect(pares).toHaveLength(1)
    expect(faltando).toHaveLength(1)
    expect(faltando[0].sala).toBe('Hemodinâmica')
  })

  it('ainda casa quando só a sala foi lida errada (hora + procedimento)', () => {
    const { pares, faltando } = casarCasos([esperados[1]], [
      { sala: 'Sala 2', hora: '09:00', pacienteIniciais: '', procedimento: 'ANGIOPLASTIA INTRALUMINAL', anestesista: 'BETO' },
    ])
    expect(pares).toHaveLength(1)
    expect(faltando).toHaveLength(0)
  })

  it('NÃO casa dois casos que só têm a hora em comum', () => {
    const { pares, faltando, sobrando } = casarCasos([esperados[0]], [
      { sala: 'Sala 9', hora: '07:30', pacienteIniciais: 'X.Y.', procedimento: 'CATARATA', anestesista: 'ZE' },
    ])
    expect(pares).toHaveLength(0)
    expect(faltando).toHaveLength(1)
    expect(sobrando).toHaveLength(1)
  })

  it('não deixa um caso lido casar com dois esperados', () => {
    const { pares, faltando } = casarCasos(
      [esperados[0], { ...esperados[0], iniciais: 'A.B.' }],
      [{ sala: 'Sala 1', hora: '07:30', pacienteIniciais: 'M.S.', procedimento: 'COLECISTECTOMIA' }],
    )
    expect(pares).toHaveLength(1)
    expect(faltando).toHaveLength(1)
  })
})

describe('rodapé — a ordem é a ordem', () => {
  it('conjunto certo com ordem trocada NÃO é rodapé certo', () => {
    const r = compararOrdem(['ANA', 'BETO', 'CARLA'], ['BETO', 'ANA', 'CARLA'])
    expect(r.presentes).toBe(3)      // todos os nomes estão lá
    expect(r.posicoesCertas).toBe(1) // só a última posição bate
    expect(r.exato).toBe(false)
  })

  it('marca exato só quando a lista inteira coincide', () => {
    expect(compararOrdem(['ANA', 'BETO'], ['Ana', 'BETO']).exato).toBe(true)
    expect(compararOrdem(['ANA', 'BETO'], ['ANA', 'BETO', 'CARLA']).exato).toBe(false)
  })

  it('registra nome inventado sem deixar de contar os que faltaram', () => {
    const r = compararOrdem(['ANA', 'BETO'], ['ANA', 'TIAGO'])
    expect(r.faltando).toEqual(['BETO'])
    expect(r.inventados).toEqual(['TIAGO'])
    expect(r.posicoesCertas).toBe(1)
  })
})

describe('pontuação e agregação', () => {
  const gabarito = {
    arquivo: '10.jpeg',
    hospital: 'unimed',
    data: '2026-07-01',
    casos: [
      { sala: 'Sala 1', hora: '07:30', iniciais: 'M.S.', procedimento: 'COLE', anestesista: 'ANA' },
      { sala: 'Exames', hora: '08:00', iniciais: '', procedimento: 'EDA', anestesista: 'CRISTINA' },
    ],
    rodape: ['ANA', 'BETO', 'CRISTINA'],
    ajuda: ['CRISTINA'],
  }

  it('separa "o caso sumiu" de "o anestesista está errado"', () => {
    const p = pontuarLeitura(gabarito, {
      casos: [{ sala: 'Sala 1', hora: '07:30', pacienteIniciais: 'M.S.', procedimento: 'COLE', anestesista: 'TIAGO' }],
      ordemLiberacao: ['ANA', 'BETO', 'CRISTINA'],
      ajudaExterna: [],
      hospitalDetectado: 'unimed',
      dataDetectada: '2026-07-01',
    })
    expect(p.casos.casados).toBe(1)
    expect(p.casos.faltando).toHaveLength(1)     // a linha de Exames sumiu
    expect(p.anestesista.total).toBe(1)          // só o caso que casou entra na conta
    expect(p.anestesista.certos).toBe(0)         // e nele o nome está errado
    expect(p.ajuda.acertos).toBe(0)              // o azul não foi reconhecido
    expect(p.rodape.exato).toBe(true)
    expect(p.hospital.certo).toBe(true)
  })

  it('não deixa linha sem anestesista no gabarito contar a favor', () => {
    const p = pontuarLeitura(
      { casos: [{ sala: 'S1', hora: '07:00', anestesista: '' }], rodape: [], ajuda: [] },
      { casos: [{ sala: 'S1', hora: '07:00', anestesista: 'QUEM' }], ordemLiberacao: [], ajudaExterna: [] },
    )
    expect(p.anestesista.total).toBe(0)
    expect(p.anestesista.certos).toBe(0)
  })

  it('agrega várias fotos sem virar uma nota única', () => {
    const a = agregar([
      pontuarLeitura(gabarito, { casos: gabarito.casos.map((c) => ({ ...c, pacienteIniciais: c.iniciais })), ordemLiberacao: gabarito.rodape, ajudaExterna: gabarito.ajuda, hospitalDetectado: 'unimed', dataDetectada: '2026-07-01' }),
      pontuarLeitura(gabarito, { casos: [], ordemLiberacao: [], ajudaExterna: [], hospitalDetectado: '', dataDetectada: '' }),
    ])
    expect(a.fotos).toBe(2)
    expect(a.casos.esperados).toBe(4)
    expect(a.casos.encontrados).toBe(2)
    expect(a.casos.acerto).toBe(50)
    expect(a.rodape.exatos).toBe(1)
    expect(a.hospital.certos).toBe(1)
  })
})

describe('custo por leitura', () => {
  it('cobra cache lido a 0,1× e cache escrito a 1,25× da entrada', () => {
    const semCache = custoDaLeitura({
      modelo: 'claude-opus-4-8', input_tokens: 1_000_000, output_tokens: 0,
      cache_read_tokens: 0, cache_write_tokens: 0,
    })
    expect(semCache).toBeCloseTo(5, 6)
    expect(custoDaLeitura({ modelo: 'claude-opus-4-8', cache_read_tokens: 1_000_000 })).toBeCloseTo(0.5, 6)
    expect(custoDaLeitura({ modelo: 'claude-opus-4-8', cache_write_tokens: 1_000_000 })).toBeCloseTo(6.25, 6)
    expect(custoDaLeitura({ modelo: 'claude-opus-4-8', output_tokens: 1_000_000 })).toBeCloseTo(25, 6)
  })

  it('a leitura típica de hoje fica na ordem de 10 centavos', () => {
    const c = custoDaLeitura({
      modelo: 'claude-opus-4-8', input_tokens: 5700, output_tokens: 2800,
      cache_read_tokens: 0, cache_write_tokens: 0,
    })
    expect(c).toBeGreaterThan(0.08)
    expect(c).toBeLessThan(0.12)
  })
})
