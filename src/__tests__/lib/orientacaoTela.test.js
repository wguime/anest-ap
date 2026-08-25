/**
 * Trava de orientação do app (dono 25/08, reforçada no mesmo dia: "não deve
 * rodar a tela nunca!!").
 *
 * INVARIANTE, não persona: com o celular deitado o app se contra-rotaciona
 * (nada de aviso), e só NÃO faz isso enquanto alguém tiver pedido a exceção —
 * documento ou vídeo. O caso que quebra uma implementação por booleano é o
 * aninhado: PDF aberto dentro de um modal sobre uma página com vídeo, onde
 * fechar um dos dois devolveria a trava com o outro ainda na tela.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  aplicarPoliticaOrientacao,
  permitirLandscape,
  landscapePermitido,
  rotacaoCompensada,
  _resetOrientacao,
} from '@/lib/orientacaoTela';

let lock;

/** jsdom não tem orientação: o teste descreve o aparelho. */
function aparelho({ angulo = 0, altura = 844, largura = 390 } = {}) {
  Object.defineProperty(globalThis.screen, 'orientation', {
    value: { lock, unlock: vi.fn(), angle: angulo, type: 'portrait-primary' },
    configurable: true,
    writable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    // o recorte da política: celular DEITADO (paisagem e baixinho)
    matches: q.includes('landscape') && largura > altura && altura <= 500,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const deitado = (angulo = 90) => aparelho({ angulo, altura: 390, largura: 844 });
const emPe = () => aparelho({ angulo: 0, altura: 844, largura: 390 });

beforeEach(() => {
  lock = vi.fn(() => Promise.resolve());
  emPe();
  _resetOrientacao();
  lock.mockClear();
});

const html = () => document.documentElement.classList;
const ultimoLock = () => lock.mock.calls.at(-1)?.[0];

describe('orientacaoTela — a tela não gira, e sem aviso', () => {
  it('em pé não compensa nada e trava em retrato', () => {
    aplicarPoliticaOrientacao();

    expect(rotacaoCompensada()).toBe(false);
    expect(html().contains('rot-cw')).toBe(false);
    expect(html().contains('rot-ccw')).toBe(false);
    expect(ultimoLock()).toBe('portrait');
    expect(landscapePermitido()).toBe(false);
  });

  it('deitado com o topo à esquerda (angle 90) gira o conteúdo -90°', () => {
    deitado(90);
    aplicarPoliticaOrientacao();

    expect(rotacaoCompensada()).toBe(true);
    expect(html().contains('rot-ccw')).toBe(true);
    expect(html().contains('rot-cw')).toBe(false);
  });

  it('deitado para o outro lado (angle 270) gira +90°', () => {
    deitado(270);
    aplicarPoliticaOrientacao();

    expect(html().contains('rot-cw')).toBe(true);
    expect(html().contains('rot-ccw')).toBe(false);
  });

  it('endireitar o aparelho desfaz a compensação', () => {
    deitado(90);
    aplicarPoliticaOrientacao();
    expect(rotacaoCompensada()).toBe(true);

    emPe();
    aplicarPoliticaOrientacao();
    expect(rotacaoCompensada()).toBe(false);
    expect(html().contains('rot-ccw')).toBe(false);
  });

  it('documento/vídeo: com a exceção pedida o app GIRA — nada de compensar', () => {
    deitado(90);
    permitirLandscape();

    expect(rotacaoCompensada()).toBe(false);
    // ⚠️ unlock() devolveria à orientação PADRÃO, que o manifest fixa em
    // portrait: em PWA Android não liberaria nada.
    expect(ultimoLock()).toBe('any');
  });

  it('devolver a exceção com o aparelho deitado volta a compensar', () => {
    deitado(90);
    const devolver = permitirLandscape();
    devolver();

    expect(rotacaoCompensada()).toBe(true);
    expect(ultimoLock()).toBe('portrait');
  });

  it('pedidos aninhados: só o ÚLTIMO a ser devolvido restaura a trava', () => {
    deitado(90);
    const devolverVideo = permitirLandscape();
    const devolverPdf = permitirLandscape();

    devolverPdf();
    expect(rotacaoCompensada()).toBe(false);

    devolverVideo();
    expect(rotacaoCompensada()).toBe(true);
  });

  it('devolver duas vezes não derruba o pedido de outro componente', () => {
    deitado(90);
    const devolverPdf = permitirLandscape();
    const _devolverVideo = permitirLandscape();

    devolverPdf();
    devolverPdf();

    expect(rotacaoCompensada()).toBe(false);
  });

  it('tablet/notebook deitado (altura > 500px) fica fora: paisagem ali é o uso normal', () => {
    aparelho({ angulo: 90, altura: 768, largura: 1024 });
    aplicarPoliticaOrientacao();

    expect(rotacaoCompensada()).toBe(false);
  });

  it('lock recusado (iOS, aba de browser) não quebra — a compensação é que segura', () => {
    lock.mockImplementation(() => Promise.reject(new Error('not supported')));
    deitado(90);

    aplicarPoliticaOrientacao();
    expect(rotacaoCompensada()).toBe(true);
  });
});
