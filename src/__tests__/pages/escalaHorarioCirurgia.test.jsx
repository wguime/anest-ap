/**
 * "Horário da cirurgia" — início e término de cada procedimento (dono 02/10).
 *
 * Manhã (modelo A em `.tmp/inicio-termino-cirurgia.html`): cartão do horário ACIMA do
 * Andamento, nas abas Completa/Minhas/Urgências e na folha do "+ Tempo total".
 * Tarde (revisão em `.tmp/horario-compacto.html`), as travas deste arquivo:
 *  · cartão 35% mais baixo, blocos de uma linha; "Editar dados da cirurgia" virou a
 *    pílula "Editar" (o ActionPill da Home);
 *  · INÍCIO e TÉRMINO são horários EXATOS — tocar no bloco OU no botão Iniciada/
 *    Terminada abre o card que CONFIRMA o horário (agora, ou o já informado) e aceita o
 *    correto digitado; informar o término marca Terminada, como o início marca Iniciada;
 *  · o TEMPO ESTIMADO (a previsão de término de sempre) é um botão próprio: no topo do
 *    cartão e, nas Liberações, ao lado do nome de cada cirurgia; o painel abre no
 *    "Horário de término";
 *  · o tempo estimado CONTINUA ao lado da cirurgia no card da fila (dono, mesma tarde:
 *    "deve manter a configuração de tempos estimados conforme já havia sido
 *    estabelecido");
 *  · SINCRONIA: as telas leem o mesmo campo do caso.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'

const { atualizarCaso, setStatusCirurgia, setLinhaOverride } = vi.hoisted(() => ({
  atualizarCaso: vi.fn(async () => {}),
  setStatusCirurgia: vi.fn(async () => {}),
  setLinhaOverride: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', async (orig) => ({
  ...(await orig()),
  useEscalaCirurgicaActions: () => ({ atualizarCaso, setStatusCirurgia, setLinhaOverride, adicionarAjuda: vi.fn(), removerAjuda: vi.fn() }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-02', escalas: {}, data: '2026-10-02', loading: false }),
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-paulo', displayName: 'Paulo' } }) }))

const ROSTER = [{ uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] }]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: [], aliases: [], loading: false,
    resolver: (n) => (String(n || '').trim().toUpperCase() === 'PAULO' ? 'uid-paulo' : null),
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({ default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }) }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const COLE = 'COLECISTECTOMIA VIDEOLAPAROSCOPICA'
const HERNIA = 'HERNIORRAFIA INGUINAL'
const rot = (p) => nomeCurtoProcedimento(p)
const base = { sala: 'CC - Sala 3', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', cirurgiao: 'Marcos Zanella', turno: 'vespertino', bloco: 'normal' }
const emCurso = { ...base, id: 'c1', ordem: 0, hora: '13:30', procedimento: COLE, statusCirurgia: 'iniciada', inicioReal: '14:05', terminoPrevisto: '16:30' }
const proxima = { ...base, id: 'c2', ordem: 1, hora: '15:30', procedimento: HERNIA }
const terminada = { ...emCurso, statusCirurgia: 'terminada', terminoPrevisto: null, terminoReal: '15:22' }
const escalaDe = (casos) => ({
  id: 'e1', hospital: 'unimed', data: '2026-10-02',
  ordemLiberacao: { vespertino: ['PAULO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos,
})

const detalhe = (caso, casos = [caso], props = {}) =>
  render(<CasoDetalheSheet escala={escalaDe(casos)} caso={caso} turno="vespertino" onClose={vi.fn()} podeEditar onEditarCaso={vi.fn()} {...props} />, { wrapper: wrap })
const cartao = () => screen.getByRole('article', { name: 'Horário desta cirurgia' })
const folhaDeCima = () => { const d = screen.getAllByRole('dialog'); return d[d.length - 1] }
const digitar = (slot, valor) => {
  const campo = document.querySelector(`[data-slot="${slot}"] input`) || document.querySelector(`[data-slot="${slot}"]`)
  fireEvent.change(campo, { target: { value: valor } })
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-02T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('detalhe do caso: cartão compacto e pílula "Editar"', () => {
  it('o cartão fica ACIMA do Andamento, e o término não mora mais no Andamento', () => {
    detalhe(emCurso)
    const andamento = screen.getByText('Andamento').closest('article')
    expect(cartao().compareDocumentPosition(andamento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(andamento).queryByRole('button', { name: /Término desta cirurgia|Tempo estimado/ })).toBeNull()
  })

  it('"Editar dados da cirurgia" é a pílula "Editar" no canto (o ActionPill da Home)', () => {
    detalhe(emCurso)
    const pilula = screen.getByRole('button', { name: 'Editar dados da cirurgia' })
    expect(pilula.textContent).toBe('Editar')
    expect(pilula.className).toContain('absolute')
  })

  // ⚠️ MUDOU DE LADO em 10/11/2026 (modelo A aprovado pelo dono: "as três casas são SEMPRE
  // de uma cirurgia — Início · Tempo estimado · Término"). Era: "faltam 45min" e "Definir"
  // dentro do bloco TÉRMINO e o botão "Estimado 16:30" no título. Agora o "faltam" mora na
  // casa do TEMPO ESTIMADO (é dele que se fala) e o Término vazio é "—  ainda não informado".
  it('em andamento: três casas — início "há X", tempo estimado "faltam X", término "ainda não informado"', () => {
    detalhe(emCurso)
    const c = cartao()
    // ↳ 11/11/2026 (casas compactas): 52 px, só rótulo e valor; vazia é "—"; "há X" e "faltam X"
    // foram para UMA linha abaixo das três
    const ini = within(c).getByRole('button', { name: 'Início desta cirurgia: 14:05' })
    expect(ini.textContent).toBe('Início14:05')
    expect(ini.className).toContain('min-h-[52px]')
    const est = within(c).getByRole('button', { name: 'Tempo estimado desta cirurgia: 16:30' })
    expect(est.textContent).toBe('Tempo estimado16:30')
    const fim = within(c).getByRole('button', { name: 'Término desta cirurgia: não informado' })
    expect(fim.textContent).toBe('Término—')
    expect(c.querySelector('[data-apoio-casas]').textContent).toBe('Início: há 1h40 · Tempo estimado: faltam 45min')
    // a ordem das casas é a do modelo
    expect([...c.querySelectorAll('[data-casa]')].map((n) => n.getAttribute('data-casa'))).toEqual(['Início', 'Tempo estimado', 'Término'])
  })

  it('terminada: término real com "durou X", e o Estimado sai (a previsão já não conta)', () => {
    detalhe(terminada)
    const fim = within(cartao()).getByRole('button', { name: 'Término desta cirurgia: 15:22' })
    expect(fim.textContent).toBe('Término15:22')
    expect(cartao().querySelector('[data-apoio-casas]').textContent).toBe('Término: durou 1h17')
    expect(within(cartao()).queryByRole('button', { name: /Tempo estimado/ })).toBeNull()
  })

  it('quem NÃO edita a escala vê os horários, mas sem botão', () => {
    detalhe(emCurso, [emCurso], { podeEditar: false })
    expect(within(cartao()).getByText('14:05')).toBeTruthy()
    expect(within(cartao()).queryByRole('button')).toBeNull()
  })
})

describe('confirmar o horário: pelo botão Iniciada/Terminada (dono 02/10, tarde)', () => {
  it('tocar em Iniciada NÃO grava — abre o card com o horário de agora', async () => {
    detalhe(proxima, [emCurso, proxima])
    fireEvent.click(screen.getByRole('button', { name: 'Iniciada' }))
    expect(setStatusCirurgia).not.toHaveBeenCalled()
    const folha = folhaDeCima()
    expect(within(folha).getByText('Início da cirurgia')).toBeTruthy()
    expect(within(folha).getByText('15:45')).toBeTruthy()
    fireEvent.click(within(folha).getByRole('button', { name: 'Confirmar início às 15:45' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    const [, caso, status, info] = setStatusCirurgia.mock.calls[0]
    expect([caso.id, status]).toEqual(['c2', 'iniciada'])
    expect(info).toEqual({ userId: 'uid-paulo', inicioReal: '15:45' })
  })

  it('"foi em outro horário": digitar o correto grava ELE, sem segundo botão', async () => {
    detalhe(proxima, [emCurso, proxima])
    fireEvent.click(screen.getByRole('button', { name: 'Iniciada' }))
    digitar('inicio-hora', '1520')
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0][3]).toEqual({ userId: 'uid-paulo', inicioReal: '15:20' })
  })

  it('tocar em Terminada abre o card do término; confirmar marca Terminada com o horário', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    expect(setStatusCirurgia).not.toHaveBeenCalled()
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Confirmar término às 15:45' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0].slice(2)).toEqual(['terminada', { userId: 'uid-paulo', terminoReal: '15:45' }])
  })

  it('Iniciada já marcada: o card só CORRIGE o início (sem reenviar o status, que recarimbaria)', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciada' }))
    expect(within(folhaDeCima()).getByText('informado')).toBeTruthy()
    digitar('inicio-hora', '1350')
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0].slice(1)).toEqual(['c1', { inicioReal: '13:50' }, { silencioso: true }])
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('Agendada e os avisos continuam gravando no toque', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Agendada' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0][2]).toBe('agendada')
  })
})

describe('confirmar o horário: pelos blocos INÍCIO/TÉRMINO', () => {
  it('bloco INÍCIO de uma agendada: confirmar a marca Iniciada', async () => {
    detalhe(proxima, [emCurso, proxima])
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Início desta cirurgia: não informado' }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Confirmar início às 15:45' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0].slice(2)).toEqual(['iniciada', { userId: 'uid-paulo', inicioReal: '15:45' }])
  })

  it('bloco TÉRMINO de uma em andamento: informar o término marca Terminada', async () => {
    detalhe(emCurso)
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Término desta cirurgia: não informado' }))
    digitar('termino-real-hora', '1540')
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0].slice(2)).toEqual(['terminada', { userId: 'uid-paulo', terminoReal: '15:40' }])
  })

  it('horário no futuro é recusado com a frase, e nada é gravado', () => {
    detalhe(emCurso)
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Início desta cirurgia: 14:05' }))
    digitar('inicio-hora', '1700')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O início não pode ser depois de agora.')
    expect(atualizarCaso).not.toHaveBeenCalled()
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('terminada: corrigir o término grava terminoReal; antes do início é recusado', async () => {
    detalhe(terminada)
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Término desta cirurgia: 15:22' }))
    digitar('termino-real-hora', '1400')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O término não pode ser antes do início (14:05).')
    digitar('termino-real-hora', '1510')
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoReal: '15:10' })
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('"Limpar horário" (pelo bloco, com horário gravado) apaga só o horário', async () => {
    detalhe(emCurso)
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Início desta cirurgia: 14:05' }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Limpar horário' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ inicioReal: null })
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })
})

// 27/10 (Modelo 2): o painel não tem mais alternador — horário e durações à vista
describe('tempo estimado: o painel de sempre, horário e durações à vista', () => {
  it('o botão Estimado abre o painel com o campo e a grade; a duração grava a previsão', async () => {
    detalhe(emCurso)
    fireEvent.click(within(cartao()).getByRole('button', { name: /Tempo estimado desta cirurgia/ }))
    const folha = folhaDeCima()
    expect(within(folha).getByText('Tempo estimado desta cirurgia')).toBeTruthy()
    expect(folha.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
    fireEvent.click(within(folha).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoPrevisto: '16:45' })
  })
})

describe('Liberações: folha do "+ Tempo total"', () => {
  const montarFila = (casos, props = {}) => render(
    <LiberacoesView escala={escalaDe(casos)} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
      canEdit onToggle={() => {}} onSetOverride={() => {}}
      onDefinirInicioCaso={vi.fn(async () => {})} onDefinirTerminoRealCaso={vi.fn(async () => {})} {...props} />,
    { wrapper: wrap },
  )
  const abrirTempoTotal = () => fireEvent.click(screen.getByLabelText('Informar o tempo total de Paulo Tonini'))

  it('título direto: tempo total estimado de TODAS as cirurgias da pessoa', () => {
    montarFila([emCurso, proxima])
    abrirTempoTotal()
    const folha = screen.getByRole('dialog')
    expect(within(folha).getByText('Tempo total de Paulo Tonini')).toBeTruthy()
    // 10/11 (modelo A): "Tempo total de {Nome}" e a frase diz que é informado à mão
    expect(folha.textContent).toContain('Até quando Paulo fica no turno, contando as 2 cirurgias. Informado à mão: não é a soma delas.')
    expect(within(folha).getByText('Paulo fica até')).toBeTruthy()
    expect(within(folha).queryByText('Previsão de saída')).toBeNull()
  })

  it('cada cirurgia: tempo estimado ao lado do nome; início e término exatos embaixo', () => {
    montarFila([emCurso, proxima])
    abrirTempoTotal()
    const est = screen.getByRole('button', { name: `Tempo estimado de 13:30 ${rot(COLE)}: 16:30` })
    expect(within(est).getByText('16:30')).toBeTruthy()
    // 10/11 (modelo A): o tempo estimado é a casa do meio de cada cirurgia — "faltam" mora
    // nela; a que não tem estimado mostra "—" com "ainda não informado" (era o link "estimar")
    expect(est.closest('[data-cirurgia-tempos]').querySelector('[data-apoio-casas]').textContent).toContain('Tempo estimado: faltam 45min')
    expect(screen.getByRole('button', { name: `Tempo estimado de 15:30 ${rot(HERNIA)}: não informado` }).textContent).toBe('Tempo estimado—')
    const ini = screen.getByRole('button', { name: `Início de 13:30 ${rot(COLE)}: 14:05` })
    expect(ini.closest('[data-cirurgia-tempos]').querySelector('[data-apoio-casas]').textContent).toContain('Início: há 1h40')
    expect(screen.getByRole('button', { name: `Término de 13:30 ${rot(COLE)}: não informado` })).toBeTruthy()
  })


  it('INÍCIO abre a confirmação; "Confirmar" grava pelo onDefinirInicioCaso e a folha do total fica', async () => {
    const onDefinirInicioCaso = vi.fn(async () => {})
    montarFila([emCurso, proxima], { onDefinirInicioCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Início de 15:30 ${rot(HERNIA)}: não informado` }))
    const folha = folhaDeCima()
    expect(within(folha).getByText(`Início · 15:30 ${rot(HERNIA)}`)).toBeTruthy()
    expect(within(folha).getByText(/Ao confirmar, ela passa a Iniciada\./)).toBeTruthy()
    fireEvent.click(within(folha).getByRole('button', { name: 'Confirmar início às 15:45' }))
    await waitFor(() => expect(onDefinirInicioCaso).toHaveBeenCalledWith('c2', '15:45'))
    expect(screen.getByText('Tempo total de Paulo Tonini')).toBeTruthy()
  })

  it('TÉRMINO abre a confirmação e avisa que a cirurgia sai da lista; grava pelo onDefinirTerminoRealCaso', async () => {
    const onDefinirTerminoRealCaso = vi.fn(async () => {})
    montarFila([emCurso, proxima], { onDefinirTerminoRealCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 13:30 ${rot(COLE)}: não informado` }))
    const folha = folhaDeCima()
    expect(within(folha).getByText(/passa a Terminada e sai desta lista/)).toBeTruthy()
    digitar('termino-real-hora', '1530')
    await waitFor(() => expect(onDefinirTerminoRealCaso).toHaveBeenCalledWith('c1', '15:30'))
  })

  it('término antes do início também é recusado aqui', () => {
    const onDefinirTerminoRealCaso = vi.fn(async () => {})
    montarFila([emCurso, proxima], { onDefinirTerminoRealCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 13:30 ${rot(COLE)}: não informado` }))
    digitar('termino-real-hora', '1400')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O término não pode ser antes do início (14:05).')
    expect(onDefinirTerminoRealCaso).not.toHaveBeenCalled()
  })
})

describe('o card da FILA mantém o tempo estimado ao lado da cirurgia (dono 02/10, tarde)', () => {
  // ⚠️ MUDOU DE LADO em 10/11/2026 (modelo A aprovado pelo dono, bloco "quadro × fila: o
  // mesmo tempo com as mesmas palavras"): o card seguia com "faltam 45min" e "até 17:30".
  // O tempo estimado CONTINUA ao lado da cirurgia (pedido de 02/10) — muda a frase, que
  // agora é a mesma do quadro da Completa.
  it('em andamento "Tempo estimado HH:MM · faltam X"; agendada "Tempo estimado HH:MM · não começou"', () => {
    const comEstimativa = { ...proxima, terminoPrevisto: '17:30' }
    render(<LiberacoesView escala={escalaDe([emCurso, comEstimativa])} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
      canEdit onToggle={() => {}} onSetOverride={() => {}} />, { wrapper: wrap })
    const card = document.querySelector('[data-linha][data-nome="Paulo Tonini"]')
    expect(card).not.toBeNull()
    expect(card.textContent).toContain(rot(COLE))
    expect(card.textContent).toContain('Tempo estimado 16:30· faltam 45min')
    expect(card.textContent).toContain('Tempo estimado 17:30· não começou')
    expect(card.textContent).not.toContain('até 17:30')
  })
})

describe('SINCRONIA: as telas leem o mesmo campo do caso', () => {
  it('o início gravado (escala nova vinda do context/realtime) aparece no detalhe E na folha das Liberações', () => {
    const antes = escalaDe([{ ...proxima }])
    const depois = escalaDe([{ ...proxima, statusCirurgia: 'iniciada', inicioReal: '15:10' }])

    const det = render(<CasoDetalheSheet escala={antes} caso={antes.casos[0]} turno="vespertino" onClose={vi.fn()} podeEditar />, { wrapper: wrap })
    expect(screen.getByRole('button', { name: 'Início desta cirurgia: não informado' })).toBeTruthy()
    // o detalhe deriva o caso VIVO de `escala.casos` pelo id (prop congelado não basta)
    det.rerender(<CasoDetalheSheet escala={depois} caso={antes.casos[0]} turno="vespertino" onClose={vi.fn()} podeEditar />)
    expect(screen.getByRole('button', { name: 'Início desta cirurgia: 15:10' })).toBeTruthy()
    det.unmount()

    render(<LiberacoesView escala={depois} hospital="unimed" hospitalLabel="Unimed" turno="vespertino" canEdit
      onToggle={() => {}} onSetOverride={() => {}} onDefinirInicioCaso={vi.fn()} onDefinirTerminoRealCaso={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Informar o tempo total de Paulo Tonini'))
    expect(screen.getByRole('button', { name: `Início de 15:30 ${rot(HERNIA)}: 15:10` })).toBeTruthy()
  })
})

describe('iniciada ANTES de existir o campo (sem início gravado): o card propõe a hora MARCADA', () => {
  const antiga = { ...emCurso, inicioReal: null, statusAtualizadoEm: '2026-10-02T14:16:00-03:00' }

  it('no detalhe do caso', async () => {
    detalhe(antiga)
    fireEvent.click(within(cartao()).getByRole('button', { name: 'Início desta cirurgia: não informado' }))
    const folha = folhaDeCima()
    expect(within(folha).getByText('marcado')).toBeTruthy()
    fireEvent.click(within(folha).getByRole('button', { name: 'Confirmar início às 14:16' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ inicioReal: '14:16' })
  })

  it('na folha das Liberações', async () => {
    const onDefinirInicioCaso = vi.fn(async () => {})
    render(<LiberacoesView escala={escalaDe([antiga, proxima])} hospital="unimed" hospitalLabel="Unimed" turno="vespertino" canEdit
      onToggle={() => {}} onSetOverride={() => {}} onDefinirInicioCaso={onDefinirInicioCaso} onDefinirTerminoRealCaso={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Informar o tempo total de Paulo Tonini'))
    fireEvent.click(screen.getByRole('button', { name: `Início de 13:30 ${rot(COLE)}: não informado` }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Confirmar início às 14:16' }))
    await waitFor(() => expect(onDefinirInicioCaso).toHaveBeenCalledWith('c1', '14:16'))
  })
})
