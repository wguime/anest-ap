#!/usr/bin/env node
/**
 * Publica a escala cirúrgica de um turno a partir das FOTOS, sem passar pela tela.
 *
 * É o caminho da skill `/publicar-escala` (dono 08/09/2026: "quero apenas adicionar
 * as escalas e quero que seja publicado"). Dois passos, separados de propósito —
 * entre eles quem confere é o Claude, olhando a foto:
 *
 *   node scripts/escala-publicar-turno.mjs ler <foto> --hospital unimed|hro|materno --out <rascunho.json>
 *       Lê a foto pela edge `parse-escala-cirurgica` (a MESMA leitura do app, com a
 *       dica do hospital) e grava um rascunho em camelCase. Só mantém `pacienteNome`
 *       de convênio PARTICULAR puro — é o que pré-preenche a cobrança; o resto sai
 *       por iniciais (LGPD, mesma regra da edge).
 *
 *   node scripts/escala-publicar-turno.mjs publicar <lote.json> [--ensaio] [--republicar] [--como "GUILHERME MELO"]
 *       lote.json = { data, turno, hospitais: { unimed: { casos, ordemLiberacao, ajudaExterna }, hro: …, materno: … } }
 *       Para cada hospital: canoniza sala/bloco como a conferência faz, herda "//",
 *       transforma vazio em "?", resolve o anestesista pelo dicionário de apelidos
 *       (nome ambíguo ABORTA — regra do dono: perguntar, nunca chutar), filtra os casos
 *       pelo turno (hora; "AS" e continuação herdam a sala) e chama a RPC
 *       `rpc_publicar_escala_turno` — a mesma da tela — numa transação assinada
 *       como o dono (`request.jwt.claims`). `--ensaio` termina em ROLLBACK e mostra o
 *       que teria publicado. Turno já publicado só é sobrescrito com `--republicar`,
 *       e o script diz antes quantos status e liberações se perderiam.
 *       Depois do commit, completa o nome do paciente PARTICULAR na cobrança
 *       (`cirurgias_particulares`), como a conferência faz, e imprime a verificação.
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

// ── normalização (porta fiel de utils.js da conferência) ─────────────────────
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase()
const primeiroToken = (s) => norm(s).replace(/^PED[.\s]+/, '').split(' ')[0] || ''
const semNota = (s) => String(s ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()

function normalizarSalaUnimed(sala) {
  const raw = String(sala || '').trim()
  const s = norm(raw)
  if (!s) return raw
  let m = s.match(/CENTRO\s+CIRURGICO.*?0*(\d+)/) || (/^CC\b/.test(s) ? s.match(/0*(\d+)/) : null)
  if (m) return `CC - Sala ${m[1]}`
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) {
    if (/CESAR/.test(s)) return 'CO - Cesárea'
    const n = s.match(/0*(\d+)/)
    return n ? `CO - Sala ${n[1]}` : 'CO'
  }
  m = s.match(/^(?:SALA\s*)?0*(\d+)\b/)
  if (m) return `CC - Sala ${m[1]}`
  if (/SRPA/.test(s)) return 'SRPA'
  if (/EXAME/.test(s)) return 'Exames'
  if (/IMAGEM/.test(s)) return 'Imagem'
  if (/HEMO/.test(s)) return 'Hemodinâmica'
  if (/CONSULT/.test(s)) return 'Consultório'
  if (/UMANITA/.test(s)) return 'Umanitá'
  if (/ACCURATA/.test(s)) return 'Accurata'
  return raw
}
function blocoDaSalaUnimed(sala) {
  const s = norm(sala)
  if (/SRPA/.test(s)) return 'srpa'
  if (/EXAME/.test(s)) return 'exames'
  if (/IMAGEM/.test(s)) return 'imagem'
  if (/HEMO/.test(s)) return 'hemodinamica'
  if (/CONSULT/.test(s)) return 'consultorio'
  if (/UMANITA/.test(s)) return 'umanita'
  if (/ACCURATA/.test(s)) return 'accurata'
  return 'normal'
}
const SECAO_CLINICA_HRO = { iosc: 'IOSC', ho: 'Hospital de Olhos', ccoluna: 'Centro de Coluna' }
function normalizarSalaHro(sala, bloco) {
  const raw = String(sala || '').trim()
  const s = norm(raw)
  const secao = SECAO_CLINICA_HRO[String(bloco || '').trim().toLowerCase()]
  if (secao && (!s || /^SALA ?\d/.test(s) || /^BLOCO ?A\b/.test(s))) return secao
  if (!s) return raw
  if (/^H\.?\s*O\.?$/.test(s) || /HOSPITAL DE OLHOS/.test(s)) return 'Hospital de Olhos'
  if (/BLOCO\s*M/.test(s)) { const n = s.match(/(\d+)/); return n ? `Bloco M - Sala ${n[1]}` : 'Bloco M' }
  if (/BLOCO ?A\b/.test(s)) { const n = s.match(/(\d+)/); return n ? `Sala ${n[1]}` : 'Bloco A' }
  if (/^SALA ?\d/.test(s)) return `Sala ${s.match(/(\d+)/)[1]}`
  if (/^C\.?\s*O\.?$/.test(s)) return 'Sala 7'
  if (/^EMERG/.test(s) && !/\d/.test(s)) return 'Sala 5'
  if (/^EXAMES?$/.test(s)) return 'Exames'
  if (/^CONSULT/.test(s)) return 'Consultório'
  if (/^IMAGEM$/.test(s)) return 'Imagem'
  if (/^HEMO/.test(s)) return 'Hemodinâmica'
  if (/BRAQUI/.test(s)) return 'Braquiterapia'
  if (/^IOSC$/.test(s)) return 'IOSC'
  if (/C\.?\s*COLUNA|CENTRO DE COLUNA/.test(s)) return 'Centro de Coluna'
  if (/DIGIMAX/.test(s)) return 'Digimax'
  if (/AMBULAT/.test(s)) return 'Ambulatorial'
  return raw
}
const BLOCO_DA_SALA_HRO = {
  IOSC: 'iosc', 'Hospital de Olhos': 'ho', 'Centro de Coluna': 'ccoluna', Digimax: 'normal',
  Hemodinâmica: 'hemodinamica', Exames: 'exames', Imagem: 'imagem', Consultório: 'consultorio', SIMONE: 'simone',
}
function canonizar(hospital, caso) {
  const blocoLido = String(caso.bloco || 'normal').toLowerCase()
  if (hospital === 'unimed') {
    const sala = normalizarSalaUnimed(caso.sala)
    return { sala, bloco: blocoLido !== 'normal' ? blocoLido : blocoDaSalaUnimed(sala) }
  }
  if (hospital === 'hro') {
    const sala = normalizarSalaHro(caso.sala, blocoLido)
    return { sala, bloco: BLOCO_DA_SALA_HRO[sala] || (blocoLido !== 'normal' ? blocoLido : 'normal') }
  }
  return { sala: String(caso.sala || '').replace(/\s+/g, ' ').trim(), bloco: blocoLido || 'normal' }
}

// ── hora e turno ─────────────────────────────────────────────────────────────
const SEQUENCIAL = /^(?:AS|A\s+SEGUIR)$/
function minutosDaHora(v) {
  const s = norm(v)
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*H?$/)
  if (!m) return null
  const h = Number(m[1]); const min = m[2] == null ? 0 : Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}
const turnoDaHora = (v) => { const m = minutosDaHora(v); return m == null ? null : (m < 13 * 60 ? 'matutino' : 'vespertino') }

// ── identidade ───────────────────────────────────────────────────────────────
async function carregarDicionario() {
  const linhas = await sqlOuFalha('select apelido, user_id from public.escala_anestesista_alias', 'dicionário de apelidos')
  const exato = new Map()      // apelido normalizado → uid
  const porPrimeiro = new Map() // 1º nome → Set(uid)
  for (const l of linhas) {
    const a = norm(l.apelido)
    if (!a) continue
    exato.set(a, l.user_id)
    const p = a.split(' ')[0]
    if (!porPrimeiro.has(p)) porPrimeiro.set(p, new Set())
    porPrimeiro.get(p).add(l.user_id)
  }
  return {
    /** uid, ou null (desconhecido), ou 'AMBIGUO' (1º nome com mais de um dono). */
    resolver(nome) {
      const n = norm(semNota(nome))
      if (!n || n === '//' || /^\?+$/.test(n)) return null
      if (exato.has(n)) return exato.get(n)
      if (!n.includes(' ')) {
        const c = porPrimeiro.get(n)
        if (c && c.size === 1) return [...c][0]
        if (c && c.size > 1) return 'AMBIGUO'
      }
      return null
    },
  }
}

