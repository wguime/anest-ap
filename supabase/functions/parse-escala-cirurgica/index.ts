// parse-escala-cirurgica — extrai a escala cirúrgica estruturada de uma imagem
// (print de WhatsApp) via Claude Vision. Retorna { casos, ordemLiberacao }.
//
// Deploy:
//   bash scripts/deploy-edge-with-pat.sh parse-escala-cirurgica
//   (use --no-verify-jwt SE o app enviar JWT custom; com Third-Party Auth nativo
//    o gateway valida o token e a flag não é necessária.)
//
// Auth: validação INTERNA via _shared/verify-auth.ts (JWT HS256 legado OU Firebase
// ID Token) — independe da flag do gateway. Sem token válido: 401 e nada chega à
// Anthropic (protege créditos + trilha LGPD de quem enviou a imagem).
//
// Secret necessário:  ANTHROPIC_API_KEY  (firebase functions:secrets / Supabase secrets)
//
// LGPD: o prompt instrui a extrair o paciente APENAS por iniciais — nomes completos
// de paciente NÃO devem sair da imagem, COM UMA EXCEÇÃO: casos com convênio
// PARTICULAR também devolvem pacienteNome (nome completo) p/ pré-preencher a
// COBRANÇA em cirurgias_particulares (base legal art. 11 II "d" — ver header da
// migration 20260722100000). O nome NUNCA é gravado na escala (CHECK do banco
// rejeita); sanitizeCasos derruba pacienteNome de qualquer caso não-particular.
// Documentar base legal em docs/escala-cirurgica.md.

import { verifyAuthHeader } from '../_shared/verify-auth.ts'
import { dimensoesDeBase64, bytesDeBase64 } from '../_shared/imagem-dimensoes.ts'
import { montarLinhaLog, hashImagem, registrarLeitura } from '../_shared/escala-leitura-log.ts'
import { normalizarCasos } from '../_shared/escala-normalizacao.ts'
import {
  lerRodape, aplicarCorNosCasos, derivarRodape, blanquearForaDoRodape,
} from '../_shared/escala-cor.ts'
import { prepararRoster, resolverRoster } from '../_shared/escala-roster.ts'
import { lerRespostaStream, ehLeituraIncompleta } from '../_shared/escala-stream.ts'
import {
  chaveCache, lerCache, gravarCache, fetchComRetry,
} from '../_shared/escala-leitura-cache.ts'

/** Modelo da leitura. Trocar exige medir antes (eval do item 4.1). */
const MODELO = 'claude-opus-4-8'

/**
 * Versão do prompt/contrato. MUDE A CADA alteração de SYSTEM_PROMPT, das dicas
 * de hospital ou do schema de saída: é a coluna que separa duas edições no
 * `escala_leitura_log` e a que invalida o cache de leitura. Sem bumpar, o ANTES
 * e o DEPOIS se misturam na mesma média e a medição mente.
 */
const PROMPT_VERSAO = 'v9-memoria-2026-09-08'

const DEFAULT_ALLOWED_ORIGINS = [
  'https://anest-ap.web.app',
  'https://anest-ap.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
]
const ENV_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...ENV_ORIGINS])

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://anest-ap.web.app'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const HOSPITAL_HINT: Record<string, string> = {
  unimed:
    'Formato Unimed: colunas SALA, PACIENTE, IDADE, PROCEDIMENTO, TEMPO, CIRURGIÃO, CONVÊNIO, ANEST. ' +
    'Salas agrupadas (C.O - CESAREA, CENTRO CIRÚRGICO - SALA N). "//" na coluna ANEST = mesmo anestesista da linha acima. ' +
    'As seções C.O (CESAREA/SALA N) são o centro obstétrico da própria Unimed: bloco "normal", nunca "materno" (o Materno é outro hospital). ' +
    'Blocos no rodapé: SRPA, EXAMES, IMAGEM, CONSULTORIO, UMANITÁ, ACCURATA. Nesses blocos cada linha tem o seu próprio anestesista na coluna ANEST — copie o da própria linha e não repita o da primeira nas seguintes. ' +
    'Esses blocos são pequenos, empilhados e separados por linhas em branco; confira o alinhamento vertical antes de fechar o JSON: o nome do bloco de cima chega a atravessar para o vizinho (a 1ª linha de EXAMES sair com o anestesista da IMAGEM e vice-versa). Dois blocos CONSULTORIO seguidos são duas pessoas, uma por linha, nunca a mesma repetida; nessas linhas o cirurgião fica vazio (consultório não tem cirurgião — não copie para lá o nome da outra linha). ' +
    'No rodapé há uma linha com os anestesistas na ORDEM DE LIBERAÇÃO. "SRPA ANEST A" é uma POSIÇÃO ASSISTENCIAL: não entra em casos; devolva em posicoesAssistenciais para manter local, colega trabalhando e ordem de liberação.',
  hro:
    'Formato HRO: colunas Leito, Paciente, Cirurgião, Procedimento, ANEST, Conv., Sala. "//" = mesmo anestesista acima. ' +
    'Rodapé com anestesistas na ordem de liberação. REGRAS DE SALA (nunca deixe sala vazia — use o rótulo da seção): ' +
    'salas numéricas (seção BLOCO A) = "Sala N" — só o número, sem o bloco e sem o papel da sala; seção "BLOCO M" = "Bloco M - Sala N" (aqui o bloco FICA: é o que separa a sala 1 do materno da sala 1 do bloco A); ' +
    'linha só com "CO" = "Sala 7" (o CO do HRO é a sala 7 — bloco normal, o CO do HRO NÃO é materno, nunca use bloco materno aqui); ' +
    'linha só com "EMERGENCIA" = "Sala 5"; "HEMO" = "Hemodinâmica" (bloco hemodinamica); "EXAMES" = "Exames" (bloco exames); ' +
    '"BRAQUI" = "Braquiterapia" (bloco normal); "CONSULT." = "Consultório" (bloco consultorio); "IMAGEM" = "Imagem" (bloco imagem). ' +
    'RÓTULO NA COLUNA LEITO — duas formas, e confundi-las faz a cirurgia sumir da escala. ' +
    'FORMA 1 — a linha É UM CASO: tem HORA na 1ª coluna e/ou procedimento, paciente ou cirurgião preenchidos, e o rótulo (HEMO, EXAMES, IMAGEM, IOSC, HO, BRAQUI, DIGIMAX, C. COLUNA...) está na MESMA LINHA. Então esse rótulo é a SALA DAQUELA LINHA e a linha vira UM CASO normal. Exemplo real: "09:00 | HEMO | ANGIOPLASTIA INTRALUMINAL – 2H | Alexandre Medeiros" é UMA cirurgia na Hemodinâmica, não um título; "08:00 | EXAMES | 01 RETOSSIGMOID. + 02 COLO + 01 EDA | Luciano" é UMA linha de Exames. É comum haver UMA linha só de Imagem, de Hemo ou de Exames no dia — ela continua sendo um caso. ' +
    'FORMA 2 — a linha é um CABEÇALHO de seção: traz SÓ o rótulo, com hora, procedimento, paciente e cirurgião VAZIOS. Aí ele vale para as linhas ABAIXO, até o próximo rótulo, e o cabeçalho em si NÃO vira caso. ' +
    'Regra de decisão, nesta ordem: a linha tem hora, procedimento, cirurgião ou paciente? Então é CASO (forma 1). Só depois considere cabeçalho. Linha com hora nunca é descartada por o rótulo parecer um título. ' +
    'Destaque (fundo amarelo) e cor do rótulo não decidem — o IOSC costuma vir em roxo, igual aos procedimentos; quem decide é a linha ter conteúdo próprio. ' +
    'A escala inclui OUTROS HOSPITAIS que fazem parte dela — extraia TODAS essas seções como casos também, com o cirurgião quando houver (nomes em ROXO são cirurgiões): ' +
    '"IOSC" = bloco iosc; "HO" = bloco ho (Hospital de Olhos); "DIGIMAX" = bloco normal; "CENTRO DE COLUNA"/"C. COLUNA" = bloco ccoluna; "AMBULATORIAL" = bloco normal. ' +
    'SALA dessas seções = só o nome da seção, sem número interno: toda linha do IOSC → sala "IOSC"; HO → "Hospital de Olhos"; Digimax → "Digimax"; Centro de Coluna → "Centro de Coluna". O "SALA 1"/"SALA 2" que aparece na coluna Sala dessas seções é a sala interna da clínica e não é usado — devolvê-lo faria a linha cair junto da sala homônima do HRO, misturando anestesistas de prédios diferentes. Todas as linhas de uma seção compartilham a mesma sala, na ordem em que aparecem; cada linha mantém o seu próprio anestesista. ' +
    'Isso vale para as linhas SEGUINTES, não só para a que traz o rótulo: aberta a seção, toda linha abaixo dela continua na mesma seção até aparecer outro rótulo na coluna Leito — mesmo que a coluna Sala traga 1, 2 ou 3, e mesmo que a coluna ANEST traga um nome próprio em vez da marca de repetição. Exemplo do que dá errado sem essa regra: o IOSC com 3 linhas (salas internas 1, 2 e 3) em que só a primeira sai como IOSC e a segunda vai para a Sala 2 do HRO. ' +
    'Nessas seções cada linha tem o seu próprio anestesista — copie o da linha, não atribua o mesmo a todas; linha sem anestesista visível fica vazia. ' +
    'Dois pontos para conferir antes de fechar o JSON: (1) nenhum caso das seções IOSC, HO, DIGIMAX ou CENTRO DE COLUNA sai com sala "Sala 1", "Sala 2" ou "Sala 3"; (2) toda linha com hora virou caso — em especial EXAMES, IMAGEM e HEMO/HEMODINÂMICA, que costumam aparecer como uma linha só, com rótulo destacado no meio da tabela, e são as que mais somem por serem lidas como título. Percorra a imagem inteira, de cima até depois do fim da tabela. ' +
    'A última linha com nomes em vermelho é a ORDEM DE LIBERAÇÃO do grupo: copie todos os nomes, na ordem exata, sem pular nenhum. Uma anotação final entre parênteses faz parte do mesmo slot e é preservada literalmente ("ANEST B (CONSULTORIO)" é uma entrada única entre os vizinhos; CONSULT/CONS./CONSULTORIO/CONSULTÓRIO indicam trabalho no Consultório, não ausência nem caso cirúrgico). Quem aparece nessa ordem normalmente tem casos ou uma posição entre parênteses; nome sem os dois merece uma segunda olhada.',
  materno:
    'Formato Materno/HC (G-HOSP "Mapa de cirurgias"): colunas Hora, Leito, Paciente, Cirurgião, Procedimento, ' +
    'Observação, Anestesia, Convênio, Sala, Aparelhos e Instrum-Circulante. Pediátrico. A coluna "Anestesia" contém a TÉCNICA (ex.: Geral), nunca o nome do anestesista. ' +
    'O responsável costuma vir numa anotação grande sobreposta em vermelho (ex.: ANEST A/ANEST B) à direita da tabela; use o alinhamento vertical e a Sala para aplicá-lo ao grupo correspondente. Se não houver nome anotado, deixe anestesista vazio — nunca devolva "Geral" como pessoa.',
}

