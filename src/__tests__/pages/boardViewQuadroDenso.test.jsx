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
  // TRÊS LINHAS (dono 17/08): quem+estado / procedimento / quem opera. O
  // procedimento e o cirurgião ganharam linha própria porque viviam truncados
  // disputando espaço com os selos.
  it('separa quem+estado, procedimento e cirurgião em três linhas', () => {
    renderBoard([caso()])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const linhas = card.querySelectorAll(':scope > div > span:last-child > span')
    // 1ª: paciente, idade e os selos de estado
    expect(within(linhas[0]).getByText('D.P.')).toBeTruthy()
    expect(within(linhas[0]).getByText('75a')).toBeTruthy()
    expect(within(linhas[0]).queryByText(/Artroplastia/i)).toBeNull()
    // 2ª: só o procedimento
    expect(linhas[1].textContent).toMatch(/Artroplastia total primária do quadril/i)
    // 3ª: quem opera + o convênio no canto inferior direito
    expect(within(linhas[2]).getByText(/Mauricio Sanagiotto/i)).toBeTruthy()
    expect(within(linhas[2]).getByText('SUS')).toBeTruthy()
  })

  it('badges de estado ficam na linha das iniciais, não na do cirurgião', () => {
    renderBoard([caso({ statusCirurgia: 'iniciada', statusExtra: 'atrasada' })])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const linhas = card.querySelectorAll(':scope > div > span:last-child > span')
    expect(within(linhas[0]).getByText('Iniciada')).toBeTruthy()
    expect(within(linhas[0]).getByText('Atrasada')).toBeTruthy()
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
  it('põe a duração estimada embaixo do horário enquanto ninguém informou o término', () => {
    renderBoard([caso({ tempoEstimado: '02:30' })])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const coluna = card.querySelector(':scope > div > span:first-child')
    expect(within(coluna).getByText('13:30')).toBeTruthy()
    expect(within(coluna).getByText('02:30')).toBeTruthy()
  })

  // A duração é o palpite da escala; o término é o combinado. Mostrar os dois
  // lado a lado era ler palpite e combinado juntos (dono 17/08).
  it('término informado SUBSTITUI a duração sugerida pela escala', () => {
    renderBoard([caso({ tempoEstimado: '02:30', terminoPrevisto: '15:45', statusCirurgia: 'iniciada' })])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const coluna = card.querySelector(':scope > div > span:first-child')
    expect(within(coluna).queryByText('02:30')).toBeNull()
    expect(coluna.textContent).toMatch(/min|h/)
  })

  it('cirurgia agendada mostra a hora de término, não contagem', () => {
    renderBoard([caso({ tempoEstimado: '02:30', terminoPrevisto: '15:45' })])
    expect(screen.getByText('→15:45')).toBeTruthy()
    expect(screen.queryByText(/^~/)).toBeNull()
  })
})

describe('Completa — colunas da direita', () => {
  it('guarda o lugar do estado e do convênio mesmo quando não existem', () => {
    const { container } = render(
      <CasoCard caso={{ ...caso(), convenio: '', statusCirurgia: 'agendada' }} moldura="linha" onClick={() => {}} />,
      { wrapper: wrap },
    )
    const linhas = container.querySelectorAll('button > div > span:last-child > span')
    // canto superior direito (estado) e inferior direito (convênio) seguem no DOM
    // com largura mínima — é o que mantém as duas colunas na mesma vertical
    expect(linhas[0].querySelector('span:last-child > span:last-child').className).toContain('min-w-[76px]')
    expect(linhas[2].querySelector('span:last-child').className).toContain('min-w-[46px]')
  })
})

describe('Completa — caso sem paciente identificado', () => {
  // Bloco de exames, lote de FACO, posição de apoio: a linha de identificação
  // nasceria vazia, com o badge sozinho e um buraco à esquerda (dono 17/08).
  it('sobe o procedimento para a primeira linha e fica com duas linhas', () => {
    renderBoard([caso({ pacienteIniciais: '', idade: '', procedimento: '06 EDA + 05 COLO (08 pctes)', statusCirurgia: 'terminada' })])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    const linhas = card.querySelectorAll(':scope > div > span:last-child > span')
    expect(linhas).toHaveLength(2)
    expect(linhas[0].textContent).toMatch(/06 EDA \+ 05 COLO/)
    expect(within(linhas[0]).getByText('Terminada')).toBeTruthy()
    expect(within(linhas[1]).getByText(/Mauricio Sanagiotto/i)).toBeTruthy()
  })

  it('com paciente, o procedimento continua na própria linha', () => {
    renderBoard([caso()])
    const card = screen.getByRole('button', { name: /^Detalhes do caso/ })
    expect(card.querySelectorAll(':scope > div > span:last-child > span')).toHaveLength(3)
  })
})
