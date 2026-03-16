/**
 * NovoConteudoModal.jsx
 * Modal global para criação guiada de conteúdo educacional
 * Usa Stepper para guiar o administrador pelo fluxo correto
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Button,
  Select,
  Stepper,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

const TIPOS_CONTEUDO = [
  {
    id: 'trilha',
    label: 'Trilha',
    description: 'Agrupamento de treinamentos com objetivo comum',
    icon: GitBranch,
    color: 'purple',
    needsContext: false,
  },
  {
    id: 'curso',
    label: 'Treinamento',
    description: 'Treinamento com módulos e aulas',
    icon: BookOpen,
    color: 'blue',
    needsContext: false,
  },
  {
    id: 'modulo',
    label: 'Módulo',
    description: 'Seção dentro de um treinamento',
    icon: FolderOpen,
    color: 'orange',
    needsContext: true,
    contextFields: ['cursoId'],
  },
  {
    id: 'aula',
    label: 'Aula',
    description: 'Conteúdo em vídeo, áudio ou texto',
    icon: Video,
    color: 'green',
    needsContext: true,
    contextFields: ['cursoId', 'moduloId'],
  },
];

/**
 * NovoConteudoModal - Modal para criação guiada de conteúdo
 * 
 * @param {boolean} open - Controle de abertura
 * @param {function} onClose - Callback de fechamento
 * @param {Array} cursos - Lista de cursos disponíveis
 * @param {Array} modulos - Lista de módulos disponíveis  
 * @param {function} onOpenTrilhaModal - Abre modal de trilha
 * @param {function} onOpenCursoModal - Abre modal de curso
 * @param {function} onOpenModuloModal - Abre modal de módulo
 * @param {function} onOpenAulaModal - Abre modal de aula
 */
