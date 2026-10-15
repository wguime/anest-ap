/**
 * Anestesista FORA DA ORDEM numa cirurgia lançada à mão (dono 15/10/2026).
 *
 * Fixture = o HRO da manhã de 15/10 às 11h28, reconstruído do banco: rodapé
 * publicado, quem tinha cirurgia aberta, quem já estava liberado. A urgência da
 * Sala 5 foi para o Rafael (último do rodapé da UNIMED) com a Karine (10º do HRO)
 * sem cirurgia desde 11:19 e não liberada — é ela a "próxima a ser chamada" pela
 * regra escolhida (1º livre de cima para baixo).
 */
import { describe, it, expect } from 'vitest'
import { avaliarEscolhaAnestesista, filaParaChamar, proximoAChamar } from '@/pages/escala-cirurgica/foraDaOrdem'

const UID = {
  DANIELA: 'u-dani', EDUARDO: 'u-edu', MARILIO: 'u-mar', THAYNA: 'u-tha', 'GUILHERME DIDOMENICO': 'u-gx',
  CRISTINA: 'u-cri', 'JOAO HENRIQUE': 'u-jh', 'GUILHERME MELO': 'u-melo', KLISMAN: 'u-kli', KARINE: 'u-kar',
  ROMULO: 'u-rom', ADRIANO: 'u-adr', RAQUEL: 'u-raq', RODNEI: 'u-rod', DIEGO: 'u-die',
  ERLEI: 'u-erl', NATHALIA: 'u-nat', RAFAEL: 'u-raf', PELISSARO: 'u-raf', OSCAR: 'u-osc', MELO: 'u-melo', 'JOAO H.': 'u-jh',
}
const resolverUid = (n) => UID[String(n || '').toUpperCase().trim()] || null

const caso = (anestesista, sala, o = {}) => ({
  id: `${anestesista}-${sala}`, turno: 'matutino', sala, hora: '07:00', anestesista,
  anestesistaUserId: resolverUid(anestesista), statusCirurgia: 'iniciada', ...o,
})
const lib = (em) => ({ liberadoEm: em, em, por: 'x' })

const hroRodape = ['DANIELA', 'EDUARDO', 'MARILIO', 'THAYNA', 'GUILHERME DIDOMENICO', 'CRISTINA', 'JOAO HENRIQUE',
  'GUILHERME MELO', 'KLISMAN', 'KARINE', 'ROMULO', 'ADRIANO', 'RAQUEL', 'RODNEI', 'DIEGO']

const montar = () => {
  const hro = {
    id: 'hro', hospital: 'hro', data: '2026-10-15',
    ordemLiberacao: { matutino: hroRodape },
    ajudaExterna: { matutino: ['ERLEI', 'NATHALIA'], ordemInformada: { matutino: true } },
    liberacoes: {
      'matutino:u-rod': lib('2026-10-15T13:47:40Z'), 'matutino:u-raq': lib('2026-10-15T14:11:28Z'),
      'matutino:u-nat': lib('2026-10-15T12:12:56Z'), 'matutino:u-adr': lib('2026-10-15T14:16:02Z'),
      'matutino:u-erl': lib('2026-10-15T12:26:50Z'), 'matutino:u-die': lib('2026-10-15T13:00:00Z'),
    },
    casos: [
      caso('DANIELA', 'Sala 8', { statusCirurgia: 'agendada', hora: '' }),
      caso('EDUARDO', 'Sala 8', { statusCirurgia: 'agendada', hora: '11:30' }),
      caso('MARILIO', 'Sala 3'), caso('THAYNA', 'Sala 1'), caso('GUILHERME DIDOMENICO', 'Hospital de Olhos'),
      caso('CRISTINA', 'IOSC'), caso('JOAO H.', 'Sala 9', { statusCirurgia: 'agendada', hora: '10:30' }),
      caso('MELO', 'Bloco M - Sala 2', { statusCirurgia: 'agendada', hora: 'AS' }),
      caso('KLISMAN', 'Centro de Coluna'), caso('ROMULO', 'Exames'),
      // a Karine terminou às 11:19 e ninguém a liberou
      caso('KARINE', 'Sala 5', { statusCirurgia: 'terminada', inicioReal: '09:10', terminoReal: '11:19' }),
    ],
  }
  const unimed = {
    id: 'uni', hospital: 'unimed', data: '2026-10-15',
    ordemLiberacao: { matutino: ['FERNANDA', 'JOAO RICARDO', 'OSCAR', 'TIAGO', 'ERLEI', 'NATHALIA', 'RAFAEL'] },
    ajudaExterna: { matutino: [] }, liberacoes: {}, casos: [],
  }
  return { hro, unimed }
}

const avaliar = (escalas, pessoa, o = {}) => avaliarEscolhaAnestesista({
  escalas, escala: escalas.hro, turno: 'matutino', pessoa, resolverUid, ...o,
})

