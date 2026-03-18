import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Quiz, Button } from '@/design-system';
import { ChevronLeft, Trophy, RotateCcw, Home } from 'lucide-react';
import ropsData from '@/data/rops-data';
import { useUser } from '@/contexts/UserContext';
import supabaseRopsQuizService from '@/services/supabaseRopsQuizService';

export default function ROPsQuizPage({ onNavigate, goBack, areaKey, ropKey }) {
  const { user } = useUser();
  const area = ropsData[areaKey];
  const rop = area?.subdivisoes?.[ropKey];

  // Formatar questões para o componente Quiz
  const formattedQuestions = useMemo(() => {
    if (!rop?.questions) return [];

    return rop.questions.map((q, index) => ({
      id: `${ropKey}-q${index}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: 10,
    }));
  }, [rop, ropKey]);

  // Handler quando o quiz é completado
  const handleComplete = (result) => {
    // Persistir no Supabase (fire-and-forget)
    if (user?.id) {
      supabaseRopsQuizService.saveQuizResult({
        userId: user.id,
        areaKey,
        ropKey,
        correct: result.correct,
        total: result.total,
        percentage: result.percentage,
        points: result.points,
      }).catch(console.error);

      // Clear saved progress on completion
      try {
        localStorage.removeItem(`rops_progress_${user.id}_${areaKey}_${ropKey}`);
      } catch {}
    }
  };

  // Handler para cada resposta
  const handleAnswer = (answer) => {
    if (!user?.id) return;
    try {
      const key = `rops_progress_${user.id}_${areaKey}_${ropKey}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      saved[answer.questionId] = answer.selectedAnswer;
      saved._lastUpdated = Date.now();
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // localStorage may be full or unavailable — ignore
    }
  };

  if (!area || !rop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-foreground text-lg font-bold mb-4">Quiz não encontrado</p>
        <Button onClick={goBack}>Voltar</Button>
      </div>
    );
  }

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Quiz
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        <Quiz
          questions={formattedQuestions}
          title={rop.title}
          description={`${area.title} • ${formattedQuestions.length} questões`}
          showProgress={true}
          showScore={true}
          showExplanation={true}
          shuffleQuestions={true}
          shuffleOptions={false}
          allowSkip={false}
          pointsPerQuestion={10}
          onComplete={handleComplete}
          onAnswer={handleAnswer}
        />

        {/* Botões de navegação após completar (mostrados pelo próprio Quiz) */}
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
