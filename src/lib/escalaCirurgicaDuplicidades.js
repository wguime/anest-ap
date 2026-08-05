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

const identidade = (caso, resolve) => {
  const nome = texto(caso?.anestesista)
  if (!nome || nome === '//' || /^\?+$/.test(nome)) return null
  return caso?.anestesistaUserId || resolve?.(nome) || nome.toLocaleUpperCase('pt-BR')
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
  hospitalLabelFor,
}) {
  const porIdentidade = new Map()
  const adicionar = (escala, label, casosDaEscala, ordem) => {
    const porPessoa = new Map()
    for (const caso of casosDaEscala || []) {
      if ((caso?.turno || periodo) !== periodo) continue
      const key = identidade(caso, resolver)
      if (!key) continue
      const atual = porPessoa.get(key) || { nome: texto(caso.anestesista), casos: [] }
      atual.casos.push(casoResumo(caso))
      porPessoa.set(key, atual)
    }
    for (const nomeRodape of rodapeDoTurnoSeguro(ordem, periodo)) {
      const nome = texto(nomeRodape)
      const key = nome ? (resolver?.(nome) || nome.toLocaleUpperCase('pt-BR')) : null
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

export const formatarOcorrenciaDuplicidade = (ocorrencia) => {
  const onde = `${ocorrencia.hospitalLabel} · ${ocorrencia.turno === 'matutino' ? 'Matutino' : 'Vespertino'}`
  const posicao = ocorrencia.noRodape ? 'posição no rodapé' : 'sem posição no rodapé'
  return `${onde}: ${ocorrencia.casos.length} caso(s), ${posicao}`
}
