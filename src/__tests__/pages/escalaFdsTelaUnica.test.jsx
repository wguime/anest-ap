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
describe('fila única — ninguém nasce vermelho na publicação', () => {
  const semCirurgiaNenhuma = {
    ...ESCALA_FDS,
    ordemLiberacao: { matutino: ['KARINE', 'GABRIEL', 'OSCAR', 'THAYNA'] },
  }

  it('escala recém-publicada, sem mapa cirúrgico ainda: nenhum card Liberado', async () => {
    render(<LiberacoesView {...props({ escala: semCirurgiaNenhuma, casosFds: [] })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
  })

  it('com mapa importado, quem fecha a lista sem cirurgia também segue verde', async () => {
    // no dia útil estes seriam a "cauda" e nasceriam vermelhos (regra de 21/08)
    render(<LiberacoesView {...props({ escala: semCirurgiaNenhuma })} />, { wrapper: wrap })
    await screen.findByText(/Oscar/)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
  })

  it('o badge "Livre" continua — a tinta some, a informação não', async () => {
    render(<LiberacoesView {...props({ escala: semCirurgiaNenhuma })} />, { wrapper: wrap })
    await screen.findByText(/Oscar/)
    expect(screen.getAllByText('Livre').length).toBeGreaterThan(0)
  })

  // "inclusive sábados e domingo" (dono 25/08): o vespertino da fila única fica
  // fora da cauda vermelha em qualquer dia, e não só quando ninguém tem caso.
  // Aqui KARINE tem cirurgia à tarde e os três seguintes não — no dia útil eles
  // seriam a cauda.
  it('TARDE de sáb/dom com alguém já designado: os demais seguem Livre', async () => {
    render(<LiberacoesView {...props({
      turno: 'vespertino',
      escala: { ...ESCALA_FDS, ordemLiberacao: { vespertino: ['KARINE', 'GABRIEL', 'OSCAR', 'THAYNA'] } },
      casosFds: [
        { id: 'v1', sala: 'CC - Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: 'KARINE', cirurgiao: 'Ana Prado', procedimento: 'COLECISTECTOMIA', hospitalOrigem: 'unimed' },
      ],
    })} />, { wrapper: wrap })
    await screen.findByText(/Thayna/)
    expect(screen.queryAllByText('Liberado')).toHaveLength(0)
  })
})

describe('feriado — sem selo Pn', () => {
  it('não herda os selos P1–P4 da regra noturna de segunda–sexta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
    try {
      const { container } = render(<LiberacoesView {...props({
        escala: { ...ESCALA_FDS, data: '2026-08-25' },
        fdsMeta: { tipo: 'feriado', grade: {}, posicoes: {} },
        plantoes: [{ setor: 'P1', nome: 'KARINE' }, { setor: 'P2', nome: 'GABRIEL' }],
      })} />, { wrapper: wrap })
      await screen.findByText(/Karine/)
      expect(container.querySelectorAll('[data-selo]')).toHaveLength(0)
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
   * VESPERTINO DA FILA ÚNICA — TODO MUNDO "LIVRE" (dono 25/08, fim da tarde):
   * "as escalas vespertinas, na maioria das vezes, estarão sem anestesistas
   * escalados... mantenha o esquema de todos estarem livres e não liberados; os
   * ajustes nos períodos vespertinos serão feitos manualmente".
   *
   * ⚠️ Este caso é o que DISTINGUE a regra da sorte. A fixture tem MARILIA e
   * RENATO com cirurgia à tarde, então `temAlguemComTrabalho` (a guarda de
   * 22/08) é verdadeira e NÃO segura nada: pela regra anterior, KARINE e GABRIEL
   * — que fecham a ordem vespertina sem caso — nasceriam vermelhos. Com o mapa
   * da tarde 100% vazio (o que aconteceu em 25/08) a guarda mascararia a
   * diferença e qualquer regra passaria.
   */
  it('TARDE do feriado: ninguém nasce liberado, mesmo com colegas já designados', async () => {
    const { container } = render(<LiberacoesView {...feriado({ turno: 'vespertino' })} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const cards = [...container.querySelectorAll('[data-linha]')]
    expect(cards).toHaveLength(4)
    expect(cards.filter((c) => /Liberado/.test(c.textContent))).toHaveLength(0)
    // e quem está sem cirurgia à tarde aparece como Livre, não como liberado
    // chave = uid quando o dicionário resolve; senão o nome normalizado
    expect(cardDe('uid-karine').textContent).toMatch(/Livre/)
    expect(cardDe('GABRIEL').textContent).toMatch(/Livre/)
  })

  it('TARDE do feriado com o mapa inteiro sem anestesista também fica toda Livre', async () => {
    // caso real de 25/08: as 18 cirurgias da tarde saíram com "?" nos dois
    // hospitais. Aqui quem segura é a guarda de 22/08 — as duas razões
    // coexistem de propósito, e é a de cima que vale quando a tarde vier
    // parcialmente preenchida.
    const { container } = render(<LiberacoesView {...feriado({
      turno: 'vespertino',
      casosFds: [
        { id: 'v1', sala: 'CC - Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino', anestesista: '?', semAnestesista: true, cirurgiao: 'Makey Zortea', hospitalOrigem: 'unimed' },
      ],
    })} />, { wrapper: wrap })
    await screen.findByText(/Gabriel/)
    const cards = [...container.querySelectorAll('[data-linha]')]
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.filter((c) => /Liberado/.test(c.textContent))).toHaveLength(0)
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
