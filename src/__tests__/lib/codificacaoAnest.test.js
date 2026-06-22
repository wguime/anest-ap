import { describe, it, expect } from 'vitest'
import { calcularGuia, recomendarCodigo, gerarJustificativa, sugerirPercentuais } from '../../lib/codificacaoAnest'

// Registros mock no formato camelCase devolvido pelo service (espelham a tabela Supabase).
const angioplastia = { codigo: '40813185', descricao: 'Angioplastia transluminal percutânea para tratamento de obstrução arterial', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 1930.5, porteCirurgico: '9B', porteAnestesico: 3, classificacao: 'Racionalização' }
const stent = { codigo: '40813266', descricao: 'Colocação de stent', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 2100, porteCirurgico: '10A', porteAnestesico: 5 }
const exerese = { codigo: '30101921', descricao: 'Exérese e sutura de nevus', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 198.9, porteCirurgico: '3B', porteAnestesico: 0 }
const angiografia = { codigo: '40812049', descricao: 'Angiografia por cateterismo seletivo de ramo primário - por vaso', lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 269.1, porteCirurgico: null, porteAnestesico: null }

// base intercâmbio (1,17) — usado nos testes de valor "cru" para evitar ruído de float da tabela local
const INTER = { tabela: 'intercambio' }

describe('calcularGuia — anestesia paga embutida', () => {
  it('código com indicador paga o valor do anestesista a 100%', () => {
    const { linhas, totais } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], INTER)
    expect(linhas[0].statusAnestesia).toBe('paga_embutida')
    expect(linhas[0].percentual).toBe(100)
    expect(linhas[0].valorAnestesistaPago).toBe(819)
    expect(totais.totalAnestesista).toBe(819)
  })
})

describe('calcularGuia — anestesia zero recomenda código', () => {
  it('porte anestésico 0 (exérese) → recomenda 31602355 (imperativo clínico)', () => {
    const { linhas } = calcularGuia([{ codigo: '30101921', registro: exerese }])
    expect(linhas[0].statusAnestesia).toBe('recomenda_codigo')
    expect(linhas[0].valorAnestesistaPago).toBeNull()
    expect(linhas[0].recomendacao.principal.codigo).toBe('31602355')
    expect(linhas[0].recomendacao.alternativa.codigo).toBe('31602347')
  })

  it('SADT diagnóstico (angiografia) → recomenda código de exame de angiorradiologia (31602258)', () => {
    const { linhas } = calcularGuia([{ codigo: '40812049', registro: angiografia }])
    expect(linhas[0].statusAnestesia).toBe('recomenda_codigo')
    expect(linhas[0].recomendacao.motivo).toBe('exame')
    expect(linhas[0].recomendacao.principal.codigo).toBe('31602258')
  })
})

describe('recomendarCodigo — mapa por natureza do procedimento', () => {
  const casos = [
    ['Tomografia computadorizada de crânio', '31602274'],
    ['Ressonância magnética de joelho', '31602282'],
    ['Endoscopia digestiva alta', '31602240'],
    ['Ultrassonografia abdominal com doppler', '31602266'],
    ['Sessão de radioterapia', '31602290'],
    ['Cintilografia óssea', '31602320'],
    ['Exérese de lesão de pele', '31602355'], // sem exame → imperativo clínico
  ]
  casos.forEach(([desc, cod]) => {
    it(`${desc} → ${cod}`, () => {
      expect(recomendarCodigo({ descricao: desc }).principal.codigo).toBe(cod)
    })
  })
})

describe('calcularGuia — percentual por linha (auto 100/50)', () => {
  it('quantidade multiplica', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia, quantidade: 2 }], INTER)
    expect(linhas[0].quantidade).toBe(2)
    expect(linhas[0].valorAnestesistaPago).toBe(1638) // 819 × 100% × 2
  })

  it('percentual manual reduz cirúrgico e anestésico da linha', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia, percentual: 50 }], INTER)
    expect(linhas[0].valorAnestesistaPago).toBe(409.5) // 819 × 50%
    expect(linhas[0].valorCirurgiaoPago).toBe(965.25) // 1930.5 × 50%
  })

  it('valor adicional entra no total geral', () => {
    const { totais } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { ...INTER, valorAdicional: 100 })
    expect(totais.valorAdicional).toBe(100)
    expect(totais.totalGeral).toBe(2849.5) // 1930.5 + 819 + 100
  })
})

describe('sugerirPercentuais', () => {
  it('maior valor 100%, demais 50%', () => {
    const itens = [
      { codigo: '40813185', registro: angioplastia }, // cir 1930.5
      { codigo: '40813266', registro: stent }, // cir 2100 → maior
    ]
    const sug = sugerirPercentuais(itens)
    const byCod = Object.fromEntries(sug.map((i) => [i.codigo, i.percentual]))
    expect(byCod['40813266']).toBe(100) // 2100 = maior
    expect(byCod['40813185']).toBe(50)
  })
})

describe('calcularGuia — UTM local 1,73 (default) e acomodação', () => {
  it('default usa tabela local: 819 × (1,73/1,17) ≈ 1211', () => {
    const { linhas, premissas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }])
    expect(premissas.tabela).toBe('local')
    expect(linhas[0].valorAnestesistaPago).toBeCloseTo(1211, 0)
  })

  it('Apartamento dobra o valor (mult 2)', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { ...INTER, acomodacaoMult: 2 })
    expect(linhas[0].valorAnestesistaPago).toBe(1638) // 819 × 2
  })

  it('Enfermaria/Ambulatório mantêm o valor da tabela (mult 1)', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { ...INTER, acomodacaoMult: 1 })
    expect(linhas[0].valorAnestesistaPago).toBe(819)
  })

  it('acomodação também escala o código recomendado', () => {
    const { linhas } = calcularGuia([{ codigo: '30101921', registro: exerese }], { ...INTER, acomodacaoMult: 2 })
    expect(linhas[0].recomendacao.principal.valor).toBe(585) // 31602355 = 292,5 × 2
  })

  it('tabela desconhecida cai no default local', () => {
    const { premissas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { tabela: 'xpto' })
    expect(premissas.tabela).toBe('local')
  })
})

describe('calcularGuia — indicador sem valor não vira "paga embutida"', () => {
  it('indicador presente mas valorAnestesista null → recomenda código, não paga', () => {
    const reg = { codigo: 'X', descricao: 'Proc qualquer', lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: 'Z', valorAnestesista: null, valorCirurgiao: 100 }
    const { linhas } = calcularGuia([{ codigo: 'X', registro: reg }])
    expect(linhas[0].statusAnestesia).toBe('recomenda_codigo')
    expect(linhas[0].valorAnestesistaPago).toBeNull()
  })
})

describe('calcularGuia — código inexistente', () => {
  it('registro null → status revisar, sem valores', () => {
    const { linhas } = calcularGuia([{ codigo: '99999999', registro: null }])
    expect(linhas[0].statusAnestesia).toBe('revisar')
    expect(linhas[0].encontrado).toBe(false)
    expect(linhas[0].valorAnestesistaPago).toBeNull()
  })
})

describe('gerarJustificativa', () => {
  it('inclui código e procedimento', () => {
    const txt = gerarJustificativa({ procedimento: 'Inserção de DIU', codigoRecomendado: '31602355', motivoClinico: 'estenose cervical' })
    expect(txt).toContain('31602355')
    expect(txt).toContain('Inserção de DIU')
    expect(txt).toContain('estenose cervical')
  })
})
