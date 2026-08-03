/**
 * Convivência manhã/tarde no mesmo dia (decisão do dono 23/07): publicar a tarde
 * NÃO pode apagar a manhã. Cobre os helpers puros do merge por turno + rodapé
 * por-turno (formato legado array E novo {matutino,vespertino}).
 */
import { describe, it, expect } from 'vitest'
import {
  filtrarPorTurno as _filtrarPorTurno,
  turnoDoCaso as _turnoDoCaso,
  turnoDeHora,
  selecionarCasosDoTurno,
} from '../../pages/escala-cirurgica/utils'
import {
  detectarItensDuplicados,
  ehPosicaoAssistencial,
  filtrarItensImportados,
  resumirItensEscala,
} from '../../lib/escalaCirurgicaItens'

// Turno EXPLÍCITO do caso (bug do SRPA, dono 26/07): antes, caso sem hora era
// tratado como matutino na PUBLICAÇÃO e mostrado nos DOIS turnos na EXIBIÇÃO —
// o SRPA da manhã vazava para a tarde. Agora é uma regra só.
describe('turno do caso — publicação e exibição usam a MESMA regra', () => {
  it('turno explícito vence a hora', () => {
    expect(_turnoDoCaso({ turno: 'vespertino', hora: '08:00' })).toBe('vespertino')
    expect(_turnoDoCaso({ turno: 'matutino', hora: '15:00' })).toBe('matutino')
  })
  it('sem turno explícito, deduz pela hora (legado)', () => {
    expect(_turnoDoCaso({ hora: '08:00' })).toBe('matutino')
    expect(_turnoDoCaso({ hora: '15:00' })).toBe('vespertino')
  })
  it('sem turno e sem hora cai em matutino (mesma suposição do merge)', () => {
    expect(_turnoDoCaso({ sala: 'SRPA' })).toBe('matutino')
  })
  it('SRPA sem hora publicado na MANHÃ não aparece na tarde', () => {
    const casos = [
      { sala: 'SRPA', turno: 'matutino' },
      { sala: 'CC - Sala 1', hora: '08:00', turno: 'matutino' },
      { sala: 'CC - Sala 2', hora: '14:00', turno: 'vespertino' },
    ]
    expect(_filtrarPorTurno(casos, 'vespertino').map((c) => c.sala)).toEqual(['CC - Sala 2'])
    expect(_filtrarPorTurno(casos, 'matutino').map((c) => c.sala)).toEqual(['SRPA', 'CC - Sala 1'])
  })
  it('SRPA sem hora publicado na TARDE fica na tarde (o que a coluna resolve)', () => {
    const casos = [{ sala: 'SRPA', turno: 'vespertino' }]
    expect(_filtrarPorTurno(casos, 'vespertino')).toHaveLength(1)
    expect(_filtrarPorTurno(casos, 'matutino')).toHaveLength(0)
  })
})
import { turnoDoCaso, rodapeDoTurno, mergeRodapeTurno, mergeCasosPorTurno } from '../../pages/escala-cirurgica/utils'

describe('turnoDoCaso', () => {
  it('particiona pela hora; sem hora → matutino (bloco montado de manhã)', () => {
    expect(turnoDoCaso({ hora: '07:30' })).toBe('matutino')
    expect(turnoDoCaso({ hora: '12:45' })).toBe('matutino')
    expect(turnoDoCaso({ hora: '13:00' })).toBe('vespertino')
    expect(turnoDoCaso({ hora: '18:30' })).toBe('vespertino')
    expect(turnoDoCaso({ hora: '' })).toBe('matutino')
    expect(turnoDoCaso({})).toBe('matutino')
  })

  it('hora inválida não é classificada silenciosamente', () => {
    expect(turnoDeHora('08:00h')).toBe('matutino')
    expect(turnoDeHora('24:00')).toBeNull()
    expect(turnoDeHora('08:75')).toBeNull()
    expect(turnoDeHora('03/08/2026')).toBeNull()
  })
})

describe('mergeCasosPorTurno — publicar 1 turno preserva o outro', () => {
  const manha = [
    { id: 'm1', sala: 'CC - Sala 1', hora: '07:30', anestesista: 'TIAGO' },
    { id: 'm2', sala: 'SRPA', hora: '', anestesista: 'STAUB' }, // sem hora → matutino
  ]
  it('publicar VESPERTINO mantém a manhã e acrescenta a tarde', () => {
    const tarde = [{ id: 't1', sala: 'CC - Sala 1', hora: '14:00', anestesista: 'MELO' }]
    const out = mergeCasosPorTurno(manha, tarde, 'vespertino')
    expect(out.map((c) => c.id)).toEqual(['m1', 'm2', 't1']) // manhã preservada + tarde
  })
  it('publicar MATUTINO substitui só a manhã e mantém a tarde', () => {
    const dia = [...manha, { id: 't1', sala: 'CC - Sala 1', hora: '14:00', anestesista: 'MELO' }]
    const novaManha = [{ id: 'm9', sala: 'CC - Sala 2', hora: '08:00', anestesista: 'DIEGO' }]
    const out = mergeCasosPorTurno(dia, novaManha, 'matutino')
    expect(out.map((c) => c.id)).toEqual(['t1', 'm9']) // tarde preservada + nova manhã (m1/m2 fora)
  })
  it('dia vazio + nova manhã = só a manhã', () => {
    expect(mergeCasosPorTurno([], manha, 'matutino').map((c) => c.id)).toEqual(['m1', 'm2'])
  })
})

