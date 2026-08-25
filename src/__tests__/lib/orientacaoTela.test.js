/**
 * Trava de retrato do app (dono 25/08).
 *
 * INVARIANTE, não persona: o app só gira enquanto ALGUÉM tiver pedido a
 * exceção, e volta a travar quando o ÚLTIMO pedido é devolvido. O caso que
 * quebra uma implementação por booleano é o aninhado — PDF aberto dentro de um
 * modal sobre uma página com vídeo —, onde fechar um dos dois devolveria a
 * trava com o outro ainda na tela.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  aplicarPoliticaOrientacao,
  permitirLandscape,
  landscapePermitido,
  _resetOrientacao,
} from '@/lib/orientacaoTela';

const CLASSE = 'landscape-liberado';
let lock;

beforeEach(() => {
  lock = vi.fn(() => Promise.resolve());
  Object.defineProperty(globalThis.screen, 'orientation', {
    value: { lock, unlock: vi.fn(), type: 'portrait-primary' },
    configurable: true,
    writable: true,
  });
  _resetOrientacao();
  lock.mockClear();
});

const liberado = () => document.documentElement.classList.contains(CLASSE);
const ultimoLock = () => lock.mock.calls.at(-1)?.[0];

describe('orientacaoTela — a trava é retrato e a exceção é pedida', () => {
  it('sem pedido nenhum, trava em retrato e o <html> não carrega a classe', () => {
    aplicarPoliticaOrientacao();

    expect(liberado()).toBe(false);
    expect(ultimoLock()).toBe('portrait');
    expect(landscapePermitido()).toBe(false);
  });

  it('um pedido libera: classe no <html> e lock("any") — nunca unlock()', () => {
    permitirLandscape();

    expect(liberado()).toBe(true);
    // ⚠️ unlock() devolveria à orientação PADRÃO, que o manifest fixa em
    // portrait: em PWA Android não liberaria nada.
    expect(ultimoLock()).toBe('any');
  });

  it('devolver o pedido volta a travar', () => {
    const devolver = permitirLandscape();
    devolver();

    expect(liberado()).toBe(false);
    expect(ultimoLock()).toBe('portrait');
  });

  it('pedidos aninhados: só o ÚLTIMO a ser devolvido restaura a trava', () => {
    const devolverVideo = permitirLandscape();
    const devolverPdf = permitirLandscape();

    devolverPdf();
    expect(liberado()).toBe(true);
    expect(ultimoLock()).toBe('any');

    devolverVideo();
    expect(liberado()).toBe(false);
    expect(ultimoLock()).toBe('portrait');
  });

  it('devolver duas vezes não derruba o pedido de outro componente', () => {
    const devolverPdf = permitirLandscape();
    const _devolverVideo = permitirLandscape();

    devolverPdf();
    devolverPdf();

    expect(liberado()).toBe(true);
  });

  it('a trava base do App não atropela uma exceção já ativa', () => {
    permitirLandscape();
    aplicarPoliticaOrientacao();

    expect(liberado()).toBe(true);
    expect(ultimoLock()).toBe('any');
  });

  it('lock recusado (iOS, aba de browser) não quebra — a classe segue valendo', () => {
    lock.mockImplementation(() => Promise.reject(new Error('not supported')));

    const devolver = permitirLandscape();
    expect(liberado()).toBe(true);

    devolver();
    expect(liberado()).toBe(false);
  });
});
