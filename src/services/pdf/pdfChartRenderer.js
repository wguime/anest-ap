/**
 * pdfChartRenderer.js - SVG to PNG conversion for PDF embedding
 *
 * Converts SVG chart elements from the DOM into high-resolution PNG
 * images that can be embedded into jsPDF documents.
 * Uses native browser APIs (XMLSerializer, Canvas) - zero dependencies.
 */

/**
 * Converts an SVG DOM element to a base64 PNG data URL.
 * Renders at 2x resolution for retina quality.
 *
 * @param {SVGElement} svgElement - The SVG element to convert
 * @param {number} [width=600] - Output width in pixels
 * @param {number} [height=300] - Output height in pixels
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function svgToPng(svgElement, width = 600, height = 300) {
  const serializer = new XMLSerializer()
  const svgData = serializer.serializeToString(svgElement)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2   // 2x for retina
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to render SVG to PNG'))
    }
    img.src = url
  })
}

/**
 * Captures the first SVG element found within a container and returns PNG.
 * Useful for capturing Recharts or other SVG-based chart components.
 *
 * @param {string} containerSelector - CSS selector for the chart container
 * @param {number} [width=600] - Output width
 * @param {number} [height=300] - Output height
 * @returns {Promise<string|null>} base64 PNG data URL or null if not found
 */
export async function captureChartAsPng(containerSelector, width = 600, height = 300) {
  const container = document.querySelector(containerSelector)
  if (!container) return null

  const svg = container.querySelector('svg')
  if (!svg) return null

  return svgToPng(svg, width, height)
}
