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
 * Exames, Imagem e Consultório ficam de fora de propósito — os dois hospitais
 * têm.
 */
const BLOCOS = {
  hro: { iosc: 'iosc', ho: 'ho', ccoluna: 'ccoluna', hemodinamica: 'hemodinamica' },
  unimed: { srpa: 'srpa', accurata: 'accurata', umanita: 'umanita' },
  materno: { materno: 'materno' },
}

const SALAS = {
  hro: [
    [/^IOSC/, 'iosc'], [/HOSPITAL DE OLHOS/, 'ho'], [/^DIGIMAX/, 'digimax'],
    [/CENTRO DE COLUNA/, 'ccoluna'], [/BRAQUITERAPIA/, 'braquiterapia'],
    [/HEMODINAMICA/, 'hemodinamica'], [/^BLOCO M\b/, 'bloco-m'],
  ],
  unimed: [
    [/CESAREA/, 'cesarea'], [/CENTRO CIRURGICO/, 'centro-cirurgico'],
    [/UMANITA/, 'umanita'], [/ACCURATA/, 'accurata'],
  ],
  materno: [],
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

  // "SRPA ANEST A" é posição assistencial da Unimed — não vira caso, mas é marca
  for (const p of resposta?.posicoesAssistenciais || []) {
    if (/SRPA/.test(norm(p?.local))) marcas.unimed.add('srpa')
  }

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
