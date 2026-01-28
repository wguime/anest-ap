/**
 * AulaPlayerPage.jsx
 * Página wrapper para o player de aula
 * Permite rotação para modo horizontal apenas nesta página
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, PlayCircle, CheckCircle2, Clock, BookOpen, Maximize2, Award } from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Progress,
} from '@/design-system';
import { AulaPlayer } from './components/AulaPlayer';
import { TrilhaBannerCompact } from './components/TrilhaBanner';
import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import { useEffectiveBanner } from './hooks/useEffectiveBanner';
import * as educacaoService from '@/services/educacaoService';
import { mockCursos, mockAulas, mockProgressos, formatDuracao, mockTrilhas } from './data/mockEducacaoData';

// Hook para controlar orientação da tela
function useScreenOrientation() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }

      // Tentar bloquear em landscape
      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock('landscape');
        } catch (e) {
          // Alguns navegadores não suportam lock
          console.log('Orientation lock not supported');
        }
      }
      setIsFullscreen(true);
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      }

      // Desbloquear orientação
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.error('Exit fullscreen error:', err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      setIsFullscreen(isFs);

      if (!isFs && screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      // Garantir que a orientação é desbloqueada ao sair
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    };
  }, []);

  return { isFullscreen, enterFullscreen, exitFullscreen };
}

export default function AulaPlayerPage({ onNavigate, goBack, params }) {
  const { cursoId, moduloId, aulaId } = params || {};
  const { isFullscreen, enterFullscreen, exitFullscreen } = useScreenOrientation();
  const { user } = useUser();
  const userId = user?.uid || user?.id || null;
  const {
    cursos,
    trilhas,
    getModulosByCursoId,
    getAulasByModuloId,
    getTrilhasByCursoIdFromRel,
    useMock,
  } = useEducacaoData();
  const [progresso, setProgresso] = useState(null);

  // Buscar dados do curso
  const curso = useMemo(() => {
    const cursosBase = useMock ? mockCursos : (cursos || []);
    return cursosBase.find(c => c.id === cursoId) || null;
  }, [cursoId, cursos, useMock]);

  // Buscar trilha que contém este curso (para banner persistente)
  const trilha = useMemo(() => {
    if (!cursoId) return null;
    
    if (useMock) {
      // Em mock, procurar trilha que contém o curso
      return mockTrilhas.find(t => t.cursos?.includes(cursoId)) || null;
    }
    
    // Usar junction table para encontrar trilhas do curso
    const trilhasRelacionadas = typeof getTrilhasByCursoIdFromRel === 'function' 
      ? getTrilhasByCursoIdFromRel(cursoId) 
      : [];
    
    // Retornar a primeira trilha encontrada
    return trilhasRelacionadas[0] || null;
  }, [cursoId, useMock, getTrilhasByCursoIdFromRel]);

  // Obter banner efetivo da trilha
  const effectiveBanner = useEffectiveBanner(curso, 'curso', { trilha });

  // Buscar aulas do curso
  const aulasDoCurso = useMemo(() => {
    if (!cursoId) return [];
    if (useMock) {
      return mockAulas.filter(a => a.cursoId === cursoId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }

    const modulosDoCurso = (typeof getModulosByCursoId === 'function' ? getModulosByCursoId(cursoId) : []) || [];
    const result = [];
    modulosDoCurso.forEach((m) => {
      const aulasModulo = (typeof getAulasByModuloId === 'function' ? getAulasByModuloId(m.id) : []) || [];
      aulasModulo.forEach((a) => result.push(a));
    });
    return result.filter(a => a?.ativo !== false);
  }, [cursoId, useMock, getModulosByCursoId, getAulasByModuloId]);

  // Aula atual (primeira aula se nao especificada)
  const [currentAulaIndex, setCurrentAulaIndex] = useState(0);

  // Inicializar com a aula correta baseado nos params
  useEffect(() => {
    if (aulaId) {
      const index = aulasDoCurso.findIndex(a => a.id === aulaId);
      if (index >= 0) setCurrentAulaIndex(index);
    } else if (moduloId) {
      const index = aulasDoCurso.findIndex(a => a.moduloId === moduloId);
      if (index >= 0) setCurrentAulaIndex(index);
    }
  }, [aulaId, moduloId, aulasDoCurso]);

  const currentAula = aulasDoCurso[currentAulaIndex];

  // Progresso do usuario
  useEffect(() => {
    let cancelled = false;
    if (!cursoId) return undefined;
    if (useMock) {
      setProgresso(mockProgressos.find(p => p.cursoId === cursoId) || null);
      return undefined;
    }
    if (!userId) {
      setProgresso(null);
      return undefined;
    }
    (async () => {
      const { progresso: data } = await educacaoService.getProgressoCurso(userId, cursoId);
      if (!cancelled) setProgresso(data || null);
    })().catch(() => {
      if (!cancelled) setProgresso(null);
    });
    return () => {
      cancelled = true;
    };
  }, [cursoId, useMock, userId]);

  // Handler de proxima aula
  const handleNextAula = () => {
    if (currentAulaIndex < aulasDoCurso.length - 1) {
      setCurrentAulaIndex(prev => prev + 1);
    }
  };

  // Handler de aula anterior
  const handlePrevAula = () => {
    if (currentAulaIndex > 0) {
      setCurrentAulaIndex(prev => prev - 1);
    }
  };

  // Handler de conclusao da aula
  const handleAulaComplete = (aula) => {
    if (!aula) return;

    if (!useMock && userId && cursoId) {
      (async () => {
        await educacaoService.marcarAulaAssistida(userId, cursoId, aula.id, 100);

        // Recarregar progresso (e tentar concluir módulo quando todas aulas dele forem assistidas)
        const { progresso: updated } = await educacaoService.getProgressoCurso(userId, cursoId);
        setProgresso(updated || null);

        const aulasModulo = typeof getAulasByModuloId === 'function'
          ? (getAulasByModuloId(aula.moduloId) || [])
          : [];
        const assistidas = updated?.aulasAssistidas || [];
        const isWatched = (aulaIdToCheck) => assistidas.some((x) => (typeof x === 'string' ? x === aulaIdToCheck : x?.aulaId === aulaIdToCheck));
        const moduloCompleto = aulasModulo.length > 0 && aulasModulo.every((a) => isWatched(a.id));

        if (moduloCompleto && !updated?.modulosCompletos?.includes(aula.moduloId)) {
          const totalModulos = (typeof getModulosByCursoId === 'function' ? (getModulosByCursoId(cursoId) || []).length : 0) || 0;
          await educacaoService.concluirModulo(userId, cursoId, aula.moduloId, totalModulos || 1);
          const { progresso: updated2 } = await educacaoService.getProgressoCurso(userId, cursoId);
          setProgresso(updated2 || updated || null);
        }
      })().catch((err) => console.error('Erro ao registrar conclusão da aula:', err));
    }

    // Auto-avanca para proxima aula
    if (currentAulaIndex < aulasDoCurso.length - 1) {
      setTimeout(() => handleNextAula(), 1500);
    }
  };

  // Se nao encontrar o curso
  if (!curso) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Curso nao encontrado</p>
          <Button onClick={goBack}>Voltar</Button>
        </div>
      </div>
    );
  }

  // Se nao tiver aulas
  if (aulasDoCurso.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Este curso ainda nao possui aulas</p>
          <Button onClick={goBack}>Voltar</Button>
        </div>
      </div>
    );
  }

  // Header element
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">
              {curso.titulo}
            </h1>
            <p className="text-xs text-muted-foreground">
              Aula {currentAulaIndex + 1} de {aulasDoCurso.length}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="space-y-4">
        {/* Banner persistente da Trilha */}
        {effectiveBanner && trilha && (
          <div className="px-4">
            <TrilhaBannerCompact
              trilha={trilha}
              banner={effectiveBanner}
              showBreadcrumb
              breadcrumb={[
                { label: trilha.titulo, onClick: () => onNavigate?.('trilhaDetalhe', { id: trilha.id }) },
                { label: curso.titulo, onClick: () => onNavigate?.('cursoDetalhe', { id: curso.id }) },
                { label: currentAula?.titulo || 'Aula' },
              ]}
            />
          </div>
        )}

        {/* Player de Video/Audio */}
        <div className="bg-black relative">
          {currentAula && (
            <AulaPlayer
              key={currentAula.id}
              aula={currentAula}
              cursoId={cursoId}
              onComplete={handleAulaComplete}
            />
          )}
          {/* Botão de tela cheia (modo horizontal) */}
          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              className="absolute top-2 right-2 p-2 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors z-10"
              title="Tela cheia (modo horizontal)"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Informacoes da Aula */}
        <div className="px-4 space-y-4">
          {/* Titulo e Descricao */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {currentAula?.titulo}
            </h2>
            {currentAula?.descricao && (
              <p className="text-sm text-muted-foreground mt-1">
                {currentAula.descricao}
              </p>
            )}
          </div>

          {/* Progress do Curso */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso do Curso</span>
                <span className="text-sm text-muted-foreground">
                  {progresso?.progresso || 0}%
                </span>
              </div>
              <Progress value={progresso?.progresso || 0} className="h-2" />
            </CardContent>
          </Card>

          {/* Card de Certificado - aparece quando curso concluído */}
          {progresso?.status === 'concluido' && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Curso Concluído!
                    </h3>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Seu certificado está disponível
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onNavigate?.('certificados')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Ver Certificado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navegacao entre aulas */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePrevAula}
              disabled={currentAulaIndex === 0}
            >
              Anterior
            </Button>
            <Button
              className="flex-1"
              onClick={handleNextAula}
              disabled={currentAulaIndex === aulasDoCurso.length - 1}
            >
              Proxima
            </Button>
          </div>

          {/* Lista de Aulas */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Conteudo do Curso
              </h3>
              <div className="space-y-2">
                {aulasDoCurso.map((aula, index) => {
                  const isCompleted = progresso?.modulosCompletos?.includes(aula.moduloId);
                  const isCurrent = index === currentAulaIndex;

                  return (
                    <button
                      key={aula.id}
                      onClick={() => setCurrentAulaIndex(index)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isCurrent
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : isCurrent ? (
                          <PlayCircle className="w-5 h-5 text-primary" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-primary' : 'text-foreground'
                        }`}>
                          {index + 1}. {aula.titulo}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDuracao(aula.duracao)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
