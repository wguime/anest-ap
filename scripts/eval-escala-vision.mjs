#!/usr/bin/env node
/**
 * Eval offline da leitura da escala pela Vision (Onda 4, item 4.1).
 *
 * Roda a edge `parse-escala-cirurgica` REAL sobre as fotos do corpus
 * (`.local/escalas-corpus/`, gitignored) e compara com o gabarito conferido
 * pelo dono, imprimindo acerto POR CAMPO — casos, anestesista por linha, rodapé
 * em ordem, ajuda (azul) — mais o custo medido por leitura. É o número ANTES e
 * DEPOIS de cada item da Onda 4; sem ele, mudar prompt, schema ou modelo é
 * palpite (a auditoria de 02/09 fechou exatamente com essa frase).
 *
 * O custo NÃO é estimado: sai do `escala_leitura_log` que a própria leitura
 * acabou de gravar, com os tokens que a Anthropic reportou.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   node scripts/eval-escala-vision.mjs semear --n 12
 *       Lê N fotos e escreve gabaritos CANDIDATOS em
 *       `.local/escalas-corpus/gabarito/`. Cada um nasce com "revisado": false
 *       e NÃO conta no placar até o dono corrigir e marcar true. Um gabarito
 *       igual à leitura da máquina não é gabarito — é a leitura de novo.
 *
 *   node scripts/eval-escala-vision.mjs rodar --rotulo antes-4.2
 *       Roda sobre os gabaritos revisados e salva o placar em
 *       `.local/escalas-corpus/eval-runs/antes-4.2.json`.
 *
 *   node scripts/eval-escala-vision.mjs comparar antes-4.2 depois-4.2
 *       Imprime a diferença campo a campo entre duas rodadas.
 *
 *   node scripts/eval-escala-vision.mjs listar
 *       Estado do corpus e dos gabaritos.
 *
 * ── Fidelidade ao que a secretária faz ─────────────────────────────────────
 * O app passa a foto por `prepararImagemParaVision` (lado maior ≤ 2400, PNG).
 * As fotos do corpus têm 999–1280px, então essa etapa NUNCA reduz nem amplia —
 * ela só re-codifica para PNG, o que não devolve nitidez a um JPEG já
 * comprimido pelo WhatsApp. Aqui os bytes originais vão como estão: mesmos
 * pixels, menos uma etapa que exigiria canvas no Node.
 *
 * ── Credenciais ────────────────────────────────────────────────────────────
 * Lidas de `.env.local` DENTRO do processo, nunca impressas:
 *   SUPABASE_JWT_SECRET      assina o JWT HS256 que a edge aceita
 *   SUPABASE_ACCESS_TOKEN    Management API (uid de admin + leitura do log)
 *   VITE_SUPABASE_URL        endpoint das functions
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { createHmac, createHash } from 'crypto'
import { pontuarLeitura, agregar, custoDaLeitura } from './lib/escalaVisionEval.mjs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = resolve(raiz, '.local/escalas-corpus')
const GABARITOS = resolve(CORPUS, 'gabarito')
const RODADAS = resolve(CORPUS, 'eval-runs')

// ── env ──────────────────────────────────────────────────────────────────────
const env = {}
const envPath = resolve(raiz, '.env.local')
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, 'utf8').split('\n')) {
    const m = linha.match(/^([^#=][^=]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const val = (k) => process.env[k] || env[k] || ''
const JWT_SECRET = val('SUPABASE_JWT_SECRET')
const PAT = val('SUPABASE_ACCESS_TOKEN')
const REF = val('VITE_SUPABASE_PROJECT_REF') || 'vjzrahruvjffyyqyhjny'
const SUPABASE_URL = val('VITE_SUPABASE_URL') || `https://${REF}.supabase.co`

const MIMES = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// ── Management API (uid de admin e leitura do log) ────────────────────────────
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`Management API ${r.status}: ${txt.slice(0, 300)}`)
  try { return JSON.parse(txt) } catch { return [] }
}

/** JWT HS256 que `_shared/verify-auth.ts` aceita (assinatura + claim `sub`). */
function assinarJwt(sub) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = b64({ alg: 'HS256', typ: 'JWT' })
  const corpo = b64({ sub, role: 'authenticated', iss: 'supabase', iat: agora, exp: agora + 3600 })
  const assinatura = createHmac('sha256', JWT_SECRET).update(`${cabecalho}.${corpo}`).digest('base64url')
  return `${cabecalho}.${corpo}.${assinatura}`
}

