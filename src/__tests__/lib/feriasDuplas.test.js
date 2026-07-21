import { describe, it, expect } from 'vitest';
import { aplicarDuplasFerias, FERIAS_DUPLAS } from '@/lib/feriasDuplas';

describe('aplicarDuplasFerias', () => {
  it('mescla a dupla numa única linha "A / B" quando só uma está de férias', () => {
    const r = aplicarDuplasFerias([{ nome: 'Aline', periodo: '01/07 - 15/07', tipo: 'férias' }]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Aline / Rosemary');
    // herda período e tipo de quem apareceu de férias
    expect(r[0].periodo).toBe('01/07 - 15/07');
    expect(r[0].tipo).toBe('férias');
  });

  it('rótulo segue a ordem da dupla mesmo se o 2º membro aparecer', () => {
    const r = aplicarDuplasFerias([{ nome: 'Roberta', periodo: 'A partir de 10/08' }]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Humberto / Roberta');
  });

  it('colapsa numa linha só quando ambas estão de férias', () => {
    const r = aplicarDuplasFerias([
      { nome: 'Aline', periodo: 'X' },
      { nome: 'Rosemary', periodo: 'Y' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Aline / Rosemary');
    expect(r[0].periodo).toBe('X'); // herda do primeiro que apareceu
  });

  it('casa por primeiro nome mesmo com nome completo vindo da API', () => {
    const r = aplicarDuplasFerias([{ nome: 'Humberto Ferreira da Silva', periodo: 'Z' }]);
    expect(r[0].nome).toBe('Humberto / Roberta');
  });

  it('é acento-insensível', () => {
    const r = aplicarDuplasFerias([{ nome: 'HÚMBÊRTO', periodo: 'Z' }], [['Humberto', 'Roberta']]);
    expect(r[0].nome).toBe('Humberto / Roberta');
  });

  it('não altera férias sem membros de dupla', () => {
    const input = [{ nome: 'Dr. Carlos Silva', periodo: 'Férias' }];
    const r = aplicarDuplasFerias(input);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Dr. Carlos Silva');
    expect(r).not.toBe(input); // nova lista, não muta
  });

  it('preserva a posição e os itens não-dupla ao redor', () => {
    const r = aplicarDuplasFerias([
      { nome: 'Dr. Carlos', periodo: 'A' },
      { nome: 'Rosemary', periodo: 'B' },
      { nome: 'Dra. Ana', periodo: 'C' },
    ]);
    expect(r.map((f) => f.nome)).toEqual(['Dr. Carlos', 'Aline / Rosemary', 'Dra. Ana']);
  });

  it('lida com lista vazia e undefined', () => {
    expect(aplicarDuplasFerias([])).toEqual([]);
    expect(aplicarDuplasFerias()).toEqual([]);
  });

  it('duas duplas simultâneas viram duas linhas', () => {
    const r = aplicarDuplasFerias([
      { nome: 'Aline', periodo: 'A' },
      { nome: 'Humberto', periodo: 'B' },
    ]);
    expect(r.map((f) => f.nome)).toEqual(['Aline / Rosemary', 'Humberto / Roberta']);
  });

  it('FERIAS_DUPLAS expõe os pares esperados', () => {
    expect(FERIAS_DUPLAS).toEqual([
      ['Aline', 'Rosemary'],
      ['Humberto', 'Roberta'],
    ]);
  });
});
