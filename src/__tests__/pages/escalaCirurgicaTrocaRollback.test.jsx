/**
 * A EXECUÇÃO DA TROCA É UMA TRANSAÇÃO SÓ (item 3.5 da auditoria de 02/09; achado A15).
 *
 * Até 05/09 o swap saía do navegador em 2 a 4 escritas — um patch de override por lado
 * mais os updates de casos em cada hospital — e falha no meio disparava um desfazer em
 * ordem inversa que TAMBÉM pode falhar. A mensagem honesta que sobrava era "Parte foi
 * revertida — confira a lista antes de repetir", com dois anestesistas respondendo pela
 * mesma sala até alguém arrumar à mão. (O desfazer tinha defeito próprio, D2 de 07/08:
 * revertia por `uid` e apagava o anestesista de quem não tem vínculo.)
 *
 * Agora é `rpc_escala_executar_troca`: ou o swap inteiro vale, ou nada mudou. Este arquivo
 * roda o fluxo REAL do context (provider de verdade, service mockado) e trava o contrato
 * novo: uma chamada só, nenhuma escrita por fora dela, e nada de desfazer no cliente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
    restaurarAnestesistaCasos: vi.fn(async () => {}),
    executarTrocaAtomica: vi.fn(async ({ lados = [] }) => ({
      escalas: {}, casos: [], pulados: 0, lados: lados.length,
    })),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

// STAUB não tem vínculo (uid null) — é o cenário que o rollback antigo apagava.
const escalaUnimed = {
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB', 'GIOVANA'] },
  liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [
    { id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', anestesistaUserId: null, semAnestesista: false, turno: 'matutino' },
    { id: 'c2', sala: 'S2', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false, turno: 'matutino' },
  ],
}

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}

const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(svcMock.fetchEscala).toHaveBeenCalled())
  // ESPERAR A ESCALA ASSENTAR NO ESTADO, não só o provider existir: sob carga
  // (suíte inteira) o executarSubstituicao chegava antes do SET_ALL, não achava
  // `escalas.unimed` e morria em "A escala mudou" — flake que derrubou o CI em
  // 10/08 sem nenhuma relação com o que estava sendo testado.
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'unimed' ? escalaUnimed : null))
})

const PLANO_DOIS_LADOS = {
  lados: [
    {
      hospital: 'unimed', escalaId: 'esc-uni', turno: 'matutino',
      chaveSlot: 'STAUB', nomeSlot: 'STAUB',
      de: { uid: null, nome: 'STAUB', apelido: 'STAUB' }, // dono SEM vínculo
      para: { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' },
      casoIds: ['c1'],
    },
    {
      hospital: 'unimed', escalaId: 'esc-uni', turno: 'matutino',
      chaveSlot: 'uid-gio', nomeSlot: 'GIOVANA',
      de: { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' },
      para: { uid: null, nome: 'STAUB', apelido: 'STAUB' },
      casoIds: [],
    },
  ],
  limparTroca: [],
}

describe('executarSubstituicao — o swap inteiro numa transação só', () => {
  it('um swap = UMA chamada, com os dois lados, a chave do turno e os casos', async () => {
    await montar()
    await act(async () => { await actions.executarSubstituicao(PLANO_DOIS_LADOS, { userId: 'u-test' }) })

    expect(svcMock.executarTrocaAtomica).toHaveBeenCalledTimes(1)
    const [{ lados }] = svcMock.executarTrocaAtomica.mock.calls[0]
    expect(lados).toHaveLength(2)
    expect(lados[0]).toMatchObject({
      escala_id: 'esc-uni', chave: 'matutino:STAUB',
      para_uid: 'uid-gio', caso_ids: ['c1'],
      assumida_por: { uid: 'uid-gio', de: { uid: null, nome: 'STAUB' } },
    })
    // e NADA é escrito por fora da transação — era daí que vinha o estado pela metade
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
  })

  it('`por`/`em` NÃO vão no payload: quem carimba é o servidor', async () => {
    await montar()
    await act(async () => { await actions.executarSubstituicao(PLANO_DOIS_LADOS, { userId: 'u-test' }) })
    const [{ lados }] = svcMock.executarTrocaAtomica.mock.calls[0]
    for (const l of lados) {
      expect(l.assumida_por.por).toBeUndefined()
      expect(l.assumida_por.em).toBeUndefined()
    }
  })

  it('caso só viaja com quem tem vínculo — uid null nunca acompanha caso', async () => {
    // o defeito D2 (07/08) apagava o anestesista de quem não tem login; aqui a garantia
    // é estrutural: o lado sem uid é o que NÃO leva casos
    await montar()
    await act(async () => { await actions.executarSubstituicao(PLANO_DOIS_LADOS, { userId: 'u-test' }) })
    const [{ lados }] = svcMock.executarTrocaAtomica.mock.calls[0]
    for (const l of lados) {
      if ((l.caso_ids || []).length) expect(l.para_uid).toBeTruthy()
    }
  })

  it('falha na transação: nada é desfeito pelo cliente, porque nada ficou pela metade', async () => {
    await montar()
    svcMock.executarTrocaAtomica.mockRejectedValueOnce(new Error('rede caiu'))

    await act(async () => {
      await expect(actions.executarSubstituicao(PLANO_DOIS_LADOS, { userId: 'u-test' })).rejects.toThrow('rede caiu')
    })
    // o desfazer do cliente saiu junto com o estado pela metade
    expect(svcMock.restaurarAnestesistaCasos).not.toHaveBeenCalled()
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  it('o estado resultante vem do servidor, sem reler a escala', async () => {
    await montar()
    svcMock.executarTrocaAtomica.mockResolvedValueOnce({
      escalas: { 'esc-uni': { 'matutino:STAUB': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } } },
      casos: [{ id: 'c1', anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false }],
      pulados: 0, lados: 2,
    })
    await act(async () => { await actions.executarSubstituicao(PLANO_DOIS_LADOS, { userId: 'u-test' }) })

    await waitFor(() => expect(estado.escalas.unimed.linhaOverrides['matutino:STAUB']?.assumidaPor?.uid).toBe('uid-gio'))
    expect(estado.escalas.unimed.casos.find((c) => c.id === 'c1')).toMatchObject({ anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio' })
  })
})

// IDEMPOTÊNCIA (defeito D10, corrigido 07/08): re-executar o mesmo plano — 2º toque,
// convergência pós-publicação, dois plantonistas ao mesmo tempo — re-transferia casos que,
// depois do swap, pertencem ao OUTRO lado. Quem decide agora é o servidor, dentro da
// transação (é lá que dá para ler e escrever sem corrida); o cliente relata.
describe('executarSubstituicao — idempotência', () => {
  it('todos os lados já assumidos: o aviso diz "já executada" e nada mais é escrito', async () => {
    await montar()
    svcMock.executarTrocaAtomica.mockResolvedValueOnce({ escalas: {}, casos: [], pulados: 1, lados: 1 })

    const plano = { lados: [PLANO_DOIS_LADOS.lados[0]], limparTroca: [] }
    await act(async () => { await actions.executarSubstituicao(plano, { userId: 'u-test' }) })

    expect(await screen.findByText(/já executada/i)).toBeTruthy()
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
  })
})

// CADEIA DE FALLBACK no marcarTroca (defeito D6, corrigido 07/08): o override da
// linha pode viver em chave LEGADA (crua, sem prefixo de turno). Ler só a chave
// namespaced criava uma SEGUNDA entrada — a troca ia para `matutino:uid-gio` e o
// local/observação ficavam órfãos em `uid-gio`, sumindo da UI (o overrideDe da
// view encontra a scoped primeiro).
describe('marcarTroca — preserva override legado ao declarar (D6)', () => {
  it('migra a entrada legada: local vem junto, chave antiga é limpa', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, hosp) => (hosp === 'unimed'
      ? { ...escalaUnimed, linhaOverrides: { 'uid-gio': { local: 'IOSC', observacao: 'recado' } } }
      : null))
    await montar()

    await act(async () => {
      await actions.marcarTroca(
        { ...escalaUnimed, linhaOverrides: { 'uid-gio': { local: 'IOSC', observacao: 'recado' } } },
        { chave: 'uid-gio', anestesista: 'GIOVANA' },
        { uid: 'uid-mau', nome: 'MAURICIO COSTA' },
        { userId: 'u-test' },
        'matutino',
      )
    })

    // a entrada nova (namespaced) carrega o resto do override legado + a troca
    const escrita = svcMock.patchLinhaOverride.mock.calls.find(([, k]) => k === 'matutino:uid-gio')
    expect(escrita).toBeTruthy()
    expect(escrita[2]).toMatchObject({
      local: 'IOSC',
      observacao: 'recado',
      trocaCom: { uid: 'uid-mau', nome: 'MAURICIO COSTA' },
    })
    // e a chave legada foi removida (migração, não duplicação)
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('esc-uni', 'uid-gio', null)
  })
})
