/**
 * PainelTempo — escolher a hora GRAVA.
 *
 * Bug de 29/07 (dono): "escolho 14:00 no seletor, toco em Definir e nada
 * acontece". O banco confirmou: nenhum override de tempo da KARINE e
 * `termino_previsto` NULL em todos os casos da escala. Os dois caminhos que
 * falharam — painel da linha (Liberações) e detalhe do caso — compartilham este
 * componente, e nos dois a gravação dependia de um SEGUNDO toque, no botão.
 *
 * Duas coisas eram armadilha:
 *   1. a hora só era gravada pelo botão, nunca pela escolha;
 *   2. o Select exibia o próximo quarto de hora COMO SE estivesse escolhido
 *      (com ✓), então o painel parecia ter tempo definido sem ter nenhum — e os
 *      dois prints do dono mostravam "15:45" em cirurgias diferentes, às 15:30.
 *
 * O cronômetro segue 100% MANUAL (decisão do dono 23/07): o que muda é quantos
 * toques a escolha custa, não de onde o número vem.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider } from '@/design-system'
import PainelTempo from '@/pages/escala-cirurgica/PainelTempo'

const wrap = ({ children }) => <ThemeProvider>{children}</ThemeProvider>

const montar = (props = {}) => {
  const onDefinir = vi.fn()
  const onHoraExata = vi.fn()
  render(
    <PainelTempo atual="" horaExata="" onHoraExata={onHoraExata} onDefinir={onDefinir} {...props} />,
    { wrapper: wrap },
  )
  return { onDefinir, onHoraExata }
}

/** Combobox pelo texto visível (o DS usa aria-labelledby, que vence aria-label). */
const combo = (re) => screen.getAllByRole('combobox').find((c) => re.test(c.textContent))
/** Escolhe no seletor de DURAÇÃO (rótulo é duração; o valor gravado é a hora). */
const escolherDuracao = async (rotulo) => {
  fireEvent.click(combo(/Tempo faltante/i))
  fireEvent.click(await screen.findByRole('option', { name: rotulo }))
}
/** Escolhe no seletor de HORÁRIO de término. */
const escolherHorario = async (hhmm) => {
  fireEvent.click(combo(/Horário de término|^\d{2}:\d{2}$/))
  fireEvent.click(await screen.findByRole('option', { name: hhmm }))
}

describe('PainelTempo — duas entradas para o mesmo campo (dono 29/07)', () => {
  it('oferece TEMPO FALTANTE e HORÁRIO DE TÉRMINO, uma ou outra', () => {
    montar()
    expect(combo(/Tempo faltante/i)).toBeTruthy()
    expect(combo(/Horário de término/i)).toBeTruthy()
  })

  it('escolher a duração grava a HORA correspondente, sem depender do botão', async () => {
    const { onDefinir } = montar()
    await escolherDuracao('1h')
    expect(onDefinir).toHaveBeenCalledTimes(1)
    // o banco guarda "HH:MM": duração salva envelheceria sozinha, hora não
    expect(onDefinir.mock.calls[0][0]).toMatch(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  })

  it('escolher o horário grava exatamente ele', async () => {
    const { onDefinir } = montar()
    await escolherHorario('18:30')
    expect(onDefinir).toHaveBeenCalledWith('18:30')
  })

  it('não finge um valor escolhido quando não há nenhum', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Definir' })).toBeDisabled()
    expect(screen.queryByText(/Acaba às/)).toBeNull()
  })

  it('com valor gravado, o seletor de horário mostra ELE e o botão volta a valer', () => {
    montar({ atual: '16:30' })
    expect(combo(/16:30/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Definir' })).not.toBeDisabled()
  })

  it('a prévia traduz a hora em quanto falta — sem conta de cabeça', () => {
    montar({ atual: '16:30' })
    const previa = screen.getByText(/Acaba às 16:30|Passou de 16:30/)
    expect(previa).toBeTruthy()
  })

  it('o botão continua gravando para quem toca nele', () => {
    const { onDefinir } = montar({ atual: '16:30' })
    fireEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(onDefinir).toHaveBeenCalledWith('16:30')
  })

  it('limpar cronômetro só aparece quando há valor, e grava vazio', () => {
    montar()
    expect(screen.queryByRole('button', { name: /limpar cronômetro/i })).toBeNull()

    const { onDefinir } = montar({ atual: '16:30' })
    fireEvent.click(screen.getAllByRole('button', { name: /limpar cronômetro/i })[0])
    expect(onDefinir).toHaveBeenCalledWith('')
  })
})
