/**
 * OrgAccordionItem - Item recursivo do organograma
 * Layout simétrico e harmonioso com hierarquia visual clara
 */

import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/design-system';
import {
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  MessageSquarePlus,
  Building2,
  UserCog,
  Stethoscope,
  ClipboardList,
  Users,
  Briefcase,
  MessageSquare,
  Info,
} from 'lucide-react';
import { getNodeHexColors } from './orgNodeColors';
import OrgAdvisoryBadge from './OrgAdvisoryBadge';

// Mapeamento de icones por tipo
const NODE_ICON_MAP = {
  governance: Building2,
  executive: UserCog,
  technical: Stethoscope,
  admin: ClipboardList,
  committee: Users,
  operational: Briefcase,
  advisory: MessageSquare,
};

// Helper para formatar responsável (pode ser string ou array)
const formatResponsavel = (responsavel) => {
  if (!responsavel) return null;
  if (Array.isArray(responsavel)) {
    return responsavel.join(', ');
  }
  return responsavel;
};

/**
 * Card base do organograma - componente reutilizável
 */
const OrgCard = ({
  node,
  colors,
  IconComponent,
  isEditMode,
  canShowDetails,
  level,
  onClick,
  onEdit,
  onDelete,
  onAddChild,
  onAddAdvisory,
  showChevron = false,
  isAccordionTrigger = false,
}) => {

  const content = (
    <>
      {/* Barra de cor vertical - indicador de tipo */}
      <div
        className="w-1 self-stretch rounded-full shrink-0 min-h-[36px]"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Ícone do tipo */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg }}
      >
        <IconComponent
          className="w-[18px] h-[18px]"
          style={{ color: colors.accent }}
        />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0 py-0.5 overflow-hidden">
        <p
          className="text-[14px] font-semibold leading-snug break-words"
          style={{ color: colors.text }}
        >
          {node.cargo}
        </p>
        {formatResponsavel(node.responsavel) && (
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 break-words">
            {formatResponsavel(node.responsavel)}
          </p>
        )}
      </div>

      {/* Área de ações - sempre alinhada à direita */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Modo visualização */}
        {!isEditMode && (
          <>
            {canShowDetails && !isAccordionTrigger && (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </>
        )}

        {/* Modo edição */}
        {isEditMode && (
          <>
            {/* Botão adicionar advisory (apenas executive) */}
            {node.tipo === 'executive' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAdvisory?.(node);
                }}
                className="p-2 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-muted transition-colors"
                aria-label="Adicionar consultivo"
              >
                <MessageSquarePlus className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
              </button>
            )}

            {/* Botão adicionar filho */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild?.(node);
              }}
              className="p-2 rounded-lg hover:bg-muted dark:hover:bg-[#1A3D2E] transition-colors"
              aria-label="Adicionar filho"
            >
              <Plus className="w-4 h-4 text-[#4CAF50] dark:text-[#66BB6A]" />
            </button>

            {/* Botão editar */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(node);
              }}
              className="p-2 rounded-lg hover:bg-[#E3F2FD] dark:hover:bg-[#1A237E] transition-colors"
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4 text-[#1565C0] dark:text-[#64B5F6]" />
            </button>

            {/* Botão remover (não para raiz) */}
            {level > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(node);
                }}
                className="p-2 rounded-lg hover:bg-[#FFEBEE] dark:hover:bg-[#B71C1C]/20 transition-colors"
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4 text-[#EF5350] dark:text-[#EF9A9A]" />
              </button>
            )}
          </>
        )}

        {/* Botão de detalhes para accordion triggers */}
        {!isEditMode && canShowDetails && isAccordionTrigger && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="p-2 rounded-lg hover:bg-muted dark:hover:bg-[#1A3D2E] transition-colors"
            aria-label="Ver detalhes"
          >
            <Info className="w-4 h-4 text-primary" />
          </button>
        )}

        {/* Chevron para expandir */}
        {showChevron && (
          <ChevronRight className="
            w-5 h-5 shrink-0 ml-1
            text-muted-foreground
            transition-transform duration-200
            group-data-[state=open]:rotate-90
          " />
        )}
      </div>
    </>
  );

  return content;
};

/**
 * Seção de comitês consultivos (advisory)
 */
