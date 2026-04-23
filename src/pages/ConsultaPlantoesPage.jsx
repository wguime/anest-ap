/**
 * ConsultaPlantoesPage
 * Consulta de plantões por data. Qualquer usuário autenticado pode
 * selecionar uma data no calendário e ver quem está de plantão.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Shuffle, Pencil } from 'lucide-react';
import { SectionCard, Calendar } from '@/design-system';
import { PageHeader } from '../components';
import {
  PLANTOES_2026,
  FERIADOS_2026,
  FERIADO_LABELS,
  getPlantaoParaData,
  getPlantaoEfetivo,
} from '../data/plantao2026';
import { RESIDENTES_2026, toDateKey } from '../data/residencia2026';
import { getPlantaoDiario } from '../services/residenciaPlantaoDiarioService';
import { useTrocaPlantao } from '../hooks/useTrocaPlantao';

const MIN_DATE = new Date('2026-03-01T00:00:00');
const MAX_DATE = new Date('2027-02-28T00:00:00');

const COLOR_FERIADO = '#F59E0B'; // amarelo
const COLOR_MEU_PLANTAO = '#3B82F6'; // azul

function formatDataLonga(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function ResidenteIcon({ ano }) {
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-muted text-foreground dark:bg-muted dark:text-primary shrink-0">
      {ano || '—'}
    </div>
  );
}

export default function ConsultaPlantoesPage({ goBack }) {
  const { userResidenteId } = useTrocaPlantao();

  const [selectedDate, setSelectedDate] = useState(() => {
    const ef = getPlantaoEfetivo();
    // Clampar ao range permitido
    if (ef < MIN_DATE) return MIN_DATE;
    if (ef > MAX_DATE) return MAX_DATE;
    return ef;
  });
  const [overrideDoc, setOverrideDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  const dateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const hasSchedule = !!PLANTOES_2026[dateKey];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOverrideDoc(null);
    getPlantaoDiario(dateKey).then(({ data }) => {
      if (!cancelled) {
        setOverrideDoc(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [dateKey]);

  // Feriados (amarelo) + dias do residente logado (azul)
  const events = useMemo(() => {
    const list = [...FERIADOS_2026].map((key) => ({
      date: new Date(`${key}T12:00:00`),
      label: FERIADO_LABELS[key] || 'Feriado',
      color: COLOR_FERIADO,
    }));
    if (userResidenteId) {
      const r = RESIDENTES_2026.find((x) => x.id === userResidenteId);
      for (const [key, rid] of Object.entries(PLANTOES_2026)) {
        if (rid !== userResidenteId) continue;
        list.push({
          date: new Date(`${key}T12:00:00`),
          label: `Meu plantão${r ? ` (${r.nome})` : ''}`,
          color: COLOR_MEU_PLANTAO,
        });
      }
    }
    return list;
  }, [userResidenteId]);

  const base = useMemo(() => getPlantaoParaData(selectedDate), [selectedDate]);
  const residenteId = overrideDoc?.residenteOverride ?? base?.id;
  const residente = residenteId
    ? RESIDENTES_2026.find((r) => r.id === residenteId) || base
    : null;

  const feriadoLabel = FERIADO_LABELS[dateKey] || null;
  const horario = base?.horario;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title="Consultar Plantões" onBack={goBack} />

      <div className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full">
        {/* Calendário */}
        <div className="flex justify-center mb-4">
          <Calendar
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            events={events}
            minDate={MIN_DATE}
            maxDate={MAX_DATE}
            className="max-w-full"
          />
        </div>

        {/* Detalhe da data selecionada */}
        <SectionCard
          title={
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="capitalize">{formatDataLonga(selectedDate)}</span>
            </div>
          }
        >
          {!hasSchedule ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sem escala cadastrada para esta data.
            </p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Carregando…
            </p>
          ) : (
            <div className="space-y-3">
              {/* Residente */}
              <div className="flex items-center gap-3">
                <ResidenteIcon ano={residente?.ano} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-black dark:text-white">
                    {residente?.nome || '—'}
                  </p>
                  {horario && (
                    <p className="text-[13px] text-muted-foreground">
                      {horario.inicio} – {horario.fim}{' '}
                      <span className="text-xs">({horario.duracao}h)</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Feriado */}
              {feriadoLabel && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 dark:bg-warning/20 border border-warning/30">
                  <span className="text-base shrink-0">🏖</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-warning uppercase tracking-wide">
                      Feriado
                    </p>
                    <p className="text-sm text-warning">
                      {feriadoLabel}
                    </p>
                  </div>
                </div>
              )}

              {/* Override (troca aceita ou ajuste manual) */}
              {overrideDoc?.residenteOverride && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                  {overrideDoc.origem === 'troca' ? (
                    <Shuffle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Pencil className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      {overrideDoc.origem === 'troca' ? 'Plantão trocado' : 'Ajuste manual'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {overrideDoc.origem === 'troca' && overrideDoc.trocaId
                        ? `Via troca ${overrideDoc.trocaId}`
                        : 'Plantão alterado da escala original'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
