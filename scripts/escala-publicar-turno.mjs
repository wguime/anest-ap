#!/usr/bin/env node
/**
 * Publica a escala cirúrgica de um turno a partir das FOTOS, sem passar pela tela —
 * com TODAS as conferências da tela (dono 08/09/2026).
 *
 * É o caminho da skill `/publicar-escala`. Dois passos, separados de propósito — entre
 * eles quem confere a leitura contra a foto é o Claude:
 *
 *   node scripts/escala-publicar-turno.mjs ler <foto> --hospital unimed|hro|materno --out <rascunho.json>
 *       Lê a foto pela edge `parse-escala-cirurgica` (a MESMA leitura do app, com a dica do
 *       hospital) e grava um rascunho em camelCase. Só mantém `pacienteNome` de convênio
 *       PARTICULAR puro (pré-preenche a cobrança); o resto sai por iniciais (LGPD).
 *
 *   node scripts/escala-publicar-turno.mjs publicar <lote.json> [--ensaio] [--republicar] [--como "GUILHERME MELO"]
 *       lote.json = { data, turno,   (por hospital: ajudaOrdemInformada:true quando o dono numera as ajudas)
 *                     hospitais: { unimed: { casos, posicoesAssistenciais, ordemLiberacao, ajudaExterna, dataDetectada }, hro: …, materno: … },
 *                     decisoes?: { "NOME": { "tipo": "intencional" } | { "tipo": "troca", "parceiro": "NOME" } },
 *                     conferidos?: ["NOME", …] }
 *       Roda `conferirLote` de `src/lib/escalaConferenciaHeadless.js` — a conferência da tela,
 *       pelas mesmas funções, carregadas pelo Module Runner do Vite —, com o dicionário de
 *       apelidos, as escalas já publicadas do dia, as férias do dia (Pega Plantão) e a escala
 *       numérica. BLOQUEIO (nome ambíguo, hora inválida, duplicidade sem decisão, rodapé vazio,
 *       campo que o banco recusa, turno já publicado sem --republicar) recusa; AVISO imprime e
 *       segue. A publicação é a MESMA RPC da tela (`rpc_publicar_escala_turno`), com as decisões
 *       (`p_linha_overrides`) e a preservação do rastro (`p_preservar`), numa transação assinada
 *       como o dono. `--ensaio` termina em ROLLBACK. Depois do commit completa o nome do
 *       paciente PARTICULAR na cobrança e imprime a verificação por SELECT.
 *
 *   node scripts/escala-publicar-turno.mjs publicar-fds <lote.json> [--ensaio] [--republicar] [--como "GUILHERME MELO"]
 *       FIM DE SEMANA (sáb/dom) — o que a tela `ImportarEscalaFdsPage` publica, pelas mesmas libs:
 *       lote.json = { sabado: 'YYYY-MM-DD',
 *                     dias: { 'YYYY-MM-DD': { grade: {'7-13'|'13-19'|'19-07': {unimed,hro,ret1,ret2}},
 *                                             posicoes: {P1..P12: nome}, escalacao: {matutino:[Pn], vespertino:[Pn]},
 *                                             ordemDoc: {matutino:[Pn|nome], vespertino:[…], noturno:[…]} } },
 *                     ignorados?: ['PLANTÃO MATERNO: …'],
 *                     mapas: [{ hospital, data, dataDetectada, casos, posicoesAssistenciais }] }
 *       `ordemDoc` é a linha "1º→último a ser LIBERADO" como está no documento — a inversão para o
 *       rodapé acontece UMA vez aqui (`rodapeDeOrdemDoc`); linha vazia = sugestão (`sugerirRodapeFds`,
 *       marcada "sugerida"). Publica até 4 linhas hospital='fds' (casos [] + fds_meta com a fila da
 *       noite em ordemNoite) e uma chamada por (hospital, dia, turno) COM casos, sem rodapé nem ajuda —
 *       no FDS a fila é a da linha 'fds'. Domingo herda as posições do sábado (lacunas).
 *
 * Credenciais lidas de `.env.local` dentro do processo, nunca impressas:
 *   SUPABASE_JWT_SECRET · SUPABASE_ACCESS_TOKEN · VITE_SUPABASE_URL
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { createHmac } from 'crypto'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const falhar = (msg) => { console.error(`❌ ${msg}`); process.exit(1) }
if (!PAT) falhar('SUPABASE_ACCESS_TOKEN ausente em .env.local')

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const txt = await r.text()
  let body
  try { body = JSON.parse(txt) } catch { body = txt }
  return { ok: r.ok, status: r.status, body }
}
async function sqlOuFalha(query, rotulo) {
  const r = await sql(query)
  if (!r.ok) falhar(`${rotulo}: ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`)
  return Array.isArray(r.body) ? r.body : []
}
function assinarJwt(sub) {
  if (!JWT_SECRET) falhar('SUPABASE_JWT_SECRET ausente em .env.local')
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const agora = Math.floor(Date.now() / 1000)
  const c = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub, role: 'authenticated', iss: 'supabase', iat: agora, exp: agora + 3600 })
  return `${c}.${p}.${createHmac('sha256', JWT_SECRET).update(`${c}.${p}`).digest('base64url')}`
}
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase()

// ── libs de src/ pelo Module Runner do Vite (mesmas funções da tela) ─────────
async function carregarLibs() {
  const { createServer, createServerModuleRunner } = await import('vite')
  const server = await createServer({
    root: raiz, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false })
  const headless = await runner.import('/src/lib/escalaConferenciaHeadless.js')
  const dadosNumerica = (await runner.import('/src/data/escalaNumerica.json')).default
  const { iniciaisSeguras } = await runner.import('/src/lib/escalaCirurgicaPaciente.js')
  const urgencias = await runner.import('/src/lib/escalaCirurgicaUrgencias.js')
  const fds = await runner.import('/src/lib/escalaFds.js')
  const fdsMapas = await runner.import('/src/lib/escalaFdsMapas.js')
  const fdsPP = await runner.import('/src/lib/escalaFdsPegaPlantao.js')
  const numerica = await runner.import('/src/lib/escalaNumerica.js')
  const utils = await runner.import('/src/pages/escala-cirurgica/utils.js')
  const validacao = await runner.import('/src/lib/escalaCirurgicaValidacao.js')
  const regras = await runner.import('/src/lib/escalaCirurgicaRegras.js')
  return {
    headless, dadosNumerica, iniciaisSeguras, urgencias, fds, fdsMapas, fdsPP, numerica, utils, validacao, regras,
    fechar: () => server.close(),
  }
}

/**
 * O que a tela faz DEPOIS de publicar o HRO: cruza as urgências das salas de contrato
 * (Sala 5, Sala 7, orto…) com quem a escala nova colocou nelas — a urgência da manhã que
 * ainda está aberta passa para quem está na sala à tarde, e fica sem dono quando ninguém
 * está (`planoCruzamentoUrgencias`, `ImportarEscalaPage.jsx` ~1734). `dry` só imprime.
 */
