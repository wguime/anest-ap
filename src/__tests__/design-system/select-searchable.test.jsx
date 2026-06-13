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

function renderSelect(props = {}) {
  return render(
    <Select label="Anestesiologista" searchable options={OPTIONS} value="" onChange={() => {}} placeholder="Selecione..." {...props} />
  )
}

describe('Select searchable — filtro do dropdown', () => {
  it('abre o dropdown e mostra todas as opções', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
  })

  it('filtra as opções ao digitar na barra de busca', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    const searchInput = screen.getByPlaceholderText('Buscar...')
    fireEvent.change(searchInput, { target: { value: 'bru' } })
    const listbox = screen.getByRole('listbox')
    const opts = within(listbox).getAllByRole('option')
    expect(opts).toHaveLength(1)
    expect(opts[0]).toHaveTextContent('Bruno Lima')
  })

  it('mostra "Nenhum resultado encontrado" quando não há match', () => {
    renderSelect()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument()
  })
})
