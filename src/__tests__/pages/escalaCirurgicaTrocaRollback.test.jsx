/**
 * ROLLBACK DA TROCA POR SNAPSHOT (defeito D2, corrigido 07/08).
 *
 * O rollback antigo revertia a transferência de casos com `{ uid: lado.de.uid }`.
 * Quando o dono do slot não tinha vínculo (uid null — planoExecucaoTroca produz
 * isso de propósito), o service traduzia para `anestesista='?'` +
 * `sem_anestesista=true`: a falha no meio do swap APAGAVA o anestesista dos
 * casos em vez de restaurá-lo. Este teste executa o fluxo REAL do context
 * (provider de verdade, service mockado) com falha no 2º lado e trava:
 *   1. o rollback restaura o SNAPSHOT exato (texto original "STAUB", uid null);
 *   2. nenhum caminho de rollback chama updateAnestesistaCasos com uid null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
    restaurarAnestesistaCasos: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

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
function Grab() {
  actions = useEscalaCirurgicaActions()
  return null
}

const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(svcMock.fetchEscala).toHaveBeenCalled())
  // espera o SET_ALL assentar (executarSubstituicao lê escalasRef)
  await waitFor(() => expect(actions).toBeTruthy())
}

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'unimed' ? escalaUnimed : null))
})

describe('executarSubstituicao — rollback por snapshot', () => {
  it('falha no 2º lado → restaura o snapshot exato; nunca updateAnestesistaCasos(uid null)', async () => {
    await montar()
    // 1º lado passa inteiro; a falha vem no patch do 2º lado
    svcMock.patchLinhaOverride
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rede caiu'))

    const plano = {
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

    await act(async () => {
      await expect(actions.executarSubstituicao(plano, { userId: 'u-test' })).rejects.toThrow('rede caiu')
    })

    // o rollback restaurou o snapshot EXATO do caso do dono sem vínculo
    expect(svcMock.restaurarAnestesistaCasos).toHaveBeenCalledWith([
      { id: 'c1', anestesista: 'STAUB', anestesistaUserId: null, semAnestesista: false },
    ])
    // e NENHUM caminho (ida ou rollback) escreveu casos com uid null —
    // era exatamente isso que apagava o anestesista
    for (const [, args] of svcMock.updateAnestesistaCasos.mock.calls) {
      expect(args.uid).toBeTruthy()
    }
  })

  it('sucesso não usa o caminho de restauração', async () => {
    await montar()
    const plano = {
      lados: [{
        hospital: 'unimed', escalaId: 'esc-uni', turno: 'matutino',
        chaveSlot: 'STAUB', nomeSlot: 'STAUB',
        de: { uid: null, nome: 'STAUB', apelido: 'STAUB' },
        para: { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' },
        casoIds: ['c1'],
      }],
      limparTroca: [],
    }
    await act(async () => { await actions.executarSubstituicao(plano, { userId: 'u-test' }) })
    expect(svcMock.restaurarAnestesistaCasos).not.toHaveBeenCalled()
    expect(svcMock.updateAnestesistaCasos).toHaveBeenCalledWith(['c1'], { uid: 'uid-gio', apelido: 'GIOVANA' })
  })
})

// IDEMPOTÊNCIA (defeito D10, corrigido 07/08): re-executar o mesmo plano —
// 2º toque, convergência pós-publicação, dois plantonistas ao mesmo tempo —
// re-transferia casos que, depois do swap, pertencem ao OUTRO lado. Lado cujo
// slot já está assumido por quem o plano quer pôr é pulado inteiro.
describe('executarSubstituicao — idempotência', () => {
  it('slot já assumido pelo alvo → nenhuma escrita, toast de "já executada"', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, hosp) => (hosp === 'unimed'
      ? {
        ...escalaUnimed,
        linhaOverrides: { 'matutino:STAUB': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
        // pós-swap real: o caso já é da Giovana
        casos: [{ id: 'c1', sala: 'S1', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', semAnestesista: false, turno: 'matutino' }],
      }
      : null))
    await montar()

    const plano = {
      lados: [{
        hospital: 'unimed', escalaId: 'esc-uni', turno: 'matutino',
        chaveSlot: 'STAUB', nomeSlot: 'STAUB',
        de: { uid: null, nome: 'STAUB', apelido: 'STAUB' },
        para: { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' },
        casoIds: ['c1'],
      }],
      limparTroca: [],
    }
    await act(async () => { await actions.executarSubstituicao(plano, { userId: 'u-test' }) })
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
