/**
 * De QUEM é o documento, pelo que ele TRAZ (dono 2026-08-30).
 *
 * "Tentei anexar as escalas de amanhã de manhã, mas não está reconhecendo a
 * escala do HRO." O hospital de um anexo vinha de UMA fonte só: o
 * `hospitalDetectado` que a Vision devolve olhando o LAYOUT — e, do lado do
 * Excel, de uma suposição de extensão ("planilha = Unimed", verdade enquanto só
 * a Unimed exportava planilha).
 *
 * Layout é frágil: o mapa do HRO e o do Materno têm as MESMAS colunas
 * (Leito/Paciente/Cirurgião/Procedimento) e a assinatura do HRO é a COR — que um
 * print desbotado, uma foto de lado ou um recorte sem o rodapé vermelho não
 * entregam. Classificação vazia joga o arquivo na fila do "de qual hospital é
 * isto?"; classificação TROCADA é pior: o arquivo entra na aba do outro
 * hospital, por cima dela, e a escala do HRO simplesmente não aparece.
 *
 * O conteúdo é assinatura dura: só o HRO tem IOSC, Hospital de Olhos, Centro de
 * Coluna, Hemodinâmica, Digimax e Bloco M; só a Unimed tem SRPA, Accurata,
 * Umanitá e as seções "C.O - CESAREA"/"CENTRO CIRÚRGICO". Marca de um não
 * existe no outro — por isso ela classifica, e Exames/Imagem/Consultório, que
 * os dois têm, não valem nada aqui.
 *
 * ⚠️ Assimetria de propósito: UMA marca PREENCHE o que a leitura deixou vazio,
 * mas são precisas DUAS para CONTRADIZER o que ela afirmou. Encher um vazio é
 * barato; derrubar uma leitura afirmativa por causa de um `bloco` solto (a
 * Vision erra um de vez em quando) sairia caro. E contradição não escolhe
 * sozinha: ela manda PERGUNTAR — a regra da casa é sugerir, nunca trocar
 * sozinho.
 */

const norm = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toUpperCase()

/**
 * MARCAS EXCLUSIVAS — cada uma é um FATO do documento, e o nome da marca é o
 * fato, não o campo onde ele apareceu: a mesma linha do IOSC vem como bloco
 * `iosc` e como sala "IOSC", e isso continua sendo UMA evidência, não duas.
 *
 * ⚠️ A lista foi MEDIDA no banco (30/08, 1.000 casos publicados em 60 dias), não
 * deduzida do prompt — e a medição derrubou três marcas que pareciam óbvias:
 * Hemodinâmica (9 no HRO, 11 na Unimed), SRPA (3 no HRO, 18 na Unimed) e o bloco
 * `materno` (6 no Materno, 3 na Unimed, onde é o C.O da própria casa). Exames,
 * Imagem e Consultório também são dos dois. Marca que aparece nos dois não
 * classifica nada — só atrasa.
 */
const BLOCOS = {
  hro: { iosc: 'iosc', ho: 'ho', ccoluna: 'ccoluna' },
  unimed: { umanita: 'umanita', accurata: 'accurata', mauricio: 'mauricio' },
  materno: {},
}

/**
 * Rótulos de sala, na grafia CRUA da leitura (a canônica do banco só existe
 * depois de `normalizarSalaHro`/`normalizarSalaUnimed`, que rodam bem depois).
 *
 * ⚠️ "Sala 6" pelado NÃO é marca de ninguém: o mapa da Unimed às vezes rotula a
 * coluna só com o número ou com "SALA 6" (dono 25/08), e foi assim que vieram os
 * 31 casos do feriado. O que separa é o PREFIXO — "CC -"/"CENTRO CIRÚRGICO" e
 * "C.O - CESAREA" são da Unimed; "Bloco A"/"Bloco M" e a Emergência são do HRO;
 * o sufixo "HC" é do Materno.
 */
const SALAS = {
  hro: [
    [/^IOSC/, 'iosc'], [/HOSPITAL DE OLHOS/, 'ho'], [/^H\.? ?O\.?$/, 'ho'],
    [/^DIGIMAX/, 'digimax'], [/CENTRO DE COLUNA/, 'ccoluna'], [/C\. ?COLUNA/, 'ccoluna'],
    [/BRAQUI/, 'braquiterapia'], [/^BLOCO ?M\b/, 'bloco-m'], [/^BLOCO ?A\b/, 'bloco-a'],
    [/EMERG/, 'emergencia'],
  ],
  unimed: [
    [/CESAREA/, 'cesarea'], [/CENTRO CIRURGICO/, 'centro-cirurgico'], [/^CC\b/, 'centro-cirurgico'],
    [/^C\.? ?O\b.*\d/, 'centro-obstetrico'], [/UMANITA/, 'umanita'], [/ACCURATA/, 'accurata'],
  ],
  // "Sala 2 HC"/"Sala 3 HC" — as duas únicas salas do Materno em 60 dias
  materno: [[/\bHC$/, 'sala-hc']],
}

