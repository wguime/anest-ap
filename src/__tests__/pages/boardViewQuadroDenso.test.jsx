/**
 * Aba Completa — quadro denso (desenho escolhido pelo dono em 17/08, depois de
 * comparar protótipos a 430px).
 *
 * O que este teste protege:
 *  1. ARRANJO do caso: hora numa coluna com o término abaixo (→15:45), iniciais ·
 *     idade · PROCEDIMENTO na primeira linha e o cirurgião na segunda. Foi a
 *     terceira tentativa até fechar; voltar os selos para a primeira linha é
 *     exatamente o que o dono recusou.
 *  2. TINTA em UM eixo só: iniciada pinta de verde, terminada de azul, ambas
 *     suaves. Atrasada, suspensa e passa-para-tarde continuam existindo, mas só
 *     no badge — com os cinco pintando, o quadro virava vitral.
 *  3. Cabeçalho da sala com pill + anestesista + contagem, e a sala colapsável.
 *  4. O `aria-label` do caso ("Detalhes do caso, …") segue de pé: a aba Minhas
 *     abre o detalhe por ele (minhasEscalasCardCompleto.test.jsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BoardView, { CasoCard } from '@/pages/escala-cirurgica/BoardView'

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    atualizarCaso: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
  }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-melo', role: 'anestesiologista', displayName: 'Melo' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [], rosterByUid: new Map(), resolver: () => null, loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (over = {}) => ({
  id: 'c1', sala: 'Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino',
  pacienteIniciais: 'D.P.', idade: '75a', procedimento: 'ARTROPLASTIA TOTAL PRIMÁRIA DO QUADRIL',
  cirurgiao: 'MAURICIO SANAGIOTTO', anestesista: 'GABRIEL', convenio: 'SUS',
  statusCirurgia: 'agendada', ...over,
})
const escalaCom = (casos) => ({ id: 'e1', hospital: 'hro', data: '2026-06-26', ajudaExterna: {}, casos })

const renderBoard = (casos) => render(
  <BoardView escala={escalaCom(casos)} meuAlias="MELO" meuUid="uid-melo" turno="vespertino" />,
  { wrapper: wrap },
)

describe('Completa — arranjo do caso', () => {
  it('põe iniciais, idade e procedimento na MESMA linha, e o cirurgião na de baixo', () => {
    renderBoard([caso()])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const linhas = card.querySelectorAll(':scope > div > span:last-child > span')
    // primeira linha: quem + qual cirurgia
    expect(within(linhas[0]).getByText('D.P.')).toBeTruthy()
    expect(within(linhas[0]).getByText('75a')).toBeTruthy()
    expect(within(linhas[0]).getByText(/Artroplastia total primária do quadril/i)).toBeTruthy()
    // segunda linha: quem opera
    expect(within(linhas[1]).getByText(/Mauricio Sanagiotto/i)).toBeTruthy()
    expect(within(linhas[1]).getByText('SUS')).toBeTruthy()
  })

  it('mostra o término previsto embaixo da hora, com a seta', () => {
    renderBoard([caso({ terminoPrevisto: '15:45' })])
    expect(screen.getByText('13:30')).toBeTruthy()
    expect(screen.getByText('→15:45')).toBeTruthy()
  })

  it('escreve o residente como "· R: nome" ao lado do cirurgião', () => {
    renderBoard([caso({ residente: 'MARINA' })])
    expect(screen.getByText('· R: Marina')).toBeTruthy()
  })

  it('mantém o aria-label de que a aba Minhas depende', () => {
    renderBoard([caso()])
    expect(screen.getByRole('button', { name: /^Detalhes do caso, 13:30, D\.P\./ })).toBeTruthy()
  })
})

describe('Completa — tinta em um eixo só', () => {
  const classeDoCaso = (over) => {
    const { container } = render(
      <CasoCard caso={caso(over)} moldura="linha" onClick={() => {}} agoraMin={13 * 60} />,
      { wrapper: wrap },
    )
    return container.querySelector('button').className
  }

  it('pinta iniciada de verde e terminada de azul, em tinta suave', () => {
    expect(classeDoCaso({ statusCirurgia: 'iniciada' })).toContain('bg-success/[0.14]')
    expect(classeDoCaso({ statusCirurgia: 'terminada' })).toContain('bg-info/[0.12]')
  })

  it('NÃO pinta atrasada, suspensa nem passa-para-tarde — elas ficam no badge', () => {
    for (const statusExtra of ['atrasada', 'suspensa', 'passa_tarde']) {
      const cls = classeDoCaso({ statusExtra })
      expect(cls).not.toContain('bg-success')
      expect(cls).not.toContain('bg-info')
      expect(cls).not.toContain('bg-warning')
      expect(cls).not.toContain('bg-destructive')
      expect(cls).toContain('bg-card')
    }
    render(<CasoCard caso={caso({ statusExtra: 'suspensa' })} moldura="linha" onClick={() => {}} />, { wrapper: wrap })
    expect(screen.getAllByText('Suspensa').length).toBeGreaterThan(0)
  })

  it('o extra convive com a cirurgia iniciada: verde no card + badge âmbar', () => {
    const cls = classeDoCaso({ statusCirurgia: 'iniciada', statusExtra: 'atrasada' })
    expect(cls).toContain('bg-success/[0.14]')
    expect(screen.getAllByText('Atrasada').length).toBeGreaterThan(0)
  })
})

describe('Completa — cabeçalho da sala', () => {
  it('traz sala, anestesista e a contagem de casos, e é colapsável', () => {
    renderBoard([caso(), caso({ id: 'c2', hora: '15:00', pacienteIniciais: 'T.T.' })])
    expect(screen.getByText('Sala 2')).toBeTruthy()
    expect(screen.getByText('Gabriel')).toBeTruthy()
    // tinta do cabeçalho (dono 17/08): o badge repete a receita do seletor ATIVO
    // (primary/20 + texto primary) e o nome usa a MESMA cor do texto do badge —
    // o verde sólido pesava demais numa lista de 12 salas
    expect(screen.getByText('Sala 2').className).toContain('bg-primary/20')
    expect(screen.getByText('Sala 2').className).toContain('text-primary')
    expect(screen.getByText('Gabriel').className).toContain('text-primary')
    expect(screen.getByText('2')).toBeTruthy()
    // o Accordion do DS entrega o botão de recolher/expandir da seção
    expect(screen.getByRole('button', { name: /Recolher seção/i })).toBeTruthy()
  })

  it('sala com dois anestesistas diferentes rende um cabeçalho por anestesista', () => {
    renderBoard([
      caso({ id: 'a', sala: 'IOSC', anestesista: 'ROBERTA', cirurgiao: 'RAFAEL' }),
      caso({ id: 'b', sala: 'IOSC', anestesista: 'MAURICIO', cirurgiao: 'MARCO ANTONIO' }),
    ])
    expect(screen.getAllByText('IOSC')).toHaveLength(2)
    expect(screen.getByText('Roberta')).toBeTruthy()
    expect(screen.getByText('Mauricio')).toBeTruthy()
  })
})

describe('Completa — coluna do tempo', () => {
  it('põe a duração estimada e o tempo faltante embaixo do horário', () => {
    renderBoard([caso({ tempoEstimado: '02:30', terminoPrevisto: '15:45', statusCirurgia: 'iniciada' })])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const coluna = card.querySelector(':scope > div > span:first-child')
    // hora, duração e o que falta — os três na MESMA coluna (dono 17/08)
    expect(within(coluna).getByText('13:30')).toBeTruthy()
    expect(within(coluna).getByText('02:30')).toBeTruthy()
    expect(coluna.textContent).toMatch(/min|h/)
  })

  it('cirurgia agendada mostra a hora de término, não contagem', () => {
    renderBoard([caso({ tempoEstimado: '02:30', terminoPrevisto: '15:45' })])
    expect(screen.getByText('→15:45')).toBeTruthy()
    expect(screen.queryByText(/^~/)).toBeNull()
  })
})
