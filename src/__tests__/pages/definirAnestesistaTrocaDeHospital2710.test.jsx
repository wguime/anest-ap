/**
 * "OS DOIS TROCARAM DE HOSPITAL?" (dono 27/10). Na manhã de 27/10 a conta UNIMED passou a
 * Sala 1 do Raul (3º da Unimed) ao Vicente (1º do HRO, plantonista) pelo definir
 * anestesista, sem mover a posição. Cada um virou "ajuda" no hospital do outro e o
 * plantonista do HRO saiu do lugar. A folha agora pergunta — mas só quando quem recebe é
 * de OUTRO hospital e quem passa fica sem nenhuma cirurgia aberta aqui. Troca de sala
 * dentro do mesmo hospital (o Humberto, no mesmo dia) não pergunta nada.
 *
 * ⚠️ MUDOU DE LADO em 11/11/2026 (decisão do dono de 10–11/11, modelo B de
 * `.tmp/analise-escala-2026-11/modelos-2/b-trocas.html`): a pergunta "Os dois trocaram de
 * hospital? Sim / Não, só passar" e o interruptor "Assumir também a posição" deram lugar a
 * UMA pergunta — "Como {B} entra?" — sempre que quem recebe não está no rodapé daquele
 * hospital naquele turno, com as respostas nas palavras dele ("Veio AJUDAR" / "ASSUME a
 * posição de {A} na fila" / "Os dois TROCARAM de hospital hoje"), nada marcado e o botão
 * dizendo o efeito. Motivo: de 26/09 a 10/11, 53 repasses para fora do rodapé saíram sem
 * ninguém dizer se era ajuda ou substituição; a pergunta de 27/10 só cobria uma situação
 * e o interruptor nascia desligado. "Sim" não abre mais outra folha: a troca é feita aqui.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const setAnestesistaCasos = vi.fn(async () => {})
const executarSubstituicao = vi.fn(async () => {})

const ROSTER = new Map([
  ['uid-raul', { uid: 'uid-raul', nome: 'RAUL PERIZZOLO', apelidos: ['RAUL'] }],
  ['uid-vicente', { uid: 'uid-vicente', nome: 'VICENTE ANTONIO ALVES PONS', apelidos: ['VICENTE'] }],
  ['uid-humberto', { uid: 'uid-humberto', nome: 'HUMBERTO HEPP', apelidos: ['HUMBERTO'] }],
  ['uid-oscar', { uid: 'uid-oscar', nome: 'OSCAR MORAIS', apelidos: ['OSCAR'] }],
  // fora de qualquer escala na manhã (consultório)
  ['uid-klisman', { uid: 'uid-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN', apelidos: ['KLISMAN'] }],
])

const caso = (over) => ({
  id: 'u1', sala: 'CC - Sala 1', ordem: 0, hora: '07:30', turno: 'matutino', statusCirurgia: 'agendada',
  anestesista: 'RAUL', anestesistaUserId: 'uid-raul', cirurgiao: 'MAURICIO FABIANI', semAnestesista: false, ...over,
})
const unimed = {
  id: 'e-uni', hospital: 'unimed',
  ordemLiberacao: { matutino: ['OSCAR', 'TIAGO', 'RAUL', 'HUMBERTO'] },
  linhaOverrides: {}, liberacoes: {},
  casos: [caso(), caso({ id: 'u2', hora: '09:15' }), caso({ id: 'u3', hora: '11:00', cirurgiao: 'MARCO ALECIO' }),
    caso({ id: 'u4', sala: 'CC - Sala 5', anestesista: 'HUMBERTO', anestesistaUserId: 'uid-humberto', cirurgiao: 'MARCO TESSEROLI' })],
}
const hro = {
  id: 'e-hro', hospital: 'hro',
  ordemLiberacao: { matutino: ['VICENTE', 'MATHEUS (CONSULT)', 'GARIM'] },
  linhaOverrides: {}, liberacoes: {},
  casos: [caso({ id: 'h1', sala: 'Sala 5', hora: '07:00', anestesista: 'VICENTE', anestesistaUserId: 'uid-vicente', cirurgiao: '', procedimento: 'EMERGENCIA' })],
}
const escalasMock = { unimed, hro }

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-27', escalas: escalasMock, data: '2026-10-27', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-eu' } }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => {
      const k = String(nome || '').replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase()
      return [...ROSTER.values()].find((r) => r.apelidos.includes(k))?.uid || null
    },
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const montar = (props = {}, escala = unimed) => render(
  <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)
const escolher = (rx) => {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
  fireEvent.click(screen.getByRole('option', { name: rx }))
}

beforeEach(() => vi.clearAllMocks())

const perguntaNaTela = () => document.querySelector('[data-como-entra]')
const opcao = (id) => document.querySelector(`[data-como-entra-opcao="${id}"]`)

describe('quem recebe é do rodapé de OUTRO hospital: "Como entra?" (dono 10–11/11)', () => {
  it('Raul → Vicente (1º do HRO): pergunta com duas respostas, nada marcado, e o botão só acende depois', () => {
    montar()
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(perguntaNaTela()).toHaveTextContent('Vicente não está na fila da Unimed nesta manhã. Como Vicente entra?')
    expect(opcao('ajuda')).toHaveTextContent('Veio AJUDAR')
    expect(opcao('ajuda')).toHaveTextContent('Vicente segue 1º no HRO. Aqui entra no fim como Ajuda (HRO) e sai antes do rodapé. Raul segue 3º.')
    expect(opcao('trocaram')).toHaveTextContent('Os dois TROCARAM de hospital hoje')
    expect(opcao('trocaram')).toHaveTextContent('Vicente fica com o 3º da Unimed; Raul, com o 1º do HRO. As cirurgias vão junto.')
    // quem já tem posição em outro hospital não "assume" (27/10: não há troca de um lado só)
    expect(opcao('assume')).toBeNull()
    for (const id of ['ajuda', 'trocaram']) expect(opcao(id)).toHaveAttribute('aria-checked', 'false')
    expect(document.querySelector('[data-como-entra-fila]')).toBeNull() // a fila só aparece depois de escolher
    const b = screen.getByRole('button', { name: 'Escolha como Vicente entra' })
    expect(b).toBeDisabled()
    // os controles antigos saíram
    expect(screen.queryByText(/Os dois trocaram de hospital\?/)).toBeNull()
    expect(screen.queryByText(/Assumir também a posição/)).toBeNull()
  })

  it('"TROCARAM": a fila dos dois hospitais aparece e o botão executa a troca AQUI, com os dois lados', async () => {
    montar()
    escolher(/VICENTE ANTONIO ALVES PONS/)
    fireEvent.click(opcao('trocaram'))
    expect(opcao('trocaram')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('[data-como-entra-fila="trocaram"] [data-fila-previa]')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Trocar Raul ⇄ Vicente' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plano, , opts] = executarSubstituicao.mock.calls[0]
    expect(plano.lados.map((l) => [l.hospital, l.para.uid, l.tipo])).toEqual([
      ['unimed', 'uid-vicente', 'entre_hospitais'], ['hro', 'uid-raul', 'entre_hospitais'],
    ])
    expect(plano.lados[0].casoIds.slice().sort()).toEqual(['u1', 'u2', 'u3'])
    expect(plano.lados[1].casoIds).toEqual(['h1'])
    // o aviso diz o que foi feito e dá 10 s para desfazer
    expect(opts).toMatchObject({ desfazivel: true, aviso: { title: 'Raul e Vicente trocaram de hospital', description: 'Vicente é o 3º da Unimed' } })
    expect(setAnestesistaCasos).not.toHaveBeenCalled()
  })

  it('"Veio AJUDAR": o repasse de sempre, com a fila daqui embaixo e o aviso desfazível', async () => {
    montar()
    escolher(/VICENTE ANTONIO ALVES PONS/)
    fireEvent.click(opcao('ajuda'))
    const fila = document.querySelector('[data-como-entra-fila="ajuda"]')
    expect(fila).toHaveTextContent('3º')
    expect(fila).toHaveTextContent('Vicente · Ajuda (HRO)')
    expect(fila).toHaveTextContent('sai antes do rodapé')
    fireEvent.click(screen.getByRole('button', { name: 'Vicente entra como ajuda' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(setAnestesistaCasos.mock.calls[0][1].sort()).toEqual(['u1', 'u2', 'u3'])
    expect(setAnestesistaCasos.mock.calls[0][2]).toMatchObject({ uid: 'uid-vicente' })
    expect(setAnestesistaCasos.mock.calls[0][3]).toMatchObject({ desfazivel: true, aviso: { title: 'Vicente entrou como ajuda', description: 'Raul segue 3º da Unimed' } })
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('trocar a pessoa escolhida zera a resposta', () => {
    montar()
    escolher(/VICENTE ANTONIO ALVES PONS/)
    fireEvent.click(opcao('trocaram'))
    escolher(/KLISMAN/)
    expect(screen.getByRole('button', { name: 'Escolha como Klisman entra' })).toBeDisabled()
  })
})

describe('quem recebe NÃO está em escala nenhuma (consultório, folga)', () => {
  it('Raul → Klisman: "Veio AJUDAR" ou "ASSUME a posição de Raul na fila"; não existe "trocaram"', () => {
    montar()
    escolher(/KLISMAN/)
    expect(opcao('ajuda')).toHaveTextContent('Klisman está fora da escala. Entra no fim como Ajuda e sai antes do rodapé. Raul segue 3º.')
    expect(opcao('assume')).toHaveTextContent('ASSUME a posição de Raul na fila')
    expect(opcao('assume')).toHaveTextContent('Klisman passa a ser o 3º da Unimed. Raul sai da fila desta manhã.')
    expect(opcao('trocaram')).toBeNull()
  })

  it('"ASSUME": posição e cirurgias juntas (um lado, tipo assuncao), botão com o efeito', async () => {
    montar()
    escolher(/KLISMAN/)
    fireEvent.click(opcao('assume'))
    expect(document.querySelector('[data-como-entra-fila="assume"] [data-fila-previa="unimed"]')).toHaveTextContent('Klisman')
    fireEvent.click(screen.getByRole('button', { name: 'Klisman assume o 3º' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plano, , opts] = executarSubstituicao.mock.calls[0]
    expect(plano.lados).toHaveLength(1)
    expect(plano.lados[0]).toMatchObject({ hospital: 'unimed', turno: 'matutino', chaveSlot: 'uid-raul', tipo: 'assuncao', para: { uid: 'uid-klisman' } })
    expect(plano.lados[0].casoIds.slice().sort()).toEqual(['u1', 'u2', 'u3'])
    expect(opts).toMatchObject({ desfazivel: true, aviso: { title: 'Klisman assumiu a posição de Raul' } })
  })
})

describe('onde a ordem não muda, nenhuma pergunta', () => {
  it('colega da MESMA escala (Humberto, Unimed): troca de sala, "Confirmar responsável" como sempre', async () => {
    montar()
    escolher(/HUMBERTO HEPP/)
    expect(perguntaNaTela()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(setAnestesistaCasos.mock.calls[0][3].desfazivel).toBeUndefined()
  })

  it('quem passa continua com outra cirurgia aqui: sem pergunta, só o AVISO — e o botão diz "entra como ajuda"', async () => {
    const comOutra = { ...unimed, casos: [...unimed.casos, caso({ id: 'u9', sala: 'CC - Sala 8', hora: '10:00' })] }
    montar({}, comOutra)
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(opcao('ajuda')).toBeNull()
    expect(screen.getByRole('note')).toHaveTextContent(
      'Vicente não está na fila da Unimed nesta manhã e Raul continua com outra cirurgia aqui. Por isso Vicente entra como ajuda: Vicente segue 1º no HRO.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vicente entra como ajuda' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('correção de quem fez (folha do horário) não decide fila: sem pergunta', () => {
    montar({ corrigirQuemFez: true })
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(perguntaNaTela()).toBeNull()
  })
})
