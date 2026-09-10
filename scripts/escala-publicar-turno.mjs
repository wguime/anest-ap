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
  return { headless, dadosNumerica, iniciaisSeguras, urgencias, fechar: () => server.close() }
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

/** Nomes completos de quem está de férias em `data`, pelo Pega Plantão (mesmo filtro da tela). null = não consultado. */
async function feriasDoDia(data, uid) {
  try {
    const [ano, mes] = data.split('-')
    const ultimo = new Date(Number(ano), Number(mes), 0).getDate()
    const endpoint = '/api/v1/plantoes?' + new URLSearchParams({
      'filtro.dataInicio': `${ano}-${mes}-01T00:00:00`, 'filtro.dataFim': `${ano}-${mes}-${String(ultimo).padStart(2, '0')}T23:59:59`,
    }).toString()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pegaplantao-proxy`, {
      method: 'POST', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${assinarJwt(uid)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method: 'GET' }),
    })
    if (!r.ok) return null
    const dados = await r.json()
    const lista = Array.isArray(dados) ? dados : (dados?.data || dados?.items || [])
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
      console.log(`   ${String(c.sala).padEnd(18)} | ${String(c.hora || '').padEnd(5)} | ${String(c.procedimento || '').slice(0, 38).padEnd(38)} | ${String(c.anestesista || '').padEnd(20)} | ${c.anestesistaUserId ? 'uid' : (c.semAnestesista ? 'SEM' : 'sem vínculo')}${c.isContinuacao ? ' | cont.' : ''}${c.tipo && c.tipo !== 'eletiva' ? ` | ${c.tipo}` : ''}`)
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
    const header = { data, hospital: h, status: 'publicada', ordem_liberacao: p.ordemLiberacao, ajuda_externa: p.ajudaExterna, source_image_path: null }
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

console.error('uso: ler <foto> --hospital H --out rascunho.json | publicar <lote.json> [--ensaio] [--republicar] [--como APELIDO]')
process.exit(1)
