/**
 * Pontuação de uma leitura da Vision contra o gabarito (Onda 4, item 4.1).
 *
 * Puro e sem I/O de propósito: é a parte do eval que precisa de teste. O script
 * `scripts/eval-escala-vision.mjs` cuida de ler o corpus, chamar a edge e
 * imprimir; aqui mora só a conta — que é onde um eval mente com mais facilidade.
 *
 * As quatro medidas são as que a auditoria de 02/09 apontou como as classes de
 * erro reais, e não métricas genéricas:
 *   - casos: a cirurgia existe na leitura? (o que some é o pior erro — a
 *     Hemodinâmica chegou em 49% das importações e a Imagem em 15%)
 *   - anestesista por linha: entre os casos que casaram, o nome está certo?
 *     (o "//" propagado e o nome inventado moram aqui)
 *   - rodapé em ordem: a ordem de liberação é sagrada — posição por posição
 *   - ajuda (azul): quem veio ajudar de outro hospital foi reconhecido?
 *
 * Um acerto de 100% em "casos" com 50% em "rodapé" e um acerto de 75% nos dois
 * dão a mesma média e são situações completamente diferentes: por isso nada
 * aqui devolve uma nota única.
 */

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '')

/** Comparação canônica: sem acento, maiúsculo, espaço colapsado. */
export const norm = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * Primeiro nome normalizado — a mesma chave que o guardrail da edge usa para
 * cruzar caso × rodapé. "JOAO H." e "JOAO HENRIQUE" colapsam em "JOAO", e
 * "GUILHERME M ELO" (o kerning lido errado) colapsa em "GUILHERME".
 */
export const primeiroNome = (s) => norm(s).replace(/^PED[.\s]+/, '').split(' ')[0] || ''

/** Sala comparável: só letras e dígitos ("Sala 5" e "SALA5" são a mesma). */
export const salaChave = (s) => norm(s).replace(/[^A-Z0-9]/g, '')