describe('o próximo a ser chamado é o 1º livre de cima para baixo (15/10, HRO 11h28)', () => {
  it('é a Karine: os 9 de cima estão em sala e os de baixo já foram liberados', () => {
    const { hro, unimed } = montar()
    const p = proximoAChamar(filaParaChamar({ escalas: { hro, unimed }, escala: hro, turno: 'matutino', resolverUid }))
    expect(p.nome).toBe('KARINE')
    expect(p.posicao).toBe(10)
  })

  it('o Rafael (último do rodapé da Unimed) é fora da ordem — com o porquê e quem seria o próximo', () => {
    const escalas = montar()
    const av = avaliar(escalas, { uid: 'u-raf', nome: 'PELISSARO' })
    expect(av.foraDaOrdem).toBe(true)
    expect(av.motivos).toEqual([expect.objectContaining({ tipo: 'outroHospital', hospitalLabel: 'Unimed', posicao: 7, plantao: true })])
    expect(av.proximo).toEqual(expect.objectContaining({ nome: 'KARINE', uid: 'u-kar', posicao: 10, livreDesde: '11:19' }))
  })

  it('escolher a própria Karine passa direto', () => {
    expect(avaliar(montar(), { uid: 'u-kar', nome: 'KARINE' }).foraDaOrdem).toBe(false)
  })

  it('escolher quem está em sala aqui é fora da ordem: "está trabalhando", com a sala', () => {
    const av = avaliar(montar(), { uid: 'u-kli', nome: 'KLISMAN' })
    expect(av.foraDaOrdem).toBe(true)
    expect(av.motivos).toEqual([expect.objectContaining({ tipo: 'trabalhando', sala: 'Centro de Coluna', status: 'iniciada' })])
  })

  it('escolher quem já foi liberado é fora da ordem, com a hora', () => {
    const av = avaliar(montar(), { uid: 'u-raq', nome: 'RAQUEL' })
    expect(av.foraDaOrdem).toBe(true)
    expect(av.motivos[0]).toEqual(expect.objectContaining({ tipo: 'liberado', hora: '11:11' }))
  })

  it('quem está em sala em OUTRO hospital também conta como ocupado', () => {
    const escalas = montar()
    escalas.unimed.casos = [{ ...caso('RAFAEL', 'CC - Sala 2'), turno: 'matutino' }]
    const av = avaliar(escalas, { uid: 'u-raf', nome: 'RAFAEL' })
    expect(av.motivos.map((m) => m.tipo)).toEqual(['trabalhando', 'outroHospital'])
    expect(av.motivos[0].hospitalLabel).toBe('Unimed')
  })
})

describe('ninguém livre: quem é de fora pede confirmação, quem é da fila passa', () => {
  const semLivre = () => {
    const e = montar()
    e.hro.liberacoes['matutino:u-kar'] = lib('2026-10-15T14:20:00Z')
    return e
  }

  it('sem próximo, o Rafael (de outro hospital) ainda pede confirmação — e o resumo diz por quê', () => {
    const av = avaliar(semLivre(), { uid: 'u-raf', nome: 'RAFAEL' })
    expect(av.proximo).toBeNull()
    expect(av.foraDaOrdem).toBe(true)
    expect(av.resumo).toEqual({ emCirurgia: 10, liberados: 7 })
  })

  it('a cirurgia que está MUDANDO de mão não deixa a pessoa ocupada (troca no detalhe)', () => {
    const e = semLivre()
    const av = avaliar(e, { uid: 'u-kli', nome: 'KLISMAN' }, { ignorarCasos: ['KLISMAN-Centro de Coluna'] })
    expect(av.motivos).toEqual([])
    expect(av.proximo?.nome).toBe('KLISMAN')
    expect(av.foraDaOrdem).toBe(false)
  })
})

describe('troca no detalhe: quem está passando a cirurgia não é sugerido para ela', () => {
  it('a Daniela entrega a única cirurgia aberta: fica "livre", mas o próximo segue sendo a Karine', () => {
    const e = montar()
    const av = avaliar(e, { uid: 'u-raf', nome: 'RAFAEL' }, { ignorarCasos: ['DANIELA-Sala 8'], quemSai: ['u-dani'] })
    expect(av.proximo?.nome).toBe('KARINE')
    // sem o `quemSai`, a própria Daniela viraria a próxima da cirurgia que ela entrega
    expect(avaliar(e, { uid: 'u-raf', nome: 'RAFAEL' }, { ignorarCasos: ['DANIELA-Sala 8'] }).proximo?.nome).toBe('DANIELA')
  })
})

describe('onde a regra não se aplica', () => {
  it('FDS (linha fds carregada) devolve null', () => {
    const e = montar()
    expect(avaliar({ ...e, fds: { id: 'f', hospital: 'fds' } }, { uid: 'u-raf', nome: 'RAFAEL' })).toBeNull()
  })

  it('à noite devolve null', () => {
    const e = montar()
    expect(avaliar(e, { uid: 'u-raf', nome: 'RAFAEL' }, { turno: 'noturno' })).toBeNull()
  })

  it('escala sem rodapé publicado no turno devolve null', () => {
    const e = montar()
    e.hro.ordemLiberacao = { matutino: [] }
    expect(avaliar(e, { uid: 'u-raf', nome: 'RAFAEL' })).toBeNull()
  })

  it('quem foi declarado ajuda em OUTRO hospital não é chamado aqui', () => {
    const e = montar()
    e.unimed.ajudaExterna = { matutino: ['KARINE'] }
    const p = proximoAChamar(filaParaChamar({ escalas: e, escala: e.hro, turno: 'matutino', resolverUid }))
    expect(p).toBeNull()
  })
})
