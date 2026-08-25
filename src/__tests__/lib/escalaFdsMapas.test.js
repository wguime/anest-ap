/**
 * Mapas cirúrgicos do fim de semana (dono 2026-08-22).
 *
 * O recorte é o REAL de 22–23/08/2026 — os arquivos que o dono recebeu no
 * sábado: mapa da Unimed de sábado, mapas do HRO de sábado e domingo, mais a
 * grade de posições. É nas linhas "AS" do HRO que a tarde se perdia.
 */
import { describe, it, expect } from 'vitest'
import {
  turnoDoCasoImportado, carimbarTurnos, classificarAnexoMapa, resumoMapa,
  anestesistaDoPosto, sugerirAtribuicoesDoPosto, chaveMapa, planoPublicacaoMapas,
  nomesDoMapa, reduzirCasoParaFilaFeriado,
} from '@/lib/escalaFdsMapas'

// grade real do documento de 22/08 (faixa → coluna → pessoa)
const GRADE_SABADO = {
  '7-13': { unimed: 'KARINE', hro: 'GABRIEL', ret1: 'ROMULO', ret2: 'DANIELA' },
  '13-19': { unimed: 'DANIELA', hro: 'ROMULO', ret1: 'KARINE', ret2: 'GABRIEL' },
  '19-07': { unimed: 'GABRIEL', hro: 'KARINE', ret1: 'DANIELA', ret2: 'CRISTINA' },
}

describe('turno do caso importado — a faixa do documento resolve o "AS"', () => {
  it('a HORA manda quando existe', () => {
    expect(turnoDoCasoImportado({ hora: '07:00', turno: 'vespertino' })).toBe('matutino')
    expect(turnoDoCasoImportado({ hora: '13:00', turno: 'matutino' })).toBe('vespertino')
  })

  it('linha "AS" da tarde do HRO fica na TARDE pela faixa, não pelo período do anexo', () => {
    // era o defeito: sem hora, o caso herdava o período selecionado no upload —
    // anexar de manhã levava as 3 cirurgias "AS" da tarde para a escala matutina
    const caso = { hora: 'AS', turno: 'vespertino', procedimento: 'ARTROPLASTIA TOTAL DE JOELHO' }
    expect(turnoDoCasoImportado(caso, 'matutino')).toBe('vespertino')
  })

  it('linha "AS" da manhã continua na MANHÃ mesmo anexando com a tarde selecionada', () => {
    const caso = { hora: 'AS', turno: 'matutino', procedimento: 'CESARIANA' }
    expect(turnoDoCasoImportado(caso, 'vespertino')).toBe('matutino')
  })

  it('sem hora e sem faixa, vale o período de quem chama (comportamento de sempre)', () => {
    expect(turnoDoCasoImportado({ hora: '', turno: '' }, 'vespertino')).toBe('vespertino')
    expect(turnoDoCasoImportado({})).toBe('matutino')
  })

  it('faixa inválida não vira turno', () => {
    expect(turnoDoCasoImportado({ turno: 'noturno' }, 'matutino')).toBe('matutino')
  })

  it('carimbarTurnos separa o mapa inteiro do HRO numa leitura só', () => {
    const mapaHro = [
      { hora: '07:00', turno: 'matutino', sala: 'Sala 1' },
      { hora: 'AS', turno: 'matutino', sala: 'Sala 1' },
      { hora: '07:00', turno: 'matutino', sala: 'Sala 2' },
      { hora: 'AS', turno: 'matutino', sala: 'Sala 2' },
      { hora: 'AS', turno: 'matutino', sala: 'Sala 2' },
      { hora: '13:00', turno: 'vespertino', sala: 'Sala 1' },
      { hora: 'AS', turno: 'vespertino', sala: 'Sala 1' },
      { hora: 'AS', turno: 'vespertino', sala: 'Sala 1' },
    ]
    const out = carimbarTurnos(mapaHro, 'matutino')
    expect(out.filter((c) => c.turno === 'matutino')).toHaveLength(5)
    expect(out.filter((c) => c.turno === 'vespertino')).toHaveLength(3)
  })
})

