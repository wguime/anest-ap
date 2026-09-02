/**
 * Travas da transferência do balanço hídrico.
 *
 * A que mais importa é a primeira: `sanitizarPayload` é lista FECHADA, não
 * `...rascunho`. Se um dia alguém acrescentar um campo com nome de paciente no
 * rascunho local, ele NÃO pode viajar para o servidor junto — e isso não daria
 * erro nenhum, só um vazamento silencioso.
 */
import { describe, it, expect } from 'vitest';
import { sanitizarPayload } from '@/services/balancoTransferenciaService';

describe('sanitizarPayload — só números atravessam', () => {
  it('mantém os campos clínicos do rascunho', () => {
    const p = sanitizarPayload({
      peso: '70', altura: '175', sexo: 'masculino', idade: '43',
      creatinina: '1,0', npoHoras: '8', porte: 'medio',
      hctInicial: '40', hctMinimo: '25', populacao: 'adulto', pedCategory: 'crianca',
      horas: [{ id: 'h0', cristaloide: '500' }],
    });
    expect(p.peso).toBe('70');
    expect(p.sexo).toBe('masculino');
    expect(p.horas).toHaveLength(1);
  });

  it('DESCARTA qualquer campo fora da lista — inclusive identificação', () => {
    const p = sanitizarPayload({
      peso: '70',
      horas: [],
      nome: 'Maria da Silva',
      paciente: 'Maria da Silva',
      prontuario: '123456',
      cpf: '529.982.247-25',
      observacao: 'quarto 302',
    });
    expect(p).toEqual({ peso: '70', horas: [] });
    for (const proibido of ['nome', 'paciente', 'prontuario', 'cpf', 'observacao']) {
      expect(Object.keys(p)).not.toContain(proibido);
    }
  });

  it('horas ausente ou inválida vira array vazio, não undefined', () => {
    expect(sanitizarPayload({}).horas).toEqual([]);
    expect(sanitizarPayload({ horas: 'x' }).horas).toEqual([]);
    expect(sanitizarPayload(null).horas).toEqual([]);
  });

  it('não inventa campo que o rascunho não tinha', () => {
    const p = sanitizarPayload({ horas: [] });
    expect(Object.keys(p)).toEqual(['horas']);
  });
});
