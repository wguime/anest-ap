/**
 * Relatório de adesão — "Horário não preenchido no dia" (dono 05/10, modelo A em
 * `.tmp/relatorio-horario-nao-preenchido.html`): o que o alerta público da escala deixou
 * para trás na virada das 7h.
 *
 * Travas: os três números (último dia · 7 dias · período); a lista de quem deixou de
 * preencher, de quem deixou mais para quem deixou menos, com nomes do dicionário; o toque
 * abre as cirurgias por dia, só leitura; janela vazia explica quando o primeiro dia entra;
 * sem acesso (a RPC recusa) a seção não aparece.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { ThemeProvider } from '@/design-system'
import SecaoHorarioNaoPreenchido from '@/pages/escala-adesao/SecaoHorarioNaoPreenchido'

const estado = vi.hoisted(() => ({ consulta: { dados: null, erro: null } }))
vi.mock('@/hooks/useAdesaoEscala', () => ({ useHorarioNaoPreenchido: () => estado.consulta }))
const ROSTER = [
  { uid: 'uid-ana', nome: 'ANA RIBEIRO', apelidos: ['ANA'] },
  { uid: 'uid-bruno', nome: 'BRUNO LIMA', apelidos: ['BRUNO'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    resolver: (n) => ROSTER.find((r) => r.apelidos.includes(String(n || '').trim().toUpperCase()))?.uid || null,
  }),
}))

const linha = (o) => ({
  id: o.id, data: o.data, turno: o.turno || 'matutino', hospital: o.hospital || 'unimed', sala: 'CC - Sala 2',
  hora: o.hora || '07:30', procedimento: 'COLECISTECTOMIA', anestesista: o.a, anestesista_user_id: o.uid ?? null,
  falta: o.falta || 'ambos',
})
const DADOS = {
  desde: '2026-10-05', ate: '2026-10-07',
  casos: [
    linha({ id: '1', data: '2026-10-07', a: 'ANA', uid: 'uid-ana', falta: 'ini' }),
    linha({ id: '2', data: '2026-10-05', turno: 'vespertino', hora: '14:30', hospital: 'hro', a: 'ANA', uid: 'uid-ana' }),
    // dupla sem uid: o dicionário resolve a ANA e ela soma 3
    linha({ id: '3', data: '2026-10-06', a: 'ANA + BRUNO', uid: null, falta: 'ter' }),
  ],
}
const montar = () => render(<ThemeProvider><SecaoHorarioNaoPreenchido aba="30" rotuloPeriodo="30 dias" /></ThemeProvider>)
const secao = () => screen.queryByRole('region', { name: 'Horário não preenchido no dia' })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-08T08:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

describe('Horário não preenchido no dia', () => {
  it('os três números e quem deixou mais primeiro, pelo nome do dicionário', () => {
    estado.consulta = { dados: DADOS, erro: null }
    montar()
    const s = secao()
    expect(within(s).getByText('7 dias').parentElement.textContent).toBe('37 dias')
    // o 1º "ontem" é o número do último dia (a linha da Ana repete a palavra)
    expect(within(s).getAllByText('ontem')[0].closest('span').textContent).toBe('1ontem')
    const pessoas = within(s).getAllByRole('button', { name: /sem horário, a última/ })
    expect(pessoas.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ana Ribeiro: 3 cirurgias sem horário, a última ontem',
      'Bruno Lima: 1 cirurgia sem horário, a última ter 06/10',
    ])
  })

  it('o toque abre as cirurgias da pessoa, por dia, com o que faltou', () => {
    estado.consulta = { dados: DADOS, erro: null }
    montar()
    fireEvent.click(screen.getByRole('button', { name: /^Ana Ribeiro:/ }))
    const dia = screen.getByRole('region', { name: 'seg 05/10' })
    expect(within(dia).getByText('Tarde · HRO · CC - Sala 2')).toBeTruthy()
    expect(within(dia).getByText('Sem horário')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'ontem' })).getByText('Falta início')).toBeTruthy()
  })

  it('janela vazia (o primeiro dia ainda não acabou) diz quando ele entra', () => {
    estado.consulta = { dados: { desde: '2026-10-05', ate: '2026-10-04', casos: [] }, erro: null }
    montar()
    expect(within(secao()).getByText(/O primeiro dia entra quando ele acabar/)).toBeTruthy()
  })

  it('sem acesso (a RPC recusa) a seção não aparece', () => {
    estado.consulta = { dados: null, erro: 'acesso negado' }
    montar()
    expect(secao()).toBeNull()
  })
})
