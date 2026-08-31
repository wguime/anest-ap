/**
 * Velocidade de correção do sódio (`src/lib/correcaoSodio.js`).
 *
 * Fórmula de Adrogué-Madias (NEJM 2000). Os tetos de 24 h são o que separa esta
 * calculadora de uma conta inofensiva: passar deles é desmielinização osmótica.
 */
import { describe, it, expect } from 'vitest';
import {
  SOLUCOES,
  aguaCorporalTotal,
  deltaNaPorLitro,
  tetoDe24h,
  planoCorrecaoSodio,
} from '../../lib/correcaoSodio.js';

describe('água corporal total', () => {
  it.each([
    ['homem_adulto', 42],
    ['mulher_adulta', 35],
    ['homem_idoso', 35],
    ['mulher_idosa', 31.5],
  ])('70 kg, %s → %s L', (perfil, litros) => {
    expect(aguaCorporalTotal(70, perfil)).toBeCloseTo(litros, 5);
  });

  it('perfil desconhecido ou peso inválido → null', () => {
    expect(aguaCorporalTotal(70, 'inexistente')).toBeNull();
    expect(aguaCorporalTotal(0, 'homem_adulto')).toBeNull();
  });
});

describe('ΔNa por litro (Adrogué-Madias)', () => {
  it('Na 120, salina 3%, ACT 42 L → +9,14 mmol/L por litro', () => {
    expect(deltaNaPorLitro({ naSerico: 120, solucao: 'salina3', act: 42 })).toBeCloseTo(9.14, 2);
  });

  it('Na 120, fisiológica 0,9% → +0,79 mmol/L por litro (bem mais lenta)', () => {
    expect(deltaNaPorLitro({ naSerico: 120, solucao: 'salina09', act: 42 })).toBeCloseTo(0.791, 2);
  });

  it('o potássio do Ringer entra na conta, como manda a fórmula', () => {
    const comK = deltaNaPorLitro({ naSerico: 120, solucao: 'ringer', act: 42 });
    // (130 + 4 − 120) / 43 = 0,3256 — sem o K seria 0,2326.
    expect(comK).toBeCloseTo(0.3256, 3);
  });

  it('glicose 5% BAIXA o sódio — sinal negativo', () => {
    expect(deltaNaPorLitro({ naSerico: 120, solucao: 'glicosado5', act: 42 })).toBeLessThan(0);
  });

  it('na hipernatremia a fisiológica também baixa o sódio', () => {
    expect(deltaNaPorLitro({ naSerico: 165, solucao: 'salina09', act: 42 })).toBeLessThan(0);
  });
});

describe('teto de 24 h', () => {
  it('hiponatremia comum → 8 mmol/L', () => {
    expect(tetoDe24h({ naSerico: 125, altoRisco: false }).teto).toBe(8);
  });

  it('Na < 115 → 8 mmol/L, e o motivo cita a desmielinização', () => {
    const r = tetoDe24h({ naSerico: 110, altoRisco: false });
    expect(r.teto).toBe(8);
    expect(r.motivo).toContain('115');
  });

  it('alto risco declarado → 8 mmol/L com o motivo do risco', () => {
    const r = tetoDe24h({ naSerico: 128, altoRisco: true });
    expect(r.teto).toBe(8);
    expect(r.motivo).toContain('Alto risco');
  });

  it('hipernatremia → 10 mmol/L e o risco é edema cerebral, não desmielinização', () => {
    const r = tetoDe24h({ naSerico: 165, altoRisco: false });
    expect(r.teto).toBe(10);
    expect(r.motivo).toContain('edema cerebral');
  });
});

describe('plano de correção', () => {
  const base = { naSerico: 120, pesoKg: 70, perfil: 'homem_adulto', solucao: 'salina3' };

  it('subir 8 mmol/L com salina 3% → ~875 mL em 24 h, ~36 mL/h', () => {
    const r = planoCorrecaoSodio({ ...base, variacaoAlvo24h: 8 });
    expect(r.volumeMl24h).toBeCloseTo(875, 0);
    expect(r.velocidadeMlH).toBeCloseTo(36.5, 0);
    expect(r.naAlvo24h).toBe(128);
  });

  it('não excede o teto quando o alvo é o próprio teto', () => {
    expect(planoCorrecaoSodio({ ...base, variacaoAlvo24h: 8 }).excedeTeto).toBe(false);
  });

  it('AVISA quando o alvo passa do teto, sem impedir', () => {
    const r = planoCorrecaoSodio({ ...base, variacaoAlvo24h: 12 });
    expect(r.excedeTeto).toBe(true);
    expect(r.volumeMl24h).toBeGreaterThan(0);
  });

  it('solução que empurra o sódio para o lado errado não devolve volume', () => {
    // Glicose 5% baixa o sódio; pedir para SUBIR com ela não tem resposta.
    const r = planoCorrecaoSodio({ ...base, solucao: 'glicosado5', variacaoAlvo24h: 8 });
    expect(r.direcaoOk).toBe(false);
    expect(r.volumeMl24h).toBeNull();
    expect(r.velocidadeMlH).toBeNull();
  });

  it('na hipernatremia, baixar 10 com glicose 5% tem resposta', () => {
    const r = planoCorrecaoSodio({
      naSerico: 165, pesoKg: 70, perfil: 'homem_adulto',
      solucao: 'glicosado5', variacaoAlvo24h: -10,
    });
    expect(r.direcaoOk).toBe(true);
    expect(r.volumeMl24h).toBeGreaterThan(0);
    expect(r.naAlvo24h).toBe(155);
  });

  it('quanto mais diluída a solução, maior o volume para o mesmo alvo', () => {
    const tres = planoCorrecaoSodio({ ...base, variacaoAlvo24h: 6 }).volumeMl24h;
    const nove = planoCorrecaoSodio({ ...base, solucao: 'salina09', variacaoAlvo24h: 6 }).volumeMl24h;
    expect(nove).toBeGreaterThan(tres);
  });

  it('alvo zero ou ausente → null', () => {
    expect(planoCorrecaoSodio({ ...base, variacaoAlvo24h: 0 })).toBeNull();
    expect(planoCorrecaoSodio({ ...base, variacaoAlvo24h: NaN })).toBeNull();
  });

  it('toda solução declarada tem nome e sódio', () => {
    for (const [id, s] of Object.entries(SOLUCOES)) {
      expect(s.nome, id).toBeTruthy();
      expect(Number.isFinite(s.na), id).toBe(true);
      expect(Number.isFinite(s.k), id).toBe(true);
    }
  });
});
