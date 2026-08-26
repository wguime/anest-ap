import { describe, it, expect } from 'vitest'
import {
  ANTICOAGULANTES,
  REVERSORES,
  CLASSES,
  agruparPorClasse,
  avaliarBloqueio,
  buscarFarmacos,
  calcularLiberacao,
  faltamTexto,
  formatarMomento,
  getFarmaco,
  getReversor,
  horasParaTexto,
  resolverJanela,
} from '../../lib/anticoagulantes'

describe('integridade da base', () => {
  it('todo fármaco tem as quatro janelas e uma classe conhecida', () => {
    ANTICOAGULANTES.forEach((f) => {
      expect(CLASSES[f.classe], `classe desconhecida em ${f.id}`).toBeTruthy()
      expect(f.antes, `sem janela "antes" em ${f.id}`).toBeTruthy()
      expect(f.retirada, `sem janela "retirada" em ${f.id}`).toBeTruthy()
      expect(f.aposPuncao, `sem "aposPuncao" em ${f.id}`).toBeTruthy()
      expect(f.aposRetirada, `sem "aposRetirada" em ${f.id}`).toBeTruthy()
    })
  })

  it('ids são únicos', () => {
    const ids = ANTICOAGULANTES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo reversor citado por um fármaco existe na lista de reversores', () => {
    ANTICOAGULANTES.forEach((f) => {
      expect(getReversor(f.reversor), `reversor "${f.reversor}" de ${f.id} não existe`).toBeTruthy()
    })
  })

  it('todo rótulo de badge é curto — badge não encolhe e esmaga o texto ao lado', () => {
    // O GP IIb/IIIa tinha "Eptifibatide e tirofibana: 4–8 h · Abciximabe: 24–48 h"
    // no badge da lista e sobravam 49px para o nome do fármaco (medido a 430px).
    ANTICOAGULANTES.forEach((f) => {
      const j = resolverJanela(f.antes)
      expect(j.resumo.length, `resumo longo demais em ${f.id}: "${j.resumo}"`).toBeLessThanOrEqual(16)
    })
  })

  it('o "início" do reversor cabe num badge', () => {
    REVERSORES.forEach((r) => {
      expect(r.inicio.length, `início longo demais em ${r.id}: "${r.inicio}"`).toBeLessThanOrEqual(16)
    })
  })

  it('toda janela tem horas OU texto — nunca cartão vazio na tela', () => {
    ANTICOAGULANTES.forEach((f) => {
      ;['antes', 'retirada', 'aposPuncao', 'aposRetirada'].forEach((k) => {
        const j = resolverJanela(f[k])
        expect(j.texto, `${f.id}.${k} renderizaria vazio`).toBeTruthy()
      })
    })
  })
})

describe('buscarFarmacos', () => {
  it('termo vazio devolve a base inteira', () => {
    expect(buscarFarmacos('')).toHaveLength(ANTICOAGULANTES.length)
    expect(buscarFarmacos(null)).toHaveLength(ANTICOAGULANTES.length)
  })

  it('acha pelo nome comercial — é assim que a droga chega na prescrição', () => {
    expect(buscarFarmacos('Xarelto').map((f) => f.id)).toEqual([
      'rivaroxabana_baixa',
      'rivaroxabana_alta',
    ])
    expect(buscarFarmacos('clexane').map((f) => f.id)).toContain('enox_alta')
    expect(buscarFarmacos('Marevan').map((f) => f.id)).toEqual(['varfarina'])
  })

  it('ignora acento e caixa', () => {
    expect(buscarFarmacos('DABIGATRANA')).toHaveLength(2)
    expect(buscarFarmacos('plaquetarios').length).toBe(buscarFarmacos('plaquetários').length)
  })

  it('termo sem correspondência devolve lista vazia', () => {
    expect(buscarFarmacos('zzzz')).toHaveLength(0)
  })
})