/**
 * Cabeçalho de PLANILHA. "LEITO" é a coluna do mapa do HRO; o export da Unimed
 * (SALA/PACIENTE/IDADE/PROCEDIMENTO/TEMPO/CIRURGIÃO/CONVÊNIO/ANEST) não tem
 * leito nenhum, e traz IDADE e TEMPO, que o do HRO não tem. O Materno nunca
 * chega em planilha — é relatório do G-HOSP.
 */
const COLUNAS = {
  hro: [[/^LEITO/, 'coluna-leito']],
  unimed: [[/^IDADE/, 'coluna-idade'], [/^TEMPO/, 'coluna-tempo']],
  materno: [],
}

const HOSPITAIS = ['unimed', 'hro', 'materno']

/**
 * Classifica o anexo pelo CONTEÚDO já lido (casos, posições e, na planilha, o
 * cabeçalho). Nunca chuta: sem marca exclusiva devolve hospital ''.
 *
 * @param {object} resposta  o que a leitura devolveu (Vision ou parser de Excel)
 * @param {string[]} [resposta.headers]  cabeçalho da planilha, quando houver
 * @returns {{hospital: string, forca: number, marcas: string[]}}
 *   `forca` = quantas marcas distintas apontaram para o vencedor.
 */
export function hospitalPelaEstrutura(resposta = {}) {
  const marcas = { unimed: new Set(), hro: new Set(), materno: new Set() }
  const casar = (pares, valor, alvo) => {
    for (const [re, marca] of pares) if (re.test(valor)) marcas[alvo].add(marca)
  }

  for (const c of resposta?.casos || []) {
    const bloco = String(c?.bloco || '').toLowerCase()
    const sala = norm(c?.sala)
    for (const h of HOSPITAIS) {
      if (bloco && BLOCOS[h][bloco]) marcas[h].add(BLOCOS[h][bloco])
      if (sala) casar(SALAS[h], sala, h)
    }
  }

  // A SRPA saiu da lista: "SRPA ANEST A" parece assinatura da Unimed, mas o HRO
  // também publica posição de SRPA (3 casos em 60 dias). Posições assistenciais
  // ficam de fora inteiras.

  for (const head of resposta?.headers || []) {
    const h = norm(head)
    if (h) for (const alvo of HOSPITAIS) casar(COLUNAS[alvo], h, alvo)
  }

  const placar = HOSPITAIS
    .map((h) => ({ hospital: h, forca: marcas[h].size, marcas: [...marcas[h]] }))
    .sort((a, b) => b.forca - a.forca)

  // empate não decide nada: documento com marca dos dois é justamente o que
  // precisa de gente olhando
  if (!placar[0].forca || placar[0].forca === placar[1].forca) return { hospital: '', forca: 0, marcas: [] }
  return placar[0]
}

/**
 * Junta as duas fontes numa decisão só.
 *
 * @param {string} lido  hospital que a leitura declarou ('' quando não soube)
 * @param {{hospital: string, forca: number}} estrutura  saída de `hospitalPelaEstrutura`
 * @returns {{hospital: string, origem: ''|'layout'|'estrutura', conflito: string}}
 *   `conflito` traz o hospital que a estrutura viu quando ela contradiz a
 *   leitura — a tela PERGUNTA nesse caso, em vez de escolher.
 */
export function decidirHospital(lido, estrutura) {
  const daLeitura = HOSPITAIS.includes(lido) ? lido : ''
  const daEstrutura = HOSPITAIS.includes(estrutura?.hospital) ? estrutura.hospital : ''
  const forca = Number(estrutura?.forca || 0)
  if (daLeitura && daEstrutura && daLeitura !== daEstrutura && forca >= 2) {
    return { hospital: '', origem: '', conflito: daEstrutura }
  }
  if (daLeitura) return { hospital: daLeitura, origem: 'layout', conflito: '' }
  if (daEstrutura) return { hospital: daEstrutura, origem: 'estrutura', conflito: '' }
  return { hospital: '', origem: '', conflito: '' }
}
