/**
 * AS DECISÕES DA CONFERÊNCIA VIAJAM DENTRO DA PUBLICAÇÃO (Onda 3, item 3.1 da
 * auditoria de 02/09; achados A5, A6 e A9).
 *
 * Até 04/09 só `casos`, `ordem_liberacao` e `ajuda_externa` chegavam à RPC: a troca
 * declarada era um patch DEPOIS, com `.catch(() => {})`, e "trabalha nos dois hoje"
 * não era gravado em lugar nenhum. Republicar o mesmo turno apagava todo `turno:*`
 * de `linha_overrides` — trocaCom, assumidaPor, origem, observação, local e término
 * iam junto (foi o que obrigou a remarcar o Eduardo às 13:10 em 20/08).
 *
 * O que estas travas protegem, e que FALHA sem a correção:
 *  1. o payload da publicação leva as decisões por chave da linha;
 *  2. leva também a lista de preservação — rastro sim, liberação não (dono 05/09);
 *  3. `intencional` gravado na escala publicada não faz a pergunta travar de novo.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'
import { CAMPOS_RASTRO } from '@/lib/escalaPublicacaoDecisoes'

const { svcMock, salvarEscalaTurno, executarSubstituicao, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  salvarEscalaTurno: vi.fn(async (p) => ({
    id: 'e-unimed', ...p, casos: (p.casos || []).map((c, i) => ({ ...c, id: `c${i}`, ordem: i })),
  })),
  executarSubstituicao: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false,
    rosterByUid: new Map([
      ['uid-dido', { uid: 'uid-dido', nome: 'GUILHERME XAVIER', apelidos: ['DIDO'] }],
      ['uid-paulo', { uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] }],
    ]),
    options: [
      { value: 'uid-dido', label: 'Guilherme Xavier' },
      { value: 'uid-paulo', label: 'Paulo Tonini' },
    ],
    resolver: (nome) => ({ DIDO: 'uid-dido', PAULO: 'uid-paulo' })[String(nome).trim().toUpperCase()] || null,
    refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

beforeAll(() => vi.setSystemTime(new Date('2026-09-05T13:00:00Z')))
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

/** Unimed em conferência: DIDO com caso aqui e TAMBÉM no HRO publicado — a duplicidade clássica. */
async function conferirUnimed({ publicadaUnimed = null } = {}) {
  svcMock.fetchEscala.mockImplementation(async (_data, hospital) => {
    if (hospital === 'hro') {
      return {
        id: 'e-hro', hospital: 'hro',
        casos: [
          { id: 'h1', sala: 'Sala 1', hora: '08:00', procedimento: 'ARTRODESE', anestesista: 'DIDO', anestesistaUserId: 'uid-dido', turno: 'matutino' },
          { id: 'h2', sala: 'Sala 2', hora: '08:00', procedimento: 'HERNIA', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', turno: 'matutino' },
        ],
        ordemLiberacao: { matutino: ['DIDO', 'PAULO'] },
      }
    }
    return hospital === 'unimed' ? publicadaUnimed : null
  })
  svcMock.parseEscalaImagem.mockResolvedValueOnce({
    casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
    ordemLiberacao: ['DIDO'],
    ajudaExterna: [],
  })
  const { container } = render(
    <ImportarEscalaPage hospital="unimed" data="2026-09-05" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap },
  )
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], 'u.png', { type: 'image/png' })] },
  })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return container
}

const publicar = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Publicar/i }))
  // a publicação por turno confirma antes (hospital · data · turno)
  fireEvent.click(await screen.findByRole('button', { name: /^Publicar escala$/i }))
  await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
  return salvarEscalaTurno.mock.calls[0][0]
}

