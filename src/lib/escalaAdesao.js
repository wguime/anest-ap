/**
 * escalaAdesao — regras do relatório de ADESÃO à Escala Cirúrgica (dono 23/09/2026).
 *
 * Funções puras sobre o JSON de `public.escala_adesao_relatorio(p_dias)` / `escala_adesao_periodo`
 * (migrations 20260923120000 → 20260924120000). As definições dos números moram na migration;
 * aqui ficam só as REGRAS de leitura:
 *
 *  - ÍNDICE DE USO (coluna "Uso", dono 24/09 à tarde): média dos 5 itens do anestesista, cada um
 *    como % da própria meta, limitado a 100% — abre a escala, início, término (os dois marcados
 *    PELA PESSOA), tempo da cirurgia e tempo total. Engajado 50+. Só "abrir o app" deixou 29 de 46
 *    engajados (contra 3 na régua de 23/09); o índice deu 3.
 *    Demais cargos (sem cirurgia própria): índice = abre a escala.
 *  - ABRE A ESCALA (dono 24/09): % dos dias em que a pessoa podia usar a escala em que ela abriu.
 *    Anestesista → dias em que estava NA ESCALA PUBLICADA (caso ou rodapé): férias, atestado,
 *    consultório e pós-plantão ficam fora sozinhos; feriado e fim de semana escalados entram.
 *    Demais cargos → dias ÚTEIS (seg–sex, feriado conta) — a escala deles não tem histórico.
 *    Meta 70% (≈ os 15 dias de ~21 úteis da régua antiga). Quem não trabalhou nenhum dia no
 *    período (base 0) não entra na lista — sem rótulo próprio de férias (dono 24/09).
 *  - MARCAÇÃO: início/término contam o que a PRÓPRIA pessoa tocou (ini30/ter30); a sala marcada
 *    por qualquer um (iniSala30/terSala30, o critério do quadro por hospital) fica ao lado.
 *  - metas: uso 70% · início 80% · término 80% · tempo da cirurgia 50% · tempo total 80%
 *  - faixas de cor: zero → crit · abaixo da metade da meta → low · metade ou mais → mid ·
 *    na meta → ok · sem denominador → na
 *  - situação (sempre pela janela de 30 dias): nunca abriu > sem uso na semana (só se esteve na
 *    escala na semana) > baixo acesso (abre < 40% dos dias trabalhados, sem semana forte — todo
 *    cargo; era "baixo uso" por índice < 30 e rotulava quem abre todo dia, dono 24/09) >
 *    [anestesista] não marca (término próprio < 20%) > engajado (índice ≥ 50) > pode melhorar.
 *    Quem não tem cirurgia própria (enfermagem, residência, secretaria, contas dos hospitais):
 *    engajado = abre ≥ 70% (ou semana forte) E 10+ marcações de início/término no mês.
 *  - comparação da ficha: "média top N" = média dos N anestesistas (10% do grupo) com o valor
 *    mais alto no item, não a média do grupo (Cochrane, Ivers et al. 2025: comparar com a média
 *    não teve efeito). O rótulo "melhores 10%" confundia (dono 24/09).
 *  - nome na lista = primeiro + último (`nomeCirurgiaoCurto`, o mesmo da escala); completo na ficha.
 */

import { nomeCirurgiaoCurto, primeiroNome } from '@/lib/colunaLiberacao'

export const META = { uso: 70, ini: 80, ter: 80, tp: 50, tot: 80 }
/** Corte do índice de uso (dono 24/09): engajado a partir de 50. */
export const INDICE = { ok: 50 }

/** Índice de uso do anestesista: média dos 5 itens como % da meta, cada um limitado a 100. */
export function indiceUso({ abre, ini, ter, tp, tot }) {
  const c = (v, meta) => Math.min(100, ((v ?? 0) / meta) * 100)
  return (c(abre, META.uso) + c(ini, META.ini) + c(ter, META.ter) + c(tp, META.tp) + c(tot, META.tot)) / 5
}

export const CARGOS = {
  anest: 'Anestesiologistas',
  enf: 'Enfermagem',
  res: 'Residentes',
  sec: 'Secretaria',
  hosp: 'Contas dos hospitais',
}
export const ORDEM_CARGO = ['anest', 'enf', 'res', 'sec', 'hosp']

