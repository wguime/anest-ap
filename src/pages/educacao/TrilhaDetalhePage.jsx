import { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, GitBranch, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress, EmptyState, Spinner } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useUser } from '@/contexts/UserContext';
import { CursoCard } from './components/CursoCard';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';

export default function TrilhaDetalhePage({ onNavigate, goBack, trilhaId }) {
  const { user } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { trilhas, cursos, getCursosByTrilhaIdFromRel, useMock, loading } = useEducacaoData();
  const [progressos, setProgressos] = useState([]);

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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-6 py-6">
          <EmptyState
            icon={<GitBranch className="w-16 h-16" />}
            title="Trilha não encontrada"
            description="Volte e selecione outra trilha."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                "bg-primary/10"
              )}>
                <GitBranch className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  {trilha.titulo}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {trilha.descricao}
                </p>
              </div>
            </div>

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
            description="Esta trilha ainda não possui treinamentos disponíveis."
          />
        ) : (
          <div className="space-y-3">
            {cursosDaTrilhaVisiveis.map(curso => {
              const progresso = (progressos || []).find(p => p.cursoId === curso.id);
              const cursoComProgresso = {
                ...curso,
                progresso: progresso?.progresso || 0,
                status: progresso?.status || 'nao_iniciado',
              };

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

