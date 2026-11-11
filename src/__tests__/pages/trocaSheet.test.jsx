/**
 * TrocaSheet — o FLUXO ÚNICO de troca, em TRÊS PASSOS (dono 27/10: "há muitos botões
 * de trocas, crie um único botão e a partir dele opções de trocas com explicações").
 * Estes testes travam o contrato:
 *   1. nada é suposto: o passo 1 pergunta o que aconteceu (trocou de lugar · colega
 *      sem escala entra no lugar · só registrar), porque a escala pode sair JÁ
 *      trocada (dono 09–10/08) e mover nessa hora desfaz a troca real;
 *   2. "só registrar" grava trocaCom com `apenasRegistro`, sem mover ninguém;
 *   3. "trocou de lugar" move as posições do PAR, nos dois hospitais — não existe
 *      mais troca de um lado só entre hospitais (o caso Garim/Janaína de 27/10);
 *   4. "entra no lugar" é só para quem está SEM escala no turno;
 *   5. nada grava antes da prévia "Como a fila fica";
 *   6. o TIPO é inferido pela geografia; a própria pessoa não aparece na lista.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import TrocaSheet, { inferirTipoTroca } from '@/pages/escala-cirurgica/TrocaSheet'

const ROSTER = [
  { uid: 'uid-gio', nome: 'GIOVANA GOMES NOLL', apelidos: ['GIOVANA'] },
  { uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS', apelidos: ['MAURICIO'] },
  { uid: 'uid-fora', nome: 'COLEGA DE FORA', apelidos: ['FORA'] },
  { uid: 'uid-rose', nome: 'ROSEMARY CURY', apelidos: ['ROSE'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

const { marcarTroca, executarSubstituicao, setAnestesistaCasos } = vi.hoisted(() => ({
  setAnestesistaCasos: vi.fn(async () => {}),
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
  useEscalaCirurgicaActions: () => ({ marcarTroca, executarSubstituicao, setAnestesistaCasos }),
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

let ultimasProps = {}
const montar = (props = {}) => {
  ultimasProps = props
  return render(
    <TrocaSheet linha={LINHA_GIOVANA} escala={escalaHro} turno="matutino" onClose={vi.fn()} {...props} />,
    { wrapper: wrap },
  )
}

// Passo 1 → opção; passo 2 → colega; passo 3 → prévia
const opcao = async (rx) => {
  // ⚠️ 11/11/2026 (dono 10–11/11): "só registrar" SAIU do passo 1 — não era usado à mão desde
  // 27/10 e a publicação segue registrando. O código do registro continua no componente,
  // sem entrada na tela; os testes dele o abrem pela prop, direto no passo 2.
  if (rx === REGISTRO) {
    cleanup()
    render(<TrocaSheet linha={LINHA_GIOVANA} escala={escalaHro} turno="matutino" onClose={vi.fn()} {...ultimasProps} opcaoInicial="registro" />, { wrapper: wrap })
    await screen.findByRole('textbox', { name: 'Buscar colega pelo nome' })
    return
  }
  fireEvent.click(await screen.findByRole('button', { name: rx }))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}
const colega = async (rx) => {
  fireEvent.click(await screen.findByRole('button', { name: rx }))
  fireEvent.click(screen.getByRole('button', { name: 'Ver como fica' }))
}
const SALA = /Trocaram de SALA — a ordem de saída não muda/
const TROCOU = /Trocaram de POSIÇÃO na fila — muda quem sai primeiro/
const ENTRA = /saiu e um colega SEM ESCALA assume a posição/
const REGISTRO = /só registrar/
const MAU = /^Maurício Mahalem Bastos/
const botaoGravar = () => screen.getByRole('button', { name: /⇄|entra no lugar de|Registrar a troca/ })

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

describe('Passo 1 — o que aconteceu', () => {
  // ⚠️ MUDOU DE LADO em 11/11/2026 (dono 10–11/11, modelo B, bloco 4): as três respostas
  // eram "trocou de lugar · um colega entra no lugar · só registrar". Em 43 das 82 trocas de
  // posição desde 07/08 os dois eram da MESMA fila e 30% foram desfeitas em minutos — a
  // troca de sala, a situação mais comum, não existia aqui. Agora cada título diz o que
  // acontece com a ORDEM, "Trocaram de SALA" é a primeira e "só registrar" saiu da tela.
  it('três opções — SALA primeiro — com o efeito na ordem escrito, e nada vem marcado', async () => {
    montar()
    expect(await screen.findByText('Trocas de Giovana Noll')).toBeTruthy()
    expect(screen.getByText('1º na escala do HRO · S1')).toBeTruthy()
    const titulos = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).map((b) => b.textContent)
    expect(titulos).toHaveLength(3)
    expect(titulos[0]).toMatch(SALA)
    expect(titulos[1]).toMatch(TROCOU)
    expect(titulos[2]).toMatch(/Giovana Noll saiu e um colega SEM ESCALA assume a posição/)
    for (const rx of [SALA, TROCOU, ENTRA]) {
      expect(screen.getByRole('button', { name: rx })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByText('Cada um fica com as cirurgias do outro. As posições na fila não mudam.')).toBeTruthy()
    expect(screen.getByText(/passa a sair na vez do colega e o colega na vez de Giovana Noll/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /só registrar/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('"Declarar para depois" não existe mais (dono 09/08)', async () => {
    montar()
    await screen.findByText('Trocas de Giovana Noll')
    expect(screen.queryByRole('button', { name: /Declarar para depois/ })).toBeNull()
  })
})

describe('Passo 2 — com quem', () => {
  it('a própria pessoa fica fora da lista, e cada colega diz onde está', async () => {
    montar()
    await opcao(REGISTRO)
    expect(screen.queryByRole('button', { name: /^Giovana Gomes Noll/ })).toBeNull()
    expect(screen.getByRole('button', { name: MAU })).toHaveTextContent('2º · S2')
    expect(screen.getByText('Escala da Unimed')).toBeTruthy()
    expect(screen.getByText('Sem escala neste turno')).toBeTruthy()
  })

  it('"trocou de lugar" só aceita quem tem escala; "entra no lugar" só quem NÃO tem', async () => {
    montar()
    await opcao(TROCOU)
    expect(screen.getByRole('button', { name: /^Colega De Fora/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: MAU })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await opcao(ENTRA)
    expect(screen.getByRole('button', { name: MAU })).toBeDisabled()
    expect(screen.getByRole('button', { name: MAU })).toHaveTextContent(/Está na escala da Unimed/)
    expect(screen.getByRole('button', { name: /^Colega De Fora/ })).not.toBeDisabled()
  })

  it('a busca filtra pelo nome ou apelido', async () => {
    montar()
    await opcao(REGISTRO)
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar colega pelo nome' }), { target: { value: 'rose' } })
    expect(screen.getByRole('button', { name: /^Rosemary Cury/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: MAU })).toBeNull()
  })
})

describe('Passo 3 — a prévia é a confirmação', () => {
  it('"trocou de lugar": mostra as DUAS filas, diz quem vira plantonista e só grava no botão', async () => {
    montar()
    await opcao(TROCOU)
    await colega(MAU)
    expect(await screen.findByText(/como a fila fica/i)).toBeTruthy()
    const hro = document.querySelector('[data-fila-previa="hro"]')
    const uni = document.querySelector('[data-fila-previa="unimed"]')
    // a linha que muda diz quem entra e, embaixo, quem sai
    expect(hro).toHaveTextContent('1ºMaurício Bastossai Giovana Noll')
    expect(uni).toHaveTextContent('2ºGiovana Nollsai Maurício Bastos')
    expect(document.querySelector('[data-resumo-troca]')).toHaveTextContent(
      'Maurício Bastos fica com o 1º do HRO e Giovana Noll fica com o 2º da Unimed.',
    )
    expect(screen.getByText('Maurício Bastos passa a ser o plantonista do HRO.')).toBeTruthy()
    expect(executarSubstituicao).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'plantão' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar Giovana Noll ⇄ Maurício Bastos' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(2)
    for (const l of plan.lados) {
      expect(l.tipo).toBe('entre_hospitais')
      expect(l.motivo).toBe('plantão')
    }
    expect(marcarTroca).not.toHaveBeenCalled()
  })

  it('"Voltar" não grava nada', async () => {
    montar()
    await opcao(TROCOU)
    await colega(MAU)
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(await screen.findByRole('button', { name: 'Ver como fica' })).toBeTruthy()
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  // ⚠️ MUDOU DE LADO (dono 27/10). Antes cada posição tinha "fica/assume" e dava para
  // executar SÓ um dos lados entre hospitais ("metade já publicada trocada"). Na manhã
  // de 27/10 foi esse formato que deixou o HRO bagunçado: Garim assumiu a posição da
  // Janaína na Unimed e a dele no HRO ficou com ele, enquanto ela fazia o consultório
  // de lá. "Trocou de lugar" agora move SEMPRE as posições do par, e a prévia mostra os
  // dois hospitais antes de gravar.
  it('não existe mais troca de um lado só entre hospitais: o par troca inteiro', async () => {
    montar()
    await opcao(TROCOU)
    await colega(MAU)
    await screen.findByText(/como a fila fica/i)
    expect(screen.queryByRole('button', { name: /fica (HRO|Unimed)/ })).toBeNull()
    fireEvent.click(botaoGravar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][0].lados.map((l) => l.hospital).sort()).toEqual(['hro', 'unimed'])
  })

  it('"só registrar": grava trocaCom com apenasRegistro e não move ninguém', async () => {
    // caso real 10/08 — Rafael já está no HRO e Garim na Unimed; o que falta é o rastro
    montar()
    await opcao(REGISTRO)
    await colega(MAU)
    expect(await screen.findByText(/Ninguém muda de lugar. O selo Troca aparece no card de Giovana Noll e de Maurício Bastos/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'trocaram entre si' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a troca' }))
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    const [escala, linha, colegaGravado, , turno] = marcarTroca.mock.calls[0]
    expect(escala.id).toBe('esc-hro')
    expect(linha.chave).toBe('uid-gio')
    expect(colegaGravado).toMatchObject({
      uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS',
      tipo: 'entre_hospitais', motivo: 'trocaram entre si', apenasRegistro: true,
    })
    expect(turno).toBe('matutino')
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  // O caso Fernanda⇄Daniela (dono 18/08): quem entra NÃO tem posição própria — a fila
  // passa a mostrar a colega naquela posição, e quem estava sai deste turno.
  it('"entra no lugar": o colega sem escala assume a posição e quem abriu sai', async () => {
    montar()
    await opcao(ENTRA)
    await colega(/^Colega De Fora/)
    expect(await screen.findByText(/Giovana Noll sai da fila deste turno/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Colega Fora entra no lugar de Giovana Noll' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({ hospital: 'hro', para: { uid: 'uid-fora' }, tipo: 'assuncao' })
  })

  // REABERTURA a partir de uma troca JÁ REGISTRADA (dono 18/08): o painel abre a
  // folha com o colega e a opção — cai direto na prévia, sem gravar nada sozinho.
  it('reabrir de um registro (colega + "trocou de lugar") começa na prévia', async () => {
    montar({ colegaInicial: 'uid-mau', modo: 'posicao' })
    expect(await screen.findByText(/como a fila fica/i)).toBeTruthy()
    expect(executarSubstituicao).not.toHaveBeenCalled()
    fireEvent.click(botaoGravar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][0].lados).toHaveLength(2)
  })
})

// ── COLEGA FORA DA UNIMED/HRO (dono 13/08) ─────────────────────────────────
describe('Colegas fora da fila de Unimed/HRO', () => {
  it('colega do Materno: a troca fecha pelos CASOS, mesmo sem rodapé lá', async () => {
    montar()
    await opcao(TROCOU)
    await colega(/^Rosemary Cury/)
    const mat = await waitFor(() => {
      const el = document.querySelector('[data-fila-previa="materno"]')
      expect(el).toBeTruthy()
      return el
    })
    // a prévia do Materno diz que ali não há fila para herdar — só as cirurgias
    expect(mat).toHaveTextContent('Cirurgias de Rosemary Cury → Giovana Noll · sem fila de liberação')
    fireEvent.click(botaoGravar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    const lado = plan.lados.find((l) => l.hospital === 'materno')
    expect(lado).toMatchObject({ semPosicao: true, casoIds: ['m1'], para: { uid: 'uid-gio' } })
    // dois hospitais em jogo → é troca entre hospitais, não "colega de fora assume"
    expect(lado.tipo).toBe('entre_hospitais')
  })

  it('colega em lugar nenhum: no registro dá para dizer ONDE ele está', async () => {
    montar()
    await opcao(REGISTRO)
    await colega(/^Colega De Fora/)
    fireEvent.click(await screen.findByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Consultório' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a troca' }))
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(marcarTroca.mock.calls[0][2]).toMatchObject({ uid: 'uid-fora', local: 'Consultório', apenasRegistro: true })
  })

  it('colega que TEM escala no turno exibido não ganha campo de local', async () => {
    montar()
    await opcao(REGISTRO)
    await colega(MAU)
    await screen.findByText(/como a fila fica/i)
    expect(screen.queryByText(/Onde .* está/)).toBeNull()
  })

  // INCIDENTE 13/08 (Staub): fecha a MANHÃ do HRO e passa a TARDE no consultório.
  it('colega escalado só no OUTRO turno conta como sem escala e pode ser marcado no consultório', async () => {
    montar({ turno: 'vespertino' })
    await opcao(REGISTRO)
    // Maurício está no rodapé MATUTINO da Unimed; a tela é a tarde
    expect(screen.getByRole('button', { name: MAU })).not.toHaveTextContent('2º')
    await colega(MAU)
    expect(await screen.findByText(/Onde Maurício Bastos está à tarde/)).toBeTruthy()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Consultório' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a troca' }))
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    expect(marcarTroca.mock.calls[0][2]).toMatchObject({ uid: 'uid-mau', local: 'Consultório' })
  })

  // INCIDENTE 13/08 (Karine): quem aparece em DOIS hospitais no mesmo turno arrastava
  // o outro hospital para a troca. A posição em jogo é a da TELA de onde ela foi aberta.
  it('a posição trocada é a da escala aberta: o outro hospital dela não entra', async () => {
    const hroOriginal = escalasMock.hro
    escalasMock.hro = { ...escalaHro, ordemLiberacao: { matutino: ['GIOVANA', 'KARINE', 'ROSE'] } }
    try {
      const LINHA_ROSE = { chave: 'uid-rose', uid: 'uid-rose', anestesista: 'Rose Cury', nomeOriginal: 'ROSE' }
      render(
        <TrocaSheet linha={LINHA_ROSE} escala={escalaMaterno} turno="matutino" onClose={vi.fn()} />,
        { wrapper: wrap },
      )
      await opcao(TROCOU)
      await colega(MAU)
      await screen.findByText(/como a fila fica/i)
      // Materno (a tela) + Unimed (o colega). O HRO dela fica de fora.
      expect(document.querySelector('[data-fila-previa="materno"]')).toBeTruthy()
      expect(document.querySelector('[data-fila-previa="unimed"]')).toHaveTextContent('2ºRosemary Curysai Maurício Bastos')
      expect(document.querySelector('[data-fila-previa="hro"]')).toBeNull()
    } finally {
      escalasMock.hro = hroOriginal
    }
  })
})

/**
 * TROCA DE SALA, QUEM PASSA A SAIR ANTES DE QUEM, E O "DESFAZER" (dono 10–11/11/2026, modelo B
 * de `.tmp/analise-escala-2026-11/modelos-2/b-trocas.html`, blocos 4 e 7).
 */
