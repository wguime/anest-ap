/**
 * EscalasFuncionariasHubPage
 * Hub das escalas de funcionárias: sobreaviso materno + hospitais (técnicas) +
 * consultório (secretárias). Acesso rápido a consulta e trocas de sobreaviso.
 */
import { useState, useMemo } from 'react';
import { SectionCard, StaffScheduleCard } from '@/design-system';
import { PageHeader } from '../components';
import { useSobreavisoMaterno } from '../hooks/useSobreavisoMaterno';
import { useTrocaSobreaviso } from '../hooks/useTrocaSobreaviso';
import { useResidencia } from '../hooks/useResidencia';
import { useStaff } from '../hooks/useStaff';
import { isDiaNaoUtil } from '../data/residencia2026';
import { FERIADOS_2026 } from '../data/plantao2026';
import { EditSobreavisoModal } from '../components/sobreaviso/EditSobreavisoModal';
import { FUNCIONARIAS_SOBREAVISO } from '../data/sobreavisoMaterno2026';
import { getHospitaisEfetivo, getHospitaisEfetivos, isDiaAutomaticoHospitais, TURNO_MANHA as HOSPITAIS_TURNO_MANHA, TURNO_TARDE as HOSPITAIS_TURNO_TARDE, TURNO_FUNC_UNIMED as HOSPITAIS_TURNO_FUNC_UNIMED } from '../data/hospitaisTecnicas2026';
import { useHospitaisOverrides } from '../hooks/useHospitaisOverrides';
import { ArrowLeftRight, CalendarSearch, Pencil, Building2, Umbrella, FileText, Settings } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

function FuncionariaIcon({ nome }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-muted text-foreground dark:bg-muted dark:text-primary">
      {nome?.[0] || '—'}
    </div>
  );
}

function mapStaffItems(arr, statusOverride) {
  return (arr || []).map((s) => ({ ...s, status: statusOverride || s.status || 'ativa' }));
}

function formatCardMeta(isoDate, turno) {
  if (!isoDate && !turno) return null;
  const parts = [];
  if (isoDate) {
    const d = new Date(isoDate + 'T12:00:00');
    parts.push(formatDate(d, 'medium'));
  }
  const labels = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' };
  if (turno && labels[turno]) parts.push(labels[turno]);
  return parts.join(' · ');
}

