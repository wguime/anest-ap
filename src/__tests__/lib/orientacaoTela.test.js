/**
 * Trava de orientação do app (dono 25/08 "não deve rodar a tela nunca!!";
 * 26/08 "fica na horizontal e retorna para vertical").
 *
 * ⚠️ O QUE ESTE TESTE **NÃO** COBRE, de propósito: o *quando* compensar. Isso é
 * da media query em `index.css` — foi tirado do JS justamente porque decidir
 * aqui chegava tarde no iPhone e dava para ver o app deitar e voltar. Testar o
 * "quando" neste módulo recriaria a dependência que causou o defeito.
 *
 * O que é daqui, e é o que se trava: a EXCEÇÃO (documento/vídeo desligam a
 * compensação) e o SENTIDO da rotação. O caso que quebra uma implementação por
 * booleano é o aninhado — PDF dentro de um modal sobre uma página com vídeo —,
 * onde fechar um dos dois devolveria a trava com o outro ainda na tela.
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
function aparelho({ angulo = 0, deitado = false, toque = true, celular = true } = {}) {
  Object.defineProperty(globalThis.screen, 'orientation', {
    value: { lock, unlock: vi.fn(), angle: angulo, type: 'portrait-primary' },
    configurable: true,
    writable: true,
  });
  // espelha a media query do index.css
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: deitado && toque && celular,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const deitado = (angulo = 90) => aparelho({ angulo, deitado: true });
const emPe = () => aparelho({ angulo: 0 });

beforeEach(() => {
  lock = vi.fn(() => Promise.resolve());
  emPe();
  _resetOrientacao();
  lock.mockClear();
});

const html = () => document.documentElement.classList;
const ultimoLock = () => lock.mock.calls.at(-1)?.[0];

describe('orientacaoTela — a tela não gira, e sem aviso', () => {
  it('em pé: nada liberado, nada invertido, lock em retrato', () => {
    aplicarPoliticaOrientacao();

    expect(html().contains('landscape-liberado')).toBe(false);
    expect(html().contains('rot-cw')).toBe(false);
    expect(ultimoLock()).toBe('portrait');
    expect(landscapePermitido()).toBe(false);
  });

  it('topo do aparelho à esquerda (angle 90) usa o sentido PADRÃO do CSS', () => {
    deitado(90);
    aplicarPoliticaOrientacao();

    // sem classe: o CSS já gira -90° sozinho, sem esperar este módulo
    expect(html().contains('rot-cw')).toBe(false);
    expect(rotacaoCompensada()).toBe(true);
  });

  it('topo do aparelho à direita (angle 270) inverte o sentido', () => {
    deitado(270);
    aplicarPoliticaOrientacao();

    expect(html().contains('rot-cw')).toBe(true);
  });

  it('endireitar o aparelho tira a inversão', () => {
    deitado(270);
    aplicarPoliticaOrientacao();
    expect(html().contains('rot-cw')).toBe(true);

    emPe();
    aplicarPoliticaOrientacao();
    expect(html().contains('rot-cw')).toBe(false);
    expect(rotacaoCompensada()).toBe(false);
  });

  it('documento/vídeo: a exceção desliga a compensação e o app GIRA', () => {
    deitado(90);
    permitirLandscape();

    expect(html().contains('landscape-liberado')).toBe(true);
    expect(rotacaoCompensada()).toBe(false);
    // ⚠️ unlock() devolveria à orientação PADRÃO, que o manifest fixa em
    // portrait: em PWA Android não liberaria nada.
    expect(ultimoLock()).toBe('any');
  });

  it('devolver a exceção com o aparelho deitado volta a compensar', () => {
    deitado(90);
    const devolver = permitirLandscape();
    devolver();

    expect(html().contains('landscape-liberado')).toBe(false);
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

  // ⚠️ o corte de tamanho é DO DONO, não conveniência do agente (26/08: "em
  // ipads, tablets a tela pode girar, a regra deve valer apenas para
  // celulares"). No tablet paisagem é uso legítimo; no celular, não.
  it('tablet deitado GIRA — a regra é só de celular', () => {
    aparelho({ angulo: 90, deitado: true, toque: true, celular: false });
    aplicarPoliticaOrientacao();

    expect(rotacaoCompensada()).toBe(false);
  });

  it('desktop (mouse/teclado) fica de fora — a janela não gira', () => {
    aparelho({ angulo: 0, deitado: true, toque: false });
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