async function cruzarUrgenciasHro(urgencias, data, turno, { dry = false } = {}) {
  // lança em vez de sair: a escala JÁ está publicada quando isto roda
  const q = async (query, rotulo) => { const r = await sql(query); if (!r.ok) throw new Error(`${rotulo}: ${r.status}`); return Array.isArray(r.body) ? r.body : [] }
  const [header] = (await q(`select id, urgencias_meta from public.escala_cirurgica where data='${data}' and hospital='hro'`, 'escala do HRO')).map(objCamel)
  if (!header) return
  const casos = (await q(`select * from public.escala_cirurgica_caso where escala_id='${header.id}'`, 'casos do HRO')).map(objCamel)
  const plano = urgencias.planoCruzamentoUrgencias(casos, turno, { salas: urgencias.salasContrato(header.urgenciasMeta, turno) })
  if (!plano.atribuir.length && !plano.semAnestesista.length) { console.log('   hro: urgências — nada a cruzar'); return }
  for (const a of plano.atribuir) {
    console.log(`   hro: urgência ${a.caso.sala} ${a.caso.hora || ''} (${a.caso.procedimento || ''}) ${dry ? 'iria para' : 'passa para'} ${a.apelido}`)
    if (dry) continue
    const patch = a.uid
      ? `anestesista=$j$${a.apelido}$j$, anestesista_user_id='${a.uid}', sem_anestesista=false`
      : `anestesista=$j$${a.apelido}$j$, anestesista_user_id=null, sem_anestesista=false`
    await q(`update public.escala_cirurgica_caso set ${patch}, updated_at=now() where id='${a.caso.id}'`, 'cruzar urgência')
  }
  if (plano.semAnestesista.length) {
    const ids = plano.semAnestesista.map((x) => `'${x.caso.id}'`).join(',')
    console.log(`   hro: ${plano.semAnestesista.length} urgência(s) ${dry ? 'ficariam' : 'ficam'} sem dono (ninguém na sala neste turno): ${plano.semAnestesista.map((x) => `${x.caso.sala} ${x.caso.hora || ''}`).join(', ')}`)
    if (!dry) await q(`update public.escala_cirurgica_caso set anestesista='?', anestesista_user_id=null, sem_anestesista=true, updated_at=now() where id in (${ids})`, 'urgência sem dono')
  }
}

// ── dados do dia ─────────────────────────────────────────────────────────────
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const objCamel = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [camel(k), v]))

async function carregarIdentidade() {
  const perfis = (await sqlOuFalha('select id, nome, role, email, conta_duplicada_de from public.profiles', 'perfis')).map(objCamel)
  const aliases = (await sqlOuFalha('select apelido, user_id from public.escala_anestesista_alias', 'dicionário')).map(objCamel)
  return { perfis, aliases }
}

async function carregarPublicadas(data) {
  const headers = (await sqlOuFalha(`select * from public.escala_cirurgica where data='${data}'`, 'escalas do dia')).map(objCamel)
  if (!headers.length) return {}
  const ids = headers.map((h) => `'${h.id}'`).join(',')
  const casos = (await sqlOuFalha(`select * from public.escala_cirurgica_caso where escala_id in (${ids}) order by sala, ordem`, 'casos do dia')).map(objCamel)
  const out = {}
  for (const h of headers) out[h.hospital] = { ...h, casos: casos.filter((c) => c.escalaId === h.id) }
  return out
}

