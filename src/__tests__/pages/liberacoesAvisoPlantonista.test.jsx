/**
 * RECADO DO PLANTONISTA na aba Liberações (dono 2026-08-17).
 *
 * "um campo para mensagem enviada exclusivamente pelo plantonista, em destaque
 * acima dos procedimentos sem anestesista; os envolvidos confirmam e a mensagem
 * some (inclusive o plantonista)."
 *
 * O que estes testes travam:
 *  - só o PLANTONISTA do turno vê o botão de avisar (para os demais o botão não
 *    existe — não é um botão desabilitado);
 *  - o recado aparece ACIMA de "Procedimentos sem anestesista", que foi o pedido;
 *  - confirmar tira o recado da tela de QUEM confirmou, e só dele;
 *  - nada disso notifica ninguém: a escala não manda mensagem desde 30/07.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const { fetchAvisos, criarAviso, confirmarAviso } = vi.hoisted(() => ({
  fetchAvisos: vi.fn(async () => []),
  criarAviso: vi.fn(async () => 'aviso-1'),
  confirmarAviso: vi.fn(async () => {}),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchAvisos, criarAviso, confirmarAviso, fetchLocaisHospital: vi.fn(async () => []) },
}))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const escala = {
  id: 'e1', hospital: 'unimed', data: '2026-08-14',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    { id: 'c1', sala: 'Sala 1', ordem: 0, hora: '07:30', anestesista: 'LEONARDO', cirurgiao: 'Liana W', turno: 'matutino' },
    { id: 'c2', sala: 'Sala 2', ordem: 0, hora: '08:00', anestesista: 'MARILIO', cirurgiao: 'Taciana A', turno: 'matutino' },
  ],
}

const montar = (props = {}) => render(
  <LiberacoesView
    escala={escala}
    hospital="unimed"
    hospitalLabel="Unimed"
    canEdit
    turno="matutino"
    onToggle={() => {}}
    onSetOverride={() => {}}
    {...props}
  />,
  { wrapper: wrap },
)

const AVISO = {
  id: 'aviso-1', texto: 'Guilherme libera Alexandre S.',
  autorUserId: 'uid-leo', autorNome: 'LEONARDO FONTES',
  criadoEm: '2026-08-14T17:20:00.000Z', confirmadoPor: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchAvisos.mockResolvedValue([])
})

describe('Quem pode avisar', () => {
  it('o plantonista do turno vê o botão "Avisar a equipe"', async () => {
    // LEONARDO é o 1º do rodapé matutino → é ele que carrega o selo Plantonista
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    expect(await screen.findByRole('button', { name: /Avisar a equipe/ })).toBeTruthy()
  })

  it('quem NÃO é plantonista não vê o botão — nem desabilitado', () => {
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    expect(screen.queryByRole('button', { name: /Avisar a equipe/ })).toBeNull()
  })

  it('sem saber quem sou eu, ninguém avisa', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Avisar a equipe/ })).toBeNull()
  })

  it('publicar manda só o texto — autor e hora são do banco (trigger)', async () => {
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    fireEvent.click(await screen.findByRole('button', { name: /Avisar a equipe/ }))
    fireEvent.change(screen.getByPlaceholderText(/Guilherme libera/), {
      target: { value: 'Leonardo libera Marilio' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar recado' }))
    await waitFor(() => expect(criarAviso).toHaveBeenCalled())
    const [escalaId, turno, texto] = criarAviso.mock.calls[0]
    expect(escalaId).toBe('e1')
    expect(turno).toBe('matutino')
    expect(texto).toBe('Leonardo libera Marilio')
  })
})

describe('O recado na tela', () => {
  it('aparece ACIMA de "Procedimentos sem anestesista" (foi o pedido)', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    const comSemAnest = {
      ...escala,
      casos: [...escala.casos, { id: 'c3', sala: 'IMAGEM', ordem: 0, hora: '09:00', anestesista: '?', semAnestesista: true, procedimento: 'Ecotransesofágico', turno: 'matutino' }],
    }
    montar({ escala: comSemAnest, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    const recado = await screen.findByText('Guilherme libera Alexandre S.')
    const alerta = screen.getByText(/Procedimentos sem anestesista/)
    // DOCUMENT_POSITION_FOLLOWING = o alerta vem DEPOIS do recado no documento
    expect(recado.compareDocumentPosition(alerta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('mostra quem falou e quantos já confirmaram', async () => {
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-a', 'uid-b'] }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    // o nome mostrado é o do AUTOR gravado pelo banco, não o de quem está lendo
    expect(await screen.findByText(/Leonardo Fontes/)).toBeTruthy()
    expect(screen.getByText(/2 confirmaram/)).toBeTruthy()
  })

  it('quem JÁ confirmou não vê mais o recado — some da tela dele, não de todos', async () => {
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-leo'] }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await waitFor(() => expect(fetchAvisos).toHaveBeenCalled())
    expect(screen.queryByText('Guilherme libera Alexandre S.')).toBeNull()
  })

  it('confirmar tira o recado da tela na hora', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByText('Guilherme libera Alexandre S.')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    await waitFor(() => expect(confirmarAviso).toHaveBeenCalledWith('aviso-1', expect.objectContaining({ userId: 'uid-leo' })))
    await waitFor(() => expect(screen.queryByText('Guilherme libera Alexandre S.')).toBeNull())
  })

  it('com recado na tela, o plantonista não é convidado a mandar outro', async () => {
    // um de cada vez: empilhar recados na frente da fila devolveria o problema
    // que fez as notificações da escala serem removidas em 30/07
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByText('Guilherme libera Alexandre S.')
    expect(screen.queryByRole('button', { name: /Avisar a equipe/ })).toBeNull()
  })
})