const SYSTEM_PROMPT = `Você extrai a escala cirúrgica de uma imagem (print de tabela) e devolve o JSON do schema abaixo.

Escreva o JSON compacto, sem quebras de linha nem indentação: a escala vespertina cheia não cabe na resposta quando vem formatada e chega cortada no meio.
Omita os campos que ficariam vazios ("") ou false — quem lê preenche esse padrão sozinho. Exceção: "sala", "hora" e "anestesista" vão sempre, mesmo vazios, porque posicionam o caso.

Schema:
{
  "casos": [{
    "sala": string, "hora": string, "tempoEstimado": string,
    "pacienteIniciais": string, "pacienteNome": string, "idade": string, "procedimento": string, "convenio": string,
    "cirurgiao": string, "anestesista": string,
    "cor": ""|"vermelho"|"azul"|"amarelo"|"roxo",
    "bloco": "normal"|"srpa"|"imagem"|"hemodinamica"|"exames"|"iosc"|"ho"|"consultorio"|"accurata"|"umanita"|"materno"|"simone"|"ccoluna"|"mauricio",
    "tipo": "eletiva"|"urgencia"|"emergencia"
  }],
  "posicoesAssistenciais": [{ "local": string, "anestesista": string }],
  "rodape": [{ "nome": string, "cor": ""|"preto"|"vermelho"|"azul"|"amarelo"|"roxo" }],
  "dataDetectada": "YYYY-MM-DD"|"",
  "hospitalDetectado": "unimed"|"hro"|"materno"|""
}

REGRAS:
- pacienteIniciais: apenas as iniciais do paciente (ex.: "Maria Silva" -> "M.S."), nunca o nome completo. Sem paciente na linha, "".
- pacienteNome: SOMENTE quando o convênio do caso for PURAMENTE particular ("PARTICULAR", "Part", "Part.") E houver um paciente individual na linha — copie o nome COMPLETO como está na imagem (é usado para a cobrança do honorário). Convênio COMPOSTO/ambíguo (ex.: "PART/SC" — não dá para saber qual paciente é particular) e linhas de LOTE sem paciente individual ("04 FACECTOMIA (04 PCTES)"): "" — não extraia. Para TODOS os demais convênios, "" — nunca inclua o nome (LGPD).
- idade: idade do paciente quando houver (ex.: "37a" ou "9a"); senão "".
- tempoEstimado: tempo cirúrgico previsto quando houver (ex.: "01:15"); senão "".
- anestesista: copie EXATAMENTE a célula DA PRÓPRIA LINHA. Se a célula tem um SINAL DE REPETIÇÃO (//, aspas de repetição ", traço —, seta ↓, ou qualquer marca de "idem / mesmo de cima"), devolva o texto "//" — quem lê aplica o nome da linha ACIMA na mesma sala. Célula vazia ou ilegível: "". Não escreva um nome onde a imagem traz uma marca, e não deixe a célula vazia quando ela traz a marca: vazio e "//" são coisas diferentes, e trocar um pelo outro faz a cirurgia perder o anestesista. Nome de uma linha nunca se espalha para outra que tem nome próprio.
- Prefixo "PED"/"PED."/"Ped." antes do nome = um PEDIDO para aquele anestesista específico realizar o procedimento (ex.: "Ped. Janaína" = pedido para a Janaína). O anestesista é o nome que vem DEPOIS do prefixo — devolva SÓ o nome, sem o "Ped"/"Ped." (ex.: "Ped. Janaína" → anestesista "Janaína"). NÃO é marcador pediátrico e NÃO é o nome do procedimento.
- cor: a COR EM QUE O NOME DO ANESTESISTA está escrito naquela linha ("" quando é a cor normal do texto). A cor é dado, não enfeite: AZUL = anestesista da escala de OUTRO hospital ajudando aqui; AMARELO = a pessoa está escalada em DOIS locais no dia, de propósito (a marcação existe para avisá-la — mantenha o nome nas duas linhas, não é erro nem ambiguidade); VERMELHO = ordem de liberação; ROXO, no IOSC, é cirurgião. Informe a cor mesmo quando o nome também aparecer no rodapé.
- Dois anestesistas na mesma linha (a célula traz dois nomes — "RAQUEL E GABRIELA", "RAQUEL/GABRIELA", "RAQUEL + GABRIELA", um sobre o outro): os dois assumem aquele procedimento juntos. Devolva os dois no campo, separados por " + ", na ordem em que aparecem. Não escolha um e descarte o outro, e não duplique a linha em dois casos: é uma cirurgia só, com dois responsáveis.
- tipo: "emergencia"/"urgencia" se a linha indicar EMERGENCIA/URGENCIA; senão "eletiva".
- bloco: classifique pela seção da imagem (SRPA, EXAMES, IMAGEM, HEMO->hemodinamica, IOSC, etc.); senão "normal". Use "materno" SOMENTE quando a imagem for do próprio hospital Materno — seções C.O/cesárea de OUTROS hospitais são bloco "normal".
- rodape: os anestesistas do rodapé NA ORDEM em que aparecem (esquerda para direita), cada um com a sua cor. O rodapé costuma ser a ÚLTIMA linha da imagem, com os nomes em VERMELHO; o primeiro nome é o plantonista. Sem rodapé, [].
- Em rodape, preserve cada entrada e sua posição literalmente. "NOME (LOCAL)" é UMA pessoa/slot: não remova a nota, não divida por vírgula interna, não ordene e não deduplique. Notas começando por CONS (CONS, CONS., CONSULT, CONSULTORIO, CONSULTÓRIO) indicam posição ativa no Consultório. Nome do rodapé escrito em AZUL: cor "azul" — quem lê entende como ajuda de outro hospital.
- dataDetectada: data impressa no título/cabeçalho da escala, convertida para YYYY-MM-DD (ex.: 03/08/2026 → 2026-08-03); se não estiver legível, "".
- posicoesAssistenciais: alocações de trabalho sem cirurgia individual (ex.: "SRPA ANEST A"). Preserve o local e o anestesista, mas NÃO as coloque em casos. Títulos e rodapés sem uma pessoa alocada não entram em lugar nenhum.
- Campos ausentes: "" (string) ou false (boolean).
- hospitalDetectado: classifique o LAYOUT da imagem (assinaturas confirmadas pelo grupo):
  "hro" = planilha Excel COLORIDA (células amarelas/destacadas), colunas Leito/Paciente/Cirurgião/Procedimento/ANEST/Conv./Sala, rodapé de nomes em VERMELHO separados por "/";
  "unimed" = grade BRANCA larga com colunas SALA/PACIENTE/IDADE/PROCEDIMENTO/TEMPO/CIRURGIÃO/CONVENIO/ANEST e seções "CO - CESAREA"/"CENTRO CIRÚRGICO - SALA N";
  "materno" = relatório de sistema (G-HOSP) com título "Mapa de cirurgias", colunas Hora/Leito/Paciente/Cirurgião/Procedimento/Observação/Anestesia/Convênio/Sala.
  Se não tiver certeza, "".`

