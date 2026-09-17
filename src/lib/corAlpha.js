/**
 * Cor hex com alfa, em `rgba()` — o jeito universal de "15% da cor" para fundo
 * de ícone de categoria. Substitui `color-mix(in srgb, <cor> 15%, transparent)`,
 * que o Chrome só entende a partir do 111 e o Samsung Internet do 22: abaixo
 * disso a declaração era descartada e o círculo ficava SEM fundo (mais uma
 * diferença entre aparelhos, 16/09/2026). Aceita `#RGB` e `#RRGGBB`; qualquer
 * outra coisa (nome, `hsl(...)`, var) volta como veio, porque não há o que
 * decompor.
 */
export function hexComAlpha(cor, alpha) {
  if (typeof cor !== 'string') return cor
  const m = cor.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return cor
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = Math.min(1, Math.max(0, Number(alpha)))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
