import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u1', firstName: 'Eduardo', displayName: 'Eduardo Savoldi', role: 'anestesiologista' } }),
}))

vi.mock('@/contexts/UsersManagementContext', () => ({
  useUsersManagement: () => ({ users: [{ id: 'u1', nome: 'Eduardo Savoldi', firstName: 'Eduardo', role: 'anestesiologista', active: true }], loading: false }),
}))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import MinhasEscalasView from '@/pages/escala-cirurgica/MinhasEscalasView'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'
import { EscalaCirurgicaProvider } from '@/contexts/EscalaCirurgicaContext'

const escala = {
  id: 'e1', hospital: 'unimed', ordemLiberacao: ['EDUARDO', 'STAUB'], liberacoes: { STAUB: { liberadoEm: 'x' } },
  casos: [
    { id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'EDUARDO', cirurgiao: 'Rodrigo Souza', procedimento: 'Sinus', bloco: 'normal', tipo: 'eletiva', pacienteIniciais: 'M.C.' },
    { id: 'c2', sala: 'SALA 2', ordem: 0, hora: '13:30', anestesista: 'STAUB', cirurgiao: 'Dirceu Valentini', bloco: 'normal', tipo: 'urgencia' },
  ],
}

const wrap = (ui) => (
  <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{ui}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
)

describe('EscalaCirurgica — smoke de todas as views', () => {
  it('página principal', () => { render(wrap(<EscalaCirurgicaPage goBack={() => {}} />)) })
  it('BoardView com casos', () => { render(wrap(<BoardView escala={escala} meuAlias="Eduardo" turno="vespertino" />)) })
  it('LiberacoesView com casos', () => {
    render(wrap(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />))
  })
  it('MinhasEscalasView', () => { render(wrap(<MinhasEscalasView escala={escala} meuAlias="Eduardo" turno="vespertino" onVerBoard={() => {}} />)) })
  it('ImportarEscalaPage', () => { render(wrap(<ImportarEscalaPage hospital="unimed" data="2026-06-26" onClose={() => {}} />)) })
})