// ── SEÇÕES DE TURNO (2026-08-22) ────────────────────────────────────────────
// body { secoesTurno: true }: acrescenta ao prompt normal a leitura da FAIXA
// "MATUTINO"/"VESPERTINO" que divide o mapa em dois blocos, devolvendo o turno
// POR CASO. Existe porque o turno saía só da HORA, e as linhas "AS" (a seguir)
// não têm hora: elas herdavam o período selecionado no anexo, então um mapa só
// nunca produzia manhã e tarde corretas — era preciso anexá-lo duas vezes.
//
// ⚠️ SÓ o fluxo de FIM DE SEMANA envia a flag. No dia útil as escalas chegam em
// turnos separados, em horas diferentes, e a organização de lá não muda (dono
// 2026-08-22) — sem a flag o prompt é literalmente a mesma string de antes.
const SECOES_TURNO_REGRA = `

TURNO DE CADA CASO (a imagem traz o dia inteiro):
- Acrescente ao schema de cada caso o campo "turno": "matutino"|"vespertino"|"".
- O mapa é dividido por FAIXAS DE TÍTULO com os dizeres MATUTINO e VESPERTINO (costumam vir destacadas em amarelo, ocupando a largura da tabela). Toda linha ABAIXO de uma faixa pertence àquele turno, até a faixa seguinte.
- Vale a POSIÇÃO na tabela, nunca a hora: linhas com "AS", "A SEGUIR", célula de hora vazia ou ilegível recebem o turno da faixa em que estão. É justamente essa linha sem hora que a faixa existe para classificar.
- Sem nenhuma faixa visível na imagem, devolva "" — quem lê decide pelo período escolhido.
`


