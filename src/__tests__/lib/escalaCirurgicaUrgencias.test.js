/**
 * Urgências do HRO — ocupação contratada e fila (decisões do dono, 2026-08-18).
 *
 * Regras travadas aqui:
 *  1. Capacidade = 2 (plantonista + sobreaviso). Sala 4 (ortopedia) e Sala 7 - CO são
 *     absorvidas pelo dedicado e ficam FORA da conta — mas o CO só é dedicado DE MANHÃ:
 *     à tarde e à noite volta a pesar no plantonista. Contrato é config POR TURNO.
 *  2. Fila por gravidade (adaptação NCEPOD) e, no empate, por ordem de chegada.
 *  3. Exclusão pela SALA, nunca pelo procedimento: a mesma colonoscopia conta ou não
 *     conta dependendo de ONDE é feita.
 *  4. A capacidade vem do RELÓGIO, não do campo `turno` (que só aceita
 *     matutino|vespertino, então a urgência das 21h vive no vespertino).
 *
 * REVISÃO 20/08 (dono): a unidade da conta é a SALA, e sala que é ESTAÇÃO do turno
 * (marcada como plantão/sobreaviso, ou papel do contrato sem dedicado — o CO à
 * tarde/noite) ocupa vaga por ter cirurgia aberta, sem depender de alguém ter
 * marcado "iniciada". Foi o caso relatado: CO cheio à tarde, "0 de 2 salas" na tela.
 */
import { describe, expect, it } from 'vitest'
import {
  CONTRATO_HRO,
  GRAVIDADE_ORDEM,
  LIMITE_ESQUECIDA_MIN,
  SALAS_FORA_DO_CONTRATO_HRO,
  chegadaDaUrgencia,
  estadoUrgencias,
  inicioDaUrgencia,
  papelDaSalaHro,
  turnoContratual,
} from '@/lib/escalaCirurgicaUrgencias'

const HOJE = '2026-08-18'

/** Fixture espelhando a linha real de `escala_cirurgica_caso`. */
const caso = (sala, extra = {}) => ({
  id: extra.id || `c-${sala}-${extra.hora || extra.procedimento || Math.random()}`,
  sala,
  ordem: 0,
  tipo: 'urgencia',
  statusCirurgia: 'agendada',
  statusExtra: null,
  hora: null,
  procedimento: 'PROCEDIMENTO',
  convenio: 'SUS',
  created_at: `${HOJE}T10:00:00`,
  ...extra,
})

