/**
 * pdfService.js - Central PDF generation factory
 *
 * Orchestrates PDF generation:
 * 1. Creates jsPDF A4 document
 * 2. Loads ANEST logo
 * 3. Applies branding (header)
 * 4. Delegates to the requested template
 * 5. Adds footers to all pages
 * 6. Returns blob or triggers download
 */

import {
  createA4Doc,
  loadAnestLogo,
  addHeader,
  addFooter,
} from './pdfBranding'

// Template registry - lazy imports
const TEMPLATES = {
  kpiReport: () => import('./templates/kpiReportTemplate'),
  complianceReport: () => import('./templates/complianceReportTemplate'),
  incidentReport: () => import('./templates/incidentReportTemplate'),
  qualidadeReport: () => import('./templates/qualidadeReportTemplate'),
  centroGestaoReport: () => import('./templates/centroGestaoReportTemplate'),
}

/**
 * Generates a PDF report.
 *
 * @param {string} templateName - One of: 'kpiReport', 'complianceReport', 'incidentReport'
 * @param {Object} data - Data to pass to the template
 * @param {Object} [options] - Generation options
 * @param {string} [options.title] - Report title (overrides template default)
 * @param {string} [options.subtitle] - Subtitle
 * @param {string} [options.filename] - Download filename
 * @returns {Promise<Blob>} PDF blob
 */
export async function generate(templateName, data, options = {}) {
  // Validate template
  const templateLoader = TEMPLATES[templateName]
  if (!templateLoader) {
    throw new Error(`Unknown PDF template: "${templateName}". Available: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  // Load template module and logo in parallel
  const [templateModule, logoBase64] = await Promise.all([
    templateLoader(),
    loadAnestLogo(),
  ])

  const template = templateModule.default || templateModule

  // Create document
  const doc = await createA4Doc()

  // Get template metadata
  const meta = template.getMeta ? template.getMeta(data) : {}
  const title = options.title || meta.title || 'Relatorio ANEST'
  const subtitle = options.subtitle || meta.subtitle || null

  // Add header on first page
  let startY = addHeader(doc, title, subtitle, logoBase64)

  // Render template content
  await template.render(doc, startY, data, { logoBase64, title })

  // Add headers and footers to all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addHeader(doc, title, i === 1 ? subtitle : null, logoBase64)
    addFooter(doc, i, totalPages)
  }

  // Return blob
  return doc.output('blob')
}

/**
 * Triggers a browser download for a PDF blob.
 *
 * @param {Blob} blob - PDF blob
 * @param {string} filename - Filename for download
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convenience: generate + download in one call.
 *
 * @param {string} templateName
 * @param {Object} data
 * @param {Object} [options]
 */
export async function generateAndDownload(templateName, data, options = {}) {
  const blob = await generate(templateName, data, options)
  const meta = options.filename || `ANEST_${templateName}_${new Date().toISOString().slice(0, 10)}.pdf`
  triggerDownload(blob, meta)
}

export default { generate, triggerDownload, generateAndDownload }
