/**
 * Relógio de DESENVOLVIMENTO — existe só em `npm run dev`.
 *
 * `?agora=2026-06-26T20:00` congela o "agora" do app nesse instante, para
 * inspecionar as fases da escala (aviso no vespertino, plantão a partir das
 * 19h, lista zerada às 23h) sem esperar o horário nem mexer no relógio da
 * máquina. 26/06/2026 é SEXTA e é a data da escala de demonstração, então a
 * escala de testes carrega E as regras de dia útil valem.
 *
 * O valor é lido UMA vez no carregamento do módulo, então navegar pelo app não
 * perde o congelamento (a query string sai da URL, o relógio fica).
 *
 * Em produção `agora()` é `new Date()` — o bloco abaixo nem é avaliado, porque
 * `import.meta.env.DEV` é substituído por `false` no build e o rollup remove o
 * ramo morto. Nenhum caminho de produção depende deste arquivo para funcionar.
 */
let congelado = null

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const bruto = new URLSearchParams(window.location.search).get('agora')
  if (bruto) {
    const d = new Date(bruto)
    if (Number.isNaN(d.getTime())) {
      console.warn('[devClock] "agora" inválido:', bruto, '— use 2026-06-26T20:00')
    } else {
      congelado = d
      console.warn('[devClock] AGORA CONGELADO em', d.toString(), '— só em dev')
    }
  }
}

/** true quando o relógio de dev está congelado (dev-only). */
export const devClockAtivo = () => congelado !== null

/** "Agora" do app: o instante congelado em dev, senão o relógio real. */
export const agora = () => (congelado ? new Date(congelado) : new Date())
