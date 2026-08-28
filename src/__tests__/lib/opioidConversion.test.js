/**
 * Trava da conversão de opioides.
 *
 * O defeito que originou o arquivo (28/08/2026): a metadona usava razão FIXA
 * 4:1, e a conversão dela é não-linear. Pela tabela de Ripamonti — que o próprio
 * `infoBox` da calculadora já mandava usar — a razão sobe com a dose prévia de
 * morfina, então a razão fixa entregava 2× a dose acima de 90 mg/dia e 3× acima
 * de 300. Overdose de metadona é letal: meia-vida longa, acúmulo ao longo de
 * dias e prolongamento de QT.
 *
 * Fontes: Ripamonti C et al. J Clin Oncol 1998;16(10):3216-21 |
 * CDC Clinical Practice Guideline for Prescribing Opioids 2022.
 */
import { describe, it, expect } from 'vitest';
import {
  MME_FACTORS,
  methadoneRatioFromMedd,
  meddFromMethadone,
  converterOpioide,
} from '../../lib/opioidConversion';

describe('razão da metadona — escalonada, não fixa', () => {
  it.each([
    [30, 4], [89.9, 4], [90, 8], [299.9, 8], [300, 12], [1000, 12],
  ])('MME %s mg/dia → razão %s:1', (medd, razao) => {
    expect(methadoneRatioFromMedd(medd)).toBe(razao);
  });

  // Os números do defeito, para a regressão ser reconhecível.
  it.each([
    [90, 11.25, 22.5],
    [300, 25, 75],
    [600, 50, 150],
  ])('morfina VO %s mg/dia → %s mg de metadona (a razão fixa 4:1 dava %s)', (medd, certo, antigo) => {
    const r = converterOpioide({ origem: 'morfina_vo', destino: 'metadona_vo', dose: medd });
    expect(r.doseDestino).toBeCloseTo(certo, 2);
    expect(r.doseDestino).toBeLessThan(antigo);
  });
});

describe('metadona como ORIGEM — a tabela não é inversível', () => {
  // Ripamonti descreve a troca de morfina POR metadona; no sentido inverso há
  // duas faixas em que mais de uma razão fecha. Isso é propriedade da tabela,
  // não defeito — e a escolha de qual usar precisa ser deliberada e travada.
  it('nenhuma dose fica sem razão coerente', () => {
    for (let deciMg = 1; deciMg <= 2000; deciMg++) {
      const dose = deciMg / 10;
      const coerentes = [4, 8, 12].filter((r) => methadoneRatioFromMedd(dose * r) === r);
      expect(coerentes.length, `metadona ${dose} mg/dia ficou sem razão`).toBeGreaterThanOrEqual(1);
    }
  });

  it('a ambiguidade é exatamente 11,3–22,4 e 25–37,4 mg/dia, e vem sinalizada', () => {
    const ambiguas = [];
    for (let deciMg = 1; deciMg <= 600; deciMg++) {
      const dose = deciMg / 10;
      if (meddFromMethadone(dose).ambiguo) ambiguas.push(dose);
    }
    expect(Math.min(...ambiguas)).toBeCloseTo(11.3, 2);
    expect(Math.max(...ambiguas)).toBeCloseTo(37.4, 2);
    expect(meddFromMethadone(15).ambiguo).toBe(true);
    expect(meddFromMethadone(50).ambiguo).toBe(false);
  });

  // Subestimar a MME subdosa o destino (custa dor); superestimar superdosa
  // (custa depressão respiratória). Na dúvida, o lado seguro é o menor.
  it('na ambiguidade escolhe a MENOR morfina equivalente', () => {
    const r = meddFromMethadone(15);
    expect(r.ratio).toBe(4);
    expect(r.medd).toBeCloseTo(60, 2); // e não 120, que também fecharia
  });

  it.each([
    [10, 4, 40],
    [22.4, 4, 89.6],
    [22.5, 8, 180],
    [30, 8, 240],
    [50, 12, 600],
  ])('metadona %s mg/dia → razão %s:1, MME %s', (dose, ratio, medd) => {
    const r = meddFromMethadone(dose);
    expect(r.ratio).toBe(ratio);
    expect(r.medd).toBeCloseTo(medd, 2);
  });

  it('a MME cresce junto com a dose de metadona', () => {
    let anterior = 0;
    for (let deciMg = 1; deciMg <= 1000; deciMg++) {
      const atual = meddFromMethadone(deciMg / 10).medd;
      expect(atual).toBeGreaterThan(anterior);
      anterior = atual;
    }
  });
});

