/**
 * Duplicidade entre hospitais → TROCA DECLARADA (dono 06/08).
 *
 * Guilherme Didomenico apareceu escalado no HRO e na Unimed no mesmo turno. O
 * alerta já existia, mas a decisão morria na tela: as Liberações mostravam os
 * dois escalados normalmente, sem nenhum sinal de troca. E o botão de troca
 * oferecia "trocar com" a PRÓPRIA pessoa (a outra ocorrência dela), que não é
 * uma troca — ninguém troca consigo.
 *
 * Agora a conferência pergunta com QUEM foi a troca (seletor do roster) e grava
 * o mesmo `trocaCom` do ✏️ das Liberações, sob a chave namespaced do turno — é
 * por ela que a coluna de liberação reencontra o par e pinta o badge dos dois
 * lados.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, executarSubstituicao, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: (p.casos || []).map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
  executarSubstituicao: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: {
    // aviso de tempo estourado (24/08): sem isto o hook rejeita solto
    reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscala, executarSubstituicao }),
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

// Relógio congelado às 10h: `periodo` nasce de turnoAtual(), então sem isso o
// teste passaria de manhã e quebraria à tarde (a chave namespaced mudaria).
beforeAll(() => vi.setSystemTime(new Date('2026-08-06T13:00:00Z')))
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('duplicidade entre hospitais → troca declarada', () => {
  /** Unimed importando DIDO, que já tem caso no HRO no mesmo turno. */
  async function importarComDuplicidade() {
    svcMock.fetchEscala.mockImplementation(async (_data, hospital) => (
      hospital === 'hro'
        ? {
          id: 'e-hro', hospital: 'hro',
          casos: [{ sala: 'Sala 1', hora: '08:00', procedimento: 'ARTRODESE', anestesista: 'DIDO', turno: 'matutino' }],
          ordemLiberacao: { matutino: ['DIDO', 'PAULO'] },
        }
        : null
    ))
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
      ordemLiberacao: ['DIDO'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-08-06" onClose={vi.fn()} />, { wrapper: wrap },
    )
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] } })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    // desde 31/08 a duplicidade é linha de DECISÃO no cartão da fila; a folha
    // com o seletor e as saídas abre pelo toque nela
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))
    await screen.findByText(/Trocou com quem\?/i)
    return container
  }

  it('não oferece trocar com a própria pessoa duplicada', async () => {
    await importarComDuplicidade()
    // O seletor lista colegas — nunca quem está duplicado (o bug antigo era
    // justamente oferecer "Troca com Guilherme" na linha do Guilherme).
    fireEvent.click(screen.getByText(/Trocou com quem\?/i))
    expect(await screen.findByRole('option', { name: 'Paulo Tonini' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Guilherme Xavier' })).toBeNull()
  })

  it('bloqueia publicar enquanto a duplicidade não for classificada', async () => {
    await importarComDuplicidade()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(screen.getByText(/Confirme as duplicidades/i)).toBeTruthy())
    expect(salvarEscala).not.toHaveBeenCalled()
  })

  it('grava trocaCom na chave do turno, para o badge sair nos dois lados', async () => {
    await importarComDuplicidade()

    fireEvent.click(screen.getByText(/Trocou com quem\?/i))
    fireEvent.click(await screen.findByText('Paulo Tonini'))
    fireEvent.click(screen.getByRole('button', { name: /declarar a troca/i }))
    await screen.findByText(/troca declarada/i)

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(svcMock.patchLinhaOverride).toHaveBeenCalled())

    const [escalaId, chave, valor] = svcMock.patchLinhaOverride.mock.calls[0]
    expect(escalaId).toBe('e1')
    // chave namespaced pelo turno + identidade RESOLVIDA (uid), que é exatamente
    // o `linha.chave` que a coluna de liberação procura.
    expect(chave).toBe('matutino:uid-dido')
    // nome COMPLETO do cadastro: o cruzamento entre hospitais casa por normNome
    // do nome completo, não pelo apelido da escala.
    expect(valor.trocaCom).toMatchObject({ uid: 'uid-paulo', nome: 'PAULO TONINI' })
  })

  // O REGISTRO É DE QUEM ESTÁ AQUI (dono 03/09; audit A3). A resposta de duplicidade vale
  // para as três abas do lote, mas gravar `trocaCom` em TODAS punha um override órfão numa
  // escala onde a pessoa não aparece — e ele reaparecia em toda publicação futura, pintava
  // badge "Troca" em qualquer linha dela e auditava um evento no hospital errado.
  it('não grava trocaCom no hospital onde a pessoa duplicada não está', async () => {
    // A decisão vale para o lote inteiro, mas esta escala (Materno) não tem DIDO no rodapé
    // nem nos casos — gravar o override aqui deixaria um par órfão que ressurge em toda
    // publicação futura e pinta badge "Troca" numa linha que não existe.
    svcMock.fetchEscala.mockImplementation(async () => null)
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CO 1', hora: '08:00', procedimento: 'CESARIANA', cirurgiao: 'X', anestesista: 'PAULO' }],
      ordemLiberacao: ['PAULO'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage
        hospital="materno" data="2026-08-06" onClose={vi.fn()}
        decisoesLote={{ 'uid-dido': { tipo: 'troca', parceiroUid: 'uid-paulo', parceiroNome: 'PAULO TONINI' } }}
      />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'm.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
  })

  // INTENCIONAL PASSA A SER GRAVADO (dono 05/09; Onda 3 — audit A6). Até 04/09 a resposta
  // "trabalha nos dois hoje" morria no estado da conferência: republicar o turno, ou reabrir a
  // importação do mesmo dia, fazia a mesma pergunta travar a publicação de novo, e a fila não
  // tinha como dizer que a duplicidade era de propósito. O que NÃO mudou, e é o que este teste
  // sempre protegeu: intencional não declara troca nenhuma e não move ninguém de posição.
  it('confirmar como intencional grava a duplicidade — sem declarar nem executar troca', async () => {
    await importarComDuplicidade()
    fireEvent.click(screen.getByRole('button', { name: /Trabalha nos dois/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    // caminho legado (rpc_salvar_escala_cirurgica não aceita decisões): grava por patch
    await waitFor(() => expect(svcMock.patchLinhaOverride).toHaveBeenCalled())
    const [, chave, valor] = svcMock.patchLinhaOverride.mock.calls[0]
    expect(chave).toBe('matutino:uid-dido')
    expect(valor).toMatchObject({ duplicidade: 'intencional' })
    expect(valor.trocaCom).toBeUndefined()
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  // FASE 2 (dono 07/08 — "as trocas não saem de forma automática após leitura
  // das escalas"): a decisão TROCA agora executa o swap na publicação, com o
  // plano ANCORADO na declaração — a vaga duplicada AQUI vai para o parceiro e
  // a recíproca é a vaga do parceiro no hospital DELE. A posição onde o
  // duplicado VAI FICAR nunca é tocada.
  it('decisão troca EXECUTA na publicação: vaga daqui → parceiro; recíproca no hospital dele', async () => {
    await importarComDuplicidade()
    fireEvent.click(screen.getByText(/Trocou com quem\?/i))
    fireEvent.click(await screen.findByText('Paulo Tonini'))
    fireEvent.click(screen.getByRole('button', { name: /declarar a troca/i }))
    await screen.findByText(/troca declarada/i)

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))

    const [plan, , opts] = executarSubstituicao.mock.calls[0]
    // snapshot explícito: sem corrida com o realtime do context
    expect(opts?.escalasOverride).toBeTruthy()
    expect(plan.lados).toHaveLength(2)
    // vaga duplicada na Unimed (recém-publicada, id e1) → Paulo assume, com o tipo
    expect(plan.lados[0]).toMatchObject({
      escalaId: 'e1', chaveSlot: 'uid-dido',
      para: { uid: 'uid-paulo' }, tipo: 'entre_hospitais',
    })
    // recíproca: vaga do Paulo no HRO → Dido assume
    expect(plan.lados[1]).toMatchObject({
      escalaId: 'e-hro', chaveSlot: 'uid-paulo',
      para: { uid: 'uid-dido' },
    })
    // a vaga do DIDO no HRO (onde ele vai ficar) NÃO entra no swap
    expect(plan.lados.some((l) => l.escalaId === 'e-hro' && l.chaveSlot === 'uid-dido')).toBe(false)
  })

  it('parceiro sem posição em escala nenhuma → assunção unilateral (1 lado)', async () => {
    // HRO sem o PAULO no rodapé: ele é o "colega de fora" da taxonomia
    svcMock.fetchEscala.mockImplementation(async (_d, hospital) => (
      hospital === 'hro'
        ? {
          id: 'e-hro', hospital: 'hro',
          casos: [{ sala: 'Sala 1', hora: '08:00', procedimento: 'ARTRODESE', anestesista: 'DIDO', turno: 'matutino' }],
          ordemLiberacao: { matutino: ['DIDO'] },
        }
        : null
    ))
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '08:30', procedimento: 'COLECISTECTOMIA', cirurgiao: 'ALBA', anestesista: 'DIDO' }],
      ordemLiberacao: ['DIDO'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-08-06" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'e.png', { type: 'image/png' })] } })
    fireEvent.click(await screen.findByText(/Dido — em dois hospitais/i))

    fireEvent.click(await screen.findByText(/Trocou com quem\?/i))
    fireEvent.click(await screen.findByText('Paulo Tonini'))
    fireEvent.click(screen.getByRole('button', { name: /declarar a troca/i }))
    await screen.findByText(/troca declarada/i)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))

    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({ escalaId: 'e1', chaveSlot: 'uid-dido', para: { uid: 'uid-paulo' } })
  })
})