describe('Trocaram de SALA — a ordem de saída não muda (dono 10–11/11)', () => {
  it('só aceita colega do MESMO hospital neste turno', async () => {
    montar()
    await opcao(SALA)
    expect(screen.getByRole('button', { name: MAU })).toBeDisabled()
    expect(screen.getByRole('button', { name: MAU })).toHaveTextContent('troca de sala é entre colegas daqui')
  })

  it('duas escritas de repasse, sem posição assumida, e um aviso só', async () => {
    // a Rose entra na fila do HRO (2ª) com uma cirurgia na S2
    const hroAntes = escalasMock.hro
    escalasMock.hro = {
      ...escalaHro,
      ordemLiberacao: { matutino: ['GIOVANA', 'ROSE'] },
      casos: [...escalaHro.casos, { id: 'h2', sala: 'S2', ordem: 0, anestesista: 'ROSE', anestesistaUserId: 'uid-rose', bloco: 'normal' }],
    }
    try {
      montar({ escala: escalasMock.hro })
      await opcao(SALA)
      await colega(/^Rosemary Cury/)
      expect(await screen.findByText('Trocaram de SALA')).toBeTruthy()
      const resumo = document.querySelector('[data-resumo-troca]').textContent
      expect(resumo).toMatch(/^Cada um fica com as cirurgias do outro\. As posições na fila não mudam\./)
      expect(resumo).toContain('Giovana Noll segue 1º e Rosemary Cury segue 2º.')
      expect(document.querySelector('[data-fila-previa]')).toBeNull() // ninguém muda de posição
      expect(screen.queryByPlaceholderText(/plantão trocado/)).toBeNull() // motivo é da troca de posição
      fireEvent.click(screen.getByRole('button', { name: 'Trocar as salas' }))
      await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(2))
      const [c1, c2] = setAnestesistaCasos.mock.calls
      expect([c1[1], c1[2].uid]).toEqual([['h1'], 'uid-rose'])
      expect([c2[1], c2[2].uid]).toEqual([['h2'], 'uid-gio'])
      expect(c1[3].silencioso).toBe(true)
      expect(c2[3].aviso).toEqual({ title: 'Salas trocadas', description: 'Giovana Noll ⇄ Rosemary Cury · a ordem de saída não muda' })
      expect(executarSubstituicao).not.toHaveBeenCalled()
      expect(marcarTroca).not.toHaveBeenCalled()
    } finally { escalasMock.hro = hroAntes }
  })
})

