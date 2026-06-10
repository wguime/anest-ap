import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Wave 1.7 (LGPD): a página deixou de ler Firestore via educacaoService e passou
// a chamar a edge function pública `verify-cert-uuid-public` com fetch().
// Os mocks abaixo refletem essa arquitetura: fetch global + VITE_SUPABASE_URL.

const mockFetch = vi.fn();

vi.mock('@/design-system', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
  Badge: ({ children, variant }) => <span data-testid="badge" data-variant={variant}>{children}</span>,
}));

vi.mock('@/design-system/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
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

/** Resposta 200 da edge verify-cert-uuid-public */
function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

const baseCert = {
  valid: true,
  status: 'valido',
  iniciais: 'D.T.',
  cursoTitulo: 'Seguranca do Paciente',
  cargaHoraria: '20h',
  dataEmissao: new Date().toISOString(),
  validoAte: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  signatureVersion: 2,
};

describe('VerificarCertificadoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // 1. Loading state
  it('shows spinner and loading text while verifying', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<VerificarCertificadoPage certificadoId="cert-123" />);

    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByText('Verificando certificado...')).toBeInTheDocument();
  });

  // 2. Valid certificate
  it('shows "Certificado Valido" badge for valid certificate', async () => {
    mockFetch.mockResolvedValue(okResponse({ ...baseCert, status: 'valido' }));

    render(<VerificarCertificadoPage certificadoId="cert-123" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Valido');
      expect(badge).toHaveAttribute('data-variant', 'success');
    });
    // chama a edge pública com o uuid
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('verify-cert-uuid-public?uuid=cert-123'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  // 3. Expired certificate
  it('shows "Certificado Expirado" badge for expired certificate', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        ...baseCert,
        status: 'expirado',
        validoAte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    );

    render(<VerificarCertificadoPage certificadoId="cert-456" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Expirado');
      expect(badge).toHaveAttribute('data-variant', 'warning');
    });
  });

  // 4. Revoked certificate
  it('shows "Certificado Revogado" badge for revoked certificate', async () => {
    mockFetch.mockResolvedValue(okResponse({ ...baseCert, status: 'revogado' }));

    render(<VerificarCertificadoPage certificadoId="cert-789" />);

    await waitFor(() => {
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('Certificado Revogado');
      expect(badge).toHaveAttribute('data-variant', 'destructive');
    });
  });

  // 5. Not found (edge devolve valid: false)
  it('shows error message when certificate is not found', async () => {
    mockFetch.mockResolvedValue(okResponse({ valid: false, reason: 'not_found' }));

    render(<VerificarCertificadoPage certificadoId="invalid-id" />);

    await waitFor(() => {
      expect(screen.getByText('Certificado Nao Encontrado')).toBeInTheDocument();
    });
  });

  // 6. Assinatura server-side (signatureVersion >= 2) → "Valida"
  it('shows "Valida" when signatureVersion >= 2 (assinatura server-side)', async () => {
    mockFetch.mockResolvedValue(okResponse({ ...baseCert, signatureVersion: 2 }));

    render(<VerificarCertificadoPage certificadoId="cert-sig" />);

    await waitFor(() => {
      expect(screen.getByText('Valida')).toBeInTheDocument();
    });
  });

  // 7. Certificado antigo sem assinatura server-side → "Legado"
  // (a página não exibe mais "Invalida": cert sem signatureVersion>=2 é legado)
  it('shows "Legado" when certificate has no server-side signature', async () => {
    mockFetch.mockResolvedValue(okResponse({ ...baseCert, signatureVersion: undefined }));

    render(<VerificarCertificadoPage certificadoId="cert-leg" />);

    await waitFor(() => {
      expect(screen.getByText('Legado')).toBeInTheDocument();
    });
  });
});
