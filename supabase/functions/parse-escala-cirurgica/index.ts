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
    'No rodapé há uma linha com os anestesistas na ORDEM DE LIBERAÇÃO.',
  hro:
    'Formato HRO: colunas Leito, Paciente, Cirurgião, Procedimento, ANEST, Conv., Sala. "//" = mesmo anestesista acima. ' +
    'Rodapé com anestesistas na ordem de liberação. REGRAS DE SALA (nunca deixe sala vazia — use o rótulo da seção): ' +
    'salas numéricas = "Sala N"; seção "BLOCO M" = "Bloco M - Sala N"; linha só com "CO" = "Sala 7 - CO" (bloco normal — o CO do HRO NÃO é materno, nunca use bloco materno aqui); ' +
    'linha só com "EMERGENCIA" = "Sala 5 - Emergência"; "HEMO" = "Hemodinâmica" (bloco hemodinamica); "EXAMES" = "Exames" (bloco exames); ' +
    '"BRAQUI" = "Braquiterapia" (bloco normal); "CONSULT." = "Consultório" (bloco consultorio); "IMAGEM" = "Imagem" (bloco imagem). ' +
    'A escala inclui OUTROS HOSPITAIS que fazem parte dela — extraia TODAS essas seções como casos também, com o cirurgião quando houver (nomes em ROXO são cirurgiões): ' +
    '"IOSC" = sala "IOSC" (bloco iosc); "HO" = sala "Hospital de Olhos" (bloco ho); "DIGIMAX" = sala "Digimax" (bloco normal); ' +
    '"CENTRO DE COLUNA"/"C. COLUNA" = sala "Centro de Coluna" (bloco ccoluna); "AMBULATORIAL" = sala "Ambulatorial" (bloco normal). ' +
    'NESSAS seções (IOSC/HO/Digimax/etc.) cada LINHA tem o seu PRÓPRIO anestesista — copie o da linha; NUNCA atribua o mesmo anestesista a todas as linhas da seção (erro real 23/07: as 3 linhas do IOSC saíram para um só e dois anestesistas SUMIRAM da escala); linha sem anestesista visível fica "". ' +
    'A ÚLTIMA linha com nomes em VERMELHO é a ORDEM DE LIBERAÇÃO do grupo — copie TODOS os nomes, na ordem exata, sem pular nenhum: essa ordem é sagrada. Consistência: quem aparece nessa ordem normalmente TEM casos na escala — se um nome da ordem ficou sem nenhum caso, revise a seção correspondente antes de responder.',
  materno:
    'Formato Materno/HC (G-HOSP "Mapa de cirurgias"): colunas Hora, Leito, Paciente, Cirurgião, Procedimento, ' +
    'Observação, Anestesia, Convênio, Sala. O anestesista costuma aparecer destacado na coluna Sala. Pediátrico.',
}