/** Plantões do Pega Plantão num intervalo, pelo proxy (o mesmo `getPlantoes` da tela). null = não consultado. */
async function plantoesPegaPlantao(dataInicio, dataFim, uid) {
  try {
    const endpoint = '/api/v1/plantoes?' + new URLSearchParams({
      'filtro.dataInicio': dataInicio, 'filtro.dataFim': dataFim,
    }).toString()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pegaplantao-proxy`, {
      method: 'POST', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${assinarJwt(uid)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method: 'GET' }),
    })
    if (!r.ok) return null
    const dados = await r.json()
    return Array.isArray(dados) ? dados : (dados?.data || dados?.items || [])
  } catch {
    return null
  }
}

/** Nomes completos de quem está de férias em `data`, pelo Pega Plantão (mesmo filtro da tela). null = não consultado. */
async function feriasDoDia(data, uid) {
  try {
    const [ano, mes] = data.split('-')
    const ultimo = new Date(Number(ano), Number(mes), 0).getDate()
    const lista = await plantoesPegaPlantao(`${ano}-${mes}-01T00:00:00`, `${ano}-${mes}-${String(ultimo).padStart(2, '0')}T23:59:59`, uid)
    if (lista === null) return null
    const nomes = new Set()
    for (const p of lista) {
      if (!p?.Setor || !/f[ée]rias/i.test(p.Setor)) continue
      if (String(p.Inicio || '').slice(0, 10) !== data) continue
      const nome = (p.ProfDePlantao || p.ProfFixo || '').trim().toUpperCase()
      if (nome) nomes.add(nome)
    }
    return [...nomes]
  } catch {
    return null
  }
}

// ── comandos ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const cmd = args[0]
const opt = (n, padrao = null) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : padrao }
const flag = (n) => args.includes(`--${n}`)

if (cmd === 'ler') {
  const foto = args[1]
  const hospital = opt('hospital')
  const out = opt('out')
  if (!foto || !existsSync(foto)) falhar('uso: ler <foto> --hospital unimed|hro|materno --out <rascunho.json>')
  if (!['unimed', 'hro', 'materno'].includes(hospital)) falhar('--hospital precisa ser unimed, hro ou materno')
  if (!out) falhar('--out <rascunho.json> é obrigatório')
  const MIMES = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
  const mime = MIMES[extname(foto).toLowerCase()] || 'image/jpeg'
  const base64 = readFileSync(foto).toString('base64')
  const { aliases } = await carregarIdentidade()
  const uid = aliases.find((a) => norm(a.apelido) === norm(opt('como', 'GUILHERME MELO')))?.userId
  if (!uid) falhar('não achei quem assina no dicionário de apelidos (--como)')
  const roster = aliases.map((a) => a.apelido).sort()
  const t0 = Date.now()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/parse-escala-cirurgica`, {
    method: 'POST', signal: AbortSignal.timeout(240_000),
    headers: { Authorization: `Bearer ${assinarJwt(uid)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: mime, roster, hospital }),
  })
  const texto = await r.text()
  if (!r.ok) falhar(`edge ${r.status}: ${texto.slice(0, 300)}`)
  const dados = JSON.parse(texto)
  if (dados.error) falhar(`leitura falhou: ${dados.error} ${dados.iaMensagem || ''}`)
  for (const c of dados.casos || []) if (!/^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio))) delete c.pacienteNome
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(resolve(out), JSON.stringify({ hospital, lidoEm: new Date().toISOString(), ...dados }, null, 1))
  const casos = dados.casos || []
  console.log(`✅ ${hospital}: ${casos.length} caso(s), rodapé ${(dados.ordemLiberacao || []).length}, ajuda ${JSON.stringify(dados.ajudaExterna || [])}, data lida ${dados.dataDetectada || '—'}${dados.truncado ? ' ⚠️ TRUNCADA' : ''}${dados.rodapeVazio ? ' ⚠️ RODAPÉ VAZIO' : ''} (${((Date.now() - t0) / 1000).toFixed(0)}s) → ${out}`)
  for (const c of casos) {
    console.log(`   ${String(c.sala).padEnd(26)} | ${String(c.hora).padEnd(5)} | ${String(c.procedimento || '').slice(0, 40).padEnd(40)} | ${String(c.anestesista).padEnd(20)} | ${c.convenio || ''}${c.cor ? ` | cor=${c.cor}` : ''}`)
  }
  process.exit(0)
}

if (cmd === 'publicar') {
  const arquivo = args[1]
  if (!arquivo || !existsSync(arquivo)) falhar('uso: publicar <lote.json> [--ensaio] [--republicar] [--como "GUILHERME MELO"]')
  const lote = JSON.parse(readFileSync(arquivo, 'utf8'))
  const data = String(lote.data || '')
  const turno = String(lote.turno || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) falhar('lote.data precisa ser YYYY-MM-DD')
  if (!['matutino', 'vespertino'].includes(turno)) falhar('lote.turno precisa ser matutino ou vespertino')
  const entradas = Object.entries(lote.hospitais || {}).filter(([h]) => ['unimed', 'hro', 'materno'].includes(h))
  if (!entradas.length) falhar('lote.hospitais vazio')
  const ensaio = flag('ensaio')
  const republicar = flag('republicar')
  const comoApelido = opt('como', 'GUILHERME MELO')

  const libs = await carregarLibs()
  const { headless, dadosNumerica, iniciaisSeguras } = libs
  const { perfis, aliases } = await carregarIdentidade()
  const identidade = headless.montarRoster({ perfis, aliases })
  const uidDono = identidade.resolver(comoApelido)
  if (!uidDono) falhar(`não achei quem é "${comoApelido}" no dicionário`)
  const publicadas = await carregarPublicadas(data)
  const ferias = await feriasDoDia(data, uidDono)
  if (ferias === null) console.log('⚠️  férias do Pega Plantão não consultadas — a numérica confere sem férias')
  else console.log(`férias em ${data} (Pega Plantão): ${ferias.length ? ferias.join(', ') : 'ninguém'}`)

  const hospitais = {}
  for (const [h, d] of entradas) {
    hospitais[h] = {
      rows: d.casos || [], posicoes: d.posicoesAssistenciais || [],
      ordem: d.ordemLiberacao || [], ajuda: d.ajudaExterna || [], dataDetectada: d.dataDetectada || '',
    }
  }
  const resultado = headless.conferirLote({
    data, turno, hospitais, publicadas, ...identidade, dadosNumerica, ferias,
    decisoes: lote.decisoes || {}, conferidos: lote.conferidos || [], republicar,
    carimbo: { por: uidDono, em: new Date().toISOString() },
  })

  // ── relatório da conferência ──────────────────────────────────────────────
  let totalBloqueios = 0
  for (const r of resultado.realocados) console.log(`↔️  azul emprestado: ${r.nome} sai da ajuda do ${r.de} e entra na ajuda do ${r.para}`)
  for (const [h, r] of Object.entries(resultado.hospitais)) {
    const p = r.payload
    console.log(`\n== ${h.toUpperCase()} · ${data} · ${turno} · ${p.casos.length} caso(s) · rodapé ${p.ordemLiberacao.length} · ajuda ${JSON.stringify(p.ajudaExterna)}`)
    for (const c of p.casos) {
      // a linha impressa é a unidade da releitura contra a foto (skill, passo 3): cor, particular
      // e nome do paciente aparecem aqui para não exigir abrir o JSON
      const partic = /^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio))
      console.log(`   ${String(c.sala).padEnd(18)} | ${String(c.hora || '').padEnd(5)} | ${String(c.procedimento || '').slice(0, 38).padEnd(38)} | ${String(c.anestesista || '').padEnd(20)} | ${c.anestesistaUserId ? 'uid' : (c.semAnestesista ? 'SEM' : 'sem vínculo')}${c.cor ? ` | ${c.cor}` : ''}${c.isContinuacao ? ' | cont.' : ''}${c.tipo && c.tipo !== 'eletiva' ? ` | ${c.tipo}` : ''}${partic ? ` | PART${c.pacienteNome ? ': ' + c.pacienteNome : ' SEM NOME'}` : ''}`)
    }
    // PARTICULAR sem nome do paciente: a cobrança não abre, em silêncio (5 de 8 no HRO nas leituras
    // de 10–11/09). Aviso, não bloqueio — "04 FACO" particular sem paciente é legítimo.
    for (const c of p.casos) {
      if (/^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio)) && !c.pacienteNome && c.pacienteIniciais) r.avisos.push({ codigo: 'particular sem nome', texto: `${c.sala} ${c.hora || ''} (${c.pacienteIniciais}): convênio particular sem pacienteNome — a cobrança não abre; confira a foto` })
    }
    if (p.ordemLiberacao.length) console.log(`   rodapé: ${r.ordemNumerada.map((o) => `${o.i + 1}.${o.nome}${o.casos ? '' : '°'}${o.ajuda ? '*' : ''}`).join(' / ')}  (° sem caso · * ajuda)`)
    if (r.numerica) console.log(`   numérica: ${r.numerica.iguais ? 'igual ao rodapé' : 'difere'}${r.numerica.feriasConferidas ? ' (férias conferidas)' : ''}`)
    if (Object.keys(p.linhaOverrides || {}).length) console.log(`   decisões: ${JSON.stringify(p.linhaOverrides)}`)
    if (p.preservar) console.log(`   preservar: ${p.preservar.linhas.length} linha(s) com rastro`)
    for (const b of r.bloqueios) console.log(`   ❌ ${b.codigo}: ${b.texto}`)
    for (const a of r.avisos) console.log(`   ⚠️  ${a.codigo}: ${a.texto}`)
    totalBloqueios += r.bloqueios.length
  }
  if (totalBloqueios) {
    await libs.fechar()
    falhar(`${totalBloqueios} bloqueio(s) — a tela também recusaria. Corrija o lote (ou responda em decisoes/conferidos) e repita.`)
  }

  // ── payload da RPC, como o service monta ───────────────────────────────────
  const CASO_FIELDS = ['sala', 'ordem', 'hora', 'tempoEstimado', 'terminoPrevisto', 'pacienteIniciais', 'idade', 'procedimento',
    'convenio', 'cirurgiao', 'cirurgiaoDisplay', 'anestesista', 'anestesistaUserId', 'residente', 'residenteUserId', 'bloco',
    'isContinuacao', 'semAnestesista', 'tipo', 'gravidade', 'turno']
  const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  const linhaDoCaso = (c, i) => {
    const out = {}
    for (const f of CASO_FIELDS) if (c[f] !== undefined) out[snake(f)] = c[f]
    if (typeof out.paciente_iniciais === 'string') out.paciente_iniciais = iniciaisSeguras(out.paciente_iniciais)
    out.ordem = i
    out.turno = turno
    return out
  }
  const dq = (o) => { const j = JSON.stringify(o); if (j.includes('$j$')) falhar('payload contém $j$'); return `$j$${j}$j$::jsonb` }
  const ordemInformada = Object.fromEntries(entradas.map(([h, d]) => [h, d.ajudaOrdemInformada === true]))
  const chamadas = []
  const particulares = []
  for (const [h, r] of Object.entries(resultado.hospitais)) {
    const p = r.payload
    const header = { data, hospital: h, status: 'publicada', ordem_liberacao: p.ordemLiberacao, ajuda_externa: p.ajudaExterna, source_image_path: null, published_by_name: comoApelido }
    const casos = p.casos.map(linhaDoCaso)
    const extras = [Object.keys(p.linhaOverrides || {}).length ? dq(p.linhaOverrides) : 'null::jsonb']
    if (p.preservar) extras.push(dq(p.preservar))
    chamadas.push(`select public.rpc_publicar_escala_turno('${data}','${h}','${turno}', ${dq(header)}, ${dq(casos)}, ${extras.join(', ')});`)
    // ORDEM INFORMADA DA AJUDA (dono 09/09): quando o recado numera as ajudas
    // ("3º Rafael – Unimed, 4º Alexandre – Unimed"), essa ordem passa a mandar na
    // cauda da fila e a derivação por hospital de origem (27/08) fica de reserva.
    // Sem a marca a fila publicava ao contrário do pedido, e as setas somem em
    // quem tem origem — não havia nem conserto na tela. Publicação SEM numeração
    // apaga a marca do turno: senão a lista que a Vision monta na ordem da IMAGEM
    // herdaria autoridade que ninguém deu a ela.
    chamadas.push(ordemInformada[h]
      // ⚠️ jsonb_set só cria a ÚLTIMA chave do caminho: com `ordemInformada` ausente,
      // '{ordemInformada,<turno>}' devolveria o campo intacto, em silêncio.
      ? `update public.escala_cirurgica set ajuda_externa=jsonb_set(coalesce(ajuda_externa,'{}'::jsonb),'{ordemInformada}',coalesce(ajuda_externa->'ordemInformada','{}'::jsonb)||jsonb_build_object('${turno}',true),true) where data='${data}' and hospital='${h}';`
      : `update public.escala_cirurgica set ajuda_externa=coalesce(ajuda_externa,'{}'::jsonb) #- '{ordemInformada,${turno}}' where data='${data}' and hospital='${h}';`)
    p.casos.forEach((c, i) => { if (c.pacienteNome && /^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio))) particulares.push({ hospital: h, sala: casos[i].sala, ordem: i, hora: c.hora, nome: String(c.pacienteNome).trim() }) })
  }
  const corpo = `select set_config('request.jwt.claims', ${dq({ sub: uidDono })}::text, true);\n${chamadas.join('\n')}`
  if (ensaio) {
    const r = await sql(`begin;\n${corpo}\nrollback;`)
    if (!r.ok) { await libs.fechar(); falhar(`ensaio falhou: ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`) }
    console.log(`\n✅ ENSAIO ok (rollback): a RPC aceitou ${chamadas.length} publicação(ões) sem bloqueio. Repita sem --ensaio para publicar.`)
    if (resultado.hospitais.hro && publicadas.hro) await cruzarUrgenciasHro(libs.urgencias, data, turno, { dry: true })
    await libs.fechar()
    process.exit(0)
  }
  const r = await sql(`begin;\n${corpo}\ncommit;`)
  if (!r.ok) { await libs.fechar(); falhar(`publicação falhou (nada gravado): ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`) }

  // ── verificação + nome do paciente PARTICULAR na cobrança ──────────────────
  const verif = await sqlOuFalha(`
    select e.hospital, e.id, e.publicacao_turnos->'${turno}'->>'casos' as declarados,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='${turno}') as reais,
           jsonb_array_length(coalesce(e.ordem_liberacao->'${turno}','[]'::jsonb)) as rodape,
           e.ajuda_externa->'${turno}' as ajuda, e.published_by_name
      from public.escala_cirurgica e where e.data='${data}' and e.hospital in (${Object.keys(resultado.hospitais).map((h) => `'${h}'`).join(',')}) order by e.hospital`, 'verificação')
  console.log('\n✅ PUBLICADO:')
  for (const v of verif) console.log(`   ${v.hospital}: ${v.reais} caso(s) (declarados ${v.declarados}) · rodapé ${v.rodape} · ajuda ${JSON.stringify(v.ajuda)} · por ${v.published_by_name}`)
  for (const pc of particulares) {
    const escala = verif.find((v) => v.hospital === pc.hospital)
    if (!escala) continue
    const linhas = await sqlOuFalha(`
      with caso as (
        select id from public.escala_cirurgica_caso
         where escala_id='${escala.id}' and turno='${turno}' and sala=${dq(pc.sala)}#>>'{}' and ordem=${pc.ordem} limit 1)
      update public.cirurgias_particulares cp
         set paciente=${dq(pc.nome)}#>>'{}', updated_at=now(), updated_by='${uidDono}', updated_by_name='${comoApelido.replace(/'/g, "''")}'
        from caso where cp.escala_caso_id=caso.id and cp.cancelada_em is null and cp.paciente !~ '[[:alpha:]]{3,}'
      returning cp.id`, 'nome do particular')
    console.log(`   ${pc.hospital}: paciente particular (${pc.sala} ${pc.hora}) ${linhas.length ? 'completado na cobrança' : 'sem rascunho de cobrança para completar'}`)
  }
  // Urgências do HRO cruzadas com a escala nova, como a tela faz depois de publicar.
  if (resultado.hospitais.hro) {
    try { await cruzarUrgenciasHro(libs.urgencias, data, turno) } catch (e) { console.log(`   ⚠️  hro: cruzamento de urgências não rodou (${e.message}) — ajuste no card`) }
  }
  // Troca declarada (trocaCom) ainda sem execução (assumidaPor): na tela ela fecha com um
  // toque no badge Troca; aqui só se avisa — executar o swap é decisão de quem está no turno.
  const pendentesTroca = await sqlOuFalha(`
    select e.hospital, k.key as chave
      from public.escala_cirurgica e, jsonb_each(coalesce(e.linha_overrides,'{}'::jsonb)) k
     where e.data='${data}' and k.key like '${turno}:%'
       and jsonb_typeof(k.value->'trocaCom')='object' and not (k.value ? 'assumidaPor')
       and coalesce((k.value->'trocaCom'->>'apenasRegistro')::boolean, false) = false`, 'trocas pendentes')
  for (const t of pendentesTroca) console.log(`   ⚠️  ${t.hospital}: troca declarada em ${t.chave} ainda não executada — o badge Troca na fila fecha com um toque`)
  await libs.fechar()
  process.exit(0)
}