// ── MODO FDS (2026-08-15) ────────────────────────────────────────────────────
// body { modo: 'fds' }: o upload alimenta a fila de liberação ÚNICA. Pode ser o
// documento de FDS (grade P1–P4 + listas numeradas) ou a lista simples de um
// FERIADO. Zero dado de paciente nestes documentos.
// LGPD/decisão do dono 15/08: as linhas do bloco "PLANTÃO MATERNO" com datas
// (ex.: "15/08 – RENATA") são FUNCIONÁRIAS com escala própria — NUNCA viram
// posição/plantão/lista; vão para `ignorados` (informativo da conferência).
const FDS_SYSTEM_PROMPT = `Você extrai um documento de fila única da Escala Cirúrgica: "ESCALA DE FINAL DE SEMANA" OU uma lista simples com título "FERIADO". Devolva SOMENTE JSON válido, sem texto antes/depois. Escreva o JSON COMPACTO (sem indentação).

Schema:
{
  "dias": [{
    "data": "YYYY-MM-DD",
    "plantoes": { "P1": string, "P2": string, "P3": string, "P4": string },
    "grade": {
      "7-13":  { "unimed": string, "hro": string, "ret1": string, "ret2": string },
      "13-19": { "unimed": string, "hro": string, "ret1": string, "ret2": string },
      "19-07": { "unimed": string, "hro": string, "ret1": string, "ret2": string }
    },
    "listas": { "matutino": [{ "n": number, "nome": string }], "vespertino": [{ "n": number, "nome": string }] },
    "ordemLiberacaoDoc": { "matutino": string[], "vespertino": string[] },
    "listaFeriado": string[]
  }],
  "ignorados": string[]
}

REGRAS:
- FERIADO: quando o título trouxer "FERIADO" e uma LISTA SIMPLES DE NOMES, devolva UM item em "dias", com a data de referência informada e os nomes em "listaFeriado" EXATAMENTE na ordem visual de cima para baixo. Não numere, não ordene e não deduplique. Nesse formato, devolva plantoes/grade/listas/ordemLiberacaoDoc vazios. A mesma lista servirá manhã e tarde; o app aplica os sentidos opostos.
- FIM DE SEMANA: quando houver grade P1–P4, o documento cobre SÁBADO e DOMINGO; devolva um item em "dias" para cada dia com tabela própria e listaFeriado: [].
- GRADE: cada dia tem uma tabela de 3 faixas de horário (7-13HS, 13-19HS, 19-07HS) por 4 colunas. Coluna 1 = UNIMED, coluna 2 = HRO (os cabeçalhos existem); colunas 3 e 4 = retaguarda (ret1, ret2). Copie o NOME de cada célula SEM o rótulo P1–P4 (ex.: célula "P1 GUILHERME DIDOMENICO" → "GUILHERME DIDOMENICO").
- plantoes: os rótulos P1–P4 aparecem colados aos nomes na linha 7-13HS (normalmente só no sábado). Associe cada Pn ao nome daquela célula. Dia sem rótulos → {} (o app herda do sábado; os MESMOS 4 rodam a grade o fim de semana inteiro).
- listas: as linhas numeradas ("5º GABRIELA 6º ERLEI 7º MARILIO ...") são a lista de escalação do PERÍODO, NA ORDEM em que os itens aparecem (a ordem importa — "6º ERLEI 5º GABRIELA" é diferente de "5º GABRIELA 6º ERLEI"). A lista geral do dia = matutino; a linha prefixada "SÁBADO A TARDE"/"À TARDE" = vespertino (sem linha própria da tarde, repita a da manhã). Uma linha "EMERGENCIA: 11º GABRIEL" acrescenta { "n": 11, "nome": "GABRIEL" } ao FIM das listas dos DOIS períodos do dia (sem duplicar se já estiver).
- ordemLiberacaoDoc: as linhas "Ordem do primeiro ao último a ser liberado: P4, P3, P12, P09, ..." — copie os códigos EXATAMENTE como estão, na ordem (aceite zeros à esquerda como "P09"). "SÁBADO MATUTINO" → matutino do sábado; "SÁBADO VESPERTINO" → vespertino. Turno sem essa linha → [].
- PLANTÃO MATERNO / funcionárias: linhas do bloco "PLANTÃO MATERNO" com data e nome (ex.: "15/08 – RENATA", "16/08 – ELISETE") são FUNCIONÁRIAS com escala própria — NUNCA as coloque em plantoes/grade/listas; devolva o texto literal de cada uma em "ignorados". Exceção: entrada "Nº NOME" (ex.: "11º GABRIEL") é anestesista numerado — pertence às listas do dia, não a ignorados.
- Não existe dado de paciente neste documento; não extraia nenhum.
- data: os títulos ("SÁBADO – 15 DE AGOSTO") podem vir sem ano — use as datas de referência informadas na mensagem para converter para YYYY-MM-DD.
- Campos ausentes: "" / [] / {}.`

// Sanitização do modo FDS — espelha as regras do prompt (defesa em profundidade).
const FAIXAS_FDS = ['7-13', '13-19', '19-07'] as const
function sanitizeFds(parsed: Record<string, unknown>): { dias: unknown[]; ignorados: string[] } {
  const str = (v: unknown, max = 100) => String(v ?? '').trim().slice(0, max)
  const ignorados = (Array.isArray(parsed?.ignorados) ? parsed.ignorados : [])
    .map((s: unknown) => str(s, 160)).filter(Boolean).slice(0, 20)
  // nomes que aparecem em linhas ignoradas COM data (dd/mm) = funcionárias;
  // se a leitura os tiver espalhado para listas/grade, caem aqui também
  const nomesFuncionarias = new Set<string>()
  for (const linha of ignorados) {
    if (!/\d{1,2}\/\d{1,2}/.test(linha)) continue
    for (const tok of linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]+/)) {
      if (tok.length >= 4 && !['PLANTAO', 'MATERNO'].includes(tok)) nomesFuncionarias.add(tok)
    }
  }
  const ehFuncionaria = (nome: string) =>
    nomesFuncionarias.has(nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim())
  const dias: unknown[] = []
  for (const d of (Array.isArray(parsed?.dias) ? parsed.dias : []).slice(0, 4) as Record<string, unknown>[]) {
    const data = str(d?.data, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue
    const plantoes: Record<string, string> = {}
    for (const [k, v] of Object.entries((d?.plantoes as Record<string, unknown>) || {})) {
      const pn = String(k).trim().toUpperCase()
      if (/^P\d{1,2}$/.test(pn) && str(v) && !ehFuncionaria(str(v))) plantoes[pn] = str(v)
    }
    const grade: Record<string, Record<string, string>> = {}
    for (const faixa of FAIXAS_FDS) {
      const l = ((d?.grade as Record<string, unknown>)?.[faixa] as Record<string, unknown>) || {}
      grade[faixa] = {
        unimed: str(l?.unimed), hro: str(l?.hro), ret1: str(l?.ret1), ret2: str(l?.ret2),
      }
    }
    const listas: Record<string, { n: number; nome: string }[]> = { matutino: [], vespertino: [] }
    for (const turno of ['matutino', 'vespertino'] as const) {
      const arr = ((d?.listas as Record<string, unknown>)?.[turno] as unknown[]) || []
      for (const item of (Array.isArray(arr) ? arr : []).slice(0, 20) as Record<string, unknown>[]) {
        const n = Number(item?.n)
        const nome = str(item?.nome)
        if (!Number.isInteger(n) || n < 1 || n > 30 || !nome) continue
        if (ehFuncionaria(nome)) continue // funcionária NUNCA vira posição
        listas[turno].push({ n, nome })
      }
    }
    const ordemLiberacaoDoc: Record<string, string[]> = { matutino: [], vespertino: [] }
    for (const turno of ['matutino', 'vespertino'] as const) {
      const arr = ((d?.ordemLiberacaoDoc as Record<string, unknown>)?.[turno] as unknown[]) || []
      ordemLiberacaoDoc[turno] = (Array.isArray(arr) ? arr : [])
        .map((s: unknown) => str(s, 40)).filter(Boolean).slice(0, 30)
    }
    const listaFeriado = (Array.isArray(d?.listaFeriado) ? d.listaFeriado : [])
      .map((s: unknown) => str(s, 100)).filter(Boolean).slice(0, 40)
    dias.push({ data, plantoes, grade, listas, ordemLiberacaoDoc, listaFeriado })
  }
  return { dias, ignorados }
}

// Teto de saída. Era 8000 e a escala VESPERTINA não cabia: os logs de 06/08
// mostram TODA invocação terminando em ~68s (o tempo de gerar exatamente 8000
// tokens) e o JSON chegando cortado no meio de um caso — `JSON.parse` estourava
// `Expected ',' or ']' ... at position 14742` e a tela dizia "tente um print mais
// nítido", culpando a imagem por um limite nosso. Quando o corte calhava de cair
// logo depois de um `}`, o parse PASSAVA e a escala publicava sem os últimos
// casos — o modo de falha silencioso, pior que o erro.
const MAX_TOKENS = 32000

/**
 * Lê o SSE da Anthropic e devolve o texto inteiro + o motivo da parada.
 *
 * Streaming não é enfeite: acima de ~16k `max_tokens` a chamada não-streaming
 * arrisca estourar o timeout de HTTP antes da primeira resposta, e aqui a
 * conexão precisa continuar recebendo bytes para o gateway não derrubar a
 * função no meio de uma escala grande.
 */
