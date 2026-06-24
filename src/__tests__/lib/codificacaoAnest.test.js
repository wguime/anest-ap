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
    expect(linhas[0].recomendacao.alternativa.codigo).toBe('31602312')
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
    ['Endoscopia digestiva alta', '31602231'], // diagnóstica → porte menor
    ['Colonoscopia com polipectomia', '31602240'], // intervencionista → porte maior
    ['CPRE', '31602240'],
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

  it('porte anestésico > 0 sem indicador → motivo "imperativo" (não afirma "sem porte")', () => {
    const rec = recomendarCodigo({ descricao: 'Plástica em Z ou W', porteAnestesico: 2 })
    expect(rec.motivo).toBe('imperativo')
    expect(rec.principal.codigo).toBe('31602355')
  })
})

describe('recomendarCodigo — hierarquia oficial v2026.03 (seção 4.3)', () => {
  it('4.3.2 — código da lista oficial → 31602312 (indicador A)', () => {
    const rec = recomendarCodigo({ codigo: '30101018', descricao: 'Abrasão cirúrgica', lista: 'HM' })
    expect(rec.motivo).toBe('lista_312')
    expect(rec.principal.codigo).toBe('31602312')
  })

  it('4.3.3 — procedimento que nunca comporta anestesia → null', () => {
    expect(recomendarCodigo({ codigo: '30906164', descricao: 'Cateterismo da artéria radial para PAM', lista: 'SADT' })).toBeNull()
    expect(recomendarCodigo({ codigo: '20202067', descricao: 'Monitorização da pressão intracraniana', lista: 'SADT' })).toBeNull()
  })

  it('4.3.4 — fallback diagnóstico (SADT não listado, sem regex de exame) → 31602304 (B)', () => {
    const rec = recomendarCodigo({ codigo: '49999999', descricao: 'Procedimento diagnóstico qualquer', lista: 'SADT' })
    expect(rec.motivo).toBe('diagnostico')
    expect(rec.principal.codigo).toBe('31602304')
  })
})

