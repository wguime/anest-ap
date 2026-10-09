/**
 * RECADOS DO WHATSAPP → MARCAÇÕES DA CONFERÊNCIA (dono 09/10/2026).
 *
 * "Quero que sejam possíveis enviar prints assim como faço para publicar as escalas aqui."
 * O dono publica pelo chat colando as fotos e o recado ("Consultório 13h30 - 46 consultas:
 * @Gabriel Anest…", "@Guilherme R1 na equipe do HRO no período vespertino"); a tela não
 * sabia ler o recado e cada marca era feita à mão, quando havia botão para ela.
 *
 * Duas entradas, um leitor: o TEXTO copiado do WhatsApp entra direto aqui (regras, sem IA,
 * sem custo); o PRINT é transcrito pela edge `ler-recado-escala` para o mesmo formato e
 * cai aqui também. O que é CLARO vira marcação aplicada (decisão do dono: "quero que
 * entrem aplicadas"), com desfazer; o que é ambíguo (dois Joões) espera um toque — a
 * regra da casa vale aqui: nome com dois donos nunca é chutado.
 *
 * O que cada frase vira segue a tabela "Recado do dono → lote" da skill `publicar-escala`,
 * que é a mesma leitura feita no chat desde setembro:
 *   - "Consultório 13h30 … @A, @B"           → nota (CONSULT) na posição de A e B no rodapé
 *   - "@X na equipe do HRO no período vespertino" / "até as 19h" → selo Equipe até 19h no HRO
 *   - "@X como ajuda no HRO"                 → ajuda no HRO
 *   - "@A na posição do @B" / "Troca: @A com @B" → troca REGISTRADA (apenasRegistro — já
 *     aconteceu; sem o campo a próxima importação executaria um swap que ninguém pediu)
 *   - "Plantão noturno: P1 @X …"             → só confere (os P1–P4 vêm do Pega Plantão)
 */
import { stripNotaRodape } from './colunaLiberacao'

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s) => semAcento(String(s || '')).toUpperCase().replace(/\s+/g, ' ').trim()

// ── 1. Mensagens ─────────────────────────────────────────────────────────────