export function NovoConteudoModal({
  open,
  onClose,
  cursos = [],
  modulos = [],
  getModulosByCursoId,
  onOpenTrilhaModal,
  onOpenCursoModal,
  onOpenModuloModal,
  onOpenAulaModal,
}) {
  // Estado do stepper
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [context, setContext] = useState({
    cursoId: '',
    moduloId: '',
  });

  // Configuração dos steps
  const tipoConfig = selectedTipo 
    ? TIPOS_CONTEUDO.find(t => t.id === selectedTipo)
    : null;

  const steps = useMemo(() => {
    const baseSteps = [{ label: 'Tipo', description: 'O que criar' }];
    
    if (tipoConfig?.needsContext) {
      if (tipoConfig.contextFields.includes('cursoId')) {
        baseSteps.push({ label: 'Treinamento', description: 'Selecionar' });
      }
      if (tipoConfig.contextFields.includes('moduloId')) {
        baseSteps.push({ label: 'Módulo', description: 'Selecionar' });
      }
    }
    
    baseSteps.push({ label: 'Criar', description: 'Preencher dados' });
    
    return baseSteps;
  }, [tipoConfig]);

  // Opções de curso para select
  const cursoOptions = useMemo(() => {
    return cursos.map(c => ({
      value: c.id,
      label: c.titulo,
    }));
  }, [cursos]);

  // Opções de módulo para select (filtrado por curso selecionado)
  const moduloOptions = useMemo(() => {
    if (!context.cursoId) return [];
    const modulosDoCurso = typeof getModulosByCursoId === 'function'
      ? (getModulosByCursoId(context.cursoId) || [])
      : modulos.filter(m => m.cursoId === context.cursoId);
    return modulosDoCurso
      .map(m => ({
        value: m.id,
        label: m.titulo,
      }));
  }, [modulos, context.cursoId, getModulosByCursoId]);

  // Reset ao fechar/abrir
  const handleClose = useCallback(() => {
    setCurrentStep(0);
    setSelectedTipo(null);
    setContext({ cursoId: '', moduloId: '' });
    onClose?.();
  }, [onClose]);

  // Selecionar tipo
  const handleSelectTipo = useCallback((tipo) => {
    setSelectedTipo(tipo);
    setContext({ cursoId: '', moduloId: '' });
  }, []);

  // Avançar step
  const handleNext = useCallback(() => {
    const tipo = TIPOS_CONTEUDO.find(t => t.id === selectedTipo);
    
    // Se não precisa de contexto, ir direto para criação
    if (!tipo?.needsContext) {
      handleOpenFormModal();
      return;
    }
    
    // Verificar se pode avançar
    const nextStep = currentStep + 1;
    const totalSteps = steps.length;
    
    if (nextStep >= totalSteps - 1) {
      // Último step - abrir modal de criação
      handleOpenFormModal();
    } else {
      setCurrentStep(nextStep);
    }
  }, [currentStep, selectedTipo, steps.length]);

  // Voltar step
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Abrir modal de criação correspondente
  const handleOpenFormModal = useCallback(() => {
    handleClose();
    
    // Pequeno delay para fechar este modal antes de abrir outro
    setTimeout(() => {
      switch (selectedTipo) {
        case 'trilha':
          onOpenTrilhaModal?.();
          break;
        case 'curso':
          onOpenCursoModal?.();
          break;
        case 'modulo':
          onOpenModuloModal?.(context.cursoId);
          break;
        case 'aula':
          onOpenAulaModal?.(context.cursoId, context.moduloId);
          break;
      }
    }, 100);
  }, [selectedTipo, context, handleClose, onOpenTrilhaModal, onOpenCursoModal, onOpenModuloModal, onOpenAulaModal]);

  // Verificar se pode avançar
  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      return !!selectedTipo;
    }
    
    const tipo = TIPOS_CONTEUDO.find(t => t.id === selectedTipo);
    if (!tipo?.needsContext) return true;
    
    // Verificar contexto necessário para o step atual
    if (currentStep === 1 && tipo.contextFields.includes('cursoId')) {
      return !!context.cursoId;
    }
    if (currentStep === 2 && tipo.contextFields.includes('moduloId')) {
      return !!context.moduloId;
    }
    
    return true;
  }, [currentStep, selectedTipo, context]);

  // Determinar conteúdo do step atual
  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className="grid grid-cols-2 gap-3">
          {TIPOS_CONTEUDO.map((tipo) => {
            const Icon = tipo.icon;
            const isSelected = selectedTipo === tipo.id;
            
            const colorClasses = {
              purple: 'bg-purple-500/10 text-purple-500',
              blue: 'bg-blue-500/10 text-blue-500',
              orange: 'bg-orange-500/10 text-orange-500',
              green: 'bg-green-500/10 text-green-500',
            };
            
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => handleSelectTipo(tipo.id)}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  colorClasses[tipo.color]
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{tipo.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tipo.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    const tipo = TIPOS_CONTEUDO.find(t => t.id === selectedTipo);
    if (!tipo?.needsContext) return null;

    // Step de seleção de curso
    if (currentStep === 1 && tipo.contextFields.includes('cursoId')) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione o treinamento onde deseja criar {selectedTipo === 'modulo' ? 'o módulo' : 'a aula'}:
          </p>
          
          {cursoOptions.length === 0 ? (
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning">
                Nenhum treinamento disponível. Crie um treinamento primeiro.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onOpenCursoModal?.(), 100);
                }}
              >
                Criar Treinamento
              </Button>
            </div>
          ) : (
            <Select
              value={context.cursoId}
              onChange={(v) => setContext(prev => ({ ...prev, cursoId: v, moduloId: '' }))}
              placeholder="Selecione um treinamento"
              options={cursoOptions}
            />
          )}
        </div>
      );
    }

    // Step de seleção de módulo (apenas para aulas)
    if (currentStep === 2 && tipo.contextFields.includes('moduloId')) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione o módulo onde deseja criar a aula:
          </p>
          
          {moduloOptions.length === 0 ? (
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning">
                Este treinamento ainda não possui módulos. Crie um módulo primeiro.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onOpenModuloModal?.(context.cursoId), 100);
                }}
              >
                Criar Módulo
              </Button>
            </div>
          ) : (
            <Select
              value={context.moduloId}
              onChange={(v) => setContext(prev => ({ ...prev, moduloId: v }))}
              placeholder="Selecione um módulo"
              options={moduloOptions}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo Conteúdo"
      size="md"
    >
      <div className="space-y-6 p-1">
        {/* Stepper */}
        <Stepper
          currentStep={currentStep}
          steps={steps}
          variant="simple"
        />

        {/* Conteúdo do step */}
        <div className="min-h-[200px]">
          {renderStepContent()}
        </div>

        {/* Ações */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={currentStep > 0 ? handleBack : handleClose}
            leftIcon={currentStep > 0 ? <ArrowLeft className="w-4 h-4" /> : undefined}
          >
            {currentStep > 0 ? 'Voltar' : 'Cancelar'}
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {currentStep === steps.length - 2 || !tipoConfig?.needsContext
              ? 'Criar'
              : 'Continuar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default NovoConteudoModal;
