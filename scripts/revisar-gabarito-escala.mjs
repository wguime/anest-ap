#!/usr/bin/env node
/**
 * Revisor de gabarito do eval da Vision (Onda 4, item 4.1).
 *
 * O eval se recusa a pontuar acerto sobre gabarito não conferido — gabarito
 * igual à leitura da máquina mede a máquina contra ela mesma e dá 100% sempre.
 * Conferir 16 arquivos JSON contra 16 fotos num editor de texto é o tipo de
 * tarefa que não acontece; então aqui a foto e o que a máquina leu ficam lado a
 * lado, editáveis, e o "Conferido" grava no arquivo e vai para a próxima.
 *
 * Roda um servidor local (nada sai da máquina) e escreve direto em
 * `.local/escalas-corpus/gabarito/`.
 *
 * Uso:  node scripts/revisar-gabarito-escala.mjs
 *       → abre http://localhost:4599
 *
 * Depois de marcar os gabaritos como conferidos:
 *       node scripts/eval-escala-vision.mjs rodar --rotulo depois-onda4
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = resolve(raiz, '.local/escalas-corpus')
const GABARITOS = resolve(CORPUS, 'gabarito')
const PORTA = Number(process.env.PORTA || 4599)
const MIMES = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

if (!existsSync(GABARITOS)) {
  console.error(`❌ ${GABARITOS} não existe. Rode antes:`)
  console.error('   node scripts/eval-escala-vision.mjs semear --n 14')
  process.exit(1)
}

const listar = () => readdirSync(GABARITOS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(GABARITOS, f), 'utf8')))
  .filter((g) => g?.arquivo)
  .sort((a, b) => (parseInt(a.arquivo, 10) || 0) - (parseInt(b.arquivo, 10) || 0))

const caminhoGabarito = (arquivo) =>
  resolve(GABARITOS, `${basename(arquivo, extname(arquivo))}.json`)

const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisar gabarito da escala</title><style>
:root{color-scheme:light dark;--bg:#f6f7f6;--card:#fff;--linha:#d9e2dc;--txt:#12201a;--sub:#5b6b63;--ok:#0f7b46;--pend:#b26a00}
@media(prefers-color-scheme:dark){:root{--bg:#111916;--card:#1a2420;--linha:#2a3f36;--txt:#e6efe9;--sub:#9db0a6}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,system-ui,sans-serif;background:var(--bg);color:var(--txt)}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--linha);padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:15px;margin:0;font-weight:700}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.chip{border:1px solid var(--linha);background:transparent;color:var(--sub);border-radius:9px;padding:4px 9px;font-size:12px;font-weight:700;cursor:pointer}
.chip.sel{border-color:var(--ok);color:var(--ok)}.chip.ok{background:var(--ok);color:#fff;border-color:var(--ok)}
main{display:grid;grid-template-columns:minmax(320px,1fr) minmax(340px,1fr);gap:14px;padding:14px;align-items:start}
@media(max-width:900px){main{grid-template-columns:1fr}}
img{width:100%;border:1px solid var(--linha);border-radius:10px;background:#fff;cursor:zoom-in}
img.zoom{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000c;z-index:50;cursor:zoom-out;border-radius:0}
.painel{background:var(--card);border:1px solid var(--linha);border-radius:12px;padding:12px}
label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--sub);margin:10px 0 4px;font-weight:700}
input,textarea{width:100%;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:8px;border:1px solid var(--linha);border-radius:8px;background:transparent;color:var(--txt)}
textarea{min-height:260px;resize:vertical}
.acoes{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
button.principal{background:var(--ok);color:#fff;border:0;border-radius:9px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer}
button.sec{background:transparent;color:var(--txt);border:1px solid var(--linha);border-radius:9px;padding:10px 14px;font-weight:600;cursor:pointer}
.dica{color:var(--sub);font-size:12px;margin:8px 0 0}
.estado{font-weight:700}.estado.ok{color:var(--ok)}.estado.pend{color:var(--pend)}
</style></head><body>
<header>
  <h1>Revisar gabarito</h1>
  <span id="estado" class="estado"></span>
  <div class="chips" id="chips"></div>
</header>
<main>
  <div><img id="foto" alt="foto da escala"></div>
  <div class="painel">
    <label>Hospital (unimed / hro / materno)</label><input id="hospital">
    <label>Data (AAAA-MM-DD)</label><input id="data">
    <label>Rodapé — ordem de liberação, um nome por linha, NA ORDEM</label>
    <textarea id="rodape" style="min-height:120px"></textarea>
    <label>Ajuda (azul) — um nome por linha</label>
    <textarea id="ajuda" style="min-height:60px"></textarea>
    <label>Casos — uma linha por cirurgia: sala | hora | iniciais | procedimento | anestesista</label>
    <textarea id="casos"></textarea>
    <p class="dica">Corrija só o que a máquina errou. Linha a mais que ela inventou: apague. Cirurgia que ela perdeu: acrescente.</p>
    <div class="acoes">
      <button class="principal" id="conferir">Conferido — próxima</button>
      <button class="sec" id="salvar">Salvar sem conferir</button>
    </div>
  </div>
</main>
<script>
let lista = [], i = 0
const $ = (id) => document.getElementById(id)
const linhas = (t) => t.split('\\n').map((s) => s.trim()).filter(Boolean)

async function carregar() {
  lista = await (await fetch('/api/lista')).json()
  const pend = lista.findIndex((g) => !g.revisado)
  i = pend >= 0 ? pend : 0
  render()
}
function render() {
  const g = lista[i]
  if (!g) return
  $('foto').src = '/foto/' + encodeURIComponent(g.arquivo)
  $('hospital').value = g.hospital || ''
  $('data').value = g.data || ''
  $('rodape').value = (g.rodape || []).join('\\n')
  $('ajuda').value = (g.ajuda || []).join('\\n')
  $('casos').value = (g.casos || []).map((c) =>
    [c.sala, c.hora, c.iniciais, c.procedimento, c.anestesista].map((v) => v || '').join(' | ')).join('\\n')
  $('estado').textContent = g.arquivo + ' — ' + (g.revisado ? 'conferido' : 'por conferir')
  $('estado').className = 'estado ' + (g.revisado ? 'ok' : 'pend')
  $('chips').innerHTML = lista.map((x, n) =>
    '<button class="chip ' + (x.revisado ? 'ok' : '') + (n === i ? ' sel' : '') + '" data-n="' + n + '">' + x.arquivo.replace(/\\.\\w+$/, '') + '</button>').join('')
  document.title = 'Gabarito ' + g.arquivo
}
function coletar(revisado) {
  const g = lista[i]
  return {
    ...g, revisado,
    hospital: $('hospital').value.trim(),
    data: $('data').value.trim(),
    rodape: linhas($('rodape').value),
    ajuda: linhas($('ajuda').value),
    casos: linhas($('casos').value).map((l) => {
      const [sala, hora, iniciais, procedimento, anestesista] = l.split('|').map((s) => s.trim())
      return { sala: sala || '', hora: hora || '', iniciais: iniciais || '', procedimento: procedimento || '', anestesista: anestesista || '' }
    }),
  }
}
async function gravar(revisado) {
  const corpo = coletar(revisado)
  await fetch('/api/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  lista[i] = corpo
  if (revisado) { const p = lista.findIndex((g) => !g.revisado); if (p >= 0) i = p }
  render()
}
$('conferir').onclick = () => gravar(true)
$('salvar').onclick = () => gravar(false)
$('chips').onclick = (e) => { const n = e.target?.dataset?.n; if (n != null) { i = Number(n); render() } }
$('foto').onclick = () => $('foto').classList.toggle('zoom')
carregar()
</script></body></html>`

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(PAGINA)
  }
  if (url.pathname === '/api/lista') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(listar()))
  }
  if (url.pathname.startsWith('/foto/')) {
    const nome = basename(decodeURIComponent(url.pathname.slice(6)))
    const caminho = resolve(CORPUS, nome)
    if (!caminho.startsWith(CORPUS) || !existsSync(caminho)) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'Content-Type': MIMES[extname(nome).toLowerCase()] || 'application/octet-stream' })
    return res.end(readFileSync(caminho))
  }
  if (url.pathname === '/api/salvar' && req.method === 'POST') {
    let corpo = ''
    req.on('data', (c) => { corpo += c })
    req.on('end', () => {
      try {
        const g = JSON.parse(corpo)
        const caminho = caminhoGabarito(basename(String(g.arquivo || '')))
        if (!caminho.startsWith(GABARITOS)) throw new Error('caminho fora da pasta de gabaritos')
        writeFileSync(caminho, `${JSON.stringify(g, null, 2)}\n`)
        const total = listar()
        console.log(`  ✔ ${g.arquivo} ${g.revisado ? 'conferido' : 'salvo'} · ${total.filter((x) => x.revisado).length}/${total.length} conferidos`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ erro: e.message }))
      }
    })
    return undefined
  }
  res.writeHead(404)
  return res.end()
}).listen(PORTA, () => {
  const g = listar()
  console.log(`Revisor de gabarito em http://localhost:${PORTA}`)
  console.log(`${g.length} gabarito(s) · ${g.filter((x) => x.revisado).length} já conferido(s)`)
  console.log('Ctrl+C encerra. Depois: node scripts/eval-escala-vision.mjs rodar --rotulo depois-onda4')
})
