/**
 * QuizCurso.jsx
 * Componente de quiz/avaliação para cursos de educação continuada.
 * Exibe perguntas de múltipla escolha, calcula nota e salva resultado.
 *
 * Features:
 * - Randomização de perguntas e opções (Fisher-Yates)
 * - Limite de tentativas com cooldown de 24h
 * - Timer opcional (tempoLimiteMinutos do quiz config)
 * - Revisão sem revelar respostas corretas (exceto última tentativa)
 * - ARIA accessibility melhorias
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Progress,
  Alert,
  Spinner,
  useToast,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Clock,
  Lock,
} from 'lucide-react';
import * as educacaoService from '@/services/educacaoService';

// Fisher-Yates shuffle
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatTempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

/**
 * @param {string} cursoId - ID do curso
 * @param {string} userId - ID do usuário
 * @param {number} notaMinima - Nota mínima para aprovação (0-100)
 * @param {function} onComplete - Callback quando quiz é concluído { aprovado, nota, acertos, totalPerguntas }
 * @param {object} quizResult - Resultado anterior do quiz (se já tentou)
 */
export function QuizCurso({ cursoId, userId, notaMinima = 70, onComplete, quizResult }) {
  const [perguntas, setPerguntas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [saving, setSaving] = useState(false);

  // Attempt tracking
  const [tentativas, setTentativas] = useState([]);
  const [quizConfig, setQuizConfig] = useState({ maxTentativas: 3, tempoLimiteMinutos: null });
  const [bloqueadoAte, setBloqueadoAte] = useState(null);
  const [countdownBloqueio, setCountdownBloqueio] = useState('');

  // Timer
  const [tempoRestante, setTempoRestante] = useState(null);
  const timerRef = useRef(null);
  const alertasMostrados = useRef({ cinco: false, um: false });
  const handleSubmitRef = useRef(null);

  const { toast } = useToast();


  const numTentativasUsadas = tentativas.length;
  const maxTentativas = quizConfig.maxTentativas;
  const isUltimaTentativa = numTentativasUsadas + 1 >= maxTentativas;
  const tentativasEsgotadas = numTentativasUsadas >= maxTentativas;

  // Load quiz data, config, and attempts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [quizRes, configRes, tentativasRes] = await Promise.all([
        educacaoService.getQuiz(cursoId),
        educacaoService.getQuizConfig(cursoId),
        educacaoService.getQuizTentativas(cursoId, userId),
      ]);

      if (cancelled) return;

      if (quizRes.error) {
        setError(quizRes.error);
        setLoading(false);
        return;
      }

      const rawPerguntas = quizRes.perguntas || [];
      if (configRes.config) setQuizConfig(configRes.config);
      if (tentativasRes.tentativas) setTentativas(tentativasRes.tentativas);

      // Check bloqueadoAte from progresso
      try {
        const progressoRes = await educacaoService.getProgressoCurso(userId, cursoId);
        const bloqueio = progressoRes?.progresso?.quizResult?.bloqueadoAte;
        if (bloqueio) {
          const bloqueioDate = bloqueio.toDate ? bloqueio.toDate() : new Date(bloqueio);
          if (bloqueioDate > new Date()) {
            setBloqueadoAte(bloqueioDate);
          }
        }
      } catch (_) { /* ignore if progresso not found */ }

      // Shuffle questions
      const shuffledPerguntas = shuffleArray(rawPerguntas);

      // Shuffle options within each question, mapping correct answer
      const perguntasComOpcoesShuffled = shuffledPerguntas.map((p) => {
        const opcoes = p.opcoes || [];
        const respostaCorretaOriginal = p.respostaCorreta;

        // Create indexed options
        const indexed = opcoes.map((texto, i) => ({ texto, originalIndex: i }));
        const shuffledOpcoes = shuffleArray(indexed);

        // Find new index of the correct answer
        const novoIndexCorreto = shuffledOpcoes.findIndex(
          (o) => o.originalIndex === respostaCorretaOriginal
        );

        return {
          ...p,
          opcoes: shuffledOpcoes.map((o) => o.texto),
          respostaCorreta: novoIndexCorreto,
        };
      });

      setPerguntas(perguntasComOpcoesShuffled);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [cursoId, userId]);

  // Timer setup
  useEffect(() => {
    if (!quizConfig.tempoLimiteMinutos || submitted || loading) return;
    if (perguntas.length === 0) return;

    setTempoRestante(quizConfig.tempoLimiteMinutos * 60);
    alertasMostrados.current = { cinco: false, um: false };
  }, [quizConfig.tempoLimiteMinutos, submitted, loading, perguntas.length]);

  // Timer countdown
  useEffect(() => {
    if (tempoRestante === null || submitted) return;

    timerRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit
          if (handleSubmitRef.current) handleSubmitRef.current(true);
          return 0;
        }

        const next = prev - 1;

        // Alert at 5 min
        if (next === 300 && !alertasMostrados.current.cinco) {
          alertasMostrados.current.cinco = true;
          toast({ title: 'Atenção', description: '5 minutos restantes para finalizar a avaliação.', variant: 'warning' });
        }

        // Alert at 1 min
        if (next === 60 && !alertasMostrados.current.um) {
          alertasMostrados.current.um = true;
          toast({ title: 'Último minuto!', description: '1 minuto restante. Finalize suas respostas.', variant: 'error' });
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [tempoRestante, submitted, toast]);

  // Bloqueio countdown
  useEffect(() => {
    if (!bloqueadoAte) return;

    const interval = setInterval(() => {
      const diff = bloqueadoAte.getTime() - Date.now();
      if (diff <= 0) {
        setBloqueadoAte(null);
        setCountdownBloqueio('');
        clearInterval(interval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdownBloqueio(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [bloqueadoAte]);

  const totalPerguntas = perguntas.length;
  const respondidas = Object.keys(respostas).length;
  const progressPercent = totalPerguntas > 0 ? Math.round((respondidas / totalPerguntas) * 100) : 0;

  const currentPergunta = perguntas[currentIndex] || null;

  const handleSelectOption = useCallback((optionIndex) => {
    if (submitted) return;
    setRespostas(prev => ({ ...prev, [currentIndex]: optionIndex }));
  }, [currentIndex, submitted]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalPerguntas - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalPerguntas]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!autoSubmit && respondidas < totalPerguntas) return;

    setSaving(true);
    let acertos = 0;
    perguntas.forEach((p, idx) => {
      if (respostas[idx] === p.respostaCorreta) {
        acertos++;
      }
    });

    const nota = Math.round((acertos / totalPerguntas) * 100);
    const aprovado = nota >= notaMinima;

    const res = { nota, acertos, totalPerguntas, aprovado };
    setResultado(res);
    setSubmitted(true);

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Save to Firestore (both overall result + individual attempt)
    await Promise.all([
      educacaoService.salvarResultadoQuiz(userId, cursoId, res),
      educacaoService.salvarQuizTentativa(cursoId, userId, {
        ...res,
        respostas,
      }),
    ]);

    // Update local tentativas count
    setTentativas(prev => [{ ...res, data: new Date() }, ...prev]);

    // Set bloqueio if failed
    if (!aprovado) {
      setBloqueadoAte(new Date(Date.now() + 24 * 60 * 60 * 1000));
    }

    setSaving(false);
    onComplete?.(res);
  }, [respondidas, totalPerguntas, perguntas, respostas, notaMinima, userId, cursoId, onComplete]);

  // Keep ref updated for timer auto-submit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleRetry = useCallback(() => {
    setRespostas({});
    setCurrentIndex(0);
    setSubmitted(false);
    setResultado(null);

    // Re-shuffle questions and options
    const shuffled = shuffleArray(perguntas);
    const reShuffled = shuffled.map((p) => {
      const opcoes = p.opcoes || [];
      const respostaCorretaAtual = p.respostaCorreta;

      // Get current correct text
      const textoCorreto = opcoes[respostaCorretaAtual];

      const shuffledOpcoes = shuffleArray(opcoes);
      const novoIndex = shuffledOpcoes.indexOf(textoCorreto);

      return {
        ...p,
        opcoes: shuffledOpcoes,
        respostaCorreta: novoIndex,
      };
    });

    setPerguntas(reShuffled);

    // Reset timer
    if (quizConfig.tempoLimiteMinutos) {
      setTempoRestante(quizConfig.tempoLimiteMinutos * 60);
      alertasMostrados.current = { cinco: false, um: false };
    }
  }, [perguntas, quizConfig.tempoLimiteMinutos]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" title="Erro ao carregar avaliação">
        {error}
      </Alert>
    );
  }

  if (totalPerguntas === 0) {
    return (
      <Alert variant="info" title="Avaliação não disponível">
        Nenhuma pergunta cadastrada para este treinamento.
      </Alert>
    );
  }

  // Blocked by cooldown
  if (bloqueadoAte && bloqueadoAte > new Date() && !submitted) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-3">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">Avaliação temporariamente bloqueada</h3>
            <p className="text-sm text-muted-foreground">
              Você precisa aguardar antes de tentar novamente.
            </p>
            {countdownBloqueio && (
              <Badge variant="secondary" badgeStyle="subtle" className="text-base px-4 py-1">
                <Clock className="w-4 h-4 mr-1 inline" />
                {countdownBloqueio}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Tentativas utilizadas: {numTentativasUsadas} / {maxTentativas}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // All attempts used
  if (tentativasEsgotadas && !submitted) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-3" role="alert">
            <Lock className="w-12 h-12 text-destructive mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">Tentativas esgotadas</h3>
            <p className="text-sm text-muted-foreground">
              Você utilizou todas as {maxTentativas} tentativas permitidas para esta avaliação.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show result screen
  if (submitted && resultado) {
    // Only show correct answers on the last attempt
    const mostrarRespostasCorretas = isUltimaTentativa || resultado.aprovado;

    return (
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-3" role="alert">
            {resultado.aprovado ? (
              <Trophy className="w-16 h-16 text-success mx-auto" />
            ) : (
              <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
            )}

            <h3 className="text-xl font-bold text-foreground">
              {resultado.aprovado ? 'Aprovado!' : 'Não aprovado'}
            </h3>

            <p className="text-muted-foreground">
              Você acertou <span className="font-semibold text-foreground">{resultado.acertos}</span> de{' '}
              <span className="font-semibold text-foreground">{resultado.totalPerguntas}</span> perguntas
            </p>

            <div className="flex items-center justify-center gap-4">
              <Badge
                variant={resultado.aprovado ? 'success' : 'destructive'}
                badgeStyle="solid"
                className="text-lg px-4 py-1"
              >
                Nota: {resultado.nota}%
              </Badge>
              <span className="text-sm text-muted-foreground">
                Mínimo: {notaMinima}%
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Tentativa {numTentativasUsadas} de {maxTentativas}
            </p>
          </div>

          {/* Review answers */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">
              Revisão das respostas
            </h4>
            {perguntas.map((p, idx) => {
              const userAnswer = respostas[idx];
              const isCorrect = userAnswer === p.respostaCorreta;
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border",
                    isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{idx + 1}. {p.texto}</p>
                      {!isCorrect && mostrarRespostasCorretas && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Resposta correta: {p.opcoes[p.respostaCorreta]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!resultado.aprovado && !tentativasEsgotadas && (
            <Button
              onClick={handleRetry}
              className="w-full"
              leftIcon={<RotateCcw className="w-4 h-4" />}
              disabled={bloqueadoAte && bloqueadoAte > new Date()}
            >
              {bloqueadoAte && bloqueadoAte > new Date()
                ? 'Aguarde o período de cooldown'
                : 'Tentar novamente'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Quiz in progress
  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Avaliação</h3>
            <div className="flex items-center gap-2">
              {tempoRestante !== null && (
                <Badge
                  variant={tempoRestante <= 60 ? 'destructive' : tempoRestante <= 300 ? 'warning' : 'secondary'}
                  badgeStyle="subtle"
                  className="tabular-nums"
                >
                  <Clock className="w-3.5 h-3.5 mr-1 inline" />
                  {formatTempo(tempoRestante)}
                </Badge>
              )}
              <Badge variant="secondary" badgeStyle="subtle" aria-live="polite">
                {currentIndex + 1} / {totalPerguntas}
              </Badge>
            </div>
          </div>
          <Progress value={progressPercent} size="sm" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {respondidas} de {totalPerguntas} respondidas - Mínimo para aprovação: {notaMinima}%
            </p>
            <p className="text-xs text-muted-foreground">
              Tentativa {numTentativasUsadas + 1} de {maxTentativas}
            </p>
          </div>
        </div>

        {/* Question */}
        {currentPergunta && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {currentIndex + 1}. {currentPergunta.texto}
            </p>

            {/* Options */}
            <div className="space-y-2" role="radiogroup" aria-label={`Opções da pergunta ${currentIndex + 1}`}>
              {currentPergunta.opcoes.map((opcao, optIdx) => {
                const isSelected = respostas[currentIndex] === optIdx;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(optIdx)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-card border-border hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm">{opcao}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Anterior
          </Button>

          {currentIndex < totalPerguntas - 1 ? (
            <Button
              size="sm"
              onClick={handleNext}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Próxima
            </Button>
          ) : (
            <Button
              size="sm"
              variant="warning"
              onClick={() => handleSubmit(false)}
              disabled={respondidas < totalPerguntas || saving}
            >
              {saving ? 'Enviando...' : 'Enviar Respostas'}
            </Button>
          )}
        </div>

        {/* Quick navigation dots */}
        <div className="flex flex-wrap gap-1.5 justify-center pt-2">
          {perguntas.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Pergunta ${idx + 1}${respostas[idx] !== undefined ? ' (respondida)' : ''}`}
              className={cn(
                "w-7 h-7 rounded-full text-xs font-medium transition-colors",
                idx === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : respostas[idx] !== undefined
                    ? "bg-success/20 text-success border border-success/30"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuizCurso;
