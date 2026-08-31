/**
 * Pesos de referência para dose (`src/lib/pesoCorporal.js`).
 *
 * Valores conferidos à mão a partir das fórmulas originais — Devine 1974,
 * Janmahasatian 2005, Mosteller 1987, Du Bois 1916.
 */
import { describe, it, expect } from 'vitest';
import {
  imc,
  faixaImc,
  pesoIdealDevine,
  pesoMagroJanmahasatian,
  pesoAjustado,
  superficieMosteller,
  superficieDuBois,
  pesosDeReferencia,
  ALTURA_MINIMA_DEVINE_CM,
} from '../../lib/pesoCorporal.js';

describe('IMC', () => {
  it('70 kg e 175 cm → 22,86', () => {
    expect(imc(70, 175)).toBeCloseTo(22.857, 3);
  });

  it.each([
    [17, 'baixo_peso'],
    [22, 'eutrofico'],
    [27, 'sobrepeso'],
    [32, 'obesidade_1'],
    [37, 'obesidade_2'],
    [45, 'obesidade_3'],
  ])('IMC %s → %s', (valor, faixa) => {
    expect(faixaImc(valor)).toBe(faixa);
  });

  it('as fronteiras da OMS ficam do lado certo', () => {
    expect(faixaImc(18.5)).toBe('eutrofico');
    expect(faixaImc(25)).toBe('sobrepeso');
    expect(faixaImc(30)).toBe('obesidade_1');
    expect(faixaImc(40)).toBe('obesidade_3');
  });
});

describe('peso ideal (Devine 1974)', () => {
  it('homem de 175 cm → 70,5 kg', () => {
    expect(pesoIdealDevine(175, 'masculino')).toBeCloseTo(70.47, 1);
  });

  it('mulher de 165 cm → 56,9 kg', () => {
    expect(pesoIdealDevine(165, 'feminino')).toBeCloseTo(56.91, 1);
  });

  it('a 152,4 cm (5 pés) a fórmula devolve exatamente a base', () => {
    expect(pesoIdealDevine(ALTURA_MINIMA_DEVINE_CM, 'masculino')).toBeCloseTo(50, 5);
    expect(pesoIdealDevine(ALTURA_MINIMA_DEVINE_CM, 'feminino')).toBeCloseTo(45.5, 5);
  });

  it('abaixo de 152,4 cm devolve null em vez de número sem sentido', () => {
    // Extrapolada, a Devine daria 2,6 kg para 100 cm. Numa tela de dose, isso é
    // pior que não mostrar nada.
    expect(pesoIdealDevine(150, 'masculino')).toBeNull();
    expect(pesoIdealDevine(100, 'feminino')).toBeNull();
  });
});

describe('peso magro (Janmahasatian 2005)', () => {
  it('homem de 100 kg e 175 cm → 67,5 kg', () => {
    expect(pesoMagroJanmahasatian(100, 175, 'masculino')).toBeCloseTo(67.5, 1);
  });

  it('mulher de 100 kg e 165 cm → 52,2 kg', () => {
    expect(pesoMagroJanmahasatian(100, 165, 'feminino')).toBeCloseTo(52.25, 1);
  });

  it('funciona onde a Devine não se aplica — não depende de polegadas', () => {
    expect(pesoMagroJanmahasatian(40, 140, 'feminino')).toBeGreaterThan(0);
    expect(pesoIdealDevine(140, 'feminino')).toBeNull();
  });

  it('é sempre menor que o peso real em quem tem massa gorda', () => {
    for (const peso of [80, 100, 120, 150]) {
      expect(pesoMagroJanmahasatian(peso, 170, 'masculino')).toBeLessThan(peso);
    }
  });

  it('cresce com o peso, mas menos que ele — é o ponto do escalar', () => {
    const lbw80 = pesoMagroJanmahasatian(80, 175, 'masculino');
    const lbw160 = pesoMagroJanmahasatian(160, 175, 'masculino');
    expect(lbw160).toBeGreaterThan(lbw80);
    expect(lbw160 / lbw80).toBeLessThan(2);
  });
});

describe('peso ajustado', () => {
  it('homem de 100 kg e 175 cm → 82,3 kg (IBW + 0,4 × excesso)', () => {
    expect(pesoAjustado(100, 175, 'masculino')).toBeCloseTo(82.28, 1);
  });

  it('em quem está no peso ideal, o ajustado é o próprio ideal', () => {
    const ibw = pesoIdealDevine(175, 'masculino');
    expect(pesoAjustado(ibw, 175, 'masculino')).toBeCloseTo(ibw, 5);
  });

  it('null quando a Devine não se aplica', () => {
    expect(pesoAjustado(60, 140, 'feminino')).toBeNull();
  });
});

describe('superfície corporal', () => {
  it('Mosteller: 70 kg e 175 cm → 1,84 m²', () => {
    expect(superficieMosteller(70, 175)).toBeCloseTo(1.845, 2);
  });

  it('Du Bois: 70 kg e 175 cm → 1,85 m²', () => {
    expect(superficieDuBois(70, 175)).toBeCloseTo(1.849, 2);
  });

  it('as duas concordam dentro de 5% no adulto médio', () => {
    for (const [p, a] of [[50, 160], [70, 175], [90, 180], [110, 170]]) {
      const m = superficieMosteller(p, a);
      const d = superficieDuBois(p, a);
      expect(Math.abs(m - d) / d).toBeLessThan(0.05);
    }
  });
});

describe('pesosDeReferencia — o que o card consome', () => {
  it('devolve tudo junto para um adulto', () => {
    const r = pesosDeReferencia(100, 175, 'masculino');
    expect(r.imc).toBeCloseTo(32.65, 1);
    expect(r.faixaImc).toBe('obesidade_1');
    expect(r.pesoIdeal).toBeCloseTo(70.47, 1);
    expect(r.pesoMagro).toBeCloseTo(67.5, 1);
    expect(r.pesoAjustado).toBeCloseTo(82.28, 1);
    expect(r.devineAplicavel).toBe(true);
  });

  it('sinaliza quando a Devine não vale, sem derrubar o resto', () => {
    const r = pesosDeReferencia(45, 145, 'feminino');
    expect(r.devineAplicavel).toBe(false);
    expect(r.pesoIdeal).toBeNull();
    expect(r.pesoAjustado).toBeNull();
    expect(r.pesoMagro).toBeGreaterThan(0);
    expect(r.imc).toBeGreaterThan(0);
    expect(r.superficieMosteller).toBeGreaterThan(0);
  });

  it('entrada inválida devolve null', () => {
    expect(pesosDeReferencia(0, 175, 'masculino')).toBeNull();
    expect(pesosDeReferencia(70, 0, 'masculino')).toBeNull();
    expect(pesosDeReferencia(NaN, 175, 'masculino')).toBeNull();
  });
});
