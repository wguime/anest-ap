/**
 * escalaAdesao — regras do relatório de ADESÃO à Escala Cirúrgica (dono 23/09/2026).
 *
 * Funções puras sobre o JSON de `public.escala_adesao_relatorio(p_dias)` (migration
 * 20260923120000). As definições dos números moram na migration; aqui ficam só as REGRAS
 * de leitura, as mesmas do painel e dos PDFs da reunião de 23/09:
 *
 *  - metas: uso 15 dias em 30 (30 em 60) · início 80% · término 80% · tempo da cirurgia 50% ·
 *    tempo total 80%
 *  - faixas de cor: zero → crit · abaixo da metade da meta → low · metade ou mais → mid ·
 *    na meta → ok · sem denominador → na
 *  - situação (sempre pela janela de 30 dias): nunca abriu > sem uso na semana > baixo uso
 *    (< 8 dias no mês e < 5 na semana) > [anestesista] não marca término (< 20%) > engajado
 *    (15+ dias no mês ou 5+ na semana E término ≥ 50%) > pode melhorar. Quem não tem cirurgia
 *    própria (enfermagem, residência, secretaria, contas dos hospitais) é engajado com uso
 *    frequente E 10+ marcações de início/término no mês.
 *  - comparação da ficha: "melhores 10%" = média do decil superior dos anestesistas, não a
 *    média do grupo (Cochrane, Ivers et al. 2025: comparar com a média não teve efeito).
 */

export const META = { uso30: 15, uso60: 30, ini: 80, ter: 80, tp: 50, tot: 80 }

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
  bx: { label: 'Baixo uso', tom: 'low', rank: 2 },
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

/** Situação da pessoa (janela de 30 dias). */
export function classificarSituacao(p) {
  if (p.nunca) return 'nun'
  if (p.d7 === 0) return 'sem'
  if (p.d30 < 8 && p.d7 < 5) return 'bx'
  const frequente = p.d30 >= 15 || p.d7 >= 5
  if (p.anest) {
    if (p.ter30 < 20) return 'nm'
    return frequente && p.ter30 >= 50 ? 'ok' : 'mid'
  }
  return frequente && p.iniN30 + p.terN30 >= 10 ? 'ok' : 'mid'
}

/**
 * Junta as duas janelas (30 e 60 dias) por pessoa. A chave é cargo+nome porque a função não
 * devolve uid (não precisa: o relatório é de leitura e o nome é o que se mostra).
 * `r60` pode faltar (só a janela de 30 carregada) — os campos de 60 viram os de 30.
 */
export function montarPessoas(r30, r60) {
  const lista30 = r30?.pessoas || []
  const idx60 = new Map((r60?.pessoas || []).map((r) => [`${r.cargo}|${r.nome}`, r]))
  return lista30.map((a) => {
    const b = idx60.get(`${a.cargo}|${a.nome}`) || a
    const anest = a.cargo === 'anest' && a.casos > 0
    const p = {
      chave: `${a.cargo}|${a.nome}`,
      cargo: a.cargo,
      nome: a.cargo === 'hosp' ? a.nome : tituloNome(a.nome),
      sub: subtituloDe(a),
      nunca: Boolean(a.nunca),
      anest,
      d7: Math.min(7, a.d7 || 0),
      d30: a.dn || 0,
      d60: b.dn || 0,
      aberturasPorDia: a.dn ? Math.round(a.aberturas / a.dn) : null,
      casos30: a.casos, casos60: b.casos,
      turnos30: a.turnos, turnos60: b.turnos,
      ini30: razao(a.ini_eu, a.casos), ini60: razao(b.ini_eu, b.casos),
      ter30: razao(a.ter_eu, a.casos), ter60: razao(b.ter_eu, b.casos),
      tp30: razao(a.tp_inf, a.casos), tp60: razao(b.tp_inf, b.casos),
      tot30: razao(a.tot_eu, a.turnos), tot60: razao(b.tot_eu, b.turnos),
      iniEu30: a.ini_eu, terEu30: a.ter_eu, tpInf30: a.tp_inf, totEu30: a.tot_eu,
      iniN30: a.ini_n || 0, iniN60: b.ini_n || 0,
      terN30: a.ter_n || 0, terN60: b.ter_n || 0,
      trocas30: a.trocas || 0, trocas60: b.trocas || 0,
      acoes30: a.acoes || 0, acoes60: b.acoes || 0,
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
    if (ordem === 'uso') return b.d30 - a.d30
    if (ordem === 'ini' || ordem === 'ter' || ordem === 'tot') return valorOrdem(a, ordem) - valorOrdem(b, ordem)
    return SITUACOES[a.situacao].rank - SITUACOES[b.situacao].rank || a.d30 - b.d30
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
      dias30: mediana(g.map((p) => p.d30)),
      dias60: mediana(g.map((p) => p.d60)),
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

/** Média do decil superior dos anestesistas em um campo (comparador da ficha). */
export function melhores10(pessoas, campo) {
  const v = pessoas.filter((p) => p.anest).map((p) => p[campo] ?? 0).sort((x, y) => y - x)
  if (!v.length) return null
  const n = Math.max(1, Math.round(v.length * 0.1))
  return v.slice(0, n).reduce((s, x) => s + x, 0) / n
}

/** A frase curta da ficha: a maior lacuna vira o próximo passo (Brehaut 2016: uma ação). */
export function proximoPasso(p) {
  if (p.nunca) return { texto: 'Ainda não abriu a escala.', passo: 'abrir a escala do dia no app pelo menos uma vez por dia útil.' }
  if (p.d7 === 0) return { texto: 'Não abriu a escala nos últimos 7 dias.', passo: 'voltar a abrir a escala todo dia útil, pela aba Minhas.' }
  if (!p.anest) {
    return p.d30 < META.uso30
      ? { texto: `Abriu a escala em ${p.d30} dias no mês.`, passo: 'abrir todo dia útil e marcar início e término das cirurgias da sua sala.' }
      : { texto: 'Usa a escala com frequência.', passo: 'continuar marcando início e término, que é o que faz a fila andar.' }
  }
  const lacunas = [
    { g: META.ter - p.ter30, texto: `Marca o término em ${formatarPct(p.ter30)} das suas cirurgias (meta 80%).`, passo: 'tocar "Terminada" ao sair da sala.' },
    { g: META.ini - p.ini30, texto: `Marca o início em ${formatarPct(p.ini30)} das suas cirurgias (meta 80%).`, passo: 'tocar "Iniciada" quando a cirurgia começar.' },
    { g: (META.tot - (p.tot30 ?? 0)) * 0.8, texto: `Informa o tempo total em ${formatarPct(p.tot30)} dos seus turnos (meta 80%).`, passo: 'informar a que horas termina o turno, para a fila saber quem libera primeiro.' },
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
