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

/**
 * O gabarito é nomeado pelo basename, então `3.jpeg` e `3.png` disputam
 * `3.json`. Na primeira rodada isso fez o eval ler dois arquivos a mais e
 * pontuá-los contra o gabarito de outra foto. O campo `arquivo` dentro do
 * gabarito é o desempate: gabarito de outra foto não serve para esta.
 */
const lerGabarito = (arquivo) => {
  const p = resolve(GABARITOS, `${basename(arquivo, extname(arquivo))}.json`)
  if (!existsSync(p)) return null
  try {
    const g = JSON.parse(readFileSync(p, 'utf8'))
    return g?.arquivo && g.arquivo !== arquivo ? null : g
  } catch { return null }
}

/**
 * O MESMO vocabulário que o app manda (item 4.7): os apelidos do grupo. Sem ele
 * o eval mediria uma leitura que a produção não faz — e, como o roster entra no
 * bloco cacheado do system, mediria o cache errado também.
 */
async function vocabularioDoGrupo() {
  if (!PAT) return []
  try {
    const linhas = await sql('select apelido from public.escala_anestesista_alias order by apelido')
    return (linhas || []).map((l) => String(l.apelido || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function lerFoto(arquivo, token, roster) {
  const bytes = readFileSync(resolve(CORPUS, arquivo))
  const base64 = bytes.toString('base64')
  const mime = MIMES[extname(arquivo).toLowerCase()]
  const t0 = Date.now()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/parse-escala-cirurgica`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64, mimeType: mime,
      ...(roster?.length ? { roster } : {}),
    }),
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
      imagem_largura, imagem_altura, imagem_bytes, normalizacoes, origem, erro
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
      const { dados } = await lerFoto(arquivo, t, await vocabularioDoGrupo())
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
  // Roda sobre TODA foto que tem gabarito (revisada ou não). A pontuação de
  // acerto só sai das revisadas — as demais entregam a medida ESTRUTURAL
  // (quantos casos, que tamanho de rodapé, quanto custou, quanto a normalização
  // precisou agir), que é o suficiente para flagrar uma mudança que fez casos
  // sumirem, e é honesta: não finge acerto onde não há gabarito conferido.
  const fotos = listarFotos()
    .map((f) => ({ arquivo: f, gabarito: lerGabarito(f) }))
    .filter((x) => x.gabarito)
  if (!fotos.length) {
    console.error('❌ nenhum gabarito em .local/escalas-corpus/gabarito/. Rode `semear` primeiro.')
    process.exit(1)
  }
  const revisadas = fotos.filter((x) => x.gabarito.revisado === true)
  const t = await token()
  const vocab = await vocabularioDoGrupo()
  const desde = new Date(Date.now() - 60_000).toISOString()
  console.log(`Vocabulário do grupo: ${vocab.length} apelido(s).`)
  console.log(`Rodando ${fotos.length} foto(s) — ${revisadas.length} com gabarito revisado (acerto) e ${fotos.length - revisadas.length} só na medida estrutural.\n`)
  const pontuacoes = []
  const estrutura = []
  const hashes = []
  for (const { arquivo, gabarito } of fotos) {
    try {
      const { dados, latenciaMs, hash } = await lerFoto(arquivo, t, vocab)
      hashes.push(hash)
      if (dados.error) console.log(`  ⚠ ${arquivo}: ${dados.error}${dados.iaMensagem ? ` — ${String(dados.iaMensagem).slice(0, 120)}` : ''}`)
      estrutura.push({
        arquivo, hash,
        casos: dados.casos?.length ?? 0,
        rodape: dados.ordemLiberacao?.length ?? 0,
        ajuda: dados.ajudaExterna?.length ?? 0,
        hospital: dados.hospitalDetectado || '',
        semAnestesista: (dados.casos || []).filter((c) => !c.anestesista).length,
        truncado: Boolean(dados.truncado),
        latenciaMs,
      })
      if (gabarito.revisado === true) {
        pontuacoes.push({ ...pontuarLeitura({ ...gabarito, arquivo }, dados), latenciaMs })
      }
      process.stdout.write(`  ✔ ${arquivo} (${(latenciaMs / 1000).toFixed(1)}s · ${dados.casos?.length ?? 0} casos · rodapé ${dados.ordemLiberacao?.length ?? 0})\n`)
    } catch (e) {
      console.log(`  ✗ ${arquivo}: ${e.message}`)
    }
  }
  if (!estrutura.length) { console.error('❌ nenhuma leitura concluída'); process.exit(1) }

  let custo = null
  let promptVersao = ''
  let modelo = ''
  let normalizacoes = {}
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
      for (const l of linhas) {
        for (const [k, v] of Object.entries(l.normalizacoes || {})) {
          normalizacoes[k] = (normalizacoes[k] || 0) + (Number(v) || 0)
        }
      }
      promptVersao = linhas[0].prompt_versao || ''
      modelo = linhas[0].modelo || ''
      // rodada servida do cache de 24h custa zero e NÃO é medida de leitura:
      // sem este aviso, repetir o mesmo rótulo daria "$0,0000/leitura" e
      // pareceria a melhoria do século
      custo.doCache = linhas.filter((l) => l.origem === 'cache').length
    }
  } catch (e) {
    console.log(`  (telemetria indisponível: ${e.message})`)
  }

  const soma = (f) => estrutura.reduce((a, e) => a + f(e), 0)
  const resultado = {
    rotulo, quando: new Date().toISOString(), promptVersao, modelo,
    estrutural: {
      fotos: estrutura.length,
      casos: soma((e) => e.casos),
      rodape: soma((e) => e.rodape),
      ajuda: soma((e) => e.ajuda),
      semAnestesista: soma((e) => e.semAnestesista),
      truncadas: soma((e) => (e.truncado ? 1 : 0)),
      normalizacoes,
    },
    porFotoEstrutura: estrutura,
    agregado: pontuacoes.length ? agregar(pontuacoes) : null,
    porFoto: pontuacoes,
    custo,
  }
  mkdirSync(RODADAS, { recursive: true })
  writeFileSync(resolve(RODADAS, `${rotulo}.json`), `${JSON.stringify(resultado, null, 2)}\n`)
  if (resultado.agregado) imprimirPlacar(resultado)
  else {
    console.log(`\n📐 ${rotulo} — medida ESTRUTURAL (nenhum gabarito revisado ainda)`)
    console.log(`   prompt=${promptVersao || '?'}  modelo=${modelo || '?'}  ${estrutura.length} foto(s)`)
    const e = resultado.estrutural
    console.log(`   casos lidos ${e.casos} · rodapé ${e.rodape} · ajuda ${e.ajuda} · sem anestesista ${e.semAnestesista} · truncadas ${e.truncadas}`)
    if (Object.keys(e.normalizacoes).length) {
      console.log(`   normalização precisou agir: ${Object.entries(e.normalizacoes).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
    }
    if (custo) {
      console.log(`   💵 $${custo.total.toFixed(4)} total → $${custo.medio.toFixed(4)}/leitura  (entrada ${Math.round(custo.entradaMedia)} · saída ${Math.round(custo.saidaMedia)} · cache lido ${Math.round(custo.cacheLidoMedio)})`)
      if (custo.doCache) console.log(`   ⚠️  ${custo.doCache}/${custo.leituras} leitura(s) vieram do CACHE de 24h — não são medida de leitura nova`)
      console.log(`   ⏱  latência mediana ${(custo.latenciaMediana / 1000).toFixed(1)}s`)
    }
    console.log('\n   ⚠️  ACERTO ainda não medido: nenhum gabarito com "revisado": true.')
    console.log('      A medida estrutural pega mudança que fez caso sumir; não pega nome trocado.')
  }
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
  const linha = (rotulo, x, y, sufixo = '%', casas = 1) => {
    if (x === null || y === null || x === undefined || y === undefined) return
    const d = y - x
    const eps = 0.5 / 10 ** casas
    const seta = d > eps ? '↑' : d < -eps ? '↓' : '='
    const rel = x ? `  (${d >= 0 ? '+' : ''}${((100 * d) / x).toFixed(0)}%)` : ''
    console.log(`   ${rotulo.padEnd(28)} ${x.toFixed(casas)}${sufixo} → ${y.toFixed(casas)}${sufixo}  ${seta} ${d >= 0 ? '+' : ''}${d.toFixed(casas)}${sufixo === '' && casas > 1 ? rel : ''}`)
  }
  console.log(`\n${a} (prompt ${A.promptVersao || '?'})  →  ${b} (prompt ${B.promptVersao || '?'})\n`)
  if (A.estrutural && B.estrutural) {
    console.log('   ESTRUTURA (vale sem gabarito — pega o que fez caso sumir)')
    linha('casos lidos (total)', A.estrutural.casos, B.estrutural.casos, '')
    linha('rodapé (nomes, total)', A.estrutural.rodape, B.estrutural.rodape, '')
    linha('ajuda/azul (total)', A.estrutural.ajuda, B.estrutural.ajuda, '')
    linha('casos sem anestesista', A.estrutural.semAnestesista, B.estrutural.semAnestesista, '')
    // ⚠️ SUBIR AQUI É O PIOR SINAL DO PLACAR, e por isso ele grita.
    // Em 08/09 o "//" trocado por um campo opcional fez a marca de repetição
    // sumir: os casos continuaram todos lá (348 → 348, contagem intacta) e o
    // ANESTESISTA é que evaporou, de 46 para 180. Nenhuma outra linha do
    // comparativo denunciava isso.
    const semA = B.estrutural.semAnestesista - A.estrutural.semAnestesista
    if (semA > Math.max(3, A.estrutural.semAnestesista * 0.15)) {
      console.log(`   ⛔ ${semA} caso(s) A MAIS sem anestesista. Contagem de casos intacta esconde isso —`)
      console.log('      confira se a marca de repetição ("//") continua chegando antes de subir.')
    }
    // por foto: onde a contagem mudou é onde olhar
    const porA = new Map((A.porFotoEstrutura || []).map((e) => [e.arquivo, e]))
    const mudou = (B.porFotoEstrutura || [])
      .map((e) => ({ e, antes: porA.get(e.arquivo) }))
      .filter(({ e, antes }) => antes && (antes.casos !== e.casos || antes.rodape !== e.rodape || antes.ajuda !== e.ajuda))
    if (mudou.length) {
      console.log('   fotos em que a contagem mudou:')
      for (const { e, antes } of mudou) {
        console.log(`     · ${e.arquivo}: casos ${antes.casos}→${e.casos} · rodapé ${antes.rodape}→${e.rodape} · ajuda ${antes.ajuda}→${e.ajuda}`)
      }
    } else {
      console.log('   nenhuma foto mudou de contagem')
    }
    console.log('')
  }
  if (!A.agregado || !B.agregado) {
    console.log('   ACERTO: não medido (falta gabarito revisado numa das rodadas)\n')
  } else {
    console.log('   ACERTO (contra gabarito revisado)')
    linha('casos encontrados', A.agregado.casos.acerto, B.agregado.casos.acerto)
    linha('anestesista por linha', A.agregado.anestesista.acerto, B.agregado.anestesista.acerto)
    linha('rodapé posição a posição', A.agregado.rodape.acertoPosicao, B.agregado.rodape.acertoPosicao)
    linha('rodapé nomes presentes', A.agregado.rodape.acertoNomes, B.agregado.rodape.acertoNomes)
    linha('ajuda (azul)', A.agregado.ajuda.acerto, B.agregado.ajuda.acerto)
    console.log('')
  }
  for (const [rot, r] of [[a, A], [b, B]]) {
    if (r.custo?.doCache) {
      console.log(`   ⚠ "${rot}": ${r.custo.doCache}/${r.custo.leituras} leitura(s) vieram do CACHE de 24h — o custo dessa rodada não mede leitura nova`)
    }
  }
  if (A.custo && B.custo) {
    linha('custo por leitura ($)', A.custo.medio, B.custo.medio, '', 4)
    linha('tokens de saída (média)', A.custo.saidaMedia, B.custo.saidaMedia, '', 0)
    linha('tokens de entrada (média)', A.custo.entradaMedia, B.custo.entradaMedia, '', 0)
    linha('latência mediana (s)', A.custo.latenciaMediana / 1000, B.custo.latenciaMediana / 1000, 's')
    const d = B.custo.medio - A.custo.medio
    console.log(`\n   ${d <= 0.0005 ? '✅ custo por leitura igual ou menor — regra do dono (03/09) respeitada'
      : `⛔ custo por leitura SUBIU $${d.toFixed(4)} — a regra do dono (03/09) diz que não entra`}`)
  } else {
    console.log('\n   (uma das rodadas está sem telemetria de custo)')
  }
  const fotosA = A.estrutural?.fotos ?? A.agregado?.fotos
  const fotosB = B.estrutural?.fotos ?? B.agregado?.fotos
  if (fotosA !== fotosB) {
    console.log(`\n   ⚠ as rodadas não têm o mesmo número de fotos (${fotosA} × ${fotosB}) — a comparação é frouxa`)
  }
  process.exit(0)
}

console.error(`comando desconhecido: ${comando}`)
console.error('use: listar | semear --n 12 | rodar --rotulo <nome> | comparar <antes> <depois>')
process.exit(1)