describe('a decisão da conferência entra no payload da publicação', () => {
  it('a troca declarada vai como trocaCom na chave da linha — sem patch depois', async () => {
    await conferirUnimed()
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    fireEvent.click(await screen.findByText(/Trocou com quem\?/i))
    fireEvent.click(await screen.findByText('Paulo Tonini'))
    // DIDO tem cirurgia nos dois: a folha mostra as duas posições em jogo (dono 05/09)
    fireEvent.click(screen.getByRole('button', { name: /assume Unimed$/i }))
    fireEvent.click(screen.getByRole('button', { name: /fica HRO$/i }))
    fireEvent.click(screen.getByRole('button', { name: /declarar a troca/i }))
    await screen.findByText(/troca declarada/i)

    const payload = await publicar()
    expect(payload.linhaOverrides).toEqual({
      'uid-dido': { trocaCom: expect.objectContaining({ uid: 'uid-paulo', nome: 'PAULO TONINI', tipo: 'entre_hospitais' }) },
    })
    // a declaração está DENTRO da transação: nada de patch fire-and-forget depois (audit A5)
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  it('"trabalha nos dois" viaja como duplicidade intencional (audit A6)', async () => {
    await conferirUnimed()
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    fireEvent.click(await screen.findByRole('button', { name: /Trabalha nos dois/i }))

    const payload = await publicar()
    expect(payload.linhaOverrides).toEqual({ 'uid-dido': { duplicidade: 'intencional' } })
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })
})

describe('republicar o mesmo turno preserva o rastro de quem segue na escala (dono 05/09)', () => {
  const publicadaComRastro = {
    id: 'e-unimed', hospital: 'unimed', updatedAt: '2026-09-05T09:00:00.000Z',
    casos: [{ id: 'u1', sala: 'CC - Sala 1', hora: '08:30', anestesista: 'DIDO', anestesistaUserId: 'uid-dido', turno: 'matutino' }],
    ordemLiberacao: { matutino: ['DIDO'] },
    linhaOverrides: { 'matutino:uid-dido': { observacao: 'saiu mais cedo', trocaCom: { uid: 'uid-paulo', nome: 'PAULO TONINI' } } },
    liberacoes: { 'matutino:uid-dido': { liberadoEm: '2026-09-05T11:00:00.000Z' } },
  }

  it('a publicação manda a lista de preservação: rastro sim, liberação não', async () => {
    await conferirUnimed({ publicadaUnimed: publicadaComRastro })
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    fireEvent.click(await screen.findByRole('button', { name: /Trabalha nos dois/i }))

    const payload = await publicar()
    expect(payload.preservar.campos).toEqual([...CAMPOS_RASTRO])
    expect(payload.preservar.campos).toEqual(
      expect.arrayContaining(['trocaCom', 'assumidaPor', 'origem', 'observacao', 'local', 'termino']),
    )
    // DIDO segue na ordem → entra na lista, com a grafia antiga como candidata
    expect(payload.preservar.linhas).toEqual([{ chave: 'uid-dido', candidatas: ['DIDO'] }])
    // a marca de Liberado continua zerando (regra 23/07 confirmada pelo dono em 05/09)
    expect(payload.preservar.linhas.some((l) => 'liberacao' in l)).toBe(false)
  })

  it('sem escala publicada não há o que preservar — o payload não leva a chave', async () => {
    await conferirUnimed()
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    fireEvent.click(await screen.findByRole('button', { name: /Trabalha nos dois/i }))

    const payload = await publicar()
    expect(payload.preservar).toBeUndefined()
  })

  it('o intencional gravado na escala publicada não faz a pergunta travar de novo', async () => {
    // republicando o MESMO turno: a resposta de ontem à noite está no banco
    await conferirUnimed({
      publicadaUnimed: {
        ...publicadaComRastro,
        linhaOverrides: { 'matutino:uid-dido': { duplicidade: 'intencional' } },
      },
    })
    // a linha já aparece respondida, sem toque nenhum nesta conferência
    expect(await screen.findByText(/trabalha nos dois hoje/i)).toBeTruthy()
    // e a publicação não é recusada por "duplicidade não classificada"
    const payload = await publicar()
    expect(payload.hospital).toBe('unimed')
    expect(screen.queryByText(/Confirme as duplicidades/i)).toBeNull()
  })
})

// ── A FOLHA "ONDE ESTÁ X HOJE?" (Onda 3, item 3.2; achados A1, A7 e A8) ────────────────
// A folha só sabia consertar a extração: ajuda, corrigir a posição, remover. As realidades
// clínicas — trocou, está no consultório, está certo assim — não tinham saída, e o dono
// relatou exatamente isso ("GARIM está na ordem sem cirurgia"). Cada saída nova grava no
// canal que a FILA já lê; é isso que estes testes travam.
describe('cada saída da folha grava no canal que a fila lê', () => {
  /** NATHALIA fecha o rodapé sem cirurgia nenhuma — é quem a folha pergunta. */
  async function comNathaliaSemCirurgia() {
    svcMock.fetchEscala.mockImplementation(async () => null)
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
      ordemLiberacao: ['DIDO', 'NATHALIA'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-09-05" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'u.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    fireEvent.click(await screen.findByText(/Nathalia — na ordem, sem cirurgia/i))
    return container
  }

  it('a folha pergunta onde a pessoa está, com posição, hospital e turno', async () => {
    await comNathaliaSemCirurgia()
    expect(await screen.findByText(/Onde está Nathalia hoje\?/i)).toBeTruthy()
    expect(screen.getByText(/2ª posição · Unimed · Matutino/i)).toBeTruthy()
    // fecha a lista sem cirurgia: a linha de dados avisa o que acontece se ficar assim
    expect(screen.getByText(/2ª posição · Unimed · Matutino/i).textContent).toMatch(/nasce\s+LIBERADO/i)
  })

  it('no passo "trocou com quem?" a folha não repete a consequência da cauda', async () => {
    await comNathaliaSemCirurgia()
    const dados = () => screen.getByText((_t, el) => el?.tagName === 'P' && /ª posição ·/.test(el.textContent || ''))
    expect(dados().textContent).toMatch(/nasce\s+LIBERADO/)

    fireEvent.click(await screen.findByRole('button', { name: /trocou com um colega/i }))
    await screen.findByText(/trocou com quem\?/i)
    // a pergunta ali já é outra — repetir "nasce LIBERADO" é ruído (protótipo L4)
    expect(dados().textContent).not.toMatch(/LIBERADO/)
    expect(dados().textContent).toMatch(/2ª posição · Unimed · Matutino/)
  })

  it('"Trocou com um colega" declara a troca com a vaga ancorada nesta escala', async () => {
    await comNathaliaSemCirurgia()
    fireEvent.click(await screen.findByRole('button', { name: /trocou com um colega/i }))
    fireEvent.click(await screen.findByText(/Escolher o colega/i))
    fireEvent.click(await screen.findByText('Paulo Tonini'))
    fireEvent.click(await screen.findByRole('button', { name: /^Trocou com Paulo/i }))

    const payload = await publicar()
    expect(payload.linhaOverrides).toEqual({
      NATHALIA: { trocaCom: expect.objectContaining({ uid: 'uid-paulo', nome: 'PAULO TONINI', tipo: 'entre_hospitais' }) },
    })
    // a ordem publicada não muda: quem troca não muda de lugar na fila
    expect(payload.ordemLiberacao).toEqual(['DIDO', 'NATHALIA'])
  })

  it('"Está no consultório" escreve a nota NA POSIÇÃO — a fila lê e não a libera sozinha', async () => {
    await comNathaliaSemCirurgia()
    fireEvent.click(await screen.findByRole('button', { name: /consultório ou de sobreaviso/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Consultório$/i }))

    const payload = await publicar()
    expect(payload.ordemLiberacao).toEqual(['DIDO', 'NATHALIA (CONSULT)'])
  })

  it('"Sobreaviso" usa a mesma nota — posição ATIVA, como o consultório (dono 04/09)', async () => {
    await comNathaliaSemCirurgia()
    fireEvent.click(await screen.findByRole('button', { name: /consultório ou de sobreaviso/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sobreaviso$/i }))

    const payload = await publicar()
    expect(payload.ordemLiberacao).toEqual(['DIDO', 'NATHALIA (SOBREAVISO)'])
  })

  it('"Está certo — fica Livre" grava conferido e tira a linha da lista (audit A8)', async () => {
    const container = await comNathaliaSemCirurgia()
    fireEvent.click(await screen.findByRole('button', { name: /está certo — fica livre/i }))
    // a linha some das pendências e vira registro respondido
    await waitFor(() => expect(within(container).queryByText(/Nathalia — na ordem, sem cirurgia/i)).toBeNull())
    expect(within(container).getByText(/Nathalia — está certo, fica Livre/i)).toBeTruthy()

    const payload = await publicar()
    expect(payload.linhaOverrides).toEqual({ NATHALIA: { conferido: true } })
    // nada foi mexido no rodapé: ela aguarda a vez na própria posição
    expect(payload.ordemLiberacao).toEqual(['DIDO', 'NATHALIA'])
  })

  it('o "está certo" gravado na escala publicada não faz a pergunta voltar', async () => {
    // republicando o MESMO turno: a resposta de ontem à noite está no banco
    svcMock.fetchEscala.mockImplementation(async (_d, hospital) => (hospital === 'unimed' ? {
      id: 'e-unimed', hospital: 'unimed',
      casos: [{ id: 'u1', sala: 'CC - Sala 1', anestesista: 'DIDO', anestesistaUserId: 'uid-dido', turno: 'matutino' }],
      ordemLiberacao: { matutino: ['DIDO', 'NATHALIA'] },
      linhaOverrides: { 'matutino:NATHALIA': { conferido: true } },
    } : null))
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
      ordemLiberacao: ['DIDO', 'NATHALIA'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-09-05" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'u.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())

    // a linha já nasce respondida, sem toque nenhum nesta conferência
    expect(await screen.findByText(/Nathalia — está certo, fica Livre/i)).toBeTruthy()
    expect(screen.queryByText(/Nathalia — na ordem, sem cirurgia/i)).toBeNull()

    // e "Refazer" reabre de verdade: viaja como null, senão a preservação a traria de volta
    fireEvent.click(screen.getByRole('button', { name: /refazer/i }))
    expect(await screen.findByText(/Nathalia — na ordem, sem cirurgia/i)).toBeTruthy()
    const payload = await publicar()
    expect(payload.linhaOverrides).toEqual({ NATHALIA: { duplicidade: null, conferido: null } })
  })

  it('"Remover da ordem" tira o nome da fila publicada', async () => {
    await comNathaliaSemCirurgia()
    fireEvent.click(await screen.findByRole('button', { name: /remover da ordem/i }))
    const payload = await publicar()
    expect(payload.ordemLiberacao).toEqual(['DIDO'])
    expect(payload.linhaOverrides).toBeUndefined()
  })
})

// ── O SNAPSHOT DA CONVERGÊNCIA ANDA JUNTO (item 3.5; audit A11) ────────────────────────
// A publicação executa os pares declarados num laço, um de cada vez, sobre o mesmo
// snapshot. Ele não era atualizado entre uma execução e a seguinte: com dois pares no
// mesmo turno, a segunda escrevia por cima da primeira (last-write-wins) e podia
// re-transferir casos. A RPC transacional devolve o estado resultante, e é ele que entra
// no snapshot antes da volta seguinte do laço.
describe('a execução seguinte enxerga a anterior', () => {
  it('o snapshot da 2ª execução já traz o assumidaPor que a 1ª gravou', async () => {
    // duas declarações vivas na escala publicada do HRO: DIDO⇄PAULO e PAULO⇄DIDO não
    // fecham par consigo; usamos duas chaves distintas para render duas execuções
    svcMock.fetchEscala.mockImplementation(async (_d, hospital) => (hospital === 'hro' ? {
      id: 'e-hro', hospital: 'hro',
      casos: [
        { id: 'h1', sala: 'Sala 1', anestesista: 'DIDO', anestesistaUserId: 'uid-dido', turno: 'matutino' },
        { id: 'h2', sala: 'Sala 2', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', turno: 'matutino' },
      ],
      ordemLiberacao: { matutino: ['DIDO', 'PAULO'] },
      linhaOverrides: {
        'matutino:uid-dido': { trocaCom: { uid: 'uid-paulo', nome: 'PAULO TONINI' } },
        'matutino:uid-paulo': { trocaCom: { uid: 'uid-dido', nome: 'GUILHERME XAVIER' } },
      },
    } : null))
    // a 1ª execução devolve o estado que a 2ª tem de enxergar
    executarSubstituicao.mockResolvedValueOnce({
      escalas: { 'e-hro': { 'matutino:uid-dido': { assumidaPor: { uid: 'uid-paulo', nome: 'PAULO TONINI' } } } },
      casos: [{ id: 'h1', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', semAnestesista: false }],
      pulados: 0, lados: 1,
    })
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
      ordemLiberacao: ['DIDO'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-09-05" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'u.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    fireEvent.click(await screen.findByRole('button', { name: /Trabalha nos dois/i }))
    await publicar()

    await waitFor(() => expect(executarSubstituicao.mock.calls.length).toBeGreaterThan(1))
    const [, , opts] = executarSubstituicao.mock.calls[1]
    // sem o retorno alimentando o snapshot, a 2ª execução ainda veria só o trocaCom
    expect(opts.escalasOverride.hro.linhaOverrides['matutino:uid-dido'].assumidaPor).toMatchObject({ uid: 'uid-paulo' })
    expect(opts.escalasOverride.hro.casos.find((c) => c.id === 'h1')).toMatchObject({ anestesistaUserId: 'uid-paulo' })
  })
})
