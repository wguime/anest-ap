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
  resolver,
  normalizar = upperSimples,
  hospitalLabelFor,
}) {
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

export const formatarOcorrenciaDuplicidade = (ocorrencia) => {
  const onde = `${ocorrencia.hospitalLabel} · ${ocorrencia.turno === 'matutino' ? 'Matutino' : 'Vespertino'}`
  const posicao = ocorrencia.noRodape ? 'posição no rodapé' : 'sem posição no rodapé'
  return `${onde}: ${ocorrencia.casos.length} caso(s), ${posicao}`
}