/** Hora comparável: "7:30", "07h30" e "07:30" viram "07:30"; "AS" fica "AS". */
export function horaChave(v) {
  const s = norm(v)
  if (!s) return ''
  if (/^A\s*SEGUIR$|^AS$/.test(s)) return 'AS'
  const m = s.match(/(\d{1,2})\D?(\d{2})/)
  if (!m) return s
  const h = Math.min(23, Number(m[1]))
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

const procChave = (s) => norm(s).replace(/[^A-Z0-9]/g, '')

/** Um procedimento é o começo do outro (o mapa costuma cortar o texto longo). */
function procParecido(a, b) {
  const x = procChave(a)
  const y = procChave(b)
  if (x.length < 8 || y.length < 8) return false
  return x.startsWith(y) || y.startsWith(x)
}

/**
 * Casa os casos lidos com os do gabarito em três passadas, da mais específica
 * para a mais frouxa. Frouxa demais infla o acerto; estrita demais conta como
 * "sumiu" um caso que só teve a sala corrigida. As três passadas exigem SEMPRE
 * pelo menos dois campos coincidentes, e nenhum caso lido casa com dois
 * esperados (é assim que "inventou uma linha" continua aparecendo).
 */
export function casarCasos(esperados, lidos) {
  const livres = lidos.map((c, i) => ({ c, i, usado: false }))
  const pares = []
  const faltando = []
  const iniciaisDe = (c) => norm(c.iniciais ?? c.pacienteIniciais)
  const passadas = [
    (e, l) => Boolean(salaChave(e.sala) && horaChave(e.hora) && iniciaisDe(e))
      && salaChave(e.sala) === salaChave(l.sala)
      && horaChave(e.hora) === horaChave(l.hora)
      && iniciaisDe(e) === iniciaisDe(l),
    (e, l) => Boolean(salaChave(e.sala) && horaChave(e.hora))
      && salaChave(e.sala) === salaChave(l.sala)
      && horaChave(e.hora) === horaChave(l.hora),
    (e, l) => Boolean(horaChave(e.hora))
      && horaChave(e.hora) === horaChave(l.hora)
      && procParecido(e.procedimento, l.procedimento),
  ]
  const pendentes = esperados.map((e) => ({ e, casado: false }))
  for (const casa of passadas) {
    for (const p of pendentes) {
      if (p.casado) continue
      const alvo = livres.find((l) => !l.usado && casa(p.e, l.c))
      if (!alvo) continue
      alvo.usado = true
      p.casado = true
      pares.push({ esperado: p.e, lido: alvo.c })
    }
  }
  for (const p of pendentes) if (!p.casado) faltando.push(p.e)
  return { pares, faltando, sobrando: livres.filter((l) => !l.usado).map((l) => l.c) }
}

/**
 * Acerto posição a posição de duas listas de nomes, mais o acerto de conjunto.
 * A ordem do rodapé é a ordem de liberação — trocar duas posições é um erro
 * real mesmo com o conjunto de nomes idêntico.
 */
export function compararOrdem(esperado, lido) {
  const e = (esperado || []).map(primeiroNome).filter(Boolean)
  const l = (lido || []).map(primeiroNome).filter(Boolean)
  const posicoesCertas = e.reduce((acc, nome, i) => acc + (l[i] === nome ? 1 : 0), 0)
  const conjuntoLido = new Set(l)
  const presentes = e.filter((n) => conjuntoLido.has(n)).length
  const conjuntoEsperado = new Set(e)
  const inventados = l.filter((n) => !conjuntoEsperado.has(n))
  return {
    total: e.length,
    posicoesCertas,
    presentes,
    faltando: e.filter((n) => !conjuntoLido.has(n)),
    inventados,
    exato: e.length === l.length && posicoesCertas === e.length,
  }
}

/** Acerto de conjunto (usado na ajuda/azul, onde a ordem não significa nada). */
export function compararConjunto(esperado, lido) {
  const e = new Set((esperado || []).map(primeiroNome).filter(Boolean))
  const l = new Set((lido || []).map(primeiroNome).filter(Boolean))
  const acertos = [...e].filter((n) => l.has(n))
  return {
    total: e.size,
    acertos: acertos.length,
    faltando: [...e].filter((n) => !l.has(n)),
    inventados: [...l].filter((n) => !e.has(n)),
  }
}

/**
 * Pontua UMA foto. `gabarito` é o que o dono conferiu; `leitura` é a resposta
 * da edge, no formato que o cliente consome.
 */
export function pontuarLeitura(gabarito, leitura) {
  const esperados = gabarito?.casos || []
  const lidos = leitura?.casos || []
  const { pares, faltando, sobrando } = casarCasos(esperados, lidos)

  let anestCertos = 0
  const anestErrados = []
  for (const { esperado, lido } of pares) {
    const esp = primeiroNome(esperado.anestesista)
    const got = primeiroNome(lido.anestesista)
    // linha sem anestesista no gabarito não conta nem a favor nem contra: o "?"
    // e a célula vazia são estado legítimo do mapa
    if (!esp) continue
    if (esp === got) anestCertos++
    else anestErrados.push({ sala: esperado.sala, hora: esperado.hora, esperado: esp, lido: got || '(vazio)' })
  }
  const anestTotal = pares.filter(({ esperado }) => primeiroNome(esperado.anestesista)).length

  const rodape = compararOrdem(gabarito?.rodape, leitura?.ordemLiberacao)
  const ajuda = compararConjunto(gabarito?.ajuda, leitura?.ajudaExterna)

  return {
    arquivo: gabarito?.arquivo || '',
    casos: {
      esperados: esperados.length,
      lidos: lidos.length,
      casados: pares.length,
      faltando: faltando.map((c) => ({ sala: c.sala, hora: c.hora, procedimento: c.procedimento })),
      sobrando: sobrando.length,
    },
    anestesista: { total: anestTotal, certos: anestCertos, errados: anestErrados },
    rodape,
    ajuda,
    hospital: {
      esperado: norm(gabarito?.hospital),
      lido: norm(leitura?.hospitalDetectado),
      certo: !gabarito?.hospital || norm(gabarito.hospital) === norm(leitura?.hospitalDetectado),
    },
    data: {
      esperado: gabarito?.data || '',
      lido: leitura?.dataDetectada || '',
      certo: !gabarito?.data || gabarito.data === leitura?.dataDetectada,
    },
  }
}

const pct = (n, d) => (d > 0 ? (100 * n) / d : null)

/** Agrega as pontuações de várias fotos no placar que o eval imprime. */
export function agregar(pontuacoes) {
  const soma = (f) => pontuacoes.reduce((a, p) => a + f(p), 0)
  const casosEsperados = soma((p) => p.casos.esperados)
  const anestTotal = soma((p) => p.anestesista.total)
  const rodapeTotal = soma((p) => p.rodape.total)
  const ajudaTotal = soma((p) => p.ajuda.total)
  return {
    fotos: pontuacoes.length,
    casos: {
      esperados: casosEsperados,
      encontrados: soma((p) => p.casos.casados),
      sumiram: soma((p) => p.casos.faltando.length),
      inventados: soma((p) => p.casos.sobrando),
      acerto: pct(soma((p) => p.casos.casados), casosEsperados),
    },
    anestesista: {
      total: anestTotal,
      certos: soma((p) => p.anestesista.certos),
      acerto: pct(soma((p) => p.anestesista.certos), anestTotal),
    },
    rodape: {
      total: rodapeTotal,
      posicoesCertas: soma((p) => p.rodape.posicoesCertas),
      acertoPosicao: pct(soma((p) => p.rodape.posicoesCertas), rodapeTotal),
      acertoNomes: pct(soma((p) => p.rodape.presentes), rodapeTotal),
      exatos: soma((p) => (p.rodape.exato ? 1 : 0)),
      inventados: soma((p) => p.rodape.inventados.length),
    },
    ajuda: {
      total: ajudaTotal,
      certos: soma((p) => p.ajuda.acertos),
      acerto: pct(soma((p) => p.ajuda.acertos), ajudaTotal),
      inventados: soma((p) => p.ajuda.inventados.length),
    },
    hospital: { certos: soma((p) => (p.hospital.certo ? 1 : 0)), total: pontuacoes.length },
    data: { certos: soma((p) => (p.data.certo ? 1 : 0)), total: pontuacoes.length },
  }
}

/** Preço por milhão de tokens. Fonte: skill claude-api (2026-06). */
export const PRECOS = {
  'claude-opus-4-8': { entrada: 5, saida: 25 },
  'claude-opus-5': { entrada: 5, saida: 25 },
  'claude-sonnet-5': { entrada: 2, saida: 10 },
  'claude-fable-5-1': { entrada: 10, saida: 50 },
}

/**
 * Custo em dólares de uma leitura, a partir do `usage` gravado no
 * `escala_leitura_log`. Cache: leitura 0,1× e escrita 1,25× do preço de entrada.
 */
export function custoDaLeitura(linha) {
  const p = PRECOS[linha?.modelo] || PRECOS['claude-opus-4-8']
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return (
    (n(linha?.input_tokens) * p.entrada +
      n(linha?.cache_read_tokens) * p.entrada * 0.1 +
      n(linha?.cache_write_tokens) * p.entrada * 1.25 +
      n(linha?.output_tokens) * p.saida) / 1e6
  )
}