function listarFotos() {
  if (!existsSync(CORPUS)) return []
  return readdirSync(CORPUS)
    .filter((f) => MIMES[extname(f).toLowerCase()])
    .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b))
}

const lerGabarito = (arquivo) => {
  const p = resolve(GABARITOS, `${basename(arquivo, extname(arquivo))}.json`)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

async function lerFoto(arquivo, token) {
  const bytes = readFileSync(resolve(CORPUS, arquivo))
  const base64 = bytes.toString('base64')
  const mime = MIMES[extname(arquivo).toLowerCase()]
  const t0 = Date.now()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/parse-escala-cirurgica`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`edge ${r.status}: ${texto.slice(0, 300)}`)
  let dados
  try { dados = JSON.parse(texto) } catch { throw new Error(`resposta não-JSON: ${texto.slice(0, 200)}`) }
  return {
    dados,
    latenciaMs: Date.now() - t0,
    // mesmo hash que a edge grava: sha256 do base64 (identidade da foto)
    hash: createHash('sha256').update(base64).digest('hex'),
  }
}

/** Telemetria da leitura recém-feita, pelo hash — é de onde sai o custo real. */
async function telemetria(hashes, desdeIso) {
  if (!PAT || hashes.length === 0) return new Map()
  const lista = hashes.map((h) => `'${h.replace(/[^a-f0-9]/g, '')}'`).join(',')
  const linhas = await sql(`
    select distinct on (imagem_hash)
      imagem_hash, modelo, prompt_versao, input_tokens, output_tokens,
      cache_read_tokens, cache_write_tokens, stop_reason, latencia_ms,
      imagem_largura, imagem_altura, imagem_bytes, erro
    from public.escala_leitura_log
    where criado_em >= '${desdeIso}' and imagem_hash in (${lista})
    order by imagem_hash, criado_em desc`)
  return new Map((linhas || []).map((l) => [l.imagem_hash, l]))
}

const n1 = (v) => (v === null || v === undefined ? '  —  ' : `${v.toFixed(1)}%`.padStart(6))

function imprimirPlacar(r) {
  const a = r.agregado
  console.log(`\n📊 ${r.rotulo}  ·  ${a.fotos} foto(s)  ·  ${r.quando}`)
  console.log(`   prompt=${r.promptVersao || '?'}  modelo=${r.modelo || '?'}`)
  console.log('   ┌─────────────────────────────┬────────┬──────────────────────────────')
  console.log(`   │ casos encontrados           │ ${n1(a.casos.acerto)} │ ${a.casos.encontrados}/${a.casos.esperados}  · sumiram ${a.casos.sumiram} · a mais ${a.casos.inventados}`)
  console.log(`   │ anestesista por linha       │ ${n1(a.anestesista.acerto)} │ ${a.anestesista.certos}/${a.anestesista.total}`)
  console.log(`   │ rodapé — posição por posição│ ${n1(a.rodape.acertoPosicao)} │ ${a.rodape.posicoesCertas}/${a.rodape.total} · ${a.rodape.exatos}/${a.fotos} rodapés exatos`)
  console.log(`   │ rodapé — nomes presentes    │ ${n1(a.rodape.acertoNomes)} │ inventados ${a.rodape.inventados}`)
  console.log(`   │ ajuda (azul)                │ ${n1(a.ajuda.acerto)} │ ${a.ajuda.certos}/${a.ajuda.total} · inventados ${a.ajuda.inventados}`)
  console.log(`   │ hospital detectado          │ ${n1(a.hospital.total ? (100 * a.hospital.certos) / a.hospital.total : null)} │ ${a.hospital.certos}/${a.hospital.total}`)
  console.log(`   │ data detectada              │ ${n1(a.data.total ? (100 * a.data.certos) / a.data.total : null)} │ ${a.data.certos}/${a.data.total}`)
  console.log('   └─────────────────────────────┴────────┴──────────────────────────────')
  if (r.custo?.leituras) {
    const c = r.custo
    console.log(`   💵 custo medido: $${c.total.toFixed(4)} em ${c.leituras} leitura(s) → $${c.medio.toFixed(4)}/leitura`)
    console.log(`      tokens médios: entrada ${Math.round(c.entradaMedia)} · saída ${Math.round(c.saidaMedia)} · cache lido ${Math.round(c.cacheLidoMedio)}`)
    console.log(`   ⏱  latência mediana: ${(c.latenciaMediana / 1000).toFixed(1)}s`)
  } else {
    console.log('   💵 custo: sem telemetria (o log da leitura não foi encontrado)')
  }
  const problemas = r.porFoto.filter((p) => p.casos.faltando.length || p.anestesista.errados.length || !p.rodape.exato)
  if (problemas.length) {
    console.log('\n   Onde errou:')
    for (const p of problemas.slice(0, 12)) {
      const partes = []
      if (p.casos.faltando.length) partes.push(`${p.casos.faltando.length} caso(s) sumiram (${p.casos.faltando.slice(0, 2).map((c) => `${c.sala || '?'} ${c.hora || ''}`).join('; ')})`)
      if (p.anestesista.errados.length) partes.push(`${p.anestesista.errados.length} anestesista(s): ${p.anestesista.errados.slice(0, 2).map((e) => `${e.esperado}→${e.lido}`).join(', ')}`)
      if (!p.rodape.exato) partes.push(`rodapé ${p.rodape.posicoesCertas}/${p.rodape.total}${p.rodape.inventados.length ? ` (inventou ${p.rodape.inventados.join(', ')})` : ''}`)
      console.log(`   · ${p.arquivo}: ${partes.join(' · ')}`)
    }
  }
}

// ── comandos ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const comando = args[0] || 'listar'
const opcao = (nome, padrao = null) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao
}

async function token() {
  if (!JWT_SECRET) throw new Error('SUPABASE_JWT_SECRET ausente em .env.local — o eval não consegue autenticar na edge')
  if (!PAT) throw new Error('SUPABASE_ACCESS_TOKEN ausente em .env.local')
  const linhas = await sql('select firebase_uid from public.admin_users order by firebase_uid limit 1')
  const uid = linhas?.[0]?.firebase_uid
  if (!uid) throw new Error('nenhum admin encontrado para assinar o token do eval')
  return assinarJwt(uid)
}

if (comando === 'listar') {
  const fotos = listarFotos()
  const gabs = fotos.map((f) => ({ f, g: lerGabarito(f) })).filter((x) => x.g)
  const revisados = gabs.filter((x) => x.g.revisado === true)
  console.log(`Corpus: ${fotos.length} foto(s) em ${CORPUS}`)
  console.log(`Gabaritos: ${gabs.length} arquivo(s) · ${revisados.length} revisado(s) pelo dono`)
  if (gabs.length && !revisados.length) {
    console.log('\n⚠️  Nenhum gabarito revisado: o placar NÃO roda.')
    console.log('   Abra cada .json em .local/escalas-corpus/gabarito/, corrija o que a máquina leu errado')
    console.log('   e troque "revisado": false por true. Gabarito igual à leitura não mede nada.')
  }
  for (const { f, g } of gabs) {
    console.log(`  ${g.revisado ? '✔' : '·'} ${f}  ${g.hospital || '?'}  ${g.casos?.length ?? 0} caso(s)  rodapé ${g.rodape?.length ?? 0}${g.revisado ? '' : '  (por revisar)'}`)
  }
  if (existsSync(RODADAS)) {
    const rodadas = readdirSync(RODADAS).filter((f) => f.endsWith('.json'))
    if (rodadas.length) console.log(`\nRodadas salvas: ${rodadas.map((f) => basename(f, '.json')).join(', ')}`)
  }
  process.exit(0)
}

if (comando === 'semear') {
  const quantas = Number(opcao('n', '12'))
  const todas = listarFotos()
  // ESPALHADO pelo corpus, não as N primeiras: as fotos estão em ordem de
  // chegada e as primeiras são todas do mesmo hospital. Um eval com 12 Unimed
  // e nenhum HRO mede um terço do problema e chama de placar.
  const passo = Math.max(1, Math.floor(todas.length / Math.max(1, quantas)))
  const fotos = quantas >= todas.length
    ? todas
    : Array.from({ length: quantas }, (_, i) => todas[i * passo]).filter(Boolean)
  if (!fotos.length) { console.error(`❌ nenhuma foto em ${CORPUS}`); process.exit(1) }
  mkdirSync(GABARITOS, { recursive: true })
  const t = await token()
  console.log(`Semeando ${fotos.length} gabarito(s) CANDIDATOS a partir da leitura atual...\n`)
  for (const arquivo of fotos) {
    const destino = resolve(GABARITOS, `${basename(arquivo, extname(arquivo))}.json`)
    if (existsSync(destino)) { console.log(`  · ${arquivo}: já existe, pulando (apague para refazer)`); continue }
    try {
      const { dados } = await lerFoto(arquivo, t)
      const gabarito = {
        arquivo,
        // ⚠️ NASCE FALSO. O placar ignora este arquivo até o dono conferir a
        // foto e corrigir o que está abaixo. Gabarito semeado pela máquina e
        // aceito sem revisão mede a máquina contra ela mesma — 100% sempre.
        revisado: false,
        conferidoPor: '',
        hospital: dados.hospitalDetectado || '',
        data: dados.dataDetectada || '',
        casos: (dados.casos || []).map((c) => ({
          sala: c.sala || '', hora: c.hora || '', iniciais: c.pacienteIniciais || '',
          procedimento: c.procedimento || '', anestesista: c.anestesista || '',
        })),
        rodape: dados.ordemLiberacao || [],
        ajuda: dados.ajudaExterna || [],
      }
      writeFileSync(destino, `${JSON.stringify(gabarito, null, 2)}\n`)
      console.log(`  ✔ ${arquivo} → gabarito/${basename(destino)}  (${gabarito.casos.length} casos, rodapé ${gabarito.rodape.length})`)
    } catch (e) {
      console.log(`  ✗ ${arquivo}: ${e.message}`)
    }
  }
  console.log('\nPróximo passo (do dono): abrir cada .json ao lado da foto, corrigir e marcar "revisado": true.')
  console.log('Depois: node scripts/eval-escala-vision.mjs rodar --rotulo antes-4.2')
  process.exit(0)
}

if (comando === 'rodar') {
  const rotulo = opcao('rotulo', `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`)
  const fotos = listarFotos()
    .map((f) => ({ arquivo: f, gabarito: lerGabarito(f) }))
    .filter((x) => x.gabarito?.revisado === true)
  if (!fotos.length) {
    console.error('❌ nenhum gabarito com "revisado": true.')
    console.error('   O eval NÃO inventa gabarito: rode `semear`, corrija os .json e marque revisado.')
    process.exit(1)
  }
  const t = await token()
  const desde = new Date(Date.now() - 60_000).toISOString()
  console.log(`Rodando ${fotos.length} foto(s) gabaritada(s)...\n`)
  const pontuacoes = []
  const hashes = []
  for (const { arquivo, gabarito } of fotos) {
    try {
      const { dados, latenciaMs, hash } = await lerFoto(arquivo, t)
      hashes.push(hash)
      if (dados.error) console.log(`  ⚠ ${arquivo}: ${dados.error}`)
      pontuacoes.push({ ...pontuarLeitura({ ...gabarito, arquivo }, dados), latenciaMs })
      process.stdout.write(`  ✔ ${arquivo} (${(latenciaMs / 1000).toFixed(1)}s)\n`)
    } catch (e) {
      console.log(`  ✗ ${arquivo}: ${e.message}`)
    }
  }
  if (!pontuacoes.length) { console.error('❌ nenhuma leitura concluída'); process.exit(1) }

  let custo = null
  let promptVersao = ''
  let modelo = ''
  try {
    const logs = await telemetria(hashes, desde)
    const linhas = [...logs.values()]
    if (linhas.length) {
      const total = linhas.reduce((a, l) => a + custoDaLeitura(l), 0)
      const lat = linhas.map((l) => Number(l.latencia_ms) || 0).sort((a, b) => a - b)
      const media = (f) => linhas.reduce((a, l) => a + (Number(f(l)) || 0), 0) / linhas.length
      custo = {
        leituras: linhas.length,
        total,
        medio: total / linhas.length,
        entradaMedia: media((l) => l.input_tokens),
        saidaMedia: media((l) => l.output_tokens),
        cacheLidoMedio: media((l) => l.cache_read_tokens),
        latenciaMediana: lat[Math.floor(lat.length / 2)] || 0,
      }
      promptVersao = linhas[0].prompt_versao || ''
      modelo = linhas[0].modelo || ''
    }
  } catch (e) {
    console.log(`  (telemetria indisponível: ${e.message})`)
  }

  const resultado = {
    rotulo, quando: new Date().toISOString(), promptVersao, modelo,
    agregado: agregar(pontuacoes), porFoto: pontuacoes, custo,
  }
  mkdirSync(RODADAS, { recursive: true })
  writeFileSync(resolve(RODADAS, `${rotulo}.json`), `${JSON.stringify(resultado, null, 2)}\n`)
  imprimirPlacar(resultado)
  console.log(`\nSalvo em .local/escalas-corpus/eval-runs/${rotulo}.json`)
  process.exit(0)
}

if (comando === 'comparar') {
  const [, a, b] = args
  const ler = (r) => {
    const p = resolve(RODADAS, `${r}.json`)
    if (!existsSync(p)) { console.error(`❌ rodada "${r}" não existe`); process.exit(1) }
    return JSON.parse(readFileSync(p, 'utf8'))
  }
  if (!a || !b) { console.error('uso: comparar <antes> <depois>'); process.exit(1) }
  const A = ler(a)
  const B = ler(b)
  const linha = (rotulo, x, y, sufixo = '%') => {
    if (x === null || y === null) return
    const d = y - x
    const seta = d > 0.05 ? '↑' : d < -0.05 ? '↓' : '='
    console.log(`   ${rotulo.padEnd(28)} ${x.toFixed(1)}${sufixo} → ${y.toFixed(1)}${sufixo}  ${seta} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`)
  }
  console.log(`\n${a} (prompt ${A.promptVersao || '?'})  →  ${b} (prompt ${B.promptVersao || '?'})\n`)
  linha('casos encontrados', A.agregado.casos.acerto, B.agregado.casos.acerto)
  linha('anestesista por linha', A.agregado.anestesista.acerto, B.agregado.anestesista.acerto)
  linha('rodapé posição a posição', A.agregado.rodape.acertoPosicao, B.agregado.rodape.acertoPosicao)
  linha('rodapé nomes presentes', A.agregado.rodape.acertoNomes, B.agregado.rodape.acertoNomes)
  linha('ajuda (azul)', A.agregado.ajuda.acerto, B.agregado.ajuda.acerto)
  if (A.custo && B.custo) {
    linha('custo por leitura ($)', A.custo.medio, B.custo.medio, '')
    const d = B.custo.medio - A.custo.medio
    console.log(`\n   ${d <= 0.0005 ? '✅ custo por leitura igual ou menor — regra do dono (03/09) respeitada'
      : `⛔ custo por leitura SUBIU $${d.toFixed(4)} — a regra do dono (03/09) diz que não entra`}`)
  } else {
    console.log('\n   (uma das rodadas está sem telemetria de custo)')
  }
  if (A.agregado.fotos !== B.agregado.fotos) {
    console.log(`\n   ⚠ as rodadas não têm o mesmo número de fotos (${A.agregado.fotos} × ${B.agregado.fotos}) — a comparação é frouxa`)
  }
  process.exit(0)
}

console.error(`comando desconhecido: ${comando}`)
console.error('use: listar | semear --n 12 | rodar --rotulo <nome> | comparar <antes> <depois>')
process.exit(1)
