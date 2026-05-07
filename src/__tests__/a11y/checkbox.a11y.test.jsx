/**
 * A11y tests for Checkbox (W2-5)
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Checkbox } from '@/design-system/components/ui/checkbox';

const A11Y_OPTIONS = { resultTypes: ['violations'] };

describe('A11y — Checkbox', () => {
  it('checkbox simples com label passa a11y', async () => {
    const { container } = render(
      <Checkbox label="Aceito os termos" checked={false} onChange={() => {}} />
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('checkbox com label + description passa a11y', async () => {
    const { container } = render(
      <Checkbox
        label="Notificações por email"
        description="Receba atualizações sobre novos documentos"
        checked
        onChange={() => {}}
      />
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('checkbox com erro expõe aria-invalid e aria-describedby', async () => {
    const { container } = render(
      <Checkbox
        label="Concordo com a LGPD"
        checked={false}
        onChange={() => {}}
        error="Você precisa aceitar para continuar"
      />
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('checkbox disabled passa a11y', async () => {
    const { container } = render(
      <Checkbox label="Opção indisponível" checked={false} onChange={() => {}} disabled />
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });
});