if (cmd === 'publicar-fds') {
  const arquivo = args[1]
  if (!arquivo || !existsSync(arquivo)) falhar('uso: publicar-fds <lote.json> [--ensaio] [--republicar] [--como "GUILHERME MELO"]')
  const lote = JSON.parse(readFileSync(arquivo, 'utf8'))
  const ensaio = flag('ensaio')
  const republicar = flag('republicar')
  const comoApelido = opt('como', 'GUILHERME MELO')
  const libs = await carregarLibs()
  const { headless, iniciaisSeguras, fds, fdsMapas, fdsPP, numerica, utils, validacao, regras } = libs
  const sair = async (msg) => { await libs.fechar(); falhar(msg) }

  // ── o fim de semana ────────────────────────────────────────────────────────
  const TURNOS_FDS = ['matutino', 'vespertino']           // turnos de PUBLICAÇÃO (o CHECK do banco)
  const TURNOS_ORDEM = [...TURNOS_FDS, 'noturno']         // + a fila da noite, que viaja em fds_meta.ordemNoite
  const datas = Object.keys(lote.dias || {}).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  if (!datas.length) await sair('lote.dias vazio — precisa de pelo menos o sábado')
  for (const d of datas) {
    if (fds.ehFeriado(d)) await sair(`${d} é FERIADO: a folha do feriado é uma lista simples (ordensDocumentoFeriado) e este comando só cobre sáb/dom — publique pela tela`)
    if (!fds.ehFimDeSemana(d)) await sair(`${d} não é sábado nem domingo`)
  }
  const sabado = String(lote.sabado || fds.sabadoDoFimDeSemana(datas[0]))
  if (!datas.every((d) => fds.sabadoDoFimDeSemana(d) === sabado)) await sair(`os dias do lote não pertencem ao fim de semana de ${sabado}`)

  const { perfis, aliases } = await carregarIdentidade()
  const identidade = headless.montarRoster({ perfis, aliases })
  const { roster, rosterByUid, resolver } = identidade
  const uidDono = resolver(comoApelido)
  if (!uidDono) await sair(`não achei quem é "${comoApelido}" no dicionário`)
  const primeiroNomeUpper = (nome) => utils.normNome(String(nome || '').split(/\s+/)[0] || '')
  const apelidoCanonico = (uid, fallback) => {
    const r = rosterByUid.get(uid)
    return r ? (r.apelidos?.[0] || primeiroNomeUpper(r.nome)) : fallback
  }

  // ── 1. tabela de posições: grade + posições + ordens, dia a dia ────────────
  const dias = {}
  let posicoesAnteriores = {}
  const bloqueiosTabela = []
  const avisosTabela = []
  for (const iso of datas) {
    const d = lote.dias[iso] || {}
    const grade = {}
    for (const faixa of fds.FAIXAS_FDS) {
      const l = d.grade?.[faixa] || {}
      grade[faixa] = { unimed: norm(l.unimed), hro: norm(l.hro), ret1: norm(l.ret1), ret2: norm(l.ret2) }
    }
    const posicoes = {}
    for (const [codigo, nome] of Object.entries(d.posicoes || {})) {
      const pn = fds.normalizarPn(codigo)
      if (pn && norm(nome)) posicoes[pn] = norm(nome)
    }
    // domingo herda do sábado só as LACUNAS: o dado do próprio dia vence (troca pessoal)
    for (const [pn, nome] of Object.entries(posicoesAnteriores)) if (!posicoes[pn]) posicoes[pn] = nome
    posicoesAnteriores = posicoes
    const escalacao = { matutino: [], vespertino: [] }
    for (const t of TURNOS_FDS) {
      for (const tok of d.escalacao?.[t] || []) { const pn = fds.normalizarPn(tok); if (pn && !escalacao[t].includes(pn)) escalacao[t].push(pn) }
    }
    const ordem = {}
    const ordemFonte = {}
    const acrescentados = {}
    for (const turno of TURNOS_ORDEM) {
      const tokens = (d.ordemDoc?.[turno] || []).map((t) => fds.normalizarPn(t) || norm(t)).filter(Boolean)
      let rodape
      if (tokens.length) {
        const r = fds.rodapeDeOrdemDoc(tokens, posicoes)
        rodape = r.rodape
        ordemFonte[turno] = 'documento'
        if (r.semDono.length) bloqueiosTabela.push(`${iso} · ${turno}: posição sem pessoa no mapeamento: ${r.semDono.join(', ')}`)
      } else {
        // sem linha no documento: sugestão = a própria ordem de escalação (a tela marca "Sugerida")
        rodape = fds.sugerirRodapeFds({ grade, posicoes, escalacao, data: iso }, turno)
        ordemFonte[turno] = 'sugerida'
      }
      if (!rodape.length && turno !== 'noturno') bloqueiosTabela.push(`${iso} · ${turno}: ordem de liberação vazia — sem ela a fila seria inventada dos casos`)
      // QUEM ESTÁ NA FAIXA E NÃO FOI CITADO NUNCA SOME (dono 15/08, 29/08) — só turnos de dia;
      // à noite `linhasNoturnasFds` já põe na frente quem está na grade e ficou fora da ordem.
      if (turno !== 'noturno' && rodape.length) {
        const c = fds.completarRodapeFds(rodape, grade[fds.FDS_TURNO_FAIXA[turno]], { resolverUid: resolver })
        rodape = c.rodape
        if (c.acrescentados.length) acrescentados[turno] = c.acrescentados
      }
      // identidade: nome ambíguo BLOQUEIA (incidente "JOAO" 11/08); sem vínculo só avisa
      for (const nome of rodape) {
        if (resolver(nome)) continue
        if (utils.candidatosPrimeiroNome(nome, roster).length >= 2) bloqueiosTabela.push(`${iso} · ${turno}: "${nome}" tem mais de um candidato no cadastro — escreva o nome completo`)
        else avisosTabela.push(`${iso} · ${turno}: "${nome}" não está no dicionário — publica como texto, sem login`)
      }
      ordem[turno] = rodape
    }
    dias[iso] = { grade, posicoes, escalacao, ordem, ordemFonte, acrescentados }
  }

  // ── 2. a tabela lida × o Pega Plantão (dono 04/09) — aviso, nunca bloqueio ──
  const registrosPP = await plantoesPegaPlantao(`${sabado}T00:00:00`, `${sabado}T23:59:59`, uidDono)
  let textoPP = ''
  if (registrosPP === null) textoPP = 'Pega Plantão não consultado — posições conferidas só contra a foto'
  else if (dias[sabado]) {
    const posicoesPP = fdsPP.posicoesDoPegaPlantao(registrosPP, sabado)
    if (Object.keys(posicoesPP).length) {
      const casar = (a, b) => {
        const ua = resolver(a); const ub = resolver(b)
        if (ua && ub) return ua === ub
        return numerica.casarNomeComLegenda(a, b) || numerica.casarNomeComLegenda(b, a)
      }
      const c = fdsPP.compararPosicoesFds(dias[sabado].posicoes, posicoesPP, { casar })
      textoPP = c.iguais ? 'posições iguais ao Pega Plantão' : fdsPP.textoComparacaoFds(c)
      if (!c.iguais && !textoPP) textoPP = `posições: só diferenças que o Pega Plantão não cobre (${c.sobrando.map((x) => x.pn).join(', ')})`
      // o dado por trás da frase: quem decide entre documento e Pega Plantão é quem lê a foto
      textoPP += `\n   Pega Plantão em ${sabado}: ${Object.entries(posicoesPP).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([pn, n]) => `${pn} ${n}`).join(' · ')}`
    } else textoPP = `Pega Plantão sem posições registradas em ${sabado}`
  }

  // ── 3. mapas: casos por (hospital, dia, turno), como ConferirMapaFdsPage ───
  const publicadasPorData = {}
  for (const iso of datas) publicadasPorData[iso] = await carregarPublicadas(iso)
  const planos = []          // { hospital, data, turno, casos, avisos, bloqueios }
  for (const m of lote.mapas || []) {
    const hospital = String(m.hospital || '')
    const data = String(m.data || '')
    if (!fdsMapas.HOSPITAIS_MAPA.includes(hospital)) await sair(`mapa com hospital inválido: "${hospital}"`)
    if (!dias[data]) await sair(`mapa de ${hospital} em ${data}: a data não está em lote.dias`)
    const rows = (m.casos || []).map((c) => ({ ...utils.linhaVazia(), ...c }))
    const preparados = utils.prepararCasosFimDeSemana(rows, hospital, m.posicoesAssistenciais || [])
    for (const turno of fdsMapas.TURNOS_MAPA) {
      const casosDoTurno = preparados.filter((c) => c.turno === turno)
      if (!casosDoTurno.length) continue     // turno vazio não é publicado (a RPC substitui o turno inteiro)
      const avisos = []
      const bloqueios = []
      if (m.dataDetectada && m.dataDetectada !== data) avisos.push(`a foto diz ${m.dataDetectada} e a publicação é de ${data}`)
      const grupos = utils.gruposAnestesista(casosDoTurno, hospital)
      const lidas = fdsMapas.sugerirAtribuicoesLidas(grupos, resolver)
      // posto da grade: só a MANHÃ DE SÁBADO, só grupo SEM nome (dono 29/08)
      const nomePosto = fdsMapas.anestesistaDoPosto(dias[data].grade, hospital, turno, data)
      const doPosto = fdsMapas.sugerirAtribuicoesDoPosto(grupos, nomePosto, resolver)
      for (const [chave, v] of Object.entries(doPosto)) {
        const g = grupos.find((x) => x.chave === chave)
        avisos.push(`${g?.sala || chave}: sem nome no mapa — sugerido pelo posto da grade: ${v.nome}`)
      }
      const atribuicoes = { ...lidas, ...Object.fromEntries(Object.entries(doPosto).map(([k, v]) => [k, v.uid])) }
      for (const g of grupos) {
        const lido = String(g.nome || '').trim()
        if (atribuicoes[g.chave]) continue
        if (!lido || /^\?+$/.test(lido)) { avisos.push(`${g.sala || g.chave}: sala sem anestesista (fica "?")`); continue }
        if (lido.includes('+')) { avisos.push(`${g.sala || g.chave}: dupla "${lido}" — fica como texto, a fila conta os dois`); continue }
        if (utils.candidatosPrimeiroNome(lido, roster).length >= 2) bloqueios.push(`${g.sala || g.chave}: "${lido}" pode ser mais de uma pessoa — escreva o nome completo no lote`)
        else avisos.push(`${g.sala || g.chave}: "${lido}" não está no dicionário — publica como texto, sem login`)
      }
      const nomePorChave = Object.fromEntries(grupos.map((g) => [g.chave, g.nome]))
      const casos = utils.aplicarAtribuicoes(casosDoTurno, atribuicoes, (chave, uid) => apelidoCanonico(uid, nomePorChave[chave] ? utils.normNome(nomePorChave[chave]) : ''), resolver)
      for (const b of validacao.validarCasosParaPublicacao(casos, { horaValida: (h) => regras.ehHoraSequencialEscala(h) || !!utils.turnoDeHora(h) })) bloqueios.push(validacao.textoBloqueio(b))
      const existente = publicadasPorData[data]?.[hospital] || null
      const antes = (existente?.casos || []).filter((c) => (c.turno || 'matutino') === turno).length
      if (existente?.publicacaoTurnos?.[turno] && !republicar) bloqueios.push(`${hospital} ${data} ${turno} já está publicado (${antes} casos) — republicar zera status e liberações; use --republicar se for isso mesmo`)
      else if (antes >= 3 && antes > casos.length) avisos.push(`a escala publicada tem ${antes} casos e a nova tem ${casos.length} — publicar apaga os anteriores`)
      planos.push({ hospital, data, turno, casos, avisos, bloqueios })
    }
  }
  // a linha 'fds' já publicada também trava sem --republicar (a RPC substitui o turno)
  for (const iso of datas) {
    const linhaFds = publicadasPorData[iso]?.fds
    for (const turno of TURNOS_FDS) {
      if (linhaFds?.publicacaoTurnos?.[turno] && !republicar) bloqueiosTabela.push(`${iso} · ${turno}: a fila única já está publicada — use --republicar se for isso mesmo (liberações e marcações do turno são preservadas pela RPC só onde o nome continua)`)
    }
  }

  // ── relatório ──────────────────────────────────────────────────────────────
  console.log(`\n== FIM DE SEMANA de ${sabado} · ${datas.join(' + ')} · Pega Plantão: ${textoPP}`)
  for (const iso of datas) {
    const d = dias[iso]
    console.log(`\n-- ${iso}`)
    for (const faixa of fds.FAIXAS_FDS) console.log(`   ${faixa.padEnd(5)} | Unimed ${d.grade[faixa].unimed.padEnd(14)} | HRO ${d.grade[faixa].hro.padEnd(14)} | ret ${d.grade[faixa].ret1}, ${d.grade[faixa].ret2}`)
    console.log(`   posições: ${Object.entries(d.posicoes).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([pn, n]) => `${pn} ${n}`).join(' · ')}`)
    for (const turno of TURNOS_ORDEM) {
      console.log(`   ${turno.padEnd(10)} (${d.ordemFonte[turno]}): ${d.ordem[turno].map((n, i) => `${i + 1}.${n}`).join(' / ')}`)
      if (d.acrescentados[turno]) console.log(`      ↳ acrescentado ao fim (retaguarda da faixa fora da linha — regra de 15/08): ${d.acrescentados[turno].join(', ')}`)
    }
  }
  for (const a of avisosTabela) console.log(`   ⚠️  ${a}`)
  for (const b of bloqueiosTabela) console.log(`   ❌ ${b}`)
  for (const s of lote.ignorados || []) console.log(`   (fora da escala: ${s})`)
  let totalBloqueios = bloqueiosTabela.length
  for (const pl of planos) {
    console.log(`\n== ${pl.hospital.toUpperCase()} · ${pl.data} · ${pl.turno} · ${pl.casos.length} caso(s)`)
    for (const c of pl.casos) {
      console.log(`   ${String(c.sala).padEnd(18)} | ${String(c.hora || '').padEnd(5)} | ${String(c.procedimento || '').slice(0, 38).padEnd(38)} | ${String(c.anestesista || '').padEnd(16)} | ${c.anestesistaUserId ? 'uid' : (c.semAnestesista ? 'SEM' : 'sem vínculo')} | ${c.convenio || ''}`)
    }
    for (const a of pl.avisos) console.log(`   ⚠️  ${a}`)
    for (const b of pl.bloqueios) console.log(`   ❌ ${b}`)
    totalBloqueios += pl.bloqueios.length
  }
  if (totalBloqueios) await sair(`${totalBloqueios} bloqueio(s) — a tela também recusaria. Corrija o lote e repita.`)

  // ── payload: 4 linhas 'fds' + mapas, numa transação como o dono ────────────
  const CASO_FIELDS = ['sala', 'ordem', 'hora', 'tempoEstimado', 'terminoPrevisto', 'pacienteIniciais', 'idade', 'procedimento',
    'convenio', 'cirurgiao', 'cirurgiaoDisplay', 'anestesista', 'anestesistaUserId', 'residente', 'residenteUserId', 'bloco',
    'isContinuacao', 'semAnestesista', 'tipo', 'gravidade', 'turno']
  const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  const dq = (o) => { const j = JSON.stringify(o); if (j.includes('$j$')) falhar('payload contém $j$'); return `$j$${j}$j$::jsonb` }
  const chamadas = []
  for (const iso of datas) {
    const d = dias[iso]
    for (const turno of TURNOS_FDS) {
      const header = {
        data: iso, hospital: fds.FDS_HOSPITAL, status: 'publicada',
        ordem_liberacao: d.ordem[turno], ajuda_externa: [], source_image_path: null, published_by_name: comoApelido,
        // o meta COMPLETO vai em toda publicação (a RPC preserva quando ausente; não há "limpar")
        fds_meta: {
          grade: d.grade, posicoes: d.posicoes, escalacao: d.escalacao, tipo: 'fim_de_semana',
          ordemFonte: d.ordemFonte,
          // a fila da NOITE mora aqui porque 'noturno' não é turno de publicação no banco
          ordemNoite: d.ordem.noturno,
        },
      }
      chamadas.push(`select public.rpc_publicar_escala_turno('${iso}','${fds.FDS_HOSPITAL}','${turno}', ${dq(header)}, '[]'::jsonb);`)
    }
  }
  const particulares = []
  for (const pl of planos) {
    const header = { data: pl.data, hospital: pl.hospital, status: 'publicada', ordem_liberacao: [], ajuda_externa: [], source_image_path: null, published_by_name: comoApelido }
    const casos = pl.casos.map((c, i) => {
      const out = {}
      for (const f of CASO_FIELDS) if (c[f] !== undefined) out[snake(f)] = c[f]
      if (typeof out.paciente_iniciais === 'string') out.paciente_iniciais = iniciaisSeguras(out.paciente_iniciais)
      out.ordem = i
      out.turno = pl.turno
      return out
    })
    chamadas.push(`select public.rpc_publicar_escala_turno('${pl.data}','${pl.hospital}','${pl.turno}', ${dq(header)}, ${dq(casos)});`)
    pl.casos.forEach((c, i) => { if (c.pacienteNome && /^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio))) particulares.push({ hospital: pl.hospital, data: pl.data, turno: pl.turno, sala: casos[i].sala, ordem: i, hora: c.hora, nome: String(c.pacienteNome).trim() }) })
  }
  const corpo = `select set_config('request.jwt.claims', ${dq({ sub: uidDono })}::text, true);\n${chamadas.join('\n')}`
  if (ensaio) {
    const r = await sql(`begin;\n${corpo}\nrollback;`)
    if (!r.ok) await sair(`ensaio falhou: ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`)
    console.log(`\n✅ ENSAIO ok (rollback): a RPC aceitou ${chamadas.length} publicação(ões) — ${datas.length * TURNOS_FDS.length} fila(s) única(s) + ${planos.length} turno(s) de hospital. Repita sem --ensaio para publicar.`)
    await libs.fechar()
    process.exit(0)
  }
  const r = await sql(`begin;\n${corpo}\ncommit;`)
  if (!r.ok) await sair(`publicação falhou (nada gravado): ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`)

  // ── verificação por SELECT + nome do paciente PARTICULAR na cobrança ───────
  const verif = await sqlOuFalha(`
    select e.data, e.hospital, e.id,
           jsonb_array_length(coalesce(e.ordem_liberacao->'matutino','[]'::jsonb)) as rod_manha,
           jsonb_array_length(coalesce(e.ordem_liberacao->'vespertino','[]'::jsonb)) as rod_tarde,
           jsonb_array_length(coalesce(e.fds_meta->'ordemNoite','[]'::jsonb)) as rod_noite,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='matutino') as casos_manha,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='vespertino') as casos_tarde,
           e.published_by_name
      from public.escala_cirurgica e where e.data in (${datas.map((d) => `'${d}'`).join(',')}) order by e.data, e.hospital`, 'verificação')
  console.log('\n✅ PUBLICADO:')
  for (const v of verif) {
    if (v.hospital === 'fds') console.log(`   ${v.data} fila única: manhã ${v.rod_manha} · tarde ${v.rod_tarde} · noite ${v.rod_noite} · por ${v.published_by_name}`)
    else console.log(`   ${v.data} ${v.hospital}: manhã ${v.casos_manha} caso(s) · tarde ${v.casos_tarde} caso(s) · por ${v.published_by_name}`)
  }
  for (const pc of particulares) {
    const escala = verif.find((v) => v.hospital === pc.hospital && v.data === pc.data)
    if (!escala) continue
    const linhas = await sqlOuFalha(`
      with caso as (
        select id from public.escala_cirurgica_caso
         where escala_id='${escala.id}' and turno='${pc.turno}' and sala=${dq(pc.sala)}#>>'{}' and ordem=${pc.ordem} limit 1)
      update public.cirurgias_particulares cp
         set paciente=${dq(pc.nome)}#>>'{}', updated_at=now(), updated_by='${uidDono}', updated_by_name='${comoApelido.replace(/'/g, "''")}'
        from caso where cp.escala_caso_id=caso.id and cp.cancelada_em is null and cp.paciente !~ '[[:alpha:]]{3,}'
      returning cp.id`, 'nome do particular')
    console.log(`   ${pc.hospital} ${pc.data}: paciente particular (${pc.sala} ${pc.hora}) ${linhas.length ? 'completado na cobrança' : 'sem rascunho de cobrança para completar'}`)
  }
  await libs.fechar()
  process.exit(0)
}

console.error('uso: ler <foto> --hospital H --out rascunho.json | publicar <lote.json> [--ensaio] [--republicar] [--como APELIDO] | publicar-fds <lote.json> [--ensaio] [--republicar] [--como APELIDO]')
process.exit(1)
