/**
 * pdfBranding.js - ANEST PDF branding utilities
 *
 * Extracted from certificateGenerator.js patterns.
 * Provides header, footer, section titles, and color constants
 * for consistent ANEST-branded PDF reports.
 */

let _jsPDF = null
export async function getJsPDF() {
  if (!_jsPDF) {
    const mod = await import('jspdf')
    _jsPDF = mod.default
  }
  return _jsPDF
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ANEST_COLORS = {
  primaryDark: [0, 104, 55],    // #006837
  primary: [0, 66, 37],         // #004225
  accent: [46, 204, 113],       // #2ECC71
  teal: [22, 160, 133],         // #16a085
  warning: [245, 158, 11],      // #F59E0B
  danger: [220, 38, 38],        // #DC2626
  success: [5, 150, 105],       // #059669
  gray: [107, 114, 128],        // #6B7280
  lightGray: [156, 163, 175],   // #9CA3AF
  white: [255, 255, 255],
  black: [17, 24, 39],          // #111827
  lightBg: [240, 255, 244],     // #F0FFF4
  tableBorder: [200, 230, 201], // #C8E6C9
  tableHeader: [232, 245, 233], // #E8F5E9
}

export const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 45,
  marginBottom: 25,
  contentWidth: 180, // 210 - 15 - 15
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Sanitizes text for safe rendering in jsPDF standard fonts.
 * Strips diacritics (accents) that cause broken character spacing.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeForPdf(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ============================================================================
// LOGO LOADING
// ============================================================================

let cachedLogo = null

/**
 * Loads the ANEST logo as base64 PNG.
 * Caches the result for subsequent calls.
 * @returns {Promise<string|null>} base64 data URL or null on failure
 */
export async function loadAnestLogo() {
  if (cachedLogo !== null) return cachedLogo

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      cachedLogo = canvas.toDataURL('image/png')
      resolve(cachedLogo)
    }
    img.onerror = () => {
      cachedLogo = null
      resolve(null)
    }
    img.src = '/logo-anest.png'
  })
}

// ============================================================================
// HEADER
// ============================================================================

/**
 * Adds the ANEST header to a jsPDF page.
 * Green top bar + logo + title + subtitle + separator line.
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {string} title - Report title
 * @param {string} [subtitle] - Optional subtitle
 * @param {string|null} [logoBase64] - Logo as base64 (from loadAnestLogo)
 * @returns {number} Y position after header (for content to start)
 */
export function addHeader(doc, title, subtitle, logoBase64 = null) {
  // Green top bar (6mm)
  doc.setFillColor(...ANEST_COLORS.primaryDark)
  doc.rect(0, 0, PAGE.width, 6, 'F')

  // Logo
  let textStartX = PAGE.marginLeft
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', PAGE.marginLeft, 10, 25, 25)
      textStartX = PAGE.marginLeft + 30
    } catch (e) {
      console.warn('Error adding logo to PDF:', e)
    }
  }

  // Institution name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ANEST_COLORS.primary)
  doc.text('ANEST - Servico de Anestesiologia', textStartX, 17)

  // Report title
  doc.setFontSize(14)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  doc.text(title, textStartX, 25)

  // Subtitle / date
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...ANEST_COLORS.gray)
    doc.text(subtitle, textStartX, 31)
  }

  // Generation date on the right
  const dataStr = new Date().toLocaleDateString('pt-BR')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...ANEST_COLORS.lightGray)
  doc.text(`Gerado em: ${dataStr}`, PAGE.width - PAGE.marginRight, 31, { align: 'right' })

  // Separator line
  doc.setDrawColor(...ANEST_COLORS.primaryDark)
  doc.setLineWidth(0.8)
  doc.line(PAGE.marginLeft, 36, PAGE.width - PAGE.marginRight, 36)

  // Thin accent line below
  doc.setDrawColor(...ANEST_COLORS.accent)
  doc.setLineWidth(0.3)
  doc.line(PAGE.marginLeft, 37.5, PAGE.width - PAGE.marginRight, 37.5)

  return PAGE.marginTop
}

// ============================================================================
// FOOTER
// ============================================================================

