/**
 * ContinueSessionDialog.jsx
 * Dialog para perguntar se o usuário deseja continuar uma sessão anterior
 */

import {
  Modal,
  Button,
} from '@/design-system';
import {
  Clock,
  RotateCcw,
  Play,
} from 'lucide-react';

const STEP_LABELS = {
  trilha: 'Trilha',
  treinamento: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
  done: 'Concluído',
};

export function ContinueSessionDialog({
  open,
  onContinue,
  onNew,
  previousSession,
}) {
  if (!previousSession) return null;

  const savedAt = previousSession.savedAt 
    ? new Date(previousSession.savedAt).toLocaleString()
    : 'Desconhecido';

  const currentStepLabel = STEP_LABELS[previousSession.currentStep] || previousSession.currentStep;

  // Contar entidades criadas
  const createdCount = Object.values(previousSession.createdEntities || {}).filter(Boolean).length;

  return (
    <Modal
      open={open}
      onClose={onNew}
      title="Continuar sessão anterior?"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-info/10">
          <Clock className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Você tem uma sessão de criação em andamento</p>
            <p className="text-xs text-muted-foreground mt-1">
              Salva em: {savedAt}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Etapa atual:</span>{' '}
            <span className="font-medium">{currentStepLabel}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Itens criados:</span>{' '}
            <span className="font-medium">{createdCount} de 4</span>
          </p>
          
          {previousSession.createdEntities?.trilha && (
            <p className="text-sm">
              <span className="text-muted-foreground">Trilha:</span>{' '}
              <span className="font-medium">{previousSession.createdEntities.trilha.titulo}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="primary"
            onClick={onContinue}
            leftIcon={<Play className="w-4 h-4" />}
            className="flex-1"
          >
            Continuar
          </Button>
          <Button
            variant="ghost"
            onClick={onNew}
            leftIcon={<RotateCcw className="w-4 h-4" />}
            className="flex-1"
          >
            Começar do zero
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ContinueSessionDialog;
