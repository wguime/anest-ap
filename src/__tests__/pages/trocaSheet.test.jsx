/**
 * TrocaSheet — o FLUXO ÚNICO de troca (dono 07/08: "num só local, fáceis de
 * executar e intuitivas"). Estes testes travam o contrato:
 *   1. a decisão é POR POSIÇÃO e nada vem pré-marcado (dono 09–10/08): a escala
 *      pode sair JÁ com os nomes trocados — supor a origem invertia a troca;
 *   2. ninguém muda de lugar ("fica" nas duas) → "Registrar troca": grava
 *      trocaCom com `apenasRegistro`, sem mover posição nem caso. É o caso
 *      Rafael⇄Garim de 10/08, que antes não tinha caminho na UI;
 *   3. alguém assume → "Trocar agora" executa só as posições marcadas;
 *   4. com posição por confirmar o botão fica travado (meio swap = D4);
 *   5. o TIPO é inferido pela geografia dos slots do PAR (não por quem se move);
 *   6. a própria pessoa não aparece no seletor de colega.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import TrocaSheet, { inferirTipoTroca, TIPO_LABEL } from '@/pages/escala-cirurgica/TrocaSheet'

const ROSTER = [
  { uid: 'uid-gio', nome: 'GIOVANA GOMES NOLL', apelidos: ['GIOVANA'] },
  { uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS', apelidos: ['MAURICIO'] },
  { uid: 'uid-fora', nome: 'COLEGA DE FORA', apelidos: ['FORA'] },
  { uid: 'uid-rose', nome: 'ROSEMARY CURY', apelidos: ['ROSE'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

const { marcarTroca, executarSubstituicao } = vi.hoisted(() => ({
  marcarTroca: vi.fn(async () => {}),
  executarSubstituicao: vi.fn(async () => {}),
}))

// as 3 escalas que o context forneceria — Giovana no HRO, Maurício na Unimed
const escalaUnimed = {
  id: 'esc-uni', hospital: 'unimed',
  ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
  linhaOverrides: {},
  casos: [{ id: 'u1', sala: 'S2', ordem: 0, anestesista: 'MAURICIO', anestesistaUserId: 'uid-mau', bloco: 'normal' }],
}
const escalaHro = {
  id: 'esc-hro', hospital: 'hro',
  // Giovana fecha os dois turnos do HRO (é o caso do incidente do Staub abaixo:
  // quem está na tela tem posição na tarde, o colega só na manhã)
  ordemLiberacao: { matutino: ['GIOVANA', 'KARINE'], vespertino: ['GIOVANA', 'KARINE'] },
  linhaOverrides: {},
  casos: [{ id: 'h1', sala: 'S1', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', bloco: 'normal' }],
}

// O Materno é publicado SEM rodapé (assim em 17/17 escalas até 13/08): quem
// trabalha lá só existe nos casos.
const escalaMaterno = {
  id: 'esc-mat', hospital: 'materno',
  ordemLiberacao: { matutino: [], vespertino: [] },
  linhaOverrides: {},
  casos: [{ id: 'm1', sala: 'Sala 2 HC', ordem: 0, hora: '07:30', turno: 'matutino', anestesista: 'ROSE', anestesistaUserId: 'uid-rose', bloco: 'normal' }],
}

// mutável: um teste precisa de uma pessoa presente em DOIS hospitais
const escalasMock = { unimed: escalaUnimed, hro: escalaHro, materno: escalaMaterno }

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => ({ escalas: escalasMock }),
  useEscalaCirurgicaActions: () => ({ marcarTroca, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const LINHA_GIOVANA = { chave: 'uid-gio', uid: 'uid-gio', anestesista: 'Giovana Noll', nomeOriginal: 'GIOVANA' }

const montar = (props = {}) => render(
  <TrocaSheet linha={LINHA_GIOVANA} escala={escalaHro} turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)

const escolherColega = async (nome) => {
  fireEvent.click(screen.getAllByRole('combobox')[0])
  fireEvent.click(await screen.findByRole('option', { name: nome }))
}
const marcar = (nomeBotao) => fireEvent.click(screen.getByRole('button', { name: nomeBotao }))
const botaoPrincipal = () => screen.getByRole('button', { name: /Trocar agora|Trocar posição|Registrar troca/ })
// POP-UP ANTES DE CONCLUIR (dono 18/08): o swap só grava depois do resumo do que
// muda na fila — nenhum caminho executa a troca sem perguntar.
const confirmarPopup = async () => fireEvent.click(await screen.findByRole('button', { name: 'Confirmar troca' }))

beforeEach(() => vi.clearAllMocks())

describe('inferirTipoTroca — taxonomia pela geografia dos slots', () => {
  const lado = (hospital, turno) => ({ hospital, turno })
  it('hospitais diferentes → entre_hospitais', () => {
    expect(inferirTipoTroca({ lados: [lado('unimed', 'matutino'), lado('hro', 'matutino')] })).toBe('entre_hospitais')
  })
  it('mesmo hospital → posicoes; turnos diferentes → entre_turnos', () => {
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino'), lado('hro', 'matutino')] })).toBe('posicoes')
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino'), lado('hro', 'vespertino')] })).toBe('entre_turnos')
  })
  it('um lado só → assuncao; nenhum → null', () => {
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino')] })).toBe('assuncao')
    expect(inferirTipoTroca({ lados: [] })).toBeNull()
  })
})

describe('TrocaSheet', () => {
  it('a própria pessoa fica fora do seletor de colega', async () => {
    montar()
    fireEvent.click(screen.getAllByRole('combobox')[0])
    expect(screen.queryByRole('option', { name: 'GIOVANA GOMES NOLL' })).toBeNull()
    expect(await screen.findByRole('option', { name: 'MAURICIO MAHALEM BASTOS' })).toBeTruthy()
  })

  it('uma decisão por POSIÇÃO, nada pré-marcado — e meia resposta não libera o botão', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('Quem fica com cada posição?')
    // as duas posições do par aparecem, cada uma com as duas saídas
    expect(screen.getByText('Posição de Giovana')).toBeTruthy()
    expect(screen.getByText('Posição de Mauricio')).toBeTruthy()
    expect(botaoPrincipal()).toBeDisabled()
    marcar('Giovana Noll fica HRO')
    expect(botaoPrincipal()).toBeDisabled() // falta a outra posição (defeito D4)
  })

  it('escala já publicada trocada: "fica" nas duas vira REGISTRO, sem mover ninguém', async () => {
    // caso real 10/08 — Rafael já está no HRO e Garim na Unimed; o que falta é
    // o rastro (badge nos dois), não o swap
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Giovana Noll fica HRO')
    marcar('Mauricio Bastos fica Unimed')
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'trocaram entre si' } })
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Registrar troca'))
    fireEvent.click(botaoPrincipal())
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    const [escala, linha, colega, , turno] = marcarTroca.mock.calls[0]
    expect(escala.id).toBe('esc-hro')
    expect(linha.chave).toBe('uid-gio')
    expect(colega).toMatchObject({
      uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS',
      tipo: 'entre_hospitais', motivo: 'trocaram entre si', apenasRegistro: true,
    })
    expect(turno).toBe('matutino')
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  // ⚠️ REABERTURA a partir de uma troca JÁ REGISTRADA (dono 18/08: "ao solicitar
  // troca de posições a posição na lista de liberações não está mudando"): o
  // painel da linha perdia a porta do sheet quando havia registro, e não sobrava
  // caminho nenhum para as posições trocarem. O par já é conhecido — o que falta
  // decidir é a POSIÇÃO, e ela continua em branco (supor quem se move é o que
  // invertia a troca em 10/08).
  it('colegaInicial já vem escolhido, mas as posições seguem por confirmar', async () => {
    montar({ colegaInicial: 'uid-mau' })
    expect(await screen.findByText('Quem fica com cada posição?')).toBeTruthy()
    expect(screen.getByText('Posição de Giovana')).toBeTruthy()
    expect(screen.getByText('Posição de Mauricio')).toBeTruthy()
    expect(botaoPrincipal()).toBeDisabled()
    marcar('Mauricio Bastos assume HRO')
    marcar('Giovana Noll assume Unimed')
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Trocar agora'))
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][0].lados).toHaveLength(2)
  })

  it('os dois assumem a posição do outro: "Trocar agora" executa os 2 lados com tipo e motivo', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Mauricio Bastos assume HRO')
    marcar('Giovana Noll assume Unimed')
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'plantão' } })
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Trocar agora'))
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(2)
    for (const l of plan.lados) {
      expect(l.tipo).toBe('entre_hospitais')
      expect(l.motivo).toBe('plantão')
    }
    expect(marcarTroca).not.toHaveBeenCalled()
  })

  it('metade já publicada trocada: executa SÓ a posição marcada como assumida', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Giovana Noll fica HRO')       // o HRO já está certo
    marcar('Giovana Noll assume Unimed')     // a vaga do Maurício na Unimed passa para ela
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0].hospital).toBe('unimed')
    expect(plan.lados[0].para.uid).toBe('uid-gio')
    // tipo vem da GEOGRAFIA do par (2 hospitais), não de quem se move
    expect(plan.lados[0].tipo).toBe('entre_hospitais')
  })

  it('colega sem posição publicada: avisa e a única decisão é a posição que existe', async () => {
    montar()
    await escolherColega('COLEGA DE FORA')
    expect(await screen.findByText(/não tem posição nem cirurgia/i)).toBeTruthy()
    marcar('Colega Fora assume HRO')
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0].para.uid).toBe('uid-fora')
    expect(plan.lados[0].tipo).toBe('assuncao')
  })

  // ── COLEGA FORA DA UNIMED/HRO (dono 13/08) ─────────────────────────────────
  it('colega do Materno: a troca fecha pelos CASOS, mesmo sem rodapé lá', async () => {
    montar()
    await escolherColega('ROSEMARY CURY')
    // o cartão do Materno diz que ali não há fila para herdar — só as cirurgias
    expect(await screen.findByText(/Cirurgias de Rose · sem fila de liberação/)).toBeTruthy()
    expect(screen.getByText('Posição de Giovana')).toBeTruthy()
    marcar('Rosemary Cury assume HRO')
    marcar('Giovana Noll assume Materno')
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Trocar agora'))
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    const mat = plan.lados.find((l) => l.hospital === 'materno')
    expect(mat).toMatchObject({ semPosicao: true, casoIds: ['m1'], para: { uid: 'uid-gio' } })
    // dois hospitais em jogo → é troca entre hospitais, não "colega de fora assume"
    expect(mat.tipo).toBe('entre_hospitais')
  })

  it('colega em lugar nenhum: dá para dizer ONDE ele está, e isso entra no registro', async () => {
    montar()
    await escolherColega('COLEGA DE FORA')
    // o seletor de local só existe para quem não aparece em escala nenhuma
    fireEvent.click(screen.getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'Consultório' }))
    marcar('Giovana Noll fica HRO')
    fireEvent.click(botaoPrincipal())
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(marcarTroca.mock.calls[0][2]).toMatchObject({ uid: 'uid-fora', local: 'Consultório', apenasRegistro: true })
  })

  it('colega que TEM escala no turno exibido não ganha campo de local', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('Quem fica com cada posição?')
    expect(screen.queryByText(/Onde .* está/)).toBeNull()
  })

  // INCIDENTE 13/08 (Staub): fecha a MANHÃ do HRO e passa a TARDE no consultório.
  // Como o nome dele estava no rodapé da manhã, o campo de local sumia e não
  // havia onde dizer para onde ele tinha ido — o que era justamente o registro
  // que faltava ("a troca já está correta na escala, só precisa ser identificada").
  it('colega escalado só no OUTRO turno ainda pode ser marcado como fora (consultório)', async () => {
    render(
      <TrocaSheet linha={LINHA_GIOVANA} escala={escalaHro} turno="vespertino" onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    // Maurício está no rodapé MATUTINO da Unimed; a tela é a tarde
    await escolherColega('MAURICIO MAHALEM BASTOS')
    expect(await screen.findByText(/Onde Mauricio Bastos está à tarde/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: 'Consultório' }))
    for (const b of screen.getAllByRole('button', { name: /fica (HRO|Unimed)/ })) fireEvent.click(b)
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Registrar troca'))
    fireEvent.click(botaoPrincipal())
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(marcarTroca.mock.calls[0][2]).toMatchObject({ uid: 'uid-mau', local: 'Consultório' })
  })

  // INCIDENTE 13/08 (Karine): quem aparece em DOIS hospitais no mesmo turno —
  // a mesma jornada anotada nos dois quadros (linha de sala "Materno" dentro da
  // escala do HRO) — arrastava o outro hospital para o sheet. A posição em jogo
  // é a da TELA de onde a troca foi aberta.
  it('a posição trocada é a da escala aberta: o outro hospital dela não entra', async () => {
    const hroOriginal = escalasMock.hro
    escalasMock.hro = { ...escalaHro, ordemLiberacao: { matutino: ['GIOVANA', 'KARINE', 'ROSE'] } }
    try {
      const LINHA_ROSE = { chave: 'uid-rose', uid: 'uid-rose', anestesista: 'Rose Cury', nomeOriginal: 'ROSE' }
      render(
        <TrocaSheet linha={LINHA_ROSE} escala={escalaMaterno} turno="matutino" onClose={vi.fn()} />,
        { wrapper: wrap },
      )
      await escolherColega('MAURICIO MAHALEM BASTOS')
      await screen.findByText('Quem fica com cada posição?')
      // Materno (a tela) + Unimed (o colega). O HRO dela fica de fora.
      expect(screen.getByText(/Cirurgias de Rose · sem fila de liberação/)).toBeTruthy()
      expect(screen.getByText('Posição de Mauricio')).toBeTruthy()
      expect(screen.queryByText('Posição de Rose')).toBeNull()
    } finally {
      escalasMock.hro = hroOriginal
    }
  })

  it('"Declarar para depois" não existe mais (dono 09/08)', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    expect(screen.queryByRole('button', { name: /Declarar para depois/ })).toBeNull()
  })

  it('o tipo inferido aparece escolhido e continua corrigível', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await waitFor(() => expect(screen.getByText(TIPO_LABEL.entre_hospitais)).toBeTruthy())
    fireEvent.click(screen.getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: TIPO_LABEL.posicoes }))
    marcar('Giovana Noll fica HRO')
    marcar('Mauricio Bastos fica Unimed')
    fireEvent.click(botaoPrincipal())
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(marcarTroca.mock.calls[0][2].tipo).toBe('posicoes')
  })
})

// ⚠️ MODO POSIÇÃO — OPÇÃO PRÓPRIA (dono 18/08, caso Fernanda⇄Daniela: "a Daniela
// assumiu o plantão mas ficou apenas o badge de troca — nesses casos quero que
// haja troca de posição"). É uma entrada separada da linha; a troca de sempre
// (registro, que é como a troca entre hospitais é feita) segue INTACTA.
describe('Modo posição — a nova opção "Trocar de posição na escala"', () => {
  const montarPosicao = (props = {}) => montar({ modo: 'posicao', ...props })

  it('nasce com as posições assumidas e o botão é "Trocar posição"', async () => {
    montarPosicao()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    expect(await screen.findByText('O que vai mudar na fila')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mauricio Bastos assume HRO' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Giovana Noll assume Unimed' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Trocar posição'))
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(2)
    expect(plan.lados.every((l) => l.tipo === 'posicoes')).toBe(true)
    expect(marcarTroca).not.toHaveBeenCalled()
  })

  // O caso do dono: quem assume NÃO tem posição própria aqui — Daniela entra no
  // plantão da Fernanda e a fila passa a mostrar a Daniela naquela posição.
  it('colega sem posição própria: ele assume a posição de quem abriu', async () => {
    montarPosicao()
    await escolherColega('COLEGA DE FORA')
    await waitFor(() => expect(botaoPrincipal()).toHaveTextContent('Trocar posição'))
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({ hospital: 'hro', para: { uid: 'uid-fora' }, tipo: 'posicoes' })
  })

  it('cada posição segue corrigível — marcar "fica" tira aquele lado do swap', async () => {
    montarPosicao()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('O que vai mudar na fila')
    marcar('Giovana Noll fica HRO')
    fireEvent.click(botaoPrincipal())
    await confirmarPopup()
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][0].lados).toHaveLength(1)
  })

  it('o tipo não é perguntado aqui — a opção já respondeu', async () => {
    montarPosicao()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('O que vai mudar na fila')
    expect(screen.queryByText('Tipo da troca')).toBeNull()
  })
})

// A TROCA DE SEMPRE NÃO MUDOU (dono 18/08: "nas outras modalidades de troca
// mantenha como está"): sem o modo posição nada vem pré-marcado e o tipo segue
// sendo só taxonomia do registro.
describe('Modo registro (o de sempre) segue intacto', () => {
  it('nada é pré-marcado e escolher o tipo não move ninguém', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('Quem fica com cada posição?')
    fireEvent.click(screen.getAllByRole('combobox')[1])
    fireEvent.click(await screen.findByRole('option', { name: TIPO_LABEL.posicoes }))
    expect(botaoPrincipal()).toBeDisabled() // as duas posições seguem por confirmar
    expect(screen.getByRole('button', { name: 'Mauricio Bastos assume HRO' })).toHaveAttribute('aria-pressed', 'false')
  })
})

// POP-UP ANTES DE CONCLUIR (dono 18/08): o swap mexe na fila dos dois lados e
// leva as cirurgias em aberto junto — nenhum caminho grava sem mostrar o resumo.
describe('Confirmação antes do swap', () => {
  it('o botão abre o pop-up com quem assume cada posição e quantas cirurgias vão junto', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Mauricio Bastos assume HRO')
    marcar('Giovana Noll assume Unimed')
    fireEvent.click(botaoPrincipal())
    expect(await screen.findByText('Trocar as posições?')).toBeTruthy()
    expect(screen.getByText('Mauricio Bastos assume a posição de Giovana Noll')).toBeTruthy()
    expect(screen.getByText('Giovana Noll assume a posição de Mauricio Bastos')).toBeTruthy()
    expect(screen.getAllByText(/1 cirurgia em aberto vai junto/).length).toBe(2)
    // nada foi gravado ainda
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('cancelar no pop-up não grava nada e devolve o sheet intacto', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Mauricio Bastos assume HRO')
    marcar('Giovana Noll assume Unimed')
    fireEvent.click(botaoPrincipal())
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    await waitFor(() => expect(screen.queryByText('Trocar as posições?')).toBeNull())
    expect(executarSubstituicao).not.toHaveBeenCalled()
    expect(botaoPrincipal()).toHaveTextContent('Trocar agora')
  })

  it('REGISTRO (ninguém muda de lugar) não pergunta — não há o que rever', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcar('Giovana Noll fica HRO')
    marcar('Mauricio Bastos fica Unimed')
    fireEvent.click(botaoPrincipal())
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Trocar as posições?')).toBeNull()
  })
})