// ── STRUCTURED OUTPUT (2026-09-07, Onda 4 item 4.2) ──────────────────────────
// `output_config.format` com json_schema: a resposta chega como JSON válido que
// casa com o schema, por construção. Acaba a classe inteira de falha "o modelo
// escreveu algo antes do JSON", "a regex gulosa pegou a chave errada" e "veio um
// bloco que não existe no enum" — 06/08 foi um JSON cortado que o parse
// derrubou, e o modo silencioso (corte logo depois de um `}`) publicava a escala
// sem os últimos casos.
//
// ⚠️ O QUE O SCHEMA **NÃO** GARANTE: `pattern` NÃO é suportado em json_schema
// (conferido na doc oficial em 07/09 — a proposta da auditoria usava `pattern`
// em iniciais e hora). Ou seja, "01 EDA" continua cabendo num campo de string.
// Quem garante o conteúdo é `_shared/escala-normalizacao.ts`, aplicada logo
// depois do parse. O schema cuida da forma; a normalização, do valor.
//
// ⚠️ O NÚMERO DE CAMPOS OPCIONAIS É ORÇAMENTO, e foi medido na marra.
// Com `additionalProperties: false`, cada propriedade OPCIONAL multiplica a
// gramática: ela precisa aceitar toda combinação e toda ordem dos campos
// presentes. Com 19 propriedades e 3 obrigatórias, a API recusou com 400
// "Schema is too complex" (não eram os enums — tirar todos não resolveu).
// Declarar TODAS obrigatórias compila, mas obriga o modelo a escrever "" e
// false em cada campo de cada caso: medido, a saída pulou de 2.027 para 5.015
// tokens e o custo por leitura foi de $0,09 para $0,14 — a saída é a parcela
// cara ($25/MTok contra $5 da entrada). Isso quebraria a regra do dono de 03/09.
// A saída é DERIVAR em vez de perguntar. Saíram do contrato:
//   `isContinuacao`  → o procedimento diz "CONTINUAÇÃO";
//   `semAnestesista` → a célula do anestesista traz "?";
//   `foraDoRoster`   → é o resultado de casar o nome com o roster, não uma
//                      opinião do modelo (some junto o `nomeLido`, que era só o
//                      lugar onde ele guardaria o mesmo texto duas vezes);
//   `secao`          → o `bloco` já carrega a mesma informação, e o cliente já
//                      corrige a sala a partir dele (`normalizarSalaHro`).
// Sobram 14 propriedades com 3 obrigatórias — o mesmo tamanho que compilava
// antes da cor entrar, agora com `cor` e `repeticao` dentro do orçamento.
const SCHEMA_CASO_PROPS: Record<string, unknown> = {
  sala: { type: 'string' },
  hora: { type: 'string' },
  tempoEstimado: { type: 'string' },
  pacienteIniciais: { type: 'string' },
  pacienteNome: { type: 'string' },
  idade: { type: 'string' },
  procedimento: { type: 'string' },
  convenio: { type: 'string' },
  cirurgiao: { type: 'string' },
  anestesista: { type: 'string' },
  bloco: {
    type: 'string',
    enum: ['normal', 'srpa', 'imagem', 'hemodinamica', 'exames', 'iosc', 'ho',
      'consultorio', 'accurata', 'umanita', 'materno', 'simone', 'ccoluna', 'mauricio'],
  },
  tipo: { type: 'string', enum: ['eletiva', 'urgencia', 'emergencia'] },
  // ── Cor como DADO (item 4.3) ──────────────────────────────────────────────
  // A cor do mapa é a informação: azul = ajuda de outro hospital, amarelo = a
  // pessoa está em DOIS locais de propósito, vermelho = ordem de liberação.
  // Até aqui ela só existia como instrução no prompt e nunca voltava.
  cor: { type: 'string', enum: ['', 'vermelho', 'azul', 'amarelo', 'roxo'] },
}

function schemaEscala(comTurno: boolean): Record<string, unknown> {
  const props = { ...SCHEMA_CASO_PROPS }
  if (comTurno) props.turno = { type: 'string', enum: ['', 'matutino', 'vespertino'] }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['casos', 'rodape', 'hospitalDetectado'],
    properties: {
      casos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          // ⚠️ `cor` É OBRIGATÓRIA, e isso foi medido: com ela OPCIONAL o
          // modelo simplesmente parava de olhar a cor — a mesma foto do HRO que
          // devolvia a ajuda em azul passou a devolver `ajudaExterna: []` e
          // nenhum caso com cor. Campo opcional que exige OLHAR a imagem de
          // novo é campo que não é preenchido. Custa ~4 tokens por caso.
          required: ['sala', 'hora', 'anestesista', 'cor'],
          properties: props,
        },
      },
      posicoesAssistenciais: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['local', 'anestesista'],
          properties: { local: { type: 'string' }, anestesista: { type: 'string' } },
        },
      },
      // O rodapé vem com a COR de cada nome; `ordemLiberacao` e `ajudaExterna`
      // passam a ser DERIVADOS na edge, no mesmo formato que o cliente já
      // consome. De quebra o nome de quem ajuda deixa de ser escrito duas vezes.
      rodape: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['nome', 'cor'],
          properties: {
            nome: { type: 'string' },
            cor: { type: 'string', enum: ['', 'vermelho', 'azul', 'amarelo', 'roxo'] },
          },
        },
      },
      dataDetectada: { type: 'string' },
      hospitalDetectado: { type: 'string', enum: ['unimed', 'hro', 'materno', ''] },
    },
  }
}

const SCHEMA_FDS: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['dias'],
  properties: {
    dias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['data'],
        properties: {
          data: { type: 'string' },
          plantoes: {
            type: 'object',
            additionalProperties: false,
            properties: {
              P1: { type: 'string' }, P2: { type: 'string' },
              P3: { type: 'string' }, P4: { type: 'string' },
            },
          },
          grade: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(['7-13', '13-19', '19-07'].map((f) => [f, {
              type: 'object',
              additionalProperties: false,
              properties: {
                unimed: { type: 'string' }, hro: { type: 'string' },
                ret1: { type: 'string' }, ret2: { type: 'string' },
              },
            }])),
          },
          listas: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(['matutino', 'vespertino'].map((t) => [t, {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['n', 'nome'],
                properties: { n: { type: 'integer' }, nome: { type: 'string' } },
              },
            }])),
          },
          ordemLiberacaoDoc: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(['matutino', 'vespertino'].map((t) =>
              [t, { type: 'array', items: { type: 'string' } }])),
          },
          listaFeriado: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    ignorados: { type: 'array', items: { type: 'string' } },
  },
}

// Enums aceitos pela tabela escala_cirurgica_caso — sanitiza p/ não violar o CHECK no insert.
const BLOCOS = new Set(['normal', 'srpa', 'imagem', 'hemodinamica', 'exames', 'iosc', 'ho', 'consultorio', 'accurata', 'umanita', 'materno', 'simone', 'ccoluna', 'mauricio'])
const TIPOS = new Set(['eletiva', 'urgencia', 'emergencia'])

const TURNOS_CASO = new Set(['matutino', 'vespertino'])

