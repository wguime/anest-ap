/**
 * "Consultar Sobreaviso" tem o mesmo defeito que "Consultar Plantões" tinha: o
 * detalhe do dia aplicava o override de `sobreavisoMaternoDiario`, mas as
 * bolinhas "Meu sobreaviso" e o card dos hospitais liam a base pura. Depois de
 * uma troca aceita, quem cedeu o dia continuava marcada nele e o card HRO/UNIMED
 * mostrava a funcionária de antes da troca.
 *
 * A fixture usa a base real de maio/2026 (02/05: HRO Elisete) e inverte quem
 * está no sobreaviso do dia 2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

import { ThemeProvider } from '@/design-system';
import ConsultaSobreavisoPage from '@/pages/ConsultaSobreavisoPage';
import { SOBREAVISO_MATERNO_2026, FUNCIONARIAS_SOBREAVISO } from '@/data/sobreavisoMaterno2026';
import { HOSPITAIS_2026 } from '@/data/hospitaisTecnicas2026';

const estado = vi.hoisted(() => ({ userFuncionariaId: null, overrides: {}, docs: {}, hospitais: {} }));

vi.mock('@/hooks/useTrocaSobreaviso', () => ({
  useTrocaSobreaviso: () => ({ userFuncionariaId: estado.userFuncionariaId }),
}));
vi.mock('@/hooks/useOverridesDiario', () => ({
  useSobreavisoOverrides: () => ({ overrides: estado.overrides, docs: estado.docs, loading: false }),
}));
vi.mock('@/hooks/useHospitaisOverrides', () => ({
  useHospitaisOverrides: () => ({ overrides: estado.hospitais, loading: false }),
}));
vi.mock('@/contexts/EscalasFuncionariasBaseContext', () => ({
  useEscalasFuncionariasBase: () => ({ version: 0 }),
}));

const DIA = '2026-05-02';
const cedeu = SOBREAVISO_MATERNO_2026[DIA];
const recebeu = FUNCIONARIAS_SOBREAVISO.find((f) => f.id !== cedeu && f.id !== 'elisete' && f.id !== 'marta').id;
const nome = (id) => FUNCIONARIAS_SOBREAVISO.find((f) => f.id === id).nome;

const wrap = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
// o grid mostra dias do mês vizinho (classe text-muted-foreground/50) — só o do mês corrente interessa
const botaoDia = (dia) => screen.getAllByRole('button', { name: new RegExp(`^${dia}$`) })
  .find((b) => !b.className.includes('text-muted-foreground/50'));
const marcado = (dia, quem) => within(botaoDia(dia)).queryByTitle(`Meu sobreaviso (${nome(quem)})`) !== null;

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-10T10:00:00')); // maio de 2026
  estado.docs = { [DIA]: { funcionariaOverride: recebeu, origem: 'troca', trocaId: 'SB123456' } };
  estado.overrides = { [DIA]: recebeu };
  estado.hospitais = { [`${DIA}_hro_manha`]: 'marta' }; // base: HRO Elisete
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Consultar Sobreaviso — bolinhas, detalhe e hospitais seguem as trocas', () => {
  it('a base de 02/05 é a edição vigente (HRO Elisete)', () => {
    expect(cedeu).toBeTruthy();
    expect(HOSPITAIS_2026[DIA]?.hro).toBe('Elisete');
  });

  it('quem cedeu o dia 2 não fica mais marcada nele; quem recebeu, sim', () => {
    estado.userFuncionariaId = cedeu;
    const { unmount } = render(<ConsultaSobreavisoPage goBack={() => {}} />, { wrapper: wrap });
    expect(marcado('2', cedeu)).toBe(false);
    unmount();

    estado.userFuncionariaId = recebeu;
    render(<ConsultaSobreavisoPage goBack={() => {}} />, { wrapper: wrap });
    expect(marcado('2', recebeu)).toBe(true);
  });

  it('o detalhe do dia 2 mostra quem recebeu, e o HRO mostra a Marta (override), não a Elisete', () => {
    estado.userFuncionariaId = recebeu;
    render(<ConsultaSobreavisoPage goBack={() => {}} />, { wrapper: wrap });

    fireEvent.click(botaoDia('2'));
    expect(screen.getByText(nome(recebeu))).toBeInTheDocument();
    expect(screen.getByText('Sobreaviso trocado')).toBeInTheDocument();
    expect(screen.getByText('Via troca SB123456')).toBeInTheDocument();
    expect(screen.getByText('Marta')).toBeInTheDocument();
    expect(screen.queryByText('Elisete')).toBeNull();
  });

  it('sem overrides a base manda: quem cedeu segue marcada e o HRO é a Elisete', () => {
    estado.userFuncionariaId = cedeu;
    estado.docs = {};
    estado.overrides = {};
    estado.hospitais = {};
    render(<ConsultaSobreavisoPage goBack={() => {}} />, { wrapper: wrap });

    expect(marcado('2', cedeu)).toBe(true);
    fireEvent.click(botaoDia('2'));
    // (a Elisete pode ser também quem está no sobreaviso da base — por isso "pelo menos uma")
    expect(screen.getAllByText('Elisete').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Marta')).toBeNull();
  });
});