/** urgência JÁ em andamento (o `iniciada` do outro describe é local dele). */
const iniciada2 = (sala, id) =>
  caso(sala, { id, statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T09:00:00` })

const em = (casos, opts = {}) =>
  estadoUrgencias(casos, {
    hospital: 'hro',
    agoraMin: 11 * 60,
    dataEscala: HOJE,
    hojeIso: HOJE,
    turno: 'matutino',
    ...opts,
  })

describe('papelDaSalaHro — grafia dupla é dado real de produção', () => {
  it('classifica sala 5 e sala 7 nas DUAS grafias que existem no banco', () => {
    // Produção 18/08: "Sala 5 - Emergência" (23 casos) E "Sala 5" (3);
    // "Sala 7 - CO" (15) E "Sala 7" (1). Comparar string crua erraria 4 casos reais.
    expect(papelDaSalaHro('Sala 5 - Emergência')).toBe('geral')
    expect(papelDaSalaHro('Sala 5')).toBe('geral')
    expect(papelDaSalaHro('Sala 7 - CO')).toBe('co')
    expect(papelDaSalaHro('Sala 7')).toBe('co')
    expect(papelDaSalaHro('C.O')).toBe('co')
  })

  it('sala 4 é a ortopedia; sala numérica comum é geral', () => {
    expect(papelDaSalaHro('Sala 4')).toBe('orto')
    expect(papelDaSalaHro('SALA 4')).toBe('orto')
    expect(papelDaSalaHro('Sala 6')).toBe('geral')
    expect(papelDaSalaHro('Bloco A - Sala 2')).toBe('geral')
  })

  // O rótulo curto é o da TELA (dono 21/08); o papel da sala é conhecimento do
  // app. Se as grafias longas que as escalas publicadas gravaram não contarem
  // como a MESMA sala, a ortopedia perde o card dedicado e a urgência dela passa
  // a pesar no plantonista — o contador diria "acima do contrato" sem ninguém a
  // mais na casa.
  it('bloco e sufixo no rótulo não mudam o papel da sala', () => {
    expect(papelDaSalaHro('Bloco A - Sala 4')).toBe('orto')
    expect(papelDaSalaHro('Bloco A - Sala 7 - CO')).toBe('co')
    expect(papelDaSalaHro('Bloco M - Sala 4')).toBe('geral') // outro bloco, outra sala
  })

  it('sala marcada no dia casa com o caso na outra grafia', () => {
    // secretária marca "Sala 3" no ⚙; a escala do dia gravou "Bloco A - Sala 3"
    const salas = { orto: 'Sala 3', co: null, plantao: null, sobreaviso: null }
    expect(papelDaSalaHro('Bloco A - Sala 3', salas)).toBe('orto')
    expect(papelDaSalaHro('Sala 4', salas)).toBe('geral')
  })

  it('tira da conta o que o contrato exclui e os hospitais dentro da escala do HRO', () => {
    expect(papelDaSalaHro('Exames')).toBe('fora') // endoscopia/colono fora do CC cai aqui
    expect(papelDaSalaHro('Hemodinâmica')).toBe('fora')
    expect(papelDaSalaHro('IOSC')).toBe('fora')
    expect(papelDaSalaHro('Hospital de Olhos')).toBe('fora')
    expect(papelDaSalaHro('Digimax')).toBe('fora')
    expect(papelDaSalaHro('Centro de Coluna')).toBe('fora')
  })
})

describe('exclusão é pela SALA, nunca pelo procedimento', () => {
  it('a MESMA colonoscopia conta no centro cirúrgico e não conta em Exames', () => {
    // O contrato exclui endoscopia/colonoscopia "exceto as realizadas no centro
    // cirúrgico": o procedimento é idêntico nos dois casos e não carrega o local.
    const proc = 'COLONOSCOPIA'
    const estado = em([
      caso('Sala 3', { id: 'no-cc', procedimento: proc }),
      caso('Exames', { id: 'fora-cc', procedimento: proc }),
    ])
    expect(estado.ocupacoes.map((o) => o.id)).toEqual(['no-cc']) // entrou numa vaga livre
    expect(estado.foraDaConta.map((f) => f.id)).toEqual(['fora-cc'])
    expect(estado.foraDaConta[0].motivo).toBe('exames')
  })

  it('não confunde procedimento que só CONTÉM "scopia" com exclusão', () => {
    const estado = em([caso('Sala 2', { procedimento: 'COLECISTECTOMIA VIDEOLAPAROSCOPICA' })])
    expect(estado.ocupadas).toBe(1)
    expect(estado.foraDaConta).toHaveLength(0)
  })
})

describe('contrato POR TURNO — o CO é a decisão que vira código', () => {
  it('de manhã o CO é absorvido pelo dedicado e NÃO ocupa a fila', () => {
    const estado = em([caso('Sala 7 - CO'), caso('Sala 4')], { turno: 'matutino' })
    expect(estado.fila).toHaveLength(0)
    expect(estado.dedicados.map((d) => d.papel).sort()).toEqual(['co', 'orto'])
  })

  it('à TARDE o CO OCUPA uma das 2 vagas — sem depender de "iniciada"', () => {
    // Caso real do dono (20/08): Gabriel no CO à tarde com cesáreas o dia todo, e a
    // faixa dizia "0 de 2 salas" com o card do plantão em branco, porque só urgência
    // JÁ INICIADA contava. À tarde não há CO no contrato: quem está ali É uma das 2 vagas.
    const estado = em(
      [caso('Sala 7 - CO', { id: 'co', turno: 'vespertino' }), caso('Sala 4', { id: 'orto', turno: 'vespertino' })],
      { turno: 'vespertino', agoraMin: 15 * 60 },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.postos[0]).toMatchObject({ papel: 'plantonista', item: { sala: 'Sala 7 - CO' } })
    expect(estado.ocupacoes[0].motivo).toBe('sem_dedicado')
    expect(estado.fila).toHaveLength(0) // o trabalho da estação não é fila
    expect(estado.dedicados.map((d) => d.papel)).toEqual(['orto']) // só a ortopedia
  })

  it('à NOITE nem CO nem ortopedia são dedicados; o CO conta o que ENTRA na noite', () => {
    // Dono 20/08: "à tarde e à noite não há sala exclusiva para CO, então SE
    // ENTRAR será considerada como urgência/emergência". O corte é a chegada:
    // cesárea que chega 20h ocupa a vaga; o que sobrou da tarde, não.
    // fixtures ELETIVAS: urgência ocupa vaga por si (regra do encaixe), então é
    // com eletiva que se enxerga a regra da ESTAÇÃO.
    const daTarde = em(
      [caso('Sala 7 - CO', { tipo: 'eletiva', turno: 'vespertino', created_at: `${HOJE}T16:00:00` }),
       caso('Sala 4', { tipo: 'eletiva', turno: 'vespertino', created_at: `${HOJE}T16:00:00` })],
      { turno: 'vespertino', agoraMin: 20 * 60 },
    )
    expect(daTarde.turnoContrato).toBe('noite')
    expect(daTarde.dedicados).toHaveLength(0)
    expect(daTarde.ocupadas).toBe(0)

    const entrouNaNoite = em(
      [caso('Sala 7 - CO', { id: 'cesarea-noite', tipo: 'eletiva', turno: 'vespertino', created_at: `${HOJE}T19:40:00` })],
      { turno: 'vespertino', agoraMin: 20 * 60 },
    )
    expect(entrouNaNoite.ocupadas).toBe(1)
    expect(entrouNaNoite.postos[0].item.sala).toBe('Sala 7 - CO')
  })

  it('em produção 20/08 a Sala 4 fechou a tarde com 3 casos sem "terminada"', () => {
    // Por isso a estação da noite exige chegada NA noite: sem o corte, a sobra da
    // tarde marcaria sala ocupada e o alarme de "acima do contrato" nasceria mentindo.
    const sobra = em(
      [caso('Sala 4', { tipo: 'eletiva', turno: 'vespertino', created_at: `${HOJE}T14:00:00` })],
      { turno: 'vespertino', agoraMin: 21 * 60 },
    )
    expect(sobra.ocupadas).toBe(0)
  })

  it('estação só ocupa com cirurgia ABERTA do turno — sobra da manhã não segura a vaga', () => {
    // A metade dos casos nunca recebe "terminada" (36% em produção). Se o resto da
    // manhã segurasse a vaga da tarde, a tela mentiria a favor da saturação.
    const estado = em([caso('Sala 7 - CO', { tipo: 'eletiva', turno: 'matutino' })], { turno: 'vespertino', agoraMin: 15 * 60 })
    expect(estado.ocupadas).toBe(0)
    expect(CONTRATO_HRO.tarde.estacoes).toEqual(['co'])
    expect(CONTRATO_HRO.noite.estacoes).toEqual(['co'])
  })

  it('a capacidade é o tamanho da lista de papéis, nunca o literal 2', () => {
    expect(CONTRATO_HRO.manha.urgencia).toEqual(['plantonista', 'sobreaviso'])
    expect(em([caso('Sala 2')]).capacidade).toBe(CONTRATO_HRO.manha.urgencia.length)
  })
})

describe('turnoContratual — a capacidade vem do relógio, não do campo turno', () => {
  it('às 21h de uma quarta o caso é vespertino no banco, mas o contrato é o da noite', () => {
    // `escala_cirurgica_caso.turno` só aceita matutino|vespertino.
    expect(turnoContratual({ turno: 'vespertino', agoraMin: 21 * 60, dataEscala: HOJE, hojeIso: HOJE })).toBe('noite')
  })

  it('outra data nunca vira noite (herdado de faseLiberacoes)', () => {
    expect(turnoContratual({ turno: 'vespertino', agoraMin: 21 * 60, dataEscala: '2026-08-10', hojeIso: HOJE })).toBe('tarde')
  })
})

describe('ocupação e níveis de saturação', () => {
  const iniciada = (sala, extra = {}) => caso(sala, { statusCirurgia: 'iniciada', ...extra })

  it('a urgência ocupa vaga LIVRE mesmo antes de começar; sem vaga, iniciada vira Extra', () => {
    // Regra do dono 20/08: "que se enquadre numa das salas de plantão livre e, se
    // não tiver nenhuma sala livre, que entre na fila; ou, se foi iniciada, que
    // entre como sala extra". Quem assumiu a urgência já é um dos dois do contrato.
    expect(em([caso('Sala 2')]).nivel).toBe('parcial')
    expect(em([iniciada('Sala 2')]).nivel).toBe('parcial')
    expect(em([iniciada('Sala 2'), caso('Sala 3')]).nivel).toBe('cheio')

    // 3 iniciadas: as 2 mais antigas ficam nas vagas, a última é EXTRA
    const acima = em([iniciada('Sala 2'), iniciada('Sala 3'), iniciada('Sala 6')])
    expect(acima.nivel).toBe('acima')
    expect(acima.ocupadas).toBe(3)
    expect(acima.extras).toHaveLength(1)
    expect(acima.livres).toBe(0)

    // 3 agendadas: 2 nas vagas e a 3ª na FILA — nunca "extra", que é o que o
    // hospital não paga e só existe quando alguém JÁ está operando.
    const espera = em([caso('Sala 2'), caso('Sala 3'), caso('Sala 6')])
    expect(espera.nivel).toBe('cheio')
    expect(espera.extras).toHaveLength(0)
    expect(espera.fila).toHaveLength(1)
  })

  it('terminada e suspensa saem de tudo', () => {
    const estado = em([
      iniciada('Sala 2', { id: 'viva' }),
      caso('Sala 3', { id: 'fim', statusCirurgia: 'terminada' }),
      caso('Sala 6', { id: 'susp', statusExtra: 'suspensa' }),
    ])
    expect(estado.emAndamento.map((e) => e.id)).toEqual(['viva'])
    expect(estado.fila).toHaveLength(0)
  })

  it('urgência da MANHÃ ainda correndo às 14h ocupa o plantonista da tarde', () => {
    // Por isso a lib recebe o dia inteiro e não filtrarPorTurno: filtrar por turno
    // esconderia a sala justamente quando ela pesa.
    const estado = em(
      [iniciada('Sala 2', { turno: 'matutino', statusAtualizadoEm: `${HOJE}T12:50:00` })],
      { turno: 'vespertino', agoraMin: 14 * 60 },
    )
    expect(estado.turnoContrato).toBe('tarde')
    expect(estado.ocupadas).toBe(1)
  })

  it('iniciada há mais de 4h sai da ocupação e vira pergunta, sem sumir da tela', () => {
    // Produção 18/08: 13 urgências ficaram "iniciada" em dias passados sem término.
    const estado = em([iniciada('Sala 2', { id: 'orfa', statusAtualizadoEm: `${HOJE}T05:00:00` })], { agoraMin: 11 * 60 })
    expect(11 * 60 - 5 * 60).toBeGreaterThan(LIMITE_ESQUECIDA_MIN)
    expect(estado.ocupadas).toBe(0)
    expect(estado.aConfirmar.map((a) => a.id)).toEqual(['orfa'])
    expect(estado.ativo).toBe(true)
  })

  it('o relógio da ocupação começa na MARCAÇÃO, não na chegada do caso', () => {
    // Defeito pego no próprio desenho: um caso registrado às 07:00 e iniciado às
    // 10:30 pareceria estar em andamento há 4h às 11:00 e cairia em `aConfirmar`
    // sem nunca ter sido esquecido.
    const estado = em(
      [iniciada('Sala 2', { id: 'cedo-registrada', created_at: `${HOJE}T07:00:00`, statusAtualizadoEm: `${HOJE}T10:30:00` })],
      { agoraMin: 11 * 60 },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.aConfirmar).toHaveLength(0)
    expect(estado.emAndamento[0].desdeMin).toBe(30)
  })

  it('não conta nada fora do HRO — o contrato é de um hospital só', () => {
    const estado = em([iniciada('Sala 2')], { hospital: 'unimed' })
    expect(estado.ativo).toBe(false)
    expect(estado.emAndamento).toHaveLength(0)
  })

  it('escala publicada mantém a faixa ATIVA mesmo sem urgência — é onde se configura o dia', () => {
    // Regra mudada pelo dono em 19/08 ("no HRO não apareceu"): a faixa também é
    // o painel de configuração das salas do contrato, e a configuração acontece
    // de manhã, antes da primeira urgência. Sem caso NENHUM no dia, some.
    expect(em([caso('Sala 2', { tipo: 'eletiva' })]).ativo).toBe(true)
    expect(em([]).ativo).toBe(false)
  })
})

describe('fila — gravidade primeiro, chegada como desempate', () => {
  it('ordena por gravidade e deixa a não classificada no fim', () => {
    const estado = em([
      caso('Sala 1', { id: 'aguarda', gravidade: 'aguarda', created_at: `${HOJE}T07:00:00` }),
      caso('Sala 2', { id: 'sem', created_at: `${HOJE}T07:10:00` }),
      caso('Sala 3', { id: 'imediata', gravidade: 'imediata', created_at: `${HOJE}T10:30:00` }),
      caso('Sala 6', { id: 'urgente', gravidade: 'urgente', created_at: `${HOJE}T09:00:00` }),
    ])
    // as 2 vagas ficam com as mais graves; a fila é o que sobra, na mesma ordem
    expect(estado.postos.map((p) => p.item?.id)).toEqual(['imediata', 'urgente'])
    expect(estado.fila.map((f) => f.id)).toEqual(['aguarda', 'sem'])
    expect(estado.fila[0].posicao).toBe(1)
    expect(estado.proxima.id).toBe('aguarda')
    expect(GRAVIDADE_ORDEM.imediata).toBeLessThan(GRAVIDADE_ORDEM.urgente)
  })

  it('mesma gravidade desempata por chegada', () => {
    const estado = em([
      caso('Sala 2', { id: 'tarde', gravidade: 'urgente', created_at: `${HOJE}T10:40:00` }),
      caso('Sala 3', { id: 'cedo', gravidade: 'urgente', created_at: `${HOJE}T08:15:00` }),
      caso('Sala 6', { id: 'meio', gravidade: 'urgente', created_at: `${HOJE}T09:30:00` }),
    ])
    // as duas vagas vão para as que chegaram antes; a última espera
    expect(estado.postos.map((p) => p.item?.id)).toEqual(['cedo', 'meio'])
    expect(estado.fila.map((f) => f.id)).toEqual(['tarde'])
  })

  it('urgência SEM hora entra na fila normalmente e a espera vem do created_at', () => {
    // Produção 18/08: 9 de 9 urgências do HRO estavam sem `hora` — a fila NUNCA
    // pode ordenar por hora.
    const estado = em([
      caso('Sala 1', { id: 'v1', created_at: `${HOJE}T07:00:00` }),
      caso('Sala 2', { id: 'v2', created_at: `${HOJE}T07:00:00` }),
      caso('Sala 6', { id: 'espera', hora: null, created_at: `${HOJE}T09:30:00` }),
    ], { agoraMin: 11 * 60 })
    expect(estado.fila.map((f) => f.id)).toEqual(['espera'])
    expect(estado.fila[0].esperaMin).toBe(90)
    expect(estado.esperaMaxMin).toBe(90)
  })

  it('lê o carimbo em snake_case, que é como ele chega do service', () => {
    // fetchEscala usa select('*') e created_at não está no CAMEL_TO_SNAKE: ler só
    // `createdAt` daria undefined e a fila ordenaria por NaN, em silêncio.
    expect(chegadaDaUrgencia({ created_at: `${HOJE}T08:00:00` }, { dataEscala: HOJE })).toBe(480)
    expect(chegadaDaUrgencia({ createdAt: `${HOJE}T08:00:00` }, { dataEscala: HOJE })).toBe(480)
    expect(chegadaDaUrgencia({ created_at: '2026-08-17T08:00:00' }, { dataEscala: HOJE })).toBeNull()
  })

  it('o início vem em camelCase, porque statusAtualizadoEm ESTÁ no CAMEL_TO_SNAKE', () => {
    expect(inicioDaUrgencia({ statusAtualizadoEm: `${HOJE}T10:30:00` }, { dataEscala: HOJE })).toBe(630)
    expect(inicioDaUrgencia({ status_atualizado_em: `${HOJE}T10:30:00` }, { dataEscala: HOJE })).toBe(630)
  })
})

describe('sinais de qualidade do dado', () => {
  it('marca como suspeita a urgência cuja hora passou e ninguém iniciou', () => {
    // Produção 18/08: 36% das urgências do HRO ficaram em `agendada`. O contador só
    // é verdadeiro se marcarem — então o esquecimento precisa ficar visível.
    const estado = em([caso('Sala 2', { hora: '10:00', anestesista: 'FULANO' })], { agoraMin: 11 * 60 })
    expect(estado.suspeitas).toHaveLength(1)
    expect(estado.suspeitas[0].atrasoMin).toBe(60)
  })

  it('marca sala digitada à mão sem tirá-la da conta', () => {
    const estado = em([caso('Sala Hibrida X')])
    expect(estado.ocupacoes[0].salaDesconhecida).toBe(true)
    expect(em([caso('Sala 6')]).ocupacoes[0].salaDesconhecida).toBe(false)
  })
})

describe('drift lib ↔ SQL do relatório', () => {
  it('a lista de exclusão é a mesma que o SQL da skill usa', () => {
    // A skill /escala-cirurgica (modo contrato-hro) repete esta lista em SQL. Se uma
    // mudar sem a outra, o número da tela e o número do relatório divergem.
    expect(Object.keys(SALAS_FORA_DO_CONTRATO_HRO).sort()).toEqual(
      [
        'AMBULATORIAL',
        'BRAQUITERAPIA',
        'CENTRO DE COLUNA',
        'CONSULTORIO',
        'DIGIMAX',
        'EXAMES',
        'HEMODINAMICA',
        'HO',
        'HOSPITAL DE OLHOS',
        'IMAGEM',
        'IOSC',
        'MATERNO',
      ].sort(),
    )
  })
})

/**
 * SALAS CONFIGURÁVEIS por dia/turno (dono 18/08, 2ª decisão): "as salas do CO e
 * ortopedia podem mudar". `urgencias_meta` no cabeçalho marca onde cada papel
 * está; ausente = automático. A marcação muda a ATRIBUIÇÃO, nunca a contagem.
 */
import { distribuirPostos, salasContrato } from '@/lib/escalaCirurgicaUrgencias'

describe('salasContrato — config por turno sobre o default', () => {
  it('sem meta, tudo automático; meta parcial só mexe no papel marcado', () => {
    expect(salasContrato(null, 'matutino')).toEqual({ orto: null, co: null, plantao: null, sobreaviso: null })
    const meta = { matutino: { orto: 'Sala 3' } }
    expect(salasContrato(meta, 'matutino').orto).toBe('Sala 3')
    expect(salasContrato(meta, 'matutino').co).toBeNull()
    // turnos independentes: a config da manhã não vaza para a tarde
    expect(salasContrato(meta, 'vespertino').orto).toBeNull()
  })
})

describe('papelDaSalaHro com salas marcadas — a config vence o "normalmente"', () => {
  it('ortopedia marcada na Sala 3: a Sala 3 vira orto e a Sala 4 volta a ser comum', () => {
    const salas = { orto: 'Sala 3', co: null, plantao: null, sobreaviso: null }
    expect(papelDaSalaHro('Sala 3', salas)).toBe('orto')
    expect(papelDaSalaHro('Sala 4', salas)).toBe('geral')
    // o CO não foi marcado → segue no default
    expect(papelDaSalaHro('Sala 7 - CO', salas)).toBe('co')
  })

  it('exclusões continuam valendo mesmo com config', () => {
    const salas = { orto: 'Sala 3', co: 'Sala 9', plantao: null, sobreaviso: null }
    expect(papelDaSalaHro('Exames', salas)).toBe('fora')
    expect(papelDaSalaHro('Sala 9', salas)).toBe('co')
    expect(papelDaSalaHro('Sala 7 - CO', salas)).toBe('geral') // os dois marcados: default desligado
  })

  it('config muda a atribuição na conta: urgência da Sala 4 pesa no plantonista quando a orto está na 3', () => {
    const estado = em(
      [caso('Sala 4', { id: 'u4' }), caso('Sala 3', { id: 'u3' })],
      { salas: { orto: 'Sala 3', co: null, plantao: null, sobreaviso: null } },
    )
    expect(estado.postos[0].item.id).toBe('u4') // Sala 4 virou comum e pegou a vaga
    // `dedicados` traz um card por papel dedicado do turno (o do CO fica vazio):
    // o card informa quem cobre mesmo sem urgência, e é por ele que se adiciona uma.
    expect(estado.dedicados.find((d) => d.papel === 'orto').id).toBe('u3')
    expect(estado.dedicados.find((d) => d.papel === 'co').item).toBeNull()
  })
})

describe('distribuirPostos — sala marcada casa primeiro, o resto por ordem de início', () => {
  const item = (id, sala, desdeMin) => ({ id, sala, desdeMin, caso: { id } })

  it('sem marcação: mais antiga é o plantão, seguinte o sobreaviso, resto extra', () => {
    const { postos, extras } = distribuirPostos(
      [item('b', 'Sala 2', 15), item('a', 'Sala 6', 40), item('c', 'Sala 3', 5)],
      ['plantonista', 'sobreaviso'],
    )
    expect(postos.map((p) => p.item?.id)).toEqual(['a', 'b'])
    expect(extras.map((e) => e.id)).toEqual(['c'])
  })

  it('plantão marcado "Sala 2": a urgência da Sala 2 é dele mesmo tendo começado depois', () => {
    const { postos } = distribuirPostos(
      [item('a', 'Sala 6', 40), item('b', 'Sala 2', 15)],
      ['plantonista', 'sobreaviso'],
      { plantao: 'Sala 2', sobreaviso: null },
    )
    expect(postos[0]).toMatchObject({ papel: 'plantonista', item: { id: 'b' } })
    expect(postos[1]).toMatchObject({ papel: 'sobreaviso', item: { id: 'a' } })
  })

  it('a marcação NUNCA muda a contagem — 3 em andamento seguem sendo "acima"', () => {
    const estado = em(
      [
        caso('Sala 6', { id: 'c1', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T09:00:00` }),
        caso('Sala 2', { id: 'c2', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:00:00` }),
        caso('Sala 3', { id: 'c3', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:30:00` }),
      ],
      { salas: { orto: null, co: null, plantao: 'Sala 3', sobreaviso: 'Sala 2' } },
    )
    expect(estado.nivel).toBe('acima')
    expect(estado.postos.map((p) => p.item?.id)).toEqual(['c3', 'c2']) // marcados casaram
    expect(estado.extras.map((e) => e.id)).toEqual(['c1']) // o não marcado virou extra
  })
})

