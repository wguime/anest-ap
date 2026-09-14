/**
 * "Consultar Plantões" marca o residente nos dias EFETIVOS (tabela + trocas).
 *
 * Foto do dono (27/07/2026, WhatsApp de um residente): "Tinha trocado meu dia 20
 * pelo 19, mas continuou marcando como dia 20". O Firestore já tinha o 19 como
 * Roosewelt e o 20 como Augusto (TR475677 / TR240201, aceitas em 26/06) e o
 * detalhe do dia 20 dizia "Augusto" — mas as bolinhas azuis e a lista "Eventos
 * deste mês" liam só PLANTOES_2026: 11, 13, 20 e 26.
 *
 * Fixture = os overrides reais de julho. A hipótese contrária (sem overrides →
 * 20 e 26 marcados) fica no último teste, para a fixture separar as duas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

import { ThemeProvider } from '@/design-system';
import ConsultaPlantoesPage from '@/pages/ConsultaPlantoesPage';

const estado = vi.hoisted(() => ({ userResidenteId: 'r1-roosewelt', overrides: {}, docs: {} }));

vi.mock('@/hooks/useTrocaPlantao', () => ({
  useTrocaPlantao: () => ({ userResidenteId: estado.userResidenteId }),
}));
vi.mock('@/hooks/useOverridesDiario', () => ({
  useResidenciaPlantaoOverrides: () => ({ overrides: estado.overrides, docs: estado.docs, loading: false }),
}));

const OVERRIDES_JULHO = {
  '2026-07-19': { residenteOverride: 'r1-roosewelt', origem: 'troca', trocaId: 'TR475677' },
  '2026-07-26': { residenteOverride: 'r1-augusto',   origem: 'troca', trocaId: 'TR475677' },
  '2026-07-20': { residenteOverride: 'r1-augusto',   origem: 'troca', trocaId: 'TR240201' },
  '2026-07-21': { residenteOverride: 'r1-roosewelt', origem: 'troca', trocaId: 'TR240201' },
  '2026-07-25': { residenteOverride: 'r1-roosewelt', origem: 'troca', trocaId: 'TR338863' },
};

const wrap = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

// o grid mostra dias do mês vizinho (classe text-muted-foreground/50) — só o do mês corrente interessa
const botaoDia = (dia) => screen.getAllByRole('button', { name: new RegExp(`^${dia}$`) })
  .find((b) => !b.className.includes('text-muted-foreground/50'));
const marcado = (dia) => within(botaoDia(dia)).queryByTitle('Meu plantão (Roosewelt)') !== null;

beforeEach(() => {
  // 27/07 às 10h → o calendário abre em julho de 2026 (rollover das 07h já passou)
  vi.setSystemTime(new Date('2026-07-27T10:00:00'));
  estado.userResidenteId = 'r1-roosewelt';
  estado.docs = OVERRIDES_JULHO;
  estado.overrides = Object.fromEntries(Object.entries(OVERRIDES_JULHO).map(([k, v]) => [k, v.residenteOverride]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Consultar Plantões — bolinhas e lista seguem as trocas aceitas', () => {
  it('Roosewelt fica marcado no 19, 21 e 25 e NÃO no 20 nem no 26', () => {
    render(<ConsultaPlantoesPage goBack={() => {}} />, { wrapper: wrap });

    expect(marcado('19')).toBe(true);
    expect(marcado('21')).toBe(true);
    expect(marcado('25')).toBe(true);
    expect(marcado('11')).toBe(true); // dia da tabela sem troca continua
    expect(marcado('20')).toBe(false);
    expect(marcado('26')).toBe(false);

    // a lista "Eventos deste mês" é a mesma conta
    const lista = screen.getByText('Eventos deste mês').parentElement;
    expect(lista.textContent).toContain('19Meu plantão (Roosewelt)');
    expect(lista.textContent).not.toContain('20Meu plantão');
  });

  it('o detalhe do dia 20 é o Augusto, via troca TR240201; o do 19, o Roosewelt', () => {
    render(<ConsultaPlantoesPage goBack={() => {}} />, { wrapper: wrap });

    fireEvent.click(botaoDia('20'));
    expect(screen.getByText('Augusto')).toBeInTheDocument();
    expect(screen.getByText('Plantão trocado')).toBeInTheDocument();
    expect(screen.getByText('Via troca TR240201')).toBeInTheDocument();

    fireEvent.click(botaoDia('19'));
    expect(screen.getByText('Roosewelt')).toBeInTheDocument();
    expect(screen.getByText('Via troca TR475677')).toBeInTheDocument();
  });

  it('sem overrides as bolinhas voltam à tabela: 20 e 26 marcados, 19 não', () => {
    estado.docs = {};
    estado.overrides = {};
    render(<ConsultaPlantoesPage goBack={() => {}} />, { wrapper: wrap });

    expect(marcado('20')).toBe(true);
    expect(marcado('26')).toBe(true);
    expect(marcado('19')).toBe(false);
  });
});
