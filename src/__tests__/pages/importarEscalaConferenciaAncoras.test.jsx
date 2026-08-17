/**
 * CONFERÊNCIA — três destinos numa rolagem só (desenho escolhido pelo dono em
 * 17/08, protótipo "F · âncoras").
 *
 * Blocos, Liberações e Pendências deixaram de estar espalhados pela página: a
 * barra fixa leva até cada seção — ROLANDO, não trocando de aba, porque bloco e
 * fila precisam poder ser lidos na mesma passada — e o que impede publicar fica
 * contado numa faixa que não sai da tela.
 *
 * O que este teste protege:
 *  · os três atalhos com as contagens certas;
 *  · a fila em DUAS COLUNAS correndo para baixo e SEM o número de casos por
 *    pessoa (o número confundia — dono 17/08), mantendo o ponto âmbar de quem
 *    está na ordem sem cirurgia nenhuma;
 *  · o editor da posição abrindo FORA das colunas (numa coluna de ~200px os
 *    quatro botões não cabem);
 *  · os avisos todos dentro da seção Pendências.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, prepararImagem } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: [] })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3 })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscala }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false, rosterByUid: new Map(), options: [],
    resolver: () => null, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const CASOS = [
  { sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' },
  { sala: 'SALA 2', hora: '08:30', procedimento: 'Colecistectomia', cirurgiao: 'Dirceu', anestesista: 'ERLEI' },
]
// FERNANDO está na ordem sem nenhuma cirurgia — é o detector da extração torta
const RODAPE = ['CURY', 'ERLEI', 'FERNANDO']

async function conferir(casos = CASOS, ordemLiberacao = RODAPE) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos, ordemLiberacao, ajudaExterna: [] })
  const { container } = render(
    <ImportarEscalaPage hospital="unimed" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap },
  )
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] },
  })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  await screen.findByRole('heading', { name: /Blocos por anestesista/i })
  return container
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

describe('Conferência — barra de âncoras', () => {
  it('leva às três seções, com as contagens do lote', async () => {
    await conferir()
    const barra = screen.getByRole('navigation', { name: /Seções da conferência/i })
    const atalho = (nome) => within(barra).getByRole('button', { name: new RegExp(nome, 'i') })
    expect(atalho('Blocos').textContent).toMatch(/2/)        // 2 blocos
    expect(atalho('Liberações').textContent).toMatch(/3/)    // 3 nomes na ordem
    expect(atalho('Pendências')).toBeTruthy()
    // as seções existem para onde os atalhos rolam
    for (const id of ['conf-blocos', 'conf-liberacoes', 'conf-pendencias']) {
      expect(document.getElementById(id)).toBeTruthy()
    }
  })

  it('soma os avisos no atalho e NÃO acende a faixa de bloqueio', async () => {
    await conferir()
    const barra = screen.getByRole('navigation', { name: /Seções da conferência/i })
    // 1 nome na ordem sem cirurgia + 2 blocos ainda sem login atribuído
    expect(within(barra).getByRole('button', { name: /Pendências/i }).textContent).toMatch(/3/)
    // aviso não trava publicar: a faixa vermelha só aparece com bloqueio de verdade
    // (nome ambíguo ou duplicidade entre hospitais não classificada)
    expect(screen.queryByText(/impede[m]? publicar/i)).toBeNull()
  })
})

describe('Conferência — fila em duas colunas', () => {
  it('corre em coluna e não mostra contagem de casos por pessoa', async () => {
    const container = await conferir()
    const lista = container.querySelector('#conf-liberacoes ul')
    expect(lista.className).toContain('columns-2')
    const itens = [...lista.querySelectorAll('li')]
    expect(itens).toHaveLength(3)
    for (const li of itens) expect(li.textContent).not.toMatch(/caso/)
  })

  it('marca com o ponto âmbar quem está na ordem sem nenhuma cirurgia', async () => {
    const container = await conferir()
    const linhaDe = (nome) => within(container.querySelector('#conf-liberacoes')).getByText(nome).closest('li')
    expect(linhaDe('FERNANDO').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeTruthy()
    expect(linhaDe('CURY').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeNull()
  })

  it('abre o editor da posição FORA das colunas, com os quatro botões', async () => {
    const container = await conferir()
    const secao = container.querySelector('#conf-liberacoes')
    fireEvent.click(within(secao).getByText('CURY'))
    const editor = await screen.findByText(/^Posição 1$/i)
    // o editor é irmão da lista, não filho de um <li> dela
    expect(editor.closest('li')).toBeNull()
    for (const nome of ['Subir', 'Descer', 'Ajuda', 'Remover']) {
      expect(within(editor.parentElement).getByRole('button', { name: new RegExp(nome, 'i') })).toBeTruthy()
    }
  })
})

describe('Conferência — pendências num lugar só', () => {
  it('o porquê do nome sem cirurgia mora na seção Pendências', async () => {
    const container = await conferir()
    const pend = container.querySelector('#conf-pendencias')
    expect(within(pend).getByText(/confira a extração/i)).toBeTruthy()
    // o campo de ajuda (que resolve o caso mais comum) fica na mesma seção
    expect(within(pend).getByText(/Ajuda de outro hospital/i)).toBeTruthy()
  })

  it('some com o aviso do nome sem cirurgia quando a ordem casa com os casos', async () => {
    const container = await conferir(CASOS, ['CURY', 'ERLEI'])
    const pend = container.querySelector('#conf-pendencias')
    expect(within(pend).queryByText(/confira a extração/i)).toBeNull()
    // o campo de ajuda continua ali — é a seção dele
    expect(within(pend).getByText(/Ajuda de outro hospital/i)).toBeTruthy()
  })
})

describe('Conferência — botão de publicar', () => {
  it('mostra quantos casos vão ser publicados', async () => {
    await conferir()
    expect(screen.getByRole('button', { name: /Publicar 2 casos/i })).toBeTruthy()
  })
})
