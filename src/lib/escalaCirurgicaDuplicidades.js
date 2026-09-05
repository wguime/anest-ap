/**
 * Cruza uma importação com as escalas dos demais hospitais.
 *
 * A mesma pessoa em dois hospitais não é automaticamente "ajuda" nem erro:
 * pode ser uma escala intencional ou uma troca. O resultado é deliberadamente
 * descritivo para a secretária confirmar antes de publicar.
 */
const rodapeDoTurnoSeguro = (ordem, turno) => {
  if (Array.isArray(ordem)) return ordem
  return (ordem && ordem[turno]) || []
}

const texto = (value) => String(value || '').trim()

// Fallback só para chamada sem `normalizar`. A chave PRECISA ser a mesma que
// `gerarColunaLiberacao` usa em `linha.chave` (`resolverUid(nome) || normNome(nome)`):
// é por ela que a troca declarada é gravada em `linha_overrides` e reencontrada na
// coluna de liberação. `normNome` tira acento e a nota de local do rodapé; um
// uppercase simples não tira, então "RÔMULO" e "MATHEUS (CONSULT)" gerariam chave
// diferente da linha e o badge de troca nunca apareceria.
const upperSimples = (nome) => texto(nome).toLocaleUpperCase('pt-BR')

const identidade = (caso, resolve, normalizar) => {
  const nome = texto(caso?.anestesista)
  if (!nome || nome === '//' || /^\?+$/.test(nome)) return null
  return caso?.anestesistaUserId || resolve?.(nome) || normalizar(nome)
}

const casoResumo = (caso) => ({
  sala: texto(caso?.sala) || 'Sala não informada',
  hora: texto(caso?.hora) || 'A seguir',
  procedimento: texto(caso?.procedimento) || 'Procedimento não informado',
})

/**
 * @returns {{key:string,nome:string,ocorrencias:Array}}[]
 * Cada ocorrência informa hospital, turno, posição no rodapé e os casos.
 */
export function detectarDuplicidadesEscala({
  casos = [],
  hospitalAtual,
  hospitalAtualLabel,
  ordemAtual = [],
  periodo,
  outrasEscalas = [],
  ajudas = [],
  resolver,
  normalizar = upperSimples,
  hospitalLabelFor,
}) {
  // AJUDA DECLARADA NÃO É DUPLICIDADE POR CLASSIFICAR (dono 30/08): "Oscar está
  // como ajuda de outro hospital no HRO, foi identificado como ajuda e mesmo
  // assim a escala não pôde ser publicada". O nome em AZUL no rodapé já é a
  // resposta da pergunta que o painel faz — quem escreveu a escala respondeu
  // antes. Vale a ajuda de QUALQUER lado: quem é ajuda no HRO aparece duplicado
  // também na conferência da Unimed, e lá a lista de ajuda é a de lá.
  const chavesDeAjuda = new Map()
  for (const a of ajudas) {
    for (const nome of a?.nomes || []) {
      const n = texto(nome)
      if (!n) continue
      chavesDeAjuda.set(resolver?.(n) || normalizar(n), a?.hospitalLabel || '')
    }
  }
  const porIdentidade = new Map()
  const adicionar = (escala, label, casosDaEscala, ordem) => {
    const porPessoa = new Map()
    for (const caso of casosDaEscala || []) {
      if ((caso?.turno || periodo) !== periodo) continue
      const key = identidade(caso, resolver, normalizar)
      if (!key) continue
      const atual = porPessoa.get(key) || { nome: texto(caso.anestesista), casos: [] }
      atual.casos.push(casoResumo(caso))
      porPessoa.set(key, atual)
    }
    for (const nomeRodape of rodapeDoTurnoSeguro(ordem, periodo)) {
      const nome = texto(nomeRodape)
      const key = nome ? (resolver?.(nome) || normalizar(nome)) : null
      if (!key) continue
      const atual = porPessoa.get(key) || { nome, casos: [] }
      atual.noRodape = true
      if (!atual.nome) atual.nome = nome
      porPessoa.set(key, atual)
    }
    for (const [key, pessoa] of porPessoa) {
      const ocorrencia = {
        hospital: escala?.hospital || hospitalAtual,
        hospitalLabel: label,
        turno: periodo,
        nome: pessoa.nome,
        casos: pessoa.casos,
        noRodape: Boolean(pessoa.noRodape),
      }
      const grupo = porIdentidade.get(key) || { key, nome: pessoa.nome, ocorrencias: [] }
      grupo.ocorrencias.push(ocorrencia)
      porIdentidade.set(key, grupo)
    }
  }

  adicionar({ hospital: hospitalAtual }, hospitalAtualLabel || hospitalAtual, casos, ordemAtual)
  for (const escala of outrasEscalas) {
    adicionar(escala, escala?.hospitalLabel || hospitalLabelFor?.(escala?.hospital) || escala?.hospital || 'Outro hospital', escala?.casos, escala?.ordemLiberacao)
  }

  return [...porIdentidade.values()]
    .filter((grupo) => grupo.ocorrencias.length > 1)
    .map((grupo) => ({
      ...grupo,
      nome: grupo.ocorrencias.find((o) => o.casos.length)?.nome || grupo.nome,
      // rótulo do hospital que DECLAROU a ajuda ('' quando ninguém declarou)
      ajudaDeclarada: chavesDeAjuda.has(grupo.key) ? (chavesDeAjuda.get(grupo.key) || 'outro hospital') : '',
    }))
}

