// QRCode.jsx
// Gerador de QR Code usando biblioteca qrcode
// QR codes funcionais e escaneáveis

import { useRef, useEffect, useCallback } from 'react'
import QRCodeLib from 'qrcode'
import { cn } from "@/design-system/utils/tokens"

/**
 * QRCode - Gerador de código QR funcional
 *
 * Features:
 * - Geração via biblioteca qrcode (QR codes reais e escaneáveis)
 * - Níveis de correção de erro (L, M, Q, H)
 * - Customização de cores
 * - Download em PNG
 * - Logo central (opcional)
 *
 * @example
 * <QRCode
 *   value="https://anest-ap.web.app"
 *   size={200}
 *   logo="/logo.png"
 * />
 */

function QRCode({
  value = '',
  size = 200,
  level = 'M', // L, M, Q, H
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  logo,
  logoSize = 0.2, // 20% of QR size
  logoMargin = 4,
  logoBorderRadius = 8,
  className,
  ...props
}) {
  const canvasRef = useRef(null)

  const generateQR = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    try {
      // Gerar QR code real usando a biblioteca qrcode
      await QRCodeLib.toCanvas(canvas, value, {
        width: size,
        margin: 2,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: level,
      })

      // Desenhar logo se fornecido
      if (logo) {
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const logoWidth = size * logoSize
          const logoHeight = size * logoSize
          const logoX = (size - logoWidth) / 2
          const logoY = (size - logoHeight) / 2

          // Fundo branco para o logo
          ctx.fillStyle = bgColor
          ctx.beginPath()
          ctx.roundRect(
            logoX - logoMargin,
            logoY - logoMargin,
            logoWidth + logoMargin * 2,
            logoHeight + logoMargin * 2,
            logoBorderRadius
          )
          ctx.fill()

          // Desenhar logo
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(logoX, logoY, logoWidth, logoHeight, logoBorderRadius - logoMargin / 2)
          ctx.clip()
          ctx.drawImage(img, logoX, logoY, logoWidth, logoHeight)
          ctx.restore()
        }
        img.src = logo
      }
    } catch (error) {
      console.error('Erro ao gerar QR code:', error)
    }
  }, [value, size, level, bgColor, fgColor, logo, logoSize, logoMargin, logoBorderRadius])

  useEffect(() => {
    generateQR()
  }, [generateQR])

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'qrcode.png'
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  if (!value) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-background dark:bg-[#27272A] rounded-xl",
          "border border-dashed border-border dark:border-[#3F3F46]",
          className
        )}
        style={{ width: size, height: size }}
      >
        <p className="text-sm text-primary dark:text-muted-foreground">
          Sem dados
        </p>
      </div>
    )
  }

  return (
    <div className={cn("inline-block", className)} {...props}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg"
        style={{ width: size, height: size }}
      />
    </div>
  )
}

// QR Code with card wrapper
function QRCodeCard({
  value,
  title,
  description,
  size = 180,
  showDownload = true,
  showCopy = true,
  className,
  ...props
}) {
  const handleDownload = () => {
    // Find canvas inside the QRCode component
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `qrcode-${title || 'download'}.png`
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      className={cn(
        "p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#18181B]",
        "border border-border dark:border-[#27272A]",
        "shadow-sm",
        className
      )}
      {...props}
    >
      {/* QR Code */}
      <div className="flex justify-center mb-4">
        <QRCode value={value} size={size} />
      </div>

      {/* Title & Description */}
      {(title || description) && (
        <div className="text-center mb-4">
          {title && (
            <h3 className="font-semibold text-foreground">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-primary dark:text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Value preview */}
      <div className="p-3 bg-background dark:bg-[#27272A] rounded-lg mb-4 border border-border dark:border-transparent">
        <p className="text-xs text-primary dark:text-muted-foreground font-mono break-all line-clamp-2">
          {value}
        </p>
      </div>

      {/* Actions */}
      {(showDownload || showCopy) && (
        <div className="flex gap-2">
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                "bg-background dark:bg-[#27272A]",
                "text-foreground border border-border dark:border-transparent",
                "hover:bg-muted dark:hover:bg-[#3F3F46]"
              )}
            >
              Copiar link
            </button>
          )}
          {showDownload && (
            <button
              type="button"
              onClick={handleDownload}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                "bg-gradient-to-r from-[#16A085] to-[#27AE60]",
                "text-white",
                "hover:from-[#138D75] hover:to-[#229954]"
              )}
            >
              Download
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Mini QR Code for inline use
function QRCodeMini({ value, size = 64, className, ...props }) {
  return (
    <QRCode
      value={value}
      size={size}
      className={cn("rounded", className)}
      {...props}
    />
  )
}

export { QRCode, QRCodeCard, QRCodeMini }
export default QRCode