// ── montagem dos casos de um hospital ────────────────────────────────────────
function prepararCasos(hospital, turno, lote, dic, avisos) {
  const casosLidos = Array.isArray(lote.casos) ? lote.casos : []
  const posicoes = Array.isArray(lote.posicoesAssistenciais) ? lote.posicoesAssistenciais : []
  // posição assistencial (SRPA) vira um caso do bloco, como a conferência faz
  const extras = posicoes.map((p) => ({
    sala: p.local, hora: '', procedimento: '', anestesista: p.anestesista, bloco: blocoDaSalaUnimed(p.local),
  }))
  const todos = [...casosLidos, ...extras].map((c) => ({ ...c, ...canonizar(hospital, c) }))

  // TURNO: hora decide; "AS"/vazio/continuação herdam a sala (a linha anterior)
  const ultimoTurnoDaSala = new Map()
  const doTurno = []
  for (const c of todos) {
    const t = turnoDaHora(c.hora)
    let pertence
    if (t) { pertence = t === turno; ultimoTurnoDaSala.set(c.sala, t) }
    else {
      const herdado = ultimoTurnoDaSala.get(c.sala)
      pertence = herdado ? herdado === turno : true // sem hora e sem irmão: entra (SRPA, exames sem hora)
    }
    if (pertence) doTurno.push(c)
  }

  // ANESTESISTA: "//" herda o de cima na mesma sala; vazio/"?" é linha descoberta
  const ultimoDaSala = new Map()
  const saida = []
  for (const c of doTurno) {
    let nome = String(c.anestesista || '').trim()
    let uid = null
    let sem = c.semAnestesista === true
    if (nome === '//' || (!nome && !sem && ultimoDaSala.has(c.sala) && /^(\/\/|)$/.test(nome))) {
      const acima = ultimoDaSala.get(c.sala)
      if (acima && nome === '//') { nome = acima.nome; uid = acima.uid; sem = acima.sem }
    }
    if (!nome || /^\?+$/.test(nome)) { nome = '?'; uid = null; sem = true }
    else if (nome !== '//' && uid == null) {
      const partes = nome.split(/\s*\+\s*/).filter(Boolean)
      if (partes.length > 1) { uid = null } // dupla "A + B": uid nulo por construção
      else {
        const r = dic.resolver(nome)
        if (r === 'AMBIGUO') falhar(`${hospital}: "${nome}" (${c.sala} ${c.hora || ''}) tem mais de um dono no dicionário — escreva o nome completo no lote`)
        uid = r
        if (!uid) avisos.push(`${hospital}: "${nome}" (${c.sala} ${c.hora || ''}) não está no dicionário — entra como texto, sem vínculo`)
      }
    }
    if (nome === '//') { nome = '?'; uid = null; sem = true; avisos.push(`${hospital}: "//" sem linha acima em ${c.sala} — ficou descoberta`) }
    if (nome !== '?') ultimoDaSala.set(c.sala, { nome, uid, sem })
    const cont = c.isContinuacao === true || /CONTINUA[ÇC][ÃA]O|^CONT\./i.test(String(c.procedimento || '').normalize('NFC'))
    saida.push({
      sala: c.sala,
      hora: String(c.hora || '').trim(),
      tempo_estimado: String(c.tempoEstimado || '').trim(),
      paciente_iniciais: String(c.pacienteIniciais || '').trim().slice(0, 12),
      idade: String(c.idade || '').trim().slice(0, 10),
      procedimento: String(c.procedimento || '').trim(),
      convenio: String(c.convenio || '').trim(),
      cirurgiao: String(c.cirurgiao || '').trim(),
      anestesista: nome,
      anestesista_user_id: uid,
      bloco: c.bloco,
      is_continuacao: cont,
      sem_anestesista: sem,
      tipo: ['eletiva', 'urgencia', 'emergencia'].includes(String(c.tipo || '').toLowerCase()) ? String(c.tipo).toLowerCase() : 'eletiva',
      _pacienteNome: /^PART(ICULAR)?[^A-Z]*$/.test(norm(c.convenio)) ? String(c.pacienteNome || '').trim() : '',
    })
  }
  for (const c of saida) {
    if (c.paciente_iniciais.length > 12 || /\p{L}{3,}/u.test(c.paciente_iniciais)) {
      falhar(`${hospital}: iniciais "${c.paciente_iniciais}" não passam no CHECK (LGPD) — corrija no lote`)
    }
  }
  return saida.map((c, i) => ({ ...c, ordem: i }))
}