/**
 * Sugere o PARCEIRO provável de cada duplicidade (Fase 2.2, dono 07/08): quem
 * está no rodapé de A com casos em B provavelmente trocou com quem está no
 * rodapé de B com casos em A — o par SIMÉTRICO. Com exatamente UM candidato
 * simétrico, a conferência pré-preenche o seletor; a decisão continua humana
 * (a sugestão nunca classifica sozinha).
 * @returns Map<keyDaDuplicidade, keyDoParceiroSugerido>
 */
export function sugerirParceiroTroca(duplicidades) {
  const assinatura = (grupo) => {
    const rodapeEm = new Set()
    const casosEm = new Set()
    for (const o of grupo.ocorrencias || []) {
      if (o.noRodape) rodapeEm.add(o.hospital)
      if (o.casos?.length) casosEm.add(o.hospital)
    }
    return { rodapeEm, casosEm }
  }
  const sugestoes = new Map()
  for (const p of duplicidades || []) {
    const sp = assinatura(p)
    const candidatos = (duplicidades || []).filter((q) => {
      if (q.key === p.key) return false
      const sq = assinatura(q)
      // simetria: Q tem rodapé onde P tem casos E casos onde P tem rodapé
      const qRodapeOndePCasos = [...sp.casosEm].some((h) => sq.rodapeEm.has(h))
      const qCasosOndePRodape = [...sp.rodapeEm].some((h) => sq.casosEm.has(h))
      return qRodapeOndePCasos && qCasosOndePRodape
    })
    if (candidatos.length === 1) sugestoes.set(p.key, candidatos[0].key)
  }
  return sugestoes
}

/**
 * A CHAVE DA DECISÃO É FIXADA NA HORA DA RESPOSTA (Onda 2, item 2.5; audit A9).
 *
 * A chave da duplicidade é `resolver(nome) || normalizar(nome)` — e o `resolver` muda no
 * meio da publicação: `upsertAlias` aprende "JOAO"→uid e faz `refresh()` ANTES de
 * `salvarEscalaTurno`. Se a RPC cai (constraint), a chave do João passa de `JOAO` para o
 * uid, a decisão gravada sob `JOAO` não é mais achada, a pendência volta a 1 e a tela diz
 * "confirme as duplicidades" — a resposta dada "sumiu". Com o roster compartilhado pelo
 * lote o mesmo salto acontece nas três abas de uma vez.
 *
 * Daí: a decisão leva consigo `uid` e `nomeNorm` de quando foi respondida
 * (`carimbarDecisao`), e a leitura casa pela chave atual OU por qualquer uma das duas
 * identidades (`localizarDecisao`). Vale também para mapas de valor simples (o parceiro
 * escolhido por chave): aí só a chave é comparada.
 */
export function carimbarDecisao(decisao, dup, { resolver, normalizar = upperSimples } = {}) {
  const nome = texto(dup?.nome)
  const nomeNorm = nome ? normalizar(nome) : ''
  const uid = resolver?.(nome) || (dup?.key && dup.key !== nomeNorm ? dup.key : null)
  return { ...(decisao || {}), chave: dup?.key || null, uid: uid || null, nomeNorm }
}

export function localizarDecisao(mapa, dup, { resolver, normalizar = upperSimples } = {}) {
  if (!mapa || !dup?.key) return null
  if (mapa[dup.key] !== undefined) return { chave: dup.key, decisao: mapa[dup.key] }
  const nome = texto(dup.nome)
  const nomeNorm = nome ? normalizar(nome) : ''
  const uid = resolver?.(nome) || null
  for (const [chave, d] of Object.entries(mapa)) {
    if (d === undefined) continue
    if ((uid && chave === uid) || (nomeNorm && chave === nomeNorm)) return { chave, decisao: d }
    if (d && typeof d === 'object') {
      if ((uid && d.uid === uid) || (nomeNorm && d.nomeNorm === nomeNorm)) return { chave, decisao: d }
    }
  }
  return null
}

export const formatarOcorrenciaDuplicidade = (ocorrencia) => {
  const onde = `${ocorrencia.hospitalLabel} · ${ocorrencia.turno === 'matutino' ? 'Matutino' : 'Vespertino'}`
  const posicao = ocorrencia.noRodape ? 'posição no rodapé' : 'sem posição no rodapé'
  return `${onde}: ${ocorrencia.casos.length} caso(s), ${posicao}`
}
