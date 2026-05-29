import { useEffect, useState } from 'react';
import { Leaderboard, Skeleton, Button, useToast } from '@/design-system';
import { Trophy, Medal, Star, ShieldCheck } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import supabaseROPsService from '@/services/supabaseROPsService';
import { PageHeader } from '../../components';
import { formatNumber } from '@/utils/formatters';

const FILTER_TO_PERIOD = { day: 'week', week: 'week', month: 'month', all: 'all' };

const ROLE_LABELS = {
  anestesiologista: 'Anestesiologista',
  'medico-residente': 'Médico Residente',
  enfermeiro: 'Enfermeiro',
  'tec-enfermagem': 'Téc. Enfermagem',
  farmaceutico: 'Farmacêutico',
  colaborador: 'Colaborador',
  secretaria: 'Secretaria',
};

export default function ROPsRankingPage({ goBack, onNavigate }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ position: null, totalCorrect: 0, totalAttempts: 0 });
  const [loading, setLoading] = useState(true);

  // T1.6.12 LGPD: leaderboard só visível com opt-in explícito (profiles.ranking_opt_in)
  // Server-side: get_rops_ranking já filtra users opt-in; aqui bloqueamos a página
  // para users não-opt-in (não devem nem ver as posições alheias).
  const isOptIn = !!user?.rankingOptIn;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const period = FILTER_TO_PERIOD[filter] || 'all';
        const userInfo = user?.id ? { userId: user.id, userName: user.nome, userEmail: user.email } : null;
        // Sempre busca stats pessoais (necessário no gate de privacidade também).
        // Ranking só busca se opt-in.
        const [rankingRaw, userStats] = await Promise.all([
          isOptIn ? supabaseROPsService.getRanking(period) : Promise.resolve([]),
          userInfo
            ? supabaseROPsService.getUserStats(userInfo)
            : Promise.resolve({ position: null, totalCorrect: 0, totalAttempts: 0 }),
        ]);
        if (cancelled) return;
        const formatted = rankingRaw.map((r) => ({
          id: r.id,
          name: r.name,
          score: r.score,
          subtitle: ROLE_LABELS[r.subtitle] || r.subtitle || 'Colaborador',
          quiz_count: r.quizCount,
          rank: r.rank,
          avatar: null,
          trend: 0,
        }));
        setEntries(formatted);
        setStats(userStats);
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsRankingPage] load:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar o ranking.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user?.id, isOptIn]);

  const header = <PageHeader title="Ranking ROPs" onBack={goBack} />;

  // T1.6.12 LGPD: usuários sem opt-in não devem ver lista de colegas
  if (!isOptIn) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {header}
        <div className="px-4 pt-8 sm:px-5 max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-category-teal-bg mx-auto flex items-center justify-center mb-4">
              <ShieldCheck className="w-10 h-10 text-category-teal-fg" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Ranking privado por padrão</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Para proteger sua privacidade, o ranking público só fica visível depois que
              você opta por participar. Suas estatísticas pessoais continuam disponíveis a
              qualquer momento.
            </p>
          </div>

          <div className="p-4 rounded-[16px] bg-card border border-border mb-4">
            <h3 className="text-[13px] font-bold text-primary mb-2">Seu desempenho pessoal</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-[12px] bg-muted">
                <Star className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-[11px] text-muted-foreground">Acertos</p>
                <p className="text-[16px] font-bold text-foreground">{formatNumber(stats.totalCorrect)}</p>
              </div>
              <div className="text-center p-3 rounded-[12px] bg-muted">
                <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-[11px] text-muted-foreground">Tentativas</p>
                <p className="text-[16px] font-bold text-foreground">{formatNumber(stats.totalAttempts)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="default"
              onClick={() => onNavigate?.('perfil')}
              className="w-full min-h-[44px]"
              aria-label="Ir para perfil e ativar participação no ranking"
            >
              Ativar no perfil
            </Button>
            <Button variant="secondary" onClick={goBack} className="w-full min-h-[44px]">
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {header}

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner — tokens DS */}
        <div className="mb-4 p-4 rounded-[16px] bg-category-orange-bg border-l-4 border-category-orange">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-category-orange flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-category-orange-foreground" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-category-orange-fg">
                Ranking dos Campeões
              </h2>
              <p className="text-[13px] text-category-orange-fg/80 mt-0.5">
                Compare sua pontuação com os demais participantes
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards — agora reais */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-[12px] bg-card border border-border text-center">
            <Medal className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-[11px] text-muted-foreground">Sua Posição</p>
            <p className="text-[18px] font-bold text-primary">
              {loading ? '...' : stats.position ? `${stats.position}º` : '—'}
            </p>
          </div>
          <div className="p-3 rounded-[12px] bg-card border border-border text-center">
            <Star className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-[11px] text-muted-foreground">Acertos</p>
            <p className="text-[18px] font-bold text-primary">
              {loading ? '...' : formatNumber(stats.totalCorrect)}
            </p>
          </div>
          <div className="p-3 rounded-[12px] bg-card border border-border text-center">
            <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-[11px] text-muted-foreground">Tentativas</p>
            <p className="text-[18px] font-bold text-primary">
              {loading ? '...' : formatNumber(stats.totalAttempts)}
            </p>
          </div>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] rounded-[12px]" />
            ))}
          </div>
        ) : (
          <Leaderboard
            entries={entries}
            currentUserId={user?.id || null}
            title="Top 50"
            showPodium
            showTrend={false}
            maxVisible={10}
            filters={['week', 'month', 'all']}
            defaultFilter={filter}
            onFilterChange={setFilter}
          />
        )}

        {/* Info Box */}
        <div className="mt-4 p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">
            Como subir no ranking?
          </h3>
          <ul className="space-y-1 text-[12px] text-primary dark:text-muted-foreground">
            <li>• Complete mais quizzes das ROPs</li>
            <li>• Acerte o máximo de questões possível</li>
            <li>• Mantenha consistência nos estudos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
