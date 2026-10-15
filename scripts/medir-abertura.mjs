#!/usr/bin/env node
/**
 * medir-abertura.mjs — cronometra a abertura do ANEST como um PWA instalado.
 *
 * Por que existe: a queixa "o app demora a abrir" (15/10/2026) só ficou clara
 * medindo — 1,6–2,3 s eram de spinner esperando o Firebase confirmar o login na
 * rede, com a Home pronta em cache. Perfil persistente (SW, IndexedDB,
 * localStorage e code cache sobrevivem entre execuções, como no celular), CPU
 * desacelerada para imitar um celular intermediário, marcas de tela (spinner,
 * Home, esqueletos, Escala) e a cascata de requisições.
 *
 * Uso (credenciais do usuário E2E no ambiente, nunca no arquivo):
 *   set -a; source ~/.anest-e2e.env; set +a
 *   PROFILE_DIR=/tmp/perfil OUT_DIR=/tmp/saida node scripts/medir-abertura.mjs login   # 1x: entra e aquece
 *   PROFILE_DIR=/tmp/perfil OUT_DIR=/tmp/saida CPU=4 ESCALA=1 node scripts/medir-abertura.mjs warm
 *   ... expired   (token vencido: o caso de quem abre de manhã)
 *   ... deeplink  (abre direto em /escala-cirurgica, como o toque no push)
 * BASE muda o alvo (padrão produção; ex. http://localhost:5174 para um preview).
 * FRAMES=1 grava os quadros pintados em OUT_DIR/<rótulo>-frames/<ms>.jpg.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'https://anest-ap.web.app'
const PROFILE = process.env.PROFILE_DIR
const OUT = process.env.OUT_DIR
const MODE = process.argv[2] || 'warm'
const CPU = Number(process.env.CPU || 1)
const LABEL = process.env.LABEL || `${MODE}-cpu${CPU}`
const FRAMES = process.env.FRAMES === '1'
const ESCALA = process.env.ESCALA === '1'
fs.mkdirSync(OUT, { recursive: true })

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  serviceWorkers: 'allow',
})

const INIT = `(() => {
  try { performance.setResourceTimingBufferSize(5000) } catch {}
  const marks = {}; window.__marks = marks
  const samples = []; window.__samples = samples
  const mark = (k) => { if (!(k in marks)) marks[k] = Math.round(performance.now()) }
  window.__mark = mark
  const check = () => {
    const d = document
    if (!d.body) return
    const now = Math.round(performance.now())
    const spin = !!d.querySelector('.animate-spin')
    if (spin) mark('spinner')
    if (d.querySelector('#root > *')) mark('rootPainted')
    if (d.querySelector('input[type="password"]')) mark('loginForm')
    const h1 = [...d.querySelectorAll('h1')].find(h => h.textContent.trim() === 'Página inicial')
    if (h1) mark('home')
    const card = d.querySelector('[data-slot="anest-escala-cirurgica-home-card"]')
    const sk = d.querySelectorAll('[class*="animation:shimmer"]').length
    if (card) {
      mark('escalaCard')
      if (!card.querySelector('[class*="animation:shimmer"]')) mark('escalaCardReady')
    }
    if (h1 && sk === 0 && !spin) mark('homeNoSkeleton')
    const tab = [...d.querySelectorAll('[role="tab"]')].find(t => /Libera/.test(t.textContent))
    if (tab) mark('escalaTabs')
    if (tab && sk === 0 && !spin) mark('escalaReady')
    const last = samples[samples.length - 1]
    if (!last || last.sk !== sk || last.spin !== spin) samples.push({ t: now, sk, spin, url: location.pathname })
  }
  const loop = () => { check(); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  setInterval(check, 50)
  const startMO = () => new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true })
  if (document.documentElement) startMO(); else document.addEventListener('readystatechange', startMO, { once: true })
})()`

await ctx.addInitScript(INIT)

const page = ctx.pages()[0] || await ctx.newPage()
const consoleMsgs = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitMark(names, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const marks = await page.evaluate(() => window.__marks || {}).catch(() => ({}))
    if (names.some((n) => n in marks)) return marks
    await sleep(100)
  }
  return page.evaluate(() => window.__marks || {}).catch(() => ({}))
}

if (MODE === 'login') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const m = await waitMark(['loginForm', 'home'], 30000)
  if (!('home' in m)) {
    await page.locator('input[autocomplete="email"]').first().fill(process.env.E2E_USER_EMAIL)
    await page.locator('input[type="password"]').first().fill(process.env.E2E_USER_PASSWORD)
    await page.getByRole('button', { name: /entrar/i }).first().click()
  }
  await page.getByRole('heading', { name: 'Página inicial' }).waitFor({ timeout: 40000 })
  console.log('logado; aquecendo SW + chunks por 25s…')
  await sleep(25000)
  const sw = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations()
    const keys = await caches.keys()
    return { regs: regs.length, active: !!regs[0]?.active, caches: keys }
  })
  console.log(JSON.stringify(sw))
  await ctx.close()
  process.exit(0)
}

if (MODE === 'expired') {
  // Vence o ID token persistido: a próxima abertura precisa renovar (securetoken) — o
  // caso real de quem abre o app de manhã, mais de 1h depois do último uso.
  await page.goto(`${BASE}/manifest.json`)
  const r = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('firebaseLocalStorageDb')
    req.onerror = () => resolve('erro ao abrir')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('firebaseLocalStorage', 'readwrite')
      const st = tx.objectStore('firebaseLocalStorage')
      const all = st.getAll()
      all.onsuccess = () => {
        let n = 0
        for (const row of all.result) {
          if (row?.value?.stsTokenManager) {
            row.value.stsTokenManager.expirationTime = Date.now() - 1000
            st.put(row); n++
          }
        }
        tx.oncomplete = () => resolve(`tokens vencidos (IndexedDB): ${n}`)
      }
    }
  }))
  console.log(r)
  // setPersistence(browserLocalPersistence) move o usuário para o localStorage
  const ls = await page.evaluate(() => {
    let n = 0
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('firebase:authUser:')) continue
      const v = JSON.parse(localStorage.getItem(k))
      if (v?.stsTokenManager) { v.stsTokenManager.expirationTime = Date.now() - 1000; localStorage.setItem(k, JSON.stringify(v)); n++ }
    }
    return n
  })
  console.log(`tokens vencidos (localStorage): ${ls}`)
}

const cdp = await ctx.newCDPSession(page)
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const frames = []
if (FRAMES) {
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ ts: metadata.timestamp * 1000, data })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 50, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 })
}

const target = MODE === 'deeplink' ? `${BASE}/escala-cirurgica` : BASE
const wall0 = Date.now()
await page.goto(target, { waitUntil: 'commit' })
const targetMarks = MODE === 'deeplink' ? ['escalaReady'] : ['homeNoSkeleton']
await waitMark(targetMarks, 45000)
await sleep(2500)

const coletar = () => page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]))
  const res = performance.getEntriesByType('resource').map((r) => ({
    name: r.name, type: r.initiatorType, start: Math.round(r.startTime), end: Math.round(r.responseEnd),
    sw: r.workerStart > 0, size: r.transferSize, body: r.decodedBodySize,
  }))
  return {
    timeOrigin: performance.timeOrigin,
    marks: window.__marks, samples: window.__samples, paints,
    nav: nav && { responseEnd: Math.round(nav.responseEnd), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), sw: nav.workerStart > 0 },
    res,
  }
})

const boot = await coletar()
let escala = null
if (ESCALA && MODE !== 'deeplink') {
  const card = page.locator('[data-slot="anest-escala-cirurgica-home-card"]')
  if (await card.count()) {
    const clickAt = await page.evaluate(() => Math.round(performance.now()))
    await card.first().click()
    await waitMark(['escalaReady'], 45000)
    await sleep(2500)
    const after = await coletar()
    escala = {
      clickAt,
      tabs: after.marks.escalaTabs != null ? after.marks.escalaTabs - clickAt : null,
      ready: after.marks.escalaReady != null ? after.marks.escalaReady - clickAt : null,
      res: after.res.filter((r) => r.start >= clickAt).map((r) => ({ ...r, start: r.start - clickAt, end: r.end - clickAt })),
      samples: after.samples.filter((s) => s.t >= clickAt).map((s) => ({ ...s, t: s.t - clickAt })),
    }
  } else {
    escala = { erro: 'card da escala ausente na Home' }
  }
}

if (FRAMES) {
  await cdp.send('Page.stopScreencast').catch(() => {})
  const dir = path.join(OUT, `${LABEL}-frames`)
  fs.mkdirSync(dir, { recursive: true })
  for (const f of frames) {
    const rel = Math.round(f.ts - boot.timeOrigin)
    fs.writeFileSync(path.join(dir, `${String(Math.max(rel, 0)).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64'))
  }
}

const out = { label: LABEL, mode: MODE, cpu: CPU, wall0, boot, escala, console: consoleMsgs.slice(0, 60) }
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(out, null, 2))

const short = (u) => {
  try { const x = new URL(u); return (x.host.replace('vjzrahruvjffyyqyhjny.supabase.co', 'SUPA').replace('anest-ap.web.app', 'APP') + x.pathname + (x.search ? x.search.slice(0, 70) : '')).slice(0, 120) } catch { return u.slice(0, 120) }
}
console.log(`\n== ${LABEL} ==`)
console.log('nav', JSON.stringify(boot.nav), 'paint', JSON.stringify(boot.paints))
console.log('marks', JSON.stringify(boot.marks))
console.log('samples', JSON.stringify(boot.samples))
console.log('\nrecursos (start→end ms, via SW?):')
for (const r of boot.res.filter((r) => !/\.(png|jpg|webp|svg|ico|woff2?)(\?|$)/.test(r.name)).sort((a, b) => a.start - b.start)) {
  console.log(`${String(r.start).padStart(6)} → ${String(r.end).padStart(6)} (${String(r.end - r.start).padStart(5)}) ${r.sw ? 'SW ' : '   '}${r.type.padEnd(14)} ${short(r.name)}`)
}
if (escala) {
  console.log('\nESCALA (relativo ao toque):', JSON.stringify({ tabs: escala.tabs, ready: escala.ready, erro: escala.erro }))
  console.log('samples', JSON.stringify(escala.samples))
  for (const r of (escala.res || []).filter((r) => !/\.(png|jpg|webp|svg|ico|woff2?)(\?|$)/.test(r.name)).sort((a, b) => a.start - b.start)) {
    console.log(`${String(r.start).padStart(6)} → ${String(r.end).padStart(6)} (${String(r.end - r.start).padStart(5)}) ${r.sw ? 'SW ' : '   '}${r.type.padEnd(14)} ${short(r.name)}`)
  }
}
if (consoleMsgs.length) console.log('\nconsole:', consoleMsgs.slice(0, 25).join('\n'))
await ctx.close()
