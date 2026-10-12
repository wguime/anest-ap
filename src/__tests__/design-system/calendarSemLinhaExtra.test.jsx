import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Calendar } from '@/design-system/components/ui/calendar';

// O grid fixo de 6 semanas mostrava uma linha inteira só com dias do mês seguinte.
const diasNoGrid = (container) =>
  container.querySelectorAll('[data-slot="calendar"] .grid.grid-cols-7.gap-0\\.5 > button').length;

describe('Calendar — sem linha extra do mês seguinte', () => {
  it('dezembro/2026 (começa na terça) tem 5 semanas', () => {
    const { container } = render(<Calendar selected={new Date(2026, 11, 15)} />);
    expect(diasNoGrid(container)).toBe(35);
  });

  it('fevereiro/2026 (começa no domingo, 28 dias) tem 4 semanas', () => {
    const { container } = render(<Calendar selected={new Date(2026, 1, 10)} />);
    expect(diasNoGrid(container)).toBe(28);
  });

  it('agosto/2026 (começa no sábado, 31 dias) continua com 6 semanas', () => {
    const { container } = render(<Calendar selected={new Date(2026, 7, 10)} />);
    expect(diasNoGrid(container)).toBe(42);
  });
});
