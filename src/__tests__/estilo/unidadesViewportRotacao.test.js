/**
 * Com a tela contra-rotacionada (dono 25/08, "não deve rodar a tela nunca!!")
 * o app é desenhado numa tela VIRTUAL em pé, mas `vh`/`vw` continuam medindo a
 * tela física deitada. Cada classe de viewport usada no app precisa de uma
 * tradução em `index.css` — foi a falta dela que espremeu o login inteiro numa
 * faixa, e é o tipo de defeito que reaparece numa tela só, meses depois, quando
 * alguém acrescenta um `max-h-[75vh]` novo.
 *
 * Este teste é a trava de DRIFT: varre o código, e classe sem tradução falha.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RE_CLASSE = /\b(?:min-|max-)?[hw]-(?:screen|dvh|dvw|svh|lvh)\b|\b(?:min-|max-)?[hw]-\[[0-9]+(?:\.[0-9]+)?(?:d|s|l)?v[hw]\]/g;

function arquivosJsx(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      arquivosJsx(caminho, acc);
    } else if (nome.endsWith('.jsx')) {
      acc.push(caminho);
    }
  }
  return acc;
}

describe('unidades de viewport × tela contra-rotacionada', () => {
  it('toda classe de viewport usada no app tem tradução em index.css', () => {
    const css = readFileSync('src/index.css', 'utf-8');

    const usadas = new Set();
    for (const arquivo of arquivosJsx('src')) {
      const fonte = readFileSync(arquivo, 'utf-8');
      for (const m of fonte.matchAll(RE_CLASSE)) usadas.add(m[0]);
    }
    expect(usadas.size).toBeGreaterThan(0); // a varredura tem de achar algo

    const semTraducao = [...usadas].filter((classe) => {
      const seletor = `.${classe.replace('[', '\\[').replace(']', '\\]')} `;
      return !css.includes(`html:not(.landscape-liberado) ${seletor}`);
    });

    expect(semTraducao, `sem tradução em index.css: ${semTraducao.join(', ')}`).toEqual([]);
  });
});
