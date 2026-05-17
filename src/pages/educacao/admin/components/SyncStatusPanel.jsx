/**
 * SyncStatusPanel.jsx
 * Painel de status de sincronização para o admin
 * Mostra estatísticas de publicação e permite forçar sincronização
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Progress,
  Alert,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as educacaoService from '@/services/educacaoService';

/**
 * Calcular estatísticas de publicação
 */
function calcularEstatisticas(trilhas = [], cursos = [], modulos = [], aulas = []) {
  const stats = {
    trilhas: { total: 0, publicados: 0, rascunhos: 0 },
    cursos: { total: 0, publicados: 0, rascunhos: 0 },
    modulos: { total: 0, publicados: 0, rascunhos: 0 },
    aulas: { total: 0, publicados: 0, rascunhos: 0 },
  };
  
  const isPublished = (entity) => {
    const status = entity.statusPublicacao?.toLowerCase() || entity.status?.toLowerCase() || '';
    return status === 'published';
  };
  
  // Trilhas
  trilhas.forEach(t => {
    if (!t.ativo) return; // Ignorar inativos
    stats.trilhas.total++;
    if (isPublished(t)) {
      stats.trilhas.publicados++;
    } else {
      stats.trilhas.rascunhos++;
    }
  });
  
  // Cursos
  cursos.forEach(c => {
    if (!c.ativo) return;
    stats.cursos.total++;
    if (isPublished(c)) {
      stats.cursos.publicados++;
    } else {
      stats.cursos.rascunhos++;
    }
  });
  
  // Módulos
  modulos.forEach(m => {
    if (!m.ativo) return;
    stats.modulos.total++;
    if (isPublished(m)) {
      stats.modulos.publicados++;
    } else {
      stats.modulos.rascunhos++;
    }
  });
  
  // Aulas
  aulas.forEach(a => {
    if (!a.ativo) return;
    stats.aulas.total++;
    if (isPublished(a)) {
      stats.aulas.publicados++;
    } else {
      stats.aulas.rascunhos++;
    }
  });
  
  return stats;
}

/**
 * StatItem - Item de estatística individual
 */
