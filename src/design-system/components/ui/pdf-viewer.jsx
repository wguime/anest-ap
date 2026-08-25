// PDFViewer.jsx
// Visualizador de PDF simples e funcional
// Usa react-pdf + react-zoom-pan-pinch para pinch-to-zoom

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { cn } from "@/design-system/utils/tokens"
import { useLandscapePermitido } from "@/hooks/useLandscapePermitido"

// Worker local — evita latência CDN, funciona offline, sem risco de version mismatch.
// Atribuição INCONDICIONAL: o próprio react-pdf v10 já seta o default relativo
// 'pdf.worker.mjs' (arquivo que não existe no app) ao ser importado, então um
// guard `if (!workerSrc)` nunca dispara e todo PDF caía no iframe fallback.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Ícones simples
const Icons = {
  ZoomIn: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  ),
  ZoomOut: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M8 11h6" />
    </svg>
  ),
  Reset: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  ),
  ChevronLeft: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  ChevronRight: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  Download: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  External: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  ),
  Fullscreen: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  ExitFullscreen: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
  ),
  Close: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Grid: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
}

// Botão da toolbar
function ToolbarButton({ onClick, disabled, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted",
        "dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
      aria-label={label}
    >
      {children}
    </button>
  )
}

/**
 * PDFViewer - Visualizador de PDF com pinch-to-zoom
 */
