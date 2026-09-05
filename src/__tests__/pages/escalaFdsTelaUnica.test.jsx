/**
 * FIM DE SEMANA — tela única (dono 24/08).
 *
 * A escala de sáb/dom passa a ter UMA tela: a fila de liberação. Sem abas, sem
 * seletor de hospital, com o card trazendo hospital · sala · cirurgiões e o
 * botão "Terminei", e com o painel da linha ganhando Hospital, Responsável e
 * Posição na fila.
 *
 * ⚠️ O DIA ÚTIL NÃO MUDA — NADA daqui atravessa (dono 24/08, 2ª mensagem:
 * "faça apenas o solicitado sem alterar a escala de dias úteis"). Na primeira
 * versão o recado do plantonista, o botão "Importar", o "Terminei", a pastilha
 * "Assumir" e a nova ordem do card foram adotados também no dia útil; o dono
 * recusou. O describe do fim do arquivo é a trava da FRONTEIRA — ela já foi
 * cruzada uma vez.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import BarraControles from '@/pages/escala-cirurgica/BarraControles'
import { normNome } from '@/pages/escala-cirurgica/utils'

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchLocaisHospital: vi.fn(async () => []), fetchAvisos: vi.fn(async () => []) },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u1', displayName: 'Guilherme' } }),
}))
vi.mock('@/pages/escala-cirurgica/useAvisoPlantonista', () => ({
  default: () => ({ avisos: [], enviarAviso: vi.fn(), confirmarAviso: vi.fn(), excluirAviso: vi.fn(), historico: [], podeAvisar: true }),
}))
const ROSTER = [
  { uid: 'uid-karine', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-marilia', nome: 'MARILIA BASTOS', apelidos: ['MARILIA'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (n) => ROSTER.find((r) => r.apelidos.includes(String(n).toUpperCase()))?.uid || null,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// escala da FILA ÚNICA: a linha 'fds' não tem casos — eles vêm por hospital
const ESCALA_FDS = {
  id: 'fds-1', hospital: 'fds',
  ordemLiberacao: { matutino: ['KARINE', 'GABRIEL'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [],
}
const CASOS_FDS = [
  { id: 'c1', sala: 'CC - Sala 3', ordem: 0, hora: '07:30', turno: 'matutino', anestesista: 'KARINE', cirurgiao: 'Lucas Martins', procedimento: 'TROCA VALVAR', hospitalOrigem: 'unimed' },
  { id: 'c2', sala: 'Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'GABRIEL', cirurgiao: 'Plantao Orto', procedimento: 'CLAVICULA', hospitalOrigem: 'hro' },
]
const props = (extra = {}) => ({
  escala: ESCALA_FDS, hospital: 'fds', hospitalLabel: 'Fim de semana',
  canEdit: true, turno: 'matutino', modoFds: true, casosFds: CASOS_FDS,
  fdsMeta: { grade: {}, posicoes: {} },
  onToggle: vi.fn(), ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe('barra de controles — o fim de semana perde os eixos que não tem', () => {
  const base = {
    opcoesData: [{ value: 'hoje', label: 'Hoje' }], modoData: 'hoje', onEscolherData: vi.fn(),
    turnoOpcoes: [{ value: 'matutino', label: 'Manhã' }, { value: 'vespertino', label: 'Tarde' }],
    turno: 'matutino', onEscolherTurno: vi.fn(),
    hospital: 'unimed', onEscolherHospital: vi.fn(), aba: 'liberacoes', onEscolherAba: vi.fn(),
  }
  const HOSP = [{ value: 'unimed', label: 'Unimed' }, { value: 'hro', label: 'HRO' }]
  const ABAS = [{ value: 'minhas', label: 'Minhas' }, { value: 'board', label: 'Completa' }]

  it('no DIA ÚTIL hospital e abas continuam na tela', () => {
    render(<BarraControles {...base} hospitalOpcoes={HOSP} abaOpcoes={ABAS} />, { wrapper: wrap })
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
  })

  it('no FIM DE SEMANA os dois somem — a fila é única e a tela é uma só', () => {
    render(<BarraControles {...base} hospitalOpcoes={null} abaOpcoes={null} />, { wrapper: wrap })
    expect(screen.queryByRole('tab', { name: 'Unimed' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Completa' })).toBeNull()
    // o turno continua: ele é o eixo que sobra
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
  })
})

describe('card da fila — hospital isolado, sala abaixo, cirurgiões depois', () => {
  it('mostra o hospital da pessoa em linha própria', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    expect(await screen.findByText(/Karine/)).toBeTruthy()
    // hospital derivado dos casos: Karine na Unimed, Gabriel no HRO
    expect(screen.getByText('Unimed')).toBeTruthy()
    expect(screen.getByText('HRO')).toBeTruthy()
  })

  it('o cirurgião continua abaixo, e a sala entre os dois', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    expect(await screen.findByText('Lucas Martins')).toBeTruthy()
    expect(screen.getByText('CC - Sala 3')).toBeTruthy()
  })
})

/**
 * ⚠️ O "Terminei" FOI RETIRADO (dono 24/08, 3ª decisão sobre ele). O caminho foi:
 * criado como botão da linha para encerrar de uma vez as cirurgias em aberto →
 * restrito à fila única ("não altere a escala de dias úteis") → removido, com a
 * coluna de ações voltando a ser tempo + Editar, como no dia útil.
 *
 * Esta trava fica no lugar dos três testes que exercitavam o botão, para que a
 * remoção não pareça um esquecimento e para que ele não volte sem decisão: o
 * encerramento de cirurgia é no detalhe do caso, uma a uma.
 */
describe('sem "Terminei" na fila — a cirurgia se encerra no detalhe', () => {
  it('a coluna de ações tem só tempo e Editar', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    expect(screen.queryByText('Terminei')).toBeNull()
    expect(screen.queryByText('Encerrando…')).toBeNull()
    // o que fica é a mesma dupla do dia útil
    expect(screen.getAllByText('Editar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+ Tempo total').length).toBeGreaterThan(0)
  })
})

describe('alinhamento do card — número e círculo na linha do nome', () => {
  it('o card alinha pelo TOPO, não pelo centro', async () => {
    const { container } = render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const card = container.querySelector('[data-linha]')
    expect(card.className).toContain('items-start')
    expect(card.className).not.toContain('items-center')
  })

  it('o bloco de texto também alinha pelo topo — senão o hospital descola do nome', async () => {
    const { container } = render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const card = container.querySelector('[data-linha]')
    const interno = card.querySelector('[class*="justify-between"]')
    expect(interno.className).toContain('items-start')
  })
})

