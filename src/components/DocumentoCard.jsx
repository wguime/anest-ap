/**
 * DocumentoCard - Widget para grid de documentos (segue padrao DS WidgetCard)
 * @param {object} documento - Dados do documento
 * @param {function} onClick - Callback ao clicar no card
 */
export default function DocumentoCard({ documento, onClick }) {
  const { titulo, codigo, tipo, versaoAtual } = documento;

  // Cores e labels por tipo de documento (inclui tipos de documentos, auditorias e comites)
  const tipoConfig = {
    // Tipos de documentos (biblioteca)
    protocolo: { label: 'Protocolo', color: 'bg-[#059669]' },
    politica: { label: 'Politica', color: 'bg-[#6366F1]' },
    formulario: { label: 'Formulario', color: 'bg-[#F59E0B]' },
    manual: { label: 'Manual', color: 'bg-[#EC4899]' },
    relatorio: { label: 'Relatorio', color: 'bg-[#3B82F6]' },
    processo: { label: 'Processo', color: 'bg-[#8B5CF6]' },
    termo: { label: 'Termo', color: 'bg-[#14B8A6]' },
    risco: { label: 'Risco', color: 'bg-[#DC2626]' },
    plano: { label: 'Plano', color: 'bg-[#0891B2]' },
    // Tipos de auditorias (documentos)
    higiene_maos: { label: 'Higiene Maos', color: 'bg-[#059669]' },
    uso_medicamentos: { label: 'Medicamentos', color: 'bg-[#2563eb]' },
    abreviaturas: { label: 'Abreviaturas', color: 'bg-[#dc2626]' },
    politica_qualidade: { label: 'Qualidade', color: 'bg-[#7c3aed]' },
    politica_disclosure: { label: 'Disclosure', color: 'bg-[#0891b2]' },
    relatorio_rops: { label: 'ROPs', color: 'bg-[#059669]' },
    operacional: { label: 'Operacional', color: 'bg-[#059669]' },
    conformidade: { label: 'Conformidade', color: 'bg-[#7c3aed]' },
    procedimento: { label: 'Procedimento', color: 'bg-[#ec4899]' },
    seguranca_paciente: { label: 'Seguranca', color: 'bg-[#ef4444]' },
    controle_infeccao: { label: 'Infeccao', color: 'bg-[#06b6d4]' },
    equipamentos: { label: 'Equipamentos', color: 'bg-[#8b5cf6]' },
    // Tipos de relatórios de auditorias
    auditoria_consolidado_rops: { label: 'Consolidado ROPs', color: 'bg-[#059669]' },
    auditoria_higiene_maos: { label: 'Higiene Maos', color: 'bg-[#2563eb]' },
    auditoria_medicamentos: { label: 'Medicamentos', color: 'bg-[#7c3aed]' },
    auditoria_conformidade: { label: 'Conformidade', color: 'bg-[#dc2626]' },
    // Tipos de comites institucionais
    regimento_interno: { label: 'Regimento', color: 'bg-[#2563eb]' },
    executivo: { label: 'Executivo', color: 'bg-[#059669]' },
    financeiro: { label: 'Financeiro', color: 'bg-[#059669]' },
    gestao_pessoas: { label: 'Gestao RH', color: 'bg-[#7c3aed]' },
    escalas: { label: 'Escalas', color: 'bg-[#f59e0b]' },
    tecnologia: { label: 'Tecnologia', color: 'bg-[#2563eb]' },
    qualidade: { label: 'Qualidade', color: 'bg-[#2563eb]' },
    educacao: { label: 'Educacao', color: 'bg-[#dc2626]' },
    etica_conduta: { label: 'Etica', color: 'bg-[#7c3aed]' },
  };

  const config = tipoConfig[tipo] || tipoConfig.protocolo;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full h-full min-h-[140px] flex flex-col text-left rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] transition-all"
    >
      {/* Badge de tipo */}
      <span
        className={`self-start px-2 py-0.5 rounded text-[11px] font-bold text-white ${config.color}`}
      >
        {config.label}
      </span>

      {/* Titulo completo */}
      <h3
        lang="pt-BR"
        className="mt-2 flex-1 text-[14px] font-bold leading-tight text-[#1F2937] dark:text-white hyphens-auto overflow-hidden"
      >
        {titulo}
      </h3>

      {/* Codigo e Versao */}
      <div className="mt-auto pt-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#6B8178] truncate max-w-[65%]">
          {codigo}
        </span>
        <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#6B8178]">
          v{versaoAtual}
        </span>
      </div>
    </button>
  );
}
