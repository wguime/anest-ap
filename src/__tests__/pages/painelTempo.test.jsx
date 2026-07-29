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

/** Escolhe uma hora no Select (um toque para abrir, um na opção). */
const escolherHora = async (hora) => {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: hora }))
}

describe('PainelTempo — a escolha da hora grava', () => {
  it('escolher a hora já grava, sem depender do botão', async () => {
    const { onDefinir } = montar()
    await escolherHora('14:00')
    expect(onDefinir).toHaveBeenCalledWith('14:00')
  })

  it('não finge um valor escolhido quando não há nenhum', () => {
    montar()
    // o placeholder aparece; nenhuma hora é exibida como se estivesse definida
    expect(screen.getByRole('combobox').textContent).toMatch(/Escolher hora/i)
    // e o botão não tem o que definir
    expect(screen.getByRole('button', { name: 'Definir' })).toBeDisabled()
  })

  it('com valor já gravado, o Select mostra ELE e o botão volta a valer', () => {
    montar({ atual: '16:30' })
    expect(screen.getByRole('combobox').textContent).toContain('16:30')
    expect(screen.getByRole('button', { name: 'Definir' })).not.toBeDisabled()
  })

  it('o botão continua gravando para quem toca nele', () => {
    const { onDefinir } = montar({ atual: '16:30' })
    fireEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(onDefinir).toHaveBeenCalledWith('16:30')
  })

  it('os atalhos de duração seguem gravando em um toque', () => {
    const { onDefinir } = montar()
    fireEvent.click(screen.getByRole('button', { name: '1h30' }))
    expect(onDefinir).toHaveBeenCalledTimes(1)
    // "agora + 90min" no formato HH:MM — o valor exato depende do relógio
    expect(onDefinir.mock.calls[0][0]).toMatch(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  })

  it('limpar cronômetro só aparece quando há valor, e grava vazio', () => {
    const semValor = montar()
    expect(screen.queryByRole('button', { name: /limpar cronômetro/i })).toBeNull()
    semValor.onDefinir.mockClear()

    const { onDefinir } = montar({ atual: '16:30' })
    fireEvent.click(screen.getByRole('button', { name: /limpar cronômetro/i }))
    expect(onDefinir).toHaveBeenCalledWith('')
  })
})
