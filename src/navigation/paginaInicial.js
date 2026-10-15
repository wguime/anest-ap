/**
 * Página inicial sob demanda — o app aberto DIRETO numa tela lazy.
 *
 * O caso que importa é a Escala Cirúrgica: o toque no push do plantonista ou do
 * tempo estourado faz o service worker navegar para /escala-cirurgica, e o app
 * nasce nessa URL. Medido (15/10/2026, CPU de celular intermediário): o chunk
 * chegava logo DEPOIS do 1º render, o Suspense mostrava o spinner e o React 19
 * segura o conteúdo por ≥300 ms depois de um fallback — 0,3 s de spinner por
 * ~40 ms de chunk. Esperar o chunk antes do 1º render (main.jsx) troca isso por
 * um atraso de dezenas de ms, sem spinner.
 *
 * Mora fora do App.jsx para o main.jsx poder importar sem quebrar o Fast
 * Refresh (App.jsx só exporta componente).
 */
import { lazyComPreload } from '@/lib/lazyComPreload'

export const EscalaCirurgicaPage = lazyComPreload(() => import('@/pages/escala-cirurgica/EscalaCirurgicaPage'))

/**
 * Pré-carrega a página da URL inicial, quando ela é uma das que valem a espera.
 * Resolve na hora para qualquer outra URL.
 */
export function prepararPaginaInicial(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '/',
  paginas = { escala: EscalaCirurgicaPage },
) {
  if (pathname === '/escala-cirurgica' || pathname.startsWith('/escala-cirurgica/')) {
    return paginas.escala.preload()
  }
  return Promise.resolve()
}
