/**
 * PontosPage.test.jsx
 * Tests for the PontosPage (gamification/points dashboard)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/services/educacaoService', () => ({
  registrarAtividadeDiaria: vi.fn(() => Promise.resolve()),
  getProgressoUsuario: vi.fn(() => Promise.resolve({ progressos: [] })),
  getRankingUsuarios: vi.fn(() => Promise.resolve({ ranking: [] })),
  getEstatisticasUsuario: vi.fn(() => Promise.resolve({ estatisticas: { streak: 3, melhorStreak: 7 } })),
  getUserBadges: vi.fn(() => []),
  calcularBonusPontos: vi.fn(() => 0),
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'test-uid', displayName: 'Test User', email: 'test@test.com' } }),
}));

vi.mock('@/design-system', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
  Alert: ({ children, title }) => <div role="alert"><strong>{title}</strong>{children}</div>,
  Avatar: ({ children }) => <div>{children}</div>,
  AvatarFallback: ({ children }) => <span>{children}</span>,
  Badge: ({ children, variant }) => <span data-variant={variant}>{children}</span>,
  EmptyState: ({ title, description }) => <div>{title} - {description}</div>,
  Leaderboard: ({ entries, title }) => <div data-testid="leaderboard">{title} ({entries.length})</div>,
  AchievementGrid: ({ achievements }) => <div data-testid="achievement-grid">{achievements.length} achievements</div>,
  AchievementSummary: ({ total, unlocked }) => <div data-testid="achievement-summary">{unlocked}/{total}</div>,
  Collapsible: ({ children }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }) => <div>{children}</div>,
  CollapsibleContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/pages/educacao/components/PontosItem', () => ({
  PontosItem: ({ item }) => <div data-testid="pontos-item">{item.cursoTitulo}</div>,
}));

vi.mock('@/pages/educacao/hooks/useEducacaoData', () => ({
  useEducacaoData: () => ({ cursos: [], useMock: false }),
}));

vi.mock('@/pages/educacao/data/educacaoUtils', () => ({
  formatData: vi.fn(() => '-'),
  CREDIT_TYPE_LABELS: {},
  getModulosByCurso: vi.fn(() => []),
  getAulasByModulo: vi.fn(() => []),
  getAulasByCurso: vi.fn(() => []),
  getAulasByTrilha: vi.fn(() => []),
  getCursosByTrilha: vi.fn(() => []),
  buildContentTree: vi.fn(() => []),
  getContentStats: vi.fn(() => ({})),
  calcularDiasRestantes: vi.fn(() => 0),
}));

vi.mock('lucide-react', () => {
  const comp = (props) => <span {...props} />;
  return {
    ChevronLeft: comp,
    ChevronDown: comp,
    Heart: comp,
    Info: comp,
    Target: comp,
    Star: comp,
    Trophy: comp,
    Flame: comp,
    Gem: comp,
    BookOpen: comp,
    GraduationCap: comp,
    Clock: comp,
  };
});

import * as educacaoService from '@/services/educacaoService';
import PontosPage from '@/pages/educacao/PontosPage';

describe('PontosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock returns
    educacaoService.getProgressoUsuario.mockResolvedValue({ progressos: [] });
    educacaoService.getRankingUsuarios.mockResolvedValue({ ranking: [] });
    educacaoService.getEstatisticasUsuario.mockResolvedValue({
      estatisticas: { streak: 3, melhorStreak: 7 },
    });
    educacaoService.getUserBadges.mockReturnValue([]);
    educacaoService.calcularBonusPontos.mockReturnValue(0);
    educacaoService.registrarAtividadeDiaria.mockResolvedValue();
  });

  // 1. Renders user points section
  it('renders user points section with "pontos" text', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('pontos')).toBeInTheDocument();
    });
  });

  // 2. Renders achievement grid
  it('renders achievement grid component', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('achievement-grid')).toBeInTheDocument();
    });
  });

  // 3. Renders leaderboard
  it('renders leaderboard component', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
    });
  });

  // 4. Streak counter visible
  it('shows streak counter when streak is available', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('dias')).toBeInTheDocument();
    });
  });

  // 5. Calls registrarAtividadeDiaria on mount
  it('calls registrarAtividadeDiaria on mount', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(educacaoService.registrarAtividadeDiaria).toHaveBeenCalledWith('test-uid');
    });
  });

  // 6. Renders "Extrato de Pontos" header
  it('renders "Extrato de Pontos" header text', async () => {
    render(<PontosPage onNavigate={vi.fn()} goBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Extrato de Pontos')).toBeInTheDocument();
    });
  });
});
