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
    'As seções C.O (CESAREA/SALA N) são o centro obstétrico DA PRÓPRIA UNIMED: bloco "normal" — NUNCA "materno" (materno é OUTRO hospital; marcar materno aqui é erro recorrente já corrigido 2x em produção). ' +
    'Blocos no rodapé: SRPA, EXAMES, IMAGEM, CONSULTORIO, UMANITÁ, ACCURATA. Nesses blocos cada LINHA tem seu PRÓPRIO anestesista na coluna ANEST — copie o da própria linha; NUNCA repita o anestesista da primeira linha nas seguintes (erro real 23/07: 3 linhas de EXAMES saíram todas com o mesmo nome). ' +
    'No rodapé há uma linha com os anestesistas na ORDEM DE LIBERAÇÃO. "SRPA ANEST A" é uma POSIÇÃO ASSISTENCIAL: não entra em casos; devolva em posicoesAssistenciais para manter local, colega trabalhando e ordem de liberação.',
  hro:
    'Formato HRO: colunas Leito, Paciente, Cirurgião, Procedimento, ANEST, Conv., Sala. "//" = mesmo anestesista acima. ' +
    'Rodapé com anestesistas na ordem de liberação. REGRAS DE SALA (nunca deixe sala vazia — use o rótulo da seção): ' +
    'salas numéricas (seção BLOCO A) = "Sala N" — só o número, sem o bloco e sem o papel da sala; seção "BLOCO M" = "Bloco M - Sala N" (aqui o bloco FICA: é o que separa a sala 1 do materno da sala 1 do bloco A); ' +
    'linha só com "CO" = "Sala 7" (o CO do HRO é a sala 7 — bloco normal, o CO do HRO NÃO é materno, nunca use bloco materno aqui); ' +
    'linha só com "EMERGENCIA" = "Sala 5"; "HEMO" = "Hemodinâmica" (bloco hemodinamica); "EXAMES" = "Exames" (bloco exames); ' +
    '"BRAQUI" = "Braquiterapia" (bloco normal); "CONSULT." = "Consultório" (bloco consultorio); "IMAGEM" = "Imagem" (bloco imagem). ' +
    '⚠️ COLUNA LEITO = SEÇÕES: um rótulo na coluna Leito (BLOCO A, HEMO, BRAQUI, EXAMES, IOSC, HO, DIGIMAX, C. COLUNA...) inicia uma SEÇÃO que vale para TODAS as linhas abaixo dele até o PRÓXIMO rótulo de Leito — mesmo quando o título da seção está na MESMA COR das linhas de baixo (o IOSC costuma vir em ROXO, igual aos procedimentos). Delimite a seção pela POSIÇÃO na coluna Leito, NUNCA pela cor. ' +
    'A escala inclui OUTROS HOSPITAIS que fazem parte dela — extraia TODAS essas seções como casos também, com o cirurgião quando houver (nomes em ROXO são cirurgiões): ' +
    '"IOSC" = bloco iosc; "HO" = bloco ho (Hospital de Olhos); "DIGIMAX" = bloco normal; "CENTRO DE COLUNA"/"C. COLUNA" = bloco ccoluna; "AMBULATORIAL" = bloco normal. ' +
    '⚠️ SALA dessas seções = SÓ O NOME DA SEÇÃO, sem número interno: TODA linha do IOSC → sala "IOSC"; HO → "Hospital de Olhos"; Digimax → "Digimax"; Centro de Coluna → "Centro de Coluna". IGNORE o "SALA 1"/"SALA 2" que aparecer na coluna Sala dessas seções (é a sala interna da clínica — não usamos). NUNCA devolva "Sala 1"/"Sala 2" para uma linha do IOSC/HO/Digimax: cairia junto da sala homônima do HRO e misturaria os anestesistas (erro real 24/07). Todas as linhas de uma seção compartilham a MESMA sala (ex.: "IOSC"), na ordem em que aparecem; cada linha mantém seu próprio anestesista (o board agrupa por anestesista dentro da seção). ' +
    'NESSAS seções (IOSC/HO/Digimax/etc.) cada LINHA tem o seu PRÓPRIO anestesista — copie o da linha; NUNCA atribua o mesmo anestesista a todas as linhas da seção (erro real 23/07: as 3 linhas do IOSC saíram para um só e dois anestesistas SUMIRAM da escala); linha sem anestesista visível fica "". ' +
    'A ÚLTIMA linha com nomes em VERMELHO é a ORDEM DE LIBERAÇÃO do grupo — copie TODOS os nomes, na ordem exata, sem pular nenhum: essa ordem é sagrada. Uma anotação final entre parênteses faz parte do MESMO slot e deve ser preservada literalmente (ex.: "ANEST B (CONSULTORIO)" continua uma única entrada entre os vizinhos; CONSULT/CONS./CONSULTORIO/CONSULTÓRIO indicam trabalho no Consultório, não ausência nem caso cirúrgico). Consistência: quem aparece nessa ordem normalmente TEM casos ou uma posição indicada entre parênteses — se um nome ficou sem ambos, revise antes de responder.',
  materno:
    'Formato Materno/HC (G-HOSP "Mapa de cirurgias"): colunas Hora, Leito, Paciente, Cirurgião, Procedimento, ' +
    'Observação, Anestesia, Convênio, Sala, Aparelhos e Instrum-Circulante. Pediátrico. A coluna "Anestesia" contém a TÉCNICA (ex.: Geral), nunca o nome do anestesista. ' +
    'O responsável costuma vir numa anotação grande sobreposta em vermelho (ex.: ANEST A/ANEST B) à direita da tabela; use o alinhamento vertical e a Sala para aplicá-lo ao grupo correspondente. Se não houver nome anotado, deixe anestesista vazio — nunca devolva "Geral" como pessoa.',
}

