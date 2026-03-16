/**
 * QuizCurso.test.jsx
 * Tests for the quiz/assessment component used in education courses.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mock educacaoService ────────────────────────────────────────────
const mockGetQuiz = vi.fn();
const mockGetQuizConfig = vi.fn();
const mockGetQuizTentativas = vi.fn();
const mockGetProgressoCurso = vi.fn();
const mockSalvarResultadoQuiz = vi.fn();
const mockSalvarQuizTentativa = vi.fn();

vi.mock('@/services/educacaoService', () => ({
  getQuiz: (...args) => mockGetQuiz(...args),
  getQuizConfig: (...args) => mockGetQuizConfig(...args),
  getQuizTentativas: (...args) => mockGetQuizTentativas(...args),
  getProgressoCurso: (...args) => mockGetProgressoCurso(...args),
  salvarResultadoQuiz: (...args) => mockSalvarResultadoQuiz(...args),
  salvarQuizTentativa: (...args) => mockSalvarQuizTentativa(...args),
}));

// ── Mock design-system ──────────────────────────────────────────────
vi.mock('@/design-system', () => ({
  Card: ({ children, ...props }) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
  Button: ({ children, onClick, disabled, leftIcon, rightIcon, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{leftIcon}{children}{rightIcon}</button>
  ),
  Badge: ({ children, variant, ...props }) => <span data-variant={variant} {...props}>{children}</span>,
  Progress: ({ value }) => <div role="progressbar" aria-valuenow={value} />,
  Alert: ({ children, title, variant }) => (
    <div role="alert" data-variant={variant}><strong>{title}</strong>{children}</div>
  ),
  Spinner: ({ size }) => <div data-testid="spinner" data-size={size} />,
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/design-system/utils/tokens', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  CheckCircle: () => <span>check-circle</span>,
  XCircle: () => <span>x-circle</span>,
  ChevronRight: () => <span>chevron-right</span>,
  ChevronLeft: () => <span>chevron-left</span>,
  RotateCcw: () => <span>rotate-ccw</span>,
  Trophy: () => <span>trophy</span>,
  AlertTriangle: () => <span>alert-triangle</span>,
  Clock: () => <span>clock</span>,
  Lock: () => <span>lock</span>,
}));

// ── Import component ────────────────────────────────────────────────
import { QuizCurso } from '../../../pages/educacao/components/QuizCurso';

// ── Default mock data ───────────────────────────────────────────────
const defaultPerguntas = [
  { texto: 'Pergunta 1?', opcoes: ['A', 'B', 'C', 'D'], respostaCorreta: 0 },
  { texto: 'Pergunta 2?', opcoes: ['A', 'B', 'C', 'D'], respostaCorreta: 1 },
  { texto: 'Pergunta 3?', opcoes: ['A', 'B', 'C', 'D'], respostaCorreta: 2 },
];

function setupDefaultMocks() {
  mockGetQuiz.mockResolvedValue({ perguntas: defaultPerguntas, error: null });
  mockGetQuizConfig.mockResolvedValue({ config: { maxTentativas: 3, tempoLimiteMinutos: null } });
  mockGetQuizTentativas.mockResolvedValue({ tentativas: [] });
  mockGetProgressoCurso.mockResolvedValue({ progresso: {} });
  mockSalvarResultadoQuiz.mockResolvedValue({ success: true });
  mockSalvarQuizTentativa.mockResolvedValue({ success: true });
}

const defaultProps = {
  cursoId: 'curso-1',
  userId: 'user-1',
  notaMinima: 70,
  onComplete: vi.fn(),
};

// ── Tests ───────────────────────────────────────────────────────────
describe('QuizCurso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Renders questions after loading
  it('renders questions after loading (shows "Avaliacao" header)', async () => {
    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // One of the shuffled questions should be visible
    await waitFor(() => {
      const perguntaTexts = defaultPerguntas.map((p) => p.texto);
      const found = perguntaTexts.some((t) => screen.queryByText(t, { exact: false }));
      expect(found).toBe(true);
    });
  });

  // 2. Shows loading spinner initially
  it('shows loading spinner initially', () => {
    render(<QuizCurso {...defaultProps} />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  // 3. Navigation dots: clicking a dot changes the active question
  it('navigation dots: clicking dot changes active question', async () => {
    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // There should be 3 navigation dots (aria-label "Pergunta N")
    const dot2 = screen.getByLabelText(/Pergunta 2/);
    const dot3 = screen.getByLabelText(/Pergunta 3/);

    // Initially showing question 1 → counter says "1 / 3"
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(dot3);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    fireEvent.click(dot2);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  // 4. Select answer (click option -> radio checked)
  it('selects answer when option clicked (radio checked)', async () => {
    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Get all radio options
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(4); // 4 options per question

    // Click the first radio
    fireEvent.click(radios[0]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  // 5. Submit calculates score (all correct -> 100%)
  it('submit calculates 100% when all answers correct', async () => {
    // Use a deterministic single-question quiz so we know the correct answer
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Unica Pergunta?', opcoes: ['Certo', 'Errado1', 'Errado2', 'Errado3'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // The quiz shuffles options. We need to find which radio displays "Certo" and click it.
    const radios = screen.getAllByRole('radio');
    const certoRadio = radios.find((r) => r.textContent.includes('Certo'));
    expect(certoRadio).toBeDefined();
    fireEvent.click(certoRadio);

    // The submit button should now be enabled (single question, answered)
    const submitBtn = screen.getByText('Enviar Respostas');
    expect(submitBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Should show result
    await waitFor(() => {
      expect(screen.getByText(/Nota: 100%/)).toBeInTheDocument();
    });
  });

  // 6. Approved with nota >= notaMinima (shows "Aprovado!")
  it('shows "Aprovado!" when nota >= notaMinima', async () => {
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Q1?', opcoes: ['Certo', 'Errado'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} notaMinima={70} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Select correct answer
    const radios = screen.getAllByRole('radio');
    const certoRadio = radios.find((r) => r.textContent.includes('Certo'));
    fireEvent.click(certoRadio);

    await act(async () => {
      fireEvent.click(screen.getByText('Enviar Respostas'));
    });

    await waitFor(() => {
      expect(screen.getByText('Aprovado!')).toBeInTheDocument();
    });
  });

  // 7. Failed with nota < notaMinima (shows "Nao aprovado")
  it('shows "Nao aprovado" when nota < notaMinima', async () => {
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Q1?', opcoes: ['Certo', 'Errado'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} notaMinima={70} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Select WRONG answer
    const radios = screen.getAllByRole('radio');
    const erradoRadio = radios.find((r) => r.textContent.includes('Errado'));
    fireEvent.click(erradoRadio);

    await act(async () => {
      fireEvent.click(screen.getByText('Enviar Respostas'));
    });

    await waitFor(() => {
      expect(screen.getByText('Não aprovado')).toBeInTheDocument();
    });
  });

  // 8. Timer visible when tempoLimiteMinutos set
  it('shows timer when tempoLimiteMinutos is set', async () => {
    mockGetQuizConfig.mockResolvedValue({
      config: { maxTentativas: 3, tempoLimiteMinutos: 10 },
    });

    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Timer should show "10:00" (10 minutes)
    await waitFor(() => {
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });
  });

  // 9. Timer auto-submits when expired
  it('auto-submits when timer expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockGetQuizConfig.mockResolvedValue({
      config: { maxTentativas: 3, tempoLimiteMinutos: 1 },
    });
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Q1?', opcoes: ['A', 'B'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} />);

    // Wait for loading to complete (shouldAdvanceTime allows microtasks to resolve)
    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Timer should be visible with 1:00
    await waitFor(() => {
      expect(screen.getByText('1:00')).toBeInTheDocument();
    });

    // Advance 61 seconds (timer goes to 0 and auto-submits)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 1000);
    });

    // After auto-submit, the result screen should appear (role="alert")
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  // 10. Blocked by cooldown shows lock message
  it('shows lock message when blocked by cooldown', async () => {
    // Return a bloqueadoAte in the future
    const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
    mockGetProgressoCurso.mockResolvedValue({
      progresso: {
        quizResult: {
          bloqueadoAte: futureDate,
        },
      },
    });

    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação temporariamente bloqueada')).toBeInTheDocument();
    });
  });

  // 11. Review hides correct answers in non-final retry
  it('hides correct answers in review when not on final attempt', async () => {
    // 0 tentativas used, maxTentativas = 3 => not final attempt
    mockGetQuizTentativas.mockResolvedValue({ tentativas: [] });
    mockGetQuizConfig.mockResolvedValue({
      config: { maxTentativas: 3, tempoLimiteMinutos: null },
    });
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Q1?', opcoes: ['Certo', 'Errado'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} notaMinima={100} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    // Select WRONG answer to fail
    const radios = screen.getAllByRole('radio');
    const erradoRadio = radios.find((r) => r.textContent.includes('Errado'));
    fireEvent.click(erradoRadio);

    await act(async () => {
      fireEvent.click(screen.getByText('Enviar Respostas'));
    });

    await waitFor(() => {
      expect(screen.getByText('Não aprovado')).toBeInTheDocument();
    });

    // "Resposta correta:" should NOT be visible (not final attempt & not approved)
    expect(screen.queryByText(/Resposta correta:/)).not.toBeInTheDocument();
  });

  // 12. ARIA: role="alert" on result screen
  it('result screen has role="alert"', async () => {
    mockGetQuiz.mockResolvedValue({
      perguntas: [
        { texto: 'Q1?', opcoes: ['Certo', 'Errado'], respostaCorreta: 0 },
      ],
      error: null,
    });

    render(<QuizCurso {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Avaliação')).toBeInTheDocument();
    });

    const radios = screen.getAllByRole('radio');
    const certoRadio = radios.find((r) => r.textContent.includes('Certo'));
    fireEvent.click(certoRadio);

    await act(async () => {
      fireEvent.click(screen.getByText('Enviar Respostas'));
    });

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});