describe('resolverJanela — ajuste por função renal e idade', () => {
  it('sem ClCr informado mantém o intervalo padrão (não chuta a favor nem contra)', () => {
    const j = resolverJanela(getFarmaco('dabigatrana_alta').antes, {})
    expect(j.horas).toBe(72)
    expect(j.ajustado).toBe(false)
  })

  it('dabigatrana dose alta: ClCr 30–49 estende para 120 h', () => {
    const j = resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 40 })
    expect(j.horas).toBe(120)
    expect(j.ajustado).toBe(true)
  })

  it('dabigatrana dose alta: ClCr < 30 bloqueia a punção', () => {
    const j = resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 25 })
    expect(j.bloqueado).toBe(true)
    expect(j.horas).toBeNull()
    expect(j.motivo).toMatch(/30 ng\/mL/)
  })

  it('fronteira: ClCr exatamente 49 estende, 50 não', () => {
    expect(resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 49 }).horas).toBe(120)
    expect(resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 50 }).horas).toBe(72)
  })

  it('fronteira: ClCr 29 bloqueia, 30 apenas estende', () => {
    expect(resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 29 }).bloqueado).toBe(true)
    expect(resolverJanela(getFarmaco('dabigatrana_alta').antes, { clcr: 30 }).horas).toBe(120)
  })

  it('enoxaparina dose alta dobra o intervalo com ClCr < 30', () => {
    expect(resolverJanela(getFarmaco('enox_alta').antes, { clcr: 20 }).horas).toBe(48)
    expect(resolverJanela(getFarmaco('enox_alta').antes, { clcr: 60 }).horas).toBe(24)
  })

  it('fondaparinux: a regra renal vence a de idade quando as duas casam', () => {
    // ClCr 40 em paciente de 80 anos → 58 h (renal), não 42 h (idoso).
    expect(resolverJanela(getFarmaco('fonda_baixa').antes, { clcr: 40, idade: 80 }).horas).toBe(58)
    expect(resolverJanela(getFarmaco('fonda_baixa').antes, { idade: 80 }).horas).toBe(42)
    expect(resolverJanela(getFarmaco('fonda_baixa').antes, { idade: 40 }).horas).toBe(36)
  })

  it('fondaparinux com ClCr < 30 não tem intervalo — é contraindicação', () => {
    const j = resolverJanela(getFarmaco('fonda_baixa').antes, { clcr: 20 })
    expect(j.bloqueado).toBe(true)
    expect(j.texto).toBe('Não realizar')
  })
})

describe('horasParaTexto', () => {
  it('zero vira "Sem intervalo" — nunca "0 h", que se lê como erro', () => {
    expect(horasParaTexto(0)).toBe('Sem intervalo')
  })
  it('abaixo de 24 h fica em horas', () => {
    expect(horasParaTexto(6)).toBe('6 h')
    expect(horasParaTexto(12)).toBe('12 h')
  })
  it('dia redondo ganha o equivalente entre parênteses', () => {
    expect(horasParaTexto(72)).toBe('72 h (3 dias)')
    expect(horasParaTexto(24)).toBe('24 h (1 dia)')
    expect(horasParaTexto(120)).toBe('120 h (5 dias)')
  })
  it('dia quebrado não vira decimal ("58 h (2,4 dias)" atrapalha)', () => {
    expect(horasParaTexto(58)).toBe('58 h')
    expect(horasParaTexto(42)).toBe('42 h')
  })
  it('nulo vira travessão', () => {
    expect(horasParaTexto(null)).toBe('—')
  })
})