function StatItem({ icon: Icon, label, total, publicados, rascunhos }) {
  const percent = total > 0 ? Math.round((publicados / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            {publicados}/{total}
          </span>
        </div>
        <Progress value={percent} size="xs" className="h-2" />
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {publicados > 0 && (
          <Badge variant="success" badgeStyle="subtle" className="text-xs">
            <Eye className="w-3.5 h-3.5 mr-0.5" />
            {publicados}
          </Badge>
        )}
        {rascunhos > 0 && (
          <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
            <EyeOff className="w-3.5 h-3.5 mr-0.5" />
            {rascunhos}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * SyncStatusPanel - Painel de status de sincronização
 */
export function SyncStatusPanel({
  trilhas = [],
  cursos = [],
  modulos = [],
  aulas = [],
  onSyncComplete,
  className,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResult, setSyncResult] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);

  // Calcular estatísticas
  const stats = useMemo(() => {
    return calcularEstatisticas(trilhas, cursos, modulos, aulas);
  }, [trilhas, cursos, modulos, aulas]);

  // Totais gerais
  const totals = useMemo(() => {
    const total = stats.trilhas.total + stats.cursos.total + stats.modulos.total + stats.aulas.total;
    const publicados = stats.trilhas.publicados + stats.cursos.publicados + stats.modulos.publicados + stats.aulas.publicados;
    const rascunhos = stats.trilhas.rascunhos + stats.cursos.rascunhos + stats.modulos.rascunhos + stats.aulas.rascunhos;
    return { total, publicados, rascunhos };
  }, [stats]);

  // Handler de sincronização forçada
  const handleForceSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncResult(null);
    
    const errors = [];
    const trilhaIds = trilhas.filter(t => t.ativo).map(t => t.id);
    const totalSteps = trilhaIds.length;
    let completed = 0;
    
    try {
      for (const trilhaId of trilhaIds) {
        const result = await educacaoService.syncTrilhaCascade(trilhaId);
        if (!result.success) {
          errors.push(...result.errors);
        }
        completed++;
        setSyncProgress(Math.round((completed / totalSteps) * 100));
      }
      
      setSyncResult({
        success: errors.length === 0,
        message: errors.length === 0 
          ? 'Sincronização concluída com sucesso!' 
          : `Sincronização concluída com ${errors.length} erro(s)`,
        errors,
      });
      
      // Callback para atualizar dados
      onSyncComplete?.();
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncResult({
        success: false,
        message: 'Erro ao sincronizar',
        errors: [error.message],
      });
    } finally {
      setIsSyncing(false);
    }
  }, [trilhas, onSyncComplete]);

  // Handler de limpeza de referências órfãs
  const handleCleanOrphans = useCallback(async () => {
    setIsCleaning(true);
    setCleanResult(null);

    try {
      const result = await educacaoService.cleanOrphanedReferences({ dryRun: false });
      const { stats } = result;
      const totalLimpos = (stats.publishedCursoIdsLimpos || 0) +
        (stats.publishedModuloIdsLimpos || 0) +
        (stats.publishedAulaIdsLimpos || 0) +
        (stats.junctionTrilhaCursosRemovidas || 0) +
        (stats.junctionCursoModulosRemovidas || 0) +
        (stats.junctionModuloAulasRemovidas || 0);

      setCleanResult({
        success: result.success,
        message: totalLimpos > 0
          ? `${totalLimpos} referência(s) órfã(s) removida(s)`
          : 'Nenhuma referência órfã encontrada',
        stats,
      });

      if (totalLimpos > 0) {
        onSyncComplete?.();
      }
    } catch (error) {
      console.error('Erro na limpeza de órfãos:', error);
      setCleanResult({
        success: false,
        message: 'Erro ao limpar referências',
        stats: {},
      });
    } finally {
      setIsCleaning(false);
    }
  }, [onSyncComplete]);

  // Verificar se há itens pendentes de sync
  const hasPendingSync = useMemo(() => {
    // Verificar se há trilhas publicadas sem publishedCursoIds
    return trilhas.some(t => {
      const isPublished = (t.statusPublicacao || t.status || '').toLowerCase() === 'published';
      const hasRelations = t.cursos?.length > 0;
      const hasSyncedIds = t.publishedCursoIds?.length > 0;
      return isPublished && hasRelations && !hasSyncedIds;
    });
  }, [trilhas]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header colapsável */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            hasPendingSync ? "bg-warning/10" : "bg-success/10"
          )}>
            {hasPendingSync ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold">Status de Publicação</h3>
            <p className="text-xs text-muted-foreground">
              {totals.publicados} de {totals.total} itens publicados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={totals.rascunhos > 0 ? 'warning' : 'success'} 
            badgeStyle="subtle"
          >
            {totals.rascunhos} rascunhos
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Estatísticas por tipo */}
          <div className="space-y-2">
            <StatItem
              icon={GitBranch}
              label="Trilhas"
              {...stats.trilhas}
            />
            <StatItem
              icon={BookOpen}
              label="Treinamentos"
              {...stats.cursos}
            />
            <StatItem
              icon={FolderOpen}
              label="Módulos"
              {...stats.modulos}
            />
            <StatItem
              icon={Video}
              label="Aulas"
              {...stats.aulas}
            />
          </div>

          {/* Alerta de pendência */}
          {hasPendingSync && (
            <Alert variant="warning" title="Sincronização pendente">
              Alguns itens publicados podem não estar visíveis para os alunos.
              Clique em "Forçar Sincronização" para atualizar.
            </Alert>
          )}

          {/* Resultado da sincronização */}
          {syncResult && (
            <Alert 
              variant={syncResult.success ? 'success' : 'error'} 
              title={syncResult.message}
            >
              {syncResult.errors?.length > 0 && (
                <ul className="list-disc list-inside mt-2 text-xs">
                  {syncResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {syncResult.errors.length > 5 && (
                    <li>... e mais {syncResult.errors.length - 5} erros</li>
                  )}
                </ul>
              )}
            </Alert>
          )}

          {/* Progresso de sincronização */}
          {isSyncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Sincronizando...</span>
                <span>{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} size="sm" />
            </div>
          )}

          {/* Botão de sincronização */}
          <Button
            variant="outline"
            onClick={handleForceSync}
            disabled={isSyncing || trilhas.length === 0}
            className="w-full"
            leftIcon={isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          >
            {isSyncing ? 'Sincronizando...' : 'Forçar Sincronização'}
          </Button>

          {/* Resultado da limpeza de órfãos */}
          {cleanResult && (
            <Alert
              variant={cleanResult.success ? 'success' : 'error'}
              title={cleanResult.message}
            >
              {cleanResult.stats && (cleanResult.stats.publishedCursoIdsLimpos > 0 ||
                cleanResult.stats.publishedModuloIdsLimpos > 0 ||
                cleanResult.stats.publishedAulaIdsLimpos > 0) && (
                <ul className="list-disc list-inside mt-2 text-xs">
                  {cleanResult.stats.publishedCursoIdsLimpos > 0 && (
                    <li>{cleanResult.stats.publishedCursoIdsLimpos} cursoIds órfãos em trilhas</li>
                  )}
                  {cleanResult.stats.publishedModuloIdsLimpos > 0 && (
                    <li>{cleanResult.stats.publishedModuloIdsLimpos} moduloIds órfãos em cursos</li>
                  )}
                  {cleanResult.stats.publishedAulaIdsLimpos > 0 && (
                    <li>{cleanResult.stats.publishedAulaIdsLimpos} aulaIds órfãos em módulos</li>
                  )}
                  {cleanResult.stats.junctionTrilhaCursosRemovidas > 0 && (
                    <li>{cleanResult.stats.junctionTrilhaCursosRemovidas} relações trilha-curso órfãs</li>
                  )}
                  {cleanResult.stats.junctionCursoModulosRemovidas > 0 && (
                    <li>{cleanResult.stats.junctionCursoModulosRemovidas} relações curso-módulo órfãs</li>
                  )}
                  {cleanResult.stats.junctionModuloAulasRemovidas > 0 && (
                    <li>{cleanResult.stats.junctionModuloAulasRemovidas} relações módulo-aula órfãs</li>
                  )}
                </ul>
              )}
            </Alert>
          )}

          {/* Botão de limpeza de referências órfãs */}
          <Button
            variant="outline"
            onClick={handleCleanOrphans}
            disabled={isCleaning || isSyncing}
            className="w-full"
            leftIcon={isCleaning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
          >
            {isCleaning ? 'Limpando...' : 'Limpar Referências Órfãs'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            A sincronização atualiza os arrays de IDs publicados usados pelos alunos.
            A limpeza remove referências a conteúdos excluídos.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export default SyncStatusPanel;
