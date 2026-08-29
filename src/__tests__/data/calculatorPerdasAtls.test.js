/**
 * Trava da classificação de choque hemorrágico (`hemo_perdas_atls`).
 *
 * Defeito que originou o arquivo (29/08/2026): a classe saía de uma SOMA de
 * pontos dos quatro parâmetros (FC, PAS, FR, diurese), com 0/2/3/4 cada e
 * cortes em 4/8/12. Isso exige ~três parâmetros gravemente alterados para
 * chegar à classe IV, e subclassifica quem tem um só.
 *
 *   FC 145, resto normal ............ somava 4 → classe II  (é classe IV)
 *   FC 145 + PAS 65 ................. somava 8 → classe III (é classe IV)
 *
 * O ATLS atribui a classe pelo PIOR parâmetro — "the composite ATLS score being
 * assigned to the shock class corresponding to the highest shock class amongst
 * traditional vital parameters". Subclassificar atrasa sangue e, na classe IV,
 * o protocolo de transfusão maciça que a própria calculadora indica.
 *
 * Segundo defeito, na mesma tela: "Volume máximo" vinha de uma tabela FIXA
 * (750/1500/2000/2500 mL) que ignorava o peso, enquanto "Perda estimada" era
 * escalada pela volemia. Num paciente de 100 kg em classe III a estimativa
 * (2450 mL) passava do "máximo" (2000 mL) — duas linhas do mesmo cartão se
 * contradizendo.
 *
 * Fonte: ATLS 10ª ed. / J Emerg Trauma Shock 2024, sobre atribuição de classe.
 */
import { describe, it, expect } from 'vitest';
import { getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const atls = getCalculatorById('hemo_perdas_atls').compute;

// Normal em tudo: FC < 100, PAS >= 100, FR <= 20, diurese >= 30.
const NORMAL = { peso: 70, fc: 80, pas: 120, fr: 16, diurese: 40 };

describe('classe sai do PIOR parâmetro, não da soma', () => {
  it('tudo normal → classe I', () => {
    expect(atls(NORMAL).score).toBe(1);
  });

  it.each([
    ['FC 145 isolada', { fc: 145 }, 4],
    ['PAS 65 isolada', { pas: 65 }, 4],
    ['FR 40 isolada', { fr: 40 }, 4],
    ['diurese 2 isolada', { diurese: 2 }, 4],
    ['FC 130 isolada', { fc: 130 }, 3],
    ['PAS 85 isolada', { pas: 85 }, 3],
    ['FC 110 isolada', { fc: 110 }, 2],
    ['diurese 25 isolada', { diurese: 25 }, 2],
  ])('%s → classe %i', (_rotulo, alteracao, classe) => {
    expect(atls({ ...NORMAL, ...alteracao }).score).toBe(classe);
  });

  it('o pior parâmetro manda mesmo com os outros normais', () => {
    // O caso que mais doía: taquicárdico e hipotenso saía classe III.
    expect(atls({ ...NORMAL, fc: 145, pas: 65 }).score).toBe(4);
  });

  it('acrescentar alteração LEVE nunca reduz a classe', () => {
    const grave = atls({ ...NORMAL, fc: 145 }).score;
    const graveMaisLeve = atls({ ...NORMAL, fc: 145, diurese: 25 }).score;
    expect(graveMaisLeve).toBeGreaterThanOrEqual(grave);
  });

  it('classe IV aciona o protocolo de transfusão maciça', () => {
    const r = atls({ ...NORMAL, fc: 145 });
    expect(r.details['Conduta']).toContain('Maciça');
  });
});

describe('os volumes acompanham o peso — as duas linhas não podem se contradizer', () => {
  const numeros = (texto) => (texto.match(/\d+/g) || []).map(Number);

  it.each([50, 70, 100, 120])('a %i kg, a perda estimada nunca passa do volume máximo', (peso) => {
    for (const alteracao of [{}, { fc: 110 }, { fc: 130 }, { fc: 145 }]) {
      const r = atls({ ...NORMAL, peso, ...alteracao });
      const estimada = numeros(r.details['Perda estimada']).pop();
      const maximo = numeros(r.details['Volume máximo']).pop();
      expect(estimada, `${peso} kg, classe ${r.score}`).toBeLessThanOrEqual(maximo);
    }
  });

  it('o volume máximo escala com o peso, em vez de ser tabela fixa', () => {
    const leve = numeros(atls({ ...NORMAL, peso: 50, fc: 130 }).details['Volume máximo']).pop();
    const pesado = numeros(atls({ ...NORMAL, peso: 100, fc: 130 }).details['Volume máximo']).pop();
    expect(pesado).toBeGreaterThan(leve);
    expect(pesado / leve).toBeCloseTo(2, 1);
  });

  it('a volemia declarada continua sendo 70 mL/kg', () => {
    expect(atls({ ...NORMAL, peso: 70 }).details['Volemia calculada']).toContain('4900');
  });
});