/** rank menor = mais grave (ordena "alertas primeiro") */
export const SITUACOES = {
  ok: { label: 'Engajado', tom: 'ok', rank: 5 },
  mid: { label: 'Pode melhorar', tom: 'mid', rank: 4 },
  nm: { label: 'Não marca início/término', tom: 'low', rank: 3 },
  bx: { label: 'Baixo acesso', tom: 'low', rank: 2 },
  sem: { label: 'Sem uso na semana', tom: 'crit', rank: 1 },
  nun: { label: 'Nunca abriu', tom: 'crit', rank: 0 },
}
export const ORDEM_SIT = ['ok', 'mid', 'nm', 'bx', 'sem', 'nun']
export const SIT_ALERTA = ['nm', 'bx', 'sem', 'nun']

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** "MARCOS TADEU DA CUNHA" → "Marcos Tadeu da Cunha" (o banco guarda em caixa alta). */
export function tituloNome(nome) {
  return String(nome || '')
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)))
    .join(' ')
}

/** Porcentagem 0–100, ou null quando não há denominador (não se aplica). */
export function razao(n, d) {
  return d ? (Number(n) / Number(d)) * 100 : null
}

export function formatarPct(v) {
  return v == null ? '—' : `${Math.round(v)}%`
}

/** Faixa de cor de um valor contra a meta. */
export function faixa(v, meta) {
  if (v == null) return 'na'
  if (v <= 0) return 'crit'
  if (v >= meta) return 'ok'
  if (v >= meta / 2) return 'mid'
  return 'low'
}

function subtituloDe(r) {
  if (r.role === 'enfermeiro') return 'enfermeira'
  if (r.role === 'tec-enfermagem') return 'técnica de enfermagem'
  if (r.cargo === 'hosp') return 'conta do hospital'
  return ''
}

/**
 * Situação da pessoa (janela de 30 dias). `base*` = dias em que podia usar (ver cabeçalho);
 * semana sem nenhum dia de escala (férias, consultório) não é julgada.
 */
export function classificarSituacao(p) {
  if (p.nunca) return 'nun'
  const semanaConta = p.base7 > 0
  if (semanaConta && p.d7 === 0) return 'sem'
  // "Baixo acesso" mede SÓ acesso, para todo cargo (dono 24/09): quem abre quase todo dia e não
  // marca é "Não marca início/término", nunca "baixo acesso"
  const semanaForte = p.base7 >= 3 && p.abre7 >= 80
  if ((p.abre30 ?? 0) < 40 && !semanaForte) return 'bx'
  if (p.anest) {
    if ((p.ter30 ?? 0) < 20) return 'nm'
    return p.uso30 >= INDICE.ok ? 'ok' : 'mid'
  }
  const frequente = (p.abre30 ?? 0) >= META.uso || semanaForte
  return frequente && p.iniN30 + p.terN30 >= 10 ? 'ok' : 'mid'
}

/**
 * Dias em que a pessoa podia usar (base) e em quantos abriu, na janela e nos últimos 7.
 * JSON antigo (cache de antes de 24/09, sem `de`) cai nos dias corridos.
 */
function diasDeUso(r, rel) {
  if (r.de === undefined) {
    const total = Number(rel?.dias) || 30
    return { base: total, abriu: r.dn || 0, base7: 7, abriu7: Math.min(7, r.d7 || 0) }
  }
  if (r.cargo === 'anest') return { base: r.de, abriu: r.dne, base7: r.de7, abriu7: r.d7e }
  return { base: rel?.uteis ?? 0, abriu: r.dnu, base7: rel?.uteis7 ?? 0, abriu7: r.d7u }
}

/**
 * Junta as duas janelas (30 e 60 dias) por pessoa. A chave é cargo+nome porque a função não
 * devolve uid (não precisa: o relatório é de leitura e o nome é o que se mostra).
 * `r60` pode faltar (só a janela de 30 carregada) — os campos de 60 viram os de 30.
 */
