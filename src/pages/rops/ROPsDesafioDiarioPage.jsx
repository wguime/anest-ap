/**
 * Desafio do dia — Wave 1.6 T1.6.10 + T1.6.11
 *
 * - 5-10 questões aleatórias estratificadas por área (RPC server-side).
 * - Idempotente: mesmo (user, dia UTC) retorna mesmas questões.
 * - Streak compartilhado com Wave 1.1 (record_user_activity_day('desafio_rop'))
 *   — chamado dentro do RPC submit_daily_challenge_answer.
 * - Confetti em 100% (respeita prefers-reduced-motion).
 * - Anti-pattern: SEM leaderboard forçado aqui (LGPD opt-in via ranking page).
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Quiz, Button, Skeleton, Badge, useToast } from '@/design-system';
import { ChevronLeft, CalendarCheck, Flame, Trophy } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import supabaseROPsService from '@/services/supabaseROPsService';
import { triggerCompletionConfetti } from '@/utils/confetti';

export default function ROPsDesafioDiarioPage({ onNavigate, goBack }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [challenge, setChallenge] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [streak, setStreak] = useState({ streak: 0, longestStreak: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [finalResult, setFinalResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    (async () => {
      try {
        const dc = await supabaseROPsService.getOrCreateDailyChallenge({ size: 10 });
        if (cancelled) return;
        setChallenge(dc);

        const qs = await supabaseROPsService.fetchQuestionsByIds(dc.questionIds || []);
        if (cancelled) return;
        setQuestions(qs);

        // Streak para badge na tela
        const s = await supabaseROPsService.getStreak({ userId: user.id, userName: user.nome, userEmail: user.email });
        if (cancelled) return;
        setStreak(s);
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsDesafioDiarioPage] load:', err);
        const msg = err?.message?.includes('pool insuficiente')
          ? 'Banco de questões insuficiente. Tente novamente em breve.'
          : 'Não foi possível carregar o desafio. Tente novamente.';
        setError(msg);
        toast({ title: 'Erro', description: msg, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Quiz DS expected shape
  const formattedQuestions = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        question: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswerIndex,
        explanation: q.explanation,
        points: 10,
      })),
    [questions]
  );

  const isAlreadyCompleted = !!challenge?.completedAt;

  const handleAnswer = async (answer) => {
    if (!user?.id || !challenge?.id || !answer) return;
    try {
      await supabaseROPsService.submitDailyChallengeAnswer(
        {
          challengeId: challenge.id,
          questionId: answer.question?.id,
          selectedOption: answer.selectedAnswer,
          timeSeconds: answer.timeSpent ?? null,
        },
        { userId: user.id, userName: user.nome, userEmail: user.email }
      );
    } catch (err) {
      // Tolerar duplicata (já respondida) silenciosamente; outros erros: toast
      const msg = err?.message || '';
      if (msg.includes('já respondida')) return;
      console.warn('[ROPsDesafioDiarioPage] submitAnswer (non-fatal):', msg);
    }
  };

  const handleComplete = async (result) => {
    setFinalResult(result);
    triggerCompletionConfetti({ intensity: result?.percentage >= 80 ? 'trilha' : 'curso' });
    // Re-fetch streak para refletir incremento server-side
    try {
      const s = await supabaseROPsService.getStreak({ userId: user.id, userName: user.nome, userEmail: user.email });
      setStreak(s);
    } catch { /* ignore */ }
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px]"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Desafio do dia
          </h1>
          <div className="min-w-[70px] flex justify-end">
            {streak.streak > 0 && (
              <Badge variant="success" badgeStyle="subtle" className="gap-1">
                <Flame className="w-3 h-3" />
                {streak.streak}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 pt-4 sm:px-5 space-y-3">
          <Skeleton className="h-16 rounded-[16px]" />
          <Skeleton className="h-[300px] rounded-[16px]" />
        </div>
      </div>
    );
  }

  if (error || formattedQuestions.length === 0) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4">
        {createPortal(headerElement, document.body)}
        <p className="text-foreground text-lg font-bold mb-4">{error || 'Desafio indisponível'}</p>
        <Button onClick={goBack}>Voltar</Button>
      </div>
    );
  }

  if (isAlreadyCompleted && !finalResult) {
    // Estado: usuário já completou hoje (retornou e re-acessou)
    return (
      <div className="min-h-dvh bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 pt-4 sm:px-5 max-w-md mx-auto">
          <div className="text-center mt-10 mb-6">
            <div className="w-20 h-20 rounded-full bg-category-teal-bg mx-auto flex items-center justify-center mb-4">
              <CalendarCheck className="w-10 h-10 text-category-teal-fg" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Desafio do dia concluído!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Volte amanhã para um novo desafio (rola à 00:00 UTC).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-4 rounded-[16px] bg-card border border-border text-center">
              <Trophy className="w-5 h-5 text-warning mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground">Score</p>
              <p className="text-2xl font-bold text-foreground">{challenge?.scorePct ?? 0}%</p>
            </div>
            <div className="p-4 rounded-[16px] bg-card border border-border text-center">
              <Flame className="w-5 h-5 text-category-orange-fg mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground">Streak</p>
              <p className="text-2xl font-bold text-foreground">{streak.streak} {streak.streak === 1 ? 'dia' : 'dias'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="default" onClick={() => onNavigate('ropsDesafio')} className="w-full min-h-[44px]">
              Voltar para ROPs
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('ropsRanking')} className="w-full min-h-[44px]">
              Ver Ranking
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        {/* Banner do desafio */}
        <div className="mb-4 p-4 rounded-[16px] bg-category-teal-bg border-l-4 border-category-teal">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-category-teal flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5 text-category-teal-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-[15px] font-bold text-category-teal-fg">
                {formattedQuestions.length} questões aleatórias
              </h2>
              <p className="text-[13px] text-foreground/70 mt-0.5">
                Estratificadas por área. Sem repetição no mesmo dia.
              </p>
            </div>
          </div>
        </div>

        <Quiz
          questions={formattedQuestions}
          title="Quiz Qmentum"
          description={`Desafio diário · ${formattedQuestions.length} questões`}
          showProgress
          showScore
          showExplanation
          shuffleQuestions={false}
          shuffleOptions={false}
          allowSkip={false}
          pointsPerQuestion={10}
          onAnswer={handleAnswer}
          onComplete={handleComplete}
        />

        {finalResult && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center" role="status" aria-live="polite">
              Você acertou {finalResult.correct} de {finalResult.total} · streak agora: {streak.streak} {streak.streak === 1 ? 'dia' : 'dias'}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => onNavigate('ropsDesafio')}>Menu ROPs</Button>
              <Button variant="default" onClick={() => onNavigate('ropsRanking')}>Ver Ranking</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
