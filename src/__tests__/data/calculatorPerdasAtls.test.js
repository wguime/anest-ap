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

describe('o zero digitado é valor, não campo vazio', () => {
  // Terceiro defeito (30/08/2026): `parseFloat(v) || padrao` descarta o zero,
  // porque 0 é falsy. Com `min: 0` no input, anúria — o critério urinário de
  // classe IV — virava 30 mL/h e caía para classe I, e a conduta da classe IV
  // é "Cristaloide + Sangue + Protocolo de Transfusão Maciça".
  //
  // O teste antigo usava `diurese: 2`, que passa pelo `||` e acerta: verde com
  // o defeito vivo. É a mesma armadilha que custou 8 pontos de APACHE II
  // (`.claude/skills/calculadoras/SKILL.md`, regra 2).
  it('anúria isolada é classe IV, não classe I', () => {
    expect(atls({ ...NORMAL, diurese: 0 }).score).toBe(4);
  });

  it('anúria manda mesmo com os outros parâmetros só levemente alterados', () => {
    expect(atls({ ...NORMAL, fc: 110, diurese: 0 }).score).toBe(4);
  });

  it('anúria aciona o protocolo de transfusão maciça', () => {
    expect(atls({ ...NORMAL, diurese: 0 }).details['Conduta']).toContain('Maciça');
  });

  it('PAS 0 (sem pressão detectável) é classe IV, não classe I', () => {
    expect(atls({ ...NORMAL, pas: 0 }).score).toBe(4);
  });

  it('FR 0 (apneia) não é lida como FR 16', () => {
    // FR 0 não pontua na tabela do ATLS (a classe vem de FR ALTA), mas não pode
    // ser silenciosamente trocada por 16 — o campo tem `min: 0` e aceita o zero.
    const r = atls({ ...NORMAL, fr: 0, diurese: 0 });
    expect(r.score).toBe(4);
  });

  it('campo vazio continua caindo no padrão — só o zero digitado é preservado', () => {
    expect(atls({ peso: 70, fc: 80 }).score).toBe(1);
    expect(atls({ ...NORMAL, diurese: '' }).score).toBe(1);
  });
});