describe('fatores MME — convenção do CDC', () => {
  // ⚠️ NÃO "corrigir" o fentanil IV para 0,3: a equianalgesia clássica dá 30 mg
  // de morfina VO para 100 mcg, mas a calculadora declara o CDC como fonte e
  // nele o fator é 0,1. Trocar por 0,3 quebra a coerência com a referência.
  it.each([
    ['morfina_vo', 1], ['morfina_iv', 3], ['tramadol_vo', 0.1],
    ['codeina_vo', 0.15], ['oxicodona_vo', 1.5],
    ['fentanil_iv', 0.1], ['fentanil_td', 2.4],
  ])('%s → %s', (opioide, fator) => {
    expect(MME_FACTORS[opioide]).toBe(fator);
  });

  it('a metadona NÃO tem fator fixo — é justamente o ponto', () => {
    expect(MME_FACTORS.metadona_vo).toBeUndefined();
  });

  it('fentanil TD 25 mcg/h equivale a 60 mg de morfina VO por DIA', () => {
    const r = converterOpioide({ origem: 'fentanil_td', destino: 'morfina_vo', dose: 25 });
    expect(r.morfinaVOeq).toBeCloseTo(60, 2);
  });

  it('morfina IV 20 mg/dia → 60 mg VO/dia', () => {
    const r = converterOpioide({ origem: 'morfina_iv', destino: 'morfina_vo', dose: 20 });
    expect(r.doseDestino).toBeCloseTo(60, 2);
  });
});

describe('conversão — comportamento geral', () => {
  it('aplica −25% por tolerância cruzada incompleta', () => {
    const r = converterOpioide({ origem: 'morfina_vo', destino: 'oxicodona_vo', dose: 60 });
    expect(r.doseDestino).toBeCloseTo(40, 2);
    expect(r.doseReduzida).toBeCloseTo(30, 2);
  });

  it('ida e volta entre opioides lineares devolve a dose original', () => {
    for (const destino of ['morfina_iv', 'oxicodona_vo', 'codeina_vo', 'fentanil_iv', 'fentanil_td']) {
      const ida = converterOpioide({ origem: 'morfina_vo', destino, dose: 120 });
      const volta = converterOpioide({ origem: destino, destino: 'morfina_vo', dose: ida.doseDestino });
      expect(volta.doseDestino, destino).toBeCloseTo(120, 6);
    }
  });

  it('expõe a razão usada quando a metadona entra na conta, e só então', () => {
    expect(converterOpioide({ origem: 'morfina_vo', destino: 'metadona_vo', dose: 300 }).razaoMetadona).toBe(12);
    expect(converterOpioide({ origem: 'metadona_vo', destino: 'morfina_vo', dose: 30 }).razaoMetadona).toBe(8);
    expect(converterOpioide({ origem: 'morfina_vo', destino: 'oxicodona_vo', dose: 60 }).razaoMetadona).toBeNull();
  });

  it('recusa dose ausente, zero, negativa ou opioide desconhecido', () => {
    expect(converterOpioide({ origem: 'morfina_vo', destino: 'morfina_iv', dose: undefined })).toBeNull();
    expect(converterOpioide({ origem: 'morfina_vo', destino: 'morfina_iv', dose: 0 })).toBeNull();
    expect(converterOpioide({ origem: 'morfina_vo', destino: 'morfina_iv', dose: -10 })).toBeNull();
    expect(converterOpioide({ origem: 'heroina', destino: 'morfina_vo', dose: 10 })).toBeNull();
  });
});
