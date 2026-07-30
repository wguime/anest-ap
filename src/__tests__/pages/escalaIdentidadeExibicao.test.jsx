/**
 * Identidade do anestesista na tela — UMA fonte, não duas.
 *
 * Bug de 29/07: o cabeçalho da sala na Completa mostrava o nome do CADASTRO
 * (`rosterByUid` → nomeCirurgiaoCurto) e o "Responsável atual" do sheet de
 * definir mostrava o texto IMPORTADO do caso (titleCaseNome). Divergem sempre
 * que o texto da escala ≠ nome do cadastro, que é o caso NORMAL — "STAUB" na
 * escala, "Guilherme Staub" no cadastro. Quem lê vê duas pessoas onde há uma.
 *
 * Agora as duas telas chamam `nomeAnestesistaExibicao`. O teste cobre a lib e o
 * contrato das duas telas, incluindo bloco multi-anestesista (IOSC), onde a
 * identidade tem de ser a do GRUPO tocado e não "a primeira da sala".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import { nomeAnestesistaExibicao } from '@/pages/escala-cirurgica/utils'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const ROSTER = new Map([
  ['uid-staub', { uid: 'uid-staub', nome: 'GUILHERME STAUB', apelidos: ['STAUB'] }],
  ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
  ['uid-melo', { uid: 'uid-melo', nome: 'GUILHERME SOUZA MELO', apelidos: ['MELO'] }],
])

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos: vi.fn(async () => {}) }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => {
      const k = String(nome || '').trim().toUpperCase()
      return [...ROSTER.values()].find((r) => r.apelidos.includes(k))?.uid || null
    },
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

describe('nomeAnestesistaExibicao — fonte única', () => {
  it('prefere o nome do CADASTRO quando a identidade resolve', () => {
    expect(nomeAnestesistaExibicao({ uid: 'uid-staub', alias: 'STAUB', rosterByUid: ROSTER }))
      .toBe('Guilherme Staub')
  })

  it('cai no texto importado quando não há vínculo', () => {
    // é o cenário do 403 no dicionário: sem uid, só o texto da escala
    expect(nomeAnestesistaExibicao({ uid: null, alias: 'STAUB', rosterByUid: ROSTER }))
      .toBe('Staub')
  })

  it('sala dividida "A + B" mostra só os primeiros nomes', () => {
    expect(nomeAnestesistaExibicao({ uid: 'uid-staub', alias: 'CURY + MELO', rosterByUid: ROSTER }))
      .toBe('Cury + Melo')
  })

  it('uid que não está no roster não quebra nem apaga o nome', () => {
    expect(nomeAnestesistaExibicao({ uid: 'uid-fantasma', alias: 'STAUB', rosterByUid: ROSTER }))
      .toBe('Staub')
  })
})

describe('DefinirAnestesistaSheet — mostra o mesmo nome do cabeçalho', () => {
  const caso = (over) => ({
    id: 'c1', sala: 'Sala 5', ordem: 0, hora: '08:00', statusCirurgia: 'agendada',
    anestesista: 'STAUB', anestesistaUserId: 'uid-staub', cirurgiao: 'ANA SOUZA', ...over,
  })

  it('usa o nome do cadastro, não o texto importado', async () => {
    const escala = { id: 'e1', hospital: 'hro', casos: [caso()] }
    render(
      <DefinirAnestesistaSheet escala={escala} sala="Sala 5" casosAlvo={escala.casos} onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    // o cabeçalho da Completa mostraria "Guilherme Staub" — o sheet mostrava "Staub"
    expect(await screen.findByText('Guilherme Staub')).toBeTruthy()
    expect(screen.queryByText('Staub')).toBeNull()
  })

  it('em bloco multi-anestesista traz o anestesista DO GRUPO tocado', async () => {
    // IOSC com dois: tocar no grupo do MELO não pode mostrar o CURY (que é o
    // primeiro caso da sala e o que a busca por sala devolvia)
    const escala = {
      id: 'e1',
      hospital: 'hro',
      casos: [
        caso({ id: 'c1', sala: 'IOSC', anestesista: 'CURY', anestesistaUserId: 'uid-cury' }),
        caso({ id: 'c2', sala: 'IOSC', hora: '09:00', anestesista: 'MELO', anestesistaUserId: 'uid-melo' }),
      ],
    }
    render(
      <DefinirAnestesistaSheet
        escala={escala}
        sala="IOSC"
        casosAlvo={[escala.casos[1]]}
        onClose={vi.fn()}
      />,
      { wrapper: wrap },
    )
    // nomeCirurgiaoCurto = 1º nome + ÚLTIMO sobrenome → "Guilherme Melo"
    expect(await screen.findByText('Guilherme Melo')).toBeTruthy()
    expect(screen.queryByText('Gustavo Cury')).toBeNull()
  })
})

/**
 * Pergunta antes de trocar (dono 29/07). O sheet abria direto no seletor, já
 * preenchido com quem estava lá e com "Confirmar responsável" desabilitado —
 * parecia um botão morto. Agora confirma a intenção primeiro.
 */
describe('DefinirAnestesistaSheet — confirma antes de abrir o seletor', () => {
  const caso = (over) => ({
    id: 'c1', sala: 'CC - Sala 1', ordem: 0, hora: '08:00', statusCirurgia: 'agendada',
    anestesista: 'STAUB', anestesistaUserId: 'uid-staub', cirurgiao: 'ANA SOUZA', ...over,
  })
  const abrir = (props = {}) => {
    const escala = { id: 'e1', hospital: 'hro', casos: [caso()] }
    render(
      <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" casosAlvo={escala.casos} onClose={vi.fn()} {...props} />,
      { wrapper: wrap },
    )
  }

  it('com responsável definido, pergunta primeiro e NÃO mostra o seletor', async () => {
    abrir()
    expect(await screen.findByText(/Trocar o anestesista/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sim, trocar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Não' })).toBeTruthy()
    // o seletor e o confirmar só entram depois do "sim"
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirmar responsável/i })).toBeNull()
  })

  it('"Sim, trocar" abre o seletor VAZIO — repetir o nome atual era o botão morto', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, trocar' }))
    const combo = await screen.findByRole('combobox')
    expect(combo.textContent).toMatch(/Escolha o anestesista/i)
    expect(screen.getByRole('button', { name: /Confirmar responsável/i })).toBeDisabled()
  })

  it('"Não" fecha sem tocar em nada', async () => {
    const onClose = vi.fn()
    abrir({ onClose })
    fireEvent.click(await screen.findByRole('button', { name: 'Não' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('sala SEM responsável vai direto ao seletor (é atribuição, não troca)', async () => {
    const escala = {
      id: 'e1', hospital: 'hro',
      casos: [caso({ anestesista: '', anestesistaUserId: null, semAnestesista: true })],
    }
    render(
      <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" casosAlvo={escala.casos} onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    expect(await screen.findByRole('combobox')).toBeTruthy()
    expect(screen.queryByText(/Trocar o anestesista/i)).toBeNull()
  })
})