function conferirRodape(hospital, ordem, ajuda, casos, dic, avisos) {
  if (['hro', 'unimed'].includes(hospital) && !ordem.length) falhar(`${hospital}: ordem de liberação VAZIA — a fila nasceria sem ninguém. Preencha ordemLiberacao no lote.`)
  const ambiguos = ordem.filter((n) => dic.resolver(n) === 'AMBIGUO')
  if (ambiguos.length) falhar(`${hospital}: nome ambíguo no rodapé (${ambiguos.join(', ')}) — escreva como está no dicionário`)
  if (!ordem.length) return // Materno publica sem rodapé: não há contra o que conferir
  const uidsRodape = new Set([...ordem, ...ajuda].map((n) => dic.resolver(n)).filter(Boolean))
  const nomesRodape = new Set([...ordem, ...ajuda].map((n) => primeiroToken(semNota(n))))
  for (const c of casos) {
    if (c.anestesista === '?' || c.anestesista.includes('+')) continue
    const dentro = (c.anestesista_user_id && uidsRodape.has(c.anestesista_user_id)) || nomesRodape.has(primeiroToken(c.anestesista))
    if (!dentro) avisos.push(`${hospital}: ${c.anestesista} tem caso (${c.sala} ${c.hora}) e não está no rodapé nem na ajuda — confira a foto (azul = ajuda)`)
  }
  const comCaso = new Set(casos.map((c) => c.anestesista_user_id || primeiroToken(c.anestesista)))
  for (const n of ordem) {
    const uid = dic.resolver(n)
    if (!(uid && comCaso.has(uid)) && !comCaso.has(primeiroToken(semNota(n))) && !/\(/.test(n)) {
      avisos.push(`${hospital}: ${n} está na ordem sem nenhum caso (pode ser certo — nasce Livre)`)
    }
  }
}

// ── comandos ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const cmd = args[0]
const opt = (n, padrao = null) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : padrao }
const flag = (n) => args.includes(`--${n}`)

