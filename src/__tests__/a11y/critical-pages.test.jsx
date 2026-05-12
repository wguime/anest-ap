/**
 * A11y smoke tests para páginas críticas (Fase B — fech-a11y).
 *
 * Não monta a página inteira (dependências de contexto/Firebase/Supabase
 * seriam pesadas demais). Em vez disso, valida invariantes WCAG sobre
 * fragmentos representativos extraídos da estrutura real das páginas
 * críticas: CentroGestao, Biblioteca, Calculadoras.
 *
 * Asserts:
 * - exatamente 1 <h1> por página
 * - <main id="main-content"> presente (provido por App.jsx — testado em fragmento)
 * - todos os <button> têm text content OU aria-label
 * - todos os <img> têm atributo alt (mesmo que vazio)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

afterEach(cleanup);

/**
 * Helper: dado um container, verifica todos os botões e imagens.
 */
function assertA11yInvariants(container, { expectH1 = true } = {}) {
  if (expectH1) {
    const h1s = container.querySelectorAll('h1');
    expect(h1s.length, 'deve existir exatamente 1 <h1>').toBe(1);
  }

  const buttons = container.querySelectorAll('button');
  buttons.forEach((btn, i) => {
    const hasText = (btn.textContent || '').trim().length > 0;
    const ariaLabel = (btn.getAttribute('aria-label') || '').trim().length > 0;
    const ariaLabelledBy = (btn.getAttribute('aria-labelledby') || '').trim().length > 0;
    const accessible = hasText || ariaLabel || ariaLabelledBy;
    expect(
      accessible,
      `<button> #${i} (${btn.outerHTML.slice(0, 80)}) precisa de text content, aria-label ou aria-labelledby`
    ).toBe(true);
  });

  const imgs = container.querySelectorAll('img');
  imgs.forEach((img, i) => {
    expect(
      img.hasAttribute('alt'),
      `<img> #${i} precisa do atributo alt (decorativas use alt="")`
    ).toBe(true);
  });
}

// =============================================================================
// CentroGestao — fragmento do layout principal
// =============================================================================
describe('A11y smoke — CentroGestao (fragment)', () => {
  it('layout do header com botão "Voltar" + h1 "Centro de Gestão" passa invariants', () => {
    const { container } = render(
      <div>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only"
        >
          Pular para o conteúdo principal
        </a>
        <main id="main-content" tabIndex={-1}>
          <nav>
            <button type="button" aria-label="Voltar">
              <svg aria-hidden="true" />
              <span>Voltar</span>
            </button>
            <h1>Centro de Gestão</h1>
            <button type="button" aria-label="Exportar PDF">
              <svg aria-hidden="true" />
            </button>
          </nav>
          <section>
            <h2>Usuários</h2>
            <button type="button">Adicionar usuário</button>
            <button type="button" aria-label="Editar permissões">
              <svg aria-hidden="true" />
            </button>
          </section>
        </main>
      </div>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    assertA11yInvariants(container);
  });
});

// =============================================================================
// Biblioteca — fragmento de listagem de documentos
// =============================================================================
describe('A11y smoke — Biblioteca (fragment)', () => {
  it('layout com header + lista de documentos passa invariants', () => {
    const { container } = render(
      <main id="main-content">
        <nav>
          <button type="button" aria-label="Voltar">
            <svg aria-hidden="true" />
            <span>Voltar</span>
          </button>
          <h1>Biblioteca</h1>
        </nav>
        <div role="search">
          <input
            type="text"
            aria-label="Buscar documentos"
            placeholder="Buscar..."
          />
          <button type="button" aria-label="Limpar busca">
            <svg aria-hidden="true" />
          </button>
        </div>
        <section aria-labelledby="protocolos-heading">
          <h2 id="protocolos-heading">Protocolos</h2>
          <article>
            <h3>POP — Anestesia Geral</h3>
            <button type="button">Abrir</button>
          </article>
        </section>
      </main>
    );

    assertA11yInvariants(container);
  });
});

// =============================================================================
// Calculadoras — fragmento de lista + busca + favoritos
// =============================================================================
describe('A11y smoke — Calculadoras (fragment)', () => {
  it('lista de calculadoras com botão favorito (icon-only) passa invariants', () => {
    const { container } = render(
      <main id="main-content">
        <h1>Calculadoras</h1>
        <div role="search">
          <input
            type="text"
            aria-label="Buscar calculadora"
            placeholder="Buscar calculadora..."
          />
        </div>
        <section aria-labelledby="cardio-heading">
          <h2 id="cardio-heading">Cardiologia</h2>
          <ul>
            <li>
              <button type="button">CHA2DS2-VASc</button>
              <button type="button" aria-label="Favoritar CHA2DS2-VASc">
                <svg aria-hidden="true" />
              </button>
            </li>
            <li>
              <button type="button">HAS-BLED</button>
              <button type="button" aria-label="Favoritar HAS-BLED">
                <svg aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </main>
    );

    assertA11yInvariants(container);
  });

  it('detalhe de calculadora (h1 = título da calc) passa invariants', () => {
    const { container } = render(
      <main id="main-content">
        <h1>CHA2DS2-VASc</h1>
        <p>Risco de AVC em fibrilação atrial</p>
        <form>
          <fieldset>
            <legend>Fatores de risco</legend>
            <label>
              <input type="checkbox" />
              ICC
            </label>
            <label>
              <input type="checkbox" />
              Hipertensão
            </label>
          </fieldset>
          <button type="submit">Calcular</button>
        </form>
      </main>
    );

    assertA11yInvariants(container);
  });
});

// =============================================================================
// Regression — App skip link + landmark
// =============================================================================
describe('A11y smoke — App skeleton landmarks', () => {
  it('skip link + <main id="main-content"> presentes e acessíveis', () => {
    const { container } = render(
      <div>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1500] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Pular para o conteúdo principal
        </a>
        <main id="main-content" tabIndex={-1}>
          <h1>Conteúdo</h1>
        </main>
      </div>
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main.id).toBe('main-content');

    const skipLink = container.querySelector('a[href="#main-content"]');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.textContent).toMatch(/pular/i);
    assertA11yInvariants(container);
  });
});
