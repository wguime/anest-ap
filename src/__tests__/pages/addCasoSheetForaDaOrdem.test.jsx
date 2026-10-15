/**
 * "Adicionar caso" com anestesista FORA DA ORDEM (dono 15/10/2026, modelo A).
 *
 * Recorte do HRO da manhã de 15/10 às 11h28: a Karine (10º) livre e não liberada, o
 * Rafael do rodapé da Unimed. Salvar com o Rafael tem de PARAR no diálogo — antes
 * disso a urgência entrava calada e ninguém via que a Karine esperava.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import AddCasoSheet from '@/pages/escala-cirurgica/AddCasoSheet'

const { adicionarCaso, definirSalasUrgencia, escalas } = vi.hoisted(() => {
  const hro = {
    id: 'hro', hospital: 'hro', data: '2026-10-15',
    ordemLiberacao: { matutino: ['DANIELA', 'KARINE', 'RAQUEL'] },
    ajudaExterna: { matutino: [] },
    liberacoes: { 'matutino:u-raq': { liberadoEm: '2026-10-15T14:11:28Z' } },
    casos: [
      { id: 'c-dani', sala: 'Sala 8', turno: 'matutino', anestesista: 'DANIELA', anestesistaUserId: 'u-dani', statusCirurgia: 'iniciada', ordem: 0 },
      { id: 'c-kar', sala: 'Sala 5', turno: 'matutino', anestesista: 'KARINE', anestesistaUserId: 'u-kar', statusCirurgia: 'terminada', terminoReal: '11:19', ordem: 0 },
    ],
  }
  const unimed = {
    id: 'uni', hospital: 'unimed', data: '2026-10-15',
    ordemLiberacao: { matutino: ['FERNANDA', 'OSCAR', 'RAFAEL'] }, ajudaExterna: { matutino: [] }, liberacoes: {}, casos: [],
  }
  return {
    adicionarCaso: vi.fn(async (_e, c) => ({ id: 'novo-1', ...c })),
    definirSalasUrgencia: vi.fn(async () => {}),
    escalas: { hro, unimed },
  }
})
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ adicionarCaso, definirSalasUrgencia }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-15', escalas, data: '2026-10-15', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-1', displayName: 'Fulano' } }) }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/hooks/useRosterAnestesistas', () => {
  const pessoas = [
    { uid: 'u-raf', nome: 'RAFAEL PELISSARO', apelidos: ['RAFAEL', 'PELISSARO'] },
    { uid: 'u-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
    { uid: 'u-raq', nome: 'RAQUEL FELICIANI', apelidos: ['RAQUEL'] },
    { uid: 'u-dani', nome: 'DANIELA REIS', apelidos: ['DANIELA'] },
  ]
  const porApelido = new Map(pessoas.flatMap((p) => p.apelidos.map((a) => [a, p.uid])))
  return {
    default: () => ({
      roster: pessoas, aliases: [], loading: false,
      rosterByUid: new Map(pessoas.map((p) => [p.uid, p])),
      options: [
        { value: 'u-raf', label: 'Rafael Pelissaro' }, { value: 'u-kar', label: 'Karine Bedin' },
        { value: 'u-raq', label: 'Raquel Feliciani' },
      ],
      resolver: (n) => porApelido.get(String(n || '').toUpperCase().trim()) || null,
      refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
    }),
  }
})
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const escolher = (texto, opcao) => {
  fireEvent.click(screen.getByText(texto))
  fireEvent.click(screen.getByRole('option', { name: opcao }))
}
const lancar = (anestesista) => {
  render(<AddCasoSheet escala={escalas.hro} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
  escolher('Selecionar sala…', 'Sala 8')
  fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Evacuação de coágulos' } })
  fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Rubin' } })
  escolher('Selecionar convênio…', 'Unimed')
  fireEvent.click(screen.getByRole('button', { name: 'Urgente' }))
  if (anestesista) escolher('Definir depois', anestesista)
  fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
}

beforeEach(() => { adicionarCaso.mockClear() })

describe('Adicionar caso — anestesista fora da ordem (dono 15/10)', () => {
  it('Rafael (da Unimed) com a Karine livre: PARA no diálogo, com o porquê', () => {
    lancar('Rafael Pelissaro')
    expect(adicionarCaso).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmar Rafael fora da ordem?')).toBeTruthy()
    expect(screen.getByText('Está na escala da Unimed')).toBeTruthy()
    expect(screen.getByText('3º lá · plantão da tarde da Unimed')).toBeTruthy()
    expect(screen.getByText(/O próximo a ser chamado é Karine/)).toBeTruthy()
    expect(screen.getByText('2º no HRO · sem cirurgia desde 11:19')).toBeTruthy()
  })

  it('"Confirmar" lança com o Rafael', async () => {
    lancar('Rafael Pelissaro')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Rafael' }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].anestesistaUserId).toBe('u-raf')
  })

  it('"Usar Karine" lança com a próxima, sem voltar ao formulário', async () => {
    lancar('Rafael Pelissaro')
    fireEvent.click(screen.getByRole('button', { name: /Usar Karine/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1]).toEqual(expect.objectContaining({ anestesistaUserId: 'u-kar', anestesista: 'KARINE' }))
  })

  it('"Trocar anestesista" volta ao formulário preenchido, sem gravar', () => {
    lancar('Rafael Pelissaro')
    fireEvent.click(screen.getByRole('button', { name: 'Trocar anestesista' }))
    expect(adicionarCaso).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Evacuação de coágulos')).toBeTruthy()
  })

  it('a própria Karine (a próxima) salva direto', async () => {
    lancar('Karine Bedin')
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(screen.queryByText(/fora da ordem/)).toBeNull()
  })

  it('quem já foi liberado pede confirmação, com a hora', () => {
    lancar('Raquel Feliciani')
    expect(screen.getByText('Já foi liberado')).toBeTruthy()
    expect(screen.getByText('às 11:11')).toBeTruthy()
  })

  it('sem anestesista ("Definir depois") salva direto', async () => {
    lancar(null)
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
  })
})
