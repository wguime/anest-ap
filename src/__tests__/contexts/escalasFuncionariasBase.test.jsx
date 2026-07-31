/**
 * EscalasFuncionariasBaseContext — meses publicados no Firestore entram na
 * base ativa dos data files; mês publicado SUBSTITUI o mês inteiro do estático.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let subscriber = null;
vi.mock('../../services/escalasFuncionariasService', () => ({
  subscribeEscalasFuncionarias: vi.fn((cb) => {
    subscriber = cb;
    return () => { subscriber = null; };
  }),
}));

import { EscalasFuncionariasBaseProvider, useEscalasFuncionariasBase } from '../../contexts/EscalasFuncionariasBaseContext';
import { getSobreavisoBase, setSobreavisoBaseDinamica, SOBREAVISO_MATERNO_2026 } from '../../data/sobreavisoMaterno2026';
import { getHospitaisBase, setHospitaisBaseDinamica } from '../../data/hospitaisTecnicas2026';

function Probe() {
  const { version, mesesPublicados, loading } = useEscalasFuncionariasBase();
  return (
    <div data-testid="probe">
      {`v${version}|${mesesPublicados.join(',')}|loading:${loading}|set01:${getSobreavisoBase()['2026-09-01'] || '-'}|ago14:${getSobreavisoBase()['2026-08-14'] || '-'}`}
    </div>
  );
}

afterEach(() => {
  // registro é estado de módulo — devolve ao estático entre testes
  setSobreavisoBaseDinamica({});
  setHospitaisBaseDinamica({});
});

describe('EscalasFuncionariasBaseProvider', () => {
  it('sem provider, a base é o estático puro', () => {
    expect(getSobreavisoBase()).toEqual(SOBREAVISO_MATERNO_2026);
    expect(getSobreavisoBase()['2026-08-14']).toBe('luciana');
  });

  it('mês novo publicado aparece na base e bumpa a version', () => {
    render(<EscalasFuncionariasBaseProvider><Probe /></EscalasFuncionariasBaseProvider>);
    expect(screen.getByTestId('probe').textContent).toContain('v0');
    expect(screen.getByTestId('probe').textContent).toContain('loading:true');

    act(() => subscriber({
      meses: { '2026-09': { sobreaviso: { '2026-09-01': 'marta' }, hospitais: { '2026-09-05': { unimed: 'Mari', hro: 'Renata', plantaoPago: 'Marta', label: null } } } },
      error: null,
    }));

    const texto = screen.getByTestId('probe').textContent;
    expect(texto).toContain('v1');
    expect(texto).toContain('2026-09');
    expect(texto).toContain('loading:false');
    expect(texto).toContain('set01:marta');
    expect(texto).toContain('ago14:luciana'); // estático intacto
    expect(getHospitaisBase()['2026-09-05']).toEqual({ unimed: 'Mari', hro: 'Renata', plantaoPago: 'Marta', label: null });
  });

  it('doc de mês que existe no estático substitui o mês INTEIRO (dia ausente some)', () => {
    render(<EscalasFuncionariasBaseProvider><Probe /></EscalasFuncionariasBaseProvider>);
    act(() => subscriber({
      meses: { '2026-08': { sobreaviso: { '2026-08-01': 'marta' }, hospitais: {} } },
      error: null,
    }));

    expect(getSobreavisoBase()['2026-08-01']).toBe('marta');   // do doc
    expect(getSobreavisoBase()['2026-08-14']).toBeUndefined(); // estático do mês NÃO vaza
    expect(getSobreavisoBase()['2026-07-31']).toBe('marta');   // julho intacto
    expect(getHospitaisBase()['2026-08-25']).toBeUndefined();  // hospitais de ago também substituídos
    expect(getHospitaisBase()['2026-07-25']).toBeDefined();
  });

  it('cada snapshot re-renderiza o consumidor (version bump)', () => {
    render(<EscalasFuncionariasBaseProvider><Probe /></EscalasFuncionariasBaseProvider>);
    act(() => subscriber({ meses: {}, error: null }));
    expect(screen.getByTestId('probe').textContent).toContain('v1');
    act(() => subscriber({ meses: { '2026-10': { sobreaviso: {}, hospitais: {} } }, error: null }));
    expect(screen.getByTestId('probe').textContent).toContain('v2');
    expect(screen.getByTestId('probe').textContent).toContain('2026-10');
  });
});
