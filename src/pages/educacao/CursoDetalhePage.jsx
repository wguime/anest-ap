import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  Trophy,
  MoreVertical,
  Play
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Progress,
  Badge,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  EmptyState,
  Spinner,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import { useEffectiveBanner } from './hooks/useEffectiveBanner';
import { TrilhaBannerCompact } from './components/TrilhaBanner';
import * as educacaoService from '@/services/educacaoService';
import { formatDuracao, formatData } from './data/educacaoUtils';
import { QuizCurso } from './components/QuizCurso';

export default function CursoDetalhePage({ onNavigate, goBack, cursoId, params }) {
  const [showConteudo, setShowConteudo] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const { user } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { cursos, getModulosByCursoId, getTrilhasByCursoIdFromRel, useMock, loading } = useEducacaoData();
  const [progressoCurso, setProgressoCurso] = useState(null);

  // Suporta tanto cursoId direto quanto via params
  const resolvedCursoId = cursoId || params?.cursoId;

  const cursosBase = useMemo(
    () => (cursos || []),
    [cursos]
  );

  const cursoBase = useMemo(
    () => cursosBase.find(c => c.id === resolvedCursoId) || null,
    [cursosBase, resolvedCursoId]
  );

  // Buscar trilha que contém este curso (para banner persistente)
  const trilha = useMemo(() => {
    if (!resolvedCursoId) return null;
    
    const trilhasRelacionadas = typeof getTrilhasByCursoIdFromRel === 'function'
      ? getTrilhasByCursoIdFromRel(resolvedCursoId) 
      : [];
    
    return trilhasRelacionadas[0] || null;
  }, [resolvedCursoId, useMock, getTrilhasByCursoIdFromRel]);

  // Obter banner efetivo da trilha
  const effectiveBanner = useEffectiveBanner(cursoBase, 'curso', { trilha });

  const isCursoVisivelParaUsuario = useMemo(() => {
    return (curso) => educacaoService.isEntityAccessible(curso);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedCursoId) return undefined;

    (async () => {
      const { progresso } = await educacaoService.getProgressoCurso(userId, resolvedCursoId);
      if (!cancelled) setProgressoCurso(progresso || null);
    })().catch(() => {
      if (!cancelled) setProgressoCurso(null);
    });

    return () => {
      cancelled = true;
    };
  }, [useMock, userId, resolvedCursoId]);

  const modulosDoCurso = useMemo(() => {
    if (!resolvedCursoId) return [];
    const list = typeof getModulosByCursoId === 'function'
      ? (getModulosByCursoId(resolvedCursoId) || [])
      : (cursoBase?.modulos || []);
    return (list || []).filter(m => m?.ativo !== false);
  }, [getModulosByCursoId, resolvedCursoId, cursoBase]);

  const curso = useMemo(() => {
    if (!cursoBase) return null;
    const progresso = progressoCurso;
    return {
      ...cursoBase,
      progresso: progresso?.progresso || 0,
      status: progresso?.status || 'nao_iniciado',
      modulosCompletos: progresso?.modulosCompletos || [],
      dataInicio: progresso?.dataInicio,
      dataConclusao: progresso?.dataConclusao,
      pontos: progresso?.pontos || 0,
      modulos: modulosDoCurso,
      quizResult: progresso?.quizResult || null,
    };
  }, [cursoBase, progressoCurso, modulosDoCurso]);

  const isNaoIniciado = curso?.status === 'nao_iniciado';
  const isConcluido = curso?.status === 'concluido' || curso?.status === 'aprovado';

  // Quiz: check if all modules are complete (content finished)
  const allModulesComplete = curso?.modulos?.length > 0 &&
    curso.modulos.every(m => curso.modulosCompletos?.includes(m.id));
  const needsQuiz = curso?.avaliacaoObrigatoria && allModulesComplete;
  const quizPassed = curso?.quizResult?.aprovado === true;
  // Certificate is blocked if quiz is required but not passed
  const certificateBlocked = curso?.avaliacaoObrigatoria && !quizPassed;

  const actionButtonText = useMemo(() => {
    if (!curso) return 'Ver';
    switch (curso.status) {
      case 'nao_iniciado':
        return 'INICIAR';
      case 'em_andamento':
        return 'CONTINUAR';
      case 'concluido':
        return 'CONCLUÍDO';
      default:
        return 'VER';
    }
  }, [curso]);

  const modulosCompletosCount = curso?.modulosCompletos?.length || 0;

  const handleModuloClick = (modulo) => {
    onNavigate?.('aulaPlayer', {
      cursoId: curso.id,
      moduloId: modulo.id
    });
  };

  const handleStartCourse = () => {
    if (!curso?.modulos?.length) return;

    // Encontrar primeiro módulo não concluído
    const proximoModulo = curso.modulos.find(m => !curso.modulosCompletos.includes(m.id));
    const moduloTarget = proximoModulo || curso.modulos[0];

    // Navegar para o player
    onNavigate?.('aulaPlayer', {
      cursoId: curso.id,
      moduloId: moduloTarget.id
    });
  };

  // Header element (padrão do app)
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          {/* Botão Voltar - Esquerda */}
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

          {/* Título - Centro */}
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {curso?.titulo || 'Curso'}
          </h1>

          {/* Espaço - Direita */}
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  if (!curso || !isCursoVisivelParaUsuario(curso)) {
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
        <div className="px-4 pt-8">
          <EmptyState
            icon={<GraduationCap className="w-16 h-16" />}
            title={!curso ? "Treinamento não encontrado" : "Treinamento indisponível"}
            description={!curso
              ? "O treinamento solicitado não existe ou foi removido."
              : "Este treinamento ainda não está publicado para os usuários."}
          />
          <div className="flex justify-center mt-6">
            <Button onClick={goBack}>
              Voltar para lista
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      {/* Breadcrumb (shown when no banner) */}
      {(!effectiveBanner || !trilha) && (
        <div className="px-4 pt-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => onNavigate?.('educacao')}>Educacao</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {trilha && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink onClick={() => onNavigate?.('trilhaDetalhe', { trilhaId: trilha.id })}>{trilha.titulo}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{curso?.titulo || 'Curso'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

      {/* Banner persistente da Trilha */}
      {effectiveBanner && trilha && (
        <div className="px-4 pt-4">
          <TrilhaBannerCompact
            trilha={trilha}
            banner={effectiveBanner}
            showBreadcrumb
            breadcrumb={[
              { label: trilha.titulo, onClick: () => onNavigate?.('trilhaDetalhe', { trilhaId: trilha.id }) },
              { label: curso.titulo },
            ]}
          />
        </div>
      )}

      <div className={cn("px-4 space-y-4", effectiveBanner ? "pt-4" : "pt-4")}>
        {/* Main Course Card */}
        <Card className="overflow-hidden">
          {/* Banner with gradient background */}
          <div
            className={cn(
              "relative h-36 p-5 flex flex-col justify-end",
              !curso.banner && "bg-gradient-to-br from-[#004225] via-[#006837] to-[#2E8B57]"
            )}
            style={{
              backgroundImage: curso.banner ? `url(${curso.banner})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Overlay escuro para legibilidade quando tem banner */}
            {curso.banner && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            )}

            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]">
                <GraduationCap className="w-32 h-32 text-white" />
              </div>
            </div>

            {/* Bottom gradient for text readability */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

            {/* Course Title on banner */}
            <h1
              className="relative z-10 text-white text-2xl font-extrabold leading-tight tracking-tight drop-shadow-lg"
            >
              {curso.titulo}
            </h1>
            {curso.descricao ? (
              <p
                className="relative z-10 text-white/90 text-sm mt-1 line-clamp-1 font-medium drop-shadow-md"
              >
                {curso.descricao}
              </p>
            ) : null}
          </div>

          {/* Content */}
          <CardContent className="p-4 space-y-3">
            {/* Action Button */}
            <Button
              onClick={handleStartCourse}
              variant={isNaoIniciado ? 'warning' : 'default'}
              className="w-full"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {actionButtonText}
            </Button>

            {/* Progress info */}
            <p className="text-sm text-muted-foreground">
              Você completou <span className="font-bold text-foreground">{modulosCompletosCount} módulos</span>.
            </p>

            {/* Progress Bar */}
            <Progress
              value={curso.progresso}
              size="sm"
              className="h-2"
            />

            {/* Meta info section */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="warning"
                badgeStyle="solid"
                className="flex items-center gap-1"
              >
                <GraduationCap className="w-3 h-3" />
                META: {curso.metaPorcentagem || 100}%
              </Badge>
              <Badge
                variant="secondary"
                badgeStyle="solid"
                className="flex items-center gap-1"
              >
                <Clock className="w-3 h-3" />
                {formatDuracao(curso.duracaoMinutos)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Liberado em {formatData(curso.dataLiberacao)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Veja Mais - Collapsible Content */}
        <Card>
          <Collapsible open={showConteudo} onOpenChange={setShowConteudo}>
            <CollapsibleTrigger className="w-full flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">VEJA MAIS</span>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground ml-auto transition-transform",
                showConteudo && "rotate-180"
              )} />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 border-t border-border">
                <ul className="mt-4 space-y-2">
                  {curso.conteudos?.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-1">•</span>
                      {item};
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Quiz Section (show after all modules complete, if avaliacaoObrigatoria) */}
        {needsQuiz && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {!showQuiz && !quizPassed && (
                <div className="text-center space-y-3">
                  <GraduationCap className="w-10 h-10 text-primary mx-auto" />
                  <p className="text-sm text-foreground">
                    Todos os módulos foram concluídos. Complete a avaliação para obter o certificado.
                  </p>
                  {curso.quizResult && !curso.quizResult.aprovado && (
                    <p className="text-xs text-muted-foreground">
                      Última tentativa: {curso.quizResult.nota}% (mínimo: {curso.notaMinimaAprovacao || 70}%)
                    </p>
                  )}
                  <Button
                    variant="warning"
                    onClick={() => setShowQuiz(true)}
                  >
                    INICIAR AVALIAÇÃO
                  </Button>
                </div>
              )}
              {showQuiz && !quizPassed && (
                <QuizCurso
                  cursoId={resolvedCursoId}
                  userId={userId}
                  notaMinima={curso.notaMinimaAprovacao || 70}
                  quizResult={curso.quizResult}
                  onComplete={(res) => {
                    // Re-fetch progress to update status
                    if (res.aprovado) {
                      setShowQuiz(false);
                    }
                  }}
                />
              )}
              {quizPassed && (
                <div className="text-center space-y-2">
                  <Trophy className="w-10 h-10 text-success mx-auto" />
                  <p className="text-sm font-semibold text-success">Avaliação aprovada!</p>
                  <p className="text-xs text-muted-foreground">
                    Nota: {curso.quizResult?.nota}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Certificate Card (if completed and quiz passed or not required) */}
        {isConcluido && !certificateBlocked && (
          <Card className="bg-muted/30 dark:bg-muted/10">
            <CardContent className="p-5 text-center space-y-3">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-foreground">
                Certificado: <span className="font-semibold">{curso.titulo}</span>
              </p>
              <Button
                variant="success"
                onClick={() => onNavigate?.('certificados')}
              >
                EMITA AGORA
              </Button>
            </CardContent>
          </Card>
        )}
        {isConcluido && certificateBlocked && (
          <Card className="bg-muted/30 dark:bg-muted/10 border-dashed">
            <CardContent className="p-5 text-center space-y-3">
              <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Aprove na avaliação para emitir o certificado
              </p>
            </CardContent>
          </Card>
        )}

        {/* Modules Section */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-base font-semibold text-primary mb-4">
              Veja abaixo os seus conteúdos
            </h3>

            <div className="space-y-3">
              {curso.modulos?.map(modulo => {
                const isCompleto = curso.modulosCompletos.includes(modulo.id);
                const progressoModulo = isCompleto ? 100 : (curso.progresso > 0 && !isCompleto ? Math.min(curso.progresso, 50) : 0);

                return (
                  <button
                    key={modulo.id}
                    onClick={() => handleModuloClick(modulo)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 dark:bg-muted/10 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {modulo.titulo}
                      </p>
                    </div>
                    <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
                      {progressoModulo}%
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
