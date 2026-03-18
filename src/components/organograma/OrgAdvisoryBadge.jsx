/**
 * OrgAdvisoryBadge - Badge para comites consultivos (advisory)
 * Design harmonizado com os cards do organograma
 */

import { MessageSquare, Pencil } from 'lucide-react';

/**
 * @param {object} props
 * @param {object} props.node - Dados do no advisory
 * @param {function} props.onClick - Callback ao clicar no badge
 * @param {boolean} props.isEditMode - Se esta em modo de edicao
 * @param {function} props.onEdit - Callback para editar
 */
export default function OrgAdvisoryBadge({
  node,
  onClick,
  isEditMode = false,
  onEdit,
}) {
  const handleClick = () => {
    if (isEditMode && onEdit) {
      onEdit(node);
    } else if (onClick) {
      onClick(node);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="
        w-full flex items-center gap-2 px-2.5 py-2 rounded-md
        bg-card
        border border-dashed border-[#BDBDBD] dark:border-[#4A5A52]
        text-[#616161] dark:text-muted-foreground
        hover:bg-[#F5F5F5] dark:hover:bg-muted
        hover:border-[#9E9E9E] dark:hover:border-[#6B8178]
        active:scale-[0.98]
        transition-all duration-150
        text-left
        group
      "
      aria-label={`Comite consultivo: ${node.cargo}`}
    >
      {/* Barra de cor - indicador de tipo consultivo */}
      <div className="w-1 self-stretch rounded-full shrink-0 min-h-[24px] bg-[#BDBDBD] dark:bg-[#4A5A52]" />

      {/* Icone */}
      <div className="w-7 h-7 rounded-md bg-[#F5F5F5] dark:bg-muted flex items-center justify-center shrink-0">
        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground dark:text-muted-foreground" />
      </div>

      {/* Nome do comite */}
      <span className="flex-1 min-w-0 text-[13px] font-medium break-words">
        {node.cargo}
      </span>

      {/* Indicador de edicao */}
      {isEditMode && (
        <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <Pencil className="w-3.5 h-3.5" />
        </div>
      )}
    </button>
  );
}
