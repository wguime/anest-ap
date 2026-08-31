/**
 * Lote de importação do dia útil (dono 2026-08-27) — anexar as escalas dos
 * hospitais de uma vez, uma aba de conferência por hospital.
 *
 * Os casos são os reais de um dia útil: Excel da Unimed (sem cabeçalho de data
 * nem layout reconhecível pela Vision), foto do HRO e foto do Materno.
 */
import { describe, it, expect } from 'vitest'
import {
  chaveEscala, classificarAnexoDiaUtil, estadoEscala,
  planoPublicacaoLote, rotuloPublicacaoLote, resumirPublicacaoLote,
} from '@/lib/escalaLoteImportacao'

describe('classificação do anexo — o documento se declara', () => {
  it('a foto do HRO entra pelo layout que a leitura reconheceu', () => {
    const cls = classificarAnexoDiaUtil(
      { hospitalDetectado: 'hro', dataDetectada: '2026-08-27' },
      { dataDoLote: '2026-08-27' },
    )
    expect(cls.hospital).toBe('hro')
    expect(cls.origemHospital).toBe('layout')
    expect(cls.confirmar).toEqual([])
    expect(cls.dataDivergente).toBe('')
  })

  it('Excel/CSV é o export padrão da Unimed — a extensão resolve o hospital', () => {
    // o parser local não devolve hospitalDetectado nem dataDetectada
    const cls = classificarAnexoDiaUtil({}, { planilha: true, dataDoLote: '2026-08-27' })
    expect(cls.hospital).toBe('unimed')
    expect(cls.origemHospital).toBe('planilha')
    expect(cls.confirmar).toEqual([])
  })

  it('layout não reconhecido PEDE o hospital em vez de chutar', () => {
    const cls = classificarAnexoDiaUtil({ hospitalDetectado: '' }, { dataDoLote: '2026-08-27' })
    expect(cls.hospital).toBe('')
    expect(cls.confirmar).toEqual(['hospital'])
  })

  it('valor fora da lista de hospitais não vira hospital', () => {
    const cls = classificarAnexoDiaUtil({ hospitalDetectado: 'santa casa' }, { dataDoLote: '2026-08-27' })
    expect(cls.hospital).toBe('')
    expect(cls.confirmar).toEqual(['hospital'])
  })

  it('data de OUTRO dia é avisada, mas não redefine o dia do lote', () => {
    // anexar por engano o mapa de ontem: a data do lote continua mandando —
    // quem escolhe o dia da importação é o cartão, não o arquivo
    const cls = classificarAnexoDiaUtil(
      { hospitalDetectado: 'materno', dataDetectada: '2026-08-26' },
      { dataDoLote: '2026-08-27' },
    )
    expect(cls.hospital).toBe('materno')
    expect(cls.dataDivergente).toBe('2026-08-26')
  })

  it('data ilegível não vira divergência (a leitura só não achou o cabeçalho)', () => {
    const cls = classificarAnexoDiaUtil(
      { hospitalDetectado: 'hro', dataDetectada: '' },
      { dataDoLote: '2026-08-27' },
    )
    expect(cls.dataDivergente).toBe('')
  })

  it('layout vazio: o CONTEÚDO segura o arquivo (dono 30/08)', () => {
    // a assinatura do HRO é a cor da planilha, e print desbotado não entrega
    // cor — mas IOSC e Hemodinâmica não existem em mais nenhuma escala
    const cls = classificarAnexoDiaUtil(
      { hospitalDetectado: '', casos: [{ sala: 'IOSC', bloco: 'iosc' }] },
      { dataDoLote: '2026-08-31' },
    )
    expect(cls.hospital).toBe('hro')
    expect(cls.origemHospital).toBe('estrutura')
    expect(cls.confirmar).toEqual([])
  })

  it('planilha COM coluna Leito é do HRO, não da Unimed', () => {
    // "planilha = Unimed" valia enquanto só a Unimed exportava planilha; o mapa
    // do HRO em .xlsx ia inteiro para a aba da Unimed, por cima dela
    const cls = classificarAnexoDiaUtil(
      { casos: [{ sala: 'Sala 3' }], headers: ['Hora', 'Leito', 'Paciente', 'ANEST'] },
      { planilha: true, dataDoLote: '2026-08-31' },
    )
    expect(cls.hospital).toBe('hro')
  })

  it('layout e conteúdo discordando PERGUNTA, e diz o que o conteúdo viu', () => {
    const cls = classificarAnexoDiaUtil(
      {
        hospitalDetectado: 'materno',
        casos: [{ sala: 'IOSC', bloco: 'iosc' }, { sala: 'Hemodinâmica', bloco: 'hemodinamica' }],
      },
      { dataDoLote: '2026-08-31' },
    )
    expect(cls.hospital).toBe('')
    expect(cls.conflitoHospital).toBe('hro')
    expect(cls.hospitalLido).toBe('materno')
    expect(cls.confirmar).toEqual(['hospital'])
  })

  it('uma marca solta NÃO derruba o layout que a leitura afirmou', () => {
    const cls = classificarAnexoDiaUtil(
      { hospitalDetectado: 'unimed', casos: [{ sala: 'IOSC', bloco: 'iosc' }] },
      { dataDoLote: '2026-08-31' },
    )
    expect(cls.hospital).toBe('unimed')
    expect(cls.conflitoHospital).toBe('')
  })

  it('a chave do item é o HOSPITAL — reanexar o mesmo hospital substitui', () => {
    // diferente do fim de semana, onde a chave é hospital+dia: aqui o dia é do lote
    expect(chaveEscala('hro')).toBe(chaveEscala('hro'))
    expect(chaveEscala('hro')).not.toBe(chaveEscala('unimed'))
  })
})