export function montarPessoas(r30, r60) {
  const lista30 = r30?.pessoas || []
  const idx60 = new Map((r60?.pessoas || []).map((r) => [`${r.cargo}|${r.nome}`, r]))
  // quem não trabalhou nenhum dia no período (férias o mês todo, afastamento) fica fora
  return lista30.filter((a) => diasDeUso(a, r30).base > 0).map((a) => {
    const b60 = idx60.get(`${a.cargo}|${a.nome}`)
    const b = b60 || a
    const u30 = diasDeUso(a, r30)
    const u60 = b60 ? diasDeUso(b60, r60) : u30
    const anest = a.cargo === 'anest' && a.casos > 0
    // marcada por qualquer um; JSON antigo (sem ini_qq) cai no "próprio"
    const iniQ = (r) => r.ini_qq ?? r.ini_eu
    const terQ = (r) => r.ter_qq ?? r.ter_eu
    const p = {
      chave: `${a.cargo}|${a.nome}`,
      cargo: a.cargo,
      nome: a.cargo === 'hosp' ? a.nome : tituloNome(a.nome),
      nomeCurto: a.cargo === 'hosp' ? a.nome : nomeCirurgiaoCurto(a.nome),
      primeiro: a.cargo === 'hosp' ? a.nome : primeiroNome(a.nome),
      sub: subtituloDe(a),
      nunca: Boolean(a.nunca),
      anest,
      d7: u30.abriu7, base7: u30.base7, abre7: razao(u30.abriu7, u30.base7),
      d30: u30.abriu, base30: u30.base, abre30: razao(u30.abriu, u30.base),
      d60: u60.abriu, base60: u60.base, abre60: razao(u60.abriu, u60.base),
      aberturasPorDia: a.dn ? Math.round(a.aberturas / a.dn) : null,
      casos30: a.casos, casos60: b.casos,
      turnos30: a.turnos, turnos60: b.turnos,
      ini30: razao(a.ini_eu, a.casos), ini60: razao(b.ini_eu, b.casos),
      ter30: razao(a.ter_eu, a.casos), ter60: razao(b.ter_eu, b.casos),
      iniSala30: razao(iniQ(a), a.casos), iniSala60: razao(iniQ(b), b.casos),
      terSala30: razao(terQ(a), a.casos), terSala60: razao(terQ(b), b.casos),
      tp30: razao(a.tp_inf, a.casos), tp60: razao(b.tp_inf, b.casos),
      tot30: razao(a.tot_eu, a.turnos), tot60: razao(b.tot_eu, b.turnos),
      iniQq30: iniQ(a), terQq30: terQ(a),
      iniEu30: a.ini_eu, terEu30: a.ter_eu, tpInf30: a.tp_inf, totEu30: a.tot_eu,
      iniN30: a.ini_n || 0, iniN60: b.ini_n || 0,
      terN30: a.ter_n || 0, terN60: b.ter_n || 0,
      // quantos tempos a pessoa PREENCHEU, em qualquer linha (todo cargo — dono 24/09); o tempo
      // da cirurgia só tem autor gravado desde 24/09
      tpN30: a.tp_n || 0, tpN60: b.tp_n || 0,
      totN30: a.tot_n || 0, totN60: b.tot_n || 0,
      trocas30: a.trocas || 0, trocas60: b.trocas || 0,
      acoes30: a.acoes || 0, acoes60: b.acoes || 0,
    }
    for (const j of ['30', '60']) {
      p[`uso${j}`] = anest
        ? indiceUso({ abre: p[`abre${j}`], ini: p[`ini${j}`], ter: p[`ter${j}`], tp: p[`tp${j}`], tot: p[`tot${j}`] })
        : p[`abre${j}`]
    }
    p.situacao = classificarSituacao(p)
    return p
  })
}

const valorOrdem = (p, campo) => {
  if (campo === 'ini') return p.anest ? p.ini30 : p.iniN30
  if (campo === 'ter') return p.anest ? p.ter30 : p.terN30
  if (campo === 'tot') return p.tot30 ?? 0
  return 0
}

