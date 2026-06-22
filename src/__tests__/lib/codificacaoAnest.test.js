import { describe, it, expect } from 'vitest'
import { calcularGuia, recomendarCodigo, gerarJustificativa, sugerirPercentuais } from '../../lib/codificacaoAnest'

// Registros mock no formato camelCase devolvido pelo service (espelham a tabela Supabase).
const angioplastia = { codigo: '40813185', descricao: 'Angioplastia transluminal percutânea para tratamento de obstrução arterial', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 1930.5, porteCirurgico: '9B', porteAnestesico: 3, classificacao: 'Racionalização' }
const stent = { codigo: '40813266', descricao: 'Colocação de stent', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 2100, porteCirurgico: '10A', porteAnestesico: 5 }
const exerese = { codigo: '30101921', descricao: 'Exérese e sutura de nevus', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 198.9, porteCirurgico: '3B', porteAnestesico: 0 }
const angiografia = { codigo: '40812049', descricao: 'Angiografia por cateterismo seletivo de ramo primário - por vaso', lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 269.1, porteCirurgico: null, porteAnestesico: null }

describe('calcularGuia — anestesia paga embutida', () => {
  it('código com indicador paga o valor do anestesista a 100%', () => {
    const { linhas, totais } = calcularGuia([{ codigo: '40813185', registro: angioplastia }])
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

describe('calcularGuia — percentual por linha (modelo Volan, default 100%)', () => {
  it('default 100% paga valor cheio; quantidade multiplica', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia, quantidade: 2 }])
    expect(linhas[0].percentual).toBe(100)
    expect(linhas[0].quantidade).toBe(2)
    expect(linhas[0].valorAnestesistaPago).toBe(1638) // 819 × 100% × 2
  })

  it('percentual manual reduz cirúrgico e anestésico da linha', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia, percentual: 50 }])
    expect(linhas[0].valorAnestesistaPago).toBe(409.5) // 819 × 50%
    expect(linhas[0].valorCirurgiaoPago).toBe(965.25) // 1930.5 × 50%
  })

  it('valor adicional entra no total geral', () => {
    const { totais } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { valorAdicional: 100 })
    expect(totais.valorAdicional).toBe(100)
    expect(totais.totalGeral).toBe(2849.5) // 1930.5 + 819 + 100
  })
})

describe('sugerirPercentuais', () => {
  it('maior valor 100%, demais 50%', () => {
    const itens = [
      { codigo: '40813185', registro: angioplastia }, // cir 1930.5 → maior
      { codigo: '40813266', registro: stent }, // cir 2100 → na verdade maior
    ]
    const sug = sugerirPercentuais(itens)
    const byCod = Object.fromEntries(sug.map((i) => [i.codigo, i.percentual]))
    expect(byCod['40813266']).toBe(100) // 2100 = maior
    expect(byCod['40813185']).toBe(50)
  })
})

describe('calcularGuia — tabela local Chapecó (×1,73/1,17)', () => {
  it('escala o valor do anestesista pela razão dos multiplicadores', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { tabela: 'local' })
    // 819 * (1.73/1.17) = 1211.0
    expect(linhas[0].valorAnestesistaPago).toBeCloseTo(1211, 0)
  })

  it('escala também o valor do código recomendado e o total recomendado', () => {
    const { linhas, totais } = calcularGuia([{ codigo: '30101921', registro: exerese }], { tabela: 'local' })
    // 31602355 = 292,5 (intercâmbio) * (1,73/1,17) ≈ 432,6
    expect(linhas[0].recomendacao.principal.valor).toBeCloseTo(432.6, 0)
    expect(totais.totalRecomendado).toBeCloseTo(linhas[0].recomendacao.principal.valor, 2)
  })

  it('tabela desconhecida cai no default intercâmbio (fator 1)', () => {
    const { linhas, premissas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { tabela: 'xpto' })
    expect(linhas[0].valorAnestesistaPago).toBe(819)
    expect(premissas.tabela).toBe('intercambio')
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

describe('recomendarCodigo / gerarJustificativa', () => {
  it('recomenda imperativo clínico por padrão', () => {
    expect(recomendarCodigo({ descricao: 'Implante de DIU' }).principal.codigo).toBe('31602355')
  })
  it('justificativa inclui código e procedimento', () => {
    const txt = gerarJustificativa({ procedimento: 'Inserção de DIU', codigoRecomendado: '31602355', motivoClinico: 'estenose cervical' })
    expect(txt).toContain('31602355')
    expect(txt).toContain('Inserção de DIU')
    expect(txt).toContain('estenose cervical')
  })
})
