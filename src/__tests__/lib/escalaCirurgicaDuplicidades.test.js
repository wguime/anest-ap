import { describe, expect, it } from 'vitest'
import { detectarDuplicidadesEscala, sugerirParceiroTroca } from '@/lib/escalaCirurgicaDuplicidades'

const resolver = (nome) => ({ 'Alexandre D': 'u-alex', Vicente: 'u-vicente' }[nome] || null)

describe('detectarDuplicidadesEscala', () => {
  it('identifica a pessoa nos dois hospitais e detalha os casos', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'hro', hospitalAtualLabel: 'HRO', periodo: 'matutino', resolver,
      casos: [{ anestesista: 'Alexandre D', anestesistaUserId: 'u-alex', sala: 'Sala 1', hora: '07:00', procedimento: 'Cirurgia A' }],
      ordemAtual: ['Alexandre D'],
      outrasEscalas: [{ hospital: 'unimed', ordemLiberacao: ['Alexandre D'], casos: [{ anestesista: 'Alexandre D', anestesistaUserId: 'u-alex', sala: 'Sala 2', hora: '08:00', procedimento: 'Cirurgia B' }] }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].nome).toBe('Alexandre D')
    expect(result[0].ocorrencias.map((o) => o.hospital)).toEqual(['hro', 'unimed'])
    expect(result[0].ocorrencias[1].casos[0]).toMatchObject({ sala: 'Sala 2', hora: '08:00' })
  })

  it('também alerta quando a outra escala só tem a pessoa no rodapé', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'materno', hospitalAtualLabel: 'Materno', periodo: 'vespertino', resolver,
      casos: [{ anestesista: 'Vicente', sala: 'Sala 1', hora: '13:00' }],
      outrasEscalas: [{ hospital: 'hro', ordemLiberacao: { vespertino: ['Vicente'] }, casos: [] }],
    })
    expect(result[0].ocorrencias[1]).toMatchObject({ noRodape: true, casos: [] })
  })

  it('não mistura turnos diferentes', () => {
    const result = detectarDuplicidadesEscala({
      hospitalAtual: 'hro', hospitalAtualLabel: 'HRO', periodo: 'matutino', resolver,
      casos: [{ anestesista: 'Alexandre D', turno: 'matutino' }],
      outrasEscalas: [{ hospital: 'unimed', casos: [{ anestesista: 'Alexandre D', turno: 'vespertino' }] }],
    })
    expect(result).toEqual([])
  })
})

// PAR PROPOSTO (Fase 2.2, dono 07/08): a leitura das duas escalas sugere o
// parceiro SIMÉTRICO (rodapé em A com casos em B ↔ rodapé em B com casos em A).
// A sugestão só pré-preenche o seletor; a decisão continua humana.
describe('sugerirParceiroTroca — só o par simétrico, e só quando é único', () => {
  const grupo = (key, ocorrencias) => ({ key, nome: key, ocorrencias })
  const oc = (hospital, noRodape, nCasos) => ({
    hospital, noRodape, casos: Array.from({ length: nCasos }, (_, i) => ({ sala: `S${i}` })),
  })

  it('P (rodapé A, casos B) casa com Q (rodapé B, casos A)', () => {
    const P = grupo('uid-p', [oc('unimed', true, 0), oc('hro', false, 2)])
    const Q = grupo('uid-q', [oc('hro', true, 0), oc('unimed', false, 1)])
    const sugestoes = sugerirParceiroTroca([P, Q])
    expect(sugestoes.get('uid-p')).toBe('uid-q')
    expect(sugestoes.get('uid-q')).toBe('uid-p')
  })

  it('dois candidatos simétricos → nenhuma sugestão (ambíguo é do humano)', () => {
    const P = grupo('uid-p', [oc('unimed', true, 0), oc('hro', false, 2)])
    const Q = grupo('uid-q', [oc('hro', true, 0), oc('unimed', false, 1)])
    const R = grupo('uid-r', [oc('hro', true, 0), oc('unimed', false, 1)])
    expect(sugerirParceiroTroca([P, Q, R]).has('uid-p')).toBe(false)
  })

  it('sem simetria (os dois no mesmo papel) → sem sugestão', () => {
    const P = grupo('uid-p', [oc('unimed', true, 0), oc('hro', false, 2)])
    const Q = grupo('uid-q', [oc('unimed', true, 0), oc('hro', false, 1)])
    expect(sugerirParceiroTroca([P, Q]).size).toBe(0)
  })
})

// AJUDA DECLARADA (dono 30/08): "Oscar está como ajuda de outro hospital no HRO,
// foi identificado como ajuda e mesmo assim a escala não pôde ser publicada".
// Nome em AZUL no rodapé é a resposta da pergunta que o painel faz.
describe('ajuda declarada no rodapé não é duplicidade por classificar', () => {
  const cenario = (ajudas) => detectarDuplicidadesEscala({
    casos: [{ sala: 'IOSC', hora: '07:30', procedimento: 'MEDULA ÓSSEA', anestesista: 'OSCAR' }],
    hospitalAtual: 'hro',
    hospitalAtualLabel: 'HRO',
    ordemAtual: [],
    periodo: 'matutino',
    outrasEscalas: [{ hospital: 'unimed', hospitalLabel: 'Unimed', casos: [], ordemLiberacao: ['OSCAR'] }],
    ajudas,
  })

  it('sem ajuda declarada, o item continua pedindo classificação', () => {
    const [d] = cenario([])
    expect(d.nome).toBe('OSCAR')
    expect(d.ajudaDeclarada).toBe('')
  })

  it('declarado como ajuda AQUI, o item vem resolvido e diz onde', () => {
    const [d] = cenario([{ hospitalLabel: 'HRO', nomes: ['OSCAR'] }])
    expect(d.ajudaDeclarada).toBe('HRO')
  })

  it('a ajuda declarada do OUTRO lado também resolve', () => {
    // quem é ajuda no HRO aparece duplicado também na conferência da Unimed, e
    // lá a lista de ajuda que existe é a de lá
    const [d] = cenario([{ hospitalLabel: 'HRO', nomes: ['oscar'] }])
    expect(d.ajudaDeclarada).toBe('HRO')
  })

  it('ajuda de OUTRA pessoa não resolve a duplicidade desta', () => {
    const [d] = cenario([{ hospitalLabel: 'HRO', nomes: ['GABRIELA'] }])
    expect(d.ajudaDeclarada).toBe('')
  })
})
