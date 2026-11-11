/**
 * A LIBERAÇÃO É DA PESSOA, NÃO DA POSIÇÃO (dono 23/10/2026).
 *
 * HRO da manhã de 23/10: o Klisman assumiu a posição do Rodnei às 09:02 e foi liberado
 * nela às 10:46 — a marca mora na chave da POSIÇÃO (`matutino:<uid do Rodnei>`). Às 10:53
 * a troca Cristina ⇄ Rodnei gravou "Cristina assume" por cima: a liberação passou para a
 * Cristina e o Klisman voltou ao fim da fila como "próximo", abaixo de 5 liberados.
 *
 * Contrato: a troca executa como sempre (uma transação), e quem SAIU de uma posição já
 * liberada continua liberado na própria chave. Roda o provider de verdade, com o service
 * mockado (mesmo arranjo de escalaCirurgicaTrocaRollback.test.jsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    patchLiberacao: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
    executarTrocaAtomica: vi.fn(async ({ lados = [] }) => ({ escalas: {}, casos: [], pulados: 0, lados: lados.length })),
    desfazerTrocaAtomica: vi.fn(),
    restaurarAnestesistaCasos: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup: () => {} }) }))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const LIBERADO_EM = '2026-10-23T13:46:40.734Z'
const escalaHro = (extra = {}) => ({
  id: 'esc-hro', hospital: 'hro', status: 'publicada',
  ordemLiberacao: { matutino: ['THAYNA', 'RAQUEL', 'RODNEI', 'GARIM'] },
  ajudaExterna: {}, casos: [],
  linhaOverrides: {
    'matutino:u-rodnei': { assumidaPor: { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN', de: { uid: 'u-rodnei' }, em: '2026-10-23T12:02:07Z' } },
  },
  liberacoes: { 'matutino:u-rodnei': { liberadoEm: LIBERADO_EM, por: 'u-thayna' } },
  ...extra,
})
const LADO_HRO = {
  hospital: 'hro', escalaId: 'esc-hro', turno: 'matutino', chaveSlot: 'u-rodnei', nomeSlot: 'RODNEI',
  de: { uid: 'u-rodnei', nome: 'RODNEI CABRAL LIMA', apelido: 'RODNEI' },
  para: { uid: 'u-cristina', nome: 'CRISTINA BERTOL BARBOSA MARCON', apelido: 'CRISTINA' },
  casoIds: [], tipo: 'entre_hospitais',
}

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = async (hro, unimed = null) => {
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'hro' ? hro : hosp === 'unimed' ? unimed : null))
  render(<ThemeProvider><ToastProvider><EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider></ToastProvider></ThemeProvider>)
  await waitFor(() => expect(estado?.escalas?.hro?.id).toBe('esc-hro'))
}

beforeEach(() => vi.clearAllMocks())

describe('quem sai de uma posição já liberada continua liberado', () => {
  it('recorte de 23/10: Cristina assume a posição do Rodnei, e o Klisman continua liberado', async () => {
    await montar(escalaHro())
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })

    expect(svcMock.executarTrocaAtomica).toHaveBeenCalledTimes(1)
    expect(svcMock.patchLiberacao).toHaveBeenCalledWith('esc-hro', 'matutino:u-klisman', { liberadoEm: LIBERADO_EM, por: 'u-gabriela' })
    expect(estado.escalas.hro.liberacoes['matutino:u-klisman']).toMatchObject({ liberadoEm: LIBERADO_EM })
    // a posição segue liberada para quem chega
    expect(estado.escalas.hro.liberacoes['matutino:u-rodnei']).toMatchObject({ liberadoEm: LIBERADO_EM })
    expect(await screen.findByText(/liberação de Klisman .* mantida/)).toBeTruthy()
  })

  it('posição ocupada mas NÃO liberada: nada a manter', async () => {
    await montar(escalaHro({ liberacoes: {} }))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })

  it('posição liberada com o próprio dono nela: a liberação já é da chave dele', async () => {
    await montar(escalaHro({ linhaOverrides: {} }))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })

  it('o banco recusa (cirurgia sem horário): a troca fica feita e o aviso diz o caminho', async () => {
    await montar(escalaHro())
    svcMock.patchLiberacao.mockRejectedValueOnce(new Error('horario_pendente: 1 cirurgia(s) sem horário'))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.executarTrocaAtomica).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Klisman .* voltou à fila/)).toBeTruthy()
    expect(screen.getByText(/Há cirurgia sem horário de início\/término/)).toBeTruthy()
  })
})

/**
 * DESFAZER TAMBÉM (10/11/2026). O desfazer eram 2 a 4 escritas do navegador, com rollback
 * no cliente, e nenhuma olhava `liberacoes`: a marca gravada na vaga enquanto ela estava
 * assumida voltava para o DONO. Agora é a `rpc_escala_desfazer_troca` (uma transação), e
 * o context só pinta o que ela devolve. O SQL da RPC é travado em
 * `src/__tests__/lib/escalaDesfazerTrocaSql.test.js`; aqui, o fio do context.
 */
