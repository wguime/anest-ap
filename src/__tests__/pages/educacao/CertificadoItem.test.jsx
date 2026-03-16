import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ============================================================================
// Mocks
// ============================================================================
vi.mock('@/design-system', () => ({
  Button: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Badge: ({ children, variant, ...props }) => (
    <span data-variant={variant} {...props}>{children}</span>
  ),
  Spinner: () => <span>Loading...</span>,
}));

vi.mock('lucide-react', () => ({
  Download: (props) => <span data-testid="download-icon" {...props} />,
  RefreshCw: (props) => <span data-testid="refresh-icon" {...props} />,
}));

vi.mock('../../../pages/educacao/data/educacaoUtils', () => ({
  formatData: vi.fn((d) => {
    if (!d) return '-';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '-';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }),
  CREDIT_TYPE_LABELS: { geral: 'Geral', CME: 'CME' },
}));

import { CertificadoItem } from '../../../pages/educacao/components/CertificadoItem';
import { mockCertificado } from '../../helpers/mocks';

// ============================================================================
// Helpers
// ============================================================================
function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================================
// Tests
// ============================================================================
describe('CertificadoItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders certificate data (cursoTitulo, cargaHoraria, dataConclusao)', () => {
    const cert = mockCertificado({
      cursoTitulo: 'BLS Basico',
      cargaHoraria: '4h',
      dataConclusao: new Date(2025, 5, 15, 12, 0, 0), // June 15, local time
      validoAte: daysFromNow(365),
    });

    render(<CertificadoItem certificado={cert} />);

    expect(screen.getByText('BLS Basico')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    // dataConclusao formatted via formatData mock -> DD/MM/YYYY
    expect(screen.getByText('15/06/2025')).toBeInTheDocument();
  });

  it('shows green badge for valid certificate (variant="success")', () => {
    const cert = mockCertificado({
      validoAte: daysFromNow(365), // 1 year from now
    });

    render(<CertificadoItem certificado={cert} />);

    const badges = document.querySelectorAll('[data-variant="success"]');
    const validBadge = Array.from(badges).find((b) =>
      b.textContent.includes('Válido')
    );
    expect(validBadge).toBeTruthy();
  });

  it('shows yellow badge for expiring certificate (variant="warning")', () => {
    const cert = mockCertificado({
      validoAte: daysFromNow(30), // 30 days from now, under 90-day threshold
    });

    render(<CertificadoItem certificado={cert} />);

    const badges = document.querySelectorAll('[data-variant="warning"]');
    const expiringBadge = Array.from(badges).find((b) =>
      b.textContent.includes('restantes')
    );
    expect(expiringBadge).toBeTruthy();
  });

  it('shows red badge for expired certificate (variant="destructive")', () => {
    const cert = mockCertificado({
      validoAte: daysFromNow(-30), // 30 days ago
    });

    render(<CertificadoItem certificado={cert} />);

    const badges = document.querySelectorAll('[data-variant="destructive"]');
    const expiredBadge = Array.from(badges).find((b) =>
      b.textContent.includes('Expirado')
    );
    expect(expiredBadge).toBeTruthy();
  });

  it('shows "Renovar" button for expired certificate', () => {
    const cert = mockCertificado({
      validoAte: daysFromNow(-30),
    });
    const onRenovar = vi.fn();

    render(<CertificadoItem certificado={cert} onRenovar={onRenovar} />);

    const renovarBtn = screen.getByLabelText('Renovar certificado');
    expect(renovarBtn).toBeInTheDocument();
  });

  it('shows no expiration-specific badge when validoAte is null', () => {
    const cert = mockCertificado({
      validoAte: null,
    });

    render(<CertificadoItem certificado={cert} />);

    // When validoAte is null, getValidadeStatus returns 'valido' with diasRestantes=null
    // so the badge should show 'Válido' with success variant
    const badges = document.querySelectorAll('[data-variant="success"]');
    const validBadge = Array.from(badges).find((b) =>
      b.textContent.includes('Válido')
    );
    expect(validBadge).toBeTruthy();

    // Should NOT show destructive or warning variant
    const destructive = document.querySelectorAll('[data-variant="destructive"]');
    const warning = document.querySelectorAll('[data-variant="warning"]');
    expect(destructive).toHaveLength(0);
    expect(warning).toHaveLength(0);
  });

  it('formats dataConclusao in pt-BR locale', () => {
    const cert = mockCertificado({
      dataConclusao: new Date(2025, 11, 25, 12, 0, 0), // Dec 25, local time
      validoAte: daysFromNow(365),
    });

    render(<CertificadoItem certificado={cert} />);

    // formatData mock returns DD/MM/YYYY
    expect(screen.getByText('25/12/2025')).toBeInTheDocument();
  });
});