export default function EscalasFuncionariasHubPage({ onNavigate, goBack }) {
  const {
    sobreaviso,
    funcionarias,
    canEdit: canEditSobreaviso,
    saveSobreaviso,
    saving: savingSobreaviso,
  } = useSobreavisoMaterno();

  const { staff, staffLoading } = useStaff();
  const { canManageTrades, isAdminOrCoord } = useTrocaSobreaviso();
  const { escalaCardData } = useResidencia();
  const { overrides: hospitaisOverrides } = useHospitaisOverrides();

  const [showSobreavisoModal, setShowSobreavisoModal] = useState(false);

  // `escalaCardData` rola às 18h (sem salto FDS) — usa como sinal para Técnicas/Secretárias.
  const hospitaisEffectiveDateKey = escalaCardData || null;
  const hospitalSections = useMemo(() => {
    const sections = [];
    const h = staff?.hospitais || {};

    const effectiveDate = hospitaisEffectiveDateKey
      ? new Date(`${hospitaisEffectiveDateKey}T12:00:00`)
      : getHospitaisEfetivo();

    const autoData = isDiaAutomaticoHospitais(effectiveDate)
      ? getHospitaisEfetivos(effectiveDate, hospitaisOverrides)
      : null;

    if (autoData) {
      if (autoData.hro) {
        sections.push({
          label: 'HRO',
          variant: 'default',
          items: [{ nome: autoData.hro, turno: HOSPITAIS_TURNO_MANHA, status: 'ativa' }],
        });
      }
      if (autoData.unimed) {
        sections.push({
          label: 'UNIMED',
          variant: 'default',
          items: [
            { nome: autoData.unimed, turno: HOSPITAIS_TURNO_MANHA,       status: 'ativa' },
            { nome: 'Func. Unimed',  turno: HOSPITAIS_TURNO_FUNC_UNIMED, status: 'ativa' },
          ],
        });
      }
      if (autoData.plantaoPago) {
        sections.push({
          label: 'PLANTÃO PAGO',
          variant: 'default',
          items: [{ nome: autoData.plantaoPago, turno: HOSPITAIS_TURNO_TARDE, status: 'ativa' }],
        });
      }
    } else if (staff) {
      // Dia útil: Firestore completo (inclui Férias)
      if (h.hro?.length)    sections.push({ label: 'HRO',    variant: 'default', items: mapStaffItems(h.hro) });
      if (h.unimed?.length) sections.push({ label: 'UNIMED', variant: 'default', items: mapStaffItems(h.unimed) });
      if (h.ferias?.length) sections.push({ label: 'Férias', variant: 'default', icon: <Umbrella className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.ferias, 'ferias') });
    }

    if (staff) {
      if (h.materno?.length)  sections.push({ label: 'MATERNO',  variant: 'default', icon: <Building2 className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.materno) });
      if (h.atestado?.length) sections.push({ label: 'ATESTADO', variant: 'default', icon: <FileText className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.atestado, 'atestado') });
    }
    return sections;
  }, [staff, hospitaisEffectiveDateKey, hospitaisOverrides]);

  const consultorioSections = useMemo(() => {
    if (!staff) return [];
    const sections = [];
    const c = staff.consultorio || {};
    if (c.volanFinanceiro?.length)   sections.push({ label: 'VOLAN/FINANCEIRO',     variant: 'default', items: mapStaffItems(c.volanFinanceiro) });
    if (c.administrativo?.length)    sections.push({ label: 'ADMINISTRATIVO/RH',    variant: 'default', items: mapStaffItems(c.administrativo) });
    if (c.recepcao?.length)          sections.push({ label: 'RECEPÇÃO/ATENDIMENTO', variant: 'default', items: mapStaffItems(c.recepcao) });
    if (c.telefoneWhatsapp?.length)  sections.push({ label: 'TELEFONE/WHATSAPP',    variant: 'default', items: mapStaffItems(c.telefoneWhatsapp) });
    if (c.financeiro?.length)        sections.push({ label: 'FINANCEIRO',            variant: 'default', items: mapStaffItems(c.financeiro) });
    if (c.enfermagemQmentum?.length) sections.push({ label: 'ENFERMAGEM QMENTUM',   variant: 'default', items: mapStaffItems(c.enfermagemQmentum) });
    if (c.ferias?.length)            sections.push({ label: 'FÉRIAS',                variant: 'default', icon: <Umbrella className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(c.ferias, 'ferias') });
    return sections;
  }, [staff]);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title="Escalas Funcionárias"
        onBack={goBack}
        rightContent={
          isAdminOrCoord && (
            <button
              type="button"
              onClick={() => onNavigate('adminTodasTrocasFuncionarias')}
              className="flex items-center justify-center text-primary hover:opacity-70 transition-opacity p-2 -m-2"
              aria-label="Todas as trocas (Admin)"
              title="Todas as trocas (Admin)"
            >
              <Settings className="w-5 h-5" />
            </button>
          )
        }
      />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {/* Cards de acesso rápido */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          {canManageTrades && (
            <button
              type="button"
              onClick={() => onNavigate('trocasSobreaviso')}
              className="bg-card rounded-[20px] border border-border p-4 shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-muted">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-black dark:text-white">Trocas de Sobreaviso</p>
              <p className="text-xs text-muted-foreground mt-0.5">Solicitar e gerenciar</p>
            </button>
          )}

          {canManageTrades && (
            <button
              type="button"
              onClick={() => onNavigate('trocasPlantaoHospitalar')}
              className="bg-card rounded-[20px] border border-border p-4 shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-muted">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-black dark:text-white">Trocas de Plantão (FDS/Feriado)</p>
              <p className="text-xs text-muted-foreground mt-0.5">HRO · UNIMED · Plantão Pago</p>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('consultaSobreaviso')}
            className="bg-card rounded-[20px] border border-border p-4 shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-muted">
              <CalendarSearch className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-black dark:text-white">Consultar Sobreaviso</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ver escala por data</p>
          </button>

        </div>

        {/* Sobreaviso Materno */}
        <SectionCard
          title={
            <>
              Sobreaviso Materno
              {formatCardMeta(sobreaviso?.data, null) && (
                <p className="text-[13px] font-normal text-muted-foreground">
                  {formatCardMeta(sobreaviso?.data, null)}
                </p>
              )}
            </>
          }
          className="mb-4 p-3 md:p-4"
          headerAction={
            canEditSobreaviso && (
              <button
                type="button"
                onClick={() => setShowSobreavisoModal(true)}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg text-primary hover:bg-muted transition-colors"
                aria-label="Editar sobreaviso"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )
          }
        >
          {sobreaviso?.hasEscala ? (
            <div className="flex items-center gap-3">
              <FuncionariaIcon nome={sobreaviso.funcionaria?.nome} />
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-black dark:text-white">
                  {sobreaviso.funcionaria?.nome || '—'}
                </p>
              </div>
              <span className="text-base font-bold text-greenLight dark:text-primary">
                {sobreaviso.horario}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sem escala cadastrada para esta data.
            </p>
          )}
        </SectionCard>

        {/* Hospitais - Técnicas de Enfermagem (read-only, espelha Home) */}
        {!staffLoading && hospitalSections.length > 0 && (
          <div className="space-y-4 mb-4">
            <StaffScheduleCard
              subtitle="HOSPITAIS"
              title="Técnicas de Enfermagem"
              meta={
                isDiaAutomaticoHospitais(
                  hospitaisEffectiveDateKey
                    ? new Date(`${hospitaisEffectiveDateKey}T12:00:00`)
                    : getHospitaisEfetivo()
                )
                  ? formatCardMeta(hospitaisEffectiveDateKey, null)
                  : formatCardMeta(staff?.hospitaisCardData, staff?.hospitaisCardTurno)
              }
              sections={hospitalSections}
              canEdit={false}
            />

            {!isDiaNaoUtil(escalaCardData, FERIADOS_2026) && (
              <StaffScheduleCard
                subtitle="CONSULTÓRIO"
                title="Secretárias"
                meta={formatCardMeta(escalaCardData, null)}
                sections={consultorioSections}
                canEdit={false}
              />
            )}
          </div>
        )}

        {/* Modal Edição Sobreaviso */}
        <EditSobreavisoModal
          open={showSobreavisoModal}
          onClose={() => setShowSobreavisoModal(false)}
          sobreaviso={sobreaviso}
          funcionarias={funcionarias || FUNCIONARIAS_SOBREAVISO}
          onSave={saveSobreaviso}
          saving={savingSobreaviso}
        />
      </div>
    </div>
  );
}
