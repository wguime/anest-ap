/**
 * OrgControls - Botoes de controle global do organograma
 * Expandir Tudo / Colapsar Tudo
 */

import { ChevronsDown, ChevronsUp } from 'lucide-react';

/**
 * @param {object} props
 * @param {function} props.onExpandAll - Callback para expandir todos os nos
 * @param {function} props.onCollapseAll - Callback para colapsar todos os nos
 * @param {boolean} props.isEditMode - Se esta em modo de edicao
 */
export default function OrgControls({
  onExpandAll,
  onCollapseAll,
  isEditMode = false,
}) {
  return (
    <div className="flex items-center gap-2 pb-2">
      {/* Expandir Tudo */}
      <button
        type="button"
        onClick={onExpandAll}
        className="
          flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
          bg-[#E8F5E9] dark:bg-[#243530]
          text-[#006837] dark:text-[#2ECC71]
          hover:bg-[#C8E6C9] dark:hover:bg-[#2A3F36]
          active:scale-[0.98]
          transition-all
        "
        aria-label="Expandir todos os itens"
      >
        <ChevronsDown className="w-4 h-4" />
        <span>Expandir</span>
      </button>

      {/* Colapsar Tudo */}
      <button
        type="button"
        onClick={onCollapseAll}
        className="
          flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
          bg-[#E8F5E9] dark:bg-[#243530]
          text-[#006837] dark:text-[#2ECC71]
          hover:bg-[#C8E6C9] dark:hover:bg-[#2A3F36]
          active:scale-[0.98]
          transition-all
        "
        aria-label="Colapsar todos os itens"
      >
        <ChevronsUp className="w-4 h-4" />
        <span>Colapsar</span>
      </button>

      {/* Indicador de modo de edicao */}
      {isEditMode && (
        <div className="ml-auto">
          <span className="text-[11px] text-[#1565C0] dark:text-[#64B5F6] bg-[#E3F2FD] dark:bg-[#1A237E] px-2 py-1 rounded">
            Modo Edicao
          </span>
        </div>
      )}
    </div>
  );
}