function PDFViewer({
  src,
  title = 'Documento PDF',
  height = '500px',
  showTitle = true,
  showToolbar = true,
  className,
  onError,
  onLoad,
  ...props
}) {
  const containerRef = useRef(null)
  const pdfAreaRef = useRef(null)
  const [numPages, setNumPages] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [useFallback, setUseFallback] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [baseWidth, setBaseWidth] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Documento é a exceção da trava de retrato: página A4 deitada no celular
  // ganha ~2x de largura útil. Vale enquanto o viewer estiver montado.
  useLandscapePermitido()

  // Largura "fit-to-width": acompanha o container (responsivo) via ResizeObserver.
  // baseWidth = largura útil da área de scroll; pageWidth aplica o zoom por cima.
  useEffect(() => {
    const el = pdfAreaRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      // -24px = padding px-3 das duas laterais; cap evita páginas absurdas no desktop
      if (w > 0) setBaseWidth(Math.min(1400, Math.max(240, w - 24)))
    }
    measure()
    // 2ª medição no próximo frame: portal de fullscreen pode não ter layout ainda
    const raf = requestAnimationFrame(measure)
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [useFallback, error, isFullscreen])

  const pageWidth = baseWidth > 0 ? Math.round(baseWidth * zoom) : undefined

  // Bloquear scroll do body quando fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullscreen])

  // Fechar fullscreen com ESC (listener só ativo quando em fullscreen)
  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  // Callbacks
  const onDocumentLoadSuccess = useCallback(({ numPages: total }) => {
    if (!total || total < 1) {
      setError('Documento sem páginas ou corrompido.')
      setIsLoading(false)
      return
    }
    setNumPages(total)
    setIsLoading(false)
    setError(null)
    onLoad?.()
  }, [onLoad])

  const onDocumentLoadError = useCallback((err) => {
    console.warn('PDF react-pdf failed, trying iframe fallback:', err?.message || err)
    setUseFallback(true)
    setIsLoading(false)
    onError?.(err)
  }, [onError])

  // Zoom por botões (fit-to-width = 1.0). Native pinch-zoom continua via touch-action.
  const zoomIn = () => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))
  const zoomOut = () => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))
  const resetZoom = () => setZoom(1)

  // Fullscreen (usando CSS fixed ao invés de API nativa)
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev)
  }

  // Opções do documento
  const options = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }), [])

  // Estado vazio
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl",
          "bg-muted dark:bg-gray-800",
          "border-2 border-dashed border-border dark:border-gray-600",
          className
        )}
        style={{ height }}
      >
        <p className="text-muted-foreground dark:text-gray-400">
          Nenhum documento selecionado
        </p>
      </div>
    )
  }

  // Conteúdo do viewer
  const viewerContent = (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden",
        "bg-background dark:bg-gray-900",
        "shadow-sm",
        isFullscreen
          ? "fixed inset-0 z-[9999] rounded-none border-none"
          : "rounded-xl border border-border dark:border-gray-700",
        className
      )}
      style={{ height: isFullscreen ? '100dvh' : height }}
      {...props}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          isFullscreen
            ? "bg-gradient-to-b from-black/60 to-black/40 border-transparent"
            : "bg-muted dark:bg-gray-800 border-border dark:border-gray-700",
          !showToolbar && !isFullscreen && "hidden"
        )}
        style={isFullscreen ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' } : undefined}
      >
        {/* Botão Voltar (apenas em fullscreen) - estilo consistente com ExpandedImageModal */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass-surface hover:opacity-90 text-white transition-colors border border-white/20"
          >
            <Icons.ExitFullscreen className="w-5 h-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
        )}

        {/* Título (apenas quando não fullscreen e showTitle=true) */}
        {!isFullscreen && showTitle && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg">📄</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {title}
            </span>
          </div>
        )}

        {/* Controles */}
        <div className={cn(
          "flex items-center gap-1",
          isFullscreen && "flex-1 justify-center"
        )}>
          {/* Contagem de páginas */}
          {numPages && numPages > 1 && (
            <span className={cn(
              "text-xs font-medium px-2 tabular-nums hidden sm:inline",
              isFullscreen ? "text-white/80" : "text-gray-600 dark:text-gray-400"
            )}>
              {numPages} páginas
            </span>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <ToolbarButton onClick={zoomOut} disabled={zoom <= 0.5} label="Diminuir zoom">
              <Icons.ZoomOut className={cn("w-4 h-4", isFullscreen && "text-white")} />
            </ToolbarButton>
            <button
              type="button"
              onClick={resetZoom}
              className={cn(
                "text-xs font-medium px-1.5 tabular-nums min-w-[3rem] transition-colors",
                isFullscreen ? "text-white/80 hover:text-white" : "text-gray-600 dark:text-gray-400 hover:text-foreground"
              )}
              aria-label="Restaurar zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <ToolbarButton onClick={zoomIn} disabled={zoom >= 3} label="Aumentar zoom">
              <Icons.ZoomIn className={cn("w-4 h-4", isFullscreen && "text-white")} />
            </ToolbarButton>
          </div>

          {/* Fullscreen (apenas quando não fullscreen) */}
          {!isFullscreen && (
            <ToolbarButton onClick={toggleFullscreen} label="Tela cheia">
              <Icons.Fullscreen className="w-4 h-4" />
            </ToolbarButton>
          )}
        </div>

        {/* Botão X (apenas em fullscreen) - estilo consistente com ExpandedImageModal */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full glass-surface hover:opacity-90 text-white transition-colors border border-white/20"
          >
            <Icons.Close className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Área do PDF — scroll nativo vertical (swipe de baixo p/ cima rola as páginas) */}
      <div
        ref={pdfAreaRef}
        className="relative flex-1 bg-gray-600 overflow-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {/* Loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-gray-600 z-10"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ willChange: "transform" }}
                />
                <p className="text-white/80 text-sm">Carregando...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error (only if both react-pdf AND fallback fail) */}
        {error && !useFallback && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-600 z-10">
            <div className="flex flex-col items-center gap-4 text-center px-4">
              <span className="text-4xl">⚠️</span>
              <p className="text-white/90 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Iframe fallback when react-pdf fails (e.g. CORS) */}
        {useFallback && (
          <iframe
            src={showToolbar ? src : `${src}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            title={title}
          />
        )}

        {/* PDF — todas as páginas em coluna, largura ajustada ao container.
            Aguarda baseWidth medido p/ não renderizar área vazia (flash em branco). */}
        {!error && !useFallback && baseWidth > 0 && (
          <Document
            file={src}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            options={options}
          >
            {pageWidth && numPages > 0 && (
              <div className="flex flex-col items-center gap-3 px-3 py-3">
                {Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={i + 1}
                    pageNumber={i + 1}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-2xl !h-auto"
                    loading={null}
                  />
                ))}
              </div>
            )}
          </Document>
        )}

        {/* Botão flutuante de tela cheia quando a toolbar está oculta (ex.: anexo em Comunicados) */}
        {!useFallback && !error && !isFullscreen && !showToolbar && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Tela cheia"
            className="absolute bottom-4 right-4 z-20 p-2.5 rounded-full glass-surface text-white border border-white/20 hover:opacity-90 transition-opacity"
          >
            <Icons.Fullscreen className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )

  // Usar portal quando fullscreen para escapar do contexto de overflow do modal pai
  if (isFullscreen) {
    return createPortal(viewerContent, document.body)
  }

  return viewerContent
}

/**
 * PDFThumbnail - Card de preview de PDF
 */
function PDFThumbnail({
  _src,
  title,
  description,
  onClick,
  viewMode = 'card',
  className,
  ...props
}) {
  if (viewMode === 'card') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full h-[160px]",
          "flex flex-col text-left",
          "rounded-[20px] p-4 transition-all",
          "bg-gradient-to-br from-[#FFFFFF] to-[#F0FFF4] dark:bg-gray-800 dark:from-gray-800 dark:to-gray-800",
          "border border-border dark:border-gray-700",
          "shadow-sm hover:shadow-lg",
          "hover:border-primary dark:hover:border-green-600",
          className
        )}
        {...props}
      >
        <div className="flex h-full flex-col">
          {/* Ícone */}
          <div className="flex items-start justify-between gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted dark:bg-green-900/30 flex items-center justify-center border border-border">
              <span className="text-2xl">📄</span>
            </div>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-primary dark:bg-gray-700 text-white dark:text-gray-300">
              PDF
            </span>
          </div>

          {/* Título */}
          <div className="mt-auto space-y-1">
            <p className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
              {title || 'Documento'}
            </p>
            <p className="text-[12px] text-primary dark:text-gray-400">
              {description || 'Toque para abrir'}
            </p>
          </div>
        </div>
      </motion.button>
    )
  }

  // List view
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl transition-all",
        "bg-gradient-to-r from-[#FFFFFF] to-[#F0FFF4] dark:bg-gray-800 dark:from-gray-800 dark:to-gray-800",
        "border border-border dark:border-gray-700",
        "hover:border-primary hover:shadow-md",
        "text-left",
        className
      )}
      {...props}
    >
      <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-muted dark:bg-green-900/30 flex items-center justify-center border border-border">
        <span className="text-xl">📄</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {title || 'Documento'}
        </p>
        {description && (
          <p className="text-xs text-primary dark:text-gray-400 truncate mt-0.5">
            {description}
          </p>
        )}
      </div>
    </motion.button>
  )
}

/**
 * ViewModeToggle - Alternar entre card e lista
 */
function ViewModeToggle({ viewMode, onViewModeChange }) {
  return (
    <div className="flex items-center rounded-lg p-1 bg-muted dark:bg-gray-800 border border-border dark:border-gray-700">
      <button
        type="button"
        onClick={() => onViewModeChange('card')}
        className={cn(
          "p-2 rounded-md transition-all",
          viewMode === 'card'
            ? "bg-green-500 text-white"
            : "text-muted-foreground hover:text-primary dark:hover:text-gray-300"
        )}
        aria-label="Visualizar em cards"
      >
        <Icons.Grid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('list')}
        className={cn(
          "p-2 rounded-md transition-all",
          viewMode === 'list'
            ? "bg-green-500 text-white"
            : "text-muted-foreground hover:text-primary dark:hover:text-gray-300"
        )}
        aria-label="Visualizar em lista"
      >
        <Icons.List className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * PDFThumbnailList - Lista de thumbnails de PDF
 */
function PDFThumbnailList({
  documents = [],
  onDocumentClick,
  defaultViewMode = 'card',
  showViewToggle = true,
  title,
  className,
  ...props
}) {
  const [viewMode, setViewMode] = useState(defaultViewMode)

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {title && (
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        )}
        {showViewToggle && documents.length > 0 && (
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        )}
      </div>

      {/* Grid/List */}
      <div
        className={cn(
          viewMode === 'card'
            ? "grid grid-cols-2 gap-3"
            : "flex flex-col gap-2"
        )}
      >
        {documents.map((doc, index) => (
          <PDFThumbnail
            key={doc.id || index}
            src={doc.src}
            title={doc.title}
            description={doc.description}
            viewMode={viewMode}
            onClick={() => onDocumentClick?.(doc, index)}
          />
        ))}
      </div>

      {/* Empty */}
      {documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <span className="text-4xl mb-3">📄</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum documento encontrado
          </p>
        </div>
      )}
    </div>
  )
}

export { PDFViewer, PDFThumbnail, PDFThumbnailList, ViewModeToggle }
export default PDFViewer