const SYSTEM_PROMPT = `Você extrai a escala cirúrgica de uma imagem (print de tabela) e devolve SOMENTE JSON válido, sem texto antes/depois.

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
  "ordemLiberacao": string[],
  "ajudaExterna": string[],
  "hospitalDetectado": "unimed"|"hro"|"materno"|""
}

REGRAS:
- pacienteIniciais: APENAS as iniciais do paciente (ex.: "Maria Silva" -> "M.S."). NUNCA o nome completo. Se não houver paciente, "".
- pacienteNome: SOMENTE quando o convênio do caso for PURAMENTE particular ("PARTICULAR", "Part", "Part.") E houver um paciente individual na linha — copie o nome COMPLETO como está na imagem (é usado para a cobrança do honorário). Convênio COMPOSTO/ambíguo (ex.: "PART/SC" — não dá para saber qual paciente é particular) e linhas de LOTE sem paciente individual ("04 FACECTOMIA (04 PCTES)"): "" — não extraia. Para TODOS os demais convênios, "" — nunca inclua o nome (LGPD).
- idade: idade do paciente quando houver (ex.: "37a" ou "9a"); senão "".
- tempoEstimado: tempo cirúrgico previsto quando houver (ex.: "01:15"); senão "".
- anestesista: copie EXATAMENTE a célula DA PRÓPRIA LINHA, inclusive "//" (significa "mesmo da linha acima") e "PED Nome". NUNCA espalhe o nome de uma linha para outras que têm nome próprio, e NUNCA atribua anestesista que a imagem não mostra naquela linha — na dúvida, "" (célula vazia).
- Nome de anestesista DESTACADO EM AMARELO: significa que ele está intencionalmente escalado em DOIS locais no dia (a marcação existe para avisá-lo) — mantenha o nome nas duas linhas normalmente; não é erro nem ambiguidade.
- ordem: índice sequencial do caso dentro da sala (0,1,2...).
- isContinuacao: true se o procedimento for "CONTINUAÇÃO".
- semAnestesista: true se a coluna do anestesista for "?".
- tipo: "emergencia"/"urgencia" se a linha indicar EMERGENCIA/URGENCIA; senão "eletiva".
- bloco: classifique pela seção da imagem (SRPA, EXAMES, IMAGEM, HEMO->hemodinamica, IOSC, etc.); senão "normal". Use "materno" SOMENTE quando a imagem for do próprio hospital Materno — seções C.O/cesárea de OUTROS hospitais são bloco "normal".
- ordemLiberacao: lista de anestesistas do rodapé NA ORDEM em que aparecem (esquerda para direita). O rodapé costuma ser a ÚLTIMA linha da imagem, com os nomes em VERMELHO; o primeiro nome é o plantonista. Se não houver rodapé, [].
- ajudaExterna: nomes do rodapé escritos em AZUL (anestesistas da escala de OUTRO hospital ajudando neste dia). Liste-os TAMBÉM em ordemLiberacao na posição em que aparecem. Se nenhum nome estiver em azul, [].
- Campos ausentes: "" (string) ou false (boolean).
- hospitalDetectado: classifique o LAYOUT da imagem (assinaturas confirmadas pelo grupo):
  "hro" = planilha Excel COLORIDA (células amarelas/destacadas), colunas Leito/Paciente/Cirurgião/Procedimento/ANEST/Conv./Sala, rodapé de nomes em VERMELHO separados por "/";
  "unimed" = grade BRANCA larga com colunas SALA/PACIENTE/IDADE/PROCEDIMENTO/TEMPO/CIRURGIÃO/CONVENIO/ANEST e seções "CO - CESAREA"/"CENTRO CIRÚRGICO - SALA N";
  "materno" = relatório de sistema (G-HOSP) com título "Mapa de cirurgias", colunas Hora/Leito/Paciente/Cirurgião/Procedimento/Observação/Anestesia/Convênio/Sala.
  Se não tiver certeza, "".`

// Enums aceitos pela tabela escala_cirurgica_caso — sanitiza p/ não violar o CHECK no insert.
const BLOCOS = new Set(['normal', 'srpa', 'imagem', 'hemodinamica', 'exames', 'iosc', 'ho', 'consultorio', 'accurata', 'umanita', 'materno', 'simone', 'ccoluna', 'mauricio'])
const TIPOS = new Set(['eletiva', 'urgencia', 'emergencia'])

function sanitizeCasos(raw: unknown): unknown[] {
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
    }
  })
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
    const { imageBase64, mimeType, hospital } = await req.json()
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 ausente' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurado' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const hint = HOSPITAL_HINT[hospital] || ''
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: `Extraia a escala desta imagem. ${hint}\nResponda SOMENTE o JSON.` },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[parse-escala-cirurgica] Anthropic error:', detail)
      return new Response(JSON.stringify({ error: 'Falha na extração (Anthropic)' }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const texto = (data.content || []).map((b: { text?: string }) => b.text || '').join('')
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Resposta sem JSON', casos: [], ordemLiberacao: [] }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const parsed = JSON.parse(match[0])
    return new Response(JSON.stringify({
      casos: sanitizeCasos(parsed.casos),
      ordemLiberacao: Array.isArray(parsed.ordemLiberacao)
        ? parsed.ordemLiberacao.map((s: unknown) => String(s || '').trim()).filter(Boolean)
        : [],
      ajudaExterna: Array.isArray(parsed.ajudaExterna)
        ? parsed.ajudaExterna.map((s: unknown) => String(s || '').trim()).filter(Boolean)
        : [],
      // Sugestão de hospital pelo layout (a UI pede confirmação — nunca troca sozinha)
      hospitalDetectado: ['unimed', 'hro', 'materno'].includes(String(parsed.hospitalDetectado || ''))
        ? String(parsed.hospitalDetectado)
        : '',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[parse-escala-cirurgica] erro:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