describe('campos persistidos pelo mapa do feriado', () => {
  it('guarda só o necessário para o card operacional, sem paciente/procedimento', () => {
    const reduzido = reduzirCasoParaFilaFeriado({
      hora: '08:00', turno: 'matutino', sala: 'Sala 1', cirurgiao: 'DR. X',
      anestesista: 'FERNANDA', anestesistaUserId: 'uid-f', semAnestesista: false,
      pacienteIniciais: 'AB', procedimento: 'PROCEDIMENTO', convenio: 'SUS', idade: '55',
    })
    expect(reduzido).toEqual({
      hora: '08:00', turno: 'matutino', sala: 'Sala 1', cirurgiao: 'DR. X',
      anestesista: 'FERNANDA', anestesistaUserId: 'uid-f', semAnestesista: false,
    })
    expect(reduzido).not.toHaveProperty('pacienteIniciais')
    expect(reduzido).not.toHaveProperty('procedimento')
  })
})

describe('classificação do anexo — o documento se declara', () => {
  const fds = { sabadoISO: '2026-08-22', domingoISO: '2026-08-23' }

  it('mapa do HRO de sábado encaixa sozinho', () => {
    const r = classificarAnexoMapa({ hospitalDetectado: 'hro', dataDetectada: '2026-08-22' }, fds)
    expect(r).toMatchObject({ hospital: 'hro', data: '2026-08-22' })
    expect(r.confirmar).toEqual([])
  })

  it('mapa do HRO de domingo encaixa no outro dia do mesmo fim de semana', () => {
    const r = classificarAnexoMapa({ hospitalDetectado: 'hro', dataDetectada: '2026-08-23' }, fds)
    expect(r.data).toBe('2026-08-23')
  })

  it('mapa do feriado encaixa na única data-alvo', () => {
    const r = classificarAnexoMapa(
      { hospitalDetectado: 'unimed', dataDetectada: '2026-08-25' },
      { datasAlvo: ['2026-08-25'] },
    )
    expect(r).toMatchObject({ hospital: 'unimed', data: '2026-08-25', confirmar: [] })
  })

  it('data de OUTRO fim de semana não encaixa e o motivo fica visível', () => {
    const r = classificarAnexoMapa({ hospitalDetectado: 'unimed', dataDetectada: '2026-08-15' }, fds)
    expect(r.data).toBe('')
    expect(r.dataForaDoFimDeSemana).toBe('2026-08-15')
    expect(r.confirmar).toContain('data')
  })

  it('layout não reconhecido pede o hospital em vez de escolher um', () => {
    const r = classificarAnexoMapa({ hospitalDetectado: '', dataDetectada: '2026-08-22' }, fds)
    expect(r.hospital).toBe('')
    expect(r.confirmar).toEqual(['hospital'])
  })

  it("a linha 'fds' nunca é hospital de mapa", () => {
    expect(classificarAnexoMapa({ hospitalDetectado: 'fds', dataDetectada: '2026-08-22' }, fds).hospital).toBe('')
  })
})

describe('resumo do mapa — o que a lista de documentos mostra', () => {
  it('conta por turno e acusa quem está sem anestesista', () => {
    // tarde do HRO em 22/08: 6 cirurgias, coluna do anestesista VAZIA nas 6
    const casos = [
      { hora: '07:00', turno: 'matutino', anestesista: 'THAYNA' },
      { hora: 'AS', turno: 'matutino', anestesista: '//' },
      { hora: '13:00', turno: 'vespertino', anestesista: '', semAnestesista: true },
      { hora: 'AS', turno: 'vespertino', anestesista: '?', semAnestesista: true },
    ]
    expect(resumoMapa(casos)).toEqual({ total: 4, matutino: 2, vespertino: 2, semAnestesista: 2 })
  })

  it('mapa vazio não quebra', () => {
    expect(resumoMapa(null)).toEqual({ total: 0, matutino: 0, vespertino: 0, semAnestesista: 0 })
  })
})

