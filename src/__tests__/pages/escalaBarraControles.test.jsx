/**
 * Barra de controles da Escala Cirúrgica — desenho "Compacta · Verde suave"
 * (dono 16/08, escolhido depois de comparar 17 protótipos).
 *
 * Trava o que a escolha decidiu e o que já era regra:
 *  1. TODOS os controles visíveis — turno, hospital e abas sempre na tela
 *     (o dono exigiu: "os controles precisam estar visíveis"), e o hospital
 *     visível também na aba Liberações do fim de semana (regressão de 16/08);
 *  2. o botão "Hoje" só aparece quando há escolha de data (Hoje + Amanhã) —
 *     sozinho ele não informava nada;
 *  3. a data virou o SUBTÍTULO do cabeçalho, no lugar de "hospital · turno";
 *  4. altura mínima de 34px nos filtros — piso adotado para o toque no
 *     centro cirúrgico.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BarraControles from '@/pages/escala-cirurgica/BarraControles'
import { dataPorExtenso } from '@/pages/escala-cirurgica/utils'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const TURNOS = [
  { value: 'matutino', label: 'Manhã' },
  { value: 'vespertino', label: 'Tarde' },
  { value: 'noturno', label: 'Noite' },
]
const HOSPITAIS = [
  { value: 'unimed', label: 'Unimed' },
  { value: 'hro', label: 'HRO' },
  { value: 'materno', label: 'Materno' },
]
const ABAS = [
  { value: 'minhas', label: 'Minhas' },
  { value: 'board', label: 'Completa' },
  { value: 'liberacoes', label: 'Liberações' },
]

const montar = (props = {}) => render(
  <BarraControles
    opcoesData={[{ value: 'hoje', label: 'Hoje' }]}
    modoData="hoje"
    onEscolherData={() => {}}
    turnoOpcoes={TURNOS}
    turno="vespertino"
    onEscolherTurno={() => {}}
    hospitalOpcoes={HOSPITAIS}
    hospital="unimed"
    onEscolherHospital={() => {}}
    abaOpcoes={ABAS}
    aba="liberacoes"
    onEscolherAba={() => {}}
    {...props}
  />,
  { wrapper: wrap }
)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('todos os controles visíveis (regra do dono)', () => {
  it('turno, hospital e abas aparecem juntos na tela', () => {
    montar()
    for (const nome of ['Manhã', 'Tarde', 'Noite', 'Unimed', 'HRO', 'Materno', 'Minhas', 'Completa', 'Liberações']) {
      expect(screen.getByRole('tab', { name: nome })).toBeTruthy()
    }
  })

  it('o selecionado de cada eixo fica marcado (aria-selected)', () => {
    montar()
    expect(screen.getByRole('tab', { name: 'Tarde' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Unimed' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Liberações' }).getAttribute('aria-selected')).toBe('true')
  })

  it('cada eixo dispara o seu próprio callback', () => {
    const onEscolherTurno = vi.fn()
    const onEscolherHospital = vi.fn()
    const onEscolherAba = vi.fn()
    montar({ onEscolherTurno, onEscolherHospital, onEscolherAba })
    fireEvent.click(screen.getByRole('tab', { name: 'Noite' }))
    fireEvent.click(screen.getByRole('tab', { name: 'HRO' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Completa' }))
    expect(onEscolherTurno).toHaveBeenCalledWith('noturno')
    expect(onEscolherHospital).toHaveBeenCalledWith('hro')
    expect(onEscolherAba).toHaveBeenCalledWith('board')
  })
})

describe('botão de data (dono 16/08)', () => {
  it('some quando só existe "Hoje" — sozinho não é escolha', () => {
    montar()
    expect(screen.queryByRole('tab', { name: 'Hoje' })).toBeNull()
  })

  it('volta quando a escala de amanhã está publicada', () => {
    montar({ opcoesData: [{ value: 'hoje', label: 'Hoje' }, { value: 'amanha', label: 'Amanhã' }] })
    expect(screen.getByRole('tab', { name: 'Hoje' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Amanhã' })).toBeTruthy()
  })
})

describe('desenho escolhido — Compacta · Verde suave', () => {
  it('filtros com 34px de altura mínima (piso de toque adotado)', () => {
    montar()
    for (const nome of ['Tarde', 'Unimed']) {
      expect(screen.getByRole('tab', { name: nome }).className).toContain('min-h-[34px]')
    }
  })

  it('turno e hospital têm a MESMA altura (pedido do dono)', () => {
    montar()
    const alturaDe = (nome) => (screen.getByRole('tab', { name: nome }).className.match(/min-h-\[(\d+)px\]/) || [])[1]
    expect(alturaDe('Tarde')).toBe(alturaDe('Unimed'))
  })

  it('o ativo usa a tinta translúcida do verde, não o verde sólido das abas', () => {
    montar()
    expect(screen.getByRole('tab', { name: 'Tarde' }).className).toContain('bg-primary/20')
    // as abas seguem no verde sólido — é o que separa "o que vejo" de "o que filtro"
    expect(screen.getByRole('tab', { name: 'Liberações' }).className).toContain('bg-primary')
  })
})

describe('data no subtítulo do cabeçalho', () => {
  it('dia da semana + data curta, com prefixo de hoje/amanhã', () => {
    expect(dataPorExtenso('2026-08-16', '2026-08-16')).toBe('Hoje · Domingo, 16/08')
    expect(dataPorExtenso('2026-08-17', '2026-08-16')).toBe('Amanhã · Segunda, 17/08')
    expect(dataPorExtenso('2026-08-22', '2026-08-16')).toBe('Sábado, 22/08')
  })

  it('sem data → string vazia (nunca "Invalid Date" no cabeçalho)', () => {
    expect(dataPorExtenso('')).toBe('')
    expect(dataPorExtenso(null)).toBe('')
    expect(dataPorExtenso('xx-xx')).toBe('')
  })
})
