/**
 * OS TEMPOS SEM DÚVIDA — vocabulário e desenho únicos (dono 10/11/2026, modelo A de
 * `.tmp/analise-escala-2026-11/modelos-2/a-quatro-folhas.html`: "Sim, aprovo").
 *
 *   Início / Término = horário real · Tempo estimado = previsão da cirurgia (duração antes de
 *   começar, horário de fim depois) · Tempo total = até quando a pessoa fica · mapa 1h30 =
 *   duração escrita no mapa.
 *
 * Aqui ficam as travas da FONTE ÚNICA (`TemposCirurgia.jsx`): a frase do quadro e da fila, as
 * três casas, a faixa do tempo total e a leitura do tempo total de onde a fila lê.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  CasasCirurgia, TempoTotalPessoa, fraseTempoEstimado, rotuloDoMapa, tempoEstimadoDe, tempoTotalDaPessoa,
} from '@/pages/escala-cirurgica/TemposCirurgia'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'

const caso = (extra = {}) => ({
  id: 'c1', sala: 'Sala 2', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'FERNANDA',
  anestesistaUserId: 'uid-fer', cirurgiao: 'Renato Sá', procedimento: 'COLECISTECTOMIA',
  semAnestesista: false, statusCirurgia: 'agendada', ...extra,
})
const AGORA = 8 * 60 + 45 // 08:45

describe('a frase única do quadro e da fila', () => {
  it('em andamento: "Tempo estimado 09:30 · faltam 45min"', () => {
    expect(fraseTempoEstimado(caso({ statusCirurgia: 'iniciada', terminoPrevisto: '09:30' }), AGORA))
      .toEqual({ rotulo: 'Tempo estimado 09:30', detalhe: 'faltam 45min', atrasada: false, mapa: false })
  })
  it('em andamento e passou: "… · 15min além", marcado como atrasada', () => {
    expect(fraseTempoEstimado(caso({ statusCirurgia: 'iniciada', terminoPrevisto: '08:30' }), AGORA))
      .toMatchObject({ rotulo: 'Tempo estimado 08:30', detalhe: '15min além', atrasada: true })
  })
  it('ainda não começou, com duração: "Tempo estimado 1h · não começou" — sem contagem', () => {
    expect(fraseTempoEstimado(caso({ duracaoEstimadaMin: 60 }), AGORA))
      .toMatchObject({ rotulo: 'Tempo estimado 1h', detalhe: 'não começou', atrasada: false })
  })
  it('a linha enxuta da fila (`andamento`, sem statusCirurgia) dá a mesma frase', () => {
    expect(fraseTempoEstimado({ andamento: true, terminoPrevisto: '09:30' }, AGORA).detalhe).toBe('faltam 45min')
    expect(fraseTempoEstimado({ andamento: false, duracaoEstimadaMin: 90 }, AGORA).rotulo).toBe('Tempo estimado 1h30')
  })
  it('sem estimado, a duração do mapa: "mapa 1h30" — e some quando há estimado ou a cirurgia terminou', () => {
    expect(fraseTempoEstimado(caso({ tempoEstimado: '01:30' }), AGORA)).toMatchObject({ rotulo: 'mapa 1h30', mapa: true })
    expect(fraseTempoEstimado(caso({ tempoEstimado: '01:30', duracaoEstimadaMin: 60 }), AGORA).mapa).toBe(false)
    expect(fraseTempoEstimado(caso({ tempoEstimado: '01:30', statusCirurgia: 'terminada' }), AGORA)).toBeNull()
    expect(rotuloDoMapa('00:45')).toBe('45min')
    expect(rotuloDoMapa('2H')).toBe('2H')
  })
  it('terminada não tem tempo estimado', () => {
    expect(tempoEstimadoDe(caso({ statusCirurgia: 'terminada', terminoPrevisto: '09:30' }), AGORA).valor).toBe('')
  })
})

describe('as três casas são SEMPRE de uma cirurgia', () => {
  const casas = () => [...document.querySelectorAll('[data-casa]')].map((n) => n.textContent)

  it('vazio é "—" com "ainda não informado", nas três', () => {
    render(<CasasCirurgia caso={caso()} agoraMin={AGORA} />)
    expect(casas()).toEqual(['Início—ainda não informado', 'Tempo estimado—ainda não informado', 'Término—ainda não informado'])
  })
  it('em andamento: início "há X", tempo estimado "faltam X"', () => {
    render(<CasasCirurgia caso={caso({ statusCirurgia: 'iniciada', inicioReal: '07:10', terminoPrevisto: '09:30' })} agoraMin={AGORA} />)
    expect(casas()).toEqual(['Início07:10há 1h35', 'Tempo estimado09:30faltam 45min', 'Término—ainda não informado'])
  })
  it('terminada: término "durou X"; o tempo estimado deixa de ser botão', () => {
    const onEstimado = vi.fn()
    render(<CasasCirurgia caso={caso({ statusCirurgia: 'terminada', inicioReal: '07:10', terminoReal: '08:27' })} agoraMin={AGORA}
      nomes={{ inicio: 'Início', estimado: 'Tempo estimado', termino: 'Término' }} onInicio={() => {}} onEstimado={onEstimado} onTermino={() => {}} />)
    expect(casas()[2]).toBe('Término08:27durou 1h17')
    expect(screen.queryByRole('button', { name: /^Tempo estimado/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Término: 08:27' })).toBeTruthy()
  })
  it('só leitura sem handlers; com handler cada casa é um botão de 64px (alvo ≥ 44px)', () => {
    const { unmount } = render(<CasasCirurgia caso={caso()} agoraMin={AGORA} />)
    expect(screen.queryByRole('button')).toBeNull()
    unmount()
    const onInicio = vi.fn()
    render(<CasasCirurgia caso={caso()} agoraMin={AGORA} nomes={{ inicio: 'Início de X' }} onInicio={onInicio} />)
    const b = screen.getByRole('button', { name: 'Início de X: não informado' })
    expect(b.className).toContain('min-h-[64px]')
    fireEvent.click(b)
    expect(onInicio).toHaveBeenCalled()
  })
})

describe('o tempo total é da PESSOA: outro desenho, com o nome dela', () => {
  it('"Tempo total de Fernanda · fica até 11:40", e o botão tem nome próprio', () => {
    const onClick = vi.fn()
    render(<TempoTotalPessoa nome="Fernanda Guedes" termino="11:40" sub="3º do HRO · 2 cirurgias" acao={{ label: 'Fila', onClick, nomeAcessivel: 'Ver Fernanda na fila' }} />)
    expect(document.querySelector('[data-tempo-total]').textContent).toBe('Tempo total de Fernandafica até 11:403º do HRO · 2 cirurgiasFila')
    fireEvent.click(screen.getByRole('button', { name: 'Ver Fernanda na fila' }))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('tempoTotalDaPessoa lê de onde a fila lê', () => {
  it('dia útil: a linha do turno na escala do hospital, com o nº de cirurgias abertas', () => {
    const c = caso({ statusCirurgia: 'iniciada' })
    const esc = { id: 'e', hospital: 'hro', data: '2026-11-10', casos: [c, caso({ id: 'c2', hora: '09:00' }), caso({ id: 'c3', statusCirurgia: 'terminada' })], linhaOverrides: { 'matutino:uid-fer': { termino: '11:40' } } }
    expect(tempoTotalDaPessoa(esc, c)).toMatchObject({ termino: '11:40', cirurgias: 2, turno: 'matutino' })
  })
  it('fila única (sábado com a linha "fds" publicada): lê a linha "fds" e conta os três hospitais', () => {
    const c = caso({ statusCirurgia: 'iniciada' })
    const hro = { id: 'e', hospital: 'hro', data: '2026-11-07', casos: [c], linhaOverrides: { 'matutino:uid-fer': { termino: '09:00' } } }
    const escalas = {
      hro,
      unimed: { id: 'u', hospital: 'unimed', data: '2026-11-07', casos: [caso({ id: 'u1', sala: 'CC - Sala 1' })] },
      fds: { id: 'f', hospital: 'fds', status: 'publicada', data: '2026-11-07', casos: [], linhaOverrides: { 'matutino:uid-fer': { termino: '12:10' } } },
    }
    expect(tempoTotalDaPessoa(hro, c, escalas)).toMatchObject({ termino: '12:10', cirurgias: 2 })
  })
  it('dupla "A + B" e caso sem anestesista: null (não há uma linha só)', () => {
    const esc = { id: 'e', hospital: 'hro', casos: [], linhaOverrides: {} }
    expect(tempoTotalDaPessoa(esc, caso({ anestesista: 'A + B', anestesistaUserId: null }))).toBeNull()
    expect(tempoTotalDaPessoa(esc, caso({ anestesista: '?', semAnestesista: true }))).toBeNull()
  })
})

// "N de M com tempo estimado" conta CIRURGIAS (era "N com término informado", que contava
// cirurgiões com horário: duas do mesmo cirurgião valiam 1 e a duração estimada valia 0).
describe('colunaLiberacao.casosComEstimado conta cirurgias, horário ou duração', () => {
  const linhaDe = (casos) => gerarColunaLiberacao(casos, ['FERNANDA'], { hospital: 'HRO' }).linhas.find((l) => l.casosAtivos === casos.length)
  it('duas do MESMO cirurgião com horário → 2 (o antigo dizia 1)', () => {
    const l = linhaDe([caso({ statusCirurgia: 'iniciada', terminoPrevisto: '10:00' }), caso({ id: 'c2', hora: '10:30', statusCirurgia: 'iniciada', terminoPrevisto: '12:00' })])
    expect(l.casosComEstimado).toBe(2)
    expect(l.casosComTermino).toBe(1)
  })
  it('uma com duração e outra sem nada → 1 de 2 (o antigo dizia 0)', () => {
    const l = linhaDe([caso({ duracaoEstimadaMin: 60 }), caso({ id: 'c2', hora: '10:30', cirurgiao: 'Outro' })])
    expect(l.casosComEstimado).toBe(1)
    expect(l.casosComTermino).toBe(0)
  })
})
