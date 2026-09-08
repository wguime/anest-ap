/**
 * Normalização determinística na edge (Onda 4, item 4.2).
 *
 * A trava central é a PARIDADE: `iniciaisSeguras` existe em dois lugares — no
 * cliente (`src/lib/escalaCirurgicaPaciente.js`, última linha de defesa antes
 * do INSERT) e na edge (Deno, sem acesso a `src/`). Duas regras de LGPD que
 * divergem em silêncio é pior que uma só no lugar errado: aqui as duas cópias
 * são rodadas lado a lado sobre a mesma bateria de entradas, incluindo as que
 * derrubaram a publicação da Unimed em 02/09.
 *
 * As demais provam o que o structured output NÃO garante: `pattern` não é
 * suportado em json_schema, então a forma do conteúdo é responsabilidade desta
 * normalização, não do schema.
 */
import { describe, it, expect } from 'vitest'
import {
  iniciaisSeguras as iniciaisEdge, ehIniciaisAceitas as aceitasEdge,
  horaCanonica, tempoCanonico, salaCanonica, normalizarCasos,
} from '../../../supabase/functions/_shared/escala-normalizacao.ts'
import {
  iniciaisSeguras as iniciaisCliente, ehIniciaisAceitas as aceitasCliente,
} from '../../lib/escalaCirurgicaPaciente'

const ENTRADAS = [
  '', '   ', null, undefined,
  'M.C.S.', 'M.S.', 'A.', 'MCS', 'MCS.', 'JCSO', 'ANA',
  '01 EDA', '01 RETOSSIGMOID. + 02 COLO', 'EDA',
  'Maria Clara Souza', 'Cleidiani de Souza Gelda', 'JOAO DA SILVA',
  'M.C.GOMES', 'M C S', '03h', '01', '12345678901234567890',
  'A.B.C.D.E.F.', 'Ana Paula', 'de da do', '?', '-',
]

describe('paridade cliente × edge — iniciaisSeguras', () => {
  it('devolve exatamente o mesmo para toda a bateria', () => {
    for (const v of ENTRADAS) {
      expect(`${v} → ${iniciaisEdge(v)}`).toBe(`${v} → ${iniciaisCliente(v)}`)
      expect(aceitasEdge(v)).toBe(aceitasCliente(v))
    }
  })

  it('o resultado SEMPRE passa no CHECK do banco (o incidente de 02/09)', () => {
    for (const v of [...ENTRADAS, '01 EDA', 'MCS']) {
      const out = iniciaisEdge(v)
      expect(aceitasCliente(out)).toBe(true)
      expect(out.length).toBeLessThanOrEqual(12)
    }
    expect(iniciaisEdge('01 EDA')).toBe('E.')
    expect(iniciaisEdge('MCS')).toBe('M.C.S.')
    expect(iniciaisEdge('M.C.S.')).toBe('M.C.S.') // idempotente
    expect(iniciaisEdge(iniciaisEdge('Maria Clara Souza'))).toBe(iniciaisEdge('Maria Clara Souza'))
  })
})

