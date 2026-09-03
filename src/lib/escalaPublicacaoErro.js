/**
 * Erro de publicação da escala em português, sem vazar dado de paciente.
 *
 * O PostgREST devolve `{ code, message, details, hint }`. A `message` de uma CHECK é
 * `new row for relation "escala_cirurgica_caso" violates check constraint "..."` — texto que
 * a secretária não tem como agir (foi o toast de 02/09), e o `details` traz a LINHA INTEIRA
 * que falhou, com nome de paciente: nunca pode ir para a tela.
 *
 * Aqui a constraint vira uma frase que diz o que corrigir. O que não estiver mapeado cai na
 * mensagem crua — melhor um texto técnico do que "erro desconhecido".
 */

const POR_CONSTRAINT = [
  [/paciente_iniciais/, 'Algum paciente está com nome em vez de iniciais. Use só as iniciais, até 12 caracteres.'],
  [/termino_previsto/, 'Algum término previsto está fora do formato HH:MM.'],
  [/_tipo_check|tipo_check/, 'Algum caso está com um tipo que não existe (eletiva, urgência ou emergência).'],
  [/gravidade/, 'Algum caso está com uma gravidade que não existe.'],
  [/_turno_check|turno_check/, 'Algum caso está com um turno inválido.'],
  [/status/, 'Algum caso está com um estado inválido.'],
]

const POR_ERRO_DA_RPC = {
  turno_invalido: 'Turno inválido para esta publicação.',
  hospital_invalido: 'Hospital inválido para esta publicação.',
  status_invalido: 'Situação inválida para esta publicação.',
  payload_formato_invalido: 'A escala chegou num formato que o servidor não aceita. Refaça a leitura.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo e publique.',
  escala_nao_encontrada: 'A escala não foi encontrada — recarregue a tela.',
}

/** `true` quando o erro é de rede/servidor indisponível (nada foi publicado). */
export const ehErroDeRede = (err) => {
  const m = String(err?.message || '')
  return err?.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed|ERR_INTERNET/i.test(m)
}

/**
 * Frase curta para a tela. `err` é o Error do service (com `code`/`details` anexados) ou
 * qualquer coisa lançada no caminho. NUNCA inclui `details` (linha do banco, com paciente).
 */
export function mensagemErroPublicacao(err) {
  if (!err) return 'Não foi possível publicar.'
  if (ehErroDeRede(err)) return 'Sem conexão com o servidor — nada foi publicado. Tente de novo.'
  const codigo = String(err.code || '')
  const texto = String(err.message || '')
  if (codigo === '42501' || /permission denied/i.test(texto)) return 'Você não tem permissão para publicar esta escala.'
  if (codigo === '23514' || /violates check constraint/i.test(texto)) {
    const nome = texto.match(/constraint "([^"]+)"/)?.[1] || ''
    const hit = POR_CONSTRAINT.find(([re]) => re.test(nome) || re.test(texto))
    return hit ? hit[1] : 'Algum caso está com um campo fora do formato aceito.'
  }
  for (const [chave, frase] of Object.entries(POR_ERRO_DA_RPC)) if (texto.includes(chave)) return frase
  if (codigo === '22P02' || /invalid input syntax/i.test(texto)) return 'Algum campo numérico da escala está com texto no lugar do número.'
  if (codigo === '23505' || /duplicate key/i.test(texto)) return 'Esta escala já está sendo publicada por outra pessoa. Recarregue e confira.'
  // sem mapa: devolve a mensagem crua SEM o prefixo do service (`contexto: `)
  return texto.replace(/^[\w:]+:\s*/, '') || 'Não foi possível publicar.'
}