describe('calcularLiberacao', () => {
  const ultimaDose = '2026-08-25T08:00:00'

  it('soma as horas à última dose', () => {
    const r = calcularLiberacao(ultimaDose, 72, new Date('2026-08-25T09:00:00'))
    expect(formatarMomento(r.data)).toBe('28/08 08:00')
    expect(r.liberado).toBe(false)
  })

  it('marca liberado quando o alvo já passou', () => {
    const r = calcularLiberacao(ultimaDose, 12, new Date('2026-08-25T21:00:00'))
    expect(r.liberado).toBe(true)
    expect(r.falta).toBe('liberado')
  })

  it('devolve null sem última dose ou sem intervalo', () => {
    expect(calcularLiberacao(null, 72)).toBeNull()
    expect(calcularLiberacao(ultimaDose, null)).toBeNull()
  })

  it('data inválida não quebra a tela', () => {
    expect(calcularLiberacao('não é data', 12)).toBeNull()
  })
})

describe('faltamTexto', () => {
  const agora = new Date('2026-08-25T08:00:00')
  it('minutos, horas e dias', () => {
    expect(faltamTexto(new Date('2026-08-25T08:40:00'), agora)).toBe('faltam 40 min')
    expect(faltamTexto(new Date('2026-08-25T14:30:00'), agora)).toBe('faltam 6 h 30 min')
    expect(faltamTexto(new Date('2026-08-27T14:00:00'), agora)).toBe('faltam 2 d 6 h')
  })
  it('alvo no passado é "liberado"', () => {
    expect(faltamTexto(new Date('2026-08-25T07:00:00'), agora)).toBe('liberado')
  })
})

describe('avaliarBloqueio', () => {
  it('id inexistente devolve null', () => {
    expect(avaliarBloqueio({ farmacoId: 'nao_existe' })).toBeNull()
  })

  it('rivaroxabana dose alta: 72 h para puncionar e 24 h até a próxima dose', () => {
    const a = avaliarBloqueio({ farmacoId: 'rivaroxabana_alta' })
    expect(a.janelas.antes.horas).toBe(72)
    expect(a.janelas.aposRetirada.horas).toBe(24)
    expect(a.cateter.id).toBe('nao')
    expect(a.reversor.id).toBe('andexanet')
  })

  it('enoxaparina profilática aceita cateter; a terapêutica não', () => {
    expect(avaliarBloqueio({ farmacoId: 'enox_baixa' }).cateter.id).toBe('sim')
    expect(avaliarBloqueio({ farmacoId: 'enox_alta' }).cateter.id).toBe('nao')
  })

  it('AAS isolado não impõe intervalo', () => {
    const a = avaliarBloqueio({ farmacoId: 'aas' })
    expect(a.janelas.antes.horas).toBe(0)
    expect(a.janelas.antes.texto).toBe('Sem intervalo')
    expect(a.cateter.id).toBe('sim')
  })

  it('plaquetas abaixo de 70 mil avisam com texto diferente do 70–80 mil', () => {
    const grave = avaliarBloqueio({ farmacoId: 'enox_baixa', plaquetas: 55 })
    const limitrofe = avaliarBloqueio({ farmacoId: 'enox_baixa', plaquetas: 75 })
    expect(grave.avisos.join(' ')).toMatch(/incerto/)
    expect(limitrofe.avisos.join(' ')).toMatch(/80\.000/)
    expect(avaliarBloqueio({ farmacoId: 'enox_baixa', plaquetas: 150 }).avisos).toHaveLength(0)
  })

  it('RNI ≥ 1,5 avisa; abaixo disso não', () => {
    expect(avaliarBloqueio({ farmacoId: 'varfarina', inr: 1.8 }).avisos.join(' ')).toMatch(/RNI/)
    expect(avaliarBloqueio({ farmacoId: 'varfarina', inr: 1.2 }).avisos).toHaveLength(0)
  })

  it('fármaco bloqueado propaga o motivo para os avisos', () => {
    const a = avaliarBloqueio({ farmacoId: 'dti_parenteral' })
    expect(a.janelas.antes.bloqueado).toBe(true)
    expect(a.avisos.length).toBeGreaterThan(0)
  })

  it('com última dose informada calcula o horário de liberação', () => {
    const a = avaliarBloqueio({
      farmacoId: 'enox_baixa',
      ultimaDose: '2026-08-25T06:00:00',
      agora: new Date('2026-08-25T10:00:00'),
    })
    expect(formatarMomento(a.liberacao.data)).toBe('25/08 18:00')
    expect(a.liberacao.liberado).toBe(false)
  })

  it('fármaco bloqueado não gera horário de liberação falso', () => {
    const a = avaliarBloqueio({
      farmacoId: 'fonda_baixa',
      clcr: 20,
      ultimaDose: '2026-08-25T06:00:00',
    })
    expect(a.liberacao).toBeNull()
  })
})

