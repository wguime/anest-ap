import { SectionCard } from '@/design-system';
import { Calendar, Clock, MapPin, Users, FileText } from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { TIPOS_REUNIAO, PERFIS_CONVOCADOS } from '@/constants/reunioes';

/**
 * ContextoTab — Meeting info: título, tipo, data/hora, local, modalidade, descrição/contexto, pauta.
 * Read-only display with SectionCard.
 */
export default function ContextoTab({ reuniao, formatDate }) {
  if (!reuniao) return null;

  return (
    <div className="space-y-4">
      {/* Header Card com Título, Status e Informações Principais */}
      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
        {/* Grid de Informações */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="font-medium text-foreground">
                {formatDate(reuniao.dataReuniao)}
              </p>
            </div>
          </div>

          {reuniao.horario && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-medium text-foreground">
                  {reuniao.horario}
                </p>
              </div>
            </div>
          )}

          {reuniao.local && (
            <div className="flex items-start gap-2 col-span-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Local</p>
                <p className="font-medium text-foreground">
                  {reuniao.local}
                </p>
              </div>
            </div>
          )}

          {(reuniao.destinatariosTipos?.length > 0 || reuniao.participantesIds?.length > 0) && (
            <div className="flex items-start gap-2 col-span-2">
              <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Convocados</p>
                {reuniao.destinatariosTipos?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {reuniao.destinatariosTipos.map(key => {
                      const perfil = PERFIS_CONVOCADOS.find(p => p.key === key);
                      if (!perfil) return null;
                      return (
                        <span
                          key={key}
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full',
                            perfil.chipSolidClass
                          )}
                        >
                          {perfil.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-sm font-medium text-foreground mt-1">
                  {reuniao.participantesIds?.length || 0} profissionais
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seção: Contexto/Pauta */}
      {(reuniao.contexto || reuniao.pauta) && (
        <SectionCard
          title="Contexto/Pauta"
          icon={FileText}
        >
          <div className="space-y-3">
            {reuniao.contexto && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {reuniao.contexto}
                </p>
              </div>
            )}
            {reuniao.pauta && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pauta</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {reuniao.pauta}
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