/**
 * Adds footer to a jsPDF page.
 * Page numbers + ANEST text + green bottom bar.
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} pageNum - Current page number
 * @param {number} totalPages - Total pages
 */
export function addFooter(doc, pageNum, totalPages) {
  const footerY = PAGE.height - 18

  // ANEST text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  doc.text('ANEST - Qualidade e Seguranca do Paciente', PAGE.marginLeft, footerY)

  // Page numbers
  doc.setTextColor(...ANEST_COLORS.lightGray)
  doc.text(
    `Pagina ${pageNum} de ${totalPages}`,
    PAGE.width - PAGE.marginRight,
    footerY,
    { align: 'right' }
  )

  // Generation date
  const dataStr = new Date().toLocaleDateString('pt-BR')
  doc.text(dataStr, PAGE.width / 2, footerY, { align: 'center' })

  // Green bottom bar (4mm)
  doc.setFillColor(...ANEST_COLORS.primaryDark)
  doc.rect(0, PAGE.height - 4, PAGE.width, 4, 'F')
}

// ============================================================================
// SECTION TITLE
// ============================================================================

/**
 * Adds a green section title bar.
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} y - Y position
 * @param {string} title - Section title text
 * @returns {number} Y position after the section title
 */
export function addSectionTitle(doc, y, title) {
  // Green background bar
  doc.setFillColor(...ANEST_COLORS.tableHeader)
  doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 8, 1, 1, 'F')

  // Left accent
  doc.setFillColor(...ANEST_COLORS.primaryDark)
  doc.rect(PAGE.marginLeft, y, 3, 8, 'F')

  // Title text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...ANEST_COLORS.primaryDark)
  doc.text(title, PAGE.marginLeft + 6, y + 5.5)

  return y + 12
}

// ============================================================================
// TABLE HELPERS
// ============================================================================

/**
 * Draws a simple data table.
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} startY - Starting Y position
 * @param {Array<{label: string, width: number, align?: string}>} columns - Column definitions
 * @param {Array<Array<string>>} rows - Row data (array of arrays)
 * @param {Object} [options] - Optional settings
 * @param {number} [options.rowHeight=6] - Row height
 * @param {number} [options.fontSize=7] - Font size
 * @param {Function} [options.rowStyle] - (rowIndex, row) => { fillColor?, textColor? }
 * @returns {number} Y position after the table
 */
export function drawTable(doc, startY, columns, rows, options = {}) {
  const { rowHeight = 6, fontSize = 7, rowStyle } = options
  let y = startY

  // Helper: render column headers (reused on page breaks)
  function renderColumnHeaders(atY) {
    doc.setFillColor(...ANEST_COLORS.primaryDark)
    doc.rect(PAGE.marginLeft, atY, PAGE.contentWidth, rowHeight + 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fontSize)
    doc.setTextColor(...ANEST_COLORS.white)

    let hx = PAGE.marginLeft + 2
    columns.forEach((col) => {
      const align = col.align || 'left'
      const textX = align === 'center' ? hx + col.width / 2 : align === 'right' ? hx + col.width - 2 : hx
      doc.text(sanitizeForPdf(col.label), textX, atY + rowHeight - 1, { align })
      hx += col.width
    })

    return atY + rowHeight + 1
  }

  y = renderColumnHeaders(y)

  // Data rows
  let x
  rows.forEach((row, rowIndex) => {
    // Check page break — re-render headers on new page
    if (y + rowHeight > PAGE.height - PAGE.marginBottom) {
      doc.addPage()
      y = renderColumnHeaders(PAGE.marginTop)
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 250, 246)
      doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, rowHeight, 'F')
    }

    // Custom row styling
    const style = rowStyle ? rowStyle(rowIndex, row) : null
    if (style?.fillColor) {
      doc.setFillColor(...style.fillColor)
      doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(fontSize)
    doc.setTextColor(...(style?.textColor || ANEST_COLORS.black))

    x = PAGE.marginLeft + 2
    columns.forEach((col, colIndex) => {
      const cellText = sanitizeForPdf(row[colIndex] ?? '')
      const align = col.align || 'left'
      const textX = align === 'center' ? x + col.width / 2 : align === 'right' ? x + col.width - 2 : x

      // Truncate text if too long
      const maxWidth = col.width - 4
      let displayText = cellText
      if (doc.getTextWidth(displayText) > maxWidth) {
        while (doc.getTextWidth(displayText + '...') > maxWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1)
        }
        displayText += '...'
      }

      doc.text(displayText, textX, y + rowHeight - 1.5, { align, charSpace: 0 })
      x += col.width
    })

    // Row border
    doc.setDrawColor(...ANEST_COLORS.tableBorder)
    doc.setLineWidth(0.15)
    doc.line(PAGE.marginLeft, y + rowHeight, PAGE.width - PAGE.marginRight, y + rowHeight)

    y += rowHeight
  })

  // Bottom border for the whole table
  doc.setDrawColor(...ANEST_COLORS.primaryDark)
  doc.setLineWidth(0.4)
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y)

  return y + 1
}

