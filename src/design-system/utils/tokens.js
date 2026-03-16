import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import tokensData from "../Tokens.json"

/**
 * shadcn/ui helper (JS version)
 * Components will import `cn` from the path configured in `components.json` -> aliases.utils
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// NOTE:
// O Design System exporta `tokens` (JSON) via `@/design-system`:
//   export { default as tokens } from "./Tokens.json"
// Para evitar conflito de exports ("Duplicate export 'tokens'"), aqui expomos como `tokensJson`.
export const tokensJson = tokensData

/**
 * Converts HEX color (#RRGGBB or #RGB) to an HSL triplet string: "H S% L%"
 * Useful if you want to generate theme variables from Tokens.json programmatically.
 */
export function hexToHsl(hex) {
  if (!hex || typeof hex !== "string") return null

  let h = hex.trim().replace("#", "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (h.length !== 6) return null

  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let hue = 0
  let sat = 0
  const light = (max + min) / 2

  const d = max - min
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * light - 1))
    switch (max) {
      case r:
        hue = ((g - b) / d) % 6
        break
      case g:
        hue = (b - r) / d + 2
        break
      case b:
        hue = (r - g) / d + 4
        break
      default:
        hue = 0
    }
    hue = Math.round(hue * 60)
    if (hue < 0) hue += 360
  }

  const sPct = Math.round(sat * 100)
  const lPct = Math.round(light * 100)
  return `${hue} ${sPct}% ${lPct}%`
}


