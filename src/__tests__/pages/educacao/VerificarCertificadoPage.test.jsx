import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetCertificadoById = vi.fn();
const mockVerificarAssinatura = vi.fn();

vi.mock('@/services/educacaoService', () => ({
  getCertificadoById: (...args) => mockGetCertificadoById(...args),
  verificarAssinatura: (...args) => mockVerificarAssinatura(...args),
}));

vi.mock('@/design-system', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
  Badge: ({ children, variant }) => <span data-testid="badge" data-variant={variant}>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  CheckCircle: ({ className }) => <span data-testid="check-icon" className={className} />,
  XCircle: ({ className }) => <span data-testid="x-icon" className={className} />,
  AlertTriangle: ({ className }) => <span data-testid="alert-icon" className={className} />,
  Clock: ({ className }) => <span data-testid="clock-icon" className={className} />,
  Award: ({ className }) => <span data-testid="award-icon" className={className} />,
  Loader2: ({ className }) => <span data-testid="loader-icon" className={className} />,
}));

import VerificarCertificadoPage from '../../../pages/educacao/VerificarCertificadoPage';

describe('VerificarCertificadoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Loading state
  it('shows spinner and loading text while verifying', () => {
    mockGetCertificadoById.mockReturnValue(new Promise(() => {})); // never resolves
    render(<VerificarCertificadoPage certificadoId="cert-123" />);

    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByText('Verificando certificado...')).toBeInTheDocument();
  });

  // 2. Valid certificate
  it('shows "Certificado Valido" badge for valid certificate', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    mockGetCertificadoById.mockResolvedValue({
      certificado: {
        id: 'cert-123',
        status: 'valido',
        validoAte: futureDate,
        userNome: 'Dr. Teste',
        cursoTitulo: 'Seguranca do Paciente',
        cargaHoraria: '20h',
        dataEmissao: new Date().toISOString(),
      },
      error: null,
    });
    mockVerificarAssinatura.mockResolvedValue(true);

    render(<VerificarCertificadoPage certificadoId="cert-123" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Valido');
      expect(badge).toHaveAttribute('data-variant', 'success');
    });
  });

  // 3. Expired certificate
  it('shows "Certificado Expirado" badge for expired certificate', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    mockGetCertificadoById.mockResolvedValue({
      certificado: {
        id: 'cert-456',
        validoAte: pastDate,
        userNome: 'Dr. Expirado',
        cursoTitulo: 'Curso Antigo',
        cargaHoraria: '10h',
        dataEmissao: new Date().toISOString(),
      },
      error: null,
    });
    mockVerificarAssinatura.mockResolvedValue(true);

    render(<VerificarCertificadoPage certificadoId="cert-456" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Expirado');
      expect(badge).toHaveAttribute('data-variant', 'warning');
    });
  });

  // 4. Revoked certificate
  it('shows "Certificado Revogado" badge for revoked certificate', async () => {
    mockGetCertificadoById.mockResolvedValue({
      certificado: {
        id: 'cert-789',
        status: 'revogado',
        validoAte: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        userNome: 'Dr. Revogado',
        cursoTitulo: 'Curso Revogado',
        cargaHoraria: '15h',
        dataEmissao: new Date().toISOString(),
      },
      error: null,
    });
    mockVerificarAssinatura.mockResolvedValue(false);

    render(<VerificarCertificadoPage certificadoId="cert-789" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Revogado');
      expect(badge).toHaveAttribute('data-variant', 'destructive');
    });
  });

  // 5. Not found
  it('shows error message when certificate is not found', async () => {
    mockGetCertificadoById.mockResolvedValue({
      certificado: null,
      error: 'Certificado nao encontrado',
    });

    render(<VerificarCertificadoPage certificadoId="invalid-id" />);

    await waitFor(() => {
      expect(screen.getByText('Certificado Nao Encontrado')).toBeInTheDocument();
    });
  });

  // 6. Valid signature
  it('shows "Valida" when signature verification succeeds', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    mockGetCertificadoById.mockResolvedValue({
      certificado: {
        id: 'cert-sig',
        status: 'valido',
        validoAte: futureDate,
        userNome: 'Dr. Assinado',
        cursoTitulo: 'Curso Assinado',
        cargaHoraria: '8h',
        dataEmissao: new Date().toISOString(),
      },
      error: null,
    });
    mockVerificarAssinatura.mockResolvedValue(true);

    render(<VerificarCertificadoPage certificadoId="cert-sig" />);

    await waitFor(() => {
      expect(screen.getByText('Valida')).toBeInTheDocument();
    });
  });

  // 7. Invalid signature
  it('shows "Invalida" when signature verification fails', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    mockGetCertificadoById.mockResolvedValue({
      certificado: {
        id: 'cert-inv',
        status: 'valido',
        validoAte: futureDate,
        userNome: 'Dr. Invalido',
        cursoTitulo: 'Curso Invalido',
        cargaHoraria: '5h',
        dataEmissao: new Date().toISOString(),
      },
      error: null,
    });
    mockVerificarAssinatura.mockResolvedValue(false);

    render(<VerificarCertificadoPage certificadoId="cert-inv" />);

    await waitFor(() => {
      expect(screen.getByText('Invalida')).toBeInTheDocument();
    });
  });
});