describe('"Trocaram de POSIÇÃO": o aviso desfazível', () => {
  it('no MESMO hospital a prévia nomeia quem passa a sair antes de quem', async () => {
    const hroAntes = escalasMock.hro
    const maternoAntes = escalasMock.materno
    escalasMock.hro = { ...escalaHro, ordemLiberacao: { matutino: ['GIOVANA', 'KARINE', 'ROSE'] } }
    escalasMock.materno = null // a Rose só no HRO: troca dentro do mesmo hospital
    try {
      montar({ escala: escalasMock.hro })
      await opcao(TROCOU)
      await colega(/^Rosemary Cury/)
      expect(await screen.findByText('Trocaram de POSIÇÃO na fila')).toBeTruthy()
      // Giovana (1ª) fica com a 3ª: a fila sai de baixo para cima, então ela passa a sair antes da 2ª
      expect(document.querySelector('[data-ultrapassagem]')).toHaveTextContent('Giovana Noll passa a sair antes de Karine.')
    } finally { escalasMock.hro = hroAntes; escalasMock.materno = maternoAntes }
  })


  it('a execução pede o "Desfazer" de 10 s ao context', async () => {
    montar()
    await opcao(TROCOU)
    await colega(MAU)
    await screen.findByText(/como a fila fica/i)
    fireEvent.click(botaoGravar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][2]).toEqual({ desfazivel: true })
  })
})
