import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function ComunicadoItem({ text, isNew = false, className, ...props }) {
  return (
    <div
      data-slot="anest-comunicado-item"
      className={cn("flex items-start gap-2 md:gap-[10px] py-1", className)}
      {...props}
    >
      <span
        data-slot="anest-comunicado-bullet"
        aria-hidden="true"
        className={cn(
          "mt-[6px] md:mt-[7px] inline-block h-[5px] w-[5px] md:h-[6px] md:w-[6px] shrink-0 rounded-full",
          isNew
            ? "bg-[#006837] dark:bg-[#2ECC71] dark:shadow-[0_0_6px_#2ECC71]"
            : "bg-[#C8E6C9] dark:bg-[#344840]"
        )}
      />
      <p
        data-slot="anest-comunicado-text"
        className="text-[13px] md:text-[14px] font-medium text-[#002215] dark:text-[#A3B8B0]"
      >
        {text}
      </p>
    </div>
  )
}

export { ComunicadoItem }


