/**
 * Skeleton.test.jsx
 * Tests for the anest Skeleton family (Skeleton, SkeletonCard, SkeletonRow,
 * SkeletonText, SkeletonAvatar).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Skeleton, SkeletonCard, SkeletonRow, SkeletonText, SkeletonAvatar } from '@/design-system/components/anest/skeleton';

describe('anest/Skeleton family', () => {
  it('renders <Skeleton /> with role="presentation" + aria-hidden + bg-muted/animate-pulse', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild;
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('role', 'presentation');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('bg-muted');
    expect(el.className).toContain('animate-pulse');
  });

  it('renders <SkeletonCard /> with card classes (h-32, border, rounded-xl)', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('role', 'presentation');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('h-32');
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('border');
  });

  it('renders <SkeletonRow /> with single-line height (h-4)', () => {
    const { container } = render(<SkeletonRow />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('bg-muted');
  });

  it('<SkeletonText lines={N} /> renders N SkeletonRow children', () => {
    const { container } = render(<SkeletonText lines={5} />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveAttribute('role', 'presentation');
    expect(wrapper.children).toHaveLength(5);
    // Each child should be a row with h-4 + animate-pulse
    Array.from(wrapper.children).forEach((child) => {
      expect(child.className).toContain('h-4');
      expect(child.className).toContain('animate-pulse');
    });
  });

  it('<SkeletonText /> falls back to >=1 line when given invalid `lines`', () => {
    const { container } = render(<SkeletonText lines={0} />);
    expect(container.firstChild.children).toHaveLength(1);
  });

  it('<SkeletonText lines={1} /> does NOT shrink the only row (no w-4/5)', () => {
    const { container } = render(<SkeletonText lines={1} />);
    const onlyRow = container.firstChild.firstChild;
    expect(onlyRow.className).toContain('w-full');
    expect(onlyRow.className).not.toContain('w-4/5');
  });

  it('<SkeletonText lines>1 /> shrinks the last row (w-4/5) for paragraph feel', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const rows = container.firstChild.children;
    expect(rows[rows.length - 1].className).toContain('w-4/5');
    expect(rows[0].className).toContain('w-full');
  });

  it('<SkeletonAvatar size="md" /> renders circular skeleton with md sizing', () => {
    const { container } = render(<SkeletonAvatar size="md" />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveAttribute('data-size', 'md');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('h-11');
    expect(el.className).toContain('w-11');
  });

  it('<SkeletonAvatar size="sm" /> applies smaller dims', () => {
    const { container } = render(<SkeletonAvatar size="sm" />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('data-size', 'sm');
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-8');
  });

  it('<SkeletonAvatar size="xl" /> applies largest dims', () => {
    const { container } = render(<SkeletonAvatar size="xl" />);
    const el = container.firstChild;
    expect(el.className).toContain('h-20');
    expect(el.className).toContain('w-20');
  });

  it('falls back to md when size prop is unknown', () => {
    const { container } = render(<SkeletonAvatar size="bogus" />);
    const el = container.firstChild;
    expect(el.className).toContain('h-11');
    expect(el.className).toContain('w-11');
  });

  it('custom className merges via cn() on every variant', () => {
    const cases = [
      <Skeleton className="my-skel-1" />,
      <SkeletonCard className="my-skel-2" />,
      <SkeletonRow className="my-skel-3" />,
      <SkeletonText className="my-skel-4" lines={2} />,
      <SkeletonAvatar className="my-skel-5" />,
    ];
    cases.forEach((node, i) => {
      const { container } = render(node);
      expect(container.firstChild.className).toContain(`my-skel-${i + 1}`);
      // bg-muted / animate-pulse should still be present (except wrapper-only SkeletonText)
      if (i !== 3) {
        expect(container.firstChild.className).toContain('animate-pulse');
      }
    });
  });
});
