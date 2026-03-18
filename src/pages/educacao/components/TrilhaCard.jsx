/**
 * TrilhaCard.jsx
 * Card para exibição de trilhas de aprendizado
 * Suporta banner/thumbnail opcional
 */

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  Badge,
  Progress,
  Button,
  AspectRatio,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  GitBranch,
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  calcularProgressoTrilha,
  calcularDiasRestantes,
  mockCursos,
  mockAulas,
  mockVisualizacoes,
  TIPOS_USUARIO,
} from '../data/mockEducacaoData';

/**
 * TrilhaCard - Card de trilha personalizada
 *
 * @param {Object} trilha - Dados da trilha
 * @param {string} userId - ID do usuário atual
 * @param {function} onClick - Callback de clique
 * @param {boolean} compact - Versão compacta
 */
export function TrilhaCard({
  trilha,
  userId,
  onClick,
  compact = false,
  className,
}) {
  // Calcular progresso da trilha
  const progresso = useMemo(() => {
    return calcularProgressoTrilha(
      trilha,
      userId,
      mockVisualizacoes,
      mockCursos,
      mockAulas
    );
  }, [trilha, userId]);

  // Calcular dias restantes
  const diasRestantes = useMemo(() => {
    if (!trilha.prazoConclusao) return null;
    return calcularDiasRestantes(trilha.createdAt, trilha.prazoConclusao);
  }, [trilha]);

  // Determinar status da trilha
  const status = useMemo(() => {
    if (progresso === 100) return 'concluida';
    if (diasRestantes !== null && diasRestantes < 0) return 'expirada';
    if (diasRestantes !== null && diasRestantes <= 7) return 'urgente';
    if (progresso > 0) return 'em_andamento';
    return 'nao_iniciada';
  }, [progresso, diasRestantes]);

  // Labels de status
  const statusConfig = {
    concluida: {
      label: 'Concluída',
      variant: 'success',
      icon: CheckCircle,
    },
    expirada: {
      label: 'Expirada',
      variant: 'destructive',
      icon: AlertCircle,
    },
    urgente: {
      label: `${diasRestantes} dias restantes`,
      variant: 'warning',
      icon: AlertTriangle,
    },
    em_andamento: {
      label: 'Em Andamento',
      variant: 'info',
      icon: Clock,
    },
    nao_iniciada: {
      label: 'Não Iniciada',
      variant: 'secondary',
      icon: BookOpen,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Contar cursos na trilha (safe access)
  const totalCursos = trilha.cursos?.length || 0;

  // Labels dos tipos de usuário (safe access)
  const tiposLabels = (trilha.tiposUsuario || [])
    .map(t => TIPOS_USUARIO[t]?.label || t)
    .join(', ');

  // Versão compacta para listas
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl",
          "bg-card border border-border",
          "hover:bg-muted/50 transition-colors text-left",
          className
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          trilha.obrigatoria ? "bg-warning/10" : "bg-muted"
        )}>
          <GitBranch className={cn(
            "w-5 h-5",
            trilha.obrigatoria ? "text-warning" : "text-muted-foreground"
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {trilha.titulo}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Progress value={progresso} size="xs" className="flex-1 h-1" />
            <span className="text-xs text-muted-foreground">{progresso}%</span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  // Versão completa
  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className={cn("overflow-hidden", className)}
    >
      {/* Banner/Thumbnail - se disponível */}
      {trilha.banner ? (
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            <img
              src={trilha.banner}
              alt={trilha.titulo}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {/* Overlay escuro para legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </AspectRatio>
          
          {/* Indicador obrigatória sobre o banner */}
          {trilha.obrigatoria && (
            <div className="absolute top-3 left-3">
              <Badge variant="warning" badgeStyle="solid" className="shadow-md">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Obrigatória
              </Badge>
            </div>
          )}
          
          {/* Título sobre o banner */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 
              className="text-white text-lg font-bold leading-tight line-clamp-2"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
              {trilha.titulo}
            </h3>
          </div>
        </div>
      ) : (
        <>
          {/* Header com indicador de obrigatoriedade (sem banner) */}
          {trilha.obrigatoria && (
            <div className="bg-warning/10 px-4 py-2 border-b border-warning/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-medium text-warning">
                  Trilha Obrigatória
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <CardContent className="p-4 space-y-4">
        {/* Título e descrição - só mostra se não tem banner */}
        {!trilha.banner && (
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
              status === 'concluida' ? "bg-success/10" :
              status === 'expirada' ? "bg-destructive/10" :
              status === 'urgente' ? "bg-warning/10" :
              "bg-primary/10"
            )}>
              <GitBranch className={cn(
                "w-6 h-6",
                status === 'concluida' ? "text-success" :
                status === 'expirada' ? "text-destructive" :
                status === 'urgente' ? "text-warning" :
                "text-primary"
              )} />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {trilha.titulo}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {trilha.descricao}
              </p>
            </div>
          </div>
        )}
        
        {/* Descrição quando tem banner */}
        {trilha.banner && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {trilha.descricao}
          </p>
        )}

        {/* Status e prazo */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={config.variant} badgeStyle="subtle">
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>

          <Badge variant="secondary" badgeStyle="subtle">
            <BookOpen className="w-3 h-3 mr-1" />
            {totalCursos} {totalCursos === 1 ? 'curso' : 'cursos'}
          </Badge>

          {trilha.prazoConclusao && status !== 'concluida' && (
            <Badge variant="secondary" badgeStyle="subtle">
              <Clock className="w-3 h-3 mr-1" />
              Prazo: {trilha.prazoConclusao} dias
            </Badge>
          )}
        </div>

        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium text-foreground">{progresso}%</span>
          </div>
          <Progress
            value={progresso}
            size="sm"
            className={cn(
              "h-2",
              status === 'concluida' && "bg-success/20 [&>div]:bg-success",
              status === 'expirada' && "bg-destructive/20 [&>div]:bg-destructive",
              status === 'urgente' && "bg-warning/20 [&>div]:bg-warning"
            )}
          />
        </div>

        {/* Tipos de usuário */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Para:</span> {tiposLabels}
        </div>

        {/* Botão de ação */}
        <Button
          variant={status === 'concluida' ? 'outline' : 'default'}
          className="w-full"
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          {status === 'concluida' ? 'Ver Detalhes' :
           progresso > 0 ? 'Continuar' : 'Iniciar'}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * TrilhaCardSkeleton - Skeleton loading
 */
export function TrilhaCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded w-24" />
          <div className="h-6 bg-muted rounded w-20" />
        </div>
        <div className="h-2 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

export default TrilhaCard;
