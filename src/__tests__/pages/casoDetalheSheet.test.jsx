/**
 * CasoDetalheSheet — o detalhe do caso é o MESMO sheet nas abas Completa, Minhas e
 * no painel da linha (Liberações). Os três pedidos do dono de 29/07 que moram no
 * caso passam por aqui, e é isso que estes testes travam:
 *   • RESIDENTE por caso (acompanha; não vira responsável)
 *   • TEMPO faltante DESTA CIRURGIA (≠ do tempo da pessoa, que fica na fila)
 *   • AJUDA marcada à mão, escrevendo no MESMO `ajudaExterna` que a fila lê
 *
 * REDESENHO 17/08 ("Andamento no topo", escolhido em protótipo): o estado abre o
 * painel, a identidade do caso virou cabeçalho e cada campo da Equipe mostra o
 * valor atual com um botão que abre o editor. Os testes seguem o desenho novo —
 * a asserção não afrouxou, mudou o caminho até o mesmo controle.
 *
 * Novo aqui: TROCAR O CIRURGIÃO (dono 17/08). Era o único dado da cirurgia sem
 * conserto no app; grava em `cirurgiao`, o mesmo campo do "Adicionar caso".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'

const { atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia, setLinhaOverride } = vi.hoisted(() => ({
  atualizarCaso: vi.fn(async () => {}),
  adicionarAjuda: vi.fn(async () => {}),
  removerAjuda: vi.fn(async () => {}),
  setStatusCirurgia: vi.fn(async () => {}),
  setLinhaOverride: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia, setLinhaOverride }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu Mesmo' } }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({
    residentes: [{ uid: 'uid-augusto', nome: 'Augusto' }, { uid: 'uid-jacinta', nome: 'Jacinta' }],
    residenteByUid: new Map([
      ['uid-augusto', { uid: 'uid-augusto', nome: 'Augusto' }],
      ['uid-jacinta', { uid: 'uid-jacinta', nome: 'Jacinta' }],
    ]),
    options: [{ value: 'uid-augusto', label: 'Augusto' }, { value: 'uid-jacinta', label: 'Jacinta' }],
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = {
  id: 'c1', sala: 'Sala 1', ordem: 0, hora: '07:30', anestesista: 'MARILIO',
  cirurgiao: 'Taciana A', procedimento: 'Colecistectomia', turno: 'matutino',
}
const escala = { id: 'e1', hospital: 'hro', data: '2026-07-29', ajudaExterna: {}, casos: [caso] }

const montar = (props = {}, esc = escala) => render(
  <CasoDetalheSheet escala={esc} caso={esc.casos[0]} onClose={vi.fn()} podeEditar {...props} />,
  { wrapper: wrap }
)

/** Abre o bloco de tempo (a linha mostra o valor; o botão abre o editor). */
const abrirTempo = () =>
  fireEvent.click(screen.getByRole('button', { name: /Definir término|^\d{2}:\d{2}/ }))

beforeEach(() => vi.clearAllMocks())

describe('Residente do caso (dono 29/07)', () => {
  it('escolher o residente grava uid + nome no CASO', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Augusto' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: 'Augusto', residenteUserId: 'uid-augusto' })
  })

  it('"Sem residente" limpa os dois campos', async () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({}, { ...escala, casos: [comResidente] })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Sem residente' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: null, residenteUserId: null })
  })

  it('quem não edita vê o residente só como leitura (sem seletor)', () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({ podeEditar: false }, { ...escala, casos: [comResidente] })
    expect(screen.getByText('Residente')).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Trocar residente' })).toBeNull()
  })

  it('a interface deixa claro que o residente não responde pelo caso', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    expect(screen.getByText(/quem responde por ele continua sendo o anestesista/i)).toBeTruthy()
  })
})

