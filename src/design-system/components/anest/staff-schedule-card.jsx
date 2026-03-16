import * as React from "react"
import { FileText, Pencil, Umbrella } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { SectionCard } from "./section-card"
import { StaffListItem } from "./staff-list-item"

/**
 * StaffScheduleCard - Card de escala de equipe
 *
 * Usa SectionCard como shell e renderiza seções categorizadas de staff.
 * Cada seção pode ter ícone, label personalizado e lista de items (StaffListItem).
 * Suporta edição via botão Pencil no header (headerAction).
 *
 * @example
 * <StaffScheduleCard
 *   title="Escala de Plantão"
 *   sections={[
 *     {
 *       label: "Manhã",
 *       icon: <Sun className="h-4 w-4" />,
 *       variant: "default",
 *       items: [
 *         { nome: "Dr. Carlos Silva", turno: "07:00-13:00", funcoes: "Staff", status: "normal" },
 *         { nome: "Dra. Ana Costa", turno: "07:00-13:00", funcoes: "Residente R3", status: "normal" },
 *       ]
 *     },
 *     {
 *       label: "Férias",
 *       icon: <Umbrella className="h-4 w-4" />,
 *       variant: "warning",
 *       items: [
 *         { nome: "Dr. João Santos", turno: "20/12 - 05/01", status: "ferias" }
 *       ]
 *     }
 *   ]}
 *   onEdit={() => console.log('Edit clicked')}
 *   canEdit={true}
 * />
 */
function StaffScheduleCard({
  title = "Escala de Plantão",
  subtitle,
  meta,
  sections = [],
  onEdit,
  canEdit = true,
  variant = "default",
  className,
  ...props
}) {
  // Renderizar botão de edição se canEdit
  const headerAction = canEdit && onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full",
        "text-[#006837] dark:text-[#2ECC71]",
        "hover:bg-[#E8F5E9] dark:hover:bg-[#243530]",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label="Editar escala"
    >
      <Pencil className="h-5 w-5" strokeWidth={2} />
    </button>
  ) : null

  const titleContent = meta ? (
    <>
      {title}
      <p className="text-[13px] font-normal text-muted-foreground">{meta}</p>
    </>
  ) : title

  return (
    <SectionCard
      title={titleContent}
      subtitle={subtitle}
      variant={variant}
      headerAction={headerAction}
      className={className}
      {...props}
    >
      {sections.length > 0 ? (
        <div className="space-y-5">
          {sections.map((section, sectionIndex) => {
            const { label, icon, variant: sectionVariant = "default", items = [] } = section

            // Determinar ícone padrão para seção de férias
            const sectionIcon = icon || (label === "Férias" || label === "Licenças" ? (
              <Umbrella className="h-4 w-4" strokeWidth={2} />
            ) : label === "ATESTADO" ? (
              <FileText className="h-4 w-4" strokeWidth={2} />
            ) : null)

            return (
              <div
                key={`section-${sectionIndex}`}
                data-slot="staff-schedule-section"
                data-variant={sectionVariant}
              >
                {/* Label da seção com ícone opcional - Badge style igual aos círculos R1 */}
                {label ? (
                  <div className="mb-3 pt-1">
                    <div
                      data-slot="staff-schedule-section-label"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-[#E8F5E9] text-[#004225] dark:bg-[#1A2F23] dark:text-[#2ECC71]"
                    >
                      {sectionIcon ? (
                        <span className="inline-flex text-[#004225] dark:text-[#2ECC71]">
                          {sectionIcon}
                        </span>
                      ) : null}
                      <span>{label}</span>
                    </div>
                  </div>
                ) : null}

                {/* Lista de items */}
                {items.length > 0 ? (
                  <div className="space-y-0 pl-2.5">
                    {items.map((item, itemIndex) => (
                      <StaffListItem
                        key={`${section.label}-item-${itemIndex}`}
                        nome={item.nome}
                        turno={item.turno}
                        funcoes={item.funcoes}
                        observacao={item.observacao}
                        alertObs={item.alertObs}
                        status={item.status}
                        showDivider={itemIndex < items.length - 1}
                        onClick={item.onClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    data-slot="staff-schedule-section-empty"
                    className="py-4 text-center text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
                  >
                    Nenhum item nesta seção
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          data-slot="staff-schedule-card-empty"
          className="py-8 text-center text-[14px] text-[#9CA3AF] dark:text-[#6B8178]"
        >
          Nenhuma escala disponível
        </div>
      )}
    </SectionCard>
  )
}

export { StaffScheduleCard }
