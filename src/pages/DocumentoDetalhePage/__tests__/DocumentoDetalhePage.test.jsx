/**
 * DocumentoDetalhePage — slice tests (W3-2 + W3-2b render).
 *
 * Cobre:
 *   • Estrutura: folder layout (5 subcomponentes + 3 modais lazy + 2 hooks)
 *   • SSOT: TIPO_DISPLAY_CONFIG vem de '@/types/documents'
 *   • React.lazy() está wired nos 3 modais
 *   • Render: documento renderiza header + metadata; loading/not-found state
 *   • Lazy modal: chunk só monta quando flag está aberto
 *
 * Pattern de mocks segue ApprovalQueue.test.jsx (que passa) — per-export named
 * mocks, sem Proxy em lucide-react. O hang anterior foi causado por um Proxy
 * que retornava Icon para qualquer get (incluindo símbolos internos do ESM
 * runtime), travando o module loader do vitest.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

// ── Estado controlável pelo teste ─────────────────────────────────────────
const baseDoc = {
  id: 'doc-123',
  category: 'biblioteca',
  categoria: 'biblioteca',
  titulo: 'Protocolo de Sedação',
  codigo: 'PROT-001',
  tipo: 'protocolo',
  setorId: 'anestesia',
  setorNome: 'Anestesia',
  versaoAtual: 2,
  descricao: 'Procedimento padrão para sedação consciente.',
  tags: ['sedação', 'anestesia'],
  createdByName: 'Dr. Teste',
  updatedAt: '2025-01-10T12:00:00.000Z',
  createdAt: '2024-12-01T12:00:00.000Z',
  proximaRevisao: '2026-01-10',
  arquivoURL: null,
  storagePath: null,
  versoes: [],
};

let mockDetailState = {
  documento: baseDoc,
  loading: false,
  versoes: [],
  pdfDisplayUrl: null,
  firebaseUser: { uid: 'uid-1', email: 'test@anest.com.br' },
  currentUser: { nome: 'Dr. Teste', displayName: 'Dr. Teste' },
  contextUpdateDocument: vi.fn(),
  contextArchiveDocument: vi.fn(),
  contextAddVersion: vi.fn(),
};

const mockHandlers = {
  handleEditSave: vi.fn(),
  handleNewVersionSave: vi.fn(),
  handleArchiveConfirm: vi.fn(),
};

vi.mock('../hooks/useDocumentDetail', () => ({
  useDocumentDetail: () => mockDetailState,
  default: () => mockDetailState,
}));

vi.mock('../hooks/useDocumentMutations', () => ({
  useDocumentMutations: () => mockHandlers,
  default: () => mockHandlers,
}));

// DS minimal — pattern do ApprovalQueue.test.jsx
vi.mock('@/design-system', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  PDFViewer: ({ title }) => <div data-testid="pdf-viewer">{title || 'pdf'}</div>,
  PageSkeleton: ({ variant }) => <div data-testid="page-skeleton" data-variant={variant} />,
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Modal: Object.assign(
    ({ open, children, title }) =>
      open ? (
        <div role="dialog" aria-label={typeof title === 'string' ? title : 'modal'}>
          {children}
        </div>
      ) : null,
    { Body: ({ children }) => <div>{children}</div> }
  ),
  ConfirmDialog: ({ open, children, title }) =>
    open ? (
      <div role="alertdialog" aria-label={typeof title === 'string' ? title : 'confirm'}>
        {children}
      </div>
    ) : null,
  Tabs: ({ children }) => <div>{children}</div>,
  TabsList: ({ children }) => <div>{children}</div>,
  TabsTrigger: ({ children, onClick }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  TabsContent: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>,
  Skeleton: () => <div />,
  Select: ({ value, onChange, options = [], placeholder }) => (
    <select value={value || ''} onChange={(e) => onChange?.(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
  Input: (props) => <input {...props} />,
  Textarea: (props) => <textarea {...props} />,
  FormField: ({ label, children }) => <label>{label}{children}</label>,
  Switch: ({ checked, onChange }) => (
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange?.(e.target.checked)} />
  ),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/documents/DistributionPanel', () => ({
  default: () => <div data-testid="distribution-panel" />,
}));

vi.mock('@/components/documents/AuditTrailViewer', () => ({
  default: () => <div data-testid="audit-trail-viewer" />,
}));

// Lazy modais: o orchestrador faz dynamic import, então mockamos os módulos
// Os modais são renderizados condicionalmente pelo orchestrator
// ({showEditModal && <EditDocumentModal .../>}), sem passar `open`. Mocks
// sempre montam quando renderizados.
vi.mock('../modals/EditDocumentModal', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Editar Documento">
      <button onClick={onClose}>fechar</button>
    </div>
  ),
}));
vi.mock('../modals/NewVersionModal', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Nova Versão">
      <button onClick={onClose}>fechar</button>
    </div>
  ),
}));
vi.mock('../modals/ArchiveDocumentModal', () => ({
  default: ({ onClose }) => (
    <div role="alertdialog" aria-label="Arquivar Documento">
      <button onClick={onClose}>fechar</button>
    </div>
  ),
}));

// react-dom createPortal: render inline (sem container fixo)
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children) => children,
  };
});

// import the page AFTER all mocks are declared
import DocumentoDetalhePage from '@/pages/DocumentoDetalhePage';

const renderPage = (overrides = {}) =>
  render(
    <DocumentoDetalhePage
      onNavigate={vi.fn()}
      goBack={vi.fn()}
      params={{ documentoId: 'doc-123' }}
      isAdmin={true}
      {...overrides}
    />
  );

describe('DocumentoDetalhePage — estrutura (W3-2)', () => {
  it('folder structure matches W3-2 spec', () => {
    expect(existsSync(resolve(ROOT, 'index.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentHeader.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentMetadata.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentVersions.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentApproval.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentAuditTrail.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/EditDocumentModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/NewVersionModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/ArchiveDocumentModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'hooks/useDocumentDetail.js'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'hooks/useDocumentMutations.js'))).toBe(true);
  });

  it('old monolithic DocumentoDetalhePage.jsx has been removed', () => {
    expect(existsSync(resolve(ROOT, '..', 'DocumentoDetalhePage.jsx'))).toBe(false);
  });

  it('the 3 modals are wired through React.lazy in index.jsx', () => {
    const indexSrc = readFileSync(resolve(ROOT, 'index.jsx'), 'utf-8');
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/EditDocumentModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/NewVersionModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/ArchiveDocumentModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/import\s*\{[^}]*\blazy\b[^}]*\}\s*from\s*['"]react['"]/);
    expect(indexSrc).toMatch(/import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*['"]react['"]/);
  });

  it('tipo display SSOT is imported from @/types/documents (no inline 30-entry hardcode)', () => {
    const metadataSrc = readFileSync(resolve(ROOT, 'DocumentMetadata.jsx'), 'utf-8');
    expect(metadataSrc).toMatch(/import\s*\{[^}]*getTipoDisplayConfig[^}]*\}\s*from\s*['"]@\/types\/documents['"]/);
    const inlineMatches = metadataSrc.match(/tipoConfig\s*=\s*\{/g) || [];
    expect(inlineMatches.length).toBe(0);
  });
});

describe('DocumentoDetalhePage — render (W3-2b)', () => {
  beforeEach(() => {
    mockDetailState = {
      documento: baseDoc,
      loading: false,
      versoes: [],
      pdfDisplayUrl: null,
      firebaseUser: { uid: 'uid-1', email: 'test@anest.com.br' },
      currentUser: { nome: 'Dr. Teste', displayName: 'Dr. Teste' },
      contextUpdateDocument: vi.fn(),
      contextArchiveDocument: vi.fn(),
      contextAddVersion: vi.fn(),
    };
    vi.clearAllMocks();
  });

  // Reativado pós-merge do PR #106: loading agora renderiza PageSkeleton (não spinner)
  it('renderiza loading state quando hook reporta loading', () => {
    mockDetailState = { ...mockDetailState, loading: true, documento: null };
    renderPage();
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renderiza estado "não encontrado" quando documento é null', () => {
    mockDetailState = { ...mockDetailState, loading: false, documento: null };
    renderPage();
    expect(screen.getByText(/Documento nao encontrado/i)).toBeInTheDocument();
  });

  it('renderiza header e metadata quando documento existe', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Protocolo de Sedação').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('PROT-001')).toBeInTheDocument();
    expect(screen.getByText('Anestesia')).toBeInTheDocument();
  });

  it('lazy EditDocumentModal só monta após o admin clicar em "Editar"', async () => {
    renderPage();
    expect(screen.queryByRole('dialog', { name: /Editar Documento/i })).toBeNull();
    fireEvent.click(screen.getByText('Editar'));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Editar Documento/i })).toBeInTheDocument();
    });
  });
});