function sanitizeCasos(raw: unknown, comTurno = false): unknown[] {
  if (!Array.isArray(raw)) return []
  const str = (v: unknown) => String(v ?? '').trim()
  return raw.map((c: Record<string, unknown>, i: number) => {
    const bloco = String(c?.bloco ?? 'normal').toLowerCase()
    const tipo = String(c?.tipo ?? 'eletiva').toLowerCase()
    // Nome completo SÓ em particular PURO (defesa em profundidade além do
    // prompt): usado p/ pré-preencher a cobrança; nunca gravado na escala
    // (CASO_FIELDS do service não envia + CHECK do banco rejeita).
    // Composto ("PART/SC") é ambíguo → NÃO extrai (regra do dono 2026-07-22).
    // Espelho do fn_convenio_particular/familiaConvenio.
    const particular = /^PART(ICULAR)?[^A-Z]*$/.test(str(c?.convenio).toUpperCase())
    return {
      sala: str(c?.sala),
      ordem: Number.isFinite(Number(c?.ordem)) ? Number(c?.ordem) : i,
      hora: str(c?.hora),
      tempoEstimado: str(c?.tempo ?? c?.tempoEstimado),
      pacienteIniciais: str(c?.pacienteIniciais).slice(0, 12), // só iniciais (LGPD)
      pacienteNome: particular ? str(c?.pacienteNome).slice(0, 120) : '',
      idade: str(c?.idade).slice(0, 10),
      procedimento: str(c?.procedimento),
      convenio: str(c?.convenio),
      cirurgiao: str(c?.cirurgiao),
      anestesista: str(c?.anestesista),
      bloco: BLOCOS.has(bloco) ? bloco : 'normal',
      // DERIVADOS, não perguntados (o schema tem orçamento de campos opcionais
      // e cada pergunta a mais custa saída): o prompt já dizia que
      // `isContinuacao` é o procedimento "CONTINUAÇÃO" e que `semAnestesista` é
      // a célula com "?" — as duas coisas dão para ler do que já veio.
      isContinuacao: c?.isContinuacao === true
        || /CONTINUA[ÇC][ÃA]O/i.test(str(c?.procedimento).normalize('NFC')),
      semAnestesista: c?.semAnestesista === true || str(c?.anestesista) === '?',
      tipo: TIPOS.has(tipo) ? tipo : 'eletiva',
      // '' = a imagem não trouxe faixa de turno; quem lê decide pelo período
      // escolhido. Fora deste modo o campo nem aparece na resposta.
      ...(comTurno ? { turno: TURNOS_CASO.has(String(c?.turno ?? '')) ? String(c?.turno) : '' } : {}),
    }
  }).filter((c: Record<string, unknown>) => [
    c.pacienteIniciais, c.pacienteNome, c.procedimento, c.cirurgiao, c.convenio,
  ].some((v) => String(v ?? '').trim()))
}

