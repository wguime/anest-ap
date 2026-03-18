// Quiz.jsx
// Sistema de quiz gamificado com explicações
// Baseado em: Quest Labs, Typeform patterns

import { useState, useCallback, useMemo, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * Quiz - Sistema de perguntas e respostas gamificado
 *
 * Features:
 * - Múltipla escolha e V/F
 * - Explicação quando resposta errada
 * - Pontuação e progresso
 * - Animações de feedback
 * - Integração com Leaderboard
 * - ARIA completo
 *
 * @example
 * <Quiz
 *   questions={[
 *     {
 *       id: '1',
 *       question: 'Qual é a capital do Brasil?',
 *       options: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'],
 *       correctAnswer: 2,
 *       explanation: 'Brasília é a capital federal desde 1960.',
 *       points: 10
 *     }
 *   ]}
 *   onComplete={(result) => console.log(result)}
 * />
 */

// Ícones SVG
const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const ArrowRightIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const TrophyIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
)

const RefreshIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 4v6h6M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 1 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </svg>
)

// Context para estado do quiz
const QuizContext = createContext(null)

function useQuiz() {
  const context = useContext(QuizContext)
  if (!context) {
    throw new Error('Quiz components must be used within a Quiz')
  }
  return context
}

// Componente principal
function Quiz({
  questions = [],
  title,
  description,
  timePerQuestion, // segundos (opcional)
  showProgress = true,
  showScore = true,
  shuffleQuestions = false,
  shuffleOptions = false,
  allowSkip = false,
  showExplanation = true,
  pointsPerQuestion = 10,
  className,
  onComplete,
  onAnswer,
  ...props
}) {
  // Embaralhar questões se necessário
  const orderedQuestions = useMemo(() => {
    if (!shuffleQuestions) return questions
    return [...questions].sort(() => Math.random() - 0.5)
  }, [questions, shuffleQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selectedOption, setSelectedOption] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timePerQuestion)

  const currentQuestion = orderedQuestions[currentIndex]
  const totalQuestions = orderedQuestions.length
  const progress = ((currentIndex) / totalQuestions) * 100

  // Calcular pontuação
  const calculateScore = useCallback(() => {
    let correct = 0
    let total = 0

    orderedQuestions.forEach((q, idx) => {
      if (answers[idx] !== undefined) {
        total++
        if (answers[idx] === q.correctAnswer) {
          correct++
        }
      }
    })

    return {
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      points: correct * pointsPerQuestion
    }
  }, [orderedQuestions, answers, pointsPerQuestion])

  // Timer
  // useEffect(() => {
  //   if (!timePerQuestion || showResult || isComplete) return
  //
  //   setTimeLeft(timePerQuestion)
  //   const interval = setInterval(() => {
  //     setTimeLeft(t => {
  //       if (t <= 1) {
  //         handleAnswer(null, true)
  //         return timePerQuestion
  //       }
  //       return t - 1
  //     })
  //   }, 1000)
  //
  //   return () => clearInterval(interval)
  // }, [currentIndex, timePerQuestion, showResult, isComplete])

  // Responder questão
  const handleAnswer = useCallback((optionIndex, isTimeout = false) => {
    if (showResult) return

    setSelectedOption(optionIndex)
    setShowResult(true)

    const isCorrect = optionIndex === currentQuestion?.correctAnswer
    const newAnswers = { ...answers, [currentIndex]: optionIndex }
    setAnswers(newAnswers)

    onAnswer?.({
      questionIndex: currentIndex,
      question: currentQuestion,
      selectedAnswer: optionIndex,
      isCorrect,
      isTimeout
    })
  }, [showResult, currentQuestion, currentIndex, answers, onAnswer])

  // Próxima questão
  const nextQuestion = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedOption(null)
      setShowResult(false)
    } else {
      setIsComplete(true)
      const score = calculateScore()
      onComplete?.(score)
    }
  }, [currentIndex, totalQuestions, calculateScore, onComplete])

  // Pular questão
  const skipQuestion = useCallback(() => {
    if (!allowSkip) return
    nextQuestion()
  }, [allowSkip, nextQuestion])

  // Reiniciar quiz
  const restart = useCallback(() => {
    setCurrentIndex(0)
    setAnswers({})
    setSelectedOption(null)
    setShowResult(false)
    setIsComplete(false)
    setTimeLeft(timePerQuestion)
  }, [timePerQuestion])

  const contextValue = {
    currentQuestion,
    currentIndex,
    totalQuestions,
    progress,
    selectedOption,
    showResult,
    isComplete,
    timeLeft,
    handleAnswer,
    nextQuestion,
    skipQuestion,
    restart,
    calculateScore,
    answers
  }

  return (
    <QuizContext.Provider value={contextValue}>
      <div
        role="group"
        aria-label={title || 'Quiz'}
        className={cn(
          "bg-[#FFFFFF] dark:bg-[#18181B] rounded-2xl shadow-lg overflow-hidden",
          "border border-border dark:border-[#27272A]",
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || showProgress || showScore) && !isComplete && (
          <div className="p-3 sm:p-4 border-b border-border dark:border-[#27272A] bg-background">
            {title && (
              <h2 className="text-base sm:text-lg font-semibold text-foreground dark:text-white mb-1">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground mb-3">
                {description}
              </p>
            )}

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Progress */}
              {showProgress && (
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-muted-foreground dark:text-muted-foreground mb-1">
                    <span>Questão {currentIndex + 1} de {totalQuestions}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-[#A5D6A7] dark:bg-[#27272A] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#16A085] to-[#27AE60]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Timer */}
              {timePerQuestion && timeLeft && (
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full text-xs sm:text-sm font-bold flex-shrink-0",
                  timeLeft <= 5
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : "bg-[#16A085]/10 text-[#16A085]"
                )}>
                  {timeLeft}s
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {isComplete ? (
            <QuizResults key="results" />
          ) : (
            <QuizQuestion
              key={currentIndex}
              question={currentQuestion}
              shuffleOptions={shuffleOptions}
              showExplanation={showExplanation}
              allowSkip={allowSkip}
            />
          )}
        </AnimatePresence>
      </div>
    </QuizContext.Provider>
  )
}

// Componente de questão
function QuizQuestion({
  question,
  shuffleOptions,
  showExplanation,
  allowSkip
}) {
  const {
    selectedOption,
    showResult,
    handleAnswer,
    nextQuestion,
    skipQuestion
  } = useQuiz()

  // Embaralhar opções se necessário
  const options = useMemo(() => {
    if (!question?.options) return []
    if (!shuffleOptions) return question.options.map((opt, idx) => ({ text: opt, originalIndex: idx }))

    return question.options
      .map((opt, idx) => ({ text: opt, originalIndex: idx }))
      .sort(() => Math.random() - 0.5)
  }, [question, shuffleOptions])

  const isCorrect = selectedOption === question?.correctAnswer

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-3 sm:p-4 lg:p-6"
    >
      {/* Question */}
      <h3 className="text-base sm:text-lg font-medium text-foreground dark:text-white mb-4 sm:mb-6">
        {question?.question}
      </h3>

      {/* Options */}
      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
        {options.map((option, idx) => {
          const isSelected = selectedOption === option.originalIndex
          const isCorrectOption = option.originalIndex === question?.correctAnswer

          return (
            <motion.button
              key={idx}
              type="button"
              disabled={showResult}
              onClick={() => handleAnswer(option.originalIndex)}
              whileHover={!showResult ? { scale: 1.01 } : {}}
              whileTap={!showResult ? { scale: 0.99 } : {}}
              className={cn(
                "w-full p-3 sm:p-4 rounded-xl text-left transition-all duration-200",
                "border-2 flex items-center gap-2 sm:gap-3 min-h-[56px]",
                !showResult && "hover:border-primary hover:bg-background",
                !showResult && "bg-[#FFFFFF] dark:bg-[#27272A] border-border dark:border-[#27272A]",
                showResult && isCorrectOption && "border-green-500 bg-green-50 dark:bg-green-900/20",
                showResult && isSelected && !isCorrectOption && "border-red-500 bg-red-50 dark:bg-red-900/20",
                showResult && !isSelected && !isCorrectOption && "border-border dark:border-[#27272A] opacity-50"
              )}
            >
              {/* Letter indicator */}
              <span className={cn(
                "flex-shrink-0 w-8 h-8 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold",
                !showResult && "bg-primary text-white",
                showResult && isCorrectOption && "bg-green-500 text-white",
                showResult && isSelected && !isCorrectOption && "bg-red-500 text-white"
              )}>
                {showResult && isCorrectOption ? (
                  <CheckIcon className="w-4 h-4" />
                ) : showResult && isSelected && !isCorrectOption ? (
                  <XIcon className="w-4 h-4" />
                ) : (
                  String.fromCharCode(65 + idx)
                )}
              </span>

              {/* Option text */}
              <span className={cn(
                "flex-1 text-sm",
                showResult && isCorrectOption && "text-green-700 dark:text-green-400 font-medium",
                showResult && isSelected && !isCorrectOption && "text-red-700 dark:text-red-400",
                !showResult && "text-foreground dark:text-white"
              )}>
                {option.text}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {showResult && showExplanation && question?.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "p-3 sm:p-4 rounded-xl mb-4 sm:mb-6",
              isCorrect
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
            )}
          >
            <p className={cn(
              "text-sm font-medium mb-1",
              isCorrect ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
            )}>
              {isCorrect ? '✓ Correto!' : '✗ Incorreto'}
            </p>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {question.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        {allowSkip && !showResult && (
          <button
            type="button"
            onClick={skipQuestion}
            className="text-xs sm:text-sm text-muted-foreground hover:text-[#16A085] transition-colors min-h-[44px] px-2"
          >
            Pular questão
          </button>
        )}

        {!allowSkip && <div />}

        {showResult && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            type="button"
            onClick={nextQuestion}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl font-medium transition-colors min-h-[44px]",
              "bg-gradient-to-r from-[#16A085] to-[#27AE60] text-white text-sm sm:text-base",
              "hover:from-[#138D75] hover:to-[#229954]"
            )}
          >
            Continuar
            <ArrowRightIcon className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// Componente de resultados
function QuizResults() {
  const { calculateScore, totalQuestions, restart } = useQuiz()
  const score = calculateScore()

  const getResultMessage = () => {
    if (score.percentage >= 90) return { emoji: '🏆', message: 'Excelente!', color: 'text-yellow-500' }
    if (score.percentage >= 70) return { emoji: '🎉', message: 'Muito bom!', color: 'text-green-500' }
    if (score.percentage >= 50) return { emoji: '👍', message: 'Bom trabalho!', color: 'text-blue-500' }
    return { emoji: '📚', message: 'Continue estudando!', color: 'text-orange-500' }
  }

  const result = getResultMessage()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 text-center"
    >
      {/* Trophy animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100 }}
        className="mb-6"
      >
        <span className="text-6xl">{result.emoji}</span>
      </motion.div>

      {/* Message */}
      <h3 className={cn("text-2xl font-bold mb-2", result.color)}>
        {result.message}
      </h3>

      <p className="text-muted-foreground dark:text-muted-foreground mb-6">
        Você completou o quiz
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-background dark:bg-[#27272A] rounded-xl border border-border dark:border-transparent">
          <p className="text-2xl font-bold text-foreground">
            {score.correct}/{score.total}
          </p>
          <p className="text-xs text-primary dark:text-muted-foreground">
            Acertos
          </p>
        </div>

        <div className="p-4 bg-background dark:bg-[#27272A] rounded-xl border border-border dark:border-transparent">
          <p className="text-2xl font-bold text-[#16A085]">
            {score.percentage}%
          </p>
          <p className="text-xs text-primary dark:text-muted-foreground">
            Aproveitamento
          </p>
        </div>

        <div className="p-4 bg-background dark:bg-[#27272A] rounded-xl border border-border dark:border-transparent">
          <p className="text-2xl font-bold text-warning">
            {score.points}
          </p>
          <p className="text-xs text-primary dark:text-muted-foreground">
            Pontos
          </p>
        </div>
      </div>

      {/* Progress circle */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-[#A5D6A7] dark:text-[#27272A]"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 56}
            initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - score.percentage / 100) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#16A085" />
              <stop offset="100%" stopColor="#27AE60" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-foreground dark:text-white">
            {score.percentage}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={restart}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors",
            "bg-background dark:bg-[#27272A] text-foreground border border-border dark:border-transparent",
            "hover:bg-muted dark:hover:bg-[#3F3F46]"
          )}
        >
          <RefreshIcon className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    </motion.div>
  )
}

// Helper para verificar se é um elemento React
function isReactElement(element) {
  return element !== null && typeof element === 'object' && element.$$typeof !== undefined
}

// QuizCard - para listas de quizzes
function QuizCard({
  title,
  description,
  questionsCount,
  duration,
  difficulty = 'medium', // 'easy' | 'medium' | 'hard'
  icon,
  onClick,
  className,
  ...props
}) {
  const difficultyConfig = {
    easy: { label: 'Fácil', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    medium: { label: 'Médio', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    hard: { label: 'Difícil', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  }

  const diff = difficultyConfig[difficulty]
  const isLucideIcon = isReactElement(icon)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full p-3 sm:p-4 text-left rounded-xl transition-all min-h-[80px]",
        "bg-[#FFFFFF] dark:bg-[#18181B] border border-border dark:border-[#27272A]",
        "hover:border-primary hover:shadow-md hover:bg-background",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {icon && (
          <div className={cn(
            "flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#16A085] to-[#27AE60] flex items-center justify-center",
            !isLucideIcon && "text-xl sm:text-2xl"
          )}>
            {isLucideIcon ? (
              <div className="w-5 h-5 sm:w-6 sm:h-6 text-white">
                {icon}
              </div>
            ) : (
              icon
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
            {title}
          </h3>
          {description && (
            <p className="text-xs sm:text-sm text-primary dark:text-muted-foreground truncate mt-0.5 sm:mt-1">
              {description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
            {questionsCount && (
              <span className="text-[10px] sm:text-xs text-muted-foreground dark:text-muted-foreground">
                {questionsCount} questões
              </span>
            )}
            {duration && (
              <span className="text-[10px] sm:text-xs text-muted-foreground dark:text-muted-foreground">
                ~{duration} min
              </span>
            )}
            <span className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full", diff.color)}>
              {diff.label}
            </span>
          </div>
        </div>

        <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </motion.button>
  )
}

export { Quiz, QuizCard }
export default Quiz
