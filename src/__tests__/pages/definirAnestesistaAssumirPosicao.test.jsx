/**
 * DefinirAnestesistaSheet — toggle "Assumir também a posição" (dono 30/07).
 *
 * O buraco do caso Giovana↔Maurício: definir o novo responsável trocava os CASOS
 * mas a POSIÇÃO ficava com o nome do rodapé — quem assumia virava linha extra
 * "primeira a ser liberada". O toggle escreve a assunção (assumidaPor no slot)
 * JUNTO da troca de casos, pelo caminho com compensação (executarSubstituicao).
 *
 * Invariantes:
 *  - o toggle SÓ aparece quando o responsável anterior ocupa posição no rodapé;
 *  - ligado → executarSubstituicao com 1 lado (slot + casos juntos), e
 *    setAnestesistaCasos NÃO é chamado (não pode haver caminho duplo);
 *  - desligado → comportamento clássico (só setAnestesistaCasos);
 *  - nada passa perto de ordem_liberacao.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const setAnestesistaCasos = vi.fn(async () => {})
const executarSubstituicao = vi.fn(async () => {})

const ROSTER = new Map([
  ['uid-staub', { uid: 'uid-staub', nome: 'GUILHERME STAUB', apelidos: ['STAUB'] }],
  ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
])

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-eu' } }),
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

const caso = (over) => ({
  id: 'c1', sala: 'Sala 5', ordem: 0, hora: '08:00', statusCirurgia: 'agendada',
  anestesista: 'STAUB', anestesistaUserId: 'uid-staub', cirurgiao: 'ANA SOUZA', ...over,
})

const escalaComRodape = {
  id: 'e1', hospital: 'hro',
  ordemLiberacao: { matutino: ['LEONARDO', 'STAUB'] },
  linhaOverrides: {},
  casos: [caso(), caso({ id: 'c2', hora: '10:00', statusCirurgia: 'terminada' })],
}

// REDESENHO 17/08 ("Lista de colegas"): o Select saiu e o roster é a própria
// tela — escolher passou de dois toques para um. A asserção é a mesma; o que
// mudou é o caminho até o colega.
const escolherCury = () => {
  fireEvent.click(screen.getByRole('option', { name: /GUSTAVO CURY/ }))
}

beforeEach(() => vi.clearAllMocks())

describe('Lista de colegas (dono 17/08)', () => {
  it('declara o ALCANCE: o que muda de dono e o que fica', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    // 2 casos na sala, 1 terminado → 1 muda, 1 fica (era invisível no desenho antigo)
    expect(screen.getByText(/1 cirurgia muda de dono/)).toBeTruthy()
    expect(screen.getByText(/já terminou e fica com/)).toBeTruthy()
  })

  it('cada colega vem com onde ele está agora (posição na fila)', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    // STAUB é o 2º do rodapé matutino e tem 1 cirurgia não terminada no turno
    expect(screen.getByText(/2º na fila/)).toBeTruthy()
  })

  it('a busca filtra o roster (45+ pessoas não se percorrem com o dedo)', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.change(screen.getByLabelText('Buscar anestesista'), { target: { value: 'cury' } })
    expect(screen.getByRole('option', { name: /GUSTAVO CURY/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /GUILHERME STAUB/ })).toBeNull()
  })

  it('o rodapé declara o efeito antes de confirmar', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.getByText(/Escolha quem assume para confirmar/)).toBeTruthy()
    escolherCury()
    expect(await screen.findByText(/assume 1 cirurgia/)).toBeTruthy()
  })
})

describe('toggle "Assumir também a posição" no Definir anestesista', () => {
  it('aparece quando o responsável anterior ocupa posição no rodapé — e nasce desligado', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByRole('switch')).toBeNull() // sem escolhido, sem toggle
    escolherCury()
    const sw = await screen.findByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Assumir também a posição de Guilherme Staub/)).toBeTruthy()
  })

  it('não aparece quando o anterior NÃO está no rodapé', () => {
    const semSlot = { ...escalaComRodape, ordemLiberacao: { matutino: ['LEONARDO', 'KARINE'] } }
    render(<DefinirAnestesistaSheet escala={semSlot} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('ligado: confirmar dispara a substituição (slot + casos JUNTOS) e não o caminho clássico', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan, userInfo] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({
      hospital: 'hro', escalaId: 'e1', chaveSlot: 'uid-staub', nomeSlot: 'STAUB',
      de: { uid: 'uid-staub' }, para: { uid: 'uid-cury', apelido: 'CURY' },
      casoIds: ['c1'], // terminada fica com quem terminou
    })
    expect(userInfo.userId).toBe('uid-eu')
    expect(setAnestesistaCasos).not.toHaveBeenCalled()
    expect(JSON.stringify(plan)).not.toContain('ordem')
  })

  it('desligado: confirmar segue o caminho clássico (só os casos)', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  // TURNOS INDEPENDENTES (dono 13/08): a posição de STAUB é MATUTINA e a tela
  // está na TARDE — na tarde não existe posição dele para assumir, então o
  // toggle nem é oferecido e o repasse move só as cirurgias. Até 13/08 o slot da
  // manhã era encontrado a partir da tarde e a assunção era gravada no OUTRO
  // turno (defeito D3 tinha corrigido só o turno da escrita, não o cruzamento).
  it('posição em outro turno não é oferecida: a tarde não assume vaga da manhã', async () => {
    const casoTarde = caso({ id: 'c3', hora: '14:00' })
    const esc = { ...escalaComRodape, casos: [...escalaComRodape.casos, casoTarde] }
    render(
      <DefinirAnestesistaSheet escala={esc} sala="Sala 5" turno="vespertino" casosAlvo={[casoTarde]} onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    escolherCury()
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MODO SALA opera SÓ no turno exibido (bug 31/07): a sala existe nos dois turnos
// e o sheet consultava o dia inteiro — "Responsável atual" mostrava o dono da
// MANHÃ com o board na tarde (CC-Sala 3: header "Paulo + Guilherme", sheet
// "Aline") e o repasse alcançaria caso não-terminado do outro turno.
// ════════════════════════════════════════════════════════════════════════════
describe('modo SALA opera só no turno exibido (bug 31/07)', () => {
  const escalaDoisTurnos = {
    id: 'e1', hospital: 'unimed',
    ordemLiberacao: { matutino: ['ALINE'], vespertino: ['CURY'] },
    linhaOverrides: {},
    casos: [
      caso({ id: 'm1', hora: '07:30', anestesista: 'ALINE', anestesistaUserId: 'uid-aline' }),
      caso({ id: 'v1', hora: '13:30', anestesista: 'STAUB', anestesistaUserId: 'uid-staub' }),
    ],
  }

  it('"agora com…" e os ALVOS vêm do turno, não do dia inteiro', async () => {
    render(<DefinirAnestesistaSheet escala={escalaDoisTurnos} sala="Sala 5" turno="vespertino" onClose={vi.fn()} />, { wrapper: wrap })
    // tarde = Staub (o mesmo do header da Completa); antes aparecia a Aline (manhã).
    // O nome fica no cabeçalho: é ele que denuncia divergência de turno.
    expect(screen.getByText(/agora com Guilherme Staub/i)).toBeTruthy()
    expect(screen.queryByText(/agora com Aline/i)).toBeNull()
    escolherCury()
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    // só o caso da TARDE é repassado — o da manhã (não terminado) fica intacto
    expect(setAnestesistaCasos.mock.calls[0][1]).toEqual(['v1'])
  })

  it('sem turno (chamada legada) segue olhando o dia inteiro', () => {
    render(<DefinirAnestesistaSheet escala={escalaDoisTurnos} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    // primeiro caso do dia é da manhã — comportamento antigo preservado
    expect(screen.getByText(/agora com Aline/i)).toBeTruthy()
  })
})

// DUPLA NA MESMA CIRURGIA (dono 11/08): duas anestesistas no mesmo procedimento
// não cabem num uid — o texto "A + B" é o dado. Só existe no modo CASO: sala com
// anestesistas diferentes em cirurgias diferentes segue com um bloco para cada.
describe('Segundo anestesista (mesma cirurgia)', () => {
  const abrirCaso = () => render(
    <DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" casosAlvo={[caso()]} onClose={vi.fn()} />,
    { wrapper: wrap },
  )
  // o segundo anestesista continua em Select (é exceção, não o caminho comum):
  // a linha abre o campo
  const segundoSelect = () => {
    fireEvent.click(screen.getByRole('button', { name: /Segundo anestesista/i }))
    return screen.getByRole('combobox')
  }

  it('só aparece depois de escolher o responsável, e só no modo CASO', async () => {
    abrirCaso()
    expect(screen.queryByRole('button', { name: /Segundo anestesista/i })).toBeNull()
    escolherCury()
    expect(await screen.findByRole('button', { name: /Segundo anestesista/i })).toBeTruthy()
  })

  it('modo SALA não oferece dupla (a dupla é da cirurgia, não da sala)', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    expect(screen.queryByRole('button', { name: /Segundo anestesista/i })).toBeNull()
  })

  it('escolhido o segundo, grava "A + B" sem uid e marcado como dupla', async () => {
    abrirCaso()
    escolherCury()
    await screen.findByRole('button', { name: /Segundo anestesista/i })
    fireEvent.click(segundoSelect())
    fireEvent.click(await screen.findByRole('option', { name: 'GUILHERME STAUB' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar os dois anestesistas/i }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    const [, ids, quem] = setAnestesistaCasos.mock.calls[0]
    expect(ids).toEqual(['c1'])
    expect(quem).toEqual({ uid: null, apelido: 'CURY + STAUB', dupla: true })
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('com dupla, o toggle de assumir posição sai de cena (não há um dono só)', async () => {
    abrirCaso()
    escolherCury()
    await screen.findByRole('button', { name: /Segundo anestesista/i })
    fireEvent.click(segundoSelect())
    fireEvent.click(await screen.findByRole('option', { name: 'GUILHERME STAUB' }))
    await waitFor(() => expect(screen.queryByRole('switch')).toBeNull())
  })
})