function sanitizePosicoes(raw: unknown): { local: string; anestesista: string }[] {
  if (!Array.isArray(raw)) return []
  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  const out: { local: string; anestesista: string }[] = []
  const vistos = new Set<string>()
  for (const p of raw as Record<string, unknown>[]) {
    const local = str(p?.local, 80)
    const anestesista = str(p?.anestesista, 100)
    if (!local || !anestesista) continue
    const chave = `${local.toUpperCase()}|${anestesista.toUpperCase()}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push({ local, anestesista })
  }
  return out.slice(0, 30)
}

// O guardrail anti-alucinação e a derivação do rodapé colorido vivem em
// `_shared/escala-cor.ts` (item 4.3): a mudança que importa é que AZUL em
// qualquer lugar é ajuda, e o guardrail deixa de apagar quem veio azul — era ele
// que fazia a Unimed publicar sem ajuda nenhuma quando o anestesista azul estava
// no bloco Exames, e não no rodapé (incidente 30/07).

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Auth interna: quem chama fica registrado (uid) e anônimo não queima crédito.
  const auth = await verifyAuthHeader(req.headers.get('authorization'))
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: 'unauthorized', reason: auth.reason }), {
      status: auth.status, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  console.log(`[parse-escala-cirurgica] parse solicitado por uid=${auth.uid}`)

  try {
    const { imageBase64, mimeType, hospital, modo, refSabado, refDomingo, refFeriado, secoesTurno, roster } = await req.json()
    const modoFds = modo === 'fds'
    // turno por FAIXA do documento — só o fluxo de fim de semana pede (ver
    // SECOES_TURNO_REGRA). No modo FDS o documento não tem casos.
    const comSecoesTurno = secoesTurno === true && !modoFds
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 ausente' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const mime = String(mimeType || 'image/jpeg').toLowerCase()
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      return new Response(JSON.stringify({ error: 'mimeType de imagem não suportado' }), {
        status: 415, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // Base64 cresce ~4/3. O app já reduz no cliente; este limite protege a Edge
    // contra chamadas diretas que tentem consumir memória/créditos em excesso.
    if (String(imageBase64).length > 20_000_000) {
      return new Response(JSON.stringify({ error: 'imagem excede o limite de tamanho' }), {
        status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Telemetria por leitura (item 4.1) ────────────────────────────────────
    // Medida antes de qualquer chamada: hash da foto (identidade da mesma foto
    // reenviada), dimensões e peso. `registrar` é disparado sem await em TODA
    // saída daqui para baixo — inclusive nas de erro, que são as que mais
    // interessam. Telemetria nunca atrasa nem derruba a leitura.
    const t0 = Date.now()
    const imagemHash = await hashImagem(imageBase64)
    const dim = dimensoesDeBase64(imageBase64)
    const contexto = {
      uid: auth.uid,
      modo: modoFds ? 'fds' : 'dia-util',
      hospital_hint: String(hospital || ''),
      imagem_hash: imagemHash,
      imagem_mime: mime,
      imagem_largura: dim?.largura ?? null,
      imagem_altura: dim?.altura ?? null,
      imagem_bytes: bytesDeBase64(imageBase64),
      modelo: MODELO,
      prompt_versao: PROMPT_VERSAO,
    }
    // COM await: o isolate morre junto com a resposta, e um insert disparado e
    // não aguardado se perde no meio — foi assim que sumiram as linhas das
    // leituras que falharam, justo as que mais interessam.
    const registrar = (extra: Record<string, unknown>) => registrarLeitura(montarLinhaLog({
      ...contexto, latencia_ms: Date.now() - t0, ...extra,
    }))

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      // Mesmo caminho da chave recusada: é problema de configuração, e a tela
      // precisa dizer "avise o administrador" em vez de "tente de novo".
      await registrar({ erro: 'sem_api_key' })
      return new Response(JSON.stringify({
        error: 'ia_falhou',
        iaStatus: 401,
        iaTipo: 'authentication_error',
        iaMensagem: 'ANTHROPIC_API_KEY não configurado',
        ...(modoFds ? { dias: [], ignorados: [] } : { casos: [], ordemLiberacao: [] }),
      }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ⚠️ SEM HOSPITAL DECLARADO, VÃO OS TRÊS (dono 31/08, auditoria).
    // O lote de dia útil lê cada arquivo SEM hint — o hospital é justamente o
    // que ele quer descobrir (27/08) —, e com isso a leitura passou a rodar sem
    // NENHUMA das regras por hospital acumuladas desde 24/07: as seções-clínicas
    // do HRO, a herança do "//", os rótulos de sala, os blocos do rodapé da
    // Unimed. Elas existiam e simplesmente não chegavam ao modelo pelo caminho
    // que virou o padrão em 27/08. Mandar os três conjuntos custa ~700 tokens por
    // leitura e devolve todas elas; escolher QUAL aplicar é a mesma decisão que o
    // modelo já toma para preencher `hospitalDetectado`.
    const hint = HOSPITAL_HINT[hospital]
      || `Descubra primeiro de qual hospital é o layout (mesmo critério de hospitalDetectado) e aplique só as regras dele, ignorando as dos outros dois:\n`
        + Object.entries(HOSPITAL_HINT).map(([h, t]) => `• SE FOR ${h.toUpperCase()}: ${t}`).join('\n')

    // ── ROSTER COMO VOCABULÁRIO (item 4.7) ──────────────────────────────────
    // A lista de nomes do grupo vai junto da imagem. É o que ataca na ORIGEM o
    // "GUILHERME M ELO" (o kerning parte o sobrenome) e o nome inventado onde a
    // célula traz uma marca de repetição — até aqui isso só era corrigido lá na
    // frente, pelo dicionário de apelidos da conferência.
    // A válvula `foraDoRoster` existe porque quem ajuda vindo de outro hospital
    // pode legitimamente não estar na lista: forçar o nome dele para o mais
    // parecido do grupo trocaria a pessoa, que é erro pior.
    const rosterNomes = prepararRoster(roster)
    const blocoRoster = rosterNomes.length
      ? `\n\nANESTESISTAS DO GRUPO (vocabulário da coluna do anestesista e do rodapé):\n${rosterNomes.join(' · ')}\n`
        + 'Use exatamente um destes nomes quando o que você leu for um deles, mesmo que a imagem traga abreviação, acento faltando ou um espaço no meio do sobrenome. '
        + 'Se o nome lido claramente NÃO é nenhum deles (costuma ser alguém de outro hospital ajudando), copie o texto como está na imagem, em vez de escolher o parecido da lista.'
      : ''

    // ── SYSTEM CACHEADO (item 4.4) ──────────────────────────────────────────
    // As dicas de hospital saem do user message e sobem para o system, ANTES da
    // imagem: no user, depois da imagem, elas nunca seriam prefixo cacheável.
    // O bloco inteiro (~9k tokens) vai com `cache_control` de 5 min, e as
    // leituras chegam em rajada — os 3 arquivos do lote em ~1 minuto. Da 2ª em
    // diante a entrada custa 0,1×, e é esse desconto que paga a saída maior do
    // schema. O `ttl` de 1h custaria 2× na escrita e não pagaria entre turnos.
    const systemTexto = modoFds
      ? FDS_SYSTEM_PROMPT
      : (comSecoesTurno ? SYSTEM_PROMPT + SECOES_TURNO_REGRA : SYSTEM_PROMPT)
        + `\n\nREGRAS DO HOSPITAL\n${hint}${blocoRoster}`
    const system = [{
      type: 'text',
      text: systemTexto,
      cache_control: { type: 'ephemeral' },
    }]

    // datas de referência do FDS (o título "SÁBADO – 15 DE AGOSTO" vem sem ano)
    const iso = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '')
    const refs = [iso(refSabado) && `sábado = ${iso(refSabado)}`, iso(refDomingo) && `domingo = ${iso(refDomingo)}`, iso(refFeriado) && `feriado = ${iso(refFeriado)}`]
      .filter(Boolean).join(', ')
    const userText = modoFds
      ? `Extraia o documento de fila única (fim de semana ou feriado) desta imagem.${refs ? ` Datas de referência: ${refs}.` : ''}`
      : 'Extraia a escala desta imagem.'
    // ── CACHE DE 24 H POR HASH DA FOTO (item 4.9) ───────────────────────────
    // Reanexar a mesma foto pagava a leitura de novo, e o fluxo reenvia por
    // desenho: "reler com hint", depois de resolver "de qual hospital é?", manda
    // exatamente a mesma imagem. A chave inclui a versão do prompt, então subir
    // uma edição nova invalida tudo sozinho.
    const chave = await chaveCache({
      imagemHash, hospital, modo,
      promptVersao: PROMPT_VERSAO, vocabulario: rosterNomes, secoesTurno: comSecoesTurno,
    })
    const guardado = await lerCache(chave)
    if (guardado) {
      console.log('[parse-escala-cirurgica] servido do cache de 24h')
      await registrar({
        origem: 'cache',
        hospital_detectado: String(guardado.hospitalDetectado || ''),
        casos: Array.isArray(guardado.casos) ? guardado.casos.length : 0,
        rodape: Array.isArray(guardado.ordemLiberacao) ? guardado.ordemLiberacao.length : 0,
        ajuda: Array.isArray(guardado.ajudaExterna) ? guardado.ajudaExterna.length : 0,
      })
      return new Response(JSON.stringify(guardado), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const corpoRequisicao = {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        stream: true,
        // JSON válido por construção; o conteúdo dos campos ainda passa pela
        // normalização determinística logo abaixo (`pattern` não existe aqui).
        output_config: {
          format: {
            type: 'json_schema',
            schema: modoFds ? SCHEMA_FDS : schemaEscala(comSecoesTurno),
          },
        },
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        }],
      }),
    }
    // Retry 1x em 429/529/5xx: um 529 (sobrecarga) virava "tente de novo" na
    // tela da secretária, às 22h, com o mapa na mão — quando a resposta certa
    // era esperar dois segundos.
    let { res, tentativas } = await fetchComRetry('https://api.anthropic.com/v1/messages', corpoRequisicao)

    // ── O SCHEMA NUNCA DERRUBA A LEITURA ────────────────────────────────────
    // O limite de complexidade do json_schema não é documentado em número: é o
    // orçamento de propriedades opcionais, e ele foi descoberto batendo nele
    // (400 "Schema is too complex"). Um campo novo acrescentado no futuro pode
    // reencontrá-lo — e aí TODA leitura falharia, à noite, com a secretária
    // esperando. Aqui a recusa do schema vira degradação: repete a mesma
    // chamada sem `output_config` e segue pelo caminho antigo (o prompt continua
    // pedindo JSON e o parse tolerante continua no lugar). O aviso fica na
    // telemetria em vez de virar um incidente.
    let semSchema = false
    if (!res.ok && res.status === 400) {
      const corpo400 = await res.clone().text()
      if (/schema/i.test(corpo400)) {
        console.error('[parse-escala-cirurgica] schema recusado — repetindo sem structured output:', corpo400.slice(0, 200))
        const semFormato = { ...corpoRequisicao }
        const body = JSON.parse(String(corpoRequisicao.body))
        delete body.output_config
        semFormato.body = JSON.stringify(body)
        const r2 = await fetchComRetry('https://api.anthropic.com/v1/messages', semFormato)
        res = r2.res
        tentativas += r2.tentativas
        semSchema = true
      }
    }

    if (!res.ok) {
      const detail = await res.text()
      console.error('[parse-escala-cirurgica] Anthropic error:', detail)
      // 200 com o MOTIVO, como já se faz com `extracao_truncada` logo abaixo: o
      // corpo de uma resposta não-2xx não chega ao app por `functions.invoke`,
      // então o 502 virava um erro sem texto e a tela pedia "tente de novo"
      // mesmo quando o problema era a conta da IA — foi assim que a foto da
      // escala foi reenviada oito vezes em 18/08, com a chave sem crédito desde
      // a véspera. A classificação e os textos vivem em
      // src/lib/escalaVisionFalha.js; aqui só se repassa o que a Anthropic disse.
      let iaTipo = ''
      let iaMensagem = detail
      try {
        const corpo = JSON.parse(detail)
        iaTipo = String(corpo?.error?.type || '')
        iaMensagem = String(corpo?.error?.message || detail)
      } catch { /* corpo não-JSON: segue como veio */ }
      await registrar({
        erro: `ia_falhou:${res.status}:${iaTipo}${tentativas > 1 ? ':retry' : ''}`,
        stop_reason: 'http_error',
      })
      return new Response(JSON.stringify({
        error: 'ia_falhou',
        iaStatus: res.status,
        iaTipo,
        iaMensagem: iaMensagem.slice(0, 300),
        ...(modoFds ? { dias: [], ignorados: [] } : { casos: [], ordemLiberacao: [] }),
      }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { texto, stopReason, uso } = await lerRespostaStream(res)
    // ⚠️ STREAM CORTADO NO MEIO É LEITURA INCOMPLETA, mesmo que o JSON feche.
    // Um SSE completo SEMPRE termina com `message_delta` trazendo `stop_reason`;
    // sem ele, a conexão caiu. Medido em 08/09: duas fotos voltaram cortadas aos
    // 29s, e numa delas o JSON parcial PARSEOU — 20 casos e rodapé VAZIO
    // entregues como se fossem a escala inteira. É o mesmo modo de falha
    // silencioso de 06/08 (corte logo depois de um `}`), por outra porta: ali
    // era o teto de tokens, aqui é a conexão. `truncado` passa a cobrir os dois,
    // e a tela já sabe dizer "a leitura foi cortada".
    const incompleta = ehLeituraIncompleta(stopReason)
    if (!stopReason) {
      console.error(`[parse-escala-cirurgica] stream terminou SEM stop_reason — leitura incompleta (${uso.output_tokens} tokens de saída)`)
    }
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) {
      await registrar({ ...uso, stop_reason: stopReason, erro: 'sem_json' })
      return new Response(JSON.stringify(
        modoFds
          ? { error: 'Resposta sem JSON', dias: [], ignorados: [] }
          : { error: 'Resposta sem JSON', casos: [], ordemLiberacao: [] }
      ), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // Corte por teto de tokens é uma condição ESPERADA de escala grande, não um
    // bug — devolve 200 com um motivo que a tela sabe explicar, em vez de deixar
    // o JSON.parse estourar num 500 genérico que a UI traduz como "imagem ruim".
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error(`[parse-escala-cirurgica] JSON inválido (stop_reason=${stopReason}):`, e)
      await registrar({
        ...uso, stop_reason: stopReason,
        erro: incompleta ? 'extracao_truncada' : 'json_invalido',
      })
      return new Response(JSON.stringify({
        error: incompleta ? 'extracao_truncada' : 'json_invalido',
        motivo: stopReason,
        ...(modoFds ? { dias: [], ignorados: [] } : { casos: [], ordemLiberacao: [] }),
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    // MODO FDS: resposta própria (dias/ignorados) — nada do caminho de casos.
    if (modoFds) {
      const fds = sanitizeFds(parsed)
      const respostaFds = { ...fds, truncado: incompleta }
      await registrar({ ...uso, stop_reason: stopReason, casos: fds.dias.length })
      // o documento de FDS não tem dado de paciente nenhum, e é o que mais se
      // reanexa (sábado e domingo saem do mesmo arquivo)
      if (!respostaFds.truncado) await gravarCache(chave, respostaFds, { modo: 'fds', promptVersao: PROMPT_VERSAO })
      return new Response(JSON.stringify(respostaFds), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (incompleta) {
      // O JSON até fechou, mas a geração foi interrompida: faltam casos no fim.
      // Publicar isso em silêncio foi o que fez a escala sair sem as últimas
      // linhas — melhor entregar o que veio, marcado como incompleto.
      console.error(`[parse-escala-cirurgica] extração incompleta (stop_reason=${stopReason || 'ausente'})`)
    }
    // Rodapé COLORIDO (item 4.3), aceitando também o contrato antigo.
    const rodape = lerRodape(parsed)
    // sanitizeCasos garante os ENUMS e a regra de LGPD do pacienteNome;
    // normalizarCasos garante a FORMA do valor (iniciais que passam no CHECK,
    // hora em HH:MM, ordem pela posição, sem linha repetida) — é o que o schema
    // não consegue prometer, porque `pattern` não existe em json_schema;
    // aplicarCorNosCasos traduz `repeticao` de volta para o "//" que a
    // conferência sabe herdar e deixa a `secao` corrigir um `bloco` genérico.
    const { casos: casosComRoster, contagem: contagemRoster } = resolverRoster(
      aplicarCorNosCasos(sanitizeCasos(parsed.casos, comSecoesTurno) as Record<string, unknown>[]),
      rosterNomes,
    )
    const { casos: casosNormalizados, contagem: contagemForma } = normalizarCasos(casosComRoster)
    const contagem = { ...contagemForma, ...contagemRoster }
    if (semSchema) contagem.semSchema = 1
    // AZUL EM QUALQUER LUGAR É AJUDA: o azul do corpo (bloco Exames da Unimed)
    // entra na ajuda mesmo sem estar no rodapé, e por isso deixa de ser apagado
    // pelo guardrail — era o que fazia a Unimed publicar sem ajuda (30/07).
    const { ordemLiberacao, ajudaExterna } = derivarRodape(rodape, casosNormalizados)
    const { casos, apagados } = blanquearForaDoRodape(casosNormalizados, ordemLiberacao, ajudaExterna)
    if (apagados) {
      console.log(`[parse-escala-cirurgica] guardrail: ${apagados} anestesista(s) ausente(s) do rodapé apagado(s) (provável alucinação)`)
      contagem.foraDoRodape = apagados
    }
    const hospitalDetectado = ['unimed', 'hro', 'materno'].includes(String(parsed.hospitalDetectado || ''))
      ? String(parsed.hospitalDetectado)
      : ''
    await registrar({
      ...uso,
      stop_reason: stopReason,
      hospital_detectado: hospitalDetectado,
      casos: casos.length,
      rodape: ordemLiberacao.length,
      ajuda: ajudaExterna.length,
      normalizacoes: contagem,
    })
    const resposta = {
      casos,
      posicoesAssistenciais: sanitizePosicoes(parsed.posicoesAssistenciais),
      ordemLiberacao,
      ajudaExterna,
      dataDetectada: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.dataDetectada || ''))
        ? String(parsed.dataDetectada)
        : '',
      // Sugestão de hospital pelo layout (a UI pede confirmação — nunca troca sozinha)
      hospitalDetectado,
      // A tela avisa em vez de deixar a secretária descobrir na hora da liberação
      truncado: incompleta,
    }
    // Guarda a resposta JÁ SANITIZADA (nunca a imagem). Leitura truncada não
    // entra: servir 24h de uma escala incompleta esconderia justamente o
    // problema que `truncado` existe para mostrar. `gravarCache` também recusa
    // sozinho qualquer leitura com nome completo de paciente (LGPD).
    if (!resposta.truncado) {
      await gravarCache(chave, resposta, { modo: modoFds ? 'fds' : 'dia-util', promptVersao: PROMPT_VERSAO })
    }
    return new Response(JSON.stringify(resposta), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[parse-escala-cirurgica] erro:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