function assinarJwt(sub) {
  if (!JWT_SECRET) falhar('SUPABASE_JWT_SECRET ausente em .env.local')
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const agora = Math.floor(Date.now() / 1000)
  const c = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub, role: 'authenticated', iss: 'supabase', iat: agora, exp: agora + 3600 })
  return `${c}.${p}.${createHmac('sha256', JWT_SECRET).update(`${c}.${p}`).digest('base64url')}`
}

async function uidDe(apelido) {
  const dic = await carregarDicionario()
  const uid = dic.resolver(apelido)
  if (!uid || uid === 'AMBIGUO') falhar(`não achei quem é "${apelido}" no dicionário de apelidos`)
  return uid
}

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
  const uid = await uidDe(opt('como', 'GUILHERME MELO'))
  const roster = (await sqlOuFalha('select apelido from public.escala_anestesista_alias order by apelido', 'roster')).map((l) => l.apelido)
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
  // LGPD: nome completo só de PARTICULAR puro (a edge já garante; aqui é a 2ª trava)
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
  const hospitais = Object.entries(lote.hospitais || {}).filter(([h]) => ['unimed', 'hro', 'materno'].includes(h))
  if (!hospitais.length) falhar('lote.hospitais vazio')
  const ensaio = flag('ensaio')
  const republicar = flag('republicar')
  const comoApelido = opt('como', 'GUILHERME MELO')

  const dic = await carregarDicionario()
  const uidDono = dic.resolver(comoApelido)
  if (!uidDono || uidDono === 'AMBIGUO') falhar(`não achei quem é "${comoApelido}" no dicionário`)

  // estado atual: turno já publicado? o que se perderia?
  const estado = await sqlOuFalha(`
    select e.hospital,
           e.publicacao_turnos->'${turno}'->>'status' as status_turno,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='${turno}') as casos,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='${turno}' and (c.status_cirurgia<>'agendada' or c.status_extra is not null)) as com_status,
           (select count(*) from jsonb_object_keys(coalesce(e.liberacoes,'{}'::jsonb)) k where k like '${turno}:%') as liberacoes
      from public.escala_cirurgica e where e.data='${data}' and e.hospital in (${hospitais.map(([h]) => `'${h}'`).join(',')})`, 'estado atual')
  for (const l of estado) {
    if (l.status_turno) {
      const msg = `${l.hospital}: o turno ${turno} de ${data} JÁ ESTÁ PUBLICADO (${l.casos} casos, ${l.com_status} com status marcado, ${l.liberacoes} liberação(ões))`
      if (!republicar) falhar(`${msg}. Republicar é DELETE+reinsert e zera status e liberações: repita com --republicar se for isso mesmo, ou faça um reparo linha a linha.`)
      console.log(`⚠️  ${msg} — vai ser substituído (--republicar)`)
    }
  }

  const avisos = []
  const payloads = []
  for (const [hospital, dados] of hospitais) {
    const ordem = (dados.ordemLiberacao || []).map((s) => String(s).trim()).filter(Boolean)
    const ajuda = (dados.ajudaExterna || []).map((s) => String(s).trim()).filter(Boolean)
    if (dados.dataDetectada && dados.dataDetectada !== data) avisos.push(`${hospital}: a foto diz ${dados.dataDetectada} e o lote é de ${data} — publicando como ${data}`)
    const casos = prepararCasos(hospital, turno, dados, dic, avisos)
    if (!casos.length) falhar(`${hospital}: nenhum caso do turno ${turno} — nada a publicar`)
    conferirRodape(hospital, ordem, ajuda, casos, dic, avisos)
    payloads.push({ hospital, ordem, ajuda, casos })
  }

  // resumo do que vai
  for (const p of payloads) {
    console.log(`\n== ${p.hospital.toUpperCase()} · ${data} · ${turno} · ${p.casos.length} caso(s) · rodapé ${p.ordem.length} · ajuda ${JSON.stringify(p.ajuda)}`)
    for (const c of p.casos) {
      console.log(`   ${String(c.sala).padEnd(18)} | ${c.hora.padEnd(5)} | ${c.procedimento.slice(0, 38).padEnd(38)} | ${c.anestesista.padEnd(20)} | ${c.anestesista_user_id ? 'uid' : (c.sem_anestesista ? 'SEM' : 'sem vínculo')}${c.is_continuacao ? ' | cont.' : ''}${c.tipo !== 'eletiva' ? ` | ${c.tipo}` : ''}`)
    }
    if (p.ordem.length) console.log(`   rodapé: ${p.ordem.join(' / ')}`)
  }
  if (avisos.length) { console.log('\nAvisos:'); for (const a of avisos) console.log(`   ⚠️  ${a}`) }

  // SQL: uma transação assinada como o dono; --ensaio termina em rollback
  const dq = (o) => { const j = JSON.stringify(o); if (j.includes('$j$')) falhar('payload contém $j$'); return `$j$${j}$j$::jsonb` }
  const chamadas = payloads.map((p) => {
    const header = { data, hospital: p.hospital, status: 'publicada', ordem_liberacao: p.ordem, ajuda_externa: p.ajuda, source_image_path: null }
    const casos = p.casos.map(({ _pacienteNome, ...c }) => c)
    return `select public.rpc_publicar_escala_turno('${data}','${p.hospital}','${turno}', ${dq(header)}, ${dq(casos)});`
  })
  const corpo = `select set_config('request.jwt.claims', ${dq({ sub: uidDono })}::text, true);\n${chamadas.join('\n')}`
  if (ensaio) {
    const r = await sql(`begin;\n${corpo}\nrollback;`)
    if (!r.ok) falhar(`ensaio falhou: ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`)
    console.log(`\n✅ ENSAIO ok (rollback): a RPC aceitou ${payloads.length} publicação(ões). Repita sem --ensaio para publicar.`)
    process.exit(0)
  }
  const r = await sql(`begin;\n${corpo}\ncommit;`)
  if (!r.ok) falhar(`publicação falhou (nada gravado): ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`)

  // verificação por SELECT + nome do paciente PARTICULAR na cobrança
  const verif = await sqlOuFalha(`
    select e.hospital, e.id, e.publicacao_turnos->'${turno}'->>'casos' as declarados,
           (select count(*) from public.escala_cirurgica_caso c where c.escala_id=e.id and c.turno='${turno}') as reais,
           jsonb_array_length(coalesce(e.ordem_liberacao->'${turno}','[]'::jsonb)) as rodape,
           e.ajuda_externa->'${turno}' as ajuda, e.published_by_name
      from public.escala_cirurgica e where e.data='${data}' and e.hospital in (${payloads.map((p) => `'${p.hospital}'`).join(',')}) order by e.hospital`, 'verificação')
  console.log('\n✅ PUBLICADO:')
  for (const v of verif) console.log(`   ${v.hospital}: ${v.reais} caso(s) (declarados ${v.declarados}) · rodapé ${v.rodape} · ajuda ${JSON.stringify(v.ajuda)} · por ${v.published_by_name}`)

  for (const p of payloads) {
    const comNome = p.casos.filter((c) => c._pacienteNome)
    if (!comNome.length) continue
    const escala = verif.find((v) => v.hospital === p.hospital)
    for (const c of comNome) {
      const linhas = await sqlOuFalha(`
        with caso as (
          select id from public.escala_cirurgica_caso
           where escala_id='${escala.id}' and turno='${turno}' and sala=${dq(c.sala)}#>>'{}' and ordem=${c.ordem} limit 1)
        update public.cirurgias_particulares cp
           set paciente=${dq(c._pacienteNome)}#>>'{}', updated_at=now(), updated_by='${uidDono}', updated_by_name='${comoApelido.replace(/'/g, "''")}'
          from caso where cp.escala_caso_id=caso.id and cp.cancelada_em is null and cp.paciente !~ '[[:alpha:]]{3,}'
        returning cp.id`, 'nome do particular')
      console.log(`   ${p.hospital}: paciente particular (${c.sala} ${c.hora}) ${linhas.length ? 'completado na cobrança' : 'sem rascunho de cobrança para completar'}`)
    }
  }
  process.exit(0)
}

console.error('uso: ler <foto> --hospital H --out rascunho.json | publicar <lote.json> [--ensaio] [--republicar] [--como APELIDO]')
process.exit(1)
