import { useEffect, useState } from 'react';
import { WidgetCard, Skeleton, useToast } from '@/design-system';
import { Trophy, CalendarCheck } from 'lucide-react';
import supabaseROPsService from '@/services/supabaseROPsService';
import podcastsData from '@/data/podcasts-data';
import { PageHeader } from '../../components';
import { getAreaConfig, AREA_SLUGS } from './_areaConfig';

export default function ROPsDesafioPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  const [areas, setAreas] = useState([]);
  const [subdivisoesByArea, setSubdivisoesByArea] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const areaRows = await supabaseROPsService.fetchAreas();
        if (cancelled) return;
        setAreas(areaRows);

        const subdivisoes = await supabaseROPsService.fetchSubdivisoes();
        if (cancelled) return;
        const grouped = subdivisoes.reduce((acc, s) => {
          (acc[s.areaId] = acc[s.areaId] || []).push(s);
          return acc;
        }, {});
        setSubdivisoesByArea(grouped);
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsDesafioPage] load:', err);
        toast({ title: 'Erro ao carregar áreas', description: 'Tente novamente.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPodcastCount = (areaSlug) => podcastsData?.[areaSlug]?.audios?.length || 0;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Desafio das ROPs" onBack={goBack} />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner */}
        <div className="mb-4 p-4 rounded-[16px] bg-muted dark:border dark:border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">
                Quiz Gamificado Qmentum
              </h2>
              <p className="text-[13px] text-foreground/80 mt-1">
                Teste seus conhecimentos sobre as 32 Práticas Organizacionais Obrigatórias.
                640 questões distribuídas em 6 áreas temáticas.
              </p>
            </div>
          </div>
        </div>

        {/* CTA: Desafio do dia (T1.6.10) */}
        <button
          type="button"
          onClick={() => onNavigate('ropsDesafioDiario')}
          className="w-full mb-4 p-4 rounded-[16px] bg-category-teal-bg border-l-4 border-category-teal text-left shadow-[0_2px_12px_rgba(0,66,37,0.08)] hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.12)] active:scale-[0.99] transition-all min-h-[64px]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-category-teal flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-6 h-6 text-category-teal-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-category-teal-fg">
                Desafio do dia
              </h3>
              <p className="text-[13px] text-category-teal-fg/80 mt-0.5">
                10 questões aleatórias estratificadas por área. ~5 min.
              </p>
            </div>
          </div>
        </button>

        {/* Card de Ranking */}
        <button
          type="button"
          onClick={() => onNavigate('ropsRanking')}
          className="w-full mb-4 p-4 rounded-[16px] bg-category-orange-bg border-l-4 border-category-orange text-left shadow-[0_2px_12px_rgba(0,66,37,0.08)] hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.12)] active:scale-[0.99] transition-all min-h-[64px]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-category-orange flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-category-orange-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-category-orange-fg">
                Ranking
              </h3>
              <p className="text-[13px] text-category-orange-fg/80 mt-0.5">
                Veja sua posição e compare com outros usuários
              </p>
            </div>
          </div>
        </button>

        {/* Grid de Macro Áreas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-4">
          {loading
            ? AREA_SLUGS.map((slug) => (
                <Skeleton key={slug} className="h-[88px] rounded-[16px]" />
              ))
            : areas.map((area) => {
                const cfg = getAreaConfig(area.slug);
                const IconComponent = cfg.icon;
                const ropCount = (subdivisoesByArea[area.id] || []).length;
                const podcastCount = getPodcastCount(area.slug);

                return (
                  <WidgetCard
                    key={area.id}
                    icon={
                      <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${cfg.iconFg}`} />
                      </div>
                    }
                    iconClassName="!bg-transparent !p-0"
                    title={area.title}
                    subtitle={`${ropCount} ROPs • ${podcastCount} podcasts`}
                    variant="interactive"
                    onClick={() => onNavigate('ropsChoiceMenu', { areaKey: area.slug, areaId: area.id })}
                  />
                );
              })}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">
            Como funciona?
          </h3>
          <ul className="space-y-1 text-[12px] text-primary dark:text-muted-foreground">
            <li>• Escolha uma área temática</li>
            <li>• Escolha entre Questões ou Podcasts</li>
            <li>• Responda 20 questões por ROP</li>
            <li>• Ganhe 10 pontos por resposta correta</li>
            <li>• Compare sua pontuação no ranking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
