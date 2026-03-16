// PDFViewer.jsx
// Visualizador de PDF simples e funcional
// Usa react-pdf + react-zoom-pan-pinch para pinch-to-zoom

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

// Configuração do worker do PDF.js - usar a versão que vem com react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

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
        "text-[#6B7280] hover:text-[#002215] hover:bg-[#E8F5E9]",
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
  className,
  onError,
  onLoad,
  ...props
}) {
  const containerRef = useRef(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [useFallback, setUseFallback] = useState(false)
  const [scale, setScale] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  // Fechar fullscreen com ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  // Callbacks
  const onDocumentLoadSuccess = useCallback(({ numPages: total }) => {
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

  // Navegação
  const prevPage = () => setPageNumber(p => Math.max(1, p - 1))
  const nextPage = () => setPageNumber(p => Math.min(numPages || 1, p + 1))

  // Download
  const handleDownload = () => {
    if (src) {
      window.open(src, '_blank')
    }
  }

  // Abrir externa
  const handleOpenExternal = () => {
    if (src) {
      window.open(src, '_blank')
    }
  }

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
          "bg-[#E8F5E9] dark:bg-gray-800",
          "border-2 border-dashed border-[#A5D6A7] dark:border-gray-600",
          className
        )}
        style={{ height }}
      >
        <p className="text-[#6B7280] dark:text-gray-400">
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
        "bg-[#F0FFF4] dark:bg-gray-900",
        "shadow-sm",
        isFullscreen
          ? "fixed inset-0 z-[9999] rounded-none border-none"
          : "rounded-xl border border-[#A5D6A7] dark:border-gray-700",
        className
      )}
      style={{ height: isFullscreen ? '100vh' : height }}
      {...props}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          isFullscreen
            ? "bg-gradient-to-b from-black/60 to-black/40 border-transparent"
            : "bg-[#E8F5E9] dark:bg-gray-800 border-[#A5D6A7] dark:border-gray-700"
        )}
        style={isFullscreen ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' } : undefined}
      >
        {/* Botão Voltar (apenas em fullscreen) - estilo consistente com ExpandedImageModal */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/25 hover:bg-white/40 text-white transition-colors backdrop-blur-sm border border-white/20"
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
          {/* Navegação de páginas */}
          {numPages && numPages > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <ToolbarButton onClick={prevPage} disabled={pageNumber <= 1} label="Página anterior">
                <Icons.ChevronLeft className={cn("w-4 h-4", isFullscreen && "text-white")} />
              </ToolbarButton>
              <span className={cn(
                "text-xs font-medium px-2 tabular-nums",
                isFullscreen ? "text-white/80" : "text-gray-600 dark:text-gray-400"
              )}>
                {pageNumber}/{numPages}
              </span>
              <ToolbarButton onClick={nextPage} disabled={pageNumber >= numPages} label="Próxima página">
                <Icons.ChevronRight className={cn("w-4 h-4", isFullscreen && "text-white")} />
              </ToolbarButton>
            </div>
          )}

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
            className="p-2.5 rounded-full bg-white/25 hover:bg-white/40 text-white transition-colors backdrop-blur-sm border border-white/20"
          >
            <Icons.Close className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Área do PDF */}
      <div className="relative flex-1 bg-gray-600 overflow-hidden">
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
            src={src}
            className="w-full h-full border-0"
            title={title}
          />
        )}

        {/* PDF com Zoom (react-pdf) */}
        {!error && !useFallback && (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit
            limitToBounds
            wheel={{ step: 0.15, smoothStep: 0.001 }}
            pinch={{ disabled: false }}
            doubleClick={{ mode: 'reset' }}
            velocityAnimation={{ disabled: true }}
            alignmentAnimation={{ disabled: false }}
            zoomAnimation={{ animationTime: 150, animationType: 'easeOut' }}
            onTransformed={(ref, state) => {
              setScale(state.scale)
            }}
          >
            {() => (
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: '100%',
                }}
                contentStyle={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  padding: '16px',
                }}
              >
                <Document
                  file={src}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={null}
                  options={options}
                >
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-2xl"
                    width={Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 64 : 600)}
                  />
                </Document>
              </TransformComponent>
            )}
          </TransformWrapper>
        )}

        {/* Indicador de zoom */}
        {!useFallback && scale !== 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full">
            <span className="text-white text-xs font-medium tabular-nums">
              {Math.round(scale * 100)}%
            </span>
          </div>
        )}

        {/* Dica de uso (apenas em fullscreen e sem zoom) */}
        {!useFallback && isFullscreen && scale === 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full">
            <span className="text-white/80 text-xs">
              Pinça para zoom • Toque duplo para resetar
            </span>
          </div>
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
  src,
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
          "border border-[#A5D6A7] dark:border-gray-700",
          "shadow-sm hover:shadow-lg",
          "hover:border-[#006837] dark:hover:border-green-600",
          className
        )}
        {...props}
      >
        <div className="flex h-full flex-col">
          {/* Ícone */}
          <div className="flex items-start justify-between gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center border border-[#A5D6A7]">
              <span className="text-2xl">📄</span>
            </div>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-[#004225] dark:bg-gray-700 text-white dark:text-gray-300">
              PDF
            </span>
          </div>

          {/* Título */}
          <div className="mt-auto space-y-1">
            <p className="line-clamp-2 text-[15px] font-bold leading-snug text-[#004225] dark:text-white">
              {title || 'Documento'}
            </p>
            <p className="text-[12px] text-[#006837] dark:text-gray-400">
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
        "border border-[#A5D6A7] dark:border-gray-700",
        "hover:border-[#006837] hover:shadow-md",
        "text-left",
        className
      )}
      {...props}
    >
      <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center border border-[#A5D6A7]">
        <span className="text-xl">📄</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#004225] dark:text-white truncate">
          {title || 'Documento'}
        </p>
        {description && (
          <p className="text-xs text-[#006837] dark:text-gray-400 truncate mt-0.5">
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
    <div className="flex items-center rounded-lg p-1 bg-[#E8F5E9] dark:bg-gray-800 border border-[#A5D6A7] dark:border-gray-700">
      <button
        type="button"
        onClick={() => onViewModeChange('card')}
        className={cn(
          "p-2 rounded-md transition-all",
          viewMode === 'card'
            ? "bg-green-500 text-white"
            : "text-[#6B7280] hover:text-[#006837] dark:hover:text-gray-300"
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
            : "text-[#6B7280] hover:text-[#006837] dark:hover:text-gray-300"
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
