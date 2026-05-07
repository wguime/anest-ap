/**
 * A11y tests for Badge (W2-5)
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Badge } from '@/design-system/components/ui/badge';

const A11Y_OPTIONS = { resultTypes: ['violations'] };

describe('A11y — Badge', () => {
  it('todas as variantes solid não introduzem violations', async () => {
    const { container } = render(
      <div>
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="success">Sucesso</Badge>
        <Badge variant="warning">Atenção</Badge>
        <Badge variant="destructive">Erro</Badge>
        <Badge variant="info">Info</Badge>
      </div>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('estilos outline e subtle passam a11y', async () => {
    const { container } = render(
      <div>
        <Badge variant="success" badgeStyle="outline">Outline</Badge>
        <Badge variant="warning" badgeStyle="subtle">Subtle</Badge>
      </div>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('badge com count e dot passa a11y', async () => {
    const { container } = render(
      <div>
        <Badge count={5} variant="destructive" aria-label="5 notificações" />
        <Badge dot variant="success">Online</Badge>
      </div>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });
});