describe('sugestão pelo posto da grade (dono 2026-08-22)', () => {
  it('o HRO da tarde é de quem está na faixa 13-19 da coluna HRO', () => {
    expect(anestesistaDoPosto(GRADE_SABADO, 'hro', 'vespertino')).toBe('ROMULO')
    expect(anestesistaDoPosto(GRADE_SABADO, 'unimed', 'matutino')).toBe('KARINE')
  })

  it('materno não tem coluna de posto — não sugere ninguém', () => {
    expect(anestesistaDoPosto(GRADE_SABADO, 'materno', 'matutino')).toBe('')
  })

  it('sem grade não inventa', () => {
    expect(anestesistaDoPosto(null, 'hro', 'matutino')).toBe('')
    expect(anestesistaDoPosto(GRADE_SABADO, 'hro', 'noturno')).toBe('KARINE') // faixa 19-07
  })

  it('sugere só onde o mapa não trouxe nome', () => {
    const grupos = [
      { chave: 'Sala 1', nome: '' },        // tarde do HRO: coluna vazia
      { chave: 'Sala 4', nome: '?' },       // ausência declarada também recebe
      { chave: 'Sala 2', nome: 'THAYNA' },  // nome lido do documento: intocado
    ]
    const out = sugerirAtribuicoesDoPosto(grupos, 'ROMULO', (n) => (n === 'ROMULO' ? 'uid-romulo' : null))
    expect(Object.keys(out).sort()).toEqual(['Sala 1', 'Sala 4'])
    expect(out['Sala 1']).toEqual({ uid: 'uid-romulo', nome: 'ROMULO', origem: 'grade' })
    expect(out['Sala 2']).toBeUndefined()
  })

  it('posto sem login resolvido não pré-seleciona nada (nunca chuta identidade)', () => {
    const grupos = [{ chave: 'Sala 1', nome: '' }]
    expect(sugerirAtribuicoesDoPosto(grupos, 'ROMULO', () => null)).toEqual({})
    expect(sugerirAtribuicoesDoPosto(grupos, '', () => 'uid')).toEqual({})
  })
})

describe('plano de publicação', () => {
  const mapas = [
    {
      id: 'a', hospital: 'unimed', data: '2026-08-22',
      casos: [
        { hora: '07:30', turno: 'matutino' }, { hora: 'AS', turno: 'matutino' },
        { hora: '13:30', turno: 'vespertino' },
      ],
    },
    {
      id: 'b', hospital: 'hro', data: '2026-08-23',
      casos: [{ hora: '07:00', turno: 'matutino' }, { hora: 'AS', turno: 'matutino' }],
    },
  ]

  it('uma publicação por hospital, dia e turno COM casos', () => {
    const plano = planoPublicacaoMapas(mapas)
    expect(plano.map((p) => `${p.hospital}|${p.data}|${p.turno}|${p.casos.length}`)).toEqual([
      'unimed|2026-08-22|matutino|2',
      'unimed|2026-08-22|vespertino|1',
      'hro|2026-08-23|matutino|2',
    ])
  })

  it('turno sem caso NÃO é publicado (a RPC substitui o turno inteiro)', () => {
    // domingo do HRO não tem tarde: publicar vazio apagaria o que estivesse lá
    expect(planoPublicacaoMapas(mapas).some((p) => p.hospital === 'hro' && p.turno === 'vespertino')).toBe(false)
  })

  it('mapa sem hospital ou sem data fica fora do plano', () => {
    expect(planoPublicacaoMapas([{ id: 'x', hospital: '', data: '2026-08-22', casos: [{ hora: '07:00' }] }])).toEqual([])
    expect(planoPublicacaoMapas([{ id: 'x', hospital: 'hro', data: '', casos: [{ hora: '07:00' }] }])).toEqual([])
  })
})

describe('chave do mapa e nomes lidos', () => {
  it('mesmo hospital e dia = mesma chave (reanexar substitui, não duplica)', () => {
    expect(chaveMapa('hro', '2026-08-22')).toBe(chaveMapa('hro', '2026-08-22'))
    expect(chaveMapa('hro', '2026-08-22')).not.toBe(chaveMapa('hro', '2026-08-23'))
  })

  it('lista os nomes distintos, sem "//" nem "?"', () => {
    const casos = [
      { anestesista: 'GARIM' }, { anestesista: '//' }, { anestesista: '?' },
      { anestesista: 'garim' }, { anestesista: 'KARINE + MAURICIO' }, { anestesista: '' },
    ]
    expect(nomesDoMapa(casos)).toEqual(['GARIM', 'KARINE + MAURICIO'])
  })
})
