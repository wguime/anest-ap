import { describe, it, expect } from 'vitest'
import * as LIB from '../../lib/inibidoresApetite'
import {
  AVISO_JEJUM_NAO_BASTA,
  CONDUTA_ALTO_RISCO,
  INIBIDORES,
  CLASSES,
  FATORES_RISCO,
  PERLAS_GRAUS,
  LIMIAR_VOLUME_ML_KG,
  COMPARATIVO,
  buscarFarmacos,
  getFarmaco,
  agruparPorClasse,
  todosFatores,
  getFator,
  diasParaTexto,
  calcularLiberacao,
  areaAntral,
  volumeGastrico,
  classificarPocus,
  avaliarPreOperatorio,
} from '../../lib/inibidoresApetite'

describe('base de fármacos', () => {
  it('toda entrada tem os campos que a tela lê', () => {
    INIBIDORES.forEach((f) => {
      expect(f.id, 'id').toBeTruthy()
      expect(f.farmaco, `farmaco em ${f.id}`).toBeTruthy()
      expect(CLASSES[f.classe], `classe desconhecida em ${f.id}`).toBeDefined()
      expect(f.regime, `regime em ${f.id}`).toBeTruthy()
      expect(f.meiaVida, `meiaVida em ${f.id}`).toBeTruthy()
      expect(f.reinicio, `reinicio em ${f.id}`).toBeTruthy()
      expect(typeof f.retardaEsvaziamento, `retardaEsvaziamento em ${f.id}`).toBe('boolean')
      expect(f.suspensao?.texto, `suspensao.texto em ${f.id}`).toBeTruthy()
      expect(f.suspensaoAltoRisco?.texto, `suspensaoAltoRisco em ${f.id}`).toBeTruthy()
    })
  })

  it('ids são únicos', () => {
    const ids = INIBIDORES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /**
   * Invariante que nasceu de um defeito real no card de Anticoagulantes: o
   * Badge do DS é whitespace-nowrap e NÃO encolhe — rótulo longo empurra o
   * nome do fármaco e o deixa com poucos pixels. O corte curto é a trava.
   */
  it('todo rótulo de badge é curto — o badge não encolhe e esmaga o nome ao lado', () => {
    INIBIDORES.forEach((f) => {
      expect(
        f.suspensao.resumo.length,
        `resumo longo demais em ${f.id}: "${f.suspensao.resumo}"`
      ).toBeLessThanOrEqual(12)
    })
  })

  /**
   * SBA item 5: havendo QUALQUER fator de risco, o piso é 7 dias — inclusive
   * para os de curta duração, que na rotina saem com 1 dia. É a regra que
   * mais se perde numa edição distraída da base.
   */
  it('fármaco que retarda o esvaziamento tem piso de 7 dias no alto risco', () => {
    INIBIDORES.filter((f) => f.retardaEsvaziamento).forEach((f) => {
      expect(f.suspensaoAltoRisco.dias, `alto risco em ${f.id}`).toBeGreaterThanOrEqual(7)
    })
  })

  /**
   * O norte da suspensão é a SBA (pedido do dono, 25/08). A nota
   * C.SBA-01744/2026 cobre SÓ GLP-1 e coagonistas GLP-1/GIP — os demais
   * fármacos continuam no card, mas têm de declarar que estão FORA dela,
   * senão a tela dá à SBA uma recomendação que ela não fez.
   */
  it('todo fármaco declara a fonte da suspensão', () => {
    INIBIDORES.forEach((f) => {
      expect(f.fonteSuspensao?.orgao, `fonteSuspensao em ${f.id}`).toBeTruthy()
      expect(f.fonteSuspensao?.detalhe, `detalhe da fonte em ${f.id}`).toBeTruthy()
    })
  })

  /**
   * A referência longa quebrava AO LADO do badge e virava um bloco ragged —
   * foi metade do "informações amontoadas" do dono (25/08). O corte curto é
   * a trava; a explicação de escopo vive uma vez só, no rodapé da aba.
   */
  it('a referência da fonte cabe em uma linha ao lado do badge', () => {
    INIBIDORES.forEach((f) => {
      expect(
        f.fonteSuspensao.detalhe.length,
        `detalhe longo demais em ${f.id}: "${f.fonteSuspensao.detalhe}"`
      ).toBeLessThanOrEqual(48)
    })
  })

  it('GLP-1 e coagonista seguem a SBA; o resto se declara fora dela', () => {
    INIBIDORES.forEach((f) => {
      const daNota = f.classe === 'glp1' || f.classe === 'coagonista'
      expect(f.fonteSuspensao.orgao, `${f.id} (classe ${f.classe})`).toBe(
        daNota ? 'SBA' : 'Fora da nota da SBA'
      )
    })
    expect(INIBIDORES.filter((f) => f.fonteSuspensao.orgao === 'SBA').length).toBeGreaterThan(0)
  })

  /**
   * "Longa duração." sozinho não explica nada a quem lê no corredor — o que
   * decide a regra dos 7 dias é a MEIA-VIDA, e era justamente ela que ficava
   * de fora (dono 25/08: "deixe essa informação mais clara", sobre a
   * tirzepatida). Todo motivo tem de trazer o número que o sustenta.
   */
  it('o motivo da suspensão diz o NÚMERO que a sustenta, não só "longa duração"', () => {
    INIBIDORES.filter((f) => f.retardaEsvaziamento).forEach((f) => {
      const motivo = f.suspensao.motivo || ''
      expect(motivo, `motivo vazio em ${f.id}`).toBeTruthy()
      expect(/\d/.test(motivo), `motivo sem número em ${f.id}: "${motivo}"`).toBe(true)
      expect(/dura[çc][ãa]o\.?$/i.test(motivo.trim()), `motivo genérico em ${f.id}`).toBe(false)
    })
  })

  it('semaglutida oral entra como LONGA duração, apesar de ser diária', () => {
    const oral = getFarmaco('semaglutida_oral')
    expect(oral.regime).toMatch(/dia/i)
    expect(oral.duracao).toBe('longa')
    expect(oral.suspensao.dias).toBe(7)
  })
})

describe('busca', () => {
  it('acha por marca comercial', () => {
    expect(buscarFarmacos('Mounjaro').map((f) => f.id)).toEqual(['tirzepatida'])
    expect(buscarFarmacos('Saxenda').map((f) => f.id)).toEqual(['liraglutida'])
  })

  it('é insensível a acento e a caixa', () => {
    const comAcento = buscarFarmacos('simpaticomiméticos').map((f) => f.id)
    const semAcento = buscarFarmacos('SIMPATICOMIMETICOS').map((f) => f.id)
    expect(comAcento.length).toBeGreaterThan(0)
    expect(semAcento).toEqual(comAcento)
  })

  it('termo vazio devolve a base inteira', () => {
    expect(buscarFarmacos('').length).toBe(INIBIDORES.length)
    expect(buscarFarmacos('   ').length).toBe(INIBIDORES.length)
  })

  it('termo sem correspondência devolve lista vazia', () => {
    expect(buscarFarmacos('zzzznaoexiste')).toEqual([])
  })
})

describe('agruparPorClasse', () => {
  it('respeita a ordem declarada em CLASSES', () => {
    const ordens = agruparPorClasse().map((g) => g.ordem)
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b))
  })

  it('não perde nem duplica fármaco', () => {
    const total = agruparPorClasse().reduce((n, g) => n + g.farmacos.length, 0)
    expect(total).toBe(INIBIDORES.length)
  })
})

