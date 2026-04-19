// Wrappers lazy para PDFViewer e thumbnails.
// react-pdf + pdfjs pesam ~200KB — carregamos apenas quando necessário.
// Suspense global em App.jsx captura o fallback.
import { lazy } from 'react'

export const PDFViewer = lazy(() =>
  import('./pdf-viewer').then((m) => ({ default: m.PDFViewer }))
)

export const PDFThumbnail = lazy(() =>
  import('./pdf-viewer').then((m) => ({ default: m.PDFThumbnail }))
)

export const PDFThumbnailList = lazy(() =>
  import('./pdf-viewer').then((m) => ({ default: m.PDFThumbnailList }))
)

// ViewModeToggle também lazy para que pdf-viewer.jsx inteiro seja um chunk separado.
export const ViewModeToggle = lazy(() =>
  import('./pdf-viewer').then((m) => ({ default: m.ViewModeToggle }))
)
