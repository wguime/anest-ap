import { useState, useMemo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, GitBranch, Bell, Filter, Award, Heart, BookOpen, User, LogOut, Settings, ClipboardList, AlertTriangle, AlertCircle, Clock, Trophy, Flame } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, Card, CardContent, SearchBar, EmptyState, Avatar, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator, Badge, SearchToggleButton, Collapsible, CollapsibleContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/design-system';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/design-system/utils/tokens';
import { CursoCard } from './components/CursoCard';
import { EducacaoSearchPanel } from './components/EducacaoSearchPanel';
import { useRecomendacoes } from './hooks/useRecomendacoes';
import { CursoFiltros } from './components/CursoFiltros';
import { TrilhaFiltros } from './components/TrilhaFiltros';
import { TrilhaCard } from './components/TrilhaCard';
import { ResumeHeroCard } from './components/ResumeHeroCard';
import { mockCategorias } from './data/educacaoUtils';
import { canManageContent } from '@/utils/userTypes';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { getUserId } from '@/utils/userIdContext';

export default function EducacaoContinuadaPage({ onNavigate, goBack }) {
  const { user, logout } = useUser();
  const userId = getUserId(user);
  const {
    cursos,
    trilhas,
    trilhaCursosRel,
    useMock,
    _loading,
    aulas,
    modulos,
    cursoModulosRel,
    moduloAulasRel,
  } = useEducacaoData();
  const [activeTab, setActiveTab] = useState('cursos');
  const [showFiltros, setShowFiltros] = useState(false);
  const [showFiltrosTrilhas, setShowFiltrosTrilhas] = useState(false);
  const [filtros, setFiltros] = useState({
    busca: '',
    agruparPor: 'categoria',
    categorias: ['sem-categoria'],
    status: ['nao_iniciado', 'em_andamento', 'concluido'],
    apenasObrigatorios: false,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPanelId = useId();

  const closeSearch = () => {
    setSearchOpen(false);
    setFiltros((prev) => ({ ...prev, busca: '' }));
  };

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-slot="anest-search-bar-input"]');
      el?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const [filtrosTrilhas, setFiltrosTrilhas] = useState({
    busca: '',
    status: ['em_andamento', 'nao_iniciada', 'encerrada', 'expirada'],
    comNovoConteudo: false,
    apenasObrigatorias: false,
  });

  const [progressos, setProgressos] = useState([]);
  const [resumeLesson, setResumeLesson] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (useMock) {
      setProgressos([]);
      setResumeLesson(null);
      return undefined;
    }

    (async () => {
      const { progressos: data } = await educacaoService.getProgressoUsuario(userId);
      if (!cancelled) setProgressos(data || []);
      const { resume } = await educacaoService.getResumeLesson(userId);
      if (!cancelled) setResumeLesson(resume || null);
    })().catch(() => {
      if (!cancelled) {
        setProgressos([]);
        setResumeLesson(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [useMock, userId]);

  // Notificações de prazo desativadas (dados legacy de Onboarding geravam
  // alertas de "atrasado 468d" sem contexto real). Tab + empty state mantidos.
  const notificacoes = [];
  const notificacaoCount = 0;

  // Helper para iniciais do usuário
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  // Atalhos de admin (apenas em DEV)
  useEffect(() => {
    if (!canManageContent(user) || !import.meta.env.DEV) return;

    const handleKeyDown = (event) => {
      const key = event.key?.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === 'g') {
        event.preventDefault();
        onNavigate?.('adminConteudo');
      }
      if (event.ctrlKey && event.shiftKey && key === 'r') {
        event.preventDefault();
        onNavigate?.('controleEducacao');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, user]);

  const isCursoVisivelParaUsuario = useMemo(() => {
    const cursosComTrilha = new Set(
      (trilhaCursosRel || []).map(r => r.cursoId)
    );
    return (curso) => {
      if (!educacaoService.isEntityAccessible(curso)) return false;
      return cursosComTrilha.has(curso.id);
    };
  }, [trilhaCursosRel]);

  const isTrilhaVisivelParaUsuario = useMemo(() => {
    return (trilha) => educacaoService.isEntityAccessible(trilha);
  }, []);

  // Combine cursos with progress
  const cursosComProgresso = useMemo(() => {
    const cursosVisiveis = (cursos || []).filter(isCursoVisivelParaUsuario);
    return cursosVisiveis.map(curso => {
      const progresso = (progressos || []).find(p => p.cursoId === curso.id);
      return {
        ...curso,
        progresso: progresso?.progresso || 0,
        status: progresso?.status || 'nao_iniciado',
        progressoId: progresso?.id || null,
        modulosCompletos: progresso?.modulosCompletos || [],
        dataInicio: progresso?.dataInicio || null,
        dataConclusao: progresso?.dataConclusao || null,
        pontos: progresso?.pontos || curso.pontosAoCompletar || 0,
      };
    });
  }, [cursos, isCursoVisivelParaUsuario, progressos]);

  // Filter cursos
  // T1.5.6 — Quick filter chips por progresso pessoal
  // Visibilidade por cargo já é automática via effectiveVisibility/effectiveAllowedUserTypes
  // (filtragem em isCursoVisivelParaUsuario + isEntityAccessible) — chips são só sobre status.

  // T1.5.9 — Recomendado para você (3-4 cursos com base em progresso + obrigatórios + novidade)
  const recomendados = useRecomendacoes({
    cursosComProgresso,
    trilhaCursosRel,
    progressos,
    limit: 3,
  });

  const cursosFiltrados = useMemo(() => {
    let resultado = cursosComProgresso;

    // Filter by search
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(c =>
        c.titulo.toLowerCase().includes(busca) ||
        (c.descricao || '').toLowerCase().includes(busca)
      );
    }

    // Filter by status
    if (filtros.status.length > 0) {
      resultado = resultado.filter(c => filtros.status.includes(c.status));
    }

    // Filter by mandatory
    if (filtros.apenasObrigatorios) {
      resultado = resultado.filter(c => c.obrigatorio);
    }

    return resultado;
  }, [cursosComProgresso, filtros]);

  // Group cursos by status
  const cursosPorStatus = useMemo(() => {
    return {
      em_andamento: cursosFiltrados.filter(c => c.status === 'em_andamento'),
      nao_iniciado: cursosFiltrados.filter(c => c.status === 'nao_iniciado'),
      concluido: cursosFiltrados.filter(c => c.status === 'concluido'),
    };
  }, [cursosFiltrados]);

  // Group cursos by categoria (real grouping replacing hardcoded "Sem categoria")
  const cursosPorCategoria = useMemo(() => {
    const grupos = new Map();
    const statusOrder = { em_andamento: 0, nao_iniciado: 1, concluido: 2 };
    const ordered = [...cursosFiltrados].sort(
      (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    );
    for (const curso of ordered) {
      const catId = curso.categoria || curso.categoriaId || 'sem-categoria';
      if (!grupos.has(catId)) grupos.set(catId, []);
      grupos.get(catId).push(curso);
    }
    const nomePorId = Object.fromEntries(
      mockCategorias.map((c) => [c.id, c.nome])
    );
    return Array.from(grupos.entries()).map(([id, lista]) => ({
      id,
      nome: nomePorId[id] || 'Sem categoria',
      cursos: lista,
    }));
  }, [cursosFiltrados]);

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    nao_iniciado: cursosComProgresso.filter(c => c.status === 'nao_iniciado').length,
    em_andamento: cursosComProgresso.filter(c => c.status === 'em_andamento').length,
    concluido: cursosComProgresso.filter(c => c.status === 'concluido').length,
    aprovado: 0,
    reprovado: 0,
    expirado: 0,
  }), [cursosComProgresso]);

  // Calculate total points (same logic as PontosPage)
  const pontosTotais = useMemo(() => {
    return cursosComProgresso
      .filter(c => c.status === 'concluido')
      .reduce((sum, c) => {
        const progresso = (progressos || []).find(p => p.cursoId === c.id);
        const pontosBase = progresso?.pontos || c.pontosAoCompletar || 2.0;
        const bonus = educacaoService.calcularBonusPontos(
          pontosBase,
          progresso?.notaQuiz || 0,
          progresso?.dataConclusao,
          c.dataLimite
        );
        return sum + pontosBase + bonus;
      }, 0);
  }, [cursosComProgresso, progressos]);

  // Badges count
  const badgesEarned = useMemo(() => {
    const badges = educacaoService.getUserBadges(progressos, cursos || [], []);
    return badges.filter(b => b.unlocked).length;
  }, [progressos, cursos]);

  const badgesTotal = educacaoService.BADGE_DEFINITIONS.length;

  // User stats (streak)
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (useMock || !userId || userId === 'system') return undefined;
    (async () => {
      const { estatisticas: stats } = await educacaoService.getEstatisticasUsuario(userId);
      if (!cancelled) setUserStats(stats);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [useMock, userId]);

  // Certificate count (from Firestore)
  const [_certificadosCount, setCertificadosCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (useMock || !userId || userId === 'system') {
      setCertificadosCount(0);
      return undefined;
    }

    (async () => {
      const { certificados } = await educacaoService.getCertificados(userId);
      if (!cancelled) setCertificadosCount((certificados || []).filter(c => c.emitido).length);
    })().catch(() => {
      if (!cancelled) setCertificadosCount(0);
    });

    return () => { cancelled = true; };
  }, [useMock, userId]);

  const handleCursoClick = (curso) => {
    // Navega para o player de aula (inclui opção de certificado se concluído)
    onNavigate?.('cursoDetalhe', { cursoId: curso.id });
  };

  const handleTrilhaClick = (trilha) => onNavigate?.('trilhaDetalhe', { trilhaId: trilha.id });

  const handleAplicarFiltros = (novosFiltros) => {
    setFiltros(novosFiltros);
    setShowFiltros(false);
  };

  const handleAplicarFiltrosTrilhas = (novosFiltros) => {
    setFiltrosTrilhas(novosFiltros);
    setShowFiltrosTrilhas(false);
  };

  // Header element
  const headerElement = (
    <nav
      aria-label="Cabeçalho da página"
      className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm"
    >
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Educação Continuada
          </h1>
          <div className="flex items-center justify-end gap-2">
            {activeTab === 'cursos' && (
              <SearchToggleButton
                size="sm"
                active={searchOpen}
                onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
                controlsId={searchPanelId}
                aria-label={searchOpen ? 'Fechar busca' : 'Abrir busca de treinamentos'}
              />
            )}
            <DropdownMenu>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu do usuário"
                  className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
                >
                  <Avatar
                    size="sm"
                    src={user?.avatar}
                    initials={userInitials}
                    alt={user?.firstName || 'Usuário'}
                  />
                  {/* Badge de notificações */}
                  {notificacaoCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notificacaoCount > 9 ? '9+' : notificacaoCount}
                    </span>
                  )}
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem
                  icon={<User className="w-4 h-4" />}
                  onClick={() => onNavigate?.('profile')}
                >
                  Gerenciar Conta
                </DropdownItem>
                <DropdownItem
                  icon={<Bell className="w-4 h-4" />}
                  onClick={() => setActiveTab('notificacoes')}
                >
                  Notificações
                </DropdownItem>
                <DropdownItem
                  icon={<Award className="w-4 h-4" />}
                  onClick={() => onNavigate?.('certificados')}
                >
                  Certificados
                </DropdownItem>
                <DropdownItem
                  icon={<Heart className="w-4 h-4" />}
                  onClick={() => onNavigate?.('pontos')}
                >
                  Extrato de pontos
                </DropdownItem>
                {canManageContent(user) && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem
                      icon={<Settings className="w-4 h-4" />}
                      onClick={() => onNavigate?.('adminConteudo')}
                    >
                      Gestão de Conteúdo
                    </DropdownItem>
                    <DropdownItem
                      icon={<ClipboardList className="w-4 h-4" />}
                      onClick={() => onNavigate?.('controleEducacao')}
                    >
                      Controle de Educação
                    </DropdownItem>
                  </>
                )}
                <DropdownSeparator />
                <DropdownItem
                  icon={<LogOut className="w-4 h-4" />}
                  onClick={logout}
                  destructive
                >
                  Sair
                </DropdownItem>
              </DropdownContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      {/* Search bar (controlada pela lupa do header — só visível em Treinamentos) */}
      {activeTab === 'cursos' && (
        <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
          <CollapsibleContent>
            <div id={searchPanelId} className="px-4 pt-3 space-y-3">
              <SearchBar
                value={filtros.busca}
                onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                placeholder="Buscar trilhas, cursos, módulos ou aulas..."
                className="mb-0"
              />
              {/* T1.5.8 — Painel de resultados unificado (fuse.js client-side) */}
              <EducacaoSearchPanel
                query={filtros.busca}
                trilhas={trilhas}
                cursos={cursos}
                modulos={modulos}
                aulas={aulas}
                onNavigate={onNavigate}
                onClose={closeSearch}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tabs using Design System */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <TabsList className="bg-card border-b border-border">
          <TabsTrigger value="cursos">
            Treinamentos
          </TabsTrigger>
          <TabsTrigger value="trilhas">
            Trilhas
          </TabsTrigger>
          <TabsTrigger value="notificacoes">
            Notificações
            {notificacaoCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-destructive rounded-full">
                {notificacaoCount > 9 ? '9+' : notificacaoCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Cursos */}
        <TabsContent value="cursos" className="px-4 pt-4">
          <div className="space-y-4">
            {/* Continue de onde parou (Wave 1.2 T1.2.3) */}
            {resumeLesson && (resumeLesson.progressoCurso ?? 0) < 100 && (
              <ResumeHeroCard
                resume={resumeLesson}
                cursos={cursos}
                aulas={aulas}
                modulos={modulos}
                cursoModulosRel={cursoModulosRel}
                moduloAulasRel={moduloAulasRel}
                onContinuar={({ cursoId, moduloId, aulaId }) => {
                  onNavigate?.('aulaPlayer', { cursoId, moduloId, aulaId });
                }}
              />
            )}

            {/* Gamification Stats Bar */}
            <button
              type="button"
              onClick={() => onNavigate?.('pontos')}
              className="w-full"
            >
              <Card className="bg-gradient-to-r from-primary/5 to-success/5 border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-success" fill="currentColor" aria-hidden="true" />
                        <span className="text-sm font-bold text-foreground">{pontosTotais.toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-warning" aria-hidden="true" />
                        <span className="text-sm font-bold text-foreground">{badgesEarned}/{badgesTotal}</span>
                      </div>
                      {(userStats?.streak || 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-category-orange" aria-hidden="true" />
                          <span className="text-sm font-bold text-category-orange">{userStats.streak}d</span>
                        </div>
                      )}
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* T1.5.6 — Quick filter chips por progresso pessoal */}
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 [&>*]:shrink-0">
              {(() => {
                const STATUS_CHIPS = [
                  { key: 'em_andamento', label: 'Em andamento' },
                  { key: 'nao_iniciado', label: 'Não iniciados' },
                ];
                // "Concluídos" mora dentro do botão "Mais" para preservar a linha única.
                const ALL_STATUS = ['nao_iniciado', 'em_andamento', 'concluido'];
                const allStatusActive = ALL_STATUS.every((s) => filtros.status.includes(s));
                const toggleStatus = (key) => {
                  setFiltros((p) => {
                    // Estado "default" (todos selecionados) → clicar isola só o clicado
                    if (allStatusActive) return { ...p, status: [key] };
                    const has = p.status.includes(key);
                    const next = has
                      ? p.status.filter((s) => s !== key)
                      : [...p.status, key];
                    // Se ninguém ficou, volta pro default (todos)
                    return {
                      ...p,
                      status: next.length === 0 ? ALL_STATUS : next,
                    };
                  });
                };
                const isStatusChipActive = (key) =>
                  !allStatusActive && filtros.status.includes(key);
                const chipObrigatorios = !!filtros.apenasObrigatorios;
                return (
                  <>
                    {STATUS_CHIPS.map((chip) => (
                      <Button
                        key={chip.key}
                        size="sm"
                        variant={isStatusChipActive(chip.key) ? 'default' : 'outline'}
                        aria-pressed={isStatusChipActive(chip.key)}
                        onClick={() => toggleStatus(chip.key)}
                      >
                        {chip.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={chipObrigatorios ? 'default' : 'outline'}
                      aria-pressed={chipObrigatorios}
                      onClick={() => setFiltros((p) => ({ ...p, apenasObrigatorios: !p.apenasObrigatorios }))}
                    >
                      Obrigatórios
                    </Button>
                  </>
                );
              })()}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFiltros(true)}
                leftIcon={<Filter className="w-4 h-4" />}
                aria-label="Abrir filtros avançados de cursos"
              >
                Mais
              </Button>
            </div>

            {/* Continue aprendendo */}
            {cursosPorStatus.em_andamento.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Continue aprendendo</span>
                  <span className="text-xs text-muted-foreground">
                    {cursosPorStatus.em_andamento.length} em andamento
                  </span>
                </div>
                <div className="space-y-3">
                  {cursosPorStatus.em_andamento.slice(0, 3).map(curso => (
                    <CursoCard
                      key={curso.id}
                      curso={curso}
                      onClick={() => handleCursoClick(curso)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* T1.5.9 — Recomendado para você (hook client-side) */}
            {recomendados.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Recomendado para você</span>
                  <span className="text-xs text-muted-foreground">
                    com base no seu progresso
                  </span>
                </div>
                <div className="space-y-3">
                  {recomendados.map((curso) => (
                    <CursoCard
                      key={`rec-${curso.id}`}
                      curso={curso}
                      onClick={() => handleCursoClick(curso)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cursos agrupados por categoria (DS Accordion) */}
            {cursosFiltrados.length === 0 ? (() => {
              const ALL_STATUS = ['nao_iniciado', 'em_andamento', 'concluido'];
              const statusFiltrado = !ALL_STATUS.every((s) => filtros.status.includes(s));
              const temFiltroAtivo = !!(filtros.busca || filtros.apenasObrigatorios || statusFiltrado);
              return (
                <EmptyState
                  icon={<BookOpen className="w-12 h-12" />}
                  title="Nenhum curso encontrado"
                  description={
                    temFiltroAtivo
                      ? 'Tente remover alguns filtros ativos para ver mais cursos.'
                      : 'Ainda não há cursos disponíveis para o seu cargo. Explore as trilhas para começar.'
                  }
                  action={
                    temFiltroAtivo
                      ? {
                          label: 'Limpar filtros',
                          onClick: () => {
                            setFiltros({
                              busca: '',
                              agruparPor: 'categoria',
                              categorias: ['sem-categoria'],
                              status: ALL_STATUS,
                              apenasObrigatorios: false,
                            });
                          },
                        }
                      : {
                          label: 'Ver trilhas',
                          onClick: () => setActiveTab('trilhas'),
                        }
                  }
                />
              );
            })() : (
              <Accordion
                type="multiple"
                defaultValue={cursosPorCategoria.map((g) => g.id)}
              >
                {cursosPorCategoria.map((grupo) => (
                  <AccordionItem key={grupo.id} value={grupo.id}>
                    <AccordionTrigger>
                      <span className="text-sm font-semibold text-foreground">
                        {grupo.nome} ({grupo.cursos.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-1">
                        {grupo.cursos.map((curso) => (
                          <CursoCard
                            key={curso.id}
                            curso={curso}
                            onClick={() => handleCursoClick(curso)}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

        {/* Tab: Trilhas */}
        <TabsContent value="trilhas" className="px-4 pt-4">
          <div className="space-y-4">
            {/* Filter Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFiltrosTrilhas(true)}
              leftIcon={<Filter className="w-4 h-4" />}
            >
              Filtrar trilhas
            </Button>

            {(trilhas || []).filter(isTrilhaVisivelParaUsuario).length > 0 ? (
              <div className="space-y-3">
                {(trilhas || [])
                  .filter(isTrilhaVisivelParaUsuario)
                  .map((trilha) => (
                  <TrilhaCard
                    key={trilha.id}
                    trilha={trilha}
                    userId={userId}
                    onClick={() => handleTrilhaClick(trilha)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<GitBranch className="w-16 h-16" />}
                title="Nenhuma trilha disponível"
                description="As trilhas guiam você num percurso completo. Enquanto isso, explore os cursos avulsos."
                action={{
                  label: 'Explorar cursos',
                  onClick: () => setActiveTab('cursos'),
                }}
              />
            )}
          </div>
        </TabsContent>

        {/* Tab: Notificações */}
        <TabsContent value="notificacoes" className="px-4 pt-4">
          {notificacoes.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-16 h-16" />}
              title="Nenhuma notificação"
              description="Você será notificado sobre prazos e novos conteúdos. Que tal explorar agora?"
              action={{
                label: 'Explorar cursos',
                onClick: () => setActiveTab('cursos'),
              }}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {notificacoes.length} {notificacoes.length === 1 ? 'notificação' : 'notificações'} de prazo
              </p>
              {notificacoes.map((notif, idx) => (
                <Card
                  key={`${notif.cursoId}-${notif.trilhaId}-${idx}`}
                  className={cn(
                    'border-l-4',
                    notif.tipo === 'error'
                      ? 'border-l-destructive bg-destructive/5'
                      : 'border-l-warning bg-warning/5'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        notif.tipo === 'error' ? 'bg-destructive/10' : 'bg-warning/10'
                      )}>
                        {notif.tipo === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          {notif.mensagem}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={notif.tipo === 'error' ? 'destructive' : 'warning'}
                            badgeStyle="subtle"
                            className="text-[10px]"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {notif.tipo === 'error'
                              ? `Atrasado ${Math.abs(notif.diasRestantes)}d`
                              : notif.diasRestantes === 0
                                ? 'Vence hoje'
                                : `${notif.diasRestantes}d restantes`
                            }
                          </Badge>
                          {notif.dataLimite && (
                            <span className="text-[10px] text-muted-foreground">
                              Prazo: {notif.dataLimite.toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNavigate?.('cursoDetalhe', { cursoId: notif.cursoId })}
                      >
                        Ver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Filter Modal - Cursos */}
      <CursoFiltros
        show={showFiltros}
        filtros={filtros}
        categorias={mockCategorias}
        statusCounts={statusCounts}
        onClose={() => setShowFiltros(false)}
        onAplicar={handleAplicarFiltros}
      />

      {/* Filter Modal - Trilhas */}
      <TrilhaFiltros
        show={showFiltrosTrilhas}
        filtros={filtrosTrilhas}
        onClose={() => setShowFiltrosTrilhas(false)}
        onAplicar={handleAplicarFiltrosTrilhas}
      />
    </div>
  );
}
