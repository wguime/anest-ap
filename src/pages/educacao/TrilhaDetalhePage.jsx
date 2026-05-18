import { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, GitBranch, BookOpen, Lock, List, GitFork } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress, EmptyState, Spinner, Tooltip } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useUser } from '@/contexts/UserContext';
import { CursoCard } from './components/CursoCard';
import { LearningPath } from './components/LearningPath';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { getUserId } from '@/utils/userIdContext';

export default function TrilhaDetalhePage({ onNavigate, goBack, trilhaId }) {
  const { user } = useUser();
  const userId = getUserId(user);
  const { trilhas, cursos, getCursosByTrilhaIdFromRel, useMock, loading } = useEducacaoData();
  const [progressos, setProgressos] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // T1.5.1 — 'list' | 'path'

  useEffect(() => {
    let cancelled = false;
    if (useMock) {
      setProgressos([]);
      return undefined;
    }
    (async () => {
      const { progressos: data } = await educacaoService.getProgressoUsuario(userId);
      if (!cancelled) setProgressos(data || []);
    })().catch(() => {
      if (!cancelled) setProgressos([]);
    });
    return () => {
      cancelled = true;
    };
  }, [useMock, userId]);

  const trilha = useMemo(() => (trilhas || []).find(t => t.id === trilhaId), [trilhas, trilhaId]);

  const cursosDaTrilha = useMemo(() => {
    if (!trilha) return [];
    // Preferir junction table, fallback para array embarcado
    const fromRel = typeof getCursosByTrilhaIdFromRel === 'function'
      ? getCursosByTrilhaIdFromRel(trilha.id)
      : [];
    if (fromRel.length > 0) return fromRel;
    return (trilha.cursos || [])
      .map(id => (cursos || []).find(c => c.id === id))
      .filter(Boolean);
  }, [trilha, cursos, getCursosByTrilhaIdFromRel]);

  const isCursoVisivelParaUsuario = useMemo(() => {
    return (curso) => educacaoService.isEntityAccessible(curso);
  }, []);

  const cursosDaTrilhaVisiveis = useMemo(
    () => cursosDaTrilha.filter(isCursoVisivelParaUsuario),
    [cursosDaTrilha, isCursoVisivelParaUsuario]
  );

  const progressoTrilha = useMemo(() => {
    if (!trilha) return 0;
    if (cursosDaTrilhaVisiveis.length === 0) return 0;
    const cursosComProgresso = cursosDaTrilhaVisiveis.map(curso => {
      const progresso = (progressos || []).find(p => p.cursoId === curso.id);
      return progresso?.progresso || 0;
    });
    const total = cursosComProgresso.reduce((acc, v) => acc + v, 0);
    return Math.round(total / cursosDaTrilhaVisiveis.length);
  }, [trilha, cursosDaTrilhaVisiveis, userId, progressos]);

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
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {trilha?.titulo || 'Trilha'}
          </h1>
          <div className="min-w-[70px] flex justify-end" />
        </div>
      </div>
    </nav>
  );

  if (!trilha) {
    if (loading) {
      return (
        <div className="min-h-dvh bg-background flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      );
    }
    return (
      <div className="min-h-dvh bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-6 py-6">
          <EmptyState
            icon={<GitBranch className="w-16 h-16" />}
            title="Trilha não encontrada"
            description="Pode ter sido removida ou você não tem acesso. Volte e escolha outra."
            action={{
              label: 'Voltar para Educação',
              onClick: () => onNavigate?.('educacaoContinuada'),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            {trilha.descricao && (
              <p className="text-sm text-muted-foreground">
                {trilha.descricao}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" badgeStyle="subtle">
                <BookOpen className="w-3 h-3 mr-1" />
                {cursosDaTrilhaVisiveis.length} {cursosDaTrilhaVisiveis.length === 1 ? 'treinamento' : 'treinamentos'}
              </Badge>
              {trilha.obrigatoria && (
                <Badge variant="warning" badgeStyle="subtle">
                  Obrigatória
                </Badge>
              )}
              {trilha.prazoConclusao && (
                <Badge variant="secondary" badgeStyle="subtle">
                  Prazo: {trilha.prazoConclusao} dias
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium text-foreground">{progressoTrilha}%</span>
              </div>
              <Progress value={progressoTrilha} size="sm" className="h-2" />
            </div>
          </CardContent>
        </Card>

        {cursosDaTrilhaVisiveis.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-16 h-16" />}
            title="Nenhum treinamento nesta trilha"
            description="A trilha está sendo preparada. Enquanto isso, veja outros cursos disponíveis."
            action={{
              label: 'Explorar cursos',
              onClick: () => onNavigate?.('educacaoContinuada'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {/* T1.5.1 — Toggle Lista / Caminho visual */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Visualização</span>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium min-h-[36px] transition-colors',
                    viewMode === 'list'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('path')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium min-h-[36px] transition-colors',
                    viewMode === 'path'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={viewMode === 'path'}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  Caminho
                </button>
              </div>
            </div>

            {trilha.tipoNavegacao === 'sequential' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" aria-hidden="true" />
                Trilha sequencial — conclua um treinamento para liberar o próximo.
              </p>
            )}

            {/* T1.5.1 — Caminho visual Duolingo-style */}
            {viewMode === 'path' && (
              <LearningPath
                items={cursosDaTrilhaVisiveis.map((curso) => {
                  const progresso = (progressos || []).find((p) => p.cursoId === curso.id);
                  const status = progresso?.status;
                  const acesso = educacaoService.canAccessCurso(
                    curso,
                    trilha,
                    cursosDaTrilhaVisiveis,
                    progressos,
                  );
                  let pathStatus = 'next';
                  if (status === 'concluido' || status === 'aprovado') pathStatus = 'done';
                  else if (status === 'em_andamento') pathStatus = 'current';
                  else if (!acesso.allowed) pathStatus = 'locked';
                  return {
                    id: curso.id,
                    title: curso.titulo,
                    status: pathStatus,
                    durationMinutes: curso.duracaoMinutos,
                  };
                })}
                onSelect={(item) =>
                  onNavigate?.('cursoDetalhe', { cursoId: item.id, trilhaId: trilha.id })
                }
              />
            )}

            {viewMode === 'list' && cursosDaTrilhaVisiveis.map(curso => {
              const progresso = (progressos || []).find(p => p.cursoId === curso.id);
              const cursoComProgresso = {
                ...curso,
                progresso: progresso?.progresso || 0,
                status: progresso?.status || 'nao_iniciado',
              };
              const acesso = educacaoService.canAccessCurso(
                curso,
                trilha,
                cursosDaTrilhaVisiveis,
                progressos,
              );

              if (!acesso.allowed) {
                return (
                  <Tooltip key={curso.id} content={acesso.motivo}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-disabled="true"
                      aria-label={`${curso.titulo} bloqueado. ${acesso.motivo}`}
                      className={cn(
                        'relative rounded-2xl overflow-hidden border border-border',
                        'opacity-60 cursor-not-allowed select-none',
                      )}
                    >
                      <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card/95 border border-border text-xs font-medium text-foreground shadow-sm">
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                        Bloqueado
                      </div>
                      <div className="pointer-events-none">
                        <CursoCard
                          curso={cursoComProgresso}
                          onClick={() => {}}
                        />
                      </div>
                    </div>
                  </Tooltip>
                );
              }

              return (
                <CursoCard
                  key={curso.id}
                  curso={cursoComProgresso}
                  onClick={() => onNavigate?.('cursoDetalhe', { cursoId: curso.id, trilhaId: trilha.id })}
                />
              );
            })}
          </div>
        )}

        <Button
          className="w-full"
          onClick={() => onNavigate?.('educacaoContinuada')}
          variant="outline"
        >
          Voltar para Educação Continuada
        </Button>
      </div>
    </div>
  );
}

