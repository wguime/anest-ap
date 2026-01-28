/**
 * CascadeCreator.jsx
 * Componente para criação guiada de conteúdo educacional em cascata
 * Fluxo: Trilha → Treinamento → Módulo → Aula
 * 
 * Features:
 * - Criar OU anexar entidades existentes em cada etapa
 * - Resumo lateral (desktop) / accordion (mobile)
 * - Persistência de sessão via localStorage
 * - Suporte a drafts com status DRAFT/PUBLISHED
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Badge,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/design-system';
import {
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Check,
  ChevronRight,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

import { useEducacaoData } from '../../hooks/useEducacaoData';
import { StepTrilha } from './StepTrilha';
import { StepTreinamento } from './StepTreinamento';
import { StepModulo } from './StepModulo';
import { StepAula } from './StepAula';
import { CascadeSummary } from './CascadeSummary';
import { ContinueSessionDialog } from './ContinueSessionDialog';
import { cn } from '@/design-system/utils/tokens';

// Constantes
const STORAGE_KEY = 'cascade_session';
const STEPS = ['trilha', 'treinamento', 'modulo', 'aula', 'done'];
const STEP_LABELS = {
  trilha: 'Trilha',
  treinamento: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
  done: 'Concluído',
};
const STEP_ICONS = {
  trilha: GitBranch,
  treinamento: BookOpen,
  modulo: FolderOpen,
  aula: Video,
  done: Check,
};

/**
 * Gerar sessionId único
 */
