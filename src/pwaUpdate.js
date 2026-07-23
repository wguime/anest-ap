/**
 * Atualização do PWA — check ao voltar ao 1º plano + periódico.
 *
 * Bug sistêmico 22–23/07: aparelhos ficavam DIAS no bundle velho — correções
 * "não apareciam" (IOSC corrigido no banco e invisível na Completa) e clientes
 * antigos chegaram a corromper dados (rodapé com nomes de exibição). O
 * registerType 'autoUpdate' + skipWaiting recarrega quando o SW novo assume,
 * mas o CHECK de atualização só acontecia no load da página — iOS PWA retomado
 * do segundo plano nunca checava. Aqui: checa ao ficar visível e a cada 15 min.
 * (import deste módulo substitui o auto-inject do vite-plugin-pwa — modo 'auto')
 */
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const checar = () => registration.update().catch(() => { /* offline — tenta no próximo */ })
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checar() })
    window.addEventListener('pageshow', checar)
    setInterval(checar, 15 * 60 * 1000)
  },
})