describe('fatores de risco', () => {
  it('ids são únicos entre os três grupos', () => {
    const ids = todosFatores().map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cobre os três eixos da nota da SBA (itens 7, 8 e 9)', () => {
    expect(FATORES_RISCO.map((g) => g.grupo)).toEqual(['tecnica', 'farmaco', 'paciente'])
  })

  it('getFator devolve o fator com o grupo de origem', () => {
    expect(getFator('sintomas_tgi').grupo).toBe('farmaco')
    expect(getFator('inexistente')).toBeNull()
  })
})

describe('POCUS — área antral e volume de Perlas', () => {
  it('área antral é a elipse π × AP × CC / 4', () => {
    expect(areaAntral({ ap: 4, cc: 4 })).toBeCloseTo(Math.PI * 4, 6)
    expect(areaAntral({ ap: 3.2, cc: 4.1 })).toBeCloseTo((Math.PI * 3.2 * 4.1) / 4, 6)
  })

  it('medida ausente, zero ou negativa não vira área', () => {
    expect(areaAntral({ ap: 0, cc: 4 })).toBeNull()
    expect(areaAntral({ ap: -2, cc: 4 })).toBeNull()
    expect(areaAntral({ ap: 3 })).toBeNull()
    expect(areaAntral()).toBeNull()
  })

  it('volume segue a fórmula 27,0 + 14,6 × ACSA − 1,28 × idade', () => {
    expect(volumeGastrico({ acsa: 5, idade: 50 })).toBeCloseTo(27 + 14.6 * 5 - 1.28 * 50, 6)
  })

  it('volume nunca é negativo — ACSA pequena com idade alta zera, não inverte', () => {
    expect(volumeGastrico({ acsa: 1, idade: 90 })).toBe(0)
  })

  it('dado faltando não vira volume', () => {
    expect(volumeGastrico({ acsa: 5 })).toBeNull()
    expect(volumeGastrico({ idade: 50 })).toBeNull()
  })
})

