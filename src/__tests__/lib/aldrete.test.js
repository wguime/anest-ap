import { describe, it, expect } from 'vitest';
import { aldreteModified, aldreteOriginal, aldreteCompare } from '@/lib/aldrete';

describe('aldreteModified (Aldrete 1995)', () => {
  it('todos os critérios = 2 → score 10, canDischarge=true', () => {
    const r = aldreteModified({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2, spo2: 2,
    });
    expect(r.score).toBe(10);
    expect(r.maxScore).toBe(10);
    expect(r.version).toBe('modified');
    expect(r.canDischarge).toBe(true);
    expect(r.interpretation).toBe('Apto para alta da SRPA');
  });

  it('todos os critérios = 0 → score 0, canDischarge=false', () => {
    const r = aldreteModified({
      atividade: 0, respiracao: 0, circulacao: 0, consciencia: 0, spo2: 0,
    });
    expect(r.score).toBe(0);
    expect(r.canDischarge).toBe(false);
    expect(r.interpretation).toBe('Continuar observação');
  });

  it('score 9 → canDischarge=true, "Apto para alta"', () => {
    const r = aldreteModified({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2, spo2: 1,
    });
    expect(r.score).toBe(9);
    expect(r.canDischarge).toBe(true);
    expect(r.interpretation).toContain('Apto');
  });

  it('score 8 → canDischarge=false, "Quase apto"', () => {
    const r = aldreteModified({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 1, spo2: 1,
    });
    expect(r.score).toBe(8);
    expect(r.canDischarge).toBe(false);
    expect(r.interpretation).toContain('Quase apto');
  });

  it('score 6 → "Continuar observação"', () => {
    const r = aldreteModified({
      atividade: 2, respiracao: 1, circulacao: 1, consciencia: 1, spo2: 1,
    });
    expect(r.score).toBe(6);
    expect(r.interpretation).toContain('Continuar observação');
  });

  it('retorna version="modified"', () => {
    const r = aldreteModified({
      atividade: 1, respiracao: 1, circulacao: 1, consciencia: 1, spo2: 1,
    });
    expect(r.version).toBe('modified');
  });
});

describe('aldreteOriginal (Aldrete-Kroulik 1970)', () => {
  it('todos os critérios = 2 → score 10', () => {
    const r = aldreteOriginal({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2, cor: 2,
    });
    expect(r.score).toBe(10);
    expect(r.canDischarge).toBe(true);
  });

  it('retorna version="original"', () => {
    const r = aldreteOriginal({
      atividade: 1, respiracao: 1, circulacao: 1, consciencia: 1, cor: 1,
    });
    expect(r.version).toBe('original');
  });

  it('todos 0 → score 0', () => {
    const r = aldreteOriginal({
      atividade: 0, respiracao: 0, circulacao: 0, consciencia: 0, cor: 0,
    });
    expect(r.score).toBe(0);
    expect(r.canDischarge).toBe(false);
  });
});

describe('aldreteCompare', () => {
  it('retorna ambas as versões quando todos os campos presentes', () => {
    const r = aldreteCompare({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2,
      spo2: 2, cor: 1,
    });
    expect(r.modified).not.toBeNull();
    expect(r.original).not.toBeNull();
    expect(r.modified.score).toBe(10);
    expect(r.original.score).toBe(9);
    expect(r.modified.version).toBe('modified');
    expect(r.original.version).toBe('original');
  });

  it('retorna null no original se cor estiver faltando', () => {
    const r = aldreteCompare({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2, spo2: 2,
    });
    expect(r.modified.score).toBe(10);
    expect(r.original).toBeNull();
  });

  it('retorna null no modified se spo2 estiver faltando', () => {
    const r = aldreteCompare({
      atividade: 2, respiracao: 2, circulacao: 2, consciencia: 2, cor: 2,
    });
    expect(r.modified).toBeNull();
    expect(r.original.score).toBe(10);
  });
});

describe('edge cases — inputs inválidos', () => {
  it('valores undefined → retorna null', () => {
    expect(aldreteModified(undefined)).toBeNull();
    expect(aldreteOriginal(undefined)).toBeNull();
  });

  it('objeto vazio → retorna null', () => {
    expect(aldreteModified({})).toBeNull();
    expect(aldreteOriginal({})).toBeNull();
  });

  it('null → retorna null', () => {
    expect(aldreteModified(null)).toBeNull();
    expect(aldreteOriginal(null)).toBeNull();
  });

  it('valores parciais (alguns undefined) → retorna null', () => {
    const r = aldreteModified({
      atividade: 2, respiracao: 2, circulacao: 2,
      // consciencia e spo2 faltando
    });
    expect(r).toBeNull();
  });

  it('valor fora do range (3) → retorna null', () => {
    const r = aldreteModified({
      atividade: 3, respiracao: 2, circulacao: 2, consciencia: 2, spo2: 2,
    });
    expect(r).toBeNull();
  });

  it('valor negativo (-1) → retorna null', () => {
    const r = aldreteModified({
      atividade: -1, respiracao: 2, circulacao: 2, consciencia: 2, spo2: 2,
    });
    expect(r).toBeNull();
  });

  it('strings numéricas são aceitas ("2") → score calculado', () => {
    const r = aldreteModified({
      atividade: '2', respiracao: '2', circulacao: '2', consciencia: '2', spo2: '2',
    });
    expect(r).not.toBeNull();
    expect(r.score).toBe(10);
  });

  it('string não-numérica ("abc") → retorna null', () => {
    const r = aldreteModified({
      atividade: 'abc', respiracao: 2, circulacao: 2, consciencia: 2, spo2: 2,
    });
    expect(r).toBeNull();
  });
});
