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
    expect(estado.fila.map((f) => f.id)).toEqual(['no-cc'])
    expect(estado.foraDaConta.map((f) => f.id)).toEqual(['fora-cc'])
    expect(estado.foraDaConta[0].motivo).toBe('exames')
  })

  it('não confunde procedimento que só CONTÉM "scopia" com exclusão', () => {
    const estado = em([caso('Sala 2', { procedimento: 'COLECISTECTOMIA VIDEOLAPAROSCOPICA' })])
    expect(estado.fila).toHaveLength(1)
    expect(estado.foraDaConta).toHaveLength(0)
  })
})

describe('contrato POR TURNO — o CO é a decisão que vira código', () => {
  it('de manhã o CO é absorvido pelo dedicado e NÃO ocupa a fila', () => {
    const estado = em([caso('Sala 7 - CO'), caso('Sala 4')], { turno: 'matutino' })
    expect(estado.fila).toHaveLength(0)
    expect(estado.dedicadas.map((d) => d.papel).sort()).toEqual(['co', 'orto'])
  })

  it('à TARDE não há CO no contrato: a urgência de CO volta a pesar no plantonista', () => {
    const estado = em([caso('Sala 7 - CO'), caso('Sala 4')], { turno: 'vespertino', agoraMin: 15 * 60 })
    expect(estado.fila.map((f) => f.papel)).toEqual(['geral']) // o CO entrou na fila
    expect(estado.dedicadas.map((d) => d.papel)).toEqual(['orto']) // só a ortopedia
  })

  it('à NOITE nem CO nem ortopedia são dedicados', () => {
    const estado = em([caso('Sala 7 - CO'), caso('Sala 4')], { turno: 'vespertino', agoraMin: 20 * 60 })
    expect(estado.turnoContrato).toBe('noite')
    expect(estado.dedicadas).toHaveLength(0)
    expect(estado.fila).toHaveLength(2)
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

  it('conta só as INICIADAS como ocupação e devolve os níveis na ordem certa', () => {
    expect(em([caso('Sala 2')]).nivel).toBe('livre') // nada iniciado ainda
    expect(em([iniciada('Sala 2')]).nivel).toBe('parcial')
    expect(em([iniciada('Sala 2'), iniciada('Sala 3')]).nivel).toBe('cheio')

    const acima = em([iniciada('Sala 2'), iniciada('Sala 3'), iniciada('Sala 6')])
    expect(acima.nivel).toBe('acima')
    expect(acima.ocupadas).toBe(3)
    expect(acima.livres).toBe(0)
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

  it('some da tela quando não há urgência nenhuma (dia igual ao de hoje)', () => {
    expect(em([caso('Sala 2', { tipo: 'eletiva' })]).ativo).toBe(false)
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
    expect(estado.fila.map((f) => f.id)).toEqual(['imediata', 'urgente', 'aguarda', 'sem'])
    expect(estado.fila[0].posicao).toBe(1)
    expect(estado.proxima.id).toBe('imediata')
    expect(GRAVIDADE_ORDEM.imediata).toBeLessThan(GRAVIDADE_ORDEM.urgente)
  })

  it('mesma gravidade desempata por chegada', () => {
    const estado = em([
      caso('Sala 2', { id: 'tarde', gravidade: 'urgente', created_at: `${HOJE}T10:40:00` }),
      caso('Sala 3', { id: 'cedo', gravidade: 'urgente', created_at: `${HOJE}T08:15:00` }),
    ])
    expect(estado.fila.map((f) => f.id)).toEqual(['cedo', 'tarde'])
  })

  it('urgência SEM hora entra na fila normalmente e a espera vem do created_at', () => {
    // Produção 18/08: 9 de 9 urgências do HRO estavam sem `hora` — a fila NUNCA
    // pode ordenar por hora.
    const estado = em([caso('Sala 6', { hora: null, created_at: `${HOJE}T09:30:00` })], { agoraMin: 11 * 60 })
    expect(estado.fila).toHaveLength(1)
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
    expect(estado.fila).toHaveLength(1)
    expect(estado.fila[0].salaDesconhecida).toBe(true)
    expect(em([caso('Sala 6')]).fila[0].salaDesconhecida).toBe(false)
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
      ].sort(),
    )
  })
})