describe('alerta de sem anestesista — compacto', () => {
  const COM_ORFA = [...CASOS_FDS, {
    id: 'c9', sala: 'CO - Sala 3', ordem: 0, hora: '11:00', turno: 'matutino',
    anestesista: '?', semAnestesista: true, procedimento: 'CESARIANA',
    cirurgiao: 'Carlos Yora', hospitalOrigem: 'unimed',
  }]

  it('NÃO repete "Sem anestesista" dentro do card: o título logo acima já diz', async () => {
    render(<LiberacoesView {...props({ casosFds: COM_ORFA })} />, { wrapper: wrap })
    // o título da seção existe...
    expect(await screen.findByText(/Procedimentos sem anestesista/)).toBeTruthy()
    // ...e o badge dentro do card não: era a mesma frase duas vezes, e ele
    // empurrava a sala para a esquerda além de somar altura
    expect(screen.queryByText('Sem anestesista')).toBeNull()
  })
})

/**
 * PUBLICAÇÃO PINTA TODO MUNDO DE VERDE (dono 24/08): "ao publicar escala de final
 * de semana, todos os usuários apareçam com o card verde". A cauda vermelha
 * automática (21/08) nasceu do dia útil, onde o rodapé traz gente que fecha a
 * lista sem cirurgia; na fila única quem está publicado ESTÁ de plantão, e o mapa
 * cirúrgico chega separado — muitas vezes depois. Vermelho ali dizia "já foi
 * embora" de quem tinha acabado de entrar na escala.
 */
/**
 * ⚠️ ESTE DESCRIBE INTEIRO TROCOU DE LADO em 29/08, e o porquê fica aqui.
 *
 * Ele guardava o "PUBLICAÇÃO PINTA TODO MUNDO DE VERDE na fila única" (24/08) e
 * a exceção do vespertino (25/08). O dono pediu o oposto, por vocabulário:
 * *"quero que mude a marcação de 'livre' para liberado assim como já é
 * realizado em dias úteis, fica mais fácil dos usuários entenderem e
 * uniformiza"* — e escolheu, no protótipo, o vermelho de verdade e não só a
 * troca da palavra.
 *
 * O que sustentava a exceção era o plantão da faixa NÃO contar como trabalho:
 * com o mapa do fim de semana chegando vazio, a cauda ou pegava a fila inteira
 * ou não existia. Agora o plantão conta (ele cobre o hospital as 6 horas), e a
 * cauda começa logo abaixo dos dois postos — dois cards verdes no topo e o
 * resto vermelho até chegar cirurgia.
 *
 * ⚠️ O QUE NÃO MUDOU e continua travado abaixo: sem NINGUÉM trabalhando não há
 * cauda (guarda de 22/08 — senão a fila inteira nasce vermelha), e o vermelho
 * no MEIO da fila continua não sendo automático (incidente Eduardo, 20/08).
 */
