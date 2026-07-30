/**
 * CasoDetalheSheet — o detalhe do caso é o MESMO sheet nas abas Completa, Minhas e
 * no painel da linha (Liberações). Os três pedidos do dono de 29/07 que moram no
 * caso passam por aqui, e é isso que estes testes travam:
 *   • RESIDENTE por caso (acompanha; não vira responsável)
 *   • TEMPO faltante DESTA CIRURGIA (≠ do tempo da pessoa, que fica na fila)
 *   • AJUDA marcada à mão, escrevendo no MESMO `ajudaExterna` que a fila lê
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'

const { atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia } = vi.hoisted(() => ({
  atualizarCaso: vi.fn(async () => {}),
  adicionarAjuda: vi.fn(async () => {}),
  removerAjuda: vi.fn(async () => {}),
  setStatusCirurgia: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
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

beforeEach(() => vi.clearAllMocks())

describe('Residente do caso (dono 29/07)', () => {
  it('escolher o residente grava uid + nome no CASO', async () => {
    montar()
    // o seletor nasce em "Sem residente" (é o valor, não o placeholder)
    fireEvent.click(screen.getByText('Sem residente'))
    fireEvent.click(screen.getByRole('option', { name: 'Augusto' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: 'Augusto', residenteUserId: 'uid-augusto' })
  })

  it('"Sem residente" limpa os dois campos', async () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({}, { ...escala, casos: [comResidente] })
    fireEvent.click(screen.getByText('Augusto'))
    fireEvent.click(screen.getByRole('option', { name: 'Sem residente' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: null, residenteUserId: null })
  })

  it('quem não edita vê o residente só como leitura (sem seletor)', () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({ podeEditar: false }, { ...escala, casos: [comResidente] })
    expect(screen.getByText('Residente')).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.queryByText('Sem residente')).toBeNull()
  })

  it('a interface deixa claro que o residente não responde pelo caso', () => {
    montar()
    expect(screen.getByText(/quem responde por ele continua sendo o anestesista/i)).toBeTruthy()
  })
})

describe('Término DESTA cirurgia (dono 29/07)', () => {
  it('grava o término previsto no caso, não na linha da pessoa', async () => {
    montar()
    // os atalhos de duração saíram (dono 29/07): o Select de tempo faltante ocupou o lugar
    fireEvent.click(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent)))
    fireEvent.click(screen.getByRole('option', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    const patch = atualizarCaso.mock.calls[0][2]
    expect(patch).toHaveProperty('terminoPrevisto')
    expect(patch.terminoPrevisto).toMatch(/^\d{2}:\d{2}$/)
  })

  it('o rótulo separa os dois tempos para o plantonista não confundir', () => {
    montar()
    // o rótulo diz que é DESTA cirurgia e oferece as duas entradas (dono 29/07)
    expect(screen.getByText(/Tempo para término ou horário de término desta cirurgia/)).toBeTruthy()
    expect(screen.getByText(/Só desta cirurgia/)).toBeTruthy()
    // as duas entradas convivem: duração OU horário digitado, mesmo campo
    expect(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent))).toBeTruthy()
    expect(document.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
  })

  it('limpar devolve null (o campo volta a vazio, não a "00:00")', async () => {
    montar({}, { ...escala, casos: [{ ...caso, terminoPrevisto: '10:30' }] })
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
