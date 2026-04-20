/**
 * ConsultaSobreavisoPage
 * Consulta de sobreaviso materno por data. Qualquer usuário autenticado pode
 * selecionar uma data no calendário e ver quem está de sobreaviso.
 *
 * Marcadores no calendário:
 *   - Bolinha amarela: feriados cadastrados em FERIADOS_2026.
 *   - Bolinha azul: dias em que a funcionária logada está de sobreaviso.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Shuffle, Pencil } from 'lucide-react';
import { SectionCard, Calendar, StaffScheduleCard } from '@/design-system';
import { PageHeader } from '../components';
import {
  SOBREAVISO_MATERNO_2026,
  FUNCIONARIAS_SOBREAVISO,
  getSobreavisoParaData,
  getSobreavisoEfetivo,
  getHorarioSobreaviso,
} from '../data/sobreavisoMaterno2026';
import { FERIADOS_2026, FERIADO_LABELS } from '../data/plantao2026';
import { toDateKey } from '../data/residencia2026';
import {
  getHospitaisParaData,
  isDiaAutomaticoHospitais,
  TURNO_MANHA as HOSPITAIS_TURNO_MANHA,
  TURNO_TARDE as HOSPITAIS_TURNO_TARDE,
  TURNO_FUNC_UNIMED as HOSPITAIS_TURNO_FUNC_UNIMED,
} from '../data/hospitaisTecnicas2026';
import { getSobreavisoDiario } from '../services/sobreavisoMaternoService';
import { useTrocaSobreaviso } from '../hooks/useTrocaSobreaviso';

const MIN_DATE = new Date('2026-04-01T00:00:00');
const MAX_DATE = new Date('2026-05-31T00:00:00');

const COLOR_FERIADO = '#F59E0B'; // amarelo
const COLOR_MEU_SOBREAVISO = '#3B82F6'; // azul

function formatDataLonga(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function FuncionariaIcon({ nome }) {
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-muted text-foreground dark:bg-muted dark:text-primary shrink-0">
      {nome?.[0] || '—'}
    </div>
  );
}

export default function ConsultaSobreavisoPage({ goBack }) {
  const { userFuncionariaId } = useTrocaSobreaviso();

  const [selectedDate, setSelectedDate] = useState(() => {
    const ef = getSobreavisoEfetivo();
    if (ef < MIN_DATE) return MIN_DATE;
    if (ef > MAX_DATE) return MAX_DATE;
    return ef;
  });
  const [overrideDoc, setOverrideDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  const dateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const hasSchedule = !!SOBREAVISO_MATERNO_2026[dateKey];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOverrideDoc(null);
    getSobreavisoDiario(dateKey).then(({ data }) => {
      if (!cancelled) {
        setOverrideDoc(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [dateKey]);

  const events = useMemo(() => {
    const list = [];
    // Feriados no range do sobreaviso (abr-mai 2026)
    for (const key of FERIADOS_2026) {
      if (key < '2026-04-01' || key > '2026-05-31') continue;
      list.push({
        date: new Date(`${key}T12:00:00`),
        label: FERIADO_LABELS[key] || 'Feriado',
        color: COLOR_FERIADO,
      });
    }
    // Dias da funcionária logada
    if (userFuncionariaId) {
      const f = FUNCIONARIAS_SOBREAVISO.find((x) => x.id === userFuncionariaId);
      for (const [key, fid] of Object.entries(SOBREAVISO_MATERNO_2026)) {
        if (fid !== userFuncionariaId) continue;
        list.push({
          date: new Date(`${key}T12:00:00`),
          label: `Meu sobreaviso${f ? ` (${f.nome})` : ''}`,
          color: COLOR_MEU_SOBREAVISO,
        });
      }
    }
    return list;
  }, [userFuncionariaId]);

  const base = useMemo(() => getSobreavisoParaData(selectedDate), [selectedDate]);
  const funcionariaId = overrideDoc?.funcionariaOverride ?? base?.id;
  const funcionaria = funcionariaId
    ? FUNCIONARIAS_SOBREAVISO.find((f) => f.id === funcionariaId) || base
    : null;

  const horario = getHorarioSobreaviso();
  const feriadoLabel = FERIADO_LABELS[dateKey] || null;

  const hospitalSections = useMemo(() => {
    if (!isDiaAutomaticoHospitais(selectedDate)) return [];
    const auto = getHospitaisParaData(selectedDate);
    if (!auto) return [];
    const sections = [];
    if (auto.hro) {
      sections.push({
        label: 'HRO',
        variant: 'default',
        items: [{ nome: auto.hro, turno: HOSPITAIS_TURNO_MANHA, status: 'ativa' }],
      });
    }
    if (auto.unimed) {
      sections.push({
        label: 'UNIMED',
        variant: 'default',
        items: [
          { nome: auto.unimed,    turno: HOSPITAIS_TURNO_MANHA,       status: 'ativa' },
          { nome: 'Func. Unimed', turno: HOSPITAIS_TURNO_FUNC_UNIMED, status: 'ativa' },
        ],
      });
    }
    if (auto.plantaoPago) {
      sections.push({
        label: 'PLANTÃO PAGO',
        variant: 'default',
        items: [{ nome: auto.plantaoPago, turno: HOSPITAIS_TURNO_TARDE, status: 'ativa' }],
      });
    }
    return sections;
  }, [selectedDate]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Consultar Sobreaviso" onBack={goBack} />

      <div className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full">
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
              <div className="flex items-center gap-3">
                <FuncionariaIcon nome={funcionaria?.nome} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-black dark:text-white">
                    {funcionaria?.nome || '—'}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {horario.inicio} – {horario.fim}{' '}
                    <span className="text-xs">({horario.duracao}h)</span>
                  </p>
                </div>
              </div>

              {feriadoLabel && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-base shrink-0">🏖</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                      Feriado
                    </p>
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      {feriadoLabel}
                    </p>
                  </div>
                </div>
              )}

              {overrideDoc?.funcionariaOverride && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                  {overrideDoc.origem === 'troca' ? (
                    <Shuffle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Pencil className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      {overrideDoc.origem === 'troca' ? 'Sobreaviso trocado' : 'Ajuste manual'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {overrideDoc.origem === 'troca' && overrideDoc.trocaId
                        ? `Via troca ${overrideDoc.trocaId}`
                        : 'Sobreaviso alterado da escala original'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {hospitalSections.length > 0 && (
          <div className="mt-4">
            <StaffScheduleCard
              subtitle="HOSPITAIS"
              title="Técnicas de Enfermagem"
              sections={hospitalSections}
              canEdit={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