describe('agruparPorClasse', () => {
  it('respeita a ordem declarada em CLASSES', () => {
    const ordem = agruparPorClasse().map((g) => g.classe)
    expect(ordem[0]).toBe('heparina')
    expect(ordem[ordem.length - 1]).toBe('outros')
  })

  it('não perde nem duplica fármaco', () => {
    const total = agruparPorClasse().reduce((acc, g) => acc + g.farmacos.length, 0)
    expect(total).toBe(ANTICOAGULANTES.length)
  })
})

describe('reversores', () => {
  it('todo reversor tem alvo, dose e nota de disponibilidade no Brasil', () => {
    REVERSORES.forEach((r) => {
      expect(r.alvo, `${r.id} sem alvo`).toBeTruthy()
      expect(r.dose, `${r.id} sem dose`).toBeTruthy()
      expect(r.brasil, `${r.id} sem nota de disponibilidade`).toBeTruthy()
    })
  })

  it('idarucizumabe é o reversor da dabigatrana nas duas doses', () => {
    expect(getFarmaco('dabigatrana_baixa').reversor).toBe('idarucizumabe')
    expect(getFarmaco('dabigatrana_alta').reversor).toBe('idarucizumabe')
  })

  it('fondaparinux não tem antídoto — protamina não reverte', () => {
    expect(getFarmaco('fonda_baixa').reversor).toBe('nenhum')
    expect(getFarmaco('fonda_alta').reversor).toBe('nenhum')
  })
})

describe('as regras vivem no próprio fármaco', () => {
  /**
   * Dono 25/08: "quero que sempre coloque as regras, para evitar ficar
   * procurando em outros fármacos (pode manter a informação: mesma dose que
   * X...)". Dalteparina e nadroparina só diziam "mesmas regras da
   * enoxaparina" e paravam aí — quem estava com o paciente na frente tinha de
   * sair da tela para achar o número. A referência pode ficar; sozinha, não.
   */
  it('alerta que cita outro fármaco também traz os números', () => {
    ANTICOAGULANTES.forEach((f) => {
      ;(f.alertas || []).forEach((a) => {
        if (!/mesmas? regras?|mesma dose/i.test(a)) return
        expect(/\d\s*h/i.test(a), `referência sem número em ${f.id}: "${a}"`).toBe(true)
      })
    })
  })

  it('dalteparina e nadroparina declaram as quatro janelas por dose', () => {
    ;['dalteparina', 'nadroparina'].forEach((id) => {
      const f = ANTICOAGULANTES.find((x) => x.id === id)
      const a = f.alertas[0]
      expect(a, `punção em ${id}`).toMatch(/pun[çc][ãa]o e retirada/i)
      expect(a, `dose baixa em ${id}`).toMatch(/12 h na dose baixa/i)
      expect(a, `dose alta em ${id}`).toMatch(/24 h na dose alta/i)
      // \b evita casar o "4 h" que existe DENTRO de "24 h" — foi o que quase
      // deixou esta trava passar no texto antigo, que não falava da próxima dose
      expect(a, `reintrodução em ${id}`).toMatch(/\b4 h depois de retirar/i)
      expect(a, `referência em ${id}`).toMatch(/enoxaparina/i)
    })
  })
})