describe('classificarPocus', () => {
  it('sólido é alto risco por si, independente de volume', () => {
    const r = classificarPocus({ solido: true, volumeMl: 10, pesoKg: 100 })
    expect(r.risco).toBe('alto')
    expect(r.grau).toBeNull()
    expect(r.conduta).toMatch(/sequência rápida|Adiar/i)
  })

  it('exatamente 1,5 mL/kg ainda é BAIXO risco — o corte da SBA é "acima de"', () => {
    const r = classificarPocus({ volumeMl: LIMIAR_VOLUME_ML_KG * 80, pesoKg: 80 })
    expect(r.mlPorKg).toBeCloseTo(1.5, 6)
    expect(r.risco).toBe('baixo')
  })

  it('logo acima de 1,5 mL/kg vira alto risco', () => {
    const r = classificarPocus({ volumeMl: 1.51 * 80, pesoKg: 80 })
    expect(r.risco).toBe('alto')
    expect(r.grau).toBe(2)
  })

  it('sem peso não classifica — mL/kg exige os dois', () => {
    expect(classificarPocus({ volumeMl: 120 })).toBeNull()
    expect(classificarPocus({ volumeMl: 120, pesoKg: 0 })).toBeNull()
  })

  it('a tabela de graus declara os dois achados de alto risco', () => {
    expect(PERLAS_GRAUS.filter((g) => g.risco === 'alto')).toHaveLength(2)
  })
})

describe('diasParaTexto', () => {
  it('traduz os cortes usados na base', () => {
    expect(diasParaTexto(0)).toBe('No dia')
    expect(diasParaTexto(1)).toBe('1 dia')
    expect(diasParaTexto(3)).toBe('72 h')
    expect(diasParaTexto(7)).toBe('7 dias')
    expect(diasParaTexto(null)).toBe('—')
  })
})

describe('calcularLiberacao', () => {
  const agora = new Date('2026-08-25T10:00:00-03:00')

  it('marca como cumprido quando o intervalo já passou', () => {
    const dose = new Date('2026-08-10T10:00:00-03:00')
    const r = calcularLiberacao(dose, 7, agora)
    expect(r.cumprido).toBe(true)
    expect(r.falta).toMatch(/^há /)
  })

  it('conta o que falta quando o intervalo ainda corre', () => {
    const dose = new Date('2026-08-23T10:00:00-03:00')
    const r = calcularLiberacao(dose, 7, agora)
    expect(r.cumprido).toBe(false)
    expect(r.falta).toMatch(/^faltam /)
  })

  it('sem espera (manter ou suspender no dia) não gera alvo', () => {
    expect(calcularLiberacao(new Date(), 0, agora)).toBeNull()
    expect(calcularLiberacao(null, 7, agora)).toBeNull()
  })
})

