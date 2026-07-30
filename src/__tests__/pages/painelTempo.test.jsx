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
import PainelTempo, { formatFaltante, fraseFaltante } from '@/pages/escala-cirurgica/PainelTempo'

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
  fireEvent.click(combo(/Falta/i))
  fireEvent.click(await screen.findByRole('option', { name: rotulo }))
}
/** Roletas de hora e minuto, escopadas pelo rótulo do bloco (o DS não deixa
 *  acessar o Select por accessible name — aria-labelledby vence aria-label). */
/** Campo de horário mascarado (digita "1830" → "18:30"). */
const campoHora = () => document.querySelector('[data-slot="termino-hora"]')
/** Digita o horário no campo mascarado (grava só quando fica completo). */
const digitarHorario = (hhmm) =>
  fireEvent.change(campoHora(), { target: { value: hhmm.replace(':', '') } })

describe('PainelTempo — duas entradas para o mesmo campo (dono 29/07)', () => {
  it('oferece TEMPO FALTANTE e HORÁRIO DE TÉRMINO, uma ou outra', () => {
    montar()
    expect(combo(/Falta/i)).toBeTruthy()
    // horário virou campo mascarado (mesma máscara do "Adicionar caso")
    expect(campoHora()).toBeTruthy()
  })

  it('hora incompleta NÃO grava — "18:3" no meio da digitação não é um término', () => {
    const { onDefinir } = montar()
    fireEvent.change(campoHora(), { target: { value: '183' } })
    expect(onDefinir).not.toHaveBeenCalled()
    // e hora inválida também não (25:00 não existe)
    fireEvent.change(campoHora(), { target: { value: '2500' } })
    expect(onDefinir).not.toHaveBeenCalled()
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
    digitarHorario('18:30')
    expect(onDefinir).toHaveBeenCalledWith('18:30')
  })

  it('não finge um valor escolhido quando não há nenhum', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Definir' })).toBeDisabled()
    expect(screen.queryByText(/Acaba às/)).toBeNull()
  })

  it('com valor gravado, o campo mostra ELE e o botão volta a valer', () => {
    montar({ atual: '16:30' })
    expect(campoHora().value).toBe('16:30')
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

  it('sem valor, Limpar aparece mas fica DESABILITADO — layout estável', () => {
    // os dois botões vêm lado a lado desde o primeiro render (dono 29/07): layout
    // que muda de forma conforme o estado obriga a reprocurar o botão a cada vez
    montar()
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled()
  })

  it('com valor, Limpar grava vazio', () => {
    const { onDefinir } = montar({ atual: '16:30' })
    const limpar = screen.getByRole('button', { name: 'Limpar' })
    expect(limpar).not.toBeDisabled()
    fireEvent.click(limpar)
    expect(onDefinir).toHaveBeenCalledWith('')
  })
})

/**
 * fraseFaltante — o tempo de UMA cirurgia em palavra, na fila de liberação.
 *
 * O chip com ícone saiu de lá (dono 30/07): o card ficava com DOIS ⏱ lado a lado, um
 * da cirurgia e um da pessoa, e ninguém sabia qual era qual. Em palavra, colada ao
 * cirurgião, a posição diz de quem é e o verbo diz o que é — sem tooltip, que no
 * celular não existe. Consome `formatFaltante` em vez de recalcular: um só lugar
 * decide quanto falta.
 */
describe('fraseFaltante', () => {
  const em = (alvo, agora) => fraseFaltante(formatFaltante(alvo, agora))

  it('no prazo vira "faltam N"', () => {
    expect(em(10 * 60 + 45, 10 * 60)).toBe('faltam 45min')
  })

  it('passou do previsto vira "N além" — sem sinal de mais, que ninguém lê', () => {
    expect(em(10 * 60, 10 * 60 + 12)).toBe('12min além')
  })

  it('acima de uma hora usa h/min, igual à pílula da pessoa', () => {
    expect(em(12 * 60 + 30, 10 * 60)).toBe('faltam 2h30')
    expect(em(11 * 60, 10 * 60)).toBe('faltam 1h00')
  })

  it('sem valor devolve string vazia (não "undefined" na tela)', () => {
    expect(fraseFaltante(null)).toBe('')
    expect(fraseFaltante(undefined)).toBe('')
  })
})
