/**
 * Consultório não abre opções (dono 29/10/2026, print da Completa com "Consultório" e
 * "Consultório – ajuda"): "ao clicar em consultório não devem aparecer opções, já que o
 * consultório o horário é fixo, manhã das 07:45 às 11:30 e à tarde das 13:30 às 17:00".
 * A linha fica só de leitura; cirurgia comum continua abrindo o detalhe.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CasoCard } from '@/pages/escala-cirurgica/BoardView'

const caso = (id, procedimento, sala = 'Consultório') => ({
  id, sala, ordem: 0, hora: '07:45', procedimento, anestesista: 'RAQUEL', cirurgiao: '',
  turno: 'matutino', bloco: 'normal', tipo: 'eletiva', statusCirurgia: 'agendada',
  isContinuacao: false, semAnestesista: false,
})

describe('consultório na Completa/Minhas: toque não abre nada (dono 29/10)', () => {
  it.each(['CONSULTORIO', 'CONSULTORIO – AJUDA'])('"%s" não é botão e o toque não chama onClick', (proc) => {
    const onClick = vi.fn()
    const { container } = render(<CasoCard caso={caso('c1', proc)} onClick={onClick} moldura="linha" />)
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(container.firstChild)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('cirurgia comum continua abrindo o detalhe', () => {
    const onClick = vi.fn()
    render(<CasoCard caso={caso('c2', 'COLECISTECTOMIA', 'Sala 2')} onClick={onClick} moldura="linha" />)
    fireEvent.click(screen.getByRole('button', { name: /Detalhes do caso/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