describe('avaliarPreOperatorio — algoritmo da nota SBA', () => {
  it('sem fator de risco e COM POCUS: manter é opção', () => {
    const r = avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', pocusDisponivel: true })
    expect(r.risco).toBe('padrao')
    expect(r.conduta.id).toBe('manter')
    expect(r.conduta.tom).toBe('success')
  })

  it('toda conduta cita o item da nota da SBA que a originou', () => {
    const casos = [
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', pocusDisponivel: true }),
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc' }),
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', fatores: ['imc40'] }),
    ]
    casos.forEach((c) => expect(c.conduta.texto, c.conduta.id).toMatch(/SBA ite(m|ns) \d/i))
  })

  it('sem fator de risco e SEM POCUS: suspende pela duração de ação (item 3.3)', () => {
    const longa = avaliarPreOperatorio({ farmacoId: 'semaglutida_sc' })
    expect(longa.conduta.id).toBe('suspender_rotina')
    expect(longa.suspensao.dias).toBe(7)

    const curta = avaliarPreOperatorio({ farmacoId: 'liraglutida' })
    expect(curta.conduta.id).toBe('suspender_rotina')
    expect(curta.suspensao.dias).toBe(1)
  })

  it('UM fator basta para virar alto risco, e o POCUS disponível não o desfaz', () => {
    const r = avaliarPreOperatorio({
      farmacoId: 'liraglutida',
      fatores: ['sintomas_tgi'],
      pocusDisponivel: true,
    })
    expect(r.risco).toBe('alto')
    expect(r.conduta.id).toBe('alto_risco')
    // curta duração, mas o piso do alto risco é 7 dias (SBA item 5)
    expect(r.suspensao.dias).toBe(7)
  })

  it('alto risco avisa que a ausência de sintomas não exclui resíduo', () => {
    const r = avaliarPreOperatorio({ farmacoId: 'tirzepatida', fatores: ['imc40'] })
    expect(r.avisos.some((a) => /não exclui/i.test(a))).toBe(true)
  })

  it('a dieta de 24 h entra nos passos em qualquer conduta', () => {
    const manter = avaliarPreOperatorio({ farmacoId: 'tirzepatida', pocusDisponivel: true })
    const alto = avaliarPreOperatorio({ farmacoId: 'tirzepatida', fatores: ['acalasia'] })
    expect(manter.passos.some((p) => /líquida sem resíduos/i.test(p))).toBe(true)
    expect(alto.passos.some((p) => /líquida sem resíduos/i.test(p))).toBe(true)
  })

  it('fármaco que não retarda o esvaziamento sai do algoritmo de aspiração', () => {
    const r = avaliarPreOperatorio({ farmacoId: 'sibutramina', fatores: ['imc40'] })
    expect(r.foraDoAlgoritmo).toBe(true)
    expect(r.risco).toBe('na')
    expect(r.passos).toEqual([])
  })

  it('naltrexona/bupropiona guarda a regra de 72 h por causa do opioide', () => {
    const r = avaliarPreOperatorio({ farmacoId: 'naltrexona_bupropiona' })
    expect(r.foraDoAlgoritmo).toBe(true)
    expect(r.suspensao.dias).toBe(3)
    expect(r.suspensao.motivo).toMatch(/receptor opioide/i)
  })

  it('fármaco inexistente devolve null em vez de objeto pela metade', () => {
    expect(avaliarPreOperatorio({ farmacoId: 'nao_existe' })).toBeNull()
    expect(avaliarPreOperatorio({})).toBeNull()
  })

  it('os fatores marcados voltam resolvidos, com o grupo de origem', () => {
    const r = avaliarPreOperatorio({
      farmacoId: 'semaglutida_sc',
      fatores: ['sintomas_tgi', 'via_aerea_dificil'],
    })
    expect(r.fatoresAtivos).toHaveLength(2)
    expect(r.fatoresAtivos.map((f) => f.grupo).sort()).toEqual(['farmaco', 'tecnica'])
  })
})