describe('estado da aba — mesma taxonomia da conferência', () => {
  it('bloqueio vence aviso: o selo mostra o que impede publicar', () => {
    expect(estadoEscala({ casos: 12, bloqueios: 1, avisos: 3 })).toEqual({ tipo: 'trava', n: 1 })
  })

  it('só avisos = âmbar, com a contagem', () => {
    expect(estadoEscala({ casos: 15, bloqueios: 0, avisos: 2 })).toEqual({ tipo: 'avisa', n: 2 })
  })

  it('nada pendente e com casos = pronto', () => {
    expect(estadoEscala({ casos: 6, bloqueios: 0, avisos: 0 })).toEqual({ tipo: 'pronto', n: 0 })
  })

  it('escala sem caso nenhum é VAZIA, não "pronta"', () => {
    // publicar vazio apagaria o turno inteiro no banco (a RPC substitui o turno)
    expect(estadoEscala({ casos: 0, bloqueios: 0, avisos: 0 })).toEqual({ tipo: 'vazio', n: 0 })
  })
})

describe('plano de publicação do lote', () => {
  const LOTE = [
    { hospital: 'unimed', casos: 12, bloqueios: 0, avisos: 0 },
    { hospital: 'hro', casos: 15, bloqueios: 0, avisos: 2 },
    { hospital: 'materno', casos: 6, bloqueios: 0, avisos: 0 },
  ]

  it('as três prontas publicam, na ordem em que estão', () => {
    const plano = planoPublicacaoLote(LOTE)
    expect(plano.publicar.map((p) => p.hospital)).toEqual(['unimed', 'hro', 'materno'])
    expect(plano.foraDoLote).toEqual([])
    expect(rotuloPublicacaoLote(plano)).toBe('Publicar as 3')
  })

  it('AVISO não segura a publicação — só bloqueio segura', () => {
    const plano = planoPublicacaoLote(LOTE)
    expect(plano.publicar.find((p) => p.hospital === 'hro')?.avisos).toBe(2)
  })

  it('hospital travado fica de fora COM o motivo, e não impede os outros', () => {
    // escala precisa publicar: um nome ambíguo no HRO não pode deixar Unimed e
    // Materno sem escala nenhuma
    const plano = planoPublicacaoLote([
      { hospital: 'unimed', casos: 12, bloqueios: 0, avisos: 0 },
      { hospital: 'hro', casos: 15, bloqueios: 1, avisos: 2 },
      { hospital: 'materno', casos: 6, bloqueios: 0, avisos: 0 },
    ])
    expect(plano.publicar.map((p) => p.hospital)).toEqual(['unimed', 'materno'])
    expect(plano.foraDoLote).toEqual([{ hospital: 'hro', motivo: 'bloqueio', n: 1 }])
    expect(rotuloPublicacaoLote(plano)).toBe('Publicar as 2 prontas')
  })

  it('escala vazia não é publicada — publicar vazio apaga o turno', () => {
    const plano = planoPublicacaoLote([
      { hospital: 'unimed', casos: 12, bloqueios: 0, avisos: 0 },
      { hospital: 'materno', casos: 0, bloqueios: 0, avisos: 0 },
    ])
    expect(plano.publicar.map((p) => p.hospital)).toEqual(['unimed'])
    expect(plano.foraDoLote).toEqual([{ hospital: 'materno', motivo: 'vazia', n: 0 }])
    expect(rotuloPublicacaoLote(plano)).toBe('Publicar a escala')
  })

  it('sobrou uma pronta e uma travada: o rótulo não deixa parecer que o lote todo saiu', () => {
    const plano = planoPublicacaoLote([
      { hospital: 'unimed', casos: 12, bloqueios: 0, avisos: 0 },
      { hospital: 'hro', casos: 15, bloqueios: 2, avisos: 0 },
    ])
    expect(rotuloPublicacaoLote(plano)).toBe('Publicar a que está pronta')
  })

  it('tudo travado: nada a publicar', () => {
    const plano = planoPublicacaoLote([{ hospital: 'hro', casos: 15, bloqueios: 1, avisos: 0 }])
    expect(plano.publicar).toEqual([])
    expect(rotuloPublicacaoLote(plano)).toBe('Nada a publicar')
  })

  it('item sem hospital é ignorado (o item do lote ainda não se declarou)', () => {
    const plano = planoPublicacaoLote([{ hospital: '', casos: 9, bloqueios: 0, avisos: 0 }])
    expect(plano.publicar).toEqual([])
    expect(plano.foraDoLote).toEqual([])
  })
})

describe('relato depois de publicar em sequência', () => {
  it('as três publicadas', () => {
    const r = resumirPublicacaoLote([
      { hospital: 'unimed', ok: true }, { hospital: 'hro', ok: true }, { hospital: 'materno', ok: true },
    ])
    expect(r).toEqual({ ok: ['unimed', 'hro', 'materno'], falhou: [], tudoCerto: true })
  })

  it('falha no meio: quem JÁ publicou é dito por nome — a publicação não é transacional', () => {
    // esconder isso faria republicar por cima do que já está no ar
    const r = resumirPublicacaoLote([
      { hospital: 'unimed', ok: true }, { hospital: 'hro', ok: false }, { hospital: 'materno', ok: true },
    ])
    expect(r.ok).toEqual(['unimed', 'materno'])
    expect(r.falhou).toEqual(['hro'])
    expect(r.tudoCerto).toBe(false)
  })

  it('nenhuma publicada não conta como sucesso', () => {
    const r = resumirPublicacaoLote([{ hospital: 'unimed', ok: false }])
    expect(r.tudoCerto).toBe(false)
  })
})
