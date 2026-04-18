/**
 * EscalasFuncionariasHubPage
 * Hub das escalas de funcionárias: sobreaviso materno + hospitais (técnicas) +
 * consultório (secretárias). Acesso rápido a consulta e trocas de sobreaviso.
 */
import { useState, useMemo } from 'react';
import { SectionCard, StaffScheduleCard } from '@/design-system';
import { PageHeader } from '../components';
import { useSobreavisoMaterno } from '../hooks/useSobreavisoMaterno';
import { useStaff } from '../hooks/useStaff';
import { EditSobreavisoModal } from '../components/sobreaviso/EditSobreavisoModal';
import { FUNCIONARIAS_SOBREAVISO } from '../data/sobreavisoMaterno2026';
import { ArrowLeftRight, CalendarSearch, Pencil, Building2, Umbrella, FileText } from 'lucide-react';

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
    parts.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }));
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

  const [showSobreavisoModal, setShowSobreavisoModal] = useState(false);

  const hospitalSections = useMemo(() => {
    if (!staff) return [];
    const sections = [];
    const h = staff.hospitais || {};
    if (h.hro?.length)      sections.push({ label: 'HRO',      variant: 'default', items: mapStaffItems(h.hro) });
    if (h.unimed?.length)   sections.push({ label: 'UNIMED',   variant: 'default', items: mapStaffItems(h.unimed) });
    if (h.materno?.length)  sections.push({ label: 'MATERNO',  variant: 'default', icon: <Building2 className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.materno) });
    if (h.ferias?.length)   sections.push({ label: 'Férias',   variant: 'default', items: mapStaffItems(h.ferias, 'ferias') });
    if (h.atestado?.length) sections.push({ label: 'ATESTADO', variant: 'default', icon: <FileText className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.atestado, 'atestado') });
    return sections;
  }, [staff]);

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
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Escalas Funcionárias" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {/* Cards de acesso rápido */}
        <div className="grid grid-cols-1 gap-3 mb-4">
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
              {sobreaviso?.dataFormatada && (
                <p className="text-[13px] font-normal text-muted-foreground">
                  {sobreaviso.dataFormatada}
                </p>
              )}
            </>
          }
          className="mb-4"
          headerAction={
            canEditSobreaviso && (
              <button
                type="button"
                onClick={() => setShowSobreavisoModal(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
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
                <p className="text-[13px] text-muted-foreground">
                  {sobreaviso.funcionaria?.cargo || 'Enfermeira'} · Materno
                </p>
              </div>
              <span className="text-base font-bold text-[#9BC53D] dark:text-primary">
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
              meta={formatCardMeta(staff?.hospitaisCardData, staff?.hospitaisCardTurno)}
              sections={hospitalSections}
              canEdit={false}
            />

            <StaffScheduleCard
              subtitle="CONSULTÓRIO"
              title="Secretárias"
              meta={formatCardMeta(staff?.consultorioCardData, staff?.consultorioCardTurno)}
              sections={consultorioSections}
              canEdit={false}
            />
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