describe('comparativo entre sociedades', () => {
  it('exatamente uma fonte é marcada como adotada', () => {
    expect(COMPARATIVO.filter((c) => c.principal)).toHaveLength(1)
    expect(COMPARATIVO.find((c) => c.principal).id).toBe('sba')
  })

  it('toda linha declara os três eixos comparados', () => {
    COMPARATIVO.forEach((c) => {
      expect(c.suspensao, `suspensao em ${c.id}`).toBeTruthy()
      expect(c.dieta, `dieta em ${c.id}`).toBeTruthy()
      expect(c.pocus, `pocus em ${c.id}`).toBeTruthy()
    })
  })
})

describe('reorganização por momento (dono 26/08)', () => {
  /**
   * Sequência rápida e conduta de broncoaspiração saíram: 12 itens que valem
   * para QUALQUER estômago cheio — íleo, gestante, trauma — e que um card de
   * consulta de GLP-1 não precisa reensinar. A trava existe porque conteúdo
   * cortado tende a voltar sem decisão.
   */
  it('sequência rápida e broncoaspiração não voltam sem decisão', () => {
    expect(LIB.ISR_PASSOS, 'ISR_PASSOS voltou').toBeUndefined()
    expect(LIB.BRONCOASPIRACAO, 'BRONCOASPIRACAO voltou').toBeUndefined()
  })

  it('o aviso do jejum vive fora da lista de conduta, sem duplicar', () => {
    expect(AVISO_JEJUM_NAO_BASTA).toMatch(/jejum/i)
    // a lista é a conduta do achado ruim; o aviso é do momento de reavaliar
    CONDUTA_ALTO_RISCO.forEach((item) => {
      expect(item, 'aviso duplicado dentro da conduta').not.toBe(AVISO_JEJUM_NAO_BASTA)
    })
    expect(CONDUTA_ALTO_RISCO).toHaveLength(5)
  })

  /**
   * ⚠️ O invariante que protege o card de MENTIR. O veredito virou UM cartão
   * só (o dono apagou o alerta que o duplicava) e o herói é lido em corpo 24.
   * Quando a conduta é MANTER, pôr "7 dias antes" ali diria o oposto do que
   * se decidiu — o intervalo tem de descer para `alternativa`.
   */
  it('o herói do veredito nunca contradiz a conduta', () => {
    const manter = avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', pocusDisponivel: true })
    expect(manter.conduta.id).toBe('manter')
    expect(manter.conduta.heroi).not.toMatch(/\d/)
    expect(manter.conduta.heroi).toMatch(/não é obrigatória/i)
    expect(manter.conduta.alternativa, 'o intervalo tem de continuar alcançável').toMatch(/7 dias antes/)
    // e a explicação vem da CONDUTA, não do motivo do fármaco, que fala de suspender
    expect(manter.explicacao).toBe(manter.conduta.texto)
  })

  it('suspendendo, o herói É o intervalo e a explicação traz a meia-vida', () => {
    const rotina = avaliarPreOperatorio({ farmacoId: 'semaglutida_sc' })
    expect(rotina.conduta.heroi).toBe('7 dias antes')
    expect(rotina.explicacao).toMatch(/Meia-vida/i)
    expect(rotina.conduta.alternativa).toBeUndefined()

    const alto = avaliarPreOperatorio({ farmacoId: 'liraglutida', fatores: ['imc40'] })
    expect(alto.conduta.heroi).toBe('No mínimo 7 dias')
  })

  it('todo veredito traz herói e chip — sem eles o cartão nasce sem título', () => {
    const casos = [
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', pocusDisponivel: true }),
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc' }),
      avaliarPreOperatorio({ farmacoId: 'semaglutida_sc', fatores: ['acalasia'] }),
      avaliarPreOperatorio({ farmacoId: 'sibutramina' }),
    ]
    casos.forEach((c) => {
      expect(c.conduta.heroi, c.conduta.id).toBeTruthy()
      expect(c.conduta.chip, c.conduta.id).toBeTruthy()
      expect(c.conduta.chip.length, `chip longo em ${c.conduta.id}`).toBeLessThanOrEqual(14)
      expect(c.explicacao, c.conduta.id).toBeTruthy()
    })
  })
})
