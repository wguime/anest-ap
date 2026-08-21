/**
 * useAgoraMinuto — "agora" em minutos do dia (0–1439), atualizado a cada 30s.
 *
 * UM intervalo para o APP TODO, não um por tela. Sete superfícies da escala usam
 * este hook e, até 21/08, cada uma tinha o próprio `setInterval` e o próprio
 * estado: duas telas podiam ficar 30s defasadas uma da outra e discordar
 * exatamente na fronteira que importa — 13h (turno), 19h (fase noturna), os 15min
 * da suspeita e as 4h da cirurgia esquecida. Uma store de módulo com um relógio
 * só torna a discordância impossível por construção, que é o pedido do dono
 * ("as informações não podem ser desencontradas").
 *
 * iOS/PWA SUSPENDE timers em segundo plano e pode nunca retomá-los depois do
 * resume (WebKit) — foi o que congelou os cronômetros da aba Liberações o dia
 * todo em produção (bug 2026-07-22). Por isso, voltar a ficar visível
 * (visibilitychange/pageshow/focus) recalcula NA HORA e re-arma o intervalo.
 *
 * ⚠️ `getSnapshot` devolve o valor CACHEADO, nunca `minutosDoDia()` recalculado:
 * o React chama o snapshot várias vezes no mesmo render e, na virada do minuto,
 * dois componentes leriam valores diferentes (tearing) — o problema que a store
 * existe para eliminar.
 */
import { useSyncExternalStore } from 'react'
import { agora } from '@/lib/devClock'

export const minutosDoDia = (d = agora()) => d.getHours() * 60 + d.getMinutes()

let valor = minutosDoDia()
const inscritos = new Set()
let intervalo = null

const publicar = () => {
  const novo = minutosDoDia()
  if (novo === valor) return
  valor = novo
  for (const fn of inscritos) fn()
}

const rearmar = () => {
  publicar()
  if (intervalo) clearInterval(intervalo) // pode ter morrido na suspensão
  intervalo = setInterval(publicar, 30_000)
}

const ligar = () => {
  if (typeof document === 'undefined') return
  rearmar()
  document.addEventListener('visibilitychange', aoVisibilizar)
  window.addEventListener('pageshow', rearmar)
  window.addEventListener('focus', rearmar)
}

const desligar = () => {
  if (typeof document === 'undefined') return
  if (intervalo) { clearInterval(intervalo); intervalo = null }
  document.removeEventListener('visibilitychange', aoVisibilizar)
  window.removeEventListener('pageshow', rearmar)
  window.removeEventListener('focus', rearmar)
}

function aoVisibilizar() { if (!document.hidden) rearmar() }

/** Assina a store; o relógio só corre enquanto houver alguém olhando. */
const inscrever = (fn) => {
  const primeiro = inscritos.size === 0
  inscritos.add(fn)
  if (primeiro) ligar()
  return () => {
    inscritos.delete(fn)
    if (inscritos.size === 0) desligar()
  }
}

const ler = () => valor

export default function useAgoraMinuto() {
  // 3º argumento = getServerSnapshot: no SSR/teste sem DOM o valor é o mesmo.
  return useSyncExternalStore(inscrever, ler, ler)
}
