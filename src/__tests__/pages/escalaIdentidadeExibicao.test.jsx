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
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'

const ROSTER = new Map([
  ['uid-staub', { uid: 'uid-staub', nome: 'GUILHERME STAUB', apelidos: ['STAUB'] }],
  ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
  ['uid-melo', { uid: 'uid-melo', nome: 'GUILHERME SOUZA MELO', apelidos: ['MELO'] }],
])

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos: vi.fn(async () => {}), executarSubstituicao: vi.fn(async () => {}) }),
  // o hook das urgências lê `hoje` do context (fonte única desde 21/08)
  useEscalaCirurgica: () => ({ hoje: '2026-08-18', escalas: {}, data: '2026-08-18', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
// o sheet usa o user real só p/ o audit (`por`) da assunção de posição
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-test' } }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }),
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
    // dupla é `uid: null` POR CONSTRUÇÃO (service, conferência e sheet gravam
    // assim) — é essa a forma em que ela chega aqui na vida real
    expect(nomeAnestesistaExibicao({ uid: null, alias: 'CURY + MELO', rosterByUid: ROSTER }))
      .toBe('Cury + Melo')
  })

  it('texto de dupla COM login é corrupção — o login manda (incidente 02/09)', () => {
    // o dicionário havia aprendido "GABRIELA + ?" como apelido do Oscar, então
    // trocar o responsável gravava uid novo + texto de dupla. Lendo o texto
    // primeiro, o cabeçalho seguia mostrando a colega antiga: "clico e não muda".
    expect(nomeAnestesistaExibicao({ uid: 'uid-staub', alias: 'CURY + MELO', rosterByUid: ROSTER }))
      .toBe('Guilherme Staub')
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
    // o cabeçalho da Completa mostraria "Guilherme Staub" — o sheet mostrava "Staub".
    // Desde 17/08 o nome de quem responde HOJE vive na linha de contexto do
    // cabeçalho ("agora com …"), que é a que denuncia divergência de turno.
    expect(await screen.findByText(/agora com Guilherme Staub/)).toBeTruthy()
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
    expect(await screen.findByText(/agora com Guilherme Melo/)).toBeTruthy()
    expect(screen.queryByText(/agora com Gustavo Cury/)).toBeNull()
  })
})

/**
 * SEM pergunta prévia (dono 29/07, revisão da noite). O sheet abre DIRETO na
 * escolha — antes havia um "trocar? Não/Sim" que custava um toque no meio do
 * plantão e não protegia de nada: a troca só acontece no "Confirmar responsável".
 *
 * Desde o redesenho de 17/08 a escolha é a LISTA de colegas (o Select saiu): a
 * pergunta virou o título e ninguém nasce marcado.
 */
describe('DefinirAnestesistaSheet — vai direto à escolha', () => {
  const caso = (over) => ({
    id: 'c1', sala: 'CC - Sala 1', ordem: 0, hora: '08:00', statusCirurgia: 'agendada',
    anestesista: 'STAUB', anestesistaUserId: 'uid-staub', cirurgiao: 'ANA SOUZA', ...over,
  })
  // modo SALA = sem casosAlvo (o header da Completa passa null p/ sala inteira);
  // com UM caso em casosAlvo o sheet entra no modo CASO, que tem outro rótulo
  const abrir = (props = {}) => {
    const escala = { id: 'e1', hospital: 'hro', casos: [caso(), caso({ id: 'c2', hora: '10:00' })] }
    render(
      <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" onClose={vi.fn()} {...props} />,
      { wrapper: wrap },
    )
  }

  it('a pergunta nomeia a sala e o card ASSUME abre o seletor', async () => {
    abrir()
    expect(await screen.findByText('Quem responde pela CC - Sala 1?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    expect(screen.getByRole('option', { name: /GUSTAVO CURY/ })).toBeTruthy()
    // a pergunta e os botões Não/Sim não existem mais
    expect(screen.queryByRole('button', { name: 'Sim, trocar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Não' })).toBeNull()
  })

  it('ninguém nasce marcado — repetir quem já está lá deixava o Confirmar morto', async () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    const marcados = (await screen.findAllByRole('option')).filter((o) => o.getAttribute('aria-selected') === 'true')
    expect(marcados).toHaveLength(0)
  })

  it('no modo CASO a pergunta fala do caso, não da sala', async () => {
    const escala = { id: 'e1', hospital: 'hro', casos: [caso()] }
    render(
      <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" casosAlvo={[escala.casos[0]]} onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    expect(await screen.findByText('Quem responde por esta cirurgia?')).toBeTruthy()
  })
})

/**
 * O DETALHE DO CASO usa a MESMA fonte de nome (17/08). O sheet mostrava o alias
 * cru da importação — "ALEXANDRE D" em caixa alta, ao lado do cirurgião em Title
 * Case, enquanto o cabeçalho da sala e o sheet de definir diziam "Alexandre
 * Danieli". Três superfícies do mesmo caso, dois nomes para a mesma pessoa.
 */
describe('CasoDetalheSheet — o anestesista vem do cadastro', () => {
  const escala = {
    id: 'e1', hospital: 'hro', ajudaExterna: {},
    casos: [{
      id: 'c1', sala: 'Sala 5', ordem: 0, hora: '08:00', turno: 'matutino',
      anestesista: 'STAUB', anestesistaUserId: 'uid-staub',
      cirurgiao: 'Ana Souza', procedimento: 'Colecistectomia',
    }],
  }

  it('mostra o nome do cadastro, não o alias em caixa alta', () => {
    render(
      <CasoDetalheSheet escala={escala} caso={escala.casos[0]} onClose={vi.fn()} podeEditar />,
      { wrapper: wrap },
    )
    expect(screen.getByText('Guilherme Staub')).toBeTruthy()
    expect(screen.queryByText('STAUB')).toBeNull()
  })

  it('sem vínculo, cai no texto importado (não some nome nenhum)', () => {
    const semUid = { ...escala, casos: [{ ...escala.casos[0], anestesistaUserId: null, anestesista: 'KARINE' }] }
    render(
      <CasoDetalheSheet escala={semUid} caso={semUid.casos[0]} onClose={vi.fn()} podeEditar />,
      { wrapper: wrap },
    )
    expect(screen.getByText('Karine')).toBeTruthy()
  })
})
