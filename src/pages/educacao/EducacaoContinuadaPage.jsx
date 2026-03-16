import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronDown,
  GitBranch,
  Bell,
  Filter,
  Award,
  Heart,
  BookOpen,
  User,
  LogOut,
  Settings,
  ClipboardList,
  AlertTriangle,
  AlertCircle,
  Clock,
  Trophy,
  Flame,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Card,
  CardContent,
  Input,
  SearchBar,
  EmptyState,
  Avatar,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  Badge,
  Alert,
} from '@/design-system';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/design-system/utils/tokens';
import { CursoCard } from './components/CursoCard';
import { CursoFiltros } from './components/CursoFiltros';
import { TrilhaFiltros } from './components/TrilhaFiltros';
import { TrilhaCard } from './components/TrilhaCard';
import { mockCategorias, calcularDiasRestantes } from './data/educacaoUtils';
import { canManageContent } from '@/utils/userTypes';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { gerarNotificacoesEducacao } from '@/services/notificacaoEducacaoService';

export default function EducacaoContinuadaPage({ onNavigate, goBack }) {
  const { user, logout } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { cursos, trilhas, trilhaCursosRel, useMock, loading } = useEducacaoData();
  const [activeTab, setActiveTab] = useState('cursos');
  const [showFiltros, setShowFiltros] = useState(false);
  const [showFiltrosTrilhas, setShowFiltrosTrilhas] = useState(false);
  const [showCategoria, setShowCategoria] = useState(true);
  const [filtros, setFiltros] = useState({
    busca: '',
    agruparPor: 'categoria',
    categorias: ['sem-categoria'],
    status: ['nao_iniciado', 'em_andamento', 'concluido'],
    apenasObrigatorios: false,
  });
  const [filtrosTrilhas, setFiltrosTrilhas] = useState({
    busca: '',
    status: ['em_andamento', 'nao_iniciada', 'encerrada', 'expirada'],
    comNovoConteudo: false,
    apenasObrigatorias: false,
  });

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

  // Notificações de prazo
  const notificacoes = useMemo(() => {
    if (!trilhas?.length || !cursos?.length) return [];
    return gerarNotificacoesEducacao({
      trilhas,
      cursos,
      progressos,
      userId,
      userProfile: user,
    });
  }, [trilhas, cursos, progressos, userId, user]);

  const notificacaoCount = notificacoes.length;

  // Qmentum Q1: Alertas de treinamentos obrigatorios (overdue, <30d, <90d)
  const alertasObrigatorios = useMemo(() => {
    if (!trilhas?.length || !cursos?.length) return [];
    const alertas = [];
    const progressoMap = new Map(
      (progressos || []).map((p) => [p.cursoId || p.id, p])
    );

    (trilhas || []).forEach((trilha) => {
      if (!trilha.obrigatoria || !trilha.prazoConclusao) return;
      if (trilha.ativo === false) return;

      const dataAdmissao = trilha.isOrientacao ? user?.dataAdmissao : null;
      const dataBase = dataAdmissao || trilha.createdAt;

      (trilha.cursos || []).forEach((cursoId) => {
        const curso = cursos.find((c) => c.id === cursoId);
        if (!curso) return;
        const prog = progressoMap.get(cursoId);
        if ((prog?.progresso || 0) >= 100) return;

        const dias = calcularDiasRestantes(dataBase, trilha.prazoConclusao);
        if (dias === null) return;

        if (dias < 0) {
          alertas.push({ tipo: 'error', titulo: curso.titulo, trilha: trilha.titulo, dias, cursoId });
        } else if (dias <= 30) {
          alertas.push({ tipo: 'warning', titulo: curso.titulo, trilha: trilha.titulo, dias, cursoId });
        } else if (dias <= 90) {
          alertas.push({ tipo: 'info', titulo: curso.titulo, trilha: trilha.titulo, dias, cursoId });
        }
      });
    });

    // Ordenar: erros primeiro, depois por dias
    alertas.sort((a, b) => {
      const ord = { error: 0, warning: 1, info: 2 };
      if (ord[a.tipo] !== ord[b.tipo]) return ord[a.tipo] - ord[b.tipo];
      return a.dias - b.dias;
    });
    return alertas;
  }, [trilhas, cursos, progressos, user]);

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
  const [certificadosCount, setCertificadosCount] = useState(0);

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
            Educação Continuada
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <DropdownMenu>
              <DropdownTrigger asChild>
                <button className="relative">
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
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      {/* Qmentum Q1: Alertas de treinamentos obrigatorios */}
      {alertasObrigatorios.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {alertasObrigatorios.map((alerta) => (
            <Alert
              key={`${alerta.cursoId}-${alerta.tipo}`}
              variant={alerta.tipo}
              icon={<AlertTriangle className="w-5 h-5" />}
              action={{
                label: 'Ver',
                onClick: () => onNavigate?.('cursoDetalhe', { cursoId: alerta.cursoId }),
              }}
            >
              {alerta.dias < 0
                ? `Treinamento obrigatorio "${alerta.titulo}" esta atrasado por ${Math.abs(alerta.dias)} dia${Math.abs(alerta.dias) !== 1 ? 's' : ''}`
                : alerta.dias === 0
                  ? `Treinamento obrigatorio "${alerta.titulo}" vence hoje`
                  : `Treinamento obrigatorio "${alerta.titulo}" vence em ${alerta.dias} dia${alerta.dias !== 1 ? 's' : ''}`
              }
            </Alert>
          ))}
        </div>
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
                        <Heart className="w-4 h-4 text-success" fill="currentColor" />
                        <span className="text-sm font-bold text-foreground">{pontosTotais.toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-bold text-foreground">{badgesEarned}/{badgesTotal}</span>
                      </div>
                      {(userStats?.streak || 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-bold text-orange-500">{userStats.streak}d</span>
                        </div>
                      )}
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Busca rápida (DS SearchBar) */}
            <SearchBar
              value={filtros.busca}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              placeholder="Buscar treinamentos..."
              className="mb-0"
            />

            {/* Filter Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFiltros(true)}
              leftIcon={<Filter className="w-4 h-4" />}
            >
              Filtrar cursos
            </Button>

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

            {/* Category Header */}
            <Card>
              <button
                onClick={() => setShowCategoria(!showCategoria)}
                className="w-full flex items-center justify-between p-4"
              >
                <span className="text-sm font-semibold text-foreground">
                  Sem categoria ({cursosFiltrados.length})
                </span>
                <ChevronDown className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  showCategoria && "rotate-180"
                )} />
              </button>
            </Card>

            {/* Cursos List */}
            {showCategoria && (
              <div className="space-y-4">
                {/* Em Andamento */}
                {cursosPorStatus.em_andamento.length > 0 && (
                  <div className="space-y-3">
                    {cursosPorStatus.em_andamento.map(curso => (
                      <CursoCard
                        key={curso.id}
                        curso={curso}
                        onClick={() => handleCursoClick(curso)}
                      />
                    ))}
                  </div>
                )}

                {/* Não Iniciados */}
                {cursosPorStatus.nao_iniciado.length > 0 && (
                  <div className="space-y-3">
                    {cursosPorStatus.nao_iniciado.map(curso => (
                      <CursoCard
                        key={curso.id}
                        curso={curso}
                        onClick={() => handleCursoClick(curso)}
                      />
                    ))}
                  </div>
                )}

                {/* Concluídos */}
                {cursosPorStatus.concluido.length > 0 && (
                  <div className="space-y-3">
                    {cursosPorStatus.concluido.map(curso => (
                      <CursoCard
                        key={curso.id}
                        curso={curso}
                        onClick={() => handleCursoClick(curso)}
                      />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {cursosFiltrados.length === 0 && (
                  <EmptyState
                    icon={<BookOpen className="w-12 h-12" />}
                    title="Nenhum curso encontrado"
                    description="Ajuste os filtros para ver mais cursos"
                  />
                )}
              </div>
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
                description="Quando houver trilhas disponíveis, elas aparecerão aqui."
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
              description="Você será notificado sobre novos cursos, prazos e atualizações importantes"
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