/** Ordenação da lista: 'sit' (alertas primeiro), 'uso', 'ini', 'ter', 'tot', 'nome'. */
export function ordenarPessoas(lista, ordem = 'sit') {
  const copia = [...lista]
  copia.sort((a, b) => {
    if (ordem === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR')
    if (ordem === 'uso') return (b.uso30 ?? -1) - (a.uso30 ?? -1)
    if (ordem === 'ini' || ordem === 'ter' || ordem === 'tot') return valorOrdem(a, ordem) - valorOrdem(b, ordem)
    return SITUACOES[a.situacao].rank - SITUACOES[b.situacao].rank || (a.uso30 ?? 0) - (b.uso30 ?? 0)
  })
  return copia
}

export function mediana(valores) {
  const v = valores.filter((x) => x != null).sort((x, y) => x - y)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** Resumo por cargo: quantas pessoas, quantas abriram na semana, medianas e situações. */
export function resumirCargos(pessoas) {
  return ORDEM_CARGO.map((cargo) => {
    const g = pessoas.filter((p) => p.cargo === cargo)
    const anest = cargo === 'anest'
    const contagem = Object.fromEntries(ORDEM_SIT.map((s) => [s, g.filter((p) => p.situacao === s).length]))
    return {
      cargo,
      total: g.length,
      abriramSemana: g.filter((p) => p.d7 > 0).length,
      uso30: mediana(g.map((p) => p.uso30)),
      uso60: mediana(g.map((p) => p.uso60)),
      abre30: mediana(g.map((p) => p.abre30)),
      ini30: anest ? mediana(g.map((p) => p.ini30)) : null,
      ter30: anest ? mediana(g.map((p) => p.ter30)) : null,
      tot30: anest ? mediana(g.map((p) => p.tot30)) : null,
      situacoes: contagem,
      alertas: SIT_ALERTA.reduce((s, k) => s + contagem[k], 0),
    }
  }).filter((c) => c.total > 0)
}

/** Linha de um hospital ('unimed' | 'hro' | 'materno' | 'total') ou null. */
export function hospital(rel, chave) {
  return (rel?.hospitais || []).find((h) => h.hospital === chave) || null
}

/** Números-chave do grupo numa janela: início, término, tempo da cirurgia e tempo total. */
export function indicadoresGrupo(rel) {
  const t = hospital(rel, 'total')
  if (!t) return null
  return {
    casos: t.casos,
    turnos: t.turnos,
    ini: razao(t.com_ini, t.casos),
    ter: razao(t.com_ter, t.casos),
    tp: razao(t.com_tp, t.casos),
    tot: razao(t.com_total, t.turnos),
    n: { ini: t.com_ini, ter: t.com_ter, tp: t.com_tp, tot: t.com_total },
  }
}

/** Quantos anestesistas entram na "média top N" (10% do grupo, no mínimo 1). */
export function tamanhoTopo(pessoas) {
  const n = pessoas.filter((p) => p.anest).length
  return n ? Math.max(1, Math.round(n * 0.1)) : 0
}

/** Média dos N anestesistas com o valor mais alto em um campo (comparador da ficha). */
export function melhores10(pessoas, campo) {
  const v = pessoas.filter((p) => p.anest).map((p) => p[campo] ?? 0).sort((x, y) => y - x)
  if (!v.length) return null
  const n = tamanhoTopo(pessoas)
  return v.slice(0, n).reduce((s, x) => s + x, 0) / n
}

/** A frase curta da ficha: a maior lacuna vira o próximo passo (Brehaut 2016: uma ação). */
export function proximoPasso(p) {
  if (p.nunca) return { texto: 'Ainda não abriu a escala.', passo: 'abrir a escala do dia no app pelo menos uma vez por dia útil.' }
  if (p.base7 > 0 && p.d7 === 0) return { texto: 'Não abriu a escala nos dias em que esteve escalado nesta semana.', passo: 'voltar a abrir a escala todo dia escalado, pela aba Minhas.' }
  if (!p.anest) {
    return (p.abre30 ?? 0) < META.uso
      ? { texto: `Abriu a escala em ${p.d30} de ${p.base30} dias úteis.`, passo: 'abrir todo dia útil e marcar início e término das cirurgias da sua sala.' }
      : { texto: 'Usa a escala com frequência.', passo: 'continuar marcando início e término, que é o que faz a fila andar.' }
  }
  const lacunas = [
    { g: META.uso - (p.abre30 ?? 0), texto: `Abriu a escala em ${p.d30} de ${p.base30} dias trabalhados.`, passo: 'abrir a escala em todo dia escalado, pela aba Minhas.' },
    { g: META.ter - (p.ter30 ?? 0), texto: `Marcou o término em ${formatarPct(p.ter30)} das próprias cirurgias (meta 80%).`, passo: 'tocar "Terminada" ao sair da sala.' },
    { g: META.ini - (p.ini30 ?? 0), texto: `Marcou o início em ${formatarPct(p.ini30)} das próprias cirurgias (meta 80%).`, passo: 'tocar "Iniciada" quando a cirurgia começar.' },
    { g: (META.tot - (p.tot30 ?? 0)) * 0.8, texto: `Tempo total informado em ${formatarPct(p.tot30)} dos turnos (meta 80%).`, passo: 'informar a que horas termina o turno, para a fila saber quem libera primeiro.' },
  ].sort((a, b) => b.g - a.g)
  if (lacunas[0].g <= 0) return { texto: 'Está na meta nas marcações.', passo: 'manter e ajudar os colegas da sala.' }
  return { texto: lacunas[0].texto, passo: lacunas[0].passo }
}

/** Os 4 mini-indicadores do card da Home (janela de 30 dias). */
export function resumoCard(rel) {
  const g = indicadoresGrupo(rel)
  if (!g) return null
  const pessoas = montarPessoas(rel, null)
  return {
    ini: g.ini,
    ter: g.ter,
    tot: g.tot,
    alertas: pessoas.filter((p) => SIT_ALERTA.includes(p.situacao)).length,
  }
}

// ─── Abas por mês e evolução (dono 23/09: "uma nova aba para cada novo mês", "gráfico evolutivo") ───

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** '2026-09' → 'set/26' */
export function rotuloMes(mes) {
  const [a, m] = String(mes).split('-').map(Number)
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`
}

/** '2026-09' → '2026-08' */
export function mesAnterior(mes) {
  const [a, m] = String(mes).split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Limites de um mês para a RPC: do dia 1 ao último dia — ou até o último dia GRAVADO, se for o
 * mês corrente. Desde 24/09 o dia de hoje é gravado à noite assim que a escala de amanhã sai
 * (`gravadoAte` = `escala_adesao_evolucao().gravado_ate`); sem ele, até ONTEM. `hoje` é
 * injetável para teste.
 */
export function limitesMes(mes, hoje = new Date(), gravadoAte = null) {
  const [a, m] = String(mes).split('-').map(Number)
  const primeiro = new Date(a, m - 1, 1)
  const ultimo = new Date(a, m, 0)
  let fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(gravadoAte || '')) {
    const [ga, gm, gd] = gravadoAte.split('-').map(Number)
    const g = new Date(ga, gm - 1, gd)
    if (g > fim && g <= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) fim = g
  }
  const ate = ultimo < fim ? ultimo : fim
  const dias = Math.max(0, Math.round((ate - primeiro) / 864e5) + 1)
  return { desde: iso(primeiro), ate: iso(ate), dias, parcial: ate < ultimo }
}

/**
 * O que a página mostra numa aba: período principal (A, campos "30" de montarPessoas), período de
 * comparação (B, campos "60") e rótulos. Nas abas de mês a comparação é o mês anterior. `metaUso`
 * é o corte de engajado do índice (50), o mesmo em toda aba.
 */
export function montarVista(aba, { r30, r60, mesA, mesB, hoje = new Date(), gravadoAte = null } = {}) {
  if (aba === '60') {
    return { relA: r60, relB: r30, rotA: 'últimos 60 dias', rotB: 'últimos 30 dias', curtoB: '30d', metaUso: INDICE.ok, situacaoDe30: true }
  }
  if (/^\d{4}-\d{2}$/.test(aba || '')) {
    const lim = limitesMes(aba, hoje, gravadoAte)
    const ant = mesAnterior(aba)
    return {
      relA: mesA, relB: mesB,
      rotA: lim.parcial ? `${rotuloMes(aba)} (até ${lim.ate.slice(8, 10)}/${lim.ate.slice(5, 7)})` : rotuloMes(aba),
      rotB: rotuloMes(ant), curtoB: rotuloMes(ant),
      metaUso: INDICE.ok,
      situacaoDe30: false,
    }
  }
  return { relA: r30, relB: r60, rotA: 'últimos 30 dias', rotB: 'últimos 60 dias', curtoB: '60d', metaUso: INDICE.ok, situacaoDe30: false }
}

/**
 * Séries semanais em % a partir de `escala_adesao_evolucao().semanas`. Semana COMPLETA = o
 * domingo dela já passou (não "o último dia gravado é domingo": semana sem escala no fim de
 * semana termina na sexta e continua completa).
 */
export function serieEvolucao(semanas = [], hoje = new Date()) {
  const hojeIso = iso(hoje)
  const domingo = (seg) => {
    const [a, m, d] = String(seg).split('-').map(Number)
    return iso(new Date(a, m - 1, d + 6))
  }
  return semanas.map((s) => ({
    semana: s.semana,
    de: s.de,
    ate: s.ate,
    ini: razao(s.com_ini, s.casos),
    ter: razao(s.com_ter, s.casos),
    terAnest: razao(s.ter_eu, s.casos_anest),
    tot: razao(s.com_total, s.turnos),
    tp: razao(s.com_tp, s.casos),
    pessoas: s.pessoas,
    porCargo: { anest: s.anest, enf: s.enf, res: s.res, outros: s.outros },
    completa: domingo(s.semana) < hojeIso,
  }))
}

/**
 * Tendência de um indicador: última semana COMPLETA contra 4 semanas antes (ou a mais antiga que
 * houver). null se não há duas semanas completas.
 */
export function tendencia(serie, campo) {
  const completas = serie.filter((s) => s.completa && s[campo] != null)
  if (completas.length < 2) return null
  const atual = completas[completas.length - 1]
  const antes = completas[Math.max(0, completas.length - 5)]
  return { atual: atual[campo], antes: antes[campo], delta: atual[campo] - antes[campo], desde: antes.semana }
}