describe('hora e tempo em HH:MM', () => {
  it('canoniza as grafias que o mapa traz', () => {
    expect(horaCanonica('7:30')).toBe('07:30')
    expect(horaCanonica('07h30')).toBe('07:30')
    expect(horaCanonica('0730')).toBe('07:30')
    expect(horaCanonica('7')).toBe('07:00')
    expect(horaCanonica('08:00')).toBe('08:00')
    expect(horaCanonica('13h')).toBe('13:00')
  })

  it('preserva o marcador sequencial como "AS"', () => {
    expect(horaCanonica('AS')).toBe('AS')
    expect(horaCanonica('a seguir')).toBe('AS')
    expect(horaCanonica('À SEGUIR')).toBe('AS')
  })

  it('tira a DATA colada na hora — a 1ª coluna da Unimed traz as duas (08/09)', () => {
    // 30 cirurgias chegaram à conferência com "08/09/2026 07:30" no campo da
    // hora: a validação bloqueava uma a uma e a escala saiu sem hora nenhuma
    expect(horaCanonica('08/09/2026 07:30')).toBe('07:30')
    expect(horaCanonica('08/09/2026 11:00')).toBe('11:00')
    expect(horaCanonica('08/09/2026 7h30')).toBe('07:30')
    expect(horaCanonica('08/09 07:30')).toBe('07:30')
    expect(horaCanonica('2026-09-08 12:15')).toBe('12:15')
    expect(horaCanonica('2026-09-08T07:00')).toBe('07:00')
    expect(horaCanonica('07:30:00')).toBe('07:30')
    // data SEM hora não é hora: fica visível como veio, para a conferência apontar
    expect(horaCanonica('08/09/2026')).toBe('08/09/2026')
    expect(horaCanonica('08/09/2026 AS')).toBe('AS')
  })

  it('NÃO esconde a hora que não dá para interpretar — devolve como veio', () => {
    // esconder com '' faria o caso herdar o período em silêncio; a conferência
    // precisa poder bloquear e nomear a sala (validarHorarioImportacao)
    expect(horaCanonica('25:00')).toBe('25:00')
    expect(horaCanonica('07:99')).toBe('07:99')
    expect(horaCanonica('manhã')).toBe('manhã')
    expect(horaCanonica('')).toBe('')
  })

  it('tempo estimado aceita duração maior que um dia', () => {
    expect(tempoCanonico('1:15')).toBe('01:15')
    expect(tempoCanonico('2H')).toBe('02:00')
    expect(tempoCanonico('')).toBe('')
  })
})

describe('sala — só espaço em branco', () => {
  it('colapsa espaço e não mexe na semântica (isso é do cliente)', () => {
    expect(salaCanonica('  CC  -  Sala 1 ')).toBe('CC - Sala 1')
    expect(salaCanonica('CENTRO CIRÚRGICO - SALA 1')).toBe('CENTRO CIRÚRGICO - SALA 1')
    expect(salaCanonica('IOSC')).toBe('IOSC')
  })
})

describe('normalizarCasos', () => {
  it('conserta iniciais e hora e conta quantas vezes precisou agir', () => {
    const { casos, contagem } = normalizarCasos([
      { sala: 'Sala 1', hora: '7:30', pacienteIniciais: '01 EDA', procedimento: 'EDA', ordem: 0 },
      { sala: 'Sala 1', hora: '08:00', pacienteIniciais: 'M.S.', procedimento: 'COLE', ordem: 1 },
    ])
    expect(casos[0].hora).toBe('07:30')
    expect(casos[0].pacienteIniciais).toBe('E.')
    expect(contagem.iniciais).toBe(1)
    expect(contagem.hora).toBe(1)
  })

  it('derruba a linha repetida em TODOS os campos, e só ela', () => {
    const linha = { sala: 'Exames', hora: '08:00', pacienteIniciais: 'A.B.', procedimento: 'EDA', cirurgiao: 'X', anestesista: 'ANA' }
    const { casos, contagem } = normalizarCasos([
      linha, { ...linha }, { ...linha, pacienteIniciais: 'C.D.' },
    ])
    expect(casos).toHaveLength(2)
    expect(contagem.duplicada).toBe(1)
  })

  it('não deixa duas cirurgias diferentes na mesma sala e hora colapsarem', () => {
    const { casos } = normalizarCasos([
      { sala: 'HO', hora: '08:00', pacienteIniciais: 'A.B.', procedimento: 'CATARATA', anestesista: 'ANA' },
      { sala: 'HO', hora: '08:00', pacienteIniciais: 'C.D.', procedimento: 'CATARATA', anestesista: 'ANA' },
    ])
    expect(casos).toHaveLength(2)
  })

  it('recalcula ordem pela posição DENTRO da sala, ignorando o que o modelo disse', () => {
    const { casos, contagem } = normalizarCasos([
      { sala: 'Sala 1', hora: '07:00', ordem: 7 },
      { sala: 'Sala 2', hora: '07:00', ordem: 7 },
      { sala: 'Sala 1', hora: '09:00', ordem: 7 },
    ])
    expect(casos.map((c) => c.ordem)).toEqual([0, 0, 1])
    expect(contagem.ordem).toBe(3)
  })

  it('sobrevive a lista vazia e a campos ausentes', () => {
    expect(normalizarCasos([]).casos).toEqual([])
    expect(normalizarCasos([{}]).casos).toHaveLength(1)
  })
})