describe('rodapé por-turno', () => {
  it('rodapeDoTurno: array legado vale p/ qualquer turno; objeto seleciona o turno', () => {
    expect(rodapeDoTurno(['A', 'B'], 'vespertino')).toEqual(['A', 'B'])
    expect(rodapeDoTurno({ matutino: ['A'], vespertino: ['X', 'Y'] }, 'vespertino')).toEqual(['X', 'Y'])
    expect(rodapeDoTurno({ matutino: ['A'] }, 'vespertino')).toEqual([])
    expect(rodapeDoTurno(null, 'matutino')).toEqual([])
  })
  it('mergeRodapeTurno: grava o turno preservando o outro; array legado vira matutino', () => {
    // legado + publicar tarde → matutino preservado, vespertino gravado
    expect(mergeRodapeTurno(['A', 'B'], 'vespertino', ['X', 'Y'])).toEqual({ matutino: ['A', 'B'], vespertino: ['X', 'Y'] })
    // objeto + publicar matutino → sobrescreve só matutino
    expect(mergeRodapeTurno({ matutino: ['A'], vespertino: ['X'] }, 'matutino', ['C'])).toEqual({ matutino: ['C'], vespertino: ['X'] })
    // vazio → só o turno publicado
    expect(mergeRodapeTurno(null, 'matutino', ['C'])).toEqual({ matutino: ['C'] })
    expect(mergeRodapeTurno([], 'vespertino', ['X'])).toEqual({ vespertino: ['X'] })
  })
})

// O mapa do Materno vem com manhã E tarde no mesmo anexo. A publicação deve
// aceitar somente o período selecionado, senão a segunda importação duplica o dia.
describe('selecionarCasosDoTurno — anexo misto do Materno', () => {
  const mapa = [
    { id: 'm1', hora: '07:30' },
    { id: 'm2', hora: '11:30' },
    { id: 't1', hora: '13:30' },
    { id: 't2', hora: '15:30' },
    { id: 'sem-hora', hora: '' },
  ]

  it('Matutino recebe só a manhã; sem hora segue o período escolhido', () => {
    const out = selecionarCasosDoTurno(mapa, 'matutino')
    expect(out.map((c) => c.id)).toEqual(['m1', 'm2', 'sem-hora'])
    expect(out.every((c) => c.turno === 'matutino')).toBe(true)
  })

  it('Vespertino recebe só a tarde; sem hora segue o período escolhido', () => {
    const out = selecionarCasosDoTurno(mapa, 'vespertino')
    expect(out.map((c) => c.id)).toEqual(['t1', 't2', 'sem-hora'])
    expect(out.every((c) => c.turno === 'vespertino')).toBe(true)
  })

  it('não muta o lote bruto, permitindo trocar de período sem nova leitura', () => {
    selecionarCasosDoTurno(mapa, 'matutino')
    expect(mapa.some((c) => 'turno' in c)).toBe(false)
  })

  it('item sem hora já carimbado não migra ao alternar o período', () => {
    const lote = [{ id: 'srpa', sala: 'SRPA', turno: 'matutino' }]
    expect(selecionarCasosDoTurno(lote, 'vespertino')).toEqual([])
    expect(selecionarCasosDoTurno(lote, 'matutino')).toHaveLength(1)
  })
})

describe('itens operacionais — cirurgia × posição assistencial', () => {
  it('preserva SRPA como posição e descarta apenas título vazio', () => {
    const out = filtrarItensImportados([
      { sala: 'SRPA', anestesista: 'ANEST A' },
      { sala: 'Exames', hora: '08:00', procedimento: '07 EDA + 03 COLO', anestesista: 'JOAO' },
      { sala: 'Sala 1', pacienteIniciais: 'A.B.', procedimento: '' },
      { sala: 'RODAPÉ' },
    ])
    expect(out).toHaveLength(3)
    expect(out.map((c) => c.sala)).toEqual(['SRPA', 'Exames', 'Sala 1'])
    expect(ehPosicaoAssistencial(out[0])).toBe(true)
    expect(resumirItensEscala(out)).toEqual({ cirurgias: 2, posicoes: 1, total: 3 })
  })

  it('alerta duplicata exata sem remover linhas e ignora posição repetida', () => {
    const cirurgia = { sala: 'Sala 2', hora: '08:00', pacienteIniciais: 'A.B.', procedimento: 'Herniorrafia', cirurgiao: 'Dr. X' }
    const itens = [cirurgia, { ...cirurgia }, { sala: 'SRPA', anestesista: 'Anest A' }]
    const duplicados = detectarItensDuplicados(itens)
    expect(duplicados).toHaveLength(1)
    expect(duplicados[0].quantidade).toBe(2)
    expect(itens).toHaveLength(3)
  })

  it('mesmo anestesista em horários/procedimentos diferentes NÃO é duplicata', () => {
    const itens = [
      { sala: 'Sala 2', hora: '07:30', pacienteIniciais: 'A.B.', procedimento: 'Herniorrafia', cirurgiao: 'Dr. X', anestesista: 'ANEST A' },
      { sala: 'Sala 2', hora: '09:30', pacienteIniciais: 'C.D.', procedimento: 'Colecistectomia', cirurgiao: 'Dr. Y', anestesista: 'ANEST A' },
    ]
    expect(detectarItensDuplicados(itens)).toEqual([])
  })
})
