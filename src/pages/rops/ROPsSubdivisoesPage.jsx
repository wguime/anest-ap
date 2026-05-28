import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/config/supabase';
import { Badge, Skeleton, useToast } from '@/design-system';
import { FileText, CheckCircle } from 'lucide-react';
import supabaseROPsService from '@/services/supabaseROPsService';
import { PageHeader } from '../../components';
import { getAreaConfig } from './_areaConfig';

export default function ROPsSubdivisoesPage({ onNavigate, goBack, areaKey }) {
  const { user } = useUser();
  const { toast } = useToast();
  const cfg = getAreaConfig(areaKey);
  const AreaIcon = cfg.icon || FileText;

  const [area, setArea] = useState(null);
  const [subdivisoes, setSubdivisoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedRops, setCompletedRops] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!areaKey) return;
    (async () => {
      try {
        const subs = await supabaseROPsService.fetchSubdivisoesByAreaSlug(areaKey);
        if (cancelled) return;
        setSubdivisoes(subs);
        // Backfill area title via primeira subdivisão (que já fez !inner join)
        if (subs.length > 0 && subs[0].area) {
          setArea({ title: cfg.title, slug: areaKey });
        } else {
          // Fallback: busca explicita
          const areas = await supabaseROPsService.fetchAreas();
          const found = areas.find((a) => a.slug === areaKey);
          if (!cancelled) setArea(found || null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[ROPsSubdivisoesPage] load:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar as ROPs.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  useEffect(() => {
    if (!user?.id || !areaKey) return;
    // Legacy: ainda lê rops_quiz_results para "concluído" se a tabela existir.
    // Caso 42P01 (tabela inexistente), ignora silenciosamente.
    supabase
      .from('rops_quiz_results')
      .select('rop_key')
      .eq('user_id', user.id)
      .eq('area_key', areaKey)
      .then(({ data, error }) => {
        if (error) return;
        if (data) setCompletedRops(new Set(data.map((r) => r.rop_key)));
      });
  }, [user?.id, areaKey]);

  const header = <PageHeader title={area?.title || cfg.title} onBack={goBack} />;

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {header}
        <div className="px-4 pt-4 sm:px-5 space-y-3">
          <Skeleton className="h-[100px] rounded-[16px]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-[16px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!subdivisoes.length) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4">
        {header}
        <p className="text-foreground text-lg font-bold mb-4">Área não encontrada</p>
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
      {header}

      <div className="px-4 pt-4 sm:px-5">
        {/* Card de Destaque da Área — tokens DS (sem gradient hex) */}
        <div className={`mb-4 p-5 rounded-[16px] min-h-[100px] shadow-[0_4px_16px_rgba(0,66,37,0.12)] ${cfg.iconBg} border-l-4 ${cfg.accentBorder}`}>
          <div className="flex items-center gap-4 h-full">
            <div className={`w-14 h-14 rounded-xl ${cfg.cardAccent} flex items-center justify-center flex-shrink-0`}>
              <AreaIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className={`text-[17px] font-bold leading-tight ${cfg.iconFg}`}>
                {area?.title || cfg.title}
              </h2>
              <p className="text-[13px] mt-1 text-foreground/70">
                {subdivisoes.length} ROPs disponíveis • Selecione para iniciar
              </p>
            </div>
          </div>
        </div>

        {/* Lista de ROPs */}
        <div className="grid grid-cols-1 gap-3">
          {subdivisoes.map((rop, index) => {
            const isCompleted = completedRops.has(rop.slug);

            return (
              <button
                key={rop.id}
                type="button"
                onClick={() => onNavigate('ropsQuiz', { areaKey, ropKey: rop.slug, subdivisaoId: rop.id })}
                className="w-full text-left p-4 rounded-[16px] bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] transition-all min-h-[88px]"
              >
                <div className="flex items-center gap-4 h-full">
                  <div className={`w-12 h-12 rounded-xl ${cfg.cardAccent} flex items-center justify-center flex-shrink-0 text-white font-bold text-base`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">
                        {rop.title}
                      </h3>
                      {isCompleted && (
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" badgeStyle="subtle">
                        20 questões
                      </Badge>
                      {isCompleted && (
                        <Badge variant="success" badgeStyle="subtle">
                          Concluído
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">Dica</h3>
          <p className="text-[12px] text-primary dark:text-muted-foreground">
            Cada ROP contém 20 questões. Você ganha 10 pontos por resposta correta.
            Após responder, você verá a explicação da resposta correta.
          </p>
        </div>
      </div>
    </div>
  );
}