const SYSTEM_PROMPT = `Você extrai a escala cirúrgica de uma imagem (print de tabela) e devolve SOMENTE JSON válido, sem texto antes/depois.

Escreva o JSON COMPACTO — sem quebras de linha e sem indentação entre os campos. A escala vespertina cheia não cabe na resposta quando o JSON vem formatado, e aí ela chega cortada no meio (a extração se perde inteira). O conteúdo extraído é o mesmo; só a formatação muda.
Omita os campos que ficariam vazios ("") ou false — quem lê preenche esse padrão sozinho. Exceção: "sala", "ordem" e "anestesista" vão SEMPRE, mesmo vazios, porque posicionam o caso.

Schema:
{
  "casos": [{
    "sala": string, "ordem": number, "hora": string, "tempoEstimado": string,
    "pacienteIniciais": string, "pacienteNome": string, "idade": string, "procedimento": string, "convenio": string,
    "cirurgiao": string, "anestesista": string,
    "bloco": "normal"|"srpa"|"imagem"|"hemodinamica"|"exames"|"iosc"|"ho"|"consultorio"|"accurata"|"umanita"|"materno"|"simone"|"ccoluna"|"mauricio",
    "isContinuacao": boolean, "semAnestesista": boolean,
    "tipo": "eletiva"|"urgencia"|"emergencia"
  }],
  "posicoesAssistenciais": [{ "local": string, "anestesista": string }],
  "ordemLiberacao": string[],
  "ajudaExterna": string[],
  "dataDetectada": "YYYY-MM-DD"|"",
  "hospitalDetectado": "unimed"|"hro"|"materno"|""
}

REGRAS:
- pacienteIniciais: APENAS as iniciais do paciente (ex.: "Maria Silva" -> "M.S."). NUNCA o nome completo. Se não houver paciente, "".
- pacienteNome: SOMENTE quando o convênio do caso for PURAMENTE particular ("PARTICULAR", "Part", "Part.") E houver um paciente individual na linha — copie o nome COMPLETO como está na imagem (é usado para a cobrança do honorário). Convênio COMPOSTO/ambíguo (ex.: "PART/SC" — não dá para saber qual paciente é particular) e linhas de LOTE sem paciente individual ("04 FACECTOMIA (04 PCTES)"): "" — não extraia. Para TODOS os demais convênios, "" — nunca inclua o nome (LGPD).
- idade: idade do paciente quando houver (ex.: "37a" ou "9a"); senão "".
- tempoEstimado: tempo cirúrgico previsto quando houver (ex.: "01:15"); senão "".
- anestesista: copie EXATAMENTE a célula DA PRÓPRIA LINHA. Se a célula tem um SINAL DE REPETIÇÃO (//, aspas de repetição ", traço —, seta ↓, ou qualquer marca de "idem / mesmo de cima"), devolva "//" (= mesmo anestesista da linha ACIMA na mesma sala). ⚠️ NUNCA CHUTE nem invente um nome quando a célula tem sinal de repetição, está vazia ou ilegível — devolva "//" (se for repetição) ou "" (se vazia); inventar um nome (ex.: ler "//" como "Tiago") é o pior erro possível. NUNCA espalhe o nome de uma linha para outras que têm nome próprio.
- Prefixo "PED"/"PED."/"Ped." antes do nome = um PEDIDO para aquele anestesista específico realizar o procedimento (ex.: "Ped. Janaína" = pedido para a Janaína). O anestesista é o nome que vem DEPOIS do prefixo — devolva SÓ o nome, sem o "Ped"/"Ped." (ex.: "Ped. Janaína" → anestesista "Janaína"). NÃO é marcador pediátrico e NÃO é o nome do procedimento.
- Nome de anestesista DESTACADO EM AMARELO: significa que ele está intencionalmente escalado em DOIS locais no dia (a marcação existe para avisá-lo) — mantenha o nome nas duas linhas normalmente; não é erro nem ambiguidade.
- DOIS ANESTESISTAS NA MESMA LINHA (a célula traz dois nomes — "RAQUEL E GABRIELA", "RAQUEL/GABRIELA", "RAQUEL + GABRIELA", um sobre o outro): os dois assumem AQUELE procedimento juntos. Devolva os dois no campo, separados por " + " (ex.: "RAQUEL + GABRIELA"), na ordem em que aparecem. NUNCA escolha um e descarte o outro, e NUNCA duplique a linha em dois casos — é uma cirurgia só, com dois responsáveis.
- ordem: índice sequencial do caso dentro da sala (0,1,2...).
- isContinuacao: true se o procedimento for "CONTINUAÇÃO".
- semAnestesista: true se a coluna do anestesista for "?".
- tipo: "emergencia"/"urgencia" se a linha indicar EMERGENCIA/URGENCIA; senão "eletiva".
- bloco: classifique pela seção da imagem (SRPA, EXAMES, IMAGEM, HEMO->hemodinamica, IOSC, etc.); senão "normal". Use "materno" SOMENTE quando a imagem for do próprio hospital Materno — seções C.O/cesárea de OUTROS hospitais são bloco "normal".
- ordemLiberacao: lista de anestesistas do rodapé NA ORDEM em que aparecem (esquerda para direita). O rodapé costuma ser a ÚLTIMA linha da imagem, com os nomes em VERMELHO; o primeiro nome é o plantonista. Se não houver rodapé, [].
- Em ordemLiberacao, preserve cada entrada e sua posição literalmente. "NOME (LOCAL)" é UMA pessoa/slot: não remova a nota, não divida por vírgula interna, não ordene e não deduplique. Notas começando por CONS (CONS, CONS., CONSULT, CONSULTORIO, CONSULTÓRIO) indicam posição ativa no Consultório.
- ajudaExterna: nomes do rodapé escritos em AZUL (anestesistas da escala de OUTRO hospital ajudando neste dia). Liste-os TAMBÉM em ordemLiberacao na posição em que aparecem. Se nenhum nome estiver em azul, [].
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
async function lerRespostaStream(res: Response): Promise<{ texto: string; stopReason: string }> {
  let texto = ''
  let stopReason = ''
  let buffer = ''
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    // eventos SSE são separados por linha em branco; guarda o resto parcial
    const partes = buffer.split('\n')
    buffer = partes.pop() || ''
    for (const linha of partes) {
      if (!linha.startsWith('data:')) continue
      const payload = linha.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let ev: Record<string, unknown>
      try { ev = JSON.parse(payload) } catch { continue }
      if (ev.type === 'content_block_delta') {
        const d = ev.delta as { type?: string; text?: string } | undefined
        if (d?.type === 'text_delta') texto += d.text || ''
      } else if (ev.type === 'message_delta') {
        const d = ev.delta as { stop_reason?: string } | undefined
        if (d?.stop_reason) stopReason = d.stop_reason
      }
    }
  }
  return { texto, stopReason }
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
      isContinuacao: c?.isContinuacao === true,
      semAnestesista: c?.semAnestesista === true,
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

// Primeiro nome NORMALIZADO (sem acento, maiúsculo, sem prefixo Ped) — chave de
// comparação com o rodapé. "JOAO H." e "JOAO HENRIQUE" colapsam em "JOAO".
function primeiroNomeNorm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/^\s*ped[.\s]+/i, '')                    // tira prefixo Ped
    .trim().toUpperCase()
    .split(/\s+/)[0] || ''
}

// GUARDRAIL anti-alucinação: o rodapé (ordem de liberação + ajuda) lista TODOS os
// anestesistas do dia — é a fonte autoritativa. Um caso com anestesista que NÃO
// aparece no rodapé é quase sempre um nome inventado pela leitura (ex.: "//" lido
// como "Tiago" — erro recorrente 07/2026). Apaga o nome (vira "sem anestesista",
// visível p/ o plantonista cobrir) em vez de deixar um nome errado — pior erro.
// Só roda quando há rodapé (senão não há como validar). "//" e "" são preservados.
function blankAnestesistasForaDoRodape(
  casos: Record<string, unknown>[], ordem: string[], ajuda: string[],
): Record<string, unknown>[] {
  const rodape = new Set([...ordem, ...ajuda].map(primeiroNomeNorm).filter(Boolean))
  if (rodape.size === 0) return casos
  let apagados = 0
  const out = casos.map((c) => {
    const a = String(c?.anestesista ?? '').trim()
    if (!a || a === '//') return c
    if (rodape.has(primeiroNomeNorm(a))) return c
    apagados++
    // flag junto com o texto apagado: '' sem semAnestesista herda o vizinho de
    // sala na conferência (nomesImportados) e o caso era absorvido em silêncio —
    // o oposto do que este guardrail promete ("visível p/ o plantonista cobrir")
    return { ...c, anestesista: '', semAnestesista: true }
  })
  if (apagados) console.log(`[parse-escala-cirurgica] guardrail: ${apagados} anestesista(s) ausente(s) do rodapé apagado(s) (provável alucinação)`)
  return out
}

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
    const { imageBase64, mimeType, hospital, modo, refSabado, refDomingo, refFeriado, secoesTurno } = await req.json()
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

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      // Mesmo caminho da chave recusada: é problema de configuração, e a tela
      // precisa dizer "avise o administrador" em vez de "tente de novo".
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

    const hint = HOSPITAL_HINT[hospital] || ''
    // datas de referência do FDS (o título "SÁBADO – 15 DE AGOSTO" vem sem ano)
    const iso = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '')
    const refs = [iso(refSabado) && `sábado = ${iso(refSabado)}`, iso(refDomingo) && `domingo = ${iso(refDomingo)}`, iso(refFeriado) && `feriado = ${iso(refFeriado)}`]
      .filter(Boolean).join(', ')
    const userText = modoFds
      ? `Extraia o documento de fila única (fim de semana ou feriado) desta imagem.${refs ? ` Datas de referência: ${refs}.` : ''}\nResponda SOMENTE o JSON.`
      : `Extraia a escala desta imagem. ${hint}\nResponda SOMENTE o JSON.`
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: MAX_TOKENS,
        stream: true,
        system: modoFds
          ? FDS_SYSTEM_PROMPT
          : (comSecoesTurno ? SYSTEM_PROMPT + SECOES_TURNO_REGRA : SYSTEM_PROMPT),
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        }],
      }),
    })

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

    const { texto, stopReason } = await lerRespostaStream(res)
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) {
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
      return new Response(JSON.stringify({
        error: stopReason === 'max_tokens' ? 'extracao_truncada' : 'json_invalido',
        motivo: stopReason,
        ...(modoFds ? { dias: [], ignorados: [] } : { casos: [], ordemLiberacao: [] }),
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    // MODO FDS: resposta própria (dias/ignorados) — nada do caminho de casos.
    if (modoFds) {
      const fds = sanitizeFds(parsed)
      return new Response(JSON.stringify({ ...fds, truncado: stopReason === 'max_tokens' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (stopReason === 'max_tokens') {
      // O JSON até fechou, mas o modelo foi interrompido: faltam casos no fim.
      // Publicar isso em silêncio foi o que fez a escala sair sem as últimas
      // linhas — melhor entregar o que veio, marcado como incompleto.
      console.error('[parse-escala-cirurgica] extração truncada por max_tokens')
    }
    const ordemLiberacao = Array.isArray(parsed.ordemLiberacao)
      ? parsed.ordemLiberacao.map((s: unknown) => String(s || '').trim()).filter(Boolean)
      : []
    const ajudaExterna = Array.isArray(parsed.ajudaExterna)
      ? parsed.ajudaExterna.map((s: unknown) => String(s || '').trim()).filter(Boolean)
      : []
    return new Response(JSON.stringify({
      // guardrail: apaga anestesista ausente do rodapé (alucinação) — só quando há rodapé
      casos: blankAnestesistasForaDoRodape(sanitizeCasos(parsed.casos, comSecoesTurno) as Record<string, unknown>[], ordemLiberacao, ajudaExterna),
      posicoesAssistenciais: sanitizePosicoes(parsed.posicoesAssistenciais),
      ordemLiberacao,
      ajudaExterna,
      dataDetectada: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.dataDetectada || ''))
        ? String(parsed.dataDetectada)
        : '',
      // Sugestão de hospital pelo layout (a UI pede confirmação — nunca troca sozinha)
      hospitalDetectado: ['unimed', 'hro', 'materno'].includes(String(parsed.hospitalDetectado || ''))
        ? String(parsed.hospitalDetectado)
        : '',
      // A tela avisa em vez de deixar a secretária descobrir na hora da liberação
      truncado: stopReason === 'max_tokens',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[parse-escala-cirurgica] erro:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
