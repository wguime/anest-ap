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
  EmptyState
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import { useEffectiveBanner } from './hooks/useEffectiveBanner';
import { TrilhaBannerCompact } from './components/TrilhaBanner';
import * as educacaoService from '@/services/educacaoService';
import { mockCursos, mockProgressos, mockTrilhas, formatDuracao, formatData } from './data/mockEducacaoData';

export default function CursoDetalhePage({ onNavigate, goBack, cursoId, params }) {
  const [showConteudo, setShowConteudo] = useState(false);
  const { user } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { cursos, getModulosByCursoId, getTrilhasByCursoIdFromRel, useMock } = useEducacaoData();
  const [progressoCurso, setProgressoCurso] = useState(null);

  // Suporta tanto cursoId direto quanto via params
  const resolvedCursoId = cursoId || params?.cursoId;

  const cursosBase = useMemo(
    () => (useMock ? mockCursos : (cursos || [])),
    [useMock, cursos]
  );

  const cursoBase = useMemo(
    () => cursosBase.find(c => c.id === resolvedCursoId) || null,
    [cursosBase, resolvedCursoId]
  );

  // Buscar trilha que contém este curso (para banner persistente)
  const trilha = useMemo(() => {
    if (!resolvedCursoId) return null;
    
    if (useMock) {
      return mockTrilhas.find(t => t.cursos?.includes(resolvedCursoId)) || null;
    }
    
    const trilhasRelacionadas = typeof getTrilhasByCursoIdFromRel === 'function' 
      ? getTrilhasByCursoIdFromRel(resolvedCursoId) 
      : [];
    
    return trilhasRelacionadas[0] || null;
  }, [resolvedCursoId, useMock, getTrilhasByCursoIdFromRel]);

  // Obter banner efetivo da trilha
  const effectiveBanner = useEffectiveBanner(cursoBase, 'curso', { trilha });

  const isCursoVisivelParaUsuario = useMemo(() => {
    return (curso) => {
      if (!curso || curso.ativo === false) return false;
      const status = curso.statusPublicacao || 'published';
      if (status === 'draft') return false;
      if (status === 'scheduled' && curso.releaseAt) {
        const dt = new Date(curso.releaseAt);
        if (!Number.isNaN(dt.getTime()) && Date.now() < dt.getTime()) return false;
      }
      return true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedCursoId) return undefined;

    if (useMock) {
      setProgressoCurso(mockProgressos.find(p => p.cursoId === resolvedCursoId) || null);
      return undefined;
    }

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
    };
  }, [cursoBase, progressoCurso, modulosDoCurso]);

  const isNaoIniciado = curso?.status === 'nao_iniciado';
  const isConcluido = curso?.status === 'concluido' || curso?.status === 'aprovado';

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

      {/* Banner persistente da Trilha */}
      {effectiveBanner && trilha && (
        <div className="px-4 pt-4">
          <TrilhaBannerCompact
            trilha={trilha}
            banner={effectiveBanner}
            showBreadcrumb
            breadcrumb={[
              { label: trilha.titulo, onClick: () => onNavigate?.('trilhaDetalhe', { id: trilha.id }) },
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
              "relative h-48 p-5 flex flex-col justify-end",
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
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
                <GraduationCap className="w-40 h-40 text-white" />
              </div>
              <div className="absolute top-8 right-8 opacity-20">
                <div className="w-20 h-20 rounded-full border-4 border-white/30" />
              </div>
            </div>

            {/* Course Title on banner with text-shadow */}
            <h1
              className="relative z-10 text-white text-xl font-bold leading-tight"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
              {curso.titulo}
            </h1>
            <p
              className="relative z-10 text-white/70 text-sm mt-1"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
            >
              {curso.descricao}
            </p>
          </div>

          {/* Content */}
          <CardContent className="p-5 space-y-4">
            {/* Title */}
            <h2 className="text-lg font-bold text-foreground">
              {curso.titulo}
            </h2>

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
            <div className="bg-muted/30 dark:bg-muted/10 rounded-xl p-4 space-y-3">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
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
              </div>

              {/* Release date */}
              <p className="text-sm text-muted-foreground">
                Curso liberado em <span className="font-bold text-foreground">{formatData(curso.dataLiberacao)}</span>.
              </p>
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

        {/* Certificate Card (if completed) */}
        {isConcluido && (
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