const AdvisorySection = ({ advisories, isEditMode, onNodeClick, onEdit }) => {
  if (!advisories || advisories.length === 0) return null;

  return (
    <div className="mb-1.5 p-2 rounded-lg bg-[#FAFAFA] dark:bg-card/50 border border-dashed border-[#E0E0E0] dark:border-[#3A4A42]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MessageSquare className="w-3 h-3 text-muted-foreground dark:text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
          Consultivos
        </span>
      </div>
      <div className="space-y-1.5">
        {advisories.map((adv) => (
          <OrgAdvisoryBadge
            key={adv.id}
            node={adv}
            onClick={onNodeClick}
            isEditMode={isEditMode}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * @param {object} props
 * @param {object} props.node - Dados do no
 * @param {number} props.level - Nivel de profundidade (0 = raiz)
 * @param {function} props.onNodeClick - Callback ao clicar em um no (detalhes)
 * @param {boolean} props.isEditMode - Se esta em modo de edicao
 * @param {function} props.onEdit - Callback para editar
 * @param {function} props.onDelete - Callback para deletar
 * @param {function} props.onAddChild - Callback para adicionar filho
 * @param {function} props.onAddAdvisory - Callback para adicionar advisory
 */
export default function OrgAccordionItem({
  node,
  level = 0,
  onNodeClick,
  isEditMode = false,
  onEdit,
  onDelete,
  onAddChild,
  onAddAdvisory,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const hasAdvisory = node.advisory && node.advisory.length > 0;
  const colors = getNodeHexColors(node.tipo, false);
  const IconComponent = NODE_ICON_MAP[node.tipo] || Briefcase;

  // Assembleia Geral (level 0) nao mostra detalhes
  const canShowDetails = level > 0;

  // Wrapper com indentação visual através de borda
  const WrapperComponent = ({ children }) => {
    if (level === 0) {
      return <div className="space-y-1.5">{children}</div>;
    }
    return (
      <div className="relative pl-3 border-l-2 border-border ml-2">
        <div className="space-y-1.5">
          {children}
        </div>
      </div>
    );
  };

  // Se não tem filhos, renderiza como item clicável simples
  if (!hasChildren) {
    return (
      <WrapperComponent>
        {/* Seção advisory */}
        {hasAdvisory && (
          <AdvisorySection
            advisories={node.advisory}
            isEditMode={isEditMode}
            onNodeClick={onNodeClick}
            onEdit={onEdit}
          />
        )}

        {/* Card do item */}
        <button
          type="button"
          onClick={() => {
            if (isEditMode && onEdit) {
              onEdit(node);
            } else if (onNodeClick && canShowDetails) {
              onNodeClick(node);
            }
          }}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2.5
            bg-card
            border border-[#E5E7EB] dark:border-border
            hover:border-border dark:hover:border-[#3A4A42]
            hover:shadow-sm
            active:scale-[0.995]
            transition-all duration-150
            text-left
            ${level === 0 ? 'rounded-xl shadow-sm' : 'rounded-lg'}
            ${canShowDetails ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          <OrgCard
            node={node}
            colors={colors}
            IconComponent={IconComponent}
            isEditMode={isEditMode}
            canShowDetails={canShowDetails}
            level={level}
            onClick={() => onNodeClick?.(node)}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onAddAdvisory={onAddAdvisory}
          />
        </button>
      </WrapperComponent>
    );
  }

  // Item com filhos - usa AccordionItem
  return (
    <WrapperComponent>
      <AccordionItem value={node.id} className="border-0">
        {/* Trigger customizado */}
        <AccordionTrigger
          showIcon={false}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2.5
            bg-card
            border border-[#E5E7EB] dark:border-border
            hover:!border-border dark:hover:!border-[#3A4A42]
            hover:!shadow-sm
            data-[state=open]:!border-border dark:data-[state=open]:!border-[#3A4A42]
            data-[state=open]:!shadow-sm
            active:scale-[0.995]
            transition-all duration-150
            ${level === 0 ? 'rounded-xl shadow-sm' : 'rounded-lg'}
          `}
        >
          <OrgCard
            node={node}
            colors={colors}
            IconComponent={IconComponent}
            isEditMode={isEditMode}
            canShowDetails={canShowDetails}
            level={level}
            onClick={() => onNodeClick?.(node)}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onAddAdvisory={onAddAdvisory}
            showChevron={true}
            isAccordionTrigger={true}
          />
        </AccordionTrigger>

        {/* Conteúdo expandível */}
        <AccordionContent className="pt-1.5 pb-0">
          {/* Seção advisory */}
          {hasAdvisory && (
            <div className="pl-3 border-l-2 border-border ml-2 mb-1.5">
              <AdvisorySection
                advisories={node.advisory}
                isEditMode={isEditMode}
                onNodeClick={onNodeClick}
                onEdit={onEdit}
              />
            </div>
          )}

          {/* Filhos recursivos */}
          <div className="space-y-1.5">
            {node.children.map((child) => (
              <OrgAccordionItem
                key={child.id}
                node={child}
                level={level + 1}
                onNodeClick={onNodeClick}
                isEditMode={isEditMode}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onAddAdvisory={onAddAdvisory}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </WrapperComponent>
  );
}
