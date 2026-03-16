/**
 * PublishButton.jsx
 * Botão de publicação com validação de hierarquia e cascata opcional
 * 
 * Features:
 * - Valida pré-requisitos antes de publicar
 * - Mostra preview do que será visível
 * - Opção de propagar publicação em cascata
 * - Feedback visual do status de sincronização
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Modal,
  Badge,
  Checkbox,
  Alert,
  Progress,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Send,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

const ENTITY_ICONS = {
  trilha: GitBranch,
  curso: BookOpen,
  modulo: FolderOpen,
  aula: Video,
};

const ENTITY_LABELS = {
  trilha: 'Trilha',
  curso: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
};

/**
 * Verifica se uma entidade pode ser publicada
 * @param {Object} entity - Entidade a verificar
 * @param {string} entityType - Tipo da entidade
 * @param {Object} context - Contexto com dados relacionados
 * @returns {{ canPublish: boolean, issues: string[] }}
 */
function validatePublish(entity, entityType, context = {}) {
  const issues = [];
  
  if (!entity) {
    return { canPublish: false, issues: ['Entidade não encontrada'] };
  }
  
  // Verificar título
  if (!entity.titulo?.trim()) {
    issues.push('Título é obrigatório');
  }
  
  // Verificações específicas por tipo
  switch (entityType) {
    case 'trilha':
      // Trilha precisa ter cursos
      if (!entity.cursos?.length && !context.cursosVinculados?.length) {
        issues.push('Trilha precisa ter pelo menos um treinamento');
      }
      break;
      
    case 'curso':
      // Curso precisa ter módulos
      if (!entity.moduloIds?.length && !context.modulosVinculados?.length) {
        issues.push('Treinamento precisa ter pelo menos um módulo');
      }
      break;
      
    case 'modulo':
      // Módulo precisa ter aulas
      if (!entity.aulaIds?.length && !context.aulasVinculadas?.length) {
        issues.push('Módulo precisa ter pelo menos uma aula');
      }
      break;
      
    case 'aula':
      // Aula precisa ter conteúdo
      if (!entity.blocks?.length && !entity.url) {
        issues.push('Aula precisa ter conteúdo');
      }
      break;
  }
  
  return {
    canPublish: issues.length === 0,
    issues,
  };
}

/**
 * PublishButton - Botão de publicação com validação
 * 
 * @param {Object} entity - Entidade a publicar
 * @param {string} entityType - Tipo: 'trilha' | 'curso' | 'modulo' | 'aula'
 * @param {function} onPublish - Callback para publicar (recebe { cascade: boolean })
 * @param {function} onUnpublish - Callback para despublicar
 * @param {Object} context - Dados relacionados para validação
 * @param {boolean} disabled - Desabilitar botão
 * @param {string} size - Tamanho do botão
 */
