import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronDown,
  Heart,
  Info,
  Target,
  Star,
  Trophy,
  Flame,
  Gem,
  BookOpen,
  GraduationCap,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Avatar,
  Badge,
  EmptyState,
  Leaderboard,
  AchievementGrid,
  AchievementSummary,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/design-system';
import { PontosItem } from './components/PontosItem';
import { formatData, CREDIT_TYPE_LABELS } from './data/educacaoUtils';
import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';

// Mapa de ícone string -> componente Lucide
const ICON_MAP = {
  target: <Target className="w-full h-full" />,
  star: <Star className="w-full h-full" />,
  trophy: <Trophy className="w-full h-full" />,
  flame: <Flame className="w-full h-full" />,
  gem: <Gem className="w-full h-full" />,
  'book-open': <BookOpen className="w-full h-full" />,
  'graduation-cap': <GraduationCap className="w-full h-full" />,
  clock: <Clock className="w-full h-full" />,
};

export default function PontosPage({ onNavigate, goBack }) {
  const { user } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { cursos, useMock } = useEducacaoData();
  const [progressos, setProgressos] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardFilter, setLeaderboardFilter] = useState('all');
  const [estatisticas, setEstatisticas] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load progress
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
    return () => { cancelled = true; };
  }, [useMock, userId]);

  // Load leaderboard
  useEffect(() => {
    let cancelled = false;
    if (useMock) {
      setLeaderboardData([]);
      return undefined;
    }
    (async () => {
      const { ranking } = await educacaoService.getRankingUsuarios(null, 10);
      if (!cancelled) setLeaderboardData(ranking || []);
    })().catch(() => {
      if (!cancelled) setLeaderboardData([]);
    });
    return () => { cancelled = true; };
  }, [useMock, reloadKey]);

  // Load user stats (for streak)
  useEffect(() => {
    let cancelled = false;
    if (useMock || !userId || userId === 'system') return undefined;
    (async () => {
      const { estatisticas: stats } = await educacaoService.getEstatisticasUsuario(userId);
      if (!cancelled) setEstatisticas(stats);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [useMock, userId]);

  // Register daily activity on page visit
  useEffect(() => {
    if (useMock || !userId || userId === 'system') return;
    educacaoService.registrarAtividadeDiaria(userId).catch(() => {});
  }, [useMock, userId]);

  // Reparar estatísticas retroativamente (uma vez por sessão)
  const repairedRef = useRef(false);
  useEffect(() => {
    if (repairedRef.current || useMock || !userId || userId === 'system') return;
    if (!progressos.length || !cursos?.length) return;
    const concluidos = progressos.filter(p => p.status === 'concluido');
    if (concluidos.length === 0) return;
    // Verificar se stats já tem totalPontos correto
    const statsTotal = estatisticas?.totalPontos || 0;
    const statsCursos = estatisticas?.totalCursosCompletos || 0;
    if (statsTotal > 0 && statsCursos === concluidos.length) return;
    // Precisa reparo
    repairedRef.current = true;
    educacaoService.repararEstatisticasUsuario(userId, progressos, cursos)
      .then(() => setReloadKey(k => k + 1))
      .catch(() => {});
  }, [progressos, cursos, estatisticas, useMock, userId]);

  const userName = user?.displayName || 'Usuario';
  const userEmail = user?.email || 'email@exemplo.com';
  const nameParts = userName.trim().split(/\s+/);
  const userInitials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : userName.substring(0, 2).toUpperCase();

  // Get cursos concluidos com pontos
  const pontosExtrato = useMemo(() => {
    const cursosConcluidosIds = progressos
      .filter(p => p.status === 'concluido')
      .map(p => p.cursoId);

    return (cursos || [])
      .filter(c => cursosConcluidosIds.includes(c.id))
      .map(c => {
        const progresso = progressos.find(p => p.cursoId === c.id);
        const pontosBase = progresso?.pontos || c.pontosAoCompletar || 2.0;
        const bonus = educacaoService.calcularBonusPontos(
          pontosBase,
          progresso?.notaQuiz || 0,
          progresso?.dataConclusao,
          c.dataLimite
        );
        return {
          id: c.id,
          cursoTitulo: c.titulo,
          pontos: pontosBase + bonus,
          pontosBase,
          bonus,
          dataConclusao: progresso?.dataConclusao,
          tipoCreditoEducacao: c.tipoCreditoEducacao || 'geral',
          creditosHoras: c.creditosHoras || null,
        };
      });
  }, [cursos, progressos]);

  const cursosCompletados = pontosExtrato.length;
  const pontosCursos = pontosExtrato.reduce((sum, p) => sum + p.pontos, 0);

  // Group credit hours by type
  const creditosPorTipo = useMemo(() => {
    const map = {};
    pontosExtrato.forEach(item => {
      const tipo = item.tipoCreditoEducacao || 'geral';
      if (!map[tipo]) map[tipo] = { horas: 0, count: 0 };
      map[tipo].horas += item.creditosHoras || 0;
      map[tipo].count += 1;
    });
    return map;
  }, [pontosExtrato]);

  const temCreditos = Object.values(creditosPorTipo).some(v => v.horas > 0);

  // Compute badges
  const badges = useMemo(() => {
    const computed = educacaoService.getUserBadges(progressos, cursos || [], []);
    // Check streak_7 from stats
    return computed.map(b => {
      if (b.id === 'streak_7' && (estatisticas?.melhorStreak || 0) >= 7) {
        return { ...b, unlocked: true };
      }
      return b;
    });
  }, [progressos, cursos, estatisticas]);

  // Achievement data formatted for DS AchievementGrid
  const achievementData = useMemo(() => {
    return badges.map(b => ({
      id: b.id,
      title: b.titulo,
      description: b.descricao,
      icon: ICON_MAP[b.icone] || ICON_MAP.star,
      tier: b.tier || 'gold',
      unlocked: b.unlocked,
      unlockedAt: b.unlockedAt,
      points: b.pontos,
    }));
  }, [badges]);

  const badgesUnlocked = badges.filter(b => b.unlocked).length;
  const badgesTotal = badges.length;
  const badgesPoints = badges.filter(b => b.unlocked).reduce((sum, b) => sum + (b.pontos || 0), 0);

  // Pontos = somente cursos (ranking e extrato usam esse valor)
  const pontosTotais = pontosCursos;

  // Leaderboard entries formatted for DS Leaderboard
  const leaderboardEntries = useMemo(() => {
    return leaderboardData.map(entry => ({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      subtitle: `${entry.cursosCompletos || 0} cursos`,
    }));
  }, [leaderboardData]);

  const streak = estatisticas?.streak || 0;

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
            Extrato de Pontos
          </h1>
          <div className="min-w-[70px] flex justify-end" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 space-y-4">
        {/* User Summary Card */}
        <Card>
          <CardContent className="p-5">
            {/* User Info */}
            <div className="flex items-center gap-4 pb-5 border-b border-border">
              <Avatar size="lg" src={user?.photoURL || user?.avatar} initials={userInitials} />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {userName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {userEmail}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 pt-5">
              <div className="text-center">
                <span className="text-3xl font-bold text-foreground">
                  {cursosCompletados}
                </span>
                <p className="text-sm text-muted-foreground">cursos</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <span className="text-3xl font-bold text-success">
                  {pontosTotais.toFixed(0)}
                </span>
                <p className="text-sm text-muted-foreground">pontos</p>
              </div>
              {streak > 0 && (
                <>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-5 h-5 text-orange-500" />
                      <span className="text-3xl font-bold text-orange-500">
                        {streak}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">dias</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Achievements Summary + Grid */}
        <AchievementSummary
          total={badgesTotal}
          unlocked={badgesUnlocked}
          points={badgesPoints}
        />

        <AchievementGrid
          achievements={achievementData}
          columns={1}
          showLocked
        />

        {/* Leaderboard */}
        <Leaderboard
          entries={leaderboardEntries}
          currentUserId={userId}
          title="Ranking"
          showPodium={leaderboardEntries.length >= 3}
          maxVisible={10}
          filters={['month', 'all']}
          defaultFilter={leaderboardFilter}
          onFilterChange={setLeaderboardFilter}
        />

        {/* Credit Hours by Type */}
        {temCreditos && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                Horas por tipo de credito
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(creditosPorTipo)
                  .filter(([, v]) => v.horas > 0)
                  .map(([tipo, data]) => (
                    <div key={tipo} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
                          {CREDIT_TYPE_LABELS[tipo] || tipo}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{data.count} curso(s)</p>
                      </div>
                      <span className="text-lg font-bold text-foreground">{data.horas}h</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pontos List */}
        <Card>
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-3 border-b border-border mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Curso
              </span>
              <Heart className="w-4 h-4 text-success" fill="currentColor" />
            </div>

            {pontosExtrato.length === 0 ? (
              <EmptyState
                icon={<Heart className="w-12 h-12" />}
                title="Nenhum ponto conquistado"
                description="Complete cursos para acumular pontos"
                compact
              />
            ) : (
              <div className="space-y-3">
                {pontosExtrato.map(item => (
                  <PontosItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card — Collapsible */}
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full p-4 flex items-center justify-between text-left group">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  Como funcionam os pontos?
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-aria-[expanded=true]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 pt-0 space-y-4 text-sm text-muted-foreground">
                <div className="h-px bg-border -mt-1 mb-3" />

                <div className="flex gap-3">
                  <BookOpen className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Pontos de curso</span>
                    <p className="mt-0.5">Ao concluir um curso, você recebe pontos baseados na carga horária. Esses são os pontos que aparecem no seu perfil e no ranking.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Target className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Bônus de desempenho</span>
                    <p className="mt-0.5">Tirou mais de 90% no quiz? Você ganha +20% de pontos no curso. Concluiu antes do prazo? Mais +10%. Os bônus são somados aos pontos do curso.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Trophy className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Conquistas e pontos bônus</span>
                    <p className="mt-0.5">Badges são medalhas que você coleciona ao atingir marcos — ex: completar 5 cursos, manter uma sequência de 7 dias. Cada badge vale pontos bônus (em amarelo), que são separados dos pontos de curso e <strong>não afetam o ranking</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Flame className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">Sequência diária (dias)</span>
                    <p className="mt-0.5">O número ao lado do fogo no seu perfil mostra quantos dias seguidos você acessou a plataforma. Por exemplo, "2 dias" significa que você entrou ontem e hoje. Se você pular um dia, a sequência volta a zero. Mantenha a sequência para desbloquear badges especiais!</p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Resumo:</strong> Pontos de curso (verde) = ranking. Pontos bônus de conquistas (amarelo) = colecionáveis, não afetam o ranking.
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