// ============================================================================
// STAT BOX
// ============================================================================

/**
 * Draws a stat box (value + label).
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Box width
 * @param {string} value - The value to display
 * @param {string} label - Label text
 * @param {number[]} [color] - RGB color for value
 * @returns {number} Y position after the box
 */
export function drawStatBox(doc, x, y, width, value, label, color = ANEST_COLORS.primaryDark) {
  const height = 18

  // Background
  doc.setFillColor(250, 255, 250)
  doc.setDrawColor(...ANEST_COLORS.tableBorder)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, width, height, 2, 2, 'FD')

  // Value
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...color)
  doc.text(String(value), x + width / 2, y + 9, { align: 'center' })

  // Label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.gray)
  doc.text(label, x + width / 2, y + 15, { align: 'center' })

  return y + height + 3
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

/**
 * Draws a horizontal progress bar with label and percentage.
 *
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Total bar width
 * @param {number} percentage - Value 0-100
 * @param {string} label - Bar label
 * @param {number[]} [color] - RGB color for the filled portion
 * @returns {number} Y position after the bar
 */
export function drawProgressBar(doc, x, y, width, percentage, label, color = ANEST_COLORS.primaryDark) {
  // Label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...ANEST_COLORS.black)
  doc.text(label, x, y + 3)

  // Percentage text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...color)
  doc.text(`${Math.round(percentage)}%`, x + width, y + 3, { align: 'right' })

  // Background bar
  const barY = y + 5
  const barHeight = 3
  doc.setFillColor(230, 230, 230)
  doc.roundedRect(x, barY, width, barHeight, 1, 1, 'F')

  // Filled portion
  const fillWidth = Math.max(0, (percentage / 100) * width)
  if (fillWidth > 0) {
    doc.setFillColor(...color)
    doc.roundedRect(x, barY, fillWidth, barHeight, 1, 1, 'F')
  }

  return y + 12
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Creates a new jsPDF A4 portrait document.
 * @returns {jsPDF}
 */
export async function createA4Doc() {
  const jsPDF = await getJsPDF()
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
}

/**
 * Returns a color based on a status variant string.
 * @param {string} variant - 'success' | 'warning' | 'destructive' | other
 * @returns {number[]} RGB array
 */
export function getStatusColor(variant) {
  switch (variant) {
    case 'success': return ANEST_COLORS.success
    case 'warning': return ANEST_COLORS.warning
    case 'destructive': return ANEST_COLORS.danger
    default: return ANEST_COLORS.gray
  }
}

/**
 * Formats a date string to pt-BR format.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDatePtBr(date) {
  if (!date) return '-'
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('pt-BR')
}

/**
 * Returns month short labels.
 * @returns {string[]}
 */
export function getMonthLabels() {
  return MONTHS_SHORT
}

/**
 * Checks if adding content at y would overflow the page, and if so adds a new page.
 * @param {jsPDF} doc
 * @param {number} y - Current Y
 * @param {number} needed - Space needed
 * @param {string|null} logoBase64 - For re-adding header
 * @param {string} title - Report title (for header on new page)
 * @returns {number} Current valid Y position
 */
export function checkPageBreak(doc, y, needed, logoBase64 = null, title = '') {
  if (y + needed > PAGE.height - PAGE.marginBottom) {
    doc.addPage()
    if (title) {
      return addHeader(doc, title, null, logoBase64)
    }
    return PAGE.marginTop
  }
  return y
}
