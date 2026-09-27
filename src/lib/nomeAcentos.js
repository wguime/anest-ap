/**
 * Acentos de nomes próprios na EXIBIÇÃO (dono 27/09/2026: "acrescente acentos aos nomes, em
 * todas as escalas"). As fontes chegam sem acento — legenda da escala numérica, Pega Plantão,
 * parte do cadastro ("MAURICIO MAHALEM BASTOS") — e o app mostrava "Joao", "Mauricio".
 *
 * Só tela: o dado segue como veio, porque é ele que casa pessoas (rodapé, férias, plantonista)
 * e essas comparações já tiram acento. Dicionário FECHADO de grafias sem ambiguidade — nome que
 * se escreve dos dois jeitos (Luis/Luís, Thayna/Thayná) fica como veio; nunca adivinhar.
 */
const ACENTOS = Object.fromEntries(
  [
    'João', 'José', 'Antônio', 'Maurício', 'Marílio', 'Rômulo', 'Janaína', 'Salvão', 'Márcio',
    'Márcia', 'Fábio', 'Flávio', 'Flávia', 'Vinícius', 'Lúcia', 'Lúcio', 'Patrícia', 'Cássio',
    'César', 'Sérgio', 'Rogério', 'Otávio', 'Vitória', 'Mônica', 'Verônica', 'André', 'Inês',
    'Cláudio', 'Cláudia', 'Júlio', 'Júlia', 'Mário', 'Letícia', 'Cecília', 'Emília', 'Tânia',
    'Vânia', 'Sônia', 'Débora', 'Bárbara', 'Ângela', 'Ângelo', 'Aurélio',
    'Sebastião', 'Cícero', 'Gonçalves', 'Conceição', 'Assunção', 'Magalhães',
    'Guimarães', 'Simões', 'Romão', 'Brandão', 'Falcão', 'Leão', 'Galvão',
  ]
    .map((n) => [n.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase(), n]),
)

/** Um token: devolve a grafia acentuada na MESMA caixa do original (CAIXA, Título ou minúscula). */
function acentuarToken(t) {
  const certo = ACENTOS[t.toUpperCase()]
  if (!certo) return t
  if (t === t.toUpperCase()) return certo.toLocaleUpperCase('pt-BR')
  if (t === t.toLowerCase()) return certo.toLocaleLowerCase('pt-BR')
  return certo
}

/** "Joao Moreira" → "João Moreira"; "MAURICIO" → "MAURÍCIO"; o resto do texto fica intacto. */
export function acentuarNome(s) {
  if (s == null) return s
  return String(s).replace(/[A-Za-z]+/g, acentuarToken)
}