describe('calcularGuia — 4.3.3 status sem_anestesia', () => {
  it('código da deny-list → statusAnestesia "sem_anestesia", recomendação null', () => {
    const reg = { codigo: '30906164', descricao: 'Cateterismo da artéria radial para PAM', lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 80 }
    const { linhas } = calcularGuia([{ codigo: '30906164', registro: reg }])
    expect(linhas[0].statusAnestesia).toBe('sem_anestesia')
    expect(linhas[0].recomendacao).toBeNull()
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

  it('cascata oficial 100/50/40/30/10 por ordem decrescente (v2026.03 2.1.21/4.6)', () => {
    const reg = (v) => ({ valorCirurgiao: v })
    const itens = [
      { codigo: 'c100', registro: reg(1000) },
      { codigo: 'c50', registro: reg(900) },
      { codigo: 'c40', registro: reg(800) },
      { codigo: 'c30', registro: reg(700) },
      { codigo: 'c10a', registro: reg(600) },
      { codigo: 'c10b', registro: reg(500) },
    ]
    const byCod = Object.fromEntries(sugerirPercentuais(itens).map((i) => [i.codigo, i.percentual]))
    expect([byCod.c100, byCod.c50, byCod.c40, byCod.c30, byCod.c10a, byCod.c10b]).toEqual([100, 50, 40, 30, 10, 10])
  })
})

describe('calcularGuia — UTM local 1,75 (default, v.09) e acomodação', () => {
  it('default usa tabela local: 819 × (1,75/1,17) ≈ 1225', () => {
    const { linhas, premissas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }])
    expect(premissas.tabela).toBe('local')
    expect(linhas[0].valorAnestesistaPago).toBeCloseTo(1225, 0)
  })

  it('Apartamento dobra código da lista de dobra (40813185, item XIV)', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { ...INTER, acomodacaoMult: 2 })
    expect(linhas[0].valorAnestesistaPago).toBe(1638) // 819 × 2
    expect(linhas[0].dobraAcomodacao).toBe(true)
  })

  it('Apartamento NÃO dobra SADT fora da lista (item VIII — angiografia SADT)', () => {
    const { linhas } = calcularGuia([{ codigo: '40812049', registro: angiografia }], { ...INTER, acomodacaoMult: 2 })
    expect(linhas[0].dobraAcomodacao).toBe(false)
    // angiografia zera anestesia → recomenda 31602258 (E=292,5); sem dobra deve ficar em 292,5, não 585
    expect(linhas[0].recomendacao.principal.valor).toBe(292.5)
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

describe('calcularGuia — v2026.03: UTM, 2º anestesista, não-dobra, urgência, limite SADT', () => {
  it('UTM por código: anestésica = indicador (P→700), procedimento = valor/1,17', () => {
    const { linhas } = calcularGuia([{ codigo: '40813185', registro: angioplastia }], INTER)
    expect(linhas[0].utmAnestesica).toBe(700) // indicador P = 700 UTM
    expect(linhas[0].utmCirurgiao).toBe(1650) // 1930,5 / 1,17
  })

  it('2º anestesista (item 4.8): transplante/gastroplastia → true; exérese → false', () => {
    const transplante = { ...angioplastia, descricao: 'Transplante renal' }
    const gastro = { ...angioplastia, descricao: 'Gastroplastia para obesidade mórbida' }
    expect(calcularGuia([{ codigo: 'x', registro: transplante }], INTER).linhas[0].segundoAnestesista).toBe(true)
    expect(calcularGuia([{ codigo: 'x', registro: gastro }], INTER).linhas[0].segundoAnestesista).toBe(true)
    expect(calcularGuia([{ codigo: '30101921', registro: exerese }], INTER).linhas[0].segundoAnestesista).toBe(false)
  })

  it('motivoNaoDobra em apartamento: SADT→sadt; 3xxx HM→null (dobra)', () => {
    const sadt = calcularGuia([{ codigo: '40812049', registro: angiografia }], { ...INTER, acomodacaoMult: 2 })
    expect(sadt.linhas[0].motivoNaoDobra).toBe('sadt')
    const hm = calcularGuia([{ codigo: '30101921', registro: exerese }], { ...INTER, acomodacaoMult: 2 })
    expect(hm.linhas[0].motivoNaoDobra).toBeNull() // 3xxx HM dobra
    // sem acomodação superior → motivo é null (não se aplica)
    expect(calcularGuia([{ codigo: '40812049', registro: angiografia }], INTER).linhas[0].motivoNaoDobra).toBeNull()
  })

  it('urgência +30% só HM; SADT inalterado (item 1.3.2)', () => {
    const hm = calcularGuia([{ codigo: '40813185', registro: angioplastia }], { ...INTER, urgencia: true })
    expect(hm.linhas[0].urgencia).toBe(true)
    expect(hm.linhas[0].valorAnestesistaPago).toBe(1064.7) // 819 × 1,3
    const sadt = calcularGuia([{ codigo: '40812049', registro: angiografia }], { ...INTER, urgencia: true })
    expect(sadt.linhas[0].urgencia).toBe(false)
    expect(sadt.linhas[0].valorCirurgiaoPago).toBe(269.1) // SADT não recebe +30%
  })

  it('limite de 3 proc. SADT diagnóstico (item 4.16): 4ª linha em diante marcada', () => {
    const mk = (n) => ({ codigo: '4100200' + n, registro: { codigo: '4100200' + n, descricao: 'Tomografia ' + n, lista: 'SADT', cobertura: 'coberto', indicadorAnestesico: null, valorAnestesista: null, valorCirurgiao: 100 } })
    const { linhas, totais } = calcularGuia([mk(1), mk(2), mk(3), mk(4), mk(5)], INTER)
    expect(linhas.map((l) => l.limiteSadt)).toEqual([false, false, false, true, true])
    // totalRecomendado exclui as linhas além do limite (só 3 contam)
    const porLinha = linhas[0].recomendacao.principal.valor
    expect(totais.totalRecomendado).toBe(round2(porLinha * 3))
  })

  it('valor recomendado e totalRecomendado refletem o recPercentual (cascata da anestesia)', () => {
    const { totais, linhas } = calcularGuia([{ codigo: '30101921', registro: exerese, recPercentual: 50 }], INTER)
    expect(linhas[0].recomendacao.principal.valor).toBe(146.25) // 31602355 = 292,5 × 50%
    expect(totais.totalRecomendado).toBe(146.25)
  })

  it('recPercentual não afeta o honorário do procedimento (só a anestesia recomendada)', () => {
    const { linhas } = calcularGuia([{ codigo: '30101921', registro: exerese, percentual: 100, recPercentual: 50 }], INTER)
    expect(linhas[0].valorCirurgiaoPago).toBe(198.9) // procedimento a 100%
    expect(linhas[0].recomendacao.principal.valor).toBe(146.25) // anestesia recomendada a 50%
  })
})

function round2(n) { return Math.round(n * 100) / 100 }