export function PublishButton({
  entity,
  entityType,
  onPublish,
  onUnpublish,
  context = {},
  disabled = false,
  size = 'default',
  className,
}) {
  const [showModal, setShowModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [cascadePublish, setCascadePublish] = useState(true);
  const [error, setError] = useState(null);

  // Status atual de publicação
  const isPublished = useMemo(() => {
    const status = entity?.statusPublicacao?.toLowerCase() || entity?.status?.toLowerCase();
    return status === 'published';
  }, [entity]);

  // Validar publicação
  const validation = useMemo(() => {
    if (!entity) return { canPublish: false, issues: ['Entidade não encontrada'] };
    return validatePublish(entity, entityType, context);
  }, [entity, entityType, context]);

  // Ícone do tipo
  const EntityIcon = ENTITY_ICONS[entityType] || BookOpen;
  const entityLabel = ENTITY_LABELS[entityType] || 'Item';

  // Handler de publicação
  const handlePublish = useCallback(async () => {
    if (!validation.canPublish) return;
    
    setIsPublishing(true);
    setError(null);
    
    try {
      await onPublish?.({ cascade: cascadePublish });
      setShowModal(false);
    } catch (err) {
      console.error('Erro ao publicar:', err);
      setError(err.message || 'Erro ao publicar');
    } finally {
      setIsPublishing(false);
    }
  }, [validation.canPublish, onPublish, cascadePublish]);

  // Handler de despublicação
  const handleUnpublish = useCallback(async () => {
    setIsPublishing(true);
    setError(null);
    
    try {
      await onUnpublish?.();
      setShowModal(false);
    } catch (err) {
      console.error('Erro ao despublicar:', err);
      setError(err.message || 'Erro ao despublicar');
    } finally {
      setIsPublishing(false);
    }
  }, [onUnpublish]);

  // Verificar se tem filhos para cascata
  const hasChildren = useMemo(() => {
    switch (entityType) {
      case 'trilha':
        return (entity?.cursos?.length > 0) || (context.cursosVinculados?.length > 0);
      case 'curso':
        return (entity?.moduloIds?.length > 0) || (context.modulosVinculados?.length > 0);
      case 'modulo':
        return (entity?.aulaIds?.length > 0) || (context.aulasVinculadas?.length > 0);
      default:
        return false;
    }
  }, [entity, entityType, context]);

  return (
    <>
      {/* Botão principal */}
      <Button
        variant={isPublished ? 'outline' : 'default'}
        size={size}
        disabled={disabled || isPublishing}
        onClick={() => setShowModal(true)}
        className={cn(
          isPublished && 'border-success text-success hover:bg-success/10',
          !isPublished && !validation.canPublish && 'opacity-70',
          className
        )}
        leftIcon={
          isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPublished ? (
            <Eye className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )
        }
      >
        {isPublished ? 'Publicado' : 'Publicar'}
      </Button>

      {/* Modal de publicação */}
      <Modal
        open={showModal}
        onClose={() => !isPublishing && setShowModal(false)}
        title={isPublished ? `Gerenciar Publicação` : `Publicar ${entityLabel}`}
        size="md"
      >
        <div className="space-y-6 p-1">
          {/* Cabeçalho com entidade */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              isPublished ? "bg-success/10" : "bg-primary/10"
            )}>
              <EntityIcon className={cn(
                "w-6 h-6",
                isPublished ? "text-success" : "text-primary"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">
                {entity?.titulo || 'Sem título'}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={isPublished ? 'success' : 'secondary'} 
                  badgeStyle="subtle"
                >
                  {isPublished ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Status de validação */}
          {!isPublished && (
            <>
              {validation.canPublish ? (
                <Alert variant="success" title="Pronto para publicar">
                  Todos os requisitos foram atendidos. O conteúdo ficará visível para os usuários.
                </Alert>
              ) : (
                <Alert variant="warning" title="Pendências encontradas">
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validation.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}

          {/* Opção de cascata */}
          {!isPublished && hasChildren && entityType !== 'aula' && (
            <div className="p-4 border border-border rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={cascadePublish}
                  onChange={setCascadePublish}
                  id="cascade-publish"
                />
                <div className="flex-1">
                  <label 
                    htmlFor="cascade-publish" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    Publicar em cascata
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entityType === 'trilha' && 'Publicar também todos os treinamentos vinculados'}
                    {entityType === 'curso' && 'Publicar também todos os módulos vinculados'}
                    {entityType === 'modulo' && 'Publicar também todas as aulas vinculadas'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ações quando publicado */}
          {isPublished && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este conteúdo está visível para os usuários. Você pode:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Manter publicado e fazer edições (visíveis imediatamente)</span>
                </li>
                <li className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span>Despublicar para ocultar dos usuários</span>
                </li>
              </ul>
            </div>
          )}

          {/* Erro */}
          {error && (
            <Alert variant="error" title="Erro">
              {error}
            </Alert>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isPublishing}
            >
              Cancelar
            </Button>
            
            {isPublished ? (
              <Button
                variant="destructive"
                onClick={handleUnpublish}
                disabled={isPublishing}
                leftIcon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
              >
                {isPublishing ? 'Despublicando...' : 'Despublicar'}
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !validation.canPublish}
                leftIcon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              >
                {isPublishing ? 'Publicando...' : 'Publicar'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

export default PublishButton;
