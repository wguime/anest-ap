/**
 * Substituir quem ocupa a POSIÇÃO — caminho sem cobertura até 29/07 (o roster
 * mockado vazio dos outros testes deixava o botão desabilitado, então o bug
 * passou no CI). O dono relatou "dá erro e não troca de posição".
 *
 * A regra que estes testes travam: a ordem gravada sai do RODAPÉ, nunca da lista
 * de EXIBIÇÃO — que carrega extras (caso sem posição), ajudas e o plantão da
 * tarde no fim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apelidos: ['CURY'] },
  { uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))
const { upsertAlias } = vi.hoisted(() => ({ upsertAlias: vi.fn(async () => {}) }))

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    aliases: [], loading: false,
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    upsertAlias, refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, ordem, anestesista, cirurgiao, hora) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao,
  bloco: 'normal', isContinuacao: false, semAnestesista: false,
})

// rodapé de 3 nomes + 1 ajuda (fora do rodapé) + 1 extra (caso sem posição)
const escala = {
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: { matutino: ['CURY'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    caso('IOSC', 0, 'CURY', 'Tirapelle', '07:30'),
    caso('Exames', 0, 'PAULO', 'Willian', '08:00'),
  ],
}

const abrirEditor = (nome) => fireEvent.click(screen.getByLabelText(`Editar local/cirurgião de ${nome}`))
const escolherSubstituto = (nomeCompleto) => {
  fireEvent.click(screen.getByText(/^Hoje: /))
  fireEvent.click(screen.getByRole('option', { name: nomeCompleto }))
}

const montar = (props = {}) => render(
  <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit podeGerenciar onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

beforeEach(() => upsertAlias.mockClear())

describe('Substituir posição — a ordem sai do RODAPÉ (dono 29/07)', () => {
  it('grava só o rodapé com o nome trocado — sem extra, sem ajuda', async () => {
    const onSubstituir = vi.fn(async () => ({ trocou: false, casosMovidos: 1 }))
    montar({ onSubstituir })
    abrirEditor('Marilio Flach')
    escolherSubstituto('MARCOS TADEU CURY')
    fireEvent.click(screen.getByRole('button', { name: /Substituir nesta posição/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar troca/ }))

    await waitFor(() => expect(onSubstituir).toHaveBeenCalled())
    const { novaOrdem, casoIds } = onSubstituir.mock.calls[0][0]
    expect(novaOrdem).toEqual(['LEONARDO', 'CURY', 'KARINE'])
    expect(novaOrdem).not.toContain('PAULO') // extra nunca entra na ordem publicada
    expect(casoIds).toEqual(['Sala 2-0'])
  })

  it('substituto que JÁ está no rodapé troca de lugar (não duplica o nome)', async () => {
    const onSubstituir = vi.fn(async () => ({ trocou: false, casosMovidos: 1 }))
    montar({ onSubstituir })
    abrirEditor('Marilio Flach')
    escolherSubstituto('KARINE BEDIN')
    fireEvent.click(screen.getByRole('button', { name: /Substituir nesta posição/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar troca/ }))

    await waitFor(() => expect(onSubstituir).toHaveBeenCalled())
    expect(onSubstituir.mock.calls[0][0].novaOrdem).toEqual(['LEONARDO', 'KARINE', 'MARILIO'])
  })

  it('linha SEM posição no rodapé (extra) avisa e não grava nada', async () => {
    const onSubstituir = vi.fn()
    montar({ onSubstituir })
    abrirEditor('Paulo Tonini') // tem caso, não está no rodapé
    escolherSubstituto('MARCOS TADEU CURY')
    fireEvent.click(screen.getByRole('button', { name: /Substituir nesta posição/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar troca/ }))

    expect(await screen.findByText(/não está na ordem publicada deste turno/)).toBeTruthy()
    expect(onSubstituir).not.toHaveBeenCalled()
  })

  it('apelido desconhecido do dicionário é aprendido ANTES de gravar o rodapé', async () => {
    // o rodapé guarda NOME e o caso guarda UID: sem o vínculo, a posição nova
    // nasceria sem casos (vermelha) e o substituto viraria extra no fim
    const onSubstituir = vi.fn(async () => ({ trocou: false, casosMovidos: 0 }))
    montar({ onSubstituir })
    abrirEditor('Marilio Flach')
    escolherSubstituto('PAULO TONINI')
    fireEvent.click(screen.getByRole('button', { name: /Substituir nesta posição/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar troca/ }))
    await waitFor(() => expect(onSubstituir).toHaveBeenCalled())
    // PAULO já resolve no dicionário mockado → não precisa aprender
    expect(upsertAlias).not.toHaveBeenCalled()
    expect(onSubstituir.mock.calls[0][0].novaOrdem).toEqual(['LEONARDO', 'PAULO', 'KARINE'])
  })
})

describe('Painel da linha — ponte com a aba Completa (dono 29/07)', () => {
  it('lista os casos da pessoa dentro do painel', () => {
    montar()
    abrirEditor('Marilio Flach')
    expect(screen.getByText('Casos no turno')).toBeTruthy()
    expect(screen.getByText('1 em aberto')).toBeTruthy()
    // o cirurgião dele aparece 2× (linha da fila + card do caso no painel);
    // o de outro anestesista segue só na linha dele, fora do painel
    expect(screen.getAllByText('Taciana A').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Liana W')).toHaveLength(1)
  })

  it('mostra o valor automático de local e cirurgião ao lado do ajuste', () => {
    montar()
    abrirEditor('Marilio Flach')
    expect(screen.getAllByText(/Automático \(dos casos\)/).length).toBe(2)
  })
})
