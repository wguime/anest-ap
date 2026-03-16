import * as React from "react"
import { AlertCircle, FileText, Umbrella } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"

/**
 * StaffListItem - Item de lista de staff/equipe
 *
 * Layout vertical com:
 * - Nome e turno na linha principal (flex justify-between)
 * - Observação abaixo (indentada com ↳, gray, 12px) se presente
 * - Funções abaixo (indentadas com ↳, gray, 12px) se presente
 * - Badge de alerta (amber) com AlertCircle se alertObs presente
 * - Badge de férias (orange) com Umbrella se status="ferias"
 *
 * Cores:
 * - Nome: black (#000000) / white (#FFFFFF) dark
 * - Turno: green (#006837) / light green (#2ECC71) dark
 * - Observação/Funções: gray (#9CA3AF) / muted green (#6B8178) dark
 *
 * @example
 * <StaffListItem
 *   nome="Dr. Carlos Silva"
 *   turno="07:00-13:00"
 *   funcoes="Staff, Coordenador"
 *   observacao="Priorizar sala 3"
 *   alertObs="Restrição medicamentosa"
 *   status="normal"
 * />
 *
 * <StaffListItem
 *   nome="Dra. Ana Costa"
 *   turno="20/12 - 05/01"
 *   status="ferias"
 * />
 */
function StaffListItem({
  nome,
  turno,
  funcoes,
  observacao,
  alertObs,
  status = "normal",
  showDivider = true,
  isLast = false,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"
  const isFerias = status === "ferias"

  // Determinar se deve mostrar divisor
  const shouldShowDivider = showDivider && !isLast

  return (
    <div
      data-slot="anest-staff-list-item"
      data-status={status}
      className={cn(
        "py-1.5", // Reduzido para py-1.5 (~6px) para compactar mais
        shouldShowDivider
          ? "border-b border-[#F3F4F6] dark:border-[#2A3F36]"
          : null,
        isClickable
          ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      {/* Layout com nome/funções à esquerda e horários à direita */}
      <div className="flex items-start justify-between gap-3">
        {/* Coluna esquerda: Nome + Funções + Observação */}
        <div className="min-w-0 flex-1">
          {/* Nome */}
          <div
            data-slot="anest-staff-list-item-nome"
            className="text-[15px] font-bold text-[#004225] dark:text-[#FFFFFF]"
          >
            {nome}
          </div>

          {/* Funções (se presente) - logo abaixo do nome */}
          {funcoes ? (
            <div
              data-slot="anest-staff-list-item-funcoes"
              className="mt-[3px] flex items-start gap-1.5"
            >
              <span
                className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]"
                aria-hidden="true"
              >
                ↳
              </span>
              <div className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] flex-1 leading-relaxed">
                {funcoes}
              </div>
            </div>
          ) : null}

          {/* Observação (se presente) */}
          {observacao ? (
            <div
              data-slot="anest-staff-list-item-observacao"
              className="mt-[3px] flex items-start gap-1.5"
            >
              <span
                className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]"
                aria-hidden="true"
              >
                ↳
              </span>
              <div className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] flex-1 leading-relaxed">
                {observacao}
              </div>
            </div>
          ) : null}
        </div>

        {/* Coluna direita: Turno (horários simétricos) */}
        {turno ? (
          <div
            data-slot="anest-staff-list-item-turno"
            className="shrink-0 text-right"
          >
            {turno.split(' / ').map((periodo, idx) => (
              <div
                key={idx}
                className="text-[16px] font-bold tabular-nums text-[#9BC53D] dark:text-[#2ECC71] dark:drop-shadow-[0_0_10px_rgba(46,204,113,0.15)] whitespace-nowrap"
              >
                {periodo.replace(/\s*(?:as|às)\s*/gi, '-')}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Badge de alerta - abaixo da descrição, ocupando toda a largura */}
      {alertObs ? (
        <div className="mt-2 flex items-start gap-1.5">
          <Badge
            variant="warning"
            badgeStyle="solid"
            className="inline-flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" strokeWidth={2} />
            <span>Obs</span>
          </Badge>
          <div className="text-[13px] text-[#92400E] dark:text-[#FCD34D] flex-1 leading-relaxed">
            {alertObs}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { StaffListItem }
