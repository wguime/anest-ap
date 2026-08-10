/**
 * Plano da TROCA DECLARADA (dono 30/07) — helpers puros de utils:
 * planoExecucaoTroca (swap SIMULTÂNEO: um lado por hospital onde cada pessoa do
 * par ocupa slot no rodapé) e planoDesfazerTroca (caminho de erro humano).
 *
 * Invariantes travadas:
 *  - NENHUM plano contém escrita de ordem_liberacao (só chave de override + ids de caso);
 *  - caso TERMINADO e sala compartilhada ("A + B") nunca entram na transferência;
 *  - quem assume sem uid resolvível → lado só de POSIÇÃO (casoIds vazio) — o
 *    service escreveria "?" nos casos;
 *  - o trocaCom do par é listado p/ limpeza (o badge some após executar).
 */
import { describe, it, expect } from 'vitest'
import { planoExecucaoTroca, planoExecucaoDeclarada, planoDesfazerTroca, localizarSlotRodape, casosTransferiveis, snapshotCasos, lerOverrideAnterior, estadoTrocasDoHistorico, paresDeclarados, assumidasDeRegistro } from '../../pages/escala-cirurgica/utils'

const caso = (id, sala, anestesista, extra = {}) => ({
  id, sala, ordem: 0, anestesista, cirurgiao: 'Cirurgião X',
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// Caso real 30/07: Giovana no rodapé do HRO, Maurício no da Unimed.
const GIOVANA = { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' }
const MAURICIO = { uid: 'uid-mau', nome: 'MAURICIO COSTA', apelido: 'MAURICIO' }
const resolverUid = (n) => {
  const s = String(n || '').trim().toUpperCase()
  if (s === 'GIOVANA') return 'uid-gio'
  if (s === 'MAURICIO') return 'uid-mau'
  return null
}

const escalas = {
  unimed: {
    id: 'esc-uni', hospital: 'unimed',
    ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
    linhaOverrides: { 'uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
    casos: [
      caso('u1', 'S1', 'ANDRE'),
      caso('u2', 'S2', 'MAURICIO', { anestesistaUserId: 'uid-mau' }),
      caso('u3', 'S2', 'MAURICIO', { anestesistaUserId: 'uid-mau', statusCirurgia: 'terminada' }),
      caso('u4', 'S3', 'MAURICIO + ANDRE'), // compartilhado: nunca transfere
    ],
  },
  hro: {
    id: 'esc-hro', hospital: 'hro',
    ordemLiberacao: { vespertino: ['GIOVANA', 'KARINE'] },
    linhaOverrides: {},
    casos: [caso('h1', 'S1', 'GIOVANA', { anestesistaUserId: 'uid-gio' })],
  },
  materno: null,
}

describe('planoExecucaoTroca — swap simultâneo Giovana↔Maurício', () => {
  const plan = planoExecucaoTroca({ escalas, resolverUid, a: MAURICIO, b: GIOVANA })

  it('monta um lado por hospital: Giovana assume na Unimed, Maurício no HRO', () => {
    expect(plan.lados).toHaveLength(2)
    const uni = plan.lados.find((l) => l.hospital === 'unimed')
    expect(uni).toMatchObject({
      escalaId: 'esc-uni', chaveSlot: 'uid-mau', nomeSlot: 'MAURICIO',
      de: { uid: 'uid-mau' }, para: { uid: 'uid-gio', apelido: 'GIOVANA' },
    })
    const hro = plan.lados.find((l) => l.hospital === 'hro')
    expect(hro).toMatchObject({
      escalaId: 'esc-hro', chaveSlot: 'uid-gio', nomeSlot: 'GIOVANA',
      de: { uid: 'uid-gio' }, para: { uid: 'uid-mau', apelido: 'MAURICIO' },
    })
  })

  it('transfere só casos ABERTOS e não-compartilhados (terminada e "A + B" ficam)', () => {
    const uni = plan.lados.find((l) => l.hospital === 'unimed')
    expect(uni.casoIds).toEqual(['u2'])
    const hro = plan.lados.find((l) => l.hospital === 'hro')
    expect(hro.casoIds).toEqual(['h1'])
  })

  it('lista o trocaCom do par para limpeza (badge some após executar)', () => {
    expect(plan.limparTroca).toEqual([{ hospital: 'unimed', escalaId: 'esc-uni', chave: 'uid-mau' }])
  })

  it('nada no plano escreve ordem de liberação', () => {
    const raw = JSON.stringify(plan)
    expect(raw).not.toContain('ordemLiberacao')
    expect(raw).not.toContain('ordem_liberacao')
  })

  it('quem assume SEM uid → lado só de posição (sem transferir caso p/ "?")', () => {
    const semUid = { uid: null, nome: 'FULANO', apelido: 'FULANO' }
    const p = planoExecucaoTroca({ escalas, resolverUid, a: MAURICIO, b: semUid })
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni.para.uid).toBeNull()
    expect(uni.casoIds).toEqual([])
  })

  it('escala demo ENTRA no plano — o context a trata em memória (padrão do toggleLiberacao)', () => {
    const comDemo = { ...escalas, hro: { ...escalas.hro, id: 'demo-hro' } }
    const p = planoExecucaoTroca({ escalas: comDemo, resolverUid, a: MAURICIO, b: GIOVANA })
    expect(p.lados.map((l) => l.hospital).sort()).toEqual(['hro', 'unimed'])
    expect(p.lados.find((l) => l.hospital === 'hro').escalaId).toBe('demo-hro')
  })

  it('declarações do MESMO par em qualquer turno entram na limpeza, cada uma com o turno da própria chave', () => {
    // contrato do D4 (07/08): o par pode ter sido declarado na manhã e executado
    // à tarde — limpar só o turno da tela deixava o badge vivo no outro turno
    const vespertino = {
      ...escalas.unimed,
      linhaOverrides: {
        'matutino:uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'Giovana' } },
        'vespertino:uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'Giovana' } },
      },
    }
    const plan = planoExecucaoTroca({ escalas: { unimed: vespertino }, resolverUid, a: GIOVANA, b: MAURICIO, turno: 'vespertino' })
    expect(plan.limparTroca).toEqual(expect.arrayContaining([
      { hospital: 'unimed', escalaId: 'esc-uni', chave: 'uid-mau', turno: 'matutino' },
      { hospital: 'unimed', escalaId: 'esc-uni', chave: 'uid-mau', turno: 'vespertino' },
    ]))
    expect(plan.limparTroca).toHaveLength(2)
  })

  // PAR CROSS-TURNO (defeito D4, 07/08): Maurício no rodapé MATUTINO da Unimed,
  // Giovana no VESPERTINO do HRO. Produção sempre passa o turno da tela — o
  // filtro antigo achava só um slot e produzia MEIO swap em silêncio (uma pessoa
  // herdava posição+casos e a outra não).
  it('par manhã↔tarde fecha com 2 lados, cada um no turno do PRÓPRIO slot', () => {
    const plan = planoExecucaoTroca({ escalas, resolverUid, a: GIOVANA, b: MAURICIO, turno: 'vespertino' })
    expect(plan.lados).toHaveLength(2)
    const ladoUnimed = plan.lados.find((l) => l.hospital === 'unimed')
    const ladoHro = plan.lados.find((l) => l.hospital === 'hro')
    // o turno de cada lado é o do slot achado — é ele que escopa a chave de escrita
    expect(ladoUnimed.turno).toBe('matutino')
    expect(ladoHro.turno).toBe('vespertino')
  })

  // CORTE DO TURNO DA TELA (dono 10/08): Raquel⇄Nathalia, troca só da TARDE. As
  // duas também trabalham de manhã em outro hospital, e o sheet pedia decisão
  // sobre 4 posições — duas fora da troca ("estão aparecendo turnos que não
  // fazem parte da troca").
  it('quem TEM posição no turno da tela não arrasta a do outro turno', () => {
    const nosDois = {
      unimed: {
        id: 'esc-uni', hospital: 'unimed',
        ordemLiberacao: { matutino: ['GIOVANA'], vespertino: ['MAURICIO'] },
        linhaOverrides: {}, casos: [],
      },
      hro: {
        id: 'esc-hro', hospital: 'hro',
        ordemLiberacao: { matutino: ['MAURICIO'], vespertino: ['GIOVANA'] },
        linhaOverrides: {}, casos: [],
      },
    }
    const plan = planoExecucaoTroca({ escalas: nosDois, resolverUid, a: MAURICIO, b: GIOVANA, turno: 'vespertino' })
    expect(plan.lados).toHaveLength(2)
    expect(plan.lados.every((l) => l.turno === 'vespertino')).toBe(true)
    expect(plan.lados.map((l) => l.hospital).sort()).toEqual(['hro', 'unimed'])
  })

  it('pessoa sem slot em lugar nenhum → pendência sem_slot (nunca meio swap calado)', () => {
    const FORA = { uid: 'uid-fora', nome: 'COLEGA DE FORA', apelido: 'FORA' }
    const plan = planoExecucaoTroca({ escalas, resolverUid, a: GIOVANA, b: FORA, turno: 'vespertino' })
    expect(plan.lados).toHaveLength(1) // só o slot da Giovana
    expect(plan.pendencias).toEqual([{ pessoa: FORA, motivo: 'sem_slot' }])
  })

  it('par completo → sem pendências', () => {
    const plan = planoExecucaoTroca({ escalas, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(plan.pendencias).toEqual([])
  })
})

describe('planoDesfazerTroca — reverte os dois lados', () => {
  // estado PÓS-execução: assumidaPor nos dois slots, casos já transferidos
  const escalasPos = {
    unimed: {
      id: 'esc-uni', hospital: 'unimed',
      ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
      linhaOverrides: { 'uid-mau': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
      casos: [caso('u2', 'S2', 'GIOVANA', { anestesistaUserId: 'uid-gio' })],
    },
    hro: {
      id: 'esc-hro', hospital: 'hro',
      ordemLiberacao: { vespertino: ['GIOVANA', 'KARINE'] },
      linhaOverrides: { 'uid-gio': { assumidaPor: { uid: 'uid-mau', nome: 'MAURICIO COSTA' } } },
      casos: [caso('h1', 'S1', 'MAURICIO', { anestesistaUserId: 'uid-mau' })],
    },
    materno: null,
  }

  it('acha as duas assunções e devolve os casos ao dono original de cada slot', () => {
    const p = planoDesfazerTroca({ escalas: escalasPos, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(p.lados).toHaveLength(2)
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni).toMatchObject({ chaveSlot: 'uid-mau', de: { uid: 'uid-gio' }, para: { uid: 'uid-mau' } })
    expect(uni.casoIds).toEqual(['u2'])
    const hro = p.lados.find((l) => l.hospital === 'hro')
    expect(hro).toMatchObject({ chaveSlot: 'uid-gio', de: { uid: 'uid-mau' }, para: { uid: 'uid-gio' } })
    expect(hro.casoIds).toEqual(['h1'])
  })

  // INCIDENTE 10/08: a assunção foi executada nos slots da MANHÃ e não moveu
  // caso nenhum; ao desfazer, os casos da TARDE (que nunca saíram do lugar)
  // foram entregues ao colega e as duas ficaram sem caso no próprio rodapé — a
  // fila do vespertino inteira embaralhou.
  it('devolve SÓ os casos que a execução moveu (recibo em assumidaPor.casoIds)', () => {
    const escalas = {
      unimed: {
        id: 'esc-uni', hospital: 'unimed',
        ordemLiberacao: { matutino: ['MAURICIO'] },
        // assunção da MANHÃ que não trouxe caso algum
        linhaOverrides: { 'matutino:uid-mau': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA', casoIds: [] } } },
        // caso da TARDE, legitimamente da Giovana
        casos: [caso('u9', 'S9', 'GIOVANA', { anestesistaUserId: 'uid-gio', turno: 'vespertino' })],
      },
    }
    const p = planoDesfazerTroca({ escalas, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(p.lados).toHaveLength(1)
    expect(p.lados[0].casoIds).toEqual([])
  })

  it('recibo antigo (sem casoIds) devolve só os casos DO TURNO do slot', () => {
    const escalas = {
      unimed: {
        id: 'esc-uni', hospital: 'unimed',
        ordemLiberacao: { matutino: ['MAURICIO'] },
        linhaOverrides: { 'matutino:uid-mau': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
        casos: [
          caso('u1', 'S1', 'GIOVANA', { anestesistaUserId: 'uid-gio', turno: 'matutino' }),
          caso('u9', 'S9', 'GIOVANA', { anestesistaUserId: 'uid-gio', turno: 'vespertino' }),
        ],
      },
    }
    const p = planoDesfazerTroca({ escalas, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(p.lados[0].casoIds).toEqual(['u1'])
  })

  it('caso já repassado a outra pessoa não volta pelo recibo', () => {
    const escalas = {
      unimed: {
        id: 'esc-uni', hospital: 'unimed',
        ordemLiberacao: { matutino: ['MAURICIO'] },
        linhaOverrides: { 'matutino:uid-mau': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA', casoIds: ['u1', 'u2'] } } },
        casos: [
          caso('u1', 'S1', 'GIOVANA', { anestesistaUserId: 'uid-gio', turno: 'matutino' }),
          caso('u2', 'S2', 'KARINE', { anestesistaUserId: 'uid-kar', turno: 'matutino' }),
        ],
      },
    }
    const p = planoDesfazerTroca({ escalas, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(p.lados[0].casoIds).toEqual(['u1'])
  })

  it('dono original sem uid → só limpa a assunção (para null, sem casos)', () => {
    const p = planoDesfazerTroca({
      escalas: escalasPos, resolverUid,
      a: GIOVANA, b: { uid: null, nome: 'MAURICIO COSTA', apelido: 'MAURICIO' },
    })
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni.para).toBeNull()
    expect(uni.casoIds).toEqual([])
  })
})

describe('localizarSlotRodape / casosTransferiveis — resolução de identidade', () => {
  it('acha o slot pelo apelido do dicionário e pelo nome ensinado pelos casos', () => {
    // dicionário resolve GIOVANA→uid-gio; o slot informa o turno onde FOI achado
    expect(localizarSlotRodape(escalas.hro, GIOVANA, resolverUid)).toEqual({ nome: 'GIOVANA', chave: 'uid-gio', turno: 'vespertino' })
    // sem dicionário: os casos ensinam MAURICIO→uid-mau (chave cai no nome, estável)
    expect(localizarSlotRodape(escalas.unimed, MAURICIO, () => null)).toEqual({ nome: 'MAURICIO', chave: 'MAURICIO', turno: 'matutino' })
    // quem não está em rodapé nenhum
    expect(localizarSlotRodape(escalas.unimed, { uid: 'uid-x', nome: 'NINGUEM' }, resolverUid)).toBeNull()
  })

  it('turno pedido é PREFERÊNCIA: slot só no outro turno ainda é achado, com o turno DELE (D3/D4)', () => {
    // Giovana só tem slot no vespertino do HRO; a tela está no matutino
    expect(localizarSlotRodape(escalas.hro, GIOVANA, resolverUid, 'matutino'))
      .toEqual({ nome: 'GIOVANA', chave: 'uid-gio', turno: 'vespertino' })
  })

  it('casosTransferiveis casa por uid mesmo com grafia diferente do nome', () => {
    const esc = {
      casos: [caso('c1', 'S1', 'G. SILVA', { anestesistaUserId: 'uid-gio' })],
    }
    expect(casosTransferiveis(esc, GIOVANA, resolverUid)).toEqual(['c1'])
  })
})

// PLANO ANCORADO NA DECLARAÇÃO (Fase 2 — convergência da importação). O caso
// canônico: DIDO duplicado nos DOIS hospitais, "trocou com Paulo". O varre-tudo
// do planoExecucaoTroca também trocaria a posição onde o DIDO vai ficar; o
// plano ancorado troca SÓ a vaga declarante + a recíproca do parceiro.
describe('planoExecucaoDeclarada — âncora no slot declarante', () => {
  const DIDO = { uid: 'uid-dido', nome: 'GUILHERME XAVIER', apelido: 'DIDO' }
  const PAULO = { uid: 'uid-paulo', nome: 'PAULO TONINI', apelido: 'PAULO' }
  const resolve = (n) => ({ DIDO: 'uid-dido', PAULO: 'uid-paulo' })[String(n || '').trim().toUpperCase()] || null
  // DIDO nos rodapés da Unimed E do HRO (duplicado); PAULO só no HRO
  const escalasDup = {
    unimed: {
      id: 'esc-uni', hospital: 'unimed',
      ordemLiberacao: { matutino: ['DIDO'] },
      linhaOverrides: {},
      casos: [caso('u1', 'S1', 'DIDO', { anestesistaUserId: 'uid-dido' })],
    },
    hro: {
      id: 'esc-hro', hospital: 'hro',
      ordemLiberacao: { matutino: ['DIDO', 'PAULO'] },
      linhaOverrides: {},
      casos: [caso('h1', 'S1', 'PAULO', { anestesistaUserId: 'uid-paulo' })],
    },
    materno: null,
  }
  const par = { hospital: 'unimed', escalaId: 'esc-uni', turno: 'matutino', chave: 'uid-dido' }

  it('troca a vaga DECLARANTE + a recíproca do parceiro — nunca a posição onde o duplicado fica', () => {
    const plan = planoExecucaoDeclarada({ escalas: escalasDup, resolverUid: resolve, par, a: DIDO, b: PAULO })
    expect(plan.lados).toHaveLength(2)
    // vaga duplicada na Unimed → Paulo assume
    expect(plan.lados[0]).toMatchObject({ escalaId: 'esc-uni', chaveSlot: 'uid-dido', para: { uid: 'uid-paulo' } })
    // recíproca: vaga do Paulo no HRO → Dido assume
    expect(plan.lados[1]).toMatchObject({ escalaId: 'esc-hro', chaveSlot: 'uid-paulo', para: { uid: 'uid-dido' } })
    // a vaga do DIDO no HRO (onde ele VAI FICAR) não aparece em lado nenhum
    expect(plan.lados.some((l) => l.escalaId === 'esc-hro' && l.chaveSlot === 'uid-dido')).toBe(false)
    expect(plan.pendencias).toEqual([])
  })

  it('parceiro sem vaga em lugar nenhum = assunção unilateral (1 lado, sem pendência de slot)', () => {
    const semPaulo = {
      ...escalasDup,
      hro: { ...escalasDup.hro, ordemLiberacao: { matutino: ['DIDO'] }, casos: [] },
    }
    const plan = planoExecucaoDeclarada({ escalas: semPaulo, resolverUid: resolve, par, a: DIDO, b: PAULO })
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({ escalaId: 'esc-uni', para: { uid: 'uid-paulo' } })
    expect(plan.pendencias).toEqual([])
  })
})

// PAR REGISTRADO × CARD EXTRA (incidente 10/08): registrar a troca com o rodapé
// ainda no nome antigo deixava quem opera aqui sem posição — card solto no fim
// da fila — enquanto a posição ficava com quem nem está no hospital.
describe('assumidasDeRegistro — o colega assume o slot só com evidência', () => {
  const par = { a: GIOVANA, b: MAURICIO }
  // rodapé daqui tem GIOVANA; quem tem caso aqui é o MAURICIO (caso Raquel⇄Nathalia)
  const rodape = ['GIOVANA', 'KARINE']
  const casosDoMauricio = [caso('c1', 'S1', 'MAURICIO', { anestesistaUserId: 'uid-mau' })]

  it('parceiro sem posição aqui, com caso aqui, e dono do slot sem caso → assume', () => {
    expect(assumidasDeRegistro({ pares: [par], rodape, casos: casosDoMauricio, resolverUid }))
      .toEqual({ 'uid-gio': { uid: 'uid-mau', nome: 'MAURICIO COSTA', motivo: null, registro: true } })
  })

  it('dono do slot trabalhando aqui → o slot continua dele', () => {
    const casos = [...casosDoMauricio, caso('c2', 'S2', 'GIOVANA', { anestesistaUserId: 'uid-gio' })]
    expect(assumidasDeRegistro({ pares: [par], rodape, casos, resolverUid })).toEqual({})
  })

  it('escala já publicada trocada (cada um no próprio rodapé) → nada muda', () => {
    expect(assumidasDeRegistro({
      pares: [par], rodape: ['GIOVANA', 'MAURICIO'], casos: casosDoMauricio, resolverUid,
    })).toEqual({})
  })

  it('sem caso aqui não há evidência: o parceiro não toma o slot', () => {
    expect(assumidasDeRegistro({ pares: [par], rodape, casos: [], resolverUid })).toEqual({})
  })

  it('par histórico (rastro de swap já executado) é ignorado', () => {
    expect(assumidasDeRegistro({
      pares: [{ ...par, historica: true }], rodape, casos: casosDoMauricio, resolverUid,
    })).toEqual({})
  })
})

// REGISTRO ≠ DECLARAÇÃO (dono 10/08): quando a escala já sai publicada com os
// nomes trocados, o par entra só como rastro (`apenasRegistro`). Se a
// convergência da importação o executasse, a próxima publicação MOVERIA os dois
// e desfaria a troca real — foi o caso Rafael⇄Garim.
describe('paresDeclarados — registro não vira execução', () => {
  const escalasCom = (trocaCom) => ({
    hro: {
      id: 'esc-hro', hospital: 'hro',
      ordemLiberacao: { matutino: ['GIOVANA'] },
      linhaOverrides: { 'matutino:uid-gio': { trocaCom } },
      casos: [],
    },
  })

  it('par pendente entra na convergência', () => {
    const pares = paresDeclarados(escalasCom({ uid: 'uid-mau', nome: 'MAURICIO' }))
    expect(pares).toHaveLength(1)
    expect(pares[0]).toMatchObject({ escalaId: 'esc-hro', turno: 'matutino', chave: 'uid-gio' })
  })

  it('par só de REGISTRO fica de fora', () => {
    expect(paresDeclarados(escalasCom({ uid: 'uid-mau', nome: 'MAURICIO', apenasRegistro: true }))).toEqual([])
  })
})

// HISTÓRICO → PARES (defeito D1, 07/08): executar a troca limpa o trocaCom e o
// trigger registra `troca_desfeita` — igual à desistência do usuário. Derivar
// par de QUALQUER evento ressuscitava badge de troca desfeita e oferecia
// "Executar" de novo. Só `posicao_assumida` (swap que aconteceu) gera rastro.
describe('estadoTrocasDoHistorico — só swap executado vira par', () => {
  const ev = (anestesista, statusPara, detalhe, em) => ({ anestesista, statusPara, detalhe, em })
  const DET = { uid: 'uid-gio', nome: 'GIOVANA SILVA' }

  it('troca_declarada e troca_desfeita NUNCA geram par (era o bug do badge ressuscitado)', () => {
    const eventos = [
      ev('matutino:uid-mau', 'troca_desfeita', DET, '3'),
      ev('matutino:uid-mau', 'troca_declarada', DET, '2'),
    ]
    expect(estadoTrocasDoHistorico(eventos, 'matutino')).toEqual([])
  })

  it('posicao_assumida gera o rastro — e o MAIS RECENTE por chave ganha (lista vem desc)', () => {
    const outra = { uid: 'uid-kar', nome: 'KARINE BEDIN' }
    const eventos = [
      ev('matutino:uid-mau', 'posicao_assumida', outra, '5'),
      ev('matutino:uid-mau', 'posicao_assumida', DET, '1'),
    ]
    expect(estadoTrocasDoHistorico(eventos, 'matutino')).toEqual([{ chave: 'uid-mau', detalhe: outra }])
  })

  it('o rastro sobrevive ao desfazer (6e99f68: caso encerrado não perde quem executou)', () => {
    const eventos = [
      ev('matutino:uid-mau', 'assuncao_desfeita', DET, '2'),
      ev('matutino:uid-mau', 'posicao_assumida', DET, '1'),
    ]
    expect(estadoTrocasDoHistorico(eventos, 'matutino')).toEqual([{ chave: 'uid-mau', detalhe: DET }])
  })

  it('isola por turno: evento sem prefixo é matutino e nunca vaza para a tarde', () => {
    const eventos = [
      ev('uid-mau', 'posicao_assumida', DET, '2'), // legado sem prefixo = matutino
      ev('vespertino:uid-kar', 'posicao_assumida', DET, '1'),
    ]
    expect(estadoTrocasDoHistorico(eventos, 'matutino')).toEqual([{ chave: 'uid-mau', detalhe: DET }])
    expect(estadoTrocasDoHistorico(eventos, 'vespertino')).toEqual([{ chave: 'uid-kar', detalhe: DET }])
  })

  it('detalhe sem uid nem nome não vira par', () => {
    expect(estadoTrocasDoHistorico([ev('matutino:x', 'posicao_assumida', {}, '1')], 'matutino')).toEqual([])
  })
})

// ROLLBACK POR SNAPSHOT (defeito D2, 07/08): reverter a transferência com
// `{ uid: de.uid }` apagava o anestesista quando o dono não tinha vínculo —
// uid null faz o service gravar '?' + sem_anestesista. O snapshot captura o
// que estava lá (inclusive o TEXTO original) e é o único combustível do
// rollback em executarSubstituicao/desfazerSubstituicao.
describe('snapshotCasos — combustível do rollback', () => {
  it('captura os campos exatos, inclusive dono SEM uid (texto original preservado)', () => {
    const esc = {
      casos: [
        caso('c1', 'S1', 'STAUB'), // sem vínculo — o cenário que o rollback antigo apagava
        caso('c2', 'S2', 'GIOVANA', { anestesistaUserId: 'uid-gio' }),
        caso('c3', 'S3', 'OUTRO'),
      ],
    }
    expect(snapshotCasos(esc, ['c1', 'c2'])).toEqual([
      { id: 'c1', anestesista: 'STAUB', anestesistaUserId: null, semAnestesista: false },
      { id: 'c2', anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false },
    ])
  })

  it('ids fora da escala e lista vazia → snapshot vazio (rollback vira no-op)', () => {
    expect(snapshotCasos({ casos: [caso('c1', 'S1', 'A')] }, ['c9'])).toEqual([])
    expect(snapshotCasos({ casos: [] }, ['c1'])).toEqual([])
    expect(snapshotCasos(null, ['c1'])).toEqual([])
  })
})

// CADEIA DE FALLBACK (defeito D6, 07/08): marcarTroca lia SÓ a chave
// namespaced — declarar troca sobre um override legado (chave crua ou nome)
// criava uma SEGUNDA entrada e o local/observação da antiga sumia da UI.
describe('lerOverrideAnterior — cadeia canônica de leitura', () => {
  const overrides = {
    'matutino:uid-mau': { local: 'S2' },
    'uid-gio': { observacao: 'legado cru' },
    'MAURICIO': { local: 'nome legado' },
  }

  it('prefere a chave namespaced do turno', () => {
    expect(lerOverrideAnterior(overrides, 'uid-mau', 'matutino'))
      .toEqual({ valor: { local: 'S2' }, chaveEncontrada: 'matutino:uid-mau', scoped: 'matutino:uid-mau' })
  })

  it('cai para a chave crua (legado) e informa onde achou — o chamador migra', () => {
    expect(lerOverrideAnterior(overrides, 'uid-gio', 'vespertino'))
      .toEqual({ valor: { observacao: 'legado cru' }, chaveEncontrada: 'uid-gio', scoped: 'vespertino:uid-gio' })
  })

  it('cai para o nome legado quando a chave promoveu para uid', () => {
    expect(lerOverrideAnterior(overrides, 'uid-x', 'matutino', ['MAURICIO']))
      .toEqual({ valor: { local: 'nome legado' }, chaveEncontrada: 'MAURICIO', scoped: 'matutino:uid-x' })
  })

  it('nada encontrado → valor null com a scoped calculada', () => {
    expect(lerOverrideAnterior({}, 'uid-x', 'matutino'))
      .toEqual({ valor: null, chaveEncontrada: null, scoped: 'matutino:uid-x' })
  })
})
