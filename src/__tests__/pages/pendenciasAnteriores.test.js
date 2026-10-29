/**
 * PENDÊNCIAS DE DIAS ANTERIORES guardadas e buscadas na abertura do app (dono 28/10/2026:
 * "a abertura deve ser otimizada para não haver delays" — proposta aceita: "buscar a lista de
 * dias anteriores já na abertura do app e guardá-la no aparelho").
 *
 * Travas:
 *  · o aparelho NÃO guarda paciente (iniciais, idade, nome) — só o que a regra e a lista usam;
 *  · a última resposta volta do aparelho no app recém-aberto, antes de qualquer rede;
 *  · chamadas simultâneas para a mesma pessoa e dia viram UMA ida ao banco;
 *  · "pronta" = resposta desta sessão para o dia, ou a tentativa acabou sem rede;
 *  · o que a pessoa informou entra no guardado (o app reaberto não mostra de novo);
 *  · o retrato é o MESMO objeto até a lista mudar (useSyncExternalStore).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { svcMock } = vi.hoisted(() => ({ svcMock: { fetchCasosDaPessoa: vi.fn() } }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))

import {
  _zerarAnteriores, anterioresProntas, aplicarNoGuardado, assinarAnteriores, buscarAnteriores,
  lerAnteriores, retratoAnteriores, semDadoDePaciente,
} from '@/pages/escala-cirurgica/pendenciasAnteriores'

const HOJE = '2026-10-29'
const respostaDoBanco = () => [{
  id: 'e-27', data: '2026-10-27', hospital: 'hro', status: 'publicada',
  casos: [{
    id: 'c1', escalaId: 'e-27', sala: 'Sala 4', ordem: 0, hora: '07:00', turno: 'matutino',
    procedimento: 'FRATURA DE FÊMUR', cirurgiao: 'Vitor Briese', anestesista: 'ROMULO', anestesistaUserId: 'u-rom',
    statusCirurgia: 'terminada', statusAtualizadoEm: '2026-10-27T11:00:00-03:00', inicioReal: null, terminoReal: null,
    // o que NÃO pode ir para o aparelho
    pacienteIniciais: 'J.R.M.', idade: '63', pacienteNome: 'JOSE RIBEIRO', convenio: 'SUS', observacao: 'x',
  }],
}]

beforeEach(() => {
  localStorage.clear()
  _zerarAnteriores()
  svcMock.fetchCasosDaPessoa.mockReset()
})

describe('o aparelho guarda só o necessário', () => {
  it('sem iniciais, idade, nome do paciente, convênio ou observação', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValue(respostaDoBanco())
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    const bruto = localStorage.getItem('anest-escala-anteriores-v1:u-rom')
    expect(bruto).toBeTruthy()
    expect(bruto).not.toMatch(/J\.R\.M\.|JOSE RIBEIRO|pacienteIniciais|idade|convenio|observacao/)
    const caso = JSON.parse(bruto).escalas[0].casos[0]
    expect(caso).toMatchObject({ id: 'c1', sala: 'Sala 4', hora: '07:00', procedimento: 'FRATURA DE FÊMUR', anestesistaUserId: 'u-rom', statusCirurgia: 'terminada' })
  })

  it('semDadoDePaciente é a mesma peneira para qualquer resposta', () => {
    const [e] = semDadoDePaciente(respostaDoBanco())
    expect(Object.keys(e).sort()).toEqual(['casos', 'data', 'hospital', 'id', 'status'])
    expect(e.casos[0]).not.toHaveProperty('pacienteIniciais')
    expect(e.casos[0]).not.toHaveProperty('idade')
  })
})

describe('memória, aparelho e rede', () => {
  it('a resposta fica na memória e marca a lista do dia como pronta', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValue(respostaDoBanco())
    expect(anterioresProntas('u-rom', HOJE)).toBe(false)
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    expect(anterioresProntas('u-rom', HOJE)).toBe(true)
    expect(lerAnteriores('u-rom').escalas[0].casos).toHaveLength(1)
    expect(svcMock.fetchCasosDaPessoa).toHaveBeenCalledWith({ uid: 'u-rom', desde: '2026-10-27', ate: HOJE })
  })

  it('app recém-aberto: a lista volta do aparelho antes da rede (mas ainda não "pronta")', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValue(respostaDoBanco())
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    _zerarAnteriores() // "fechou o app": a memória vai embora, o aparelho fica
    const v = lerAnteriores('u-rom')
    expect(v.escalas[0].casos[0].id).toBe('c1')
    expect(v.fresca).toBe(false)
    expect(anterioresProntas('u-rom', HOJE)).toBe(false)
  })

  it('a abertura do app e a página pedindo juntas viram UMA ida ao banco', async () => {
    let resolver
    svcMock.fetchCasosDaPessoa.mockImplementation(() => new Promise((r) => { resolver = r }))
    const a = buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    const b = buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    await Promise.resolve()
    resolver(respostaDoBanco())
    await Promise.all([a, b])
    expect(svcMock.fetchCasosDaPessoa).toHaveBeenCalledTimes(1)
  })

  it('sem rede: fica o que estava guardado e a lista conta como decidida (o pop-up não espera para sempre)', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValueOnce(respostaDoBanco())
    await buscarAnteriores({ uid: 'u-rom', hoje: '2026-10-28' })
    svcMock.fetchCasosDaPessoa.mockRejectedValueOnce(new Error('offline'))
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    expect(anterioresProntas('u-rom', HOJE)).toBe(true)
    expect(lerAnteriores('u-rom').escalas).toHaveLength(1)
  })

  it('antes do corte (27/10) não há o que buscar', async () => {
    await buscarAnteriores({ uid: 'u-rom', hoje: '2026-10-27' })
    expect(svcMock.fetchCasosDaPessoa).not.toHaveBeenCalled()
    expect(anterioresProntas('u-rom', '2026-10-27')).toBe(true)
  })
})

describe('gravações e o retrato', () => {
  it('o horário informado entra no guardado, e quem assina é avisado', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValue(respostaDoBanco())
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    const aviso = vi.fn()
    const desligar = assinarAnteriores(aviso)
    aplicarNoGuardado('u-rom', 'c1', { inicioReal: '07:10', terminoReal: '08:40' })
    expect(aviso).toHaveBeenCalledWith('u-rom')
    expect(JSON.parse(localStorage.getItem('anest-escala-anteriores-v1:u-rom')).escalas[0].casos[0])
      .toMatchObject({ inicioReal: '07:10', terminoReal: '08:40' })
    desligar()
  })

  it('o retrato é o MESMO objeto até a lista mudar', async () => {
    svcMock.fetchCasosDaPessoa.mockResolvedValue(respostaDoBanco())
    const antes = retratoAnteriores('u-rom', HOJE)
    expect(retratoAnteriores('u-rom', HOJE)).toBe(antes)
    expect(antes.pronto).toBe(false)
    await buscarAnteriores({ uid: 'u-rom', hoje: HOJE })
    const depois = retratoAnteriores('u-rom', HOJE)
    expect(depois).not.toBe(antes)
    expect(depois.pronto).toBe(true)
    expect(retratoAnteriores('u-rom', HOJE)).toBe(depois)
  })
})
