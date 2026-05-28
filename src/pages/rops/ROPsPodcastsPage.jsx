import { AudioPlayer } from '@/design-system';
import { Headphones } from 'lucide-react';
import podcastsData from '@/data/podcasts-data';
import { PageHeader } from '../../components';
import { getAreaConfig } from './_areaConfig';

/**
 * Podcasts ROP — esta página continua lendo de src/data/podcasts-data.js
 * (mesmo escopo do plano: migração de podcasts deferida — T1.6.13 marcada
 * opcional e adiada para Sprint 2). Wave 1.6 apenas alinha tokens DS aqui.
 */
export default function ROPsPodcastsPage({ goBack, areaKey }) {
  const cfg = getAreaConfig(areaKey);
  const AreaIcon = cfg.icon || Headphones;

  const podcastsArea = podcastsData?.[areaKey];
  const podcasts = podcastsArea?.audios || [];

  if (!podcastsArea) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4">
        <p className="text-foreground text-lg font-bold mb-2">Podcasts não encontrados</p>
        <p className="text-muted-foreground text-sm mb-4">areaKey: "{areaKey || 'undefined'}"</p>
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg min-h-[44px]"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={`${cfg.title} - Podcasts`} onBack={goBack} />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner — token DS */}
        <div className={`mb-4 p-4 rounded-[16px] ${cfg.iconBg} border-l-4 ${cfg.accentBorder}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full ${cfg.cardAccent} flex items-center justify-center flex-shrink-0`}>
              <AreaIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-[15px] font-bold ${cfg.iconFg}`}>
                Podcasts - {cfg.title}
              </h2>
              <p className="text-[13px] text-foreground/70 mt-1">
                {podcasts.length} áudio{podcasts.length !== 1 ? 's' : ''} disponível{podcasts.length !== 1 ? 'eis' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {podcasts.map((podcast, index) => (
            <div
              key={`${podcast.title}-${index}`}
              className="rounded-[16px] overflow-hidden bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)]"
            >
              <AudioPlayer
                src={podcast.file}
                title={podcast.title}
                artist={podcast.descricao || cfg.title}
                variant="card"
                showSkipButtons
                className="border-none shadow-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">
            Dica
          </h3>
          <p className="text-[12px] text-primary dark:text-muted-foreground">
            Ouça os podcasts para reforçar seu aprendizado sobre as ROPs. Após ouvir, faça o quiz para testar seus conhecimentos.
          </p>
        </div>
      </div>
    </div>
  );
}