describe('desfazer a troca: uma transação, e a liberação segue quem saiu', () => {
  // 21/10/2026, tarde: Fernando (Unimed, 8ª) ⇄ Klisman (HRO, 14ª); o Fernando saiu às
  // 15:02 NA 14ª do HRO e a troca foi desfeita às 16:40.
  const LIB_1502 = { liberadoEm: '2026-10-21T18:02:00.000Z', por: 'u-marilio' }
  const hro2110 = (extra = {}) => ({
    id: 'esc-hro', hospital: 'hro', status: 'publicada', data: '2026-10-21',
    ordemLiberacao: { vespertino: ['DANIELA', 'GARIM', 'KLISMAN', 'OSCAR'] }, ajudaExterna: {},
    casos: [{ id: 'c-hro', sala: 'Sala 3', turno: 'vespertino', hora: '14:00', procedimento: 'X', statusCirurgia: 'iniciada', anestesista: 'FERNANDO', anestesistaUserId: 'u-fernando' }],
    linhaOverrides: { 'vespertino:u-klisman': {
      observacao: 'Sala 3',
      assumidaPor: { uid: 'u-fernando', nome: 'FERNANDO HENRIQUE MACHADO', de: { uid: 'u-klisman' }, casoIds: ['c-hro'], em: '2026-10-21T17:01:00.000Z' } } },
    liberacoes: { 'vespertino:u-klisman': LIB_1502 },
    ...extra,
  })
  const unimed2110 = () => ({
    id: 'esc-uni', hospital: 'unimed', status: 'publicada', data: '2026-10-21',
    ordemLiberacao: { vespertino: ['RAFAEL', 'FERNANDO', 'TIAGO'] }, ajudaExterna: {},
    casos: [{ id: 'c-uni', sala: 'Sala 7', turno: 'vespertino', hora: '14:00', procedimento: 'Y', statusCirurgia: 'iniciada', anestesista: 'KLISMAN', anestesistaUserId: 'u-klisman' }],
    linhaOverrides: { 'vespertino:u-fernando': { assumidaPor: { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN', de: { uid: 'u-fernando' }, casoIds: ['c-uni'], em: '2026-10-21T16:59:00.000Z' } } },
    liberacoes: {},
  })
  const LADOS = [
    { hospital: 'hro', escalaId: 'esc-hro', turno: 'vespertino', chaveSlot: 'u-klisman',
      de: { uid: 'u-fernando', nome: 'FERNANDO HENRIQUE MACHADO' }, para: { uid: 'u-klisman', nome: 'KLISMAN', apelido: 'KLISMAN' }, casoIds: ['c-hro'] },
    { hospital: 'unimed', escalaId: 'esc-uni', turno: 'vespertino', chaveSlot: 'u-fernando',
      de: { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN' }, para: { uid: 'u-fernando', nome: 'FERNANDO', apelido: 'FERNANDO' }, casoIds: ['c-uni'] },
  ]
  // o que a RPC devolve para esse recorte (o mesmo estado que o teste de SQL confere)
  const RESPOSTA = {
    escalas: { 'esc-hro': { 'vespertino:u-klisman': { observacao: 'Sala 3', por: 'u-gabriela', em: '2026-10-21T19:40:00Z' } }, 'esc-uni': {} },
    liberacoes: { 'esc-hro': { 'vespertino:u-fernando': LIB_1502 }, 'esc-uni': {} },
    casos: [
      { id: 'c-hro', anestesista: 'KLISMAN', anestesistaUserId: 'u-klisman', semAnestesista: false },
      { id: 'c-uni', anestesista: 'FERNANDO', anestesistaUserId: 'u-fernando', semAnestesista: false },
    ],
    pulados: 0, lados: 2, movidas: [{ escala_id: 'esc-hro', de: 'vespertino:u-klisman', para: 'vespertino:u-fernando' }],
  }

  it('recorte de 21/10: uma chamada só, com os dois lados; nenhuma escrita avulsa do navegador', async () => {
    svcMock.desfazerTrocaAtomica.mockResolvedValue(RESPOSTA)
    await montar(hro2110(), unimed2110())
    await act(async () => { await actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' }) })

    expect(svcMock.desfazerTrocaAtomica).toHaveBeenCalledTimes(1)
    expect(svcMock.desfazerTrocaAtomica).toHaveBeenCalledWith({ lados: [
      { escala_id: 'esc-hro', chave: 'vespertino:u-klisman', caso_ids: ['c-hro'], para_uid: 'u-klisman', para_apelido: 'KLISMAN' },
      { escala_id: 'esc-uni', chave: 'vespertino:u-fernando', caso_ids: ['c-uni'], para_uid: 'u-fernando', para_apelido: 'FERNANDO' },
    ] })
    // o caminho antigo (override lado a lado + casos + rollback) não existe mais
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })

  it('a tela pinta o estado devolvido: o Fernando continua liberado, a 14ª do Klisman volta à fila com a cirurgia dele', async () => {
    svcMock.desfazerTrocaAtomica.mockResolvedValue(RESPOSTA)
    await montar(hro2110(), unimed2110())
    await act(async () => { await actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' }) })

    const hro = estado.escalas.hro
    expect(hro.liberacoes['vespertino:u-fernando']).toEqual(LIB_1502)
    expect(hro.liberacoes['vespertino:u-klisman']).toBeUndefined()
    expect(hro.linhaOverrides['vespertino:u-klisman'].assumidaPor).toBeUndefined()
    expect(hro.linhaOverrides['vespertino:u-klisman'].observacao).toBe('Sala 3')
    expect(hro.casos[0]).toMatchObject({ anestesista: 'KLISMAN', anestesistaUserId: 'u-klisman', statusCirurgia: 'iniciada' })
    expect(estado.escalas.unimed.linhaOverrides).toEqual({})
    expect(estado.escalas.unimed.casos[0]).toMatchObject({ anestesista: 'FERNANDO', anestesistaUserId: 'u-fernando' })
    // sem reler a escala: a única carga foi a da montagem (uma por hospital)
    expect(svcMock.fetchEscala.mock.calls.filter(([, h]) => h === 'hro')).toHaveLength(1)
    expect(await screen.findByText('Troca desfeita')).toBeTruthy()
  })

  it('21/10, Melo ⇄ Cury na mesma escala: a liberação da 12ª fica com o Cury e a vaga do Melo volta à fila', async () => {
    const LIB = { liberadoEm: '2026-10-21T21:37:40.000Z', por: 'u-marilio' }
    svcMock.desfazerTrocaAtomica.mockResolvedValue({
      escalas: { 'esc-hro': {} }, liberacoes: { 'esc-hro': { 'vespertino:u-cury': LIB } },
      casos: [{ id: 'c-cury', anestesista: 'CURY', anestesistaUserId: 'u-cury', semAnestesista: false }],
      pulados: 0, lados: 2, movidas: [{ escala_id: 'esc-hro', de: 'vespertino:u-melo', para: 'vespertino:u-cury' }],
    })
    await montar(hro2110({
      casos: [{ id: 'c-cury', sala: 'Sala 2', turno: 'vespertino', hora: '17:00', procedimento: 'Z', statusCirurgia: 'iniciada', anestesista: 'GUILHERME M ELO', anestesistaUserId: 'u-melo' }],
      linhaOverrides: {
        'vespertino:u-melo': { assumidaPor: { uid: 'u-cury', nome: 'MARCOS TADEU CURY', casoIds: [], em: '2026-10-21T21:37:00.000Z' } },
        'vespertino:u-cury': { assumidaPor: { uid: 'u-melo', nome: 'GUILHERME MELO', casoIds: ['c-cury'], em: '2026-10-21T21:37:00.000Z' } },
      },
      liberacoes: { 'vespertino:u-melo': LIB },
    }))
    await act(async () => {
      await actions.desfazerSubstituicao({ lados: [
        { hospital: 'hro', escalaId: 'esc-hro', turno: 'vespertino', chaveSlot: 'u-melo', de: { uid: 'u-cury', nome: 'CURY' }, para: { uid: 'u-melo', nome: 'GUILHERME MELO', apelido: 'GUILHERME M ELO' }, casoIds: [] },
        { hospital: 'hro', escalaId: 'esc-hro', turno: 'vespertino', chaveSlot: 'u-cury', de: { uid: 'u-melo', nome: 'GUILHERME MELO' }, para: { uid: 'u-cury', nome: 'CURY', apelido: 'CURY' }, casoIds: ['c-cury'] },
      ] }, { userId: 'u-marilio' })
    })
    expect(estado.escalas.hro.liberacoes).toEqual({ 'vespertino:u-cury': LIB })
    expect(estado.escalas.hro.linhaOverrides).toEqual({})
    expect(estado.escalas.hro.casos[0]).toMatchObject({ anestesista: 'CURY', anestesistaUserId: 'u-cury' })
  })

  it('quem devolveu a última cirurgia aberta perde o tempo total gravado (regra de 10/11), sem ressuscitar a posição assumida', async () => {
    // o Fernando, na vaga do Klisman, tinha informado o tempo total na linha DELE (extra) — depois
    // do desfazer ele fica sem cirurgia aberta no HRO
    svcMock.desfazerTrocaAtomica.mockResolvedValue({
      ...RESPOSTA,
      escalas: { ...RESPOSTA.escalas, 'esc-hro': { ...RESPOSTA.escalas['esc-hro'], 'vespertino:u-fernando': { termino: '17:30', observacao: 'avisar' } } },
    })
    await montar(hro2110(), unimed2110())
    await act(async () => { await actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' }) })

    expect(svcMock.patchLinhaOverride).toHaveBeenCalledTimes(1)
    const [id, chave, valor] = svcMock.patchLinhaOverride.mock.calls[0]
    expect([id, chave]).toEqual(['esc-hro', 'vespertino:u-fernando'])
    expect(valor.termino).toBeUndefined()
    expect(valor.observacao).toBe('avisar')
    const ov = estado.escalas.hro.linhaOverrides
    expect(ov['vespertino:u-fernando'].termino).toBeUndefined()
    expect(ov['vespertino:u-klisman'].assumidaPor).toBeUndefined() // a limpeza leu o estado NOVO
  })

  it('dono sem login: só a posição volta — os casos não vão na chamada e o aviso de sempre aparece', async () => {
    svcMock.desfazerTrocaAtomica.mockResolvedValue({ escalas: { 'esc-hro': {} }, liberacoes: { 'esc-hro': {} }, casos: [], pulados: 0, lados: 1, movidas: [] })
    await montar(hro2110({ liberacoes: {} }))
    await act(async () => {
      await actions.desfazerSubstituicao({ lados: [{ ...LADOS[0], para: { uid: null, nome: 'KLISMAN', apelido: 'KLISMAN' } }] }, { userId: 'u-gabriela' })
    })
    expect(svcMock.desfazerTrocaAtomica.mock.calls[0][0].lados[0]).toMatchObject({ caso_ids: [], para_uid: null })
    expect(await screen.findByText(/Casos seguem com Fernando .* ajuste pelo Definir anestesista/)).toBeTruthy()
  })

  it('a RPC ainda não existe no banco (42883/PGRST202): diz que não desfez, recarrega e NÃO cai no caminho antigo', async () => {
    for (const code of ['PGRST202', '42883']) {
      vi.clearAllMocks()
      const erro = Object.assign(new Error('desfazerTrocaAtomica: Could not find the function public.rpc_escala_desfazer_troca(p_lados) in the schema cache'), { code })
      svcMock.desfazerTrocaAtomica.mockRejectedValue(erro)
      await montar(hro2110(), unimed2110())
      const cargasAntes = svcMock.fetchEscala.mock.calls.length
      await act(async () => {
        await expect(actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' })).rejects.toThrow()
      })
      expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
      expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
      expect(svcMock.restaurarAnestesistaCasos).not.toHaveBeenCalled()
      // nada pintado: a posição segue assumida
      expect(estado.escalas.hro.linhaOverrides['vespertino:u-klisman'].assumidaPor.uid).toBe('u-fernando')
      await waitFor(() => expect(svcMock.fetchEscala.mock.calls.length).toBeGreaterThan(cargasAntes))
      expect((await screen.findAllByText('Desfazer não concluído')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Nada foi alterado.').length).toBeGreaterThan(0)
      expect(screen.queryByText(/Could not find the function/)).toBeNull()
    }
  })

  it('o banco recusa o payload (22023): o aviso de sempre, sem o texto técnico, e nada pintado', async () => {
    svcMock.desfazerTrocaAtomica.mockRejectedValue(Object.assign(new Error('desfazerTrocaAtomica: payload_formato_invalido'), { code: '22023' }))
    await montar(hro2110(), unimed2110())
    await act(async () => {
      await expect(actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' })).rejects.toThrow()
    })
    expect((await screen.findAllByText('Desfazer não concluído')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/payload_formato_invalido/)).toBeNull()
    expect(estado.escalas.hro.linhaOverrides['vespertino:u-klisman'].assumidaPor.uid).toBe('u-fernando')
  })

  it('a transação caiu por outro motivo: o motivo aparece, com "Nada foi alterado", e a escala é recarregada', async () => {
    svcMock.desfazerTrocaAtomica.mockRejectedValue(new Error('permission_denied: sem acesso à escala cirúrgica'))
    await montar(hro2110(), unimed2110())
    await act(async () => {
      await expect(actions.desfazerSubstituicao({ lados: LADOS }, { userId: 'u-gabriela' })).rejects.toThrow()
    })
    expect(await screen.findByText(/permission_denied.* Nada foi alterado\./)).toBeTruthy()
    expect(svcMock.restaurarAnestesistaCasos).not.toHaveBeenCalled()
  })

  it('a escala mudou debaixo da folha: recusa antes de chamar o banco', async () => {
    await montar(hro2110(), unimed2110())
    await act(async () => {
      await expect(actions.desfazerSubstituicao({ lados: [{ ...LADOS[0], escalaId: 'esc-outra' }] }, {})).rejects.toThrow(/A escala mudou/)
    })
    expect(svcMock.desfazerTrocaAtomica).not.toHaveBeenCalled()
  })
})

/**
 * "DESFAZER" POR 10 SEGUNDOS (dono 10–11/11/2026, modelo B, bloco 7). 10 de 95 posições
 * assumidas de 26/09 a 10/11 foram desfeitas em até 2 minutos, refazendo o caminho ao
 * contrário. O aviso da troca/repasse QUE MUDA A FILA (quem chama decide: `desfazivel`)
 * traz o botão; sem a marca, o aviso é o de sempre.
 */
describe('aviso com "Desfazer" depois de troca ou repasse que muda a fila', () => {
  const hro = () => ({
    id: 'esc-hro', hospital: 'hro', status: 'publicada', data: '2026-11-10',
    ordemLiberacao: { matutino: ['BRUNO', 'CARLA', 'DIEGO'] }, ajudaExterna: {}, linhaOverrides: {}, liberacoes: {},
    casos: [{ id: 'c5', sala: 'Sala 5', turno: 'matutino', hora: '07:30', procedimento: 'X', statusCirurgia: 'iniciada', anestesista: 'CARLA', anestesistaUserId: 'u-carla' }],
  })
  const LADO = {
    hospital: 'hro', escalaId: 'esc-hro', turno: 'matutino', chaveSlot: 'u-carla', nomeSlot: 'CARLA', tipo: 'assuncao',
    de: { uid: 'u-carla', nome: 'CARLA DORNELLES', apelido: 'CARLA' }, para: { uid: 'u-tiago', nome: 'TIAGO VAZ', apelido: 'TIAGO' }, casoIds: ['c5'],
  }

  it('troca: o aviso diz o que foi feito e "Desfazer" chama a RPC com o lado ao contrário', async () => {
    svcMock.executarTrocaAtomica.mockResolvedValue({
      escalas: { 'esc-hro': { 'matutino:u-carla': { assumidaPor: { uid: 'u-tiago', nome: 'TIAGO VAZ' } } } },
      casos: [{ id: 'c5', anestesista: 'TIAGO', anestesistaUserId: 'u-tiago', semAnestesista: false }], pulados: 0, lados: 1,
    })
    svcMock.desfazerTrocaAtomica.mockResolvedValue({ escalas: { 'esc-hro': {} }, liberacoes: { 'esc-hro': {} }, casos: [{ id: 'c5', anestesista: 'CARLA', anestesistaUserId: 'u-carla', semAnestesista: false }], pulados: 0, lados: 1, movidas: [] })
    await montar(hro())
    await act(async () => {
      await actions.executarSubstituicao({ lados: [LADO], limparTroca: [] }, { userId: 'u-eu' },
        { desfazivel: true, aviso: { title: 'Tiago assumiu a posição de Carla', description: 'Tiago é o 2º do HRO' } })
    })
    expect(await screen.findByText('Tiago assumiu a posição de Carla')).toBeTruthy()
    expect(screen.getByText('Tiago é o 2º do HRO')).toBeTruthy()
    await act(async () => { screen.getByRole('button', { name: 'Desfazer' }).click() })
    await waitFor(() => expect(svcMock.desfazerTrocaAtomica).toHaveBeenCalledTimes(1))
    expect(svcMock.desfazerTrocaAtomica.mock.calls[0][0].lados).toEqual([
      { escala_id: 'esc-hro', chave: 'matutino:u-carla', caso_ids: ['c5'], para_uid: 'u-carla', para_apelido: 'CARLA' },
    ])
    await waitFor(() => expect(estado.escalas.hro.casos[0].anestesistaUserId).toBe('u-carla'))
  })

  it('troca sem a marca (convergência da publicação, FDS): aviso de sempre, sem botão', async () => {
    svcMock.executarTrocaAtomica.mockResolvedValue({ escalas: {}, casos: [], pulados: 0, lados: 1 })
    await montar(hro())
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO], limparTroca: [] }, { userId: 'u-eu' }) })
    expect(await screen.findByText('Troca executada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })

  it('repasse que entra como AJUDA: "Desfazer" devolve a cirurgia a quem estava com ela', async () => {
    await montar(hro())
    await act(async () => {
      await actions.setAnestesistaCasos(estado.escalas.hro, ['c5'], { uid: 'u-jonas', apelido: 'JONAS' },
        { rotulo: 'Sala 5', resolverUid: () => null, userId: 'u-eu', desfazivel: true, aviso: { title: 'Jonas entrou como ajuda', description: 'Carla segue 2º do HRO' } })
    })
    expect(await screen.findByText('Jonas entrou como ajuda')).toBeTruthy()
    expect(svcMock.updateAnestesistaCasos).toHaveBeenCalledTimes(1)
    await act(async () => { screen.getByRole('button', { name: 'Desfazer' }).click() })
    await waitFor(() => expect(svcMock.updateAnestesistaCasos).toHaveBeenCalledTimes(2))
    expect(svcMock.updateAnestesistaCasos.mock.calls[1].slice(0, 2)).toEqual([['c5'], { uid: 'u-carla', apelido: 'CARLA', dupla: false }])
    await waitFor(() => expect(estado.escalas.hro.casos[0].anestesistaUserId).toBe('u-carla'))
  })

  it('repasse comum (colega do mesmo rodapé): sem botão de desfazer', async () => {
    await montar(hro())
    await act(async () => {
      await actions.setAnestesistaCasos(estado.escalas.hro, ['c5'], { uid: 'u-diego', apelido: 'DIEGO' }, { rotulo: 'Sala 5', resolverUid: () => null, userId: 'u-eu' })
    })
    expect(await screen.findByText('Responsável atualizado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })
})