describe('fila única — a cauda nasce liberada, como no dia útil', () => {
  const GRADE_MAT = { '7-13': { unimed: 'KARINE', hro: 'GABRIEL', ret1: 'OSCAR', ret2: 'THAYNA' } }
  const semCirurgiaNenhuma = {
    ...ESCALA_FDS,
    ordemLiberacao: { matutino: ['KARINE', 'GABRIEL', 'OSCAR', 'THAYNA'] },
  }

  it('sem grade e sem mapa, NINGUÉM nasce liberado (guarda de 22/08 intacta)', async () => {
    // nenhum nome com trabalho = não existe "depois do último com trabalho"
    render(<LiberacoesView {...props({ escala: semCirurgiaNenhuma, casosFds: [] })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
  })

  it('com os plantões da grade, a cauda abaixo deles nasce LIBERADA', async () => {
    // KARINE e GABRIEL são os postos das 7-13h e contam como trabalhando mesmo
    // sem cirurgia; OSCAR e THAYNA fecham a lista e saem vermelhos
    render(<LiberacoesView {...props({
      escala: semCirurgiaNenhuma, casosFds: [], fdsMeta: { grade: GRADE_MAT, posicoes: {} },
    })} />, { wrapper: wrap })
    await screen.findByText(/Oscar/)
    expect(screen.getAllByText('Liberado')).toHaveLength(2)
    // e os dois postos seguem verdes, com o papel no lugar do "Livre"
    expect(screen.getByText('Plantão Unimed')).toBeTruthy()
    expect(screen.getByText('Plantão HRO')).toBeTruthy()
    expect(screen.queryAllByText('Livre')).toHaveLength(0)
  })

  it('o plantão NUNCA fica "Livre" — ele cobre o hospital as 6 horas', async () => {
    render(<LiberacoesView {...props({
      escala: { ...ESCALA_FDS, ordemLiberacao: { matutino: ['KARINE', 'GABRIEL'] } },
      casosFds: [], fdsMeta: { grade: GRADE_MAT, posicoes: {} },
    })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    expect(screen.queryAllByText('Livre')).toHaveLength(0)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
  })

  it('TARDE de sáb/dom também: a cauda depois do último com cirurgia sai vermelha', async () => {
    // era a exceção de 25/08 ("o vespertino da fila única fica fora por regra")
    render(<LiberacoesView {...props({
      turno: 'vespertino',
      fdsMeta: { grade: { '13-19': { unimed: 'KARINE', hro: 'GABRIEL', ret1: '', ret2: '' } }, posicoes: {} },
      escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'OSCAR', 'THAYNA'] } },
      casosFds: [
        { id: 'v1', sala: 'CC - Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: 'KARINE', cirurgiao: 'Ana Prado', procedimento: 'COLECISTECTOMIA', hospitalOrigem: 'unimed' },
      ],
    })} />, { wrapper: wrap })
    await screen.findByText(/Thayna/)
    expect(screen.getAllByText('Liberado')).toHaveLength(2)
  })
})

/**
 * DUAS QUEIXAS DO MESMO SÁBADO (dono 29/08), com a MESMA raiz: `naFila` — quem
 * conta para a ordem de liberação — foi escrito com premissas de DIA ÚTIL.
 *
 *   1. "Daniela está marcada como próxima a ir embora. Está errado, os plantões
 *      nunca vão embora."
 *   2. "É possível realizar a liberação fora da ordem já estabelecida" (print:
 *      ALEXANDRE, 6º de 8, liberado com o 7º e o 8º ainda na fila).
 *
 * A premissa era "sem cirurgia = sem posição na fila", verdadeira numa terça
 * (o rodapé traz gente que fecha a lista sem trabalho) e falsa no sáb/dom, onde
 * quem está publicado ESTÁ de plantão e o mapa cirúrgico chega SEPARADO. Com a
 * fila quase toda sem caso, ela ficava vazia: o "próximo" subia até o plantão
 * (queixa 1) e a trava de ordem de 27/07 não pegava ninguém (queixa 2). É a
 * mesma premissa que já teve de sair da cauda vermelha e do card branco em
 * 24/08 — a terceira vez que ela aparece no mesmo lugar.
 *
 * A fixture é a tarde do print: os dois plantões da faixa 13-19 abrindo a fila
 * (únicos com cirurgia) e a cauda sem caso nenhum.
 */
describe('fila única — a ordem de liberação vale mesmo sem cirurgia', () => {
  const GRADE_TARDE = { '13-19': { unimed: 'KARINE', hro: 'GABRIEL', ret1: '', ret2: '' } }
  const CASO = (id, quem, sala) => ({
    id, sala, ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: quem,
    cirurgiao: 'Ana Prado', procedimento: 'COLECISTECTOMIA', hospitalOrigem: 'unimed',
  })
  // MARILIA (3ª) está SEM cirurgia mas ACIMA de quem tem: fica na fila e espera
  // a vez. THAYNA fecha a lista sem nada e nasce liberada.
  const tarde = (extra = {}) => props({
    turno: 'vespertino',
    fdsMeta: { grade: GRADE_TARDE, posicoes: {} },
    escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['GABRIEL', 'KARINE', 'MARILIA', 'OSCAR', 'THAYNA'] } },
    casosFds: [CASO('v1', 'KARINE', 'CC - Sala 2'), CASO('v2', 'GABRIEL', 'Sala 3'), CASO('v3', 'OSCAR', 'CC - Sala 6')],
    ...extra,
  })

  it('quem está sem cirurgia NO MEIO da fila espera a vez — não sai com um toque', async () => {
    const onToggle = vi.fn()
    render(<LiberacoesView {...tarde({ onToggle })} />, { wrapper: wrap })
    await screen.findByText(/Marilia/)
    fireEvent.click(screen.getByLabelText('Marcar Marilia Bastos liberado'))
    expect(await screen.findByText('Libere Oscar primeiro')).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('quem fecha a fila sai normalmente', async () => {
    const onToggle = vi.fn()
    render(<LiberacoesView {...tarde({ onToggle })} />, { wrapper: wrap })
    await screen.findByText(/Oscar/)
    fireEvent.click(screen.getByLabelText('Marcar Oscar liberado'))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('o cartão amarelo cai em quem TRABALHA, e a cauda sem cirurgia já nasce liberada', async () => {
    render(<LiberacoesView {...tarde()} />, { wrapper: wrap })
    await screen.findByText(/Thayna/)
    const cartoes = screen.getAllByText('Próximo a ser liberado')
    expect(cartoes).toHaveLength(1)
    expect(cartoes[0].closest('[data-linha]').textContent).toContain('Oscar')
    expect(screen.getAllByText('Liberado')).toHaveLength(1) // THAYNA
  })

  /**
   * O estado normal de um turno do fim de semana RECÉM-TROCADO (dono 29/08): a
   * fila publicada está lá, o mapa cirúrgico ainda não. Sem ninguém trabalhando
   * não há cauda (guarda de 22/08), então todos continuam na ordem — mas o
   * cartão amarelo não tem em quem cair, e é isso que o dono pediu: "o próximo a
   * ser liberado deve ser o primeiro anestesista contendo informações sobre
   * escalação, e não o último da fila".
   */
  it('fila publicada sem mapa: ninguém amarelo, e a ordem continua travando', async () => {
    const onToggle = vi.fn()
    render(<LiberacoesView {...props({
      turno: 'vespertino', onToggle,
      escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['GABRIEL', 'KARINE', 'MARILIA', 'OSCAR'] } },
      casosFds: [], fdsMeta: { grade: {}, posicoes: {} },
    })} />, { wrapper: wrap })
    await screen.findByText(/Oscar/)
    expect(screen.queryAllByText('Próximo a ser liberado')).toHaveLength(0)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
    fireEvent.click(screen.getByLabelText('Marcar Marilia Bastos liberado'))
    expect(await screen.findByText('Libere Oscar primeiro')).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO em 05/09. Ele afirmava que o plantão da faixa
   * "sai sem esbarrar na ordem — está fora dela": um toque liberava. O dono
   * fechou a regra ao ver o P1 do HRO "Liberado" na noite de 05/09: "sempre os
   * dois plantões estão trabalhando e portanto SEMPRE devem estar trabalhando e
   * com a marcação dos badges". Fora da ordem ele continua — mas porque fica
   * até o fim do turno, não porque sai quando quiser.
   */
  it('o plantão está fora da ordem porque FICA — o toque avisa e não libera', async () => {
    const onToggle = vi.fn()
    render(<LiberacoesView {...tarde({ onToggle })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    fireEvent.click(screen.getByLabelText('Marcar Karine Bedin liberado'))
    expect(await screen.findByText('Karine Bedin é Plantão Unimed')).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
    expect(screen.getByText('Plantão Unimed').className).toMatch(/bg-primary/)
  })
})

/**
 * A NOITE FALA A MESMA LÍNGUA DO DIA (dono 29/08): "o turno da noite continua
 * com todos verdes, verifique". Até aqui TODO card noturno nascia verde por
 * construção — `fundirLinhasNoturnas` carimbava `teveCasos: true` em todos.
 * Esse carimbo existe para o DIA ÚTIL, onde os cards noturnos são fundidos na
 * lista do dia e sem ele o plantonista sem caso afundava para o fim; na fila
 * única a noite é um turno próprio e a lista só tem cards noturnos, então não
 * há para onde afundar — e o que sobra é a classificação.
 */
describe('fila única — a NOITE classifica como o dia', () => {
  const GRADE_NOITE = { '19-07': { unimed: 'KARINE', hro: 'GABRIEL', ret1: 'MARILIA', ret2: 'OSCAR' } }
  const noite = (extra = {}) => props({
    turno: 'noturno',
    fdsMeta: {
      grade: GRADE_NOITE, posicoes: {},
      ordemNoite: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'],
    },
    escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'] } },
    casosFds: [],
    ...extra,
  })

  it('SÓ os dois postos ficam verdes — todo o resto da fila nasce LIBERADO', async () => {
    render(<LiberacoesView {...noite()} />, { wrapper: wrap })
    await screen.findByText(/Marilia/)
    expect(screen.getByText('Plantão Unimed')).toBeTruthy()
    expect(screen.getByText('Plantão HRO')).toBeTruthy()
    expect(screen.getAllByText('Liberado')).toHaveLength(2)
    // e o rótulo de retaguarda saiu da tela (dono 29/08)
    expect(document.body.textContent).not.toMatch(/Retaguarda/)
  })

  /**
   * ⚠️ ESTE TESTE TROCOU DE LADO no mesmo dia em que nasceu (29/08). Ele
   * afirmava que quem herdou a cirurgia da tarde continua VERDE à noite. O dono
   * fechou a regra logo depois: "ao trocar de turno todos fiquem liberados
   * exceto os plantões (HRO e Unimed)". A cirurgia que aparece no card noturno é
   * HERANÇA do turno anterior — quem estava em sala às 18h59 foi liberado às
   * 19h, e é isso que a troca de turno significa.
   *
   * A cirurgia CONTINUA VISÍVEL (decisão de 15/08); o que ela deixou de fazer é
   * decidir quem está trabalhando no turno.
   */
  it('a cirurgia herdada da tarde APARECE, mas não segura ninguém no turno', async () => {
    render(<LiberacoesView {...noite({
      casosFds: [{
        id: 'n1', sala: 'CC - Sala 6', ordem: 0, hora: '15:45', turno: 'vespertino',
        anestesista: 'MARILIA', cirurgiao: 'Cesar Bombardelli', procedimento: 'HERNIORRAFIA',
        hospitalOrigem: 'unimed',
      }],
    })} />, { wrapper: wrap })
    await screen.findByText(/Marilia/)
    // a cirurgia da tarde segue na tela…
    expect(screen.getByText('Cesar Bombardelli')).toBeTruthy()
    // …e MARILIA e OSCAR estão liberados: só os dois postos ficam
    expect(screen.getAllByText('Liberado')).toHaveLength(2)
  })

  /**
   * OS DOIS PLANTÕES DO TURNO ESTÃO SEMPRE TRABALHANDO (dono 05/09: "sempre os
   * dois plantões estão trabalhando e portanto SEMPRE devem estar trabalhando e
   * com a marcação dos badges"). Em 05/09 um toque às 12:03 no card da noite do
   * P1 do HRO o deixou "Liberado" e sem o selo — a fila da noite ficou sem o
   * plantão do HRO. O posto da grade não se libera: nem por marcação já gravada,
   * nem por toque, nem pela cauda automática.
   */
  it('o posto do turno NUNCA fica liberado: a marcação é ignorada e o toque não libera', async () => {
    const onToggle = vi.fn(async () => {})
    render(<LiberacoesView {...noite({
      onToggle,
      escala: {
        ...ESCALA_FDS,
        ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'] },
        liberacoes: { 'noite:GABRIEL': { em: '2026-09-05T15:03:19Z', por: 'u1', liberadoEm: '2026-09-05T15:03:19.050Z' } },
      },
    })} />, { wrapper: wrap })
    await screen.findByText(/Gabriel/)
    // só Marilia e Oscar liberados — o posto do HRO segue trabalhando, com o selo
    expect(screen.getAllByText('Liberado')).toHaveLength(2)
    expect(screen.getByText('Plantão HRO').className).toMatch(/bg-primary/)
    // e o toque no círculo dele avisa em vez de liberar: nada é escrito
    fireEvent.click(screen.getByRole('button', { name: /Marcar Gabriel liberado/ }))
    expect(await screen.findByText(/Gabriel é Plantão HRO/)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('o plantão da noite nunca fica "Livre" nem vermelho, mesmo sem cirurgia', async () => {
    render(<LiberacoesView {...noite()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const posto = document.querySelector('[data-linha="noite:uid-karine"]')
      || document.querySelector('[data-linha="noite:KARINE"]')
    expect(posto.textContent).not.toMatch(/Livre|Liberado/)
  })
})

/**
 * TROCA DE UM TURNO SÓ, TAMBÉM À NOITE (dono 29/08): "há várias trocas entre
 * colegas que fazem apenas um turno (de P1-P4, eventualmente outros Pn) — quero
 * que adicione a possibilidade de troca apenas naquele turno caso já não venha
 * descrito na escala de posições e fila", e depois: "quero que ao clicar em
 * 'editar' todos os turnos tenham todas as mesmas opções, sem divergir
 * independente de turno".
 *
 * O painel do card NOTURNO era o único sem "Responsável" e sem "Posição na
 * fila" — os dois exigiam `!editor.noturno`. Mais do que o botão faltando: a
 * gravação usava o namespace do turno de CASOS (a tarde), então a assunção da
 * noite ia parar numa chave que a tela da noite não lê.
 */
describe('fila única — o painel é o mesmo em todos os turnos', () => {
  const GRADE_NOITE = { '19-07': { unimed: 'KARINE', hro: 'GABRIEL', ret1: 'MARILIA', ret2: 'OSCAR' } }
  const noite = (extra = {}) => props({
    turno: 'noturno',
    fdsMeta: { grade: GRADE_NOITE, posicoes: {}, ordemNoite: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'] },
    escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'] } },
    casosFds: [], ...extra,
  })
  const abrirEditor = async (nome) => {
    fireEvent.click(await screen.findByLabelText(new RegExp(`Editar local/cirurgião de ${nome}`)))
  }

  it('o card noturno ganhou "Responsável" e "Posição na fila"', async () => {
    render(<LiberacoesView {...noite()} />, { wrapper: wrap })
    await abrirEditor('Karine Bedin')
    expect(screen.getByText('Responsável')).toBeTruthy()
    expect(screen.getByText('Posição na fila')).toBeTruthy()
    // e o que já existia continua
    expect(screen.getByText('Hospital')).toBeTruthy()
    expect(screen.getByText('Observação')).toBeTruthy()
  })

  it('a troca da noite grava na chave da NOITE, não na da tarde', async () => {
    const onTrocarResponsavel = vi.fn()
    render(<LiberacoesView {...noite({ onTrocarResponsavel })} />, { wrapper: wrap })
    await abrirEditor('Karine Bedin')
    fireEvent.click(screen.getByText('Responsável'))
    // a chave do slot é a do card noturno — é ela que a tela da noite lê
    expect(screen.getByText('Posição na fila')).toBeTruthy()
    const card = document.querySelector('[data-linha^="noite:"]')
    expect(card).toBeTruthy()
  })

  it('quem assume o posto herda o badge de plantão e ganha "Substituindo X"', async () => {
    // override gravado na chave da noite, como a gravação passa a fazer
    render(<LiberacoesView {...noite({
      escala: {
        ...ESCALA_FDS,
        ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'MARILIA', 'OSCAR'] },
        linhaOverrides: {
          'noite:uid-karine': { assumidaPor: { uid: 'uid-marilia', nome: 'MARILIA BASTOS', casoIds: [] } },
        },
      },
    })} />, { wrapper: wrap })
    await screen.findByText('Plantão Unimed')
    const posto = document.querySelector('[data-linha="noite:uid-karine"]')
    // a posição continua sendo a da KARINE, mas quem responde é a MARILIA
    expect(posto.textContent).toContain('Marilia')
    expect(posto.textContent).toContain('Plantão Unimed')
    expect(posto.textContent).toContain('Substituindo Karine')
    // e o posto segue trabalhando: quem cobre não nasce liberado nem Livre
    expect(posto.textContent).not.toMatch(/Livre|Liberado/)
  })
})

describe('feriado — selos e plantão', () => {
  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO em 25/08, e o porquê fica aqui em vez de ele sumir.
   *
   * Ele afirmava que o feriado NÃO tem selo Pn nenhum — verdade enquanto a única
   * fonte considerada era a grade do fim de semana, que no feriado é vazia. O
   * dono pediu o oposto no fim do dia: "informe quem são os plantões (P1–P4)
   * assim como já é informado nas escalas de dias úteis... apenas nos feriados,
   * já que dias úteis e finais de semana já possuem essas marcações".
   *
   * A fonte é a do DIA ÚTIL (o card Plantões), não a grade — a folha do feriado
   * não traz posição nenhuma. O que continua verdadeiro, e segue afirmado
   * abaixo, é que a numeração P5+ da grade do FDS não aparece aqui.
   */
  it('o selo P1–P4 vem do card Plantões, como no dia útil', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
    try {
      const { container } = render(<LiberacoesView {...props({
        escala: { ...ESCALA_FDS, data: '2026-08-25' },
        fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {} },
        plantoes: [{ setor: 'P1', nome: 'KARINE' }, { setor: 'P2', nome: 'GABRIEL' }],
      })} />, { wrapper: wrap })
      await screen.findByText(/Karine/)
      const selos = [...container.querySelectorAll('[data-selo]')].map((e) => e.getAttribute('data-selo'))
      expect(selos.sort()).toEqual(['P1', 'P2'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem plantão no card do dia, nenhum selo é inventado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
    try {
      const { container } = render(<LiberacoesView {...props({
        escala: { ...ESCALA_FDS, data: '2026-08-25' },
        fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {} },
        plantoes: [],
      })} />, { wrapper: wrap })
      await screen.findByText(/Karine/)
      expect(container.querySelectorAll('[data-selo]')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a numeração P5+ da grade do FDS não atravessa para o feriado', async () => {
    // `fdsMeta.posicoes` é a fonte dos Pn do fim de semana (P1–P12). No feriado
    // ela é vazia; se um meta legado trouxer posições, elas não podem virar selo
    // aqui — seriam outra numeração, com outro significado, no mesmo lugar.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
    try {
      const { container } = render(<LiberacoesView {...props({
        escala: { ...ESCALA_FDS, data: '2026-08-25' },
        fdsMeta: { tipo: 'feriado', grade: {}, posicoes: { P7: 'KARINE', P8: 'GABRIEL' } },
        plantoes: [{ setor: 'P1', nome: 'KARINE' }],
      })} />, { wrapper: wrap })
      await screen.findByText(/Karine/)
      const selos = [...container.querySelectorAll('[data-selo]')].map((e) => e.getAttribute('data-selo'))
      expect(selos).toEqual(['P1'])
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * Dono 25/08: "o primeiro e segundo nomes da lista sempre serão plantão de
   * algum hospital conforme ordem de liberação (ou seja os dois últimos a serem
   * liberados são os plantões)". No feriado não há grade P1–P4, então o selo sai
   * da ORDEM PUBLICADA do turno exibido — posições 1 e 2 são, por convenção do
   * rodapé, os dois últimos a serem liberados — e o hospital, das cirurgias do dia.
   *
   * ⚠️ A fixture tem QUATRO nomes de propósito. Com dois, a folha e a ordem
   * invertida contêm as mesmas pessoas e QUALQUER regra passa: foi assim que a 1ª
   * versão do selo atravessou os testes.
   */
  const ORDEM_FOLHA = ['KARINE', 'GABRIEL', 'MARILIA', 'RENATO']
  const feriado = (extra = {}) => props({
    escala: {
      ...ESCALA_FDS,
      data: '2026-08-25',
      // a tarde é a folha DE TRÁS PARA FRENTE (é o que a publicação grava)
      ordemLiberacao: { matutino: ORDEM_FOLHA, vespertino: [...ORDEM_FOLHA].reverse() },
    },
    casosFds: [
      ...CASOS_FDS,
      { id: 'c3', sala: 'CC - Sala 5', ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: 'MARILIA', cirurgiao: 'Ana Prado', procedimento: 'COLECISTECTOMIA', hospitalOrigem: 'unimed' },
      { id: 'c4', sala: 'Sala 6', ordem: 0, hora: '13:00', turno: 'vespertino', anestesista: 'RENATO', cirurgiao: 'Helio Machado', procedimento: 'OSTEOSSINTESE', hospitalOrigem: 'hro' },
    ],
    fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {}, listaFonte: ORDEM_FOLHA },
    ...extra,
  })

  // pela CHAVE da linha, não pelo nome: o card exibe "Renato", não "RENATO"
  const cardDe = (chave) => document.querySelector(`[data-linha="${chave}"]`)

  it('de manhã o selo é de quem FECHA a fila — os dois primeiros da folha', async () => {
    render(<LiberacoesView {...feriado()} />, { wrapper: wrap })
    expect(await screen.findByText('Plantão Unimed')).toBeTruthy()   // KARINE, 1ª da ordem
    expect(screen.getByText('Plantão HRO')).toBeTruthy()             // GABRIEL, 2º
    expect(screen.queryByText('Plantonista')).toBeNull()             // o genérico não volta
  })

  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO, e o porquê fica aqui em vez de o teste sumir.
   *
   * Ele afirmava o contrário — que o selo vale nos dois turnos porque "estar de
   * plantão é da PESSOA, não da posição" (o plantão do feriado é 07h→07h). O dono
   * corrigiu no mesmo dia, olhando a tela da tarde: "os dois últimos a serem
   * liberados devem receber o badge de plantão e os primeiros a serem liberados
   * (que foram os plantões da manhã) devem perder os badges".
   *
   * A razão é o que o selo COMUNICA numa fila: quem ainda vai ficar. Saindo da
   * folha, que não vira, de tarde ele aparecia sobre quem estava indo embora
   * PRIMEIRO e não dizia nada sobre quem ficaria até a noite — exatamente ao
   * contrário do que a fila precisa mostrar.
   */
  it('à tarde o selo TROCA de dono: vai para quem fecha a fila e sai de quem já vai embora', async () => {
    render(<LiberacoesView {...feriado({ turno: 'vespertino' })} />, { wrapper: wrap })
    await screen.findByText('Plantão HRO')
    // a tarde inverte: RENATO (1º da ordem vespertina) e MARILIA (2ª) fecham a fila
    expect(cardDe('RENATO').textContent).toContain('Plantão HRO')
    expect(cardDe('uid-marilia').textContent).toContain('Plantão Unimed')
    // e os plantões da MANHÃ perdem o selo — eles são os primeiros a sair agora
    expect(cardDe('uid-karine').textContent).not.toMatch(/Plantão|Plantonista/)
    expect(cardDe('GABRIEL').textContent).not.toMatch(/Plantão|Plantonista/)
  })

  /**
   * Dono 25/08: "os usuários que não tiverem casos deixe como liberados". A
   * cauda vermelha automática (21/08, dia útil) passa a valer no FERIADO — no
   * feriado a lista e os mapas entram JUNTOS, então "sem caso" é informação de
   * verdade, diferente do sáb/dom, onde o mapa chega depois (24/08).
   */
  it('MANHÃ do feriado: a cauda sem cirurgia nasce LIBERADA', async () => {
    const { container } = render(<LiberacoesView {...feriado({
      escala: {
        ...ESCALA_FDS, data: '2026-08-25',
        ordemLiberacao: { matutino: ['KARINE', 'GABRIEL', 'MARILIA'] },
      },
      fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {}, listaFonte: ['KARINE', 'GABRIEL', 'MARILIA'] },
    })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    // KARINE e GABRIEL têm cirurgia; MARILIA fecha a lista sem nenhuma
    const cards = [...container.querySelectorAll('[data-linha]')]
    expect(cards).toHaveLength(3)
    expect(cards[2].textContent).toMatch(/Marilia/)
    expect(cards[2].textContent).toMatch(/Liberado/)
    expect(cards[0].textContent).not.toMatch(/Liberado/)
    expect(cards[1].textContent).not.toMatch(/Liberado/)
  })

  /**
   * ⚠️ ESTES DOIS TESTES TROCARAM DE LADO em 29/08, e o porquê fica aqui.
   *
   * Eles guardavam o "VESPERTINO DA FILA ÚNICA — TODO MUNDO LIVRE" (dono 25/08:
   * "as escalas vespertinas, na maioria das vezes, estarão sem anestesistas
   * escalados... mantenha o esquema de todos estarem livres e não liberados").
   * Em 29/08 o dono unificou o vocabulário: *"quero que mude a marcação de
   * 'livre' para liberado assim como já é realizado em dias úteis, fica mais
   * fácil dos usuários entenderem e uniformiza"* — e a cauda sem cirurgia passou
   * a nascer LIBERADA em qualquer dia e turno da fila única, feriado incluído.
   *
   * A fixture continua sendo a que DISTINGUE a regra da sorte: MARILIA e RENATO
   * têm cirurgia à tarde, então a guarda de 22/08 (`temAlguemComTrabalho`) é
   * verdadeira e não segura nada — o resultado vem da regra, não do acaso de a
   * tarde estar 100% vazia.
   */
  it('TARDE do feriado: a cauda sem cirurgia nasce LIBERADA, como numa terça', async () => {
    const { container } = render(<LiberacoesView {...feriado({ turno: 'vespertino' })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const cards = [...container.querySelectorAll('[data-linha]')]
    expect(cards).toHaveLength(4)
    // KARINE e GABRIEL fecham a ordem vespertina sem caso: saem vermelhos
    expect(cardDe('uid-karine').textContent).toMatch(/Liberado/)
    expect(cardDe('GABRIEL').textContent).toMatch(/Liberado/)
    // e os dois plantões da tarde seguem trabalhando
    expect(cardDe('RENATO').textContent).not.toMatch(/Liberado/)
    expect(cardDe('uid-marilia').textContent).not.toMatch(/Liberado/)
  })

  it('TARDE do feriado com o mapa INTEIRO sem anestesista: a cauda ainda sai vermelha', async () => {
    // caso real de 25/08 — as 18 cirurgias saíram com "?" nos dois hospitais, e
    // naquele dia a guarda de 22/08 (`temAlguemComTrabalho`) segurava o vermelho
    // porque NINGUÉM contava como trabalhando. Com o plantão contando (29/08),
    // os dois que fecham a fila do turno já bastam para a cauda existir.
    //
    // ⚠️ a guarda NÃO morreu — ela continua valendo onde não há plantão nenhum a
    // apontar (sáb/dom com a grade ainda não importada, describe "a cauda nasce
    // liberada"). O que mudou é que no FERIADO o plantão é POSICIONAL (as duas
    // primeiras da ordem do turno), então ele sempre existe.
    const { container } = render(<LiberacoesView {...feriado({
      turno: 'vespertino',
      casosFds: [
        { id: 'v1', sala: 'CC - Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: '?', semAnestesista: true, cirurgiao: 'Makey Zortea', hospitalOrigem: 'unimed' },
      ],
    })} />, { wrapper: wrap })
    await screen.findByText(/Gabriel/)
    const cards = [...container.querySelectorAll('[data-linha]')]
    expect(cards.filter((c) => /Liberado/.test(c.textContent))).toHaveLength(2)
    // os dois plantões do turno seguem trabalhando, sem "Livre" e sem vermelho
    expect(cardDe('RENATO').textContent).not.toMatch(/Liberado|Livre/)
    expect(cardDe('uid-marilia').textContent).not.toMatch(/Liberado|Livre/)
  })

  it('quem não está nas duas primeiras posições da folha não recebe selo', async () => {
    render(<LiberacoesView {...feriado({
      escala: {
        ...ESCALA_FDS, data: '2026-08-25',
        ordemLiberacao: { matutino: ['KARINE', 'GABRIEL', 'MARILIA'] },
      },
      fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {}, listaFonte: ['KARINE', 'GABRIEL', 'MARILIA'] },
    })} />, { wrapper: wrap })
    await screen.findByText('Plantão Unimed')
    expect(screen.queryByText(/Plantão Marilia|Plantonista/)).toBeNull()
    expect(screen.getAllByText(/^Plantão /)).toHaveLength(2)
  })
})

describe('alerta de sem anestesista — a ação fica ABAIXO do texto', () => {
  /**
   * Terceira volta no mesmo alerta (dono 24/08): "Toque para definir" (dia útil)
   * → pastilha "Assumir" só no fim de semana → "Adicionar anestesista" → a
   * pastilha SAI e vale a frase abaixo, nos dois modos. O que decidiu foi a
   * medida: inline a pastilha comia 48% da linha (183px de 378) e sobravam
   * 195px para hora, hospital, sala, procedimento e cirurgião. Abaixo, o texto
   * recupera 388px por 22px de altura — e o alerta volta a ser um código só.
   */
  it('não há pastilha inline; a ação é a frase, e ela vale também na fila única', async () => {
    const comOrfa = [...CASOS_FDS, {
      id: 'c9', sala: 'CO - Sala 3', ordem: 0, hora: '11:00', turno: 'matutino',
      anestesista: '?', semAnestesista: true, procedimento: 'CESARIANA',
      cirurgiao: 'Carlos Yora', hospitalOrigem: 'unimed',
    }]
    render(<LiberacoesView {...props({ casosFds: comOrfa, onDefinirCasos: vi.fn() })} />, { wrapper: wrap })
    expect(await screen.findByText(/Toque para definir o anestesista/)).toBeTruthy()
    expect(screen.queryByText('Adicionar anestesista')).toBeNull()
    expect(screen.queryByText('Assumir')).toBeNull()
  })
})

describe('painel da linha — Hospital, Responsável e Posição só na fila única', () => {
  const abrirPainel = async (extra = {}) => {
    render(<LiberacoesView {...props(extra)} />, { wrapper: wrap })
    const editar = (await screen.findAllByRole('button', { name: /Editar local\/cirurgião/ }))[0]
    fireEvent.click(editar)
    return screen.findByText('Observação')
  }

  it('traz os três assuntos novos', async () => {
    await abrirPainel({ onTrocarResponsavel: vi.fn(), onTrocarPosicao: vi.fn() })
    expect(screen.getByText('Hospital')).toBeTruthy()
    expect(screen.getByText('Responsável')).toBeTruthy()
    expect(screen.getByText('Posição na fila')).toBeTruthy()
  })

  it('trocar o responsável mantém a CHAVE do slot — a posição não se move', async () => {
    const onTrocarResponsavel = vi.fn(async () => {})
    await abrirPainel({ onTrocarResponsavel })
    fireEvent.click(screen.getByText('Responsável'))
    const combo = screen.getAllByRole('combobox').pop()
    fireEvent.click(combo)
    fireEvent.click(await screen.findByText('MARILIA BASTOS'))
    fireEvent.click(screen.getByRole('button', { name: /Trocar responsável/ }))
    await waitFor(() => expect(onTrocarResponsavel).toHaveBeenCalled())
    const arg = onTrocarResponsavel.mock.calls[0][0]
    expect(arg.para.uid).toBe('uid-marilia')
    // a chave é a do slot ORIGINAL: marcações e ordem publicada seguem valendo
    expect(arg.chaveSlot).toBe('uid-karine')
    expect(arg.casoIds).toEqual(['c1'])
  })

  it('o seletor de Local NÃO abre vazio no fim de semana (defeito de 24/08)', async () => {
    await abrirPainel()
    fireEvent.click(screen.getByText('Local'))
    const combo = screen.getAllByRole('combobox').pop()
    fireEvent.click(combo)
    // a lista traz salas dos TRÊS hospitais quando nenhum foi escolhido
    // CC - Sala 1 é da Unimed e não está em nenhum caso do dia: só pode ter vindo
    // da base dos três hospitais, que é justamente o que faltava
    expect(await screen.findByText('CC - Sala 1')).toBeTruthy()
    // Sala 4 é do HRO e aparece DUAS vezes: no card do Gabriel e na lista
    expect(screen.getAllByText('Sala 4').length).toBeGreaterThan(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// NA FILA ÚNICA, AJUDA NUNCA É AUTOMÁTICA (dono, sáb 05/09)
// ════════════════════════════════════════════════════════════════════════════
/**
 * "nos finais de semana não existe a opção de ajuda (apenas como exceção), ou
 * seja nunca marque ajuda de forma automática; se houver será informado ou
 * marcado de forma manual."
 *
 * O que aconteceu na manhã de 05/09: a página cruza as escalas dos OUTROS
 * hospitais (`presencaOutros`) para marcar quem foi emprestado — caso lá e não
 * aqui = badge Ajuda + destino (dono 30/08, caso Oscar). No fim de semana não
 * existe "outro hospital": os casos dos três já estão mesclados em `casosFds`.
 * Mas a página seguia passando a presença dos outros dois, e todo mundo com
 * cirurgia no HRO nasceu "Ajuda" sem ninguém ter marcado nada. E o toggle do
 * painel não desmarcava: a marca não vinha de `ajuda_externa`, então ele
 * ADICIONAVA o nome — e a linha caía para o bloco do fim da fila.
 *
 * A mesma fixture nos dois modos, de propósito: só o gate `modoFds` separa os
 * resultados. Uma presença que não marcasse ninguém nem no dia útil não
 * provaria que o gate é o modo.
 */
describe('fila única — ajuda nunca é automática: só a marcada à mão', () => {
  // Gabriel tem cirurgia no HRO (Sala 4). Num dia útil, visto da Unimed, isso
  // é "emprestado ao HRO"; no fim de semana é só a cirurgia dele na fila.
  const PRESENCA_HRO = [
    // `nome` normalizado como a página grava (normNome), senão o card do destino não casa
    { nome: normNome('GABRIEL'), uid: null, hospital: 'hro', hospitalLabel: 'HRO', sala: 'Sala 4', cirurgiao: 'Plantao Orto' },
  ]
  // Marilia opera no HRO sem estar na ordem publicada: no dia útil, "extra
  // fora de todos os rodapés" vira Ajuda (dono 19/08); no fim de semana, não.
  const CASO_MARILIA = { id: 'c3', sala: 'Sala 2', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'MARILIA', cirurgiao: 'Dr. Y', procedimento: 'HERNIA', hospitalOrigem: 'hro' }

  it('presença em "outro hospital" não marca ninguém — e o toggle do painel nasce DESLIGADO', async () => {
    render(<LiberacoesView {...props({ presencaOutros: PRESENCA_HRO })} />, { wrapper: wrap })
    await screen.findByText(/Gabriel/)
    expect(screen.queryByText('Ajuda')).toBeNull()
    expect(screen.queryByText(/^Ajuda .*HRO/)).toBeNull()
    // o painel do Gabriel: "Marcar" (desligado), não "não é ajuda" (ligado) —
    // era o ligado-sem-fonte que fazia o toque ADICIONAR em vez de remover
    fireEvent.click(await screen.findByRole('button', { name: /Editar local\/cirurgião de Gabriel/ }))
    await screen.findByText('Observação')
    expect(screen.getByRole('button', { name: /Marcar Gabriel como ajuda de outro hospital/ })).toBeTruthy()
  })

  it('quem tem cirurgia sem estar na ordem entra na fila, mas SEM o badge', async () => {
    render(<LiberacoesView {...props({ casosFds: [...CASOS_FDS, CASO_MARILIA] })} />, { wrapper: wrap })
    await screen.findByText(/Marilia/)
    expect(screen.queryByText('Ajuda')).toBeNull()
  })

  it('a exceção continua existindo: ajuda MARCADA À MÃO leva o badge e o toggle desliga', async () => {
    const escala = { ...ESCALA_FDS, ajudaExterna: { matutino: ['MARILIA'] } }
    render(<LiberacoesView {...props({ escala, casosFds: [...CASOS_FDS, CASO_MARILIA] })} />, { wrapper: wrap })
    await screen.findByText(/Marilia/)
    expect(screen.getByText('Ajuda')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Editar local\/cirurgião de Marilia/ }))
    await screen.findByText('Observação')
    expect(screen.getByRole('button', { name: /não é ajuda de outro hospital/ })).toBeTruthy()
  })

  it('no dia útil a MESMA presença e o MESMO extra marcam Ajuda — o gate é o modo, não a fixture', async () => {
    const escala = {
      id: 'e-util', hospital: 'unimed',
      // Gabriel na ordem sem caso aqui (emprestado ao HRO); Marilia com caso e fora da ordem (extra)
      ordemLiberacao: { matutino: ['GABRIEL', 'KARINE'] },
      liberacoes: {}, linhaOverrides: {},
      casos: [CASOS_FDS[0], { ...CASO_MARILIA, sala: 'CC - Sala 2' }],
    }
    render(<LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" canEdit turno="matutino" onToggle={vi.fn()} presencaOutros={PRESENCA_HRO} />, { wrapper: wrap })
    await screen.findByText(/Gabriel/)
    expect(screen.getAllByText('Ajuda').length).toBe(2)
    expect(screen.getByText(/^Ajuda .*HRO/)).toBeTruthy()
  })
})


// ════════════════════════════════════════════════════════════════════════════
// A FRONTEIRA: o que é do fim de semana FICA no fim de semana (dono 24/08)
// ════════════════════════════════════════════════════════════════════════════
describe('o desenho da fila única não atravessa para o dia útil', () => {
  // mesma escala e mesmos casos, só que como um dia útil: um hospital, sem modoFds
  const ESCALA_UTIL = {
    id: 'e-util', hospital: 'unimed',
    ordemLiberacao: { matutino: ['KARINE', 'GABRIEL'] },
    liberacoes: {}, linhaOverrides: {},
    casos: [
      { id: 'c1', sala: 'CC - Sala 3', ordem: 0, hora: '07:30', turno: 'matutino', anestesista: 'KARINE', cirurgiao: 'Lucas Martins', procedimento: 'TROCA VALVAR' },
      { id: 'c2', sala: 'CC - Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'GABRIEL', cirurgiao: 'Plantao Orto', procedimento: 'CLAVICULA' },
    ],
  }
  const utilProps = (extra = {}) => ({
    escala: ESCALA_UTIL, hospital: 'unimed', hospitalLabel: 'Unimed',
    canEdit: true, turno: 'matutino', onToggle: vi.fn(), ...extra,
  })

  it('sem "Terminei" — no dia útil a cirurgia se encerra no detalhe, uma a uma', async () => {
    render(<LiberacoesView {...utilProps({ onTerminarCasos: vi.fn() })} />, { wrapper: wrap })
    await screen.findByText(/Karine/i)
    expect(screen.queryByText('Terminei')).toBeNull()
  })



  it('sem anestesista: volta a frase de sempre, não a pastilha "Assumir"', async () => {
    const escala = {
      ...ESCALA_UTIL,
      casos: [
        ...ESCALA_UTIL.casos,
        { id: 'c9', sala: 'CC - Sala 9', ordem: 0, hora: '08:00', turno: 'matutino', anestesista: '?', semAnestesista: true, procedimento: 'HERNIA', cirurgiao: 'Dr. X' },
      ],
    }
    render(<LiberacoesView {...utilProps({ escala, onDefinirCasos: vi.fn() })} />, { wrapper: wrap })
    expect(await screen.findByText(/Toque para definir o anestesista/)).toBeTruthy()
    expect(screen.queryByText('Assumir')).toBeNull()
  })

  it('a sala fica ABAIXO do cirurgião, e o hospital não aparece no card', async () => {
    const { container } = render(<LiberacoesView {...utilProps()} />, { wrapper: wrap })
    // a chave da linha é o uid do vínculo quando o dicionário resolve
    await screen.findByText(/Lucas Martins/)
    const card = container.querySelector('[data-linha="uid-karine"]')
    expect(card).toBeTruthy()
    // compara as FOLHAS (elemento sem filho elemento): comparar textContent de
    // qualquer nó acharia primeiro um ancestral, que contém as duas coisas e
    // deixaria o teste passar com qualquer ordem
    const folhas = [...card.querySelectorAll('p, span, div')].filter((e) => !e.querySelector('*'))
    const cir = folhas.find((e) => e.textContent.includes('Lucas Martins'))
    const sala = folhas.find((e) => e.textContent.trim() === 'CC - Sala 3')
    expect(cir).toBeTruthy()
    expect(sala).toBeTruthy()
    // DOCUMENT_POSITION_PRECEDING = o cirurgião vem ANTES da sala
    expect(sala.compareDocumentPosition(cir) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    // hospital em linha própria é do fim de semana: aqui a tela toda é de um só
    expect(card.textContent).not.toMatch(/UNIMED/)
  })
})
