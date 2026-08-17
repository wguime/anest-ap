/**
 * Ground-truth: o Select searchable filtra as opções ao digitar?
 * (diagnóstico do bug "ao selecionar anestesiologista/residente a barra de busca não funciona")
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { Select } from '@/design-system/components/ui/select'

afterEach(cleanup)

const OPTIONS = [
  { value: 'ana', label: 'Ana Souza' },
  { value: 'bruno', label: 'Bruno Lima' },
  { value: 'carla', label: 'Carla Mendes' },
]

/**
 * Campo de busca — desde 16/08 ele vive no PRÓPRIO GATILHO (antes ficava dentro
 * do menu, o que obrigava um segundo toque no celular para digitar). O input
 * herda o placeholder do select, então localizamos pelo rótulo acessível.
 */
const buscaDoGatilho = () => screen.getByRole('textbox', { name: 'Selecione...' })

function renderSelect(props = {}) {
  return render(
    <Select label="Anestesiologista" searchable options={OPTIONS} value="" onChange={() => {}} placeholder="Selecione..." {...props} />
  )
}

describe('Select searchable — filtro do dropdown', () => {
  it('a busca fica no GATILHO ao abrir, sem exigir um segundo toque (dono 16/08)', () => {
    renderSelect()
    const gatilho = screen.getByRole('combobox')
    expect(screen.queryByRole('textbox')).toBeNull()  // fechado: só o rótulo
    fireEvent.click(gatilho)
    const busca = buscaDoGatilho()
    expect(gatilho.contains(busca)).toBe(true)        // o input está DENTRO do gatilho
  })

  it('abre o dropdown e mostra todas as opções', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
  })

  it('filtra as opções ao digitar na barra de busca', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    const searchInput = buscaDoGatilho()
    fireEvent.change(searchInput, { target: { value: 'bru' } })
    const listbox = screen.getByRole('listbox')
    const opts = within(listbox).getAllByRole('option')
    expect(opts).toHaveLength(1)
    expect(opts[0]).toHaveTextContent('Bruno Lima')
  })

  it('mostra "Nenhum resultado encontrado" quando não há match', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(buscaDoGatilho(), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument()
  })

  it('NÃO fecha em scroll induzido pelo teclado ao focar a busca (regressão mobile)', () => {
    // Repro do bug: tocar no campo de busca abre o teclado virtual → viewport
    // rola → dropdown fechava antes de digitar. Com a busca focada, o scroll
    // externo deve ser ignorado.
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    const searchInput = buscaDoGatilho()
    searchInput.focus()
    expect(document.activeElement).toBe(searchInput)
    fireEvent.scroll(window, {})
    // dropdown continua aberto (listbox presente) e dá pra digitar
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.change(searchInput, { target: { value: 'car' } })
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
  })
})