/**
 * OCUPAÇÃO POR SALA + ESTAÇÃO (dono 20/08, três queixas do mesmo dia no HRO):
 *  1. "adicionei cesarianas como urgência e o card continua em branco";
 *  2. "ao ler a escala vespertina, o CO não foi identificado como sala de
 *     urgência — no vespertino ele entra como urgência, não como sala exclusiva";
 *  3. "Gabriel ficou com 2 cards de CO; que fique um único card com várias
 *     cirurgias obstétricas (dia todo) e entre na sala de plantão para a contagem".
 */
describe('a unidade da conta é a SALA, não a cirurgia', () => {
  it('CO com duas cirurgias abertas é UM card, UMA vaga, com a contagem no card', () => {
    // Reprodução literal da tarde de 20/08: "DIA TODO" (eletiva) + "Cesarianas"
    // (urgência) na mesma Sala 7 - CO, mesmo anestesista.
    const estado = em(
      [
        caso('Sala 7 - CO', { id: 'dia-todo', tipo: 'eletiva', hora: '13:00', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' }),
        caso('Sala 7 - CO', { id: 'cesarianas', gravidade: 'urgente', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' }),
      ],
      { turno: 'vespertino', agoraMin: 14 * 60 },
    )
    expect(estado.ocupacoes).toHaveLength(1)
    expect(estado.ocupacoes[0]).toMatchObject({ sala: 'Sala 7 - CO', qtd: 2, urgencias: 1 })
    expect(estado.ocupacoes[0].anestesista).toEqual({ uid: 'u-gabriel', alias: 'GABRIEL' })
    expect(estado.ocupadas).toBe(1)
    expect(estado.fila).toHaveLength(0) // a cesárea seguinte é trabalho DESTA sala
  })

  it('duas urgências em andamento na MESMA sala não estouram o contrato', () => {
    // Antes contava por caso: a mesma pessoa aparecia 2× e a tela dizia "cheio".
    const estado = em([
      caso('Sala 6', { id: 'a', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:30:00` }),
      caso('Sala 6', { id: 'b', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:50:00` }),
    ])
    expect(estado.ocupadas).toBe(1)
    expect(estado.nivel).toBe('parcial')
  })

  it('cirurgia ELETIVA em sala comum nunca ocupa vaga de urgência', () => {
    const estado = em([caso('Sala 2', { tipo: 'eletiva', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:30:00` })])
    expect(estado.ocupadas).toBe(0)
  })
})

describe('marcar a sala é o que a faz entrar na contagem (dono 20/08)', () => {
  const salasCom = (extra) => ({ orto: null, co: null, plantao: null, sobreaviso: null, ...extra })

  it('sala marcada como plantão com cirurgia aberta ocupa a vaga, mesmo sem urgência', () => {
    const estado = em(
      [caso('Sala 6', { id: 'e1', tipo: 'eletiva' })],
      { salas: salasCom({ plantao: 'Sala 6' }) },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.ocupacoes[0].motivo).toBe('marcada')
    expect(estado.postos[0]).toMatchObject({ papel: 'plantonista', item: { sala: 'Sala 6' } })
  })

  it('sala marcada SEM cirurgia aberta não gasta vaga — marcar não é reservar', () => {
    const estado = em([caso('Sala 2', { tipo: 'eletiva' })], { salas: salasCom({ sobreaviso: 'Sala 9' }) })
    expect(estado.ocupadas).toBe(0)
  })

  it('marcar o plantão na sala do CO vence a absorção do dedicado, inclusive de manhã', () => {
    // "as salas de urgência não foram identificadas" → marcar é a saída, e ela
    // precisa valer também quando a sala TEM dedicado no papel (manhã).
    const estado = em(
      [caso('Sala 7 - CO', { id: 'co', tipo: 'eletiva' })],
      { turno: 'matutino', salas: salasCom({ plantao: 'Sala 7 - CO' }) },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.postos[0]).toMatchObject({ papel: 'plantonista', item: { sala: 'Sala 7 - CO' } })
    // e o card de dedicado do CO some — no dia, quem cobre o CO é o plantão
    expect(estado.dedicados.map((d) => d.papel)).toEqual(['orto'])
  })
})

describe('salas de OUTRO hospital dentro da escala do HRO', () => {
  it('"Materno" e as grafias soltas de ambulatorial ficam fora do contrato', () => {
    // Varredura de produção 20/08: "MATERNO" (5), "AMBULAT." (1),
    // "Ambulatorial BERA" (1) e "Odonto ambulatorial" (1) caíam em 'geral' — uma
    // urgência ali entraria na conta de 2 salas do HRO.
    expect(papelDaSalaHro('Materno')).toBe('fora')
    expect(papelDaSalaHro('MATERNO')).toBe('fora')
    expect(papelDaSalaHro('AMBULAT.')).toBe('fora')
    expect(papelDaSalaHro('Ambulatorial BERA')).toBe('fora')
    expect(papelDaSalaHro('Odonto ambulatorial')).toBe('fora')
    expect(papelDaSalaHro('Sala 6')).toBe('geral') // sem alargar demais
  })
})

describe('uma pessoa, uma vaga', () => {
  it('duas cirurgias do MESMO anestesista são UMA ocupação, com a contagem no card', () => {
    // A vaga é gasta pela cirurgia (dono 20/08), mas ninguém opera dois pacientes
    // ao mesmo tempo: o CO com cesáreas o dia todo é um card só, uma vaga só.
    const estado = em(
      [
        caso('Sala 7 - CO', { id: 'a', tipo: 'eletiva', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gab' }),
        caso('Sala 7 - CO', { id: 'b', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gab' }),
      ],
      { turno: 'vespertino', agoraMin: 15 * 60 },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.ocupacoes[0].qtd).toBe(2)
    expect(estado.fila).toHaveLength(0)
  })

  it('salas comuns diferentes continuam sendo duas ocupações', () => {
    const estado = em([
      caso('Sala 6', { id: 'a', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:30:00` }),
      caso('Sala 2', { id: 'b', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:40:00` }),
    ])
    expect(estado.ocupadas).toBe(2)
  })
})

/**
 * ENCAIXE DA URGÊNCIA (dono 20/08): "quero que seja possível informar que é uma
 * urgência e que se enquadre numa das salas de plantão livre; se não tiver
 * nenhuma sala livre, que entre na fila; ou, se foi iniciada, que entre como
 * sala extra". É o caminho da cirurgia que a importação não leu como urgência e
 * é reclassificada no detalhe do caso.
 */
describe('reclassificar uma cirurgia como urgência', () => {
  const eletiva = (sala, extra = {}) => caso(sala, { tipo: 'eletiva', ...extra })

  it('eletiva não conta; virando urgência, entra na vaga livre do plantão', () => {
    const antes = em([eletiva('Sala 1', { id: 'c1' })])
    expect(antes.ocupadas).toBe(0)

    const depois = em([caso('Sala 1', { id: 'c1' })]) // mesma cirurgia, agora urgência
    expect(depois.postos[0]).toMatchObject({ papel: 'plantonista', item: { id: 'c1' } })
    expect(depois.livres).toBe(1)
  })

  it('sem vaga livre, a urgência agendada vai para a FILA', () => {
    const estado = em([
      iniciada2('Sala 2', 'v1'), iniciada2('Sala 3', 'v2'),
      caso('Sala 1', { id: 'nova', gravidade: 'urgente' }),
    ])
    expect(estado.postos.map((p) => p.item?.id)).toEqual(['v1', 'v2'])
    expect(estado.fila.map((f) => f.id)).toEqual(['nova'])
    expect(estado.extras).toHaveLength(0)
    expect(estado.nivel).toBe('cheio')
  })

  it('sem vaga livre, a urgência JÁ INICIADA vira Extra e o nível vai a "acima"', () => {
    const estado = em([
      iniciada2('Sala 2', 'v1'), iniciada2('Sala 3', 'v2'),
      caso('Sala 1', { id: 'nova', statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:55:00` }),
    ])
    expect(estado.extras.map((e) => e.id)).toEqual(['nova'])
    expect(estado.nivel).toBe('acima')
    expect(estado.ocupadas).toBe(3)
  })
})

describe('estação: o que está EM ANDAMENTO é fato, não sobra de turno', () => {
  it('cesárea que COMEÇOU conta no CO às 20h, mesmo tendo entrado à tarde', () => {
    const estado = em(
      [caso('Sala 7 - CO', {
        id: 'cesarea', tipo: 'eletiva', turno: 'vespertino',
        created_at: `${HOJE}T16:00:00`, statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T19:30:00`,
      })],
      { turno: 'vespertino', agoraMin: 20 * 60 },
    )
    expect(estado.ocupadas).toBe(1)
    expect(estado.postos[0].item.id).toBe('cesarea')
  })

  it('a mesma cirurgia esquecida (>4h iniciada) sai da conta e vira PERGUNTA', () => {
    // Sem isto ela sumia da tela: a pergunta "ainda em andamento?" só existia para
    // o tipo urgência, e o "DIA TODO" do CO é eletiva no banco.
    const estado = em(
      [caso('Sala 7 - CO', {
        id: 'dia-todo', tipo: 'eletiva', turno: 'vespertino',
        created_at: `${HOJE}T16:00:00`, statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T14:00:00`,
      })],
      { turno: 'vespertino', agoraMin: 20 * 60 },
    )
    expect(estado.ocupadas).toBe(0)
    expect(estado.aConfirmar.map((a) => a.id)).toEqual(['dia-todo'])
  })
})
