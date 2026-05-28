import { useEffect, useState } from 'react';
import { WidgetCard, Skeleton, useToast } from '@/design-system';
import { FileQuestion, Headphones } from 'lucide-react';
import podcastsData from '@/data/podcasts-data';
import supabaseROPsService from '@/services/supabaseROPsService';
import { PageHeader } from '../../components';
import { getAreaConfig } from './_areaConfig';

export default function ROPsChoiceMenuPage({ onNavigate, goBack, areaKey }) {
  const { toast } = useToast();
  const cfg = getAreaConfig(areaKey);
  const AreaIcon = cfg.icon;

  const [totalQuestions, setTotalQuestions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Podcasts continuam em mock (escopo separado — T1.6.13 deferida)
  const podcastsArea = podcastsData?.[areaKey];
  const totalPodcasts = podcastsArea?.audios?.length || 0;

  useEffect(() => {
    let cancelled = false;
    if (!areaKey) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const subs = await supabaseROPsService.fetchSubdivisoesByAreaSlug(areaKey);
        if (cancelled) return;
        // 20 questões por ROP (constante de seed)
        setTotalQuestions(subs.length * 20);
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsChoiceMenuPage] load:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar a área.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={cfg.title} onBack={goBack} />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner — tokens DS */}
        <div className={`mb-4 p-4 rounded-[16px] ${cfg.iconBg} border-l-4 ${cfg.accentBorder}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full ${cfg.cardAccent} flex items-center justify-center flex-shrink-0`}>
              <AreaIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-[15px] font-bold ${cfg.iconFg}`}>
                {cfg.title}
              </h2>
              <p className="text-[13px] text-foreground/70 mt-1">
                Escolha como deseja estudar esta área temática
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <WidgetCard
            icon={
              <div className={`w-10 h-10 rounded-xl ${cfg.cardAccent} flex items-center justify-center`}>
                <FileQuestion className="w-5 h-5 text-white" />
              </div>
            }
            iconClassName="!bg-transparent !p-0"
            title="Questões"
            subtitle={loading ? <Skeleton className="h-4 w-20" /> : `${totalQuestions ?? 0} questões`}
            variant="interactive"
            onClick={() => onNavigate('ropsSubdivisoes', { areaKey })}
          />

          <WidgetCard
            icon={
              <div className={`w-10 h-10 rounded-xl ${totalPodcasts > 0 ? cfg.cardAccent : 'bg-muted'} flex items-center justify-center`}>
                <Headphones className={`w-5 h-5 ${totalPodcasts > 0 ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
            }
            iconClassName="!bg-transparent !p-0"
            title="Podcasts"
            subtitle={totalPodcasts > 0 ? `${totalPodcasts} áudios` : 'Em breve'}
            variant={totalPodcasts > 0 ? 'interactive' : 'default'}
            onClick={totalPodcasts > 0 ? () => onNavigate('ropsPodcasts', { areaKey }) : undefined}
            className={totalPodcasts === 0 ? 'opacity-60 cursor-not-allowed' : ''}
          />
        </div>

        <div className="mt-4 p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">Dica</h3>
          <p className="text-[12px] text-primary dark:text-muted-foreground">
            {totalPodcasts > 0
              ? 'Combine estudo com questões e podcasts para melhor absorção do conteúdo.'
              : 'Comece pelas questões para testar seus conhecimentos sobre as ROPs desta área.'}
          </p>
        </div>
      </div>
    </div>
  );
}
