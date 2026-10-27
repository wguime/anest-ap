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
 *
 * REDESENHO 17/08 ("Alternador segmentado", escolhido em protótipo): o "ou"
 * virou a própria escolha — as duas rotas não convivem mais na tela, e o botão
 * "Definir" saiu por ser morto no caminho comum (atalho, seletor e campo já
 * gravam). "Falta" virou "Tempo faltante", as duas correções que o dono pediu
 * antes de comparar as propostas.
 *
 * REVISÃO 02/10 (dono, aprovada em protótipo `.tmp/horario-compacto.html`): "quero que
 * a primeira opção que aparece é de horário de término" — o painel abre SEMPRE no
 * horário (antes, vazio, nascia na duração); a duração virou grade 4×2 (15min a 3h +
 * "Outro" na 8ª casa), o "Limpar" foi para a linha da prévia e a frase "Dois jeitos de
 * dizer a mesma coisa" saiu ("aproveite melhor os espaços"). As travas de GRAVAÇÃO
 * abaixo são as mesmas; o que mudou é o caminho (um toque na aba "Tempo faltante").
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider } from '@/design-system'
import PainelTempo, { formatFaltante, fraseCronometro, fraseFaltante } from '@/pages/escala-cirurgica/PainelTempo'

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
  fireEvent.click(combo(/Outro/i))
  fireEvent.click(await screen.findByRole('option', { name: rotulo }))
}
/** Campo de horário mascarado (digita "1830" → "18:30"). */
const campoHora = () => document.querySelector('[data-slot="termino-hora"]')
/** Digita o horário no campo mascarado (grava só quando fica completo). */
const digitarHorario = (hhmm) =>
  fireEvent.change(campoHora(), { target: { value: hhmm.replace(':', '') } })

// MUDOU DE LADO em 27/10 (dono, Modelo 2 da 4ª rodada de `.tmp/horarios-auditoria/`): "Horário
// de término" e "Tempo faltante" UM ACIMA DO OUTRO, os dois à vista — o alternador de 17/08 e o
// "abre sempre no horário" de 02/10 saíram. As travas de GRAVAÇÃO são as mesmas.
describe('PainelTempo — os dois caminhos à vista, qualquer um grava (dono 27/10)', () => {
  it('campo do horário em cima e a grade 4×2 de durações logo abaixo, sem alternador', () => {
    montar()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(campoHora()).toBeTruthy()
    expect(screen.getByText('ou daqui a')).toBeTruthy()
    for (const rot of ['15min', '30min', '45min', '1h', '1h30', '2h', '3h']) {
      expect(screen.getByRole('button', { name: rot })).toBeTruthy()
    }
    expect(combo(/Outro/)).toBeTruthy()
  })

  it('os atalhos gravam em UM toque (é o caminho do meio do plantão)', () => {
    const { onDefinir } = montar()
    fireEvent.click(screen.getByRole('button', { name: '1h30' }))
    expect(onDefinir).toHaveBeenCalledTimes(1)
    expect(onDefinir.mock.calls[0][0]).toMatch(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    expect(onDefinir.mock.calls[0][1]).toEqual({ minutos: 90 })
  })

  it('com valor gravado, o próprio campo mostra o horário (e quanto falta ao lado)', () => {
    montar({ atual: '16:30' })
    expect(campoHora().value).toBe('16:30')
    expect(screen.getByText(/^faltam |além$/)).toBeTruthy()
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
    await escolherDuracao('1h15')
    expect(onDefinir).toHaveBeenCalledTimes(1)
    // o banco guarda "HH:MM": duração salva envelheceria sozinha, hora não
    expect(onDefinir.mock.calls[0][0]).toMatch(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  })

  it('escolher o horário grava exatamente ele', () => {
    const { onDefinir } = montar()
    digitarHorario('18:30')
    expect(onDefinir).toHaveBeenCalledWith('18:30')
  })

  it('não finge um valor escolhido quando não há nenhum: campo "--:--" e sem "Limpar"', () => {
    montar()
    expect(campoHora().value).toBe('')
    expect(campoHora().getAttribute('placeholder')).toBe('--:--')
    expect(screen.getByText('Sem tempo informado.')).toBeTruthy()
    // 27/10: sem valor o "Limpar" não aparece (era o "Limpar morto" da auditoria)
    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull()
  })

  it('"Definir" saiu — era botão morto (a escolha já grava)', () => {
    montar({ atual: '16:30' })
    expect(screen.queryByRole('button', { name: 'Definir' })).toBeNull()
  })

  it('com valor, Limpar grava vazio', () => {
    const { onDefinir } = montar({ atual: '16:30' })
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onDefinir).toHaveBeenCalledWith('')
  })
})

describe('PainelTempo soDuracao — o estimado da cirurgia que ainda não começou (dono 27/10)', () => {
  const montarDur = (props = {}) => {
    const onDefinir = vi.fn()
    render(<PainelTempo soDuracao duracaoAtual={null} onDefinir={onDefinir} {...props} />, { wrapper: wrap })
    return { onDefinir }
  }

  it('só durações (sem campo de horário); o toque grava a DURAÇÃO, não um horário', () => {
    const { onDefinir } = montarDur()
    expect(campoHora()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '2h' }))
    expect(onDefinir).toHaveBeenCalledWith(null, { minutos: 120 })
  })

  it('a duração gravada aparece marcada, com o exemplo e o Limpar', () => {
    const { onDefinir } = montarDur({ duracaoAtual: 120, exemploDuracao: (min) => `Se começar às 16:00, termina às ${min === 120 ? '18:00' : '?'}.` })
    expect(screen.getByRole('button', { name: '2h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Se começar às 16:00, termina às 18:00.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onDefinir).toHaveBeenCalledWith('', { minutos: null })
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

  // A pílula do total da pessoa é assimétrica de propósito (dono 18/08): curta
  // enquanto falta, por palavra quando passa — um delta solto ("+25min") não diz
  // de que horário fala nem se falta ou já passou.
  it('a pílula do total troca o sinal por palavra só quando estoura', () => {
    // SEM O "~" desde 24/08 (dono, olhando a tela em uso): a pílula mostra o
    // número seco. A assimetria de 18/08 continua — o que muda quando estoura é
    // a PALAVRA, e é ela que carrega o significado, não um sinal.
    expect(fraseCronometro(15 * 60, 14 * 60 + 15)).toBe('45min')
    expect(fraseCronometro(14 * 60, 14 * 60 + 25)).toBe('25min além')
    expect(fraseCronometro(14 * 60, 12 * 60)).toBe('2h00')
    expect(fraseCronometro(12 * 60, 14 * 60 + 10)).toBe('2h10 além')
    // e o til NÃO saiu de `formatFaltante`, que é compartilhado: a coluna de
    // tempo do quadro da Completa (desenho de 18/08) segue como está.
    expect(formatFaltante(15 * 60, 14 * 60 + 15).texto).toBe('~45min')
  })

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