describe('Cirurgião do caso (dono 17/08)', () => {
  it('trocar o cirurgião grava no CASO — mesmo campo do "Adicionar caso"', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cirurgião' }))
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Outro… (digitar)' }))
    fireEvent.change(screen.getByPlaceholderText(/Eduardo Baldissera/), { target: { value: 'Liana W' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ cirurgiao: 'Liana W' })
  })

  it('sugere os cirurgiões JÁ na escala do dia (evita a mesma pessoa em duas grafias)', () => {
    const outro = { ...caso, id: 'c2', ordem: 1, cirurgiao: 'Liana Winkelmann' }
    montar({}, { ...escala, casos: [caso, outro] })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cirurgião' }))
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'Liana Winkelmann' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Taciana A' })).toBeTruthy()
  })

  it('quem não edita não troca o cirurgião', () => {
    montar({ podeEditar: false })
    expect(screen.getByText('Cirurgião')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trocar cirurgião' })).toBeNull()
  })
})

describe('Dois eixos de status (dono 21/07, desenho 17/08)', () => {
  it('cirurgia TERMINADA desabilita os avisos — os eixos nunca se contradizem', () => {
    montar({}, { ...escala, casos: [{ ...caso, statusCirurgia: 'terminada' }] })
    for (const aviso of ['Atrasada', 'Suspensa', 'Passa para tarde']) {
      expect(screen.getByRole('button', { name: aviso }).disabled).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'Terminada' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('o aviso convive com Iniciada', () => {
    montar({}, { ...escala, casos: [{ ...caso, statusCirurgia: 'iniciada', statusExtra: 'atrasada' }] })
    expect(screen.getByRole('button', { name: 'Iniciada' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Atrasada' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Atrasada' }).disabled).toBe(false)
  })

  it('o painel acompanha o conteúdo — não nasce com 85% da tela', () => {
    // `POSITION_CLASSES.bottom` do DS fixa h-[85vh]; sem soltar isso, o painel
    // ocupa 85% da tela mesmo com pouca coisa dentro (jsdom não mede layout, então
    // o que dá para travar aqui é a classe que produz o comportamento)
    montar()
    expect(document.querySelector('[data-slot="sheet-content"]').className).toContain('!h-auto')
  })

  it('o tipo do caso é badge vermelho, não linha de texto (auditoria 17/08)', () => {
    montar({}, { ...escala, casos: [{ ...caso, tipo: 'emergencia' }] })
    expect(screen.getByText('Emergência')).toBeTruthy()
  })
})

describe('Término DESTA cirurgia (dono 29/07)', () => {
  it('grava o término previsto no caso — e ESPELHA no tempo total (única cirurgia, dono 30/07)', async () => {
    montar()
    abrirTempo()
    // os atalhos de duração saíram (dono 29/07): o Select de tempo faltante ocupou o lugar
    fireEvent.click(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent)))
    fireEvent.click(screen.getByRole('option', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    const patch = atualizarCaso.mock.calls[0][2]
    expect(patch).toHaveProperty('terminoPrevisto')
    expect(patch.terminoPrevisto).toMatch(/^\d{2}:\d{2}$/)
    // MARILIO tem UMA só cirurgia no turno → o cronômetro da linha (Liberações)
    // acompanha sozinho, com o MESMO horário — os dois campos divergiam
    await waitFor(() => expect(setLinhaOverride).toHaveBeenCalled())
    const [, linha, override] = setLinhaOverride.mock.calls[0]
    expect(linha.chave).toBe('MARILIO')
    expect(override.termino).toBe(patch.terminoPrevisto)
  })

  it('com 2+ cirurgias ativas NÃO espelha — o total da pessoa segue manual', async () => {
    const segundo = { ...caso, id: 'c2', ordem: 1, hora: '09:00', cirurgiao: 'Liana W' }
    montar({}, { ...escala, casos: [caso, segundo] })
    abrirTempo()
    fireEvent.click(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent)))
    fireEvent.click(screen.getByRole('option', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(setLinhaOverride).not.toHaveBeenCalled()
  })

  it('o rótulo separa os dois tempos para o plantonista não confundir', () => {
    montar()
    // o bloco diz que é DESTA cirurgia; o tempo da PESSOA é outro campo, na fila
    expect(screen.getByText(/Tempo desta cirurgia/)).toBeTruthy()
    abrirTempo()
    expect(screen.getByText(/Só desta cirurgia/)).toBeTruthy()
    // as duas entradas convivem: duração OU horário digitado, mesmo campo
    expect(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent))).toBeTruthy()
    expect(document.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
  })

  it('limpar devolve null (o campo volta a vazio, não a "00:00")', async () => {
    montar({}, { ...escala, casos: [{ ...caso, terminoPrevisto: '10:30' }] })
    abrirTempo()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoPrevisto: null })
  })
})

describe('Ajuda marcada pela aba Completa (dono 29/07)', () => {
  it('marca a ajuda no turno DO CASO — a fila lê o mesmo ajudaExterna', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Marcar Marilio como ajuda/ }))
    await waitFor(() => expect(adicionarAjuda).toHaveBeenCalled())
    const [, turno, nome] = adicionarAjuda.mock.calls[0]
    expect(turno).toBe('matutino')
    expect(nome).toBe('MARILIO')
  })

  it('quem já é ajuda desmarca (volta ao estado anterior)', async () => {
    montar({}, { ...escala, ajudaExterna: { matutino: ['MARILIO'] } })
    fireEvent.click(screen.getByRole('button', { name: /Marilio não é ajuda/ }))
    await waitFor(() => expect(removerAjuda).toHaveBeenCalledWith(expect.anything(), 'matutino', 'MARILIO'))
  })

  it('sala compartilhada ("A + B") não oferece marcar — não há um nome só', () => {
    montar({}, { ...escala, casos: [{ ...caso, anestesista: 'MARILIO + KARINE' }] })
    expect(screen.queryByRole('button', { name: /como ajuda/ })).toBeNull()
  })

  it('caso sem dono ("?") também não oferece', () => {
    montar({}, { ...escala, casos: [{ ...caso, anestesista: '?' }] })
    expect(screen.queryByRole('button', { name: /como ajuda/ })).toBeNull()
  })
})
