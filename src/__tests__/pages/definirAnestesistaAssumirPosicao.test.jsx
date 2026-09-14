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
  // terceira pessoa: é o que permite trocar UMA metade de uma dupla já gravada
  ['uid-aline', { uid: 'uid-aline', nome: 'ALINE BONFANTE', apelidos: ['ALINE'] }],
])

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  // o hook das urgências lê `hoje` do context (fonte única desde 21/08)
  useEscalaCirurgica: () => ({ hoje: '2026-08-18', escalas: {}, data: '2026-08-18', loading: false }),
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

// REDESENHO 17/08 (2ª rodada): o card ASSUME é o seletor — o Select do DS (o
// mesmo de produção, com busca) abre ancorado nele. A asserção é a mesma; o que
// mudou é o caminho até o colega.
// O card ASSUME abre uma FOLHA de baixo para cima com busca no topo (dono 17/08,
// 3ª rodada): o dropdown do Select herda a largura do gatilho, e o gatilho é meio
// card — a lista saía estreita, com os nomes quebrando.
const escolherCury = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
  fireEvent.click(screen.getByRole('option', { name: /GUSTAVO CURY/ }))
}

beforeEach(() => vi.clearAllMocks())

describe('Lista de colegas (dono 17/08)', () => {
  it('declara o ALCANCE: os procedimentos assumidos e o que fica', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    // 2 casos na sala, 1 terminado → 1 é assumido, 1 fica (invisível no desenho antigo)
    expect(screen.getByText('Procedimentos assumidos')).toBeTruthy()
    expect(screen.getByText(/já terminou: fica com/)).toBeTruthy()
  })

  it('o card ASSUME abre a folha com a lista e a busca no topo', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    // fechada, nenhuma opção na tela: o painel não vira lista rolante
    expect(screen.queryByRole('option')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    expect(screen.getByLabelText('Buscar anestesista')).toBeTruthy()
    expect(screen.getByRole('option', { name: /GUSTAVO CURY/ })).toBeTruthy()
  })

  it('a busca filtra por nome ou apelido (o roster passa de 45 pessoas)', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    fireEvent.change(screen.getByLabelText('Buscar anestesista'), { target: { value: 'staub' } })
    expect(screen.getByRole('option', { name: /GUILHERME STAUB/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /GUSTAVO CURY/ })).toBeNull()
  })

  it('o lado que SAI resume o que ele tem aqui', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.getByText('Sai')).toBeTruthy()
    expect(screen.getByText(/2 cirurgias · 1 terminada/)).toBeTruthy()
  })

  // A LISTA É SÓ DE NOMES, EM ORDEM ALFABÉTICA (dono 17/08): a posição na fila e
  // a contagem de cirurgias saíram do rótulo — quem escolhe aqui procura UMA
  // pessoa pelo nome, e o texto extra fazia cada linha virar uma frase para ler.
  it('lista os colegas só pelo nome, em ordem alfabética', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    const opcoes = screen.getAllByRole('option').map((o) => o.textContent.trim())
    expect(opcoes.some((t) => /na fila|cirurgia/.test(t))).toBe(false)
    // "Sem anestesista (?)" abre a lista; o resto vem ordenado em pt-BR
    const nomes = opcoes.slice(1)
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  it('sem ninguém escolhido o Confirmar existe, porém desabilitado', () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.getByRole('button', { name: /Confirmar responsável/i })).toBeDisabled()
    escolherCury()
    expect(screen.getByRole('button', { name: /Confirmar responsável/i })).not.toBeDisabled()
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
// não cabem num uid — o texto "A + B" é o dado.
//
// EM TODOS OS MODOS (dono 14/09): "só no modo CASO" deixou o dono sem caminho — a
// Hemodinâmica da tarde tinha 3 linhas ("//" herdado), ele abriu pelo cabeçalho da
// sala, a linha "Dois anestesistas" não existia, confirmou uma pessoa e a dupla das
// três sumiu. A dupla vale para os ALVOS (no modo SALA, as cirurgias que mudam de
// mão), e o primeiro pode ser quem JÁ responde — acrescentar alguém não exige
// re-escolher quem está lá num seletor que nasce vazio.
describe('Segundo anestesista (mesma cirurgia)', () => {
  const abrirCaso = () => render(
    <DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" casosAlvo={[caso()]} onClose={vi.fn()} />,
    { wrapper: wrap },
  )
  // o segundo anestesista continua em Select (é exceção, não o caminho comum):
  // a linha abre o campo
  // o card ASSUME não é mais combobox (virou folha), então o único Select que
  // sobra no painel é o do segundo anestesista
  const segundoSelect = (nome = /Dois anestesistas nesta cirurgia/i) => {
    fireEvent.click(screen.getByRole('button', { name: nome }))
    return screen.getByRole('combobox')
  }

  it('já aparece de cara quando quem responde tem login: é acrescentar, não trocar', () => {
    abrirCaso()
    expect(screen.getByRole('button', { name: /Dois anestesistas nesta cirurgia/i })).toBeTruthy()
  })

  it('"?" (sem uid) precisa de um primeiro escolhido', async () => {
    const semDono = caso({ anestesista: '?', anestesistaUserId: null, semAnestesista: true })
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" casosAlvo={[semDono]} onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByRole('button', { name: /Dois anestesistas/i })).toBeNull()
    escolherCury()
    expect(await screen.findByRole('button', { name: /Dois anestesistas nesta cirurgia/i })).toBeTruthy()
  })

  // DUPLA JÁ GRAVADA NASCE PREENCHIDA (dono 14/09): "quero que o segundo anestesista
  // já venha preenchido, conforme veio do mapa" — e "não há opção de trocar um dos
  // anestesistas". Antes, "A + B" (uid nulo) abria a folha vazia: era escolher os
  // dois de novo para mudar um.
  describe('dupla já gravada ("STAUB + CURY", uid nulo)', () => {
    const jaDupla = caso({ anestesista: 'STAUB + CURY', anestesistaUserId: null })
    const abrirDupla = () => render(
      <DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" casosAlvo={[jaDupla]} onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    const escolherNoSelect = async (nome) => {
      fireEvent.click(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByRole('option', { name: nome }))
    }

    it('nasce com as duas metades resolvidas, o campo do segundo aberto, e Confirmar desabilitado', () => {
      abrirDupla()
      // a linha da dupla existe sem escolher ninguém, e já diz o segundo
      const linha = screen.getByRole('button', { name: /Dois anestesistas nesta cirurgia/i })
      expect(linha.textContent).toMatch(/Gustavo Cury/i)
      // o campo já está aberto — desmarcar é um toque, não dois
      expect(screen.getByRole('combobox')).toBeTruthy()
      // nada mudou → o botão não acende (botão morto de 29/07 continua proibido)
      expect(screen.getByRole('button', { name: /Confirmar os dois anestesistas/i })).toBeDisabled()
    })

    it('trocar SÓ o segundo grava "STAUB + ALINE"', async () => {
      abrirDupla()
      await escolherNoSelect('ALINE BONFANTE')
      const btn = screen.getByRole('button', { name: /Confirmar os dois anestesistas/i })
      expect(btn).not.toBeDisabled()
      fireEvent.click(btn)
      await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
      expect(setAnestesistaCasos.mock.calls[0][2]).toEqual({ uid: null, apelido: 'STAUB + ALINE', dupla: true })
    })

    it('desmarcar o segundo ("Só um anestesista") grava só o primeiro, com login', async () => {
      abrirDupla()
      await escolherNoSelect('Só um anestesista')
      const btn = screen.getByRole('button', { name: /Confirmar responsável/i })
      expect(btn).not.toBeDisabled()
      fireEvent.click(btn)
      await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
      expect(setAnestesistaCasos.mock.calls[0][2]).toEqual({ uid: 'uid-staub', apelido: 'STAUB' })
    })

    it('trocar SÓ o primeiro (card ASSUME) mantém o segundo: "ALINE + CURY"', async () => {
      abrirDupla()
      fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
      fireEvent.click(screen.getByRole('option', { name: /ALINE BONFANTE/ }))
      fireEvent.click(screen.getByRole('button', { name: /Confirmar os dois anestesistas/i }))
      await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
      expect(setAnestesistaCasos.mock.calls[0][2]).toEqual({ uid: null, apelido: 'ALINE + CURY', dupla: true })
    })
  })

  it('acrescenta o segundo a quem já responde, sem re-escolher o primeiro', async () => {
    abrirCaso()
    // nada escolhido no card ASSUME: o primeiro da dupla é o Staub, que já está lá
    fireEvent.click(segundoSelect())
    fireEvent.click(await screen.findByRole('option', { name: 'GUSTAVO CURY' }))
    const btn = screen.getByRole('button', { name: /Confirmar os dois anestesistas/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    const [, ids, quem] = setAnestesistaCasos.mock.calls[0]
    expect(ids).toEqual(['c1'])
    expect(quem).toEqual({ uid: null, apelido: 'STAUB + CURY', dupla: true })
  })

  // A Hemodinâmica de 14/09: três linhas da mesma pessoa, uma já terminada.
  it('modo SALA oferece a dupla e ela vai para TODAS as cirurgias que mudam de mão', async () => {
    const tresLinhas = {
      ...escalaComRodape,
      casos: [caso(), caso({ id: 'c3', hora: '09:00' }), caso({ id: 'c2', hora: '10:00', statusCirurgia: 'terminada' })],
    }
    render(<DefinirAnestesistaSheet escala={tresLinhas} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(segundoSelect(/Dois anestesistas nestas 2 cirurgias/i))
    fireEvent.click(await screen.findByRole('option', { name: 'GUSTAVO CURY' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar os dois anestesistas/i }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    const [, ids, quem] = setAnestesistaCasos.mock.calls[0]
    expect(ids).toEqual(['c1', 'c3']) // a terminada fica com quem a fez
    expect(quem).toEqual({ uid: null, apelido: 'STAUB + CURY', dupla: true })
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('escolhido o segundo, grava "A + B" sem uid e marcado como dupla', async () => {
    abrirCaso()
    escolherCury()
    await screen.findByRole('button', { name: /Dois anestesistas nesta cirurgia/i })
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
    await screen.findByRole('button', { name: /Dois anestesistas nesta cirurgia/i })
    fireEvent.click(segundoSelect())
    fireEvent.click(await screen.findByRole('option', { name: 'GUILHERME STAUB' }))
    await waitFor(() => expect(screen.queryByRole('switch')).toBeNull())
  })
})
