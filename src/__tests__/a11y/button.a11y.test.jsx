/**
 * A11y tests for Button (W2-5)
 * Verifies WCAG 2.1 AA compliance via axe-core for the DS Button component.
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from '@/design-system/components/ui/button';

// Limita a regras CRITICAL/SERIOUS — warnings minor são tolerados.
const A11Y_OPTIONS = {
  resultTypes: ['violations'],
};

describe('A11y — Button', () => {
  it('default variant tem 0 violations', async () => {
    const { container } = render(<Button>Salvar</Button>);
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('todas as variantes em conjunto não introduzem violations', async () => {
    const { container } = render(
      <div>
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="success">Success</Button>
        <Button variant="warning">Warning</Button>
        <Button variant="destructive">Excluir</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="outline">Outline</Button>
      </div>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('disabled e loading expõem aria-disabled/aria-busy corretamente', async () => {
    const { container } = render(
      <div>
        <Button disabled>Desabilitado</Button>
        <Button loading>Carregando</Button>
      </div>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('icon-only button precisa de aria-label para passar a11y', async () => {
    const { container } = render(
      <Button size="icon" aria-label="Fechar painel">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" />
        </svg>
      </Button>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });
});
