// AspectRatio.jsx
// Container que mantém proporção de aspecto
// Baseado em: Radix UI AspectRatio

import { cn } from "@/design-system/utils/tokens"

/**
 * AspectRatio - Mantém proporção de largura/altura
 *
 * Útil para:
 * - Imagens responsivas
 * - Vídeos embed
 * - Thumbnails consistentes
 * - Previews de mídia
 *
 * @example
 * <AspectRatio ratio={16 / 9}>
 *   <img src="..." alt="..." className="object-cover w-full h-full" />
 * </AspectRatio>
 *
 * // Proporções comuns:
 * // 1/1 = Quadrado
 * // 4/3 = TV antiga, iPad
 * // 16/9 = Widescreen, YouTube
 * // 21/9 = Ultrawide
 * // 3/2 = Fotografia clássica
 * // 2/3 = Retrato (stories)
 */

function AspectRatio({
  ratio = 1,
  children,
  className,
  ...props
}) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn("relative w-full", className)}
      style={{ paddingBottom: `${100 / ratio}%` }}
      {...props}
    >
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  )
}

// Preset ratios para conveniência
AspectRatio.Square = (props) => <AspectRatio ratio={1} {...props} />
AspectRatio.Video = (props) => <AspectRatio ratio={16 / 9} {...props} />
AspectRatio.Photo = (props) => <AspectRatio ratio={3 / 2} {...props} />
AspectRatio.Portrait = (props) => <AspectRatio ratio={2 / 3} {...props} />
AspectRatio.Classic = (props) => <AspectRatio ratio={4 / 3} {...props} />
AspectRatio.Ultrawide = (props) => <AspectRatio ratio={21 / 9} {...props} />

export { AspectRatio }
export default AspectRatio
