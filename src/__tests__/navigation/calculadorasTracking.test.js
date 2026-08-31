/**
 * Trava da contagem de uso POR CALCULADORA e da rota da Escala de Braden.
 *
 * `trackFeatureUse` existia no hook desde sempre e nenhum componente o chamava —
 * por isso as duas triagens de calculadora tiveram de se apoiar em literatura e
 * escopo, e não em uso. Ligado em 31/08/2026 a pedido do dono.
 *
 * O teste lê App.jsx como TEXTO, no mesmo padrão de `pageSlugs.test.js`: a
 * ligação é entre um hook e um componente, e o que quebra na prática é alguém
 * remover o prop numa refatoração. Um teste de render não pegaria isso sem
 * montar o app inteiro com Firebase e Supabase.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from '../../navigation/pageSlugs';

const appSrc = fs.readFileSync(path.resolve(__dirname, '../../App.jsx'), 'utf8');

describe('cada abertura de calculadora vira um evento', () => {
  it('App.jsx pega `trackFeatureUse` do hook, não só `trackPageView`', () => {
    expect(appSrc).toMatch(/const\s*\{\s*trackPageView\s*,\s*trackFeatureUse\s*\}\s*=\s*useActivityTracking\(\)/);
  });

  it('o wrapper de Calculadoras recebe a função', () => {
    expect(appSrc).toMatch(/case 'calculadoras':[\s\S]{0,400}?onCalculatorOpen=\{trackFeatureUse\}/);
  });

  it('o wrapper aceita o prop e dispara ao abrir uma calculadora', () => {
    expect(appSrc).toMatch(/function CalculadorasPageWrapper\(\{[^}]*onCalculatorOpen/);
    expect(appSrc).toMatch(/onCalculatorOpen\(selectedCalcId\)/);
  });

  it('o efeito depende de selectedCalcId — um evento por abertura', () => {
    const trecho = appSrc.slice(appSrc.indexOf('function CalculadorasPageWrapper'));
    expect(trecho).toMatch(/\}, \[selectedCalcId, onCalculatorOpen\]\)/);
  });

  it('o hook NÃO é montado dentro do CalculatorShowcase', () => {
    // Montá-lo lá dispara busca de histórico e um intervalo de 5 min numa tela
    // aberta durante a anestesia. O evento sai do App, que já tem o hook.
    const showcase = fs.readFileSync(
      path.resolve(__dirname, '../../design-system/showcase/CalculatorShowcase.jsx'),
      'utf8',
    );
    expect(showcase).not.toContain('useActivityTracking');
  });
});

describe('Escala de Braden mora em Qualidade, não em Calculadoras', () => {
  it('a rota existe no switch', () => {
    expect(appSrc).toContain("case 'escalaBraden':");
  });

  it('está na lista canônica de páginas', () => {
    expect(PAGES).toContain('escalaBraden');
  });

  it('abre a calculadora fixa, sem passar pela grade', () => {
    expect(appSrc).toMatch(/case 'escalaBraden':[\s\S]{0,600}?calcFixa="seg_braden"/);
  });

  it('o cabeçalho não diz "Calculadoras" numa página que existe para não ser isso', () => {
    expect(appSrc).toMatch(/case 'escalaBraden':[\s\S]{0,600}?titulo="Escala de Braden"/);
  });

  it('em calcFixa, o Voltar sai da página em vez de cair na lista', () => {
    expect(appSrc).toMatch(/if \(selectedCalcId && !calcFixa\)/);
  });

  it('herda a permissão do card Qualidade', () => {
    expect(appSrc).toMatch(/escalaBraden:\s*'qualidade'/);
  });

  it('o card aparece na página de Qualidade', () => {
    const qualidade = fs.readFileSync(
      path.resolve(__dirname, '../../pages/QualidadePage.jsx'),
      'utf8',
    );
    expect(qualidade).toContain("onNavigate('escalaBraden')");
    expect(qualidade).toContain('Escala de Braden');
  });
});
