import { describe, it, expect } from 'vitest'
import { calcularGuia, recomendarCodigo, gerarJustificativa } from '../../lib/codificacaoAnest'

// Registros mock no formato camelCase devolvido pelo service (espelham a tabela Supabase).
const angioplastia = { codigo: '40813185', descricao: 'Angioplastia transluminal percutânea para tratamento de obstrução arterial', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 1930.5, porteCirurgico: '9B', porteAnestesico: 3, classificacao: 'Racionalização' }
const stent = { codigo: '40813266', descricao: 'Colocação de stent', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: 'P', valorAnestesista: 819, valorCirurgiao: 2100, porteCirurgico: '10A', porteAnestesico: 5 }
const exerese = { codigo: '30101921', descricao: 'Exérese e sutura de nevus', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 198.9, porteCirurgico: '3B', porteAnestesico: 0 }
const angiografia = { codigo: '40812049', descricao: 'Angiografia por cateterismo seletivo de ramo primário - por vaso', lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 269.1, porteCirurgico: null, porteAnestesico: null }

describe('calcularGuia — anestesia paga embutida', () => {
  it('código com indicador paga o valor do anestesista a 100%', () => {
    const { linhas, totais } = calcularGuia([{ codigo: '40813185', registro: angioplastia }])
    expect(linhas[0].statusAnestesia).toBe('paga_embutida')
    expect(linhas[0].percentualAnestesico).toBe(1)
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

describe('calcularGuia — percentualização cirúrgica (mesma via)', () => {
  it('maior valor 100%, 2º 70%, 3º 50% por ordem decrescente de valor', () => {
    const tres = [
      { codigo: 'A', registro: { codigo: 'A', descricao: 'a', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorCirurgiao: 100 } },
      { codigo: 'B', registro: { codigo: 'B', descricao: 'b', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorCirurgiao: 300 } },
      { codigo: 'C', registro: { codigo: 'C', descricao: 'c', lista: 'HM', cobertura: 'coberto', indicadorAnestesico: null, valorCirurgiao: 200 } },
    ]
    const { linhas } = calcularGuia(tres)
    const byCod = Object.fromEntries(linhas.map((l) => [l.codigo, l]))
    expect(byCod.B.percentualCirurgico).toBe(1) // 300 = maior
    expect(byCod.B.valorCirurgiaoPago).toBe(300)
    expect(byCod.C.percentualCirurgico).toBe(0.7) // 200 = 2º
    expect(byCod.C.valorCirurgiaoPago).toBe(140)
    expect(byCod.A.percentualCirurgico).toBe(0.5) // 100 = 3º
    expect(byCod.A.valorCirurgiaoPago).toBe(50)
  })

  it('vias de acesso diferentes reiniciam em 100%', () => {
    const itens = [
      { codigo: 'A', via: 'v1', registro: { codigo: 'A', lista: 'HM', cobertura: 'coberto', valorCirurgiao: 300 } },
      { codigo: 'B', via: 'v2', registro: { codigo: 'B', lista: 'HM', cobertura: 'coberto', valorCirurgiao: 200 } },
    ]
    const { linhas } = calcularGuia(itens)
    expect(linhas.every((l) => l.percentualCirurgico === 1)).toBe(true)
  })
})

describe('calcularGuia — regra de anestesia (instr. 7)', () => {
  it('percentualizado: maior indicador 100%, demais 70%', () => {
    const { linhas } = calcularGuia(
      [{ codigo: '40813185', registro: angioplastia }, { codigo: '40813266', registro: stent }],
      { modoAnestesia: 'percentualizado' }
    )
    const pagos = linhas.map((l) => l.valorAnestesistaPago).sort((a, b) => b - a)
    expect(pagos[0]).toBe(819) // maior 100%
    expect(pagos[1]).toBe(573.3) // 819 * 0.70
  })

  it('somente_maior: só o maior indicador é pago, demais zeram', () => {
    const { linhas, totais } = calcularGuia(
      [{ codigo: '40813185', registro: angioplastia }, { codigo: '40813266', registro: stent }],
      { modoAnestesia: 'somente_maior' }
    )
    const pagos = linhas.map((l) => l.valorAnestesistaPago).sort((a, b) => b - a)
    expect(pagos[0]).toBe(819)
    expect(pagos[1]).toBe(0)
    expect(totais.totalAnestesista).toBe(819)
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
