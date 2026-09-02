import { describe, it, expect } from 'vitest';
import {
  inicioProcedimento,
  camposDoInstante,
  horaCurta,
  dataCurta,
  janelaHora,
  rotuloHora,
  faixaHora,
  tempoDecorrido,
  horaDoRelogio,
} from '@/lib/tempoProcedimento';

// 02/09/2026, 07:30 — o início usado no modelo aprovado pelo dono.
const INICIO = new Date(2026, 8, 2, 7, 30);

describe('inicioProcedimento', () => {
  it('junta os valores nativos de date + time em horário local', () => {
    const dt = inicioProcedimento('2026-09-02', '07:30');
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(8);
    expect(dt.getDate()).toBe(2);
    expect(dt.getHours()).toBe(7);
    expect(dt.getMinutes()).toBe(30);
  });

  it('campo faltando ou vazio → null (a tela segue sem relógio)', () => {
    expect(inicioProcedimento('', '07:30')).toBeNull();
    expect(inicioProcedimento('2026-09-02', '')).toBeNull();
    expect(inicioProcedimento(null, undefined)).toBeNull();
  });

  it('data impossível não vira o mês seguinte', () => {
    // `new Date(2026, 1, 31)` devolve 03/03 sem reclamar — é o que se rejeita.
    expect(inicioProcedimento('2026-02-31', '08:00')).toBeNull();
    expect(inicioProcedimento('2026-13-01', '08:00')).toBeNull();
    expect(inicioProcedimento('2026-09-02', '25:00')).toBeNull();
    expect(inicioProcedimento('2026-09-02', '07:75')).toBeNull();
  });

  it('meia-noite é hora válida, não ausência de hora', () => {
    const dt = inicioProcedimento('2026-09-02', '00:00');
    expect(dt).not.toBeNull();
    expect(dt.getHours()).toBe(0);
  });
});

describe('camposDoInstante', () => {
  it('devolve os dois campos no formato dos inputs nativos', () => {
    expect(camposDoInstante(new Date(2026, 0, 5, 6, 4))).toEqual({
      data: '2026-01-05',
      hora: '06:04',
    });
  });

  it('ida e volta: os campos do agora reconstroem o mesmo minuto', () => {
    const { data, hora } = camposDoInstante(INICIO);
    const volta = inicioProcedimento(data, hora);
    expect(volta.getTime()).toBe(INICIO.getTime());
  });

  it('data inválida não quebra a tela', () => {
    expect(camposDoInstante(new Date('nada'))).toEqual({ data: '', hora: '' });
  });
});

describe('janelaHora / rótulos', () => {
  it('a hora 1 começa no início, não uma hora depois', () => {
    expect(rotuloHora(INICIO, 1)).toBe('07:30');
    expect(faixaHora(INICIO, 1)).toBe('07:30–08:30');
  });

  it('a hora N cobre a N-ésima hora corrida', () => {
    expect(rotuloHora(INICIO, 3)).toBe('09:30');
    expect(faixaHora(INICIO, 3)).toBe('09:30–10:30');
    expect(rotuloHora(INICIO, 12)).toBe('18:30');
  });

  it('cirurgia que atravessa a meia-noite continua contando', () => {
    const noite = new Date(2026, 8, 2, 22, 0);
    expect(faixaHora(noite, 3)).toBe('00:00–01:00');
    expect(janelaHora(noite, 3).de.getDate()).toBe(3);
  });

  it('sem início, ou com ordem inválida, devolve vazio em vez de "NaN:NaN"', () => {
    expect(janelaHora(null, 1)).toBeNull();
    expect(janelaHora(INICIO, 0)).toBeNull();
    expect(rotuloHora(null, 1)).toBe('');
    expect(faixaHora(new Date('nada'), 1)).toBe('');
  });
});

describe('horaCurta / dataCurta', () => {
  it('dois dígitos sempre, para a coluna não dançar', () => {
    expect(horaCurta(new Date(2026, 8, 2, 8, 5))).toBe('08:05');
    expect(dataCurta(new Date(2026, 8, 2))).toBe('02/09');
  });

  it('valor inválido devolve string vazia', () => {
    expect(horaCurta(null)).toBe('');
    expect(dataCurta('2026-09-02')).toBe('');
  });
});

describe('tempoDecorrido', () => {
  it('abaixo de uma hora conta em minutos', () => {
    expect(tempoDecorrido(INICIO, new Date(2026, 8, 2, 8, 18))).toBe('48 min');
    expect(tempoDecorrido(INICIO, INICIO)).toBe('0 min');
  });

  it('acima de uma hora conta em h + minutos com dois dígitos', () => {
    expect(tempoDecorrido(INICIO, new Date(2026, 8, 2, 10, 42))).toBe('3 h 12');
    expect(tempoDecorrido(INICIO, new Date(2026, 8, 2, 8, 35))).toBe('1 h 05');
  });

  it('início no futuro (data digitada errada) não vira tempo negativo', () => {
    expect(tempoDecorrido(INICIO, new Date(2026, 8, 2, 6, 0))).toBeNull();
  });

  it('sem início não há tempo corrido', () => {
    expect(tempoDecorrido(null, INICIO)).toBeNull();
  });
});

describe('horaDoRelogio', () => {
  it('o minuto do início já é a hora 1', () => {
    expect(horaDoRelogio(INICIO, INICIO)).toBe(1);
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 8, 29))).toBe(1);
  });

  it('vira para a hora seguinte ao completar 60 min', () => {
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 8, 30))).toBe(2);
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 10, 35))).toBe(4);
  });

  it('antes do início é 0 — nada a abrir ainda', () => {
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 7, 0))).toBe(0);
    expect(horaDoRelogio(null, INICIO)).toBe(0);
  });

  it('o aviso de virada só nasce quando o relógio passa da última hora lançada', () => {
    // 3 horas lançadas, relógio às 10:35 → o relógio está na 4ª: falta abrir.
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 10, 35)) > 3).toBe(true);
    // Mesmas 3 horas às 10:00 → ainda dentro da 3ª: nada a avisar.
    expect(horaDoRelogio(INICIO, new Date(2026, 8, 2, 10, 0)) > 3).toBe(false);
  });
});
