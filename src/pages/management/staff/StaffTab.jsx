import React, { useState, useMemo } from 'react';
import { Users, Umbrella, Building2, FileText } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { StaffScheduleCard } from '@/design-system/components/anest/staff-schedule-card';
import { AssignStaffModal } from '@/design-system/components/anest/assign-staff-modal';

/**
 * StaffTab - Main tab component for staff management in Centro de Gestão
 * Displays both hospital and consultorio schedules organized by location/role
 */
function StaffTab() {
  const { staff, loading, canEdit, saveStaff, savingStaff, staffError, connectionStatus } = useStaff();
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(null); // 'hospitais' | 'consultorio' | null

  // Transform hospitais schedule into sections format for StaffScheduleCard
  const hospitaisSections = useMemo(() => {
    if (!staff?.hospitais) return [];

    const sections = [];

    // HRO section
    const hroStaff = staff.hospitais.hro || [];
    if (hroStaff.length > 0) {
      sections.push({
        label: 'HRO',
        variant: 'default',
        items: hroStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          observacao: entry.observacao,
          status: entry.status || 'ativa',
        })),
      });
    }

    // UNIMED section
    const unimedStaff = staff.hospitais.unimed || [];
    if (unimedStaff.length > 0) {
      sections.push({
        label: 'UNIMED',
        variant: 'default',
        items: unimedStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          observacao: entry.observacao,
          status: entry.status || 'ativa',
        })),
      });
    }

    // MATERNO section
    const maternoStaff = staff.hospitais.materno || [];
    if (maternoStaff.length > 0) {
      sections.push({
        label: 'MATERNO',
        icon: <Building2 className="h-4 w-4" strokeWidth={2} />,
        variant: 'default',
        items: maternoStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          observacao: entry.observacao,
          status: entry.status || 'ativa',
        })),
      });
    }

    // FÉRIAS section
    const feriasStaff = staff.hospitais.ferias || [];
    if (feriasStaff.length > 0) {
      sections.push({
        label: 'FÉRIAS',
        icon: <Umbrella className="h-4 w-4" strokeWidth={2} />,
        variant: 'default',
        items: feriasStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          status: 'ferias',
        })),
      });
    }

    // ATESTADO section (hospitais)
    const atestadoStaff = staff.hospitais.atestado || [];
    if (atestadoStaff.length > 0) {
      sections.push({
        label: 'ATESTADO',
        icon: <FileText className="h-4 w-4" strokeWidth={2} />,
        variant: 'default',
        items: atestadoStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          status: 'atestado',
        })),
      });
    }

    return sections;
  }, [staff?.hospitais]);

  // Transform consultorio schedule into sections format for StaffScheduleCard
  const consultorioSections = useMemo(() => {
    if (!staff?.consultorio) return [];

    const sections = [];

    // VOLAN/FINANCEIRO
    const volanFinanceiro = staff.consultorio.volanFinanceiro || [];
    if (volanFinanceiro.length > 0) {
      sections.push({
        label: 'VOLAN/FINANCEIRO',
        variant: 'default',
        items: volanFinanceiro.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          alertObs: entry.alertObs,
          status: entry.status || 'ativa',
        })),
      });
    }

    // ADMINISTRATIVO/RH
    const administrativo = staff.consultorio.administrativo || [];
    if (administrativo.length > 0) {
      sections.push({
        label: 'ADMINISTRATIVO/RH',
        variant: 'default',
        items: administrativo.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          status: entry.status || 'ativa',
        })),
      });
    }

    // RECEPÇÃO/ATENDIMENTO
    const recepcao = staff.consultorio.recepcao || [];
    if (recepcao.length > 0) {
      sections.push({
        label: 'RECEPÇÃO/ATENDIMENTO',
        variant: 'default',
        items: recepcao.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          status: entry.status || 'ativa',
        })),
      });
    }

    // TELEFONE/WHATSAPP
    const telefoneWhatsapp = staff.consultorio.telefoneWhatsapp || [];
    if (telefoneWhatsapp.length > 0) {
      sections.push({
        label: 'TELEFONE/WHATSAPP',
        variant: 'default',
        items: telefoneWhatsapp.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          alertObs: entry.alertObs,
          status: entry.status || 'ativa',
        })),
      });
    }

    // FINANCEIRO
    const financeiro = staff.consultorio.financeiro || [];
    if (financeiro.length > 0) {
      sections.push({
        label: 'FINANCEIRO',
        variant: 'default',
        items: financeiro.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          observacao: entry.observacao,
          status: entry.status || 'ativa',
        })),
      });
    }

    // ENFERMAGEM QMENTUM
    const enfermagemQmentum = staff.consultorio.enfermagemQmentum || [];
    if (enfermagemQmentum.length > 0) {
      sections.push({
        label: 'ENFERMAGEM QMENTUM',
        variant: 'default',
        items: enfermagemQmentum.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          status: entry.status || 'ativa',
        })),
      });
    }

    // FÉRIAS
    const feriasStaff = staff.consultorio.ferias || [];
    if (feriasStaff.length > 0) {
      sections.push({
        label: 'FÉRIAS',
        icon: <Umbrella className="h-4 w-4" strokeWidth={2} />,
        variant: 'default',
        items: feriasStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          status: 'ferias',
        })),
      });
    }

    // ATESTADO (consultório)
    const atestadoConsStaff = staff.consultorio.atestado || [];
    if (atestadoConsStaff.length > 0) {
      sections.push({
        label: 'ATESTADO',
        icon: <FileText className="h-4 w-4" strokeWidth={2} />,
        variant: 'default',
        items: atestadoConsStaff.map((entry) => ({
          nome: entry.nome,
          turno: entry.turno,
          funcoes: entry.funcoes,
          status: 'atestado',
        })),
      });
    }

    return sections;
  }, [staff?.consultorio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#006837] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Error banner */}
      {staffError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {staffError}
        </div>
      )}

      {/* Connection status badge */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className="mb-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#FEF3C7] dark:bg-[#422006] text-[#92400E] dark:text-[#FCD34D] w-fit">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionStatus === 'reconnecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          {connectionStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div className="mb-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B] text-[#065F46] dark:text-[#6EE7B7] w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Conectado
        </div>
      )}

      {/* Info banner */}
      <div className="mb-4 p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#1A2F23] border border-[#C8E6C9] dark:border-[#2A3F36]">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#006837] dark:text-[#2ECC71]">
              Gerenciamento de Escalas
            </p>
            <p className="text-xs text-[#4A7C59] dark:text-[#6B8178] mt-1">
              Gerencie as escalas dos hospitais e do consultório. As alterações serão refletidas nos cards da página inicial.
            </p>
          </div>
        </div>
      </div>

      {/* Hospital Schedule Card */}
      <div className="mb-4">
        <StaffScheduleCard
          title="Hospitais - Técnicas de Enfermagem"
          sections={hospitaisSections}
          onEdit={() => setShowAssignStaffModal('hospitais')}
          canEdit={canEdit}
        />
      </div>

      {/* Consultorio Schedule Card */}
      <div className="mb-4">
        <StaffScheduleCard
          title="Consultório - Secretárias"
          sections={consultorioSections}
          onEdit={() => setShowAssignStaffModal('consultorio')}
          canEdit={canEdit}
        />
      </div>

      {/* Info adicional */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Sincronização automática
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              As alterações feitas aqui serão refletidas automaticamente nos cards da página inicial.
            </p>
          </div>
        </div>
      </div>

      {/* Assign Staff Modal */}
      <AssignStaffModal
        open={showAssignStaffModal !== null}
        type={showAssignStaffModal || 'hospitais'}
        staff={staff}
        onClose={() => setShowAssignStaffModal(null)}
        onSave={saveStaff}
        saving={savingStaff}
      />
    </>
  );
}

export default StaffTab;
