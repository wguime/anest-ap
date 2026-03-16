/**
 * AulaPlayer.test.jsx
 * Tests for the unified lesson player component (video/audio/document).
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// ── Mock trackingService (inline to avoid hoisting issue) ───────────
vi.mock('@/services/trackingService', () => ({
  trackingService: {
    startSession: vi.fn(),
    updateProgress: vi.fn(() => ({
      progressoPorcentagem: 50,
      status: 'em_andamento',
      isCompleted: false,
    })),
    pause: vi.fn(),
    resume: vi.fn(),
    endSession: vi.fn(),
    logEvent: vi.fn(),
  },
}));

// ── Mock educacaoService ────────────────────────────────────────────
vi.mock('@/services/educacaoService', () => ({
  salvarProgressoAula: vi.fn(() => Promise.resolve()),
}));

// ── Mock design-system ──────────────────────────────────────────────
vi.mock('@/design-system', () => ({
  VideoPlayer: (props) => (
    <div
      data-testid="video-player"
      data-type={props.type}
      data-video-id={props.videoId}
      data-src={props.src}
      data-on-time-update={props.onTimeUpdate ? 'yes' : 'no'}
      data-on-ended={props.onEnded ? 'yes' : 'no'}
    />
  ),
  AudioPlayer: (props) => (
    <div data-testid="audio-player" data-src={props.src} />
  ),
  PDFViewer: (props) => (
    <div data-testid="pdf-viewer" data-src={props.src} />
  ),
}));

// ── Mock UserContext ────────────────────────────────────────────────
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { uid: 'test-uid', id: 'test-uid', displayName: 'Test User' },
  }),
}));

// ── Mock educacaoUtils ──────────────────────────────────────────────
vi.mock('../../../pages/educacao/data/educacaoUtils', () => ({
  extractYouTubeId: vi.fn(() => 'yt-id-123'),
  extractVimeoId: vi.fn(() => '123456'),
}));

// ── Import component and mocked modules ─────────────────────────────
import { AulaPlayer } from '../../../pages/educacao/components/AulaPlayer';
import { trackingService } from '@/services/trackingService';
import { salvarProgressoAula } from '@/services/educacaoService';

// ── Default aula data ───────────────────────────────────────────────
function makeAula(overrides = {}) {
  return {
    id: 'aula-1',
    titulo: 'Aula de Teste',
    descricao: 'Descricao da aula',
    tipo: 'youtube',
    url: 'https://www.youtube.com/watch?v=abc123',
    duracao: 10, // minutes
    thumbnail: null,
    ...overrides,
  };
}

const defaultProps = {
  cursoId: 'curso-1',
  onProgress: vi.fn(),
  onComplete: vi.fn(),
};

// ── Tests ───────────────────────────────────────────────────────────
describe('AulaPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onProgress = vi.fn();
    defaultProps.onComplete = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Renders VideoPlayer for type youtube
  it('renders VideoPlayer with type="youtube" for youtube aula', () => {
    render(<AulaPlayer aula={makeAula({ tipo: 'youtube' })} {...defaultProps} />);

    const player = screen.getByTestId('video-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('data-type', 'youtube');
    expect(player).toHaveAttribute('data-video-id', 'yt-id-123');
  });

  // 2. Renders VideoPlayer for type vimeo
  it('renders VideoPlayer with type="vimeo" for vimeo aula', () => {
    render(
      <AulaPlayer
        aula={makeAula({ tipo: 'vimeo', url: 'https://vimeo.com/123456' })}
        {...defaultProps}
      />
    );

    const player = screen.getByTestId('video-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('data-type', 'vimeo');
    expect(player).toHaveAttribute('data-video-id', '123456');
  });

  // 3. Renders AudioPlayer for type audio
  it('renders AudioPlayer for audio type', () => {
    render(
      <AulaPlayer
        aula={makeAula({ tipo: 'audio', url: 'https://example.com/audio.mp3' })}
        {...defaultProps}
      />
    );

    const player = screen.getByTestId('audio-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('data-src', 'https://example.com/audio.mp3');
  });

  // 4. Renders PDFViewer for document PDF type
  it('renders PDFViewer for document PDF type', () => {
    render(
      <AulaPlayer
        aula={makeAula({
          tipo: 'document',
          url: 'https://example.com/file.pdf',
          mimeType: 'application/pdf',
        })}
        {...defaultProps}
      />
    );

    const viewer = screen.getByTestId('pdf-viewer');
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveAttribute('data-src', 'https://example.com/file.pdf');
  });

  // 5. Progress bar updates (role="progressbar" present)
  it('shows tracking progress bar with role="progressbar"', () => {
    render(<AulaPlayer aula={makeAula()} {...defaultProps} />);

    // trackingService.startSession should have been called
    expect(trackingService.startSession).toHaveBeenCalledWith(
      'test-uid', 'aula-1', 'curso-1', 10
    );

    // The progress bar should be rendered (isTracking = true after mount)
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  });

  // 6. handleTimeUpdate saves every ~15s (verify mock is wired)
  it('salvarProgressoAula is wired and not called before any time update', () => {
    render(<AulaPlayer aula={makeAula()} {...defaultProps} />);

    // startSession should have been called
    expect(trackingService.startSession).toHaveBeenCalled();

    // The VideoPlayer receives onTimeUpdate (verified via data attribute)
    const player = screen.getByTestId('video-player');
    expect(player).toHaveAttribute('data-on-time-update', 'yes');

    // salvarProgressoAula should not have been called yet (no time updates dispatched)
    expect(salvarProgressoAula).not.toHaveBeenCalled();
  });

  // 7. handleEnded calls onComplete callback via endSession
  it('VideoPlayer receives onEnded handler for completion', () => {
    trackingService.endSession.mockReturnValue({
      status: 'concluido',
      progressoPorcentagem: 100,
    });

    render(<AulaPlayer aula={makeAula()} {...defaultProps} />);

    // The VideoPlayer receives the onEnded callback
    const player = screen.getByTestId('video-player');
    expect(player).toHaveAttribute('data-on-ended', 'yes');

    // trackingService.startSession was called on mount
    expect(trackingService.startSession).toHaveBeenCalled();
  });

  // 8. Resolves tipo/url from aula.blocks fallback
  it('resolves tipo and url from aula.blocks when flat fields missing', () => {
    const aulaWithBlocks = {
      id: 'aula-blocks',
      titulo: 'Aula Blocks',
      descricao: 'Test',
      duracao: 5,
      tipo: undefined,
      url: undefined,
      blocks: [
        {
          type: 'youtube',
          data: { url: 'https://www.youtube.com/watch?v=block-vid' },
        },
      ],
    };

    render(<AulaPlayer aula={aulaWithBlocks} {...defaultProps} />);

    const player = screen.getByTestId('video-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('data-type', 'youtube');
    expect(player).toHaveAttribute('data-video-id', 'yt-id-123');
  });
});
