import { useEffect, useMemo, useState } from 'react';
import { Quiz, Button, Skeleton, useToast } from '@/design-system';
import { Trophy, Home } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import supabaseROPsService from '@/services/supabaseROPsService';
import { PageHeader } from '../../components';
import { getAreaConfig } from './_areaConfig';

export default function ROPsQuizPage({ onNavigate, goBack, areaKey, ropKey }) {
  const { user } = useUser();
  const { toast } = useToast();
  const cfg = getAreaConfig(areaKey);

  const [questions, setQuestions] = useState([]);
  const [ropTitle, setRopTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!areaKey || !ropKey) return;
    (async () => {
      try {
        const qs = await supabaseROPsService.fetchQuestionsBySubdivisaoSlug(areaKey, ropKey);
        if (cancelled) return;
        if (!qs.length) {
          setError('Nenhuma questão disponível para esta ROP.');
        } else {
          setQuestions(qs);
          // Título da subdivisão via primeira questão (join inner já garante)
          if (qs[0]?.subdivisao?.title) setRopTitle(qs[0].subdivisao.title);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsQuizPage] load:', err);
        setError('Não foi possível carregar o quiz.');
        toast({ title: 'Erro', description: 'Falha ao carregar questões.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey, ropKey]);

  // Quiz DS espera shape específico
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

  const handleAnswer = async (answer) => {
    if (!user?.id || !answer?.questionId) return;
    try {
      await supabaseROPsService.recordAttempt(
        {
          questionId: answer.questionId,
          selectedOption: answer.selectedAnswer,
          timeSeconds: answer.timeSpent || null,
          context: 'quiz',
        },
        { userId: user.id, userName: user.nome, userEmail: user.email }
      );
    } catch (err) {
      console.warn('[ROPsQuizPage] recordAttempt (non-fatal):', err.message);
    }
    // Local-storage de progresso (recovery)
    try {
      const key = `rops_progress_${user.id}_${areaKey}_${ropKey}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      saved[answer.questionId] = answer.selectedAnswer;
      saved._lastUpdated = Date.now();
      localStorage.setItem(key, JSON.stringify(saved));
    } catch { /* ignore */ }
  };

  const handleComplete = () => {
    if (!user?.id) return;
    try {
      localStorage.removeItem(`rops_progress_${user.id}_${areaKey}_${ropKey}`);
    } catch { /* ignore */ }
  };

  const header = <PageHeader title="Quiz" onBack={goBack} backLabel="Sair" />;

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {header}
        <div className="px-4 pt-4 sm:px-5 space-y-3">
          <Skeleton className="h-8 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-[200px] rounded-[16px]" />
        </div>
      </div>
    );
  }

  if (error || !formattedQuestions.length) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4">
        {header}
        <p className="text-foreground text-lg font-bold mb-4">{error || 'Quiz não encontrado'}</p>
        <Button onClick={goBack}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {header}

      <div className="px-4 pt-4 sm:px-5">
        <Quiz
          questions={formattedQuestions}
          title={ropTitle || cfg.title}
          description={`${cfg.title} • ${formattedQuestions.length} questões`}
          showProgress
          showScore
          showExplanation
          shuffleQuestions
          shuffleOptions={false}
          allowSkip={false}
          pointsPerQuestion={10}
          onComplete={handleComplete}
          onAnswer={handleAnswer}
        />

        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="secondary"
            size="default"
            leftIcon={<Home className="w-4 h-4" />}
            onClick={() => onNavigate('ropsDesafio')}
          >
            Menu
          </Button>
          <Button
            variant="default"
            size="default"
            leftIcon={<Trophy className="w-4 h-4" />}
            onClick={() => onNavigate('ropsRanking')}
          >
            Ranking
          </Button>
        </div>
      </div>
    </div>
  );
}