function generateSessionId() {
  return crypto?.randomUUID?.() || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Hook para detecção de breakpoint mobile
 */
function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

export function CascadeCreator({ onNavigate }) {
  const isMobile = useIsMobile();
  
  // Dados educacionais
  const {
    trilhas,
    cursos,
    modulos,
    aulas,
    addTrilha,
    addCurso,
    addModulo,
    addAula,
    linkCursoToTrilha,
    linkModuloToCurso,
    linkAulaToModulo,
    fetchAll,
  } = useEducacaoData();

  // Estado da sessão de criação
  const [sessionId] = useState(() => generateSessionId());
  const [currentStep, setCurrentStep] = useState('trilha');
  const [createdEntities, setCreatedEntities] = useState({
    trilha: null,
    treinamento: null,
    modulo: null,
    aula: null,
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dialog para continuar sessão anterior
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [previousSession, setPreviousSession] = useState(null);

  // Verificar sessão salva ao montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessionId && parsed.currentStep !== 'done') {
          setPreviousSession(parsed);
          setShowContinueDialog(true);
        }
      }
    } catch (e) {
      console.warn('Erro ao ler sessão salva:', e);
    }
  }, []);

  // Salvar estado atual em localStorage
  useEffect(() => {
    if (currentStep !== 'done') {
      const state = {
        sessionId,
        currentStep,
        createdEntities,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [sessionId, currentStep, createdEntities]);

  // Handler para continuar sessão anterior
  const handleContinueSession = useCallback(() => {
    if (previousSession) {
      setCurrentStep(previousSession.currentStep);
      setCreatedEntities(previousSession.createdEntities || {});
    }
    setShowContinueDialog(false);
    setPreviousSession(null);
  }, [previousSession]);

  // Handler para iniciar nova sessão
  const handleNewSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setShowContinueDialog(false);
    setPreviousSession(null);
  }, []);

  // Handler para completar uma etapa
  const handleStepComplete = useCallback(async (stepType, entity, mode) => {
    setError(null);
    setIsLoading(true);

    try {
      // Atualizar entidade criada/selecionada
      setCreatedEntities(prev => ({
        ...prev,
        [stepType]: { ...entity, _mode: mode },
      }));

      // Vincular entidades (criar relações)
      if (stepType === 'treinamento' && createdEntities.trilha?.id && entity.id) {
        await linkCursoToTrilha(createdEntities.trilha.id, entity.id);
      } else if (stepType === 'modulo' && createdEntities.treinamento?.id && entity.id) {
        await linkModuloToCurso(createdEntities.treinamento.id, entity.id);
      } else if (stepType === 'aula' && createdEntities.modulo?.id && entity.id) {
        await linkAulaToModulo(createdEntities.modulo.id, entity.id);
      }

      // Avançar para próxima etapa
      const currentIndex = STEPS.indexOf(stepType);
      if (currentIndex < STEPS.length - 1) {
        setCurrentStep(STEPS[currentIndex + 1]);
      }
    } catch (e) {
      setError(e?.message || 'Erro ao processar etapa');
      console.error('Erro na etapa:', e);
    } finally {
      setIsLoading(false);
    }
  }, [createdEntities, linkCursoToTrilha, linkModuloToCurso, linkAulaToModulo]);

  // Handler para voltar uma etapa
  const handleStepBack = useCallback((targetStep) => {
    const targetIndex = STEPS.indexOf(targetStep);
    const currentIndex = STEPS.indexOf(currentStep);
    
    if (targetIndex < currentIndex) {
      setCurrentStep(targetStep);
    }
  }, [currentStep]);

  // Handler para reiniciar fluxo
  const handleReset = useCallback(() => {
    if (window.confirm('Deseja reiniciar o fluxo de criação? Os itens já salvos permanecerão no sistema.')) {
      setCurrentStep('trilha');
      setCreatedEntities({
        trilha: null,
        treinamento: null,
        modulo: null,
        aula: null,
      });
      setError(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Handler para finalizar
  const handleFinish = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStep('done');
  }, []);

  // Handler para criar mais conteúdo
  const handleCreateMore = useCallback(() => {
    // Manter trilha, resetar o resto
    setCreatedEntities(prev => ({
      trilha: prev.trilha,
      treinamento: null,
      modulo: null,
      aula: null,
    }));
    setCurrentStep('treinamento');
  }, []);

  // Calcular progresso
  const progress = useMemo(() => {
    const completedSteps = STEPS.filter(step => 
      step !== 'done' && createdEntities[step === 'treinamento' ? 'treinamento' : step]
    ).length;
    return Math.round((completedSteps / 4) * 100);
  }, [createdEntities]);

  // Renderizar etapa atual
  const renderCurrentStep = () => {
    const commonProps = {
      isLoading,
      error,
      sessionId,
    };

    switch (currentStep) {
      case 'trilha':
        return (
          <StepTrilha
            {...commonProps}
            trilhas={trilhas}
            onComplete={(entity, mode) => handleStepComplete('trilha', entity, mode)}
            onSkip={() => setCurrentStep('treinamento')}
            addTrilha={addTrilha}
          />
        );
      
      case 'treinamento':
        return (
          <StepTreinamento
            {...commonProps}
            cursos={cursos}
            trilha={createdEntities.trilha}
            onComplete={(entity, mode) => handleStepComplete('treinamento', entity, mode)}
            onBack={() => handleStepBack('trilha')}
            addCurso={addCurso}
          />
        );
      
      case 'modulo':
        return (
          <StepModulo
            {...commonProps}
            modulos={modulos}
            treinamento={createdEntities.treinamento}
            onComplete={(entity, mode) => handleStepComplete('modulo', entity, mode)}
            onBack={() => handleStepBack('treinamento')}
            addModulo={addModulo}
          />
        );
      
      case 'aula':
        return (
          <StepAula
            {...commonProps}
            aulas={aulas}
            modulo={createdEntities.modulo}
            onComplete={(entity, mode) => handleStepComplete('aula', entity, mode)}
            onBack={() => handleStepBack('modulo')}
            onFinish={handleFinish}
            addAula={addAula}
          />
        );
      
      case 'done':
        return (
          <Card className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Conteúdo Criado!</h2>
            <p className="text-muted-foreground mb-6">
              Sua estrutura de conteúdo foi criada com sucesso.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="primary" onClick={handleCreateMore}>
                Criar mais conteúdo nesta trilha
              </Button>
              <Button variant="ghost" onClick={handleReset} leftIcon={<RotateCcw className="w-4 h-4" />}>
                Iniciar nova trilha
              </Button>
            </div>
          </Card>
        );
      
      default:
        return null;
    }
  };

  // Renderizar indicador de progresso
  const renderProgressIndicator = () => (
    <div className="flex items-center justify-between mb-6">
      {STEPS.slice(0, -1).map((step, index) => {
        const StepIcon = STEP_ICONS[step];
        const isCompleted = createdEntities[step === 'treinamento' ? 'treinamento' : step];
        const isCurrent = currentStep === step;
        const isPast = STEPS.indexOf(currentStep) > index;

        return (
          <div key={step} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isPast && handleStepBack(step)}
              disabled={!isPast}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                isCompleted && "bg-primary border-primary text-primary-foreground",
                isCurrent && !isCompleted && "border-primary text-primary",
                !isCompleted && !isCurrent && "border-border text-muted-foreground",
                isPast && "cursor-pointer hover:bg-primary/10"
              )}
            >
              {isCompleted ? (
                <Check className="w-5 h-5" />
              ) : (
                <StepIcon className="w-5 h-5" />
              )}
            </button>
            {index < STEPS.length - 2 && (
              <div 
                className={cn(
                  "flex-1 h-0.5 mx-2",
                  isPast ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Layout mobile: stack vertical com accordion para resumo
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Dialog de continuar sessão */}
        {showContinueDialog && previousSession && (
          <ContinueSessionDialog
            open={showContinueDialog}
            onContinue={handleContinueSession}
            onNew={handleNewSession}
            previousSession={previousSession}
          />
        )}

        {/* Header */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Criar Conteúdo</h2>
            </div>
            {currentStep !== 'done' && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
          {renderProgressIndicator()}
        </Card>

        {/* Etapa atual */}
        {renderCurrentStep()}

        {/* Resumo em Accordion */}
        {currentStep !== 'done' && (
          <Accordion type="single" collapsible>
            <AccordionItem value="summary">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span>Resumo</span>
                  <Badge variant="secondary" badgeStyle="subtle">{progress}%</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CascadeSummary
                  createdEntities={createdEntities}
                  currentStep={currentStep}
                  onStepClick={handleStepBack}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    );
  }

  // Layout desktop: formulário + resumo lateral
  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      {/* Dialog de continuar sessão */}
      {showContinueDialog && previousSession && (
        <ContinueSessionDialog
          open={showContinueDialog}
          onContinue={handleContinueSession}
          onNew={handleNewSession}
          previousSession={previousSession}
        />
      )}

      {/* Área principal */}
      <div className="space-y-4">
        {/* Header com progresso */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Criar Conteúdo</h2>
            </div>
            {currentStep !== 'done' && (
              <Button variant="ghost" size="sm" onClick={handleReset} leftIcon={<RotateCcw className="w-4 h-4" />}>
                Reiniciar
              </Button>
            )}
          </div>
          {renderProgressIndicator()}
        </Card>

        {/* Etapa atual */}
        {renderCurrentStep()}
      </div>

      {/* Sidebar com resumo */}
      <div className="space-y-4">
        <Card className="p-4 sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Resumo</h3>
            <Badge variant="secondary" badgeStyle="subtle">{progress}%</Badge>
          </div>
          <CascadeSummary
            createdEntities={createdEntities}
            currentStep={currentStep}
            onStepClick={handleStepBack}
          />
        </Card>
      </div>
    </div>
  );
}

export default CascadeCreator;