// WhatsApp Desktop: "[09/10/2026, 11:25:10] Autor: texto"
// WhatsApp Web:     "[11:25, 09/10/2026] Autor: texto"
const CAB_DESKTOP = /^\[(\d{2}\/\d{2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*([^:]{1,60}):\s?(.*)$/
const CAB_WEB = /^\[(\d{1,2}:\d{2})(?::\d{2})?,\s*(\d{2}\/\d{2}\/\d{2,4})\]\s*([^:]{1,60}):\s?(.*)$/

/**
 * Texto colado → mensagens. Sem o cabeçalho do WhatsApp (texto digitado, ou transcrição de
 * print sem hora), cada parágrafo separado por linha em branco é uma mensagem — e linha
 * que começa por "@" ou por "Consultório"/"Plantão" também abre mensagem nova.
 * @returns {{ hora: string|null, autor: string|null, texto: string }[]}
 */
export function lerMensagens(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n')
  const out = []
  const temCabecalho = linhas.some((l) => CAB_DESKTOP.test(l.trim()) || CAB_WEB.test(l.trim()))
  let atual = null
  const fechar = () => { if (atual && atual.texto.trim()) out.push({ ...atual, texto: atual.texto.trim() }); atual = null }
  for (const bruta of linhas) {
    const l = bruta.trim()
    if (temCabecalho) {
      const d = l.match(CAB_DESKTOP)
      const w = !d && l.match(CAB_WEB)
      if (d || w) {
        fechar()
        atual = d ? { hora: d[2].padStart(5, '0'), autor: d[3].trim(), texto: d[4] } : { hora: w[1].padStart(5, '0'), autor: w[3].trim(), texto: w[4] }
        continue
      }
      if (atual && l) atual.texto += `\n${l}`
      continue
    }
    if (!l) { fechar(); continue }
    const abre = /^(@|consult[oó]rio\b|plant[aã]o\b|trocas?\b)/i.test(l)
      && !(atual && /^P\d+\b/i.test(l))
    if (!atual || (abre && !/:\s*$/.test(atual.texto))) {
      fechar()
      atual = { hora: null, autor: null, texto: l }
    } else {
      atual.texto += `\n${l}`
    }
  }
  fechar()
  return out
}

// ── 2. Menções ───────────────────────────────────────────────────────────────

/** "@Gabriel Anest, @Giovana Anest e @Joao Moreira" → ["Gabriel", "Giovana", "Joao Moreira"] */
export function mencoes(texto) {
  const out = []
  const re = /@([^@,\n]+?)(?=\s*(?:,|\s+e\s+|\n|$|\s+(?:na|no|nas|nos|como|est[aá]|com|ap[oó]s|at[eé])\s))/gi
  for (const m of String(texto || '').matchAll(re)) {
    const nome = limparMencao(m[1])
    if (nome) out.push(nome)
  }
  return out
}

/** Tira o que o contato do WhatsApp acrescenta ao nome e não é dele ("Anest", "Dra.", emoji). */
export function limparMencao(s) {
  return String(s || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\b(anest(esista|esio)?|dr\.?|dra\.?)\b/gi, '')
    .replace(/[.:;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── 3. Classificação ─────────────────────────────────────────────────────────

const HOSPITAL_DO_TEXTO = [
  [/\bunimed\b/i, 'unimed'],
  [/\bhro\b|\bregional\b/i, 'hro'],
  [/\bmaterno\b/i, 'materno'],
]
const hospitalNoTexto = (t) => (HOSPITAL_DO_TEXTO.find(([re]) => re.test(t)) || [])[1] || null
const FIM_TURNO = { matutino: '13:00', vespertino: '19:00' }

/**
 * Uma mensagem → o que ela pede. Tipos: consultorio · equipe · ajuda · troca · noturno ·
 * nao_reconhecido. Não resolve nome (é o passo seguinte, com o roster).
 */
export function classificarRecado(texto) {
  const t = String(texto || '').trim()
  const n = semAcento(t).toLowerCase()
  let m
  if ((m = n.match(/^consultorio\s+(\d{1,2})\s*h\s*(\d{2})?/)) || (m = n.match(/^consultorio\s+(\d{1,2}):(\d{2})/))) {
    return { tipo: 'consultorio', hora: `${m[1].padStart(2, '0')}:${m[2] || '00'}`, pessoas: mencoes(t) }
  }
  if (/^consultorio\b/.test(n)) return { tipo: 'consultorio', hora: null, pessoas: mencoes(t) }
  if (/^plantao noturno/.test(n)) {
    const posicoes = [...t.matchAll(/\bP(\d{1,2})\s*[-–:]?\s*@?([^\n@]+?)(?=\s*(?:\n|$|P\d{1,2}\b))/gi)]
      .map((x) => ({ posicao: `P${x[1]}`, nome: limparMencao(x[2]) }))
      .filter((x) => x.nome)
    return { tipo: 'noturno', posicoes }
  }
  if (/\bna equipe d[oa]s?\b/.test(n)) {
    const turno = /periodo vespertino|\btarde\b|ate as 19|ate 19/.test(n) ? 'vespertino'
      : (/periodo matutino|\bmanha\b|ate as 13|ate 13/.test(n) ? 'matutino' : null)
    return { tipo: 'equipe', hospital: hospitalNoTexto(t), turno, ate: turno ? FIM_TURNO[turno] : null, pessoas: mencoes(t) }
  }
  if (/\bcomo ajuda\b|\bajuda (no|na|do|da)\b/.test(n)) {
    return { tipo: 'ajuda', hospital: hospitalNoTexto(t), pessoas: mencoes(t) }
  }
  // "@A na posição do @B" (B pode vir sem @) · "Troca: @A com @B" · "@A trocou com @B"
  if ((m = t.match(/@([^@\n]+?)\s+(?:est[aá]\s+)?na\s+posi[cç][aã]o\s+d[oae]s?\s+@?([^,\n.(]+?)(?=\s+(?:no|na|nos|nas|em|do|da)\s|[,\n.(]|$)/i))) {
    return { tipo: 'troca', a: limparMencao(m[1]), b: limparMencao(m[2]), hospital: hospitalNoTexto(t) }
  }
  if (/\btroc/.test(n)) {
    const ps = mencoes(t)
    if (ps.length >= 2) return { tipo: 'troca', a: ps[0], b: ps[1], hospital: hospitalNoTexto(t) }
  }
  return { tipo: 'nao_reconhecido', texto: t }
}

// ── 4. Nome → pessoa ─────────────────────────────────────────────────────────

const tokens = (s) => norm(s).split(' ').filter((x) => x.length >= 2 && !/^R\d$/.test(x))

/**
 * Menção do recado → login. Ordem: dicionário de apelidos do grupo (`resolver`), apelidos
 * que esta tela já aprendeu (`lembrados`, deste aparelho), e por fim o cadastro: TODAS as
 * palavras da menção no nome (ou apelido) de UMA pessoa só. "Joao Moreira" acha o João
 * Ricardo Moreira; "Gabriel" sozinho com dois Gabriéis devolve os dois — e quem decide é
 * quem publica, nunca a tela.
 * @returns {{ uid: string|null, candidatos: Array<{uid,nome}> }}
 */
export function resolverMencao(mencao, { resolver = null, roster = [], lembrados = {} } = {}) {
  const limpa = limparMencao(mencao)
  if (!limpa) return { uid: null, candidatos: [] }
  const chave = norm(limpa)
  if (lembrados[chave]) return { uid: lembrados[chave], candidatos: [] }
  const direto = resolver?.(limpa) || resolver?.(chave)
  if (direto) return { uid: direto, candidatos: [] }
  const ts = tokens(limpa)
  if (!ts.length) return { uid: null, candidatos: [] }
  const casam = (roster || []).filter((p) => {
    const fontes = [p?.nome, ...(p?.apelidos || [])].map((x) => tokens(x)).filter((x) => x.length)
    return fontes.some((f) => ts.every((t) => f.includes(t)))
      || ts.every((t) => tokens(p?.nome).includes(t))
  })
  const unicos = [...new Map(casam.map((p) => [p.uid, p])).values()]
  if (unicos.length === 1) return { uid: unicos[0].uid, candidatos: [] }
  return { uid: null, candidatos: unicos.map((p) => ({ uid: p.uid, nome: p.nome })) }
}

// ── 5. Plano de marcações ────────────────────────────────────────────────────

/**
 * Recados → ações sobre as abas do lote. Cada ação diz o hospital, a pessoa e o que muda;
 * `estado` é 'pronta' (aplica sozinha), 'ambigua' (dois donos — espera escolha),
 * 'sem_alvo' (a pessoa não está em escala nenhuma do lote: nada a marcar, só informa) ou
 * 'info' (confere, não muda nada).
 *
 * @param {object} p
 * @param {{ hora, texto }[]} p.mensagens
 * @param {Record<string, { ordem: string[], casos?: object[] }>} p.hospitais  abas do lote
 * @param {'matutino'|'vespertino'} p.turno
 * @param {(n:string)=>string|null} p.resolver
 * @param {Array<{uid,nome,apelidos}>} p.roster
 * @param {Record<string,string>} [p.lembrados]  menção normalizada → uid, escolhas anteriores
 */
export function planejarRecados({ mensagens = [], hospitais = {}, turno = null, resolver = null, roster = [], lembrados = {} } = {}) {
  const ctx = { resolver, roster, lembrados }
  const porUid = new Map((roster || []).map((p) => [p.uid, p]))
  const nomeDe = (uid, fallback) => porUid.get(uid)?.nome || fallback
  // onde a pessoa está na ORDEM de cada hospital do lote
  const ondeNaOrdem = (uid, mencao) => {
    const out = []
    for (const [h, aba] of Object.entries(hospitais || {})) {
      for (const n of aba?.ordem || []) {
        const limpo = stripNotaRodape(n)
        const casa = (uid && resolver?.(limpo) === uid) || norm(limpo) === norm(mencao)
        if (casa) { out.push({ hospital: h, nomeNaOrdem: n }); break }
      }
    }
    return out
  }
  const pessoa = (mencao) => {
    const r = resolverMencao(mencao, ctx)
    return { mencao, uid: r.uid, nome: r.uid ? nomeDe(r.uid, mencao) : mencao, candidatos: r.candidatos }
  }

  return (mensagens || []).map((msg, i) => {
    const cls = classificarRecado(msg.texto)
    const acoes = []
    const id = `r${i}-${msg.hora || ''}`
    if (cls.tipo === 'consultorio') {
      for (const mencao of cls.pessoas) {
        const p = pessoa(mencao)
        if (!p.uid && p.candidatos.length > 1) { acoes.push({ tipo: 'nota', nota: 'CONSULT', hora: cls.hora, pessoa: p, estado: 'ambigua' }); continue }
        const lugares = ondeNaOrdem(p.uid, mencao)
        if (!lugares.length) { acoes.push({ tipo: 'nota', nota: 'CONSULT', hora: cls.hora, pessoa: p, estado: 'sem_alvo' }); continue }
        for (const l of lugares) acoes.push({ tipo: 'nota', nota: 'CONSULT', hora: cls.hora, pessoa: p, ...l, estado: 'pronta' })
      }
    } else if (cls.tipo === 'equipe') {
      for (const mencao of cls.pessoas) {
        const p = pessoa(mencao)
        const base = { tipo: 'equipe', hospital: cls.hospital, ate: cls.ate || (turno ? FIM_TURNO[turno] : null), pessoa: p }
        if (!p.uid && p.candidatos.length > 1) acoes.push({ ...base, estado: 'ambigua' })
        // recado da manhã colado na publicação da tarde (ou o contrário): não é deste turno
        else if (cls.turno && turno && cls.turno !== turno) acoes.push({ ...base, estado: 'info', motivo: `é do turno da ${cls.turno === 'matutino' ? 'manhã' : 'tarde'}` })
        else if (!cls.hospital || !hospitais[cls.hospital]) acoes.push({ ...base, estado: 'sem_alvo', motivo: cls.hospital ? 'hospital fora deste lote' : 'o recado não diz o hospital' })
        else acoes.push({ ...base, estado: 'pronta' })
      }
    } else if (cls.tipo === 'ajuda') {
      for (const mencao of cls.pessoas) {
        const p = pessoa(mencao)
        const base = { tipo: 'ajuda', hospital: cls.hospital, pessoa: p }
        if (!p.uid && p.candidatos.length > 1) acoes.push({ ...base, estado: 'ambigua' })
        else if (!cls.hospital || !hospitais[cls.hospital]) acoes.push({ ...base, estado: 'sem_alvo', motivo: cls.hospital ? 'hospital fora deste lote' : 'o recado não diz o hospital — marque à mão' })
        else acoes.push({ ...base, estado: 'pronta' })
      }
    } else if (cls.tipo === 'troca') {
      const a = pessoa(cls.a)
      const b = pessoa(cls.b)
      const ambigua = (!a.uid && a.candidatos.length > 1) || (!b.uid && b.candidatos.length > 1)
      const lugares = ondeNaOrdem(a.uid, cls.a)
      const hospital = cls.hospital && hospitais[cls.hospital] ? cls.hospital : lugares[0]?.hospital || null
      const base = { tipo: 'troca', pessoa: a, parceiro: b, hospital, apenasRegistro: true }
      if (ambigua) acoes.push({ ...base, estado: 'ambigua' })
      else if (!hospital || !b.uid) acoes.push({ ...base, estado: 'sem_alvo', motivo: !b.uid ? 'o colega não foi reconhecido — marque à mão' : 'a pessoa não está em escala deste lote' })
      else acoes.push({ ...base, estado: 'pronta' })
    } else if (cls.tipo === 'noturno') {
      acoes.push({ tipo: 'noturno', posicoes: cls.posicoes.map((x) => ({ ...x, pessoa: pessoa(x.nome) })), estado: 'info' })
    } else {
      acoes.push({ tipo: 'nao_reconhecido', estado: 'info' })
    }
    return { id, hora: msg.hora, texto: msg.texto, tipo: cls.tipo, hospitalTexto: cls.hospital || null, horaConsultorio: cls.hora || null, acoes }
  })
}
