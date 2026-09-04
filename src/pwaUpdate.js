/**
 * Atualização do PWA — registro do service worker.
 *
 * A LÓGICA (check ao voltar ao 1º plano + periódico + guarda de versão + adiamento com
 * trabalho em andamento) mora em `src/lib/pwaAtualizacao.js`, com o histórico de cada
 * decisão (22–23/07: aparelhos presos no bundle velho; 13/08: um reload só, sem aviso na
 * tela; 04/09: adiar enquanto a conferência da escala estiver aberta) e com teste. Aqui só
 * o que precisa do Vite: `virtual:pwa-register` e o `__BUILD_ID__` carimbado no build.
 */
import { registerSW } from 'virtual:pwa-register'
import { instalarAtualizacaoPwa } from './lib/pwaAtualizacao'

const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    instalarAtualizacaoPwa(registration, { buildId: BUILD_ID })
  },
})
