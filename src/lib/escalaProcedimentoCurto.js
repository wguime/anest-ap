/**
 * NOME CURTO DA CIRURGIA para a fila de Liberações (dono 14/09: "quero apenas um
 * nome para identificar a cirurgia — colecistectomia, RTU, prostatectomia").
 *
 * Dono 17/09, com fotos da fila: *"a descrição de alguns procedimentos está
 * incompleta, melhore a informação, quero que continue sendo direta"*. Os cinco
 * exemplos — "Cateterismo" (era angiografia), "Osso" (ressecção de osso do pé),
 * "RTU" duas vezes (próstata e bexiga), "Artrodese" (de coluna), "Procedimentos"
 * (02) — têm o mesmo defeito: o rótulo identificava a FAMÍLIA e não a cirurgia.
 * Onde um qualificador muda o que a pessoa vai fazer, ele entra no rótulo
 * ("RTU de próstata", "Artrodese cervical", "2 procedimentos"); a embalagem
 * continua fora. O fallback deixou de ficar com UMA palavra: mantém o verbo da
 * cirurgia ("Ressecção de osso do pé", "Retirada de pontos") e vai até 4 palavras
 * de conteúdo — uma palavra sozinha era exatamente o que virava "Osso".
 *
 * O texto do mapa é o descritivo da tabela ("COLECISTECTOMIA SEM COLANGIOGRAFIA
 * POR VIDEOLAPAROSCOPICA", "TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DO FÊMUR");
 * na fila ele precisa caber ao lado da hora, numa linha de 12,5px. Duas camadas:
 *
 *  1. DICIONÁRIO por família (regex sobre o texto sem acento), calibrado nos 400
 *     procedimentos distintos publicados entre 15/08 e 14/09/2026 — é ele que dá
 *     "RTU" para "RESSECCAO ENDOSCOPICA DA PROSTATA" e "Prostatectomia" para
 *     "PROSTATOVESICULECTOMIA RADICAL ROBOTICA", que nenhuma regra genérica daria.
 *  2. FALLBACK: tira o que é embalagem ("TRATAMENTO CIRÚRGICO DE", "- 3H", "(...)",
 *     "POR VIDEOLAPAROSCOPIA", "UNILATERAL") e fica com a cabeça da frase — uma
 *     palavra, ou duas quando a primeira é genérica ("Fratura do fêmur", "Tumor
 *     intracraniano").
 *
 * Dono 21/09, com recortes dos mapas: *"nos exames ou quando há mais de uma
 * cirurgia na mesma linha, quero que informe no card de liberações as quantidades,
 * assim como já é informado na escala completa"*. A linha CONTADA ("08 EDA + 02 COLO
 * (08 PCTES)", "05 FACO + 01 GLAUCOMA c/ bloqueio", "07 RM + 02 TC") deixa de virar o
 * nome da família ("Endoscopia", "FACO", "TC + RM") e sai item a item com a contagem
 * do mapa — "8 EDA + 2 COLO (8 pctes)", "5 FACO + 1 glaucoma", "7 RM + 2 TC". A
 * palavra é a do mapa (não se pluraliza "angioplastia" por conta própria); a sigla
 * de exame fica como está; "c/ SIGLA" fica porque diz que o mesmo paciente faz os
 * dois ("1 COLO c/ EDA"); "c/ tópica", "c/ bloqueio", duração e parênteses continuam
 * sendo embalagem. Linha sem contagem ("HÉRNIA DE DISCO + LAMINECTOMIA") não muda:
 * a primeira cirurgia segue identificando a linha (dono 14/09).
 *
 * Puro, sem acesso a nada. O texto completo continua no card da Completa e no
 * detalhe do caso — aqui é só o rótulo.
 */

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim()

/** Siglas que ficam em caixa alta no rótulo final. */
const SIGLAS = new Set(['EDA', 'RTU', 'LCA', 'LCP', 'TC', 'RM', 'FACO', 'DIU', 'AMIU', 'HIPEC', 'ESD', 'BMO', 'NPP', 'DVE', 'DVP', 'TAVI', 'CO',
  'QT', 'US', 'CPRE', 'PTGI', 'ATM', 'RN', 'UTI', 'HD', 'AV', 'CTI'])

/**
 * Dicionário por família — a ORDEM importa (a primeira que casa vence): as
 * específicas vêm antes das genéricas ("HEMORROIDECTOMIA" antes de qualquer
 * "…ECTOMIA" cair no fallback; "RTU" antes de "RESSECÇÃO"). O rótulo pode ser
 * uma função `(match, textoNormalizado) => string` quando o qualificador vem do
 * próprio texto (contagem, lado, segmento).
 */
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
/** Entre vários qualificadores possíveis, o que aparece PRIMEIRO no texto ("A + B" é a A). */
const primeiro = (s, pares) => {
  let melhor = null
  for (const [re, rotulo] of pares) {
    const i = s.search(re)
    if (i >= 0 && (melhor === null || i < melhor.i)) melhor = { i, rotulo }
  }
  return melhor ? melhor.rotulo : null
}
const contagem = (m) => parseInt(m[1], 10)

/** Siglas de exame que ficam como no mapa dentro de uma linha contada ("8 EDA + 2 COLO"). */
const SIGLAS_EXAME = new Set(['EDA', 'COLO', 'COLONO', 'RM', 'TC', 'FACO', 'US', 'CPRE', 'ESD', 'ECOEDA', 'RX', 'PET', 'RTU'])
/** "(08 PCTES)" no fim da linha de exames: quantos pacientes fazem os N exames. */
const PACIENTES = /\((\d+)\s*(?:PCTE?S?|PACIENTES?)\.?\)/

/** Primeira letra minúscula depois do número ("1 angioplastia"), a não ser que comece por sigla ("1 RTU de próstata"). */
const aposNumero = (rotulo) => {
  const [primeira] = rotulo.split(' ')
  return SIGLAS.has(norm(primeira)) || SIGLAS_EXAME.has(norm(primeira)) ? rotulo : rotulo.charAt(0).toLowerCase() + rotulo.slice(1)
}

/**
 * Linha CONTADA do mapa (dono 21/09): "08 EDA + 02 COLO (08 PCTES)" → "8 EDA + 2 COLO (8 pctes)".
 * Item a item, com a contagem do mapa e a palavra do mapa; a sigla de exame fica; "c/ SIGLA" fica
 * ("1 COLO c/ EDA" é um paciente fazendo os dois); "c/ tópica", "c/ bloqueio", "– 1H", "+-até 12h" e
 * qualquer outro parêntese são embalagem. O que não é sigla passa pelo dicionário/fallback
 * ("01 VITRECT." → "1 vitrectomia"). Devolve '' quando não sobra item — o chamador segue.
 */
function rotuloContado(bruto) {
  // trabalha no texto ORIGINAL (acentos preservados para o fallback); `norm` só decide
  const texto = String(bruto || '').normalize('NFC').replace(/\s+/g, ' ').trim()
  const mp = PACIENTES.exec(norm(texto))
  const pacientes = mp ? parseInt(mp[1], 10) : null
  let linha = texto.replace(/\s*\(.*?\)/g, '').replace(/\s*\(.*$/, '')
  // duração no fim: "– 1H", "- 4H30", "+-ATE 12H", "3H" colado
  // (espaço ANTES do traço: "ADENO-AMIGDALECTOMIA" e "FRATURA-LUXAÇÃO" não são cortes)
  linha = linha.replace(/\s+\+?\s*[-–]\s*.*$/, '').replace(/\s+\d+\s*H(\d+)?\b.*$/i, '')
  const itens = []
  for (const parte of linha.split(/\s*\+\s*/)) {
    const item = parte.trim()
    if (!item) continue
    const mc = /^(\d+)\s+(.+)$/.exec(item)
    const n = mc ? parseInt(mc[1], 10) : null
    let resto = (mc ? mc[2] : item).trim()
    // "C/ EDA" fica (mesmo paciente, dois exames); "C/ TOPICA", "S/ PROTESE", "P/ VIDEO" caem
    let com = ''
    const mcom = /^(.*?)\s*\b[CSP]\/\s*(.*)$/i.exec(resto)
    if (mcom) {
      resto = mcom[1].trim()
      const alvo = norm(mcom[2]).split(' ')[0].replace(/\.$/, '')
      if (alvo && SIGLAS_EXAME.has(alvo)) com = ` c/ ${alvo}`
    }
    resto = resto.replace(/\.$/, '')
    if (!resto) continue
    const chave = norm(resto)
    let rotulo
    if (SIGLAS_EXAME.has(chave) || SIGLAS.has(chave)) rotulo = chave
    else if (/^PROCEDIMENTOS?$/.test(chave)) rotulo = n === 1 ? 'Procedimento' : 'Procedimentos'
    else if (/^CESAR(EA|IANA)S?$/.test(chave)) rotulo = n === 1 ? 'Cesariana' : 'Cesarianas'
    else {
      rotulo = nomeCurtoProcedimento(resto)
      // a família engoliria o exame que o mapa nomeou: "01 BRONCOSCOPIA" é "1 broncoscopia", não "1 endoscopia"
      if (rotulo === 'Endoscopia' && !/\s/.test(resto)) rotulo = resto.toLowerCase()
    }
    if (!rotulo) continue
    itens.push((n == null ? rotulo : `${n} ${aposNumero(rotulo)}`) + com)
  }
  if (!itens.length) return ''
  return itens.join(' + ') + (pacientes != null ? ` (${pacientes} pctes)` : '')
}

const DICIONARIO = [
  // ── blocos e seções (fora da grade) ────────────────────────────────────
  [/\bCONTINUACAO\b/, 'Continuação'],
  [/\bCO\/EMERG\w*|\bEMERGENCIA\/CO\b/, 'CO / Emergência'],
  [/\bCONSULTORIO\b.*AJUDA/, 'Consultório (ajuda)'],
  [/\bCONSULTORIO\b|\bCONSULTAS?\b/, 'Consultório'],
  // linha CONTADA ("01 EDA", "08 EDA + 02 COLO (08 PCTES)", "07 RM + 02 TC"): as quantidades são a
  // informação (dono 21/09) — vem ANTES das famílias, senão "Endoscopia" engole a contagem
  [/^\d+\s+\S/, (m, s, bruto) => rotuloContado(bruto) || null],
  // CPRE é CPRE (dono 21/09, foto do card: "quando vier esse nome coloque apenas CPRE e não endoscopia")
  [/\bCPRE\b|\bCOLANGIOPANCREATOGRAFIA\b|\bCOLANGIO ?PANCREATO\w*/, 'CPRE'],
  [/\b(EDA|COLO|COLONO|RETOSSIG\w*|ENDOSCOPIA|ECOEDA|ESD|GASTROSTOMIA ENDOSCOPICA|BRONCOSCOP\w*|BRONCO|ECOBRONCO)\b/, 'Endoscopia'],
  [/\bTC\b.*\bRM\b|\bRM\b.*\bTC\b/, 'TC + RM'],
  [/\bRMN?\b|\bRESSONANCIA\b/, 'RM'],
  [/\bTC\b/, 'TC'],
  // vitrectomia antes da FACO: "01 VITRECT. C/FACO" é vitrectomia (com faco junto)
  [/\bVITRECT\w*/, 'Vitrectomia'],
  [/\bFACO\w*|FACECTOMIA|FACOEMULSIFICACAO/, 'FACO'],
  [/\bECO ?TRANSESOFAG\w*/, 'Eco transesofágico'],
  // "02 PROCEDIMENTOS" no mapa do HRO: a contagem É a informação (dono 17/09)
  [/^(\d+)\s+PROCEDIMENTOS?\b/, (m) => plural(contagem(m), 'procedimento', 'procedimentos')],
  [/\bPROCEDIMENTOS?\b$/, 'Procedimentos'],
  [/\bODONTO\w*|TRATAMENTO ODONTOLOGICO/, 'Odontologia'],
  [/(\d+)\s+CESAR(EA|IANA)S?\b/, (m) => plural(contagem(m), 'cesariana', 'cesarianas')],
  [/\bCESAR(EA|IANA|IA|A)S?\b|\bCASARIANA\b/, 'Cesariana'],
  [/\bPARTO\b/, 'Parto'],
  [/\bCURETAGEM\b|\bAMIU\b/, 'Curetagem'],
  // ── hemodinâmica / cardio ─────────────────────────────────────────────
  [/\bANGIOPLASTIA\b|\bANGIO\b/, 'Angioplastia'],
  [/\bSTENT\b/, (m, s) => {
    const vaso = primeiro(s, [[/\bCORONAR\w*/, 'coronário'], [/\bINTRACRANIAN\w*/, 'intracraniano'], [/\bCAROT\w*|\bSUPRA-?AORTIC\w*/, 'carotídeo'], [/\bILIAC\w*|\bFEMORAL\b|\bPOPLITE\w*/, 'periférico']])
    return vaso ? `Stent ${vaso}` : 'Stent'
  }],
  [/\bMARCAPASSO\b/, 'Marcapasso'],
  // "ANGIOGRAFIA POR CATETERISMO SELETIVO…" é angiografia, não o cateterismo cardíaco (dono 17/09)
  [/\bANGIOGRAFIA\b.*\bCATETERISMO\b/, 'Angiografia por cateterismo'],
  [/\bCATETERISMO\b|^CAT\.? CARD|^(\d+\s+)?CATE?\b/, 'Cateterismo'],
  [/\bABLACAO\b.*\bPROSTAT\w*/, 'Ablação prostática'],
  [/\bABLACAO\b.*\b(ARRITMIA|CATETER)\b/, 'Ablação de arritmia'],
  [/\bABLACAO\b/, 'Ablação'],
  [/\bANGIOGRAFIA\b/, 'Angiografia'],
  [/\bOCLUSAO PERCUTANEA\b/, 'Oclusão percutânea'],
  [/\bVALVAR\b/, 'Cirurgia valvar'],
  [/\bFISTULA AV\b|\bHEMODIALISE\b/, 'Fístula AV'],
  // ── urologia ───────────────────────────────────────────────────────────
  // próstata e bexiga são cirurgias diferentes com a mesma sigla (dono 17/09)
  [/(\bRTU\b|RESSECCAO ENDOSCOPICA).*\bPROSTATA\b|\bPROSTATA\b.*RESSECCAO ENDOSCOPICA/, 'RTU de próstata'],
  [/(\bRTU\b|RESSECCAO ENDOSCOPICA).*\b(VESICAL|BEXIGA)\b|\b(VESICAL|BEXIGA)\b.*RESSECCAO ENDOSCOPICA/, 'RTU de bexiga'],
  [/\bRTU\b|RESSECCAO ENDOSCOPICA/, 'RTU'],
  [/\bPROSTATOVESICULECTOMIA\b|\bPROSTATECTOMIA\b/, 'Prostatectomia'],
  [/\bBIOPSIAS? DE PROSTATA\b/, 'Biópsia de próstata'],
  [/\bURETER(O)?RRENOLITOTRIPSIA\b|\bURETEROLITOTRIPSIA\b|\bLITOTRIPSIA\b/, 'Ureterolitotripsia'],
  // DUPLO J: retirada × colocação é o que a pessoa vai fazer (dono 18/09: "retirada ou
  // colocação de duplo J?"); o mapa que diz só "DUPLO J" não tem de onde tirar o verbo
  [/\bRETIRADA\b.*\bDUPLO J\b/, 'Retirada de duplo J'],
  [/\b(COLOCACAO|INSTALACAO|IMPLANTE|PASSAGEM|INSERCAO)\b.*\bDUPLO J\b/, 'Colocação de duplo J'],
  [/\bTROCA\b.*\bDUPLO J\b/, 'Troca de duplo J'],
  [/\bDUPLO J\b|^JJ$/, 'Duplo J'],
  [/\bCISTOSCOPIA\b|\bURETEROSCOPIA\b/, 'Cistoscopia'],
  [/\bNEFRECTOMIA\b/, 'Nefrectomia'],
  [/\bPOSTECTOMIA\b/, 'Postectomia'],
  [/\bORQUIDOPEXIA\b/, 'Orquidopexia'],
  [/\bORQUIECTOMIA\b/, 'Orquiectomia'],
  [/\bHIDROCELE\b/, 'Hidrocele'],
  [/\bURETROPLASTIA\b/, 'Uretroplastia'],
  [/\bESTERELIZADORA MASCULINA\b|\bESTERILIZADORA MASCULINA\b|\bVASECTOMIA\b/, 'Vasectomia'],
  [/\bINCONTINENCIA URINARIA\b|\bSLING\b/, 'Sling'],
  // ── ginecologia / obstetrícia ──────────────────────────────────────────
  [/\bHISTERECTOMIA\b/, 'Histerectomia'],
  [/\bHISTEROSCOPIA\b/, 'Histeroscopia'],
  [/\bHISTEROSSALPINGO\w*/, 'Histerossalpingografia'],
  [/\bMIOMECTOMIA\b/, 'Miomectomia'],
  [/\bENDOMETRIOSE\b/, 'Endometriose'],
  [/\bCERCLAGEM\b/, 'Cerclagem'],
  [/\bAMPUTACAO CONICA\b|\bTRAQUELECTOMIA\b|\bCONIZACAO\b/, 'Conização'],
  [/\bOOFORECTOMIA\b|\bOOFOROPLASTIA\b/, 'Ooforectomia'],
  [/\bDIU\b/, 'DIU'],
  [/\bLAPAROTOMIA\b/, 'Laparotomia'],
  [/\bLAPAROSCOPIA GINECOLOGICA\b/, 'Laparoscopia ginecológica'],
  [/\bLAPAROSCOPIA\b$|^(\d+\s+)?LAPARO\b/, 'Laparoscopia'],
  [/\bCOLPOPLASTIA\b|\bPERINEOPLASTIA\b/, 'Colpoplastia'],
  [/\bNINFOPLASTIA\b|\bPEQUENOS LABIOS\b|^NINFO\b/, 'Ninfoplastia'],
  // ── geral / digestivo ──────────────────────────────────────────────────
  [/\bCOLECISTECTOMIA\b/, 'Colecistectomia'],
  [/\bAPENDICECTOMIA\b|^APE\b|\bAPENDICE\b|\bAPENDICITE\b/, 'Apendicectomia'],
  [/\bHEMORROIDECTOMIA\b|^HEMORROID\b/, 'Hemorroidectomia'],
  [/\bFISSURECTOMIA\b|\bESFINCTEROTOMIA\b/, 'Fissurectomia'],
  [/\bFISTULECTOMIA\b/, 'Fistulectomia'],
  // HÉRNIA: o sítio muda a cirurgia (dono 18/09: "herniorrafia de que?") — o PRIMEIRO
  // sítio do texto vence ("EPIGÁSTRICA + UMBILICAL" é a epigástrica); sem sítio, só o verbo
  [/\bHERNIA ENCARCERADA\b/, 'Hérnia encarcerada'],
  [/\bHERNIO(RRAFIA|PLASTIA)\b|\bHERNIA (INGUINAL|UMBILICAL|EPIGASTRICA|INCISIONAL|CRURAL|FEMORAL|VENTRAL)\b/, (m, s) => {
    const sitio = primeiro(s, [
      [/\bINGUINAL\b/, 'inguinal'], [/\bUMBILICAL\b/, 'umbilical'], [/\bEPIGASTRICA\b/, 'epigástrica'],
      [/\bINCISIONAL\b/, 'incisional'], [/\b(CRURAL|FEMORAL)\b/, 'crural'], [/\bVENTRAL\b/, 'ventral'],
      [/\bRECIDIVANTE\b/, 'recidivante'],
    ])
    return sitio ? `Herniorrafia ${sitio}` : 'Herniorrafia'
  }],
  [/\bHERNIA DE HI\w*|\bREFLUXO GASTROESOFAGICO\b/, 'Hérnia de hiato'],
  [/\bGASTROPLASTIA\b|\bOBESIDADE\b/, 'Gastroplastia'],
  [/\bCOLECTOMIA\b|\bHEMICOLECTOMIA\b/, 'Colectomia'],
  [/\bRETOSSIGMOIDECTOMIA\b/, 'Retossigmoidectomia'],
  [/\bENTERECTOMIA\b/, 'Enterectomia'],
  [/\bFECHAMENTO\b.*\b(COLOSTOMIA|ILEOSTOMIA|ENTEROSTOMIA)\b/, 'Fechamento de ostomia'],
  [/\bCOLOSTOMIA\b/, 'Colostomia'],
  [/\bILEOSTOMIA\b|\bJEJUNOSTOMIA\b/, 'Ileostomia'],
  [/\bHEPATECTOMIA\b/, 'Hepatectomia'],
  [/\bHIPEC\b|\bCITORREDUTORA\b/, 'HIPEC'],
  [/\bTIREOIDECTOMIA\b/, 'Tireoidectomia'],
  [/\bCATETER (VENOSO CENTRAL|DE LONGA PERMANENCIA)\b|\bPORTOCATH\b|\bCATETERDE LONGA\b/, 'Cateter central'],
  // ── mama / plástica ────────────────────────────────────────────────────
  [/\bMASTECTOMIA\b/, 'Mastectomia'],
  [/\bQUADRANTECTOMIA\b|\bSETORECTOMIA\b|\bSEGMENTECTOMIA\b|\bLESAO (NAO PALPAVEL )?(DE|DA) MAMA\b|\bMARCACAO ESTEREOTAXICA\b/, 'Setorectomia de mama'],
  [/\bLINFONODO SENTINELA\b/, 'Linfonodo sentinela'],
  [/\bLINFADENECTOMIA\b/, (m, s) => {
    const sitio = primeiro(s, [[/\bAXILAR\b/, 'axilar'], [/\bCERVICAL\b/, 'cervical'], [/\bINGUINAL\b/, 'inguinal'], [/\bSUPRACLAVICULAR\b/, 'supraclavicular'], [/\bPELVICA\b/, 'pélvica'], [/\bRETROPERITON\w*/, 'retroperitoneal']])
    return sitio ? `Linfadenectomia ${sitio}` : 'Linfadenectomia'
  }],
  [/\bMASTOPEXIA\b/, 'Mastopexia'],
  [/\bMAMOPLASTIA\b|\bMASTOPLASTIA\b|\bHIPERTROFIA MAMARIA\b/, 'Mamoplastia'],
  [/\bPROTESE DE MAMA\b|\bIMPLANTE DE MAMA\b/, 'Prótese de mama'],
  [/\bEXPLANTE\b/, 'Explante'],
  [/\bRECONSTRUCAO MAMARIA\b/, 'Reconstrução mamária'],
  [/\bRINOSSEPTOPLASTIA\b/, 'Rinosseptoplastia'],
  [/\bSEPTOPLASTIA\b.*\bRINOPLASTIA\b|\bRINOPLASTIA\b.*\bSEPTOPLASTIA\b/, 'Rinosseptoplastia'],
  [/\bRINOPLASTIA\b/, 'Rinoplastia'],
  [/\bBLEFAROPLASTIA\b|^(\d+\s+)?BLEFARO\b/, 'Blefaroplastia'],
  [/\bLIFTING\b/, 'Lifting'],
  [/\bLIPOABDOMINOPLASTIA\b/, 'Lipoabdominoplastia'],
  [/\bDERMOLIPECTOMIA\b|\bABDOMINOPLASTIA\b/, 'Abdominoplastia'],
  [/\bLIPO(ASPIRACAO|ENXERTIA)?\b/, 'Lipoaspiração'],
  [/\bBRAQUIOPLASTIA\b/, 'Braquioplastia'],
  // ── otorrino ───────────────────────────────────────────────────────────
  [/\bADENO-?AMIGDALECTOMIA\b|\bAMIGDALECTOMIA\b.*\bADENOIDECTOMIA\b|\bADENOIDECTOMIA\b.*\bAMIGDALECTOMIA\b/, 'Adenoamigdalectomia'],
  [/\bAMIGDALECTOMIA\b/, 'Amigdalectomia'],
  [/\bADENOIDECTOMIA\b/, 'Adenoidectomia'],
  [/\bTURBINECTOMIA\b/, 'Turbinectomia'],
  [/\bSEPTOPLASTIA\b/, 'Septoplastia'],
  [/\bTIMPANOPLASTIA\b|\bMIRINGOPLASTIA\b/, 'Timpanoplastia'],
  [/\bMICROCIRURGIA OTOLOGICA\b/, 'Microcirurgia otológica'],
  [/\bEXERESE DE PAPILOMA\b/, 'Exérese de papiloma'], // antes da laringe: o papiloma é a cirurgia
  [/\bFARINGECTOMIA\b|\bLARINGE\b/, 'Cirurgia de laringe'],
  // ── ortopedia ──────────────────────────────────────────────────────────
  [/\bMANGUITO ROTADOR\b/, 'Manguito rotador'],
  [/\bLCA\b|\bLIGAMENTO CRUZADO\b/, 'LCA'],
  [/\bLIGAMENTO\b|\bLIGAMENTAR\w*/, (m, s) => {
    const art = primeiro(s, [[/\bTORNOZELO\b/, 'de tornozelo'], [/\bJOELHO\b/, 'de joelho'], [/\bPUNHO\b/, 'de punho'], [/\bMAO\b/, 'de mão'], [/\bOMBRO\b/, 'de ombro'], [/\bCOTOVELO\b/, 'de cotovelo']])
    if (art) return `Ligamento ${art}`
    return /\bRECONSTRU/.test(s) ? 'Reconstrução ligamentar' : 'Ligamento'
  }],
  [/\bMENISC(O|ECTOMIA)\b/, 'Menisco'],
  [/\bARTROPLASTIA\b.*\bJOELHO\b|\bJOELHO\b.*\bARTROPLASTIA\b/, 'Artroplastia de joelho'],
  [/\bARTROPLASTIA\b.*\bQUADRIL\b|\bQUADRIL\b.*\bARTROPLASTIA\b/, 'Artroplastia de quadril'],
  [/\bARTROPLASTIA\b.*\b(OMBRO|ESCAPULO)\b/, 'Artroplastia de ombro'],
  [/\bARTROPLASTIA\b/, 'Artroplastia'],
  [/\bACROMIOPLASTIA\b/, 'Acromioplastia'],
  // o segmento diz qual artrodese é (dono 17/09: "Artrodese" sozinha estava incompleta)
  [/\bARTRODESE\b.*\bCERVIC\w*/, 'Artrodese cervical'],
  [/\bARTRODESE\b.*\bTORACO-?LOMB\w*/, 'Artrodese toracolombar'],
  [/\bARTRODESE\b.*\bLOMB\w*/, 'Artrodese lombar'],
  [/\bARTRODESE\b.*\b(COLUNA|INTERSOMATICA|POSTERO-?LATERAL|VIA ANTERIOR|SEGMENTO|NIVE(L|IS))\b/, 'Artrodese de coluna'],
  [/\bARTRODESE\b.*\b(INTERFALANG\w*|METACARPO\w*|METATARSO\w*)/, 'Artrodese de dedo'],
  [/\bARTRODESE\b.*\b(TARSO|MEDIO PE)\b/, 'Artrodese de tarso'],
  [/\bARTRODESE\b/, 'Artrodese'],
  [/\bHERNIA DE DISCO\b|\bDISCECTOMIA\b/, 'Hérnia de disco'],
  [/\bDENERVACAO\b/, 'Denervação'],
  [/\bBLOQUEIO FENOLICO\b|\bTOXINA BOTULINICA\b/, 'Bloqueio com toxina'],
  [/\bINFILTRACAO\b|\bPUNCAO ARTICULAR\b/, (m, s) => {
    const alvo = primeiro(s, [[/\bCOLUNA\b|\bFORAMINAL\b|\bFACET\w*/, 'de coluna'], [/\bARTICULAR\b|\bJOELHO\b|\bQUADRIL\b|\bOMBRO\b/, 'articular']])
    return alvo ? `Infiltração ${alvo}` : 'Infiltração'
  }],
  [/\bDESCOMPRESSAO MEDULAR\b/, 'Descompressão medular'],
  [/\bTUNEL DO CARPO\b|\bNEUROLISE\b|\bSINDROMES COMPRESSIVAS\b/, 'Túnel do carpo'],
  [/\bNEUROPATIAS COMPRESSIVAS\b/, 'Neuropatias compressivas'],
  [/\bDEDO EM (MARTELO|GARRA|BOTOEIRA|BOTEIRA)\b/, (m) => `Dedo em ${m[1].toLowerCase()}`],
  [/\bHALLUX VALGUS\b/, 'Hallux valgus'],
  [/\bTENDAO DE AQUILES\b/, 'Tendão de Aquiles'],
  [/\bTENORRAFIA\b/, 'Tenorrafia'],
  [/\bTENOPLASTIA\b|\bENXERTO DE TENDAO\b/, 'Tenoplastia'],
  [/\bTENOTOMIA\b/, 'Tenotomia'],
  [/\bTENOLISE\b/, 'Tenólise'],
  [/\bTENOSINOVECTOMIA\b/, 'Tenosinovectomia'],
  [/\bOSTEOCONDROPLASTIA\b/, 'Osteocondroplastia'],
  [/\bCONDROPLASTIA\b|\bVIDEOARTROSCOP\w*|\bARTROSCOPIA\b/, (m, s) => {
    const art = primeiro(s, [[/\bOMBRO\b/, 'de ombro'], [/\bJOELHO\b/, 'de joelho'], [/\bQUADRIL\b/, 'de quadril'], [/\bTORNOZELO\b/, 'de tornozelo'], [/\bPUNHO\b/, 'de punho'], [/\bCOTOVELO\b/, 'de cotovelo']])
    return art ? `Artroscopia ${art}` : 'Artroscopia'
  }],
  // dono 20/09 (foto do Materno): "Osteotomia" era hálux valgo e "Dedo" era dedo em gatilho —
  // a técnica/parte não é a cirurgia; o nome dela é
  [/\bHAL+UX VALGUS\b|\bHALUX\b/, 'Hálux valgo'],
  [/\bDEDO EM GATILHO\b/, 'Dedo em gatilho'],
  [/\bOSTEOTOMIA\w*\b|\bPSEUD[O]?ARTROSE\w*\b/, (m, s) => {
    const osso = primeiro(s, [[/\bMETATARS\w*|\bFALANG\w*/, 'de metatarso'], [/\bOSSOS LONGOS\b/, 'de osso longo'], [/\bJOELHO\b/, 'de joelho'], [/\bCINTURA ESCAPULAR\b|\bESCAPUL\w*/, 'de cintura escapular'], [/\bQUADRIL\b|\bCOXOFEMORAL\b|\bPELVE\b/, 'de quadril'], [/\bFEMUR\b/, 'de fêmur'], [/\bTIBIA\b/, 'de tíbia'], [/\bMANDIBULA\b|\bMAXILA\w*|\bMALAR\b/, 'de face'], [/\bALVEOL\w*|\bPALATIN\w*/, 'alveolopalatina']])
    // pseudartrose sem osteotomia no texto é pseudartrose, não osteotomia
    const verbo = /\bOSTEOTOMIA/.test(s) ? 'Osteotomia' : 'Pseudartrose'
    return osso ? `${verbo} ${osso}` : verbo
  }],
  [/\bOSTEOSSINTESE\b/, 'Osteossíntese'],
  [/\bRETIRADA DE (FIO|PINO|PLACA|MATERIAL|FIXADOR)\w*|\bRETIRADA DE PLACA\b/, 'Retirada de material'],
  [/\bFIOS PINOS\b|\bFIOS OU PINOS\b|\bHASTES METALICAS\b/, 'Fixação com pinos'],
  [/\bALONGAMENTO\b/, 'Alongamento ósseo'],
  [/\bAMPUTACAO\b|\bDESARTICULACAO\b/, (m, s) => {
    const seg = primeiro(s, [[/\bDEDO\w*/, 'de dedo'], [/\bPE\b|\bTARSO\b/, 'de pé'], [/\bMEMBROS? INFERIOR\w*|\bCOXA\b|\bPERNA\b/, 'de membro inferior'], [/\bMEMBROS? SUPERIOR\w*|\bBRACO\b|\bANTEBRACO\b/, 'de membro superior'], [/\bMAO\b/, 'de mão']])
    return seg ? `Amputação ${seg}` : 'Amputação'
  }],
  [/\bDES?BRIDAMENTO\b.*\bULCERA\b/, 'Debridamento de úlcera'],
  [/\bDES?BRIDAMENTO\b.*\bFERIDA\w*/, 'Debridamento de ferida'],
  [/\bDES?BRIDAMENTO\b/, 'Debridamento'],
  [/\bMANIPULACAO ARTICULAR\b/, 'Manipulação articular'],
  [/\bPUNCAO ARTICULAR\b/, 'Punção articular'],
  [/\bLUXACAO\b.*\bTEMPORO-?MANDIBULAR\b|\bATM\b|\bMANDIBULAR POR ARTROSCOPIA\b/, 'ATM'],
  [/\bFRATURA\w*\b.*\b(TRANSTROCANT\w+)/, 'Fratura transtrocantérica'],
  [/\bFRATURA\w*\b.*\bFEMUR\b/, 'Fratura de fêmur'],
  [/\bFRATURA\w*\b.*\bTIBIA(L)?\b|\bPLANALTO TIBIAL\b/, 'Fratura de tíbia'],
  [/\bFRATURA\w*\b.*\bUMERO\b/, 'Fratura de úmero'],
  [/\bFRATURA\w*\b.*\bANTEBRACO\b|\bFRATURA\w*\b.*\b(RADIO|ULNA)\b/, 'Fratura de antebraço'],
  [/\bFRATURA\w*\b.*\bTORNOZELO\b|\bFRATURALUXACAO DO TORNOZELO\b/, 'Fratura de tornozelo'],
  [/\bFRATURA\w*\b.*\bCLAVICULA\b/, 'Fratura de clavícula'],
  [/\bFRATURA\w*\b.*\b(PUNHO|CARPO|METACARP\w+|FALANG\w+|MAO)\b/, 'Fratura de mão'],
  [/\bFRATURA\w*\b.*\b(PE|TARSO|METATARS\w+|TALUS|CALCANEO)\b/, 'Fratura de pé'],
  [/\bFRATURA\w*\b.*\b(QUADRIL|ACETABULO|PELVICO|PELVE)\b/, 'Fratura de quadril'],
  [/\bFRATURA\w*\b.*\bCOTOVELO\b/, 'Fratura de cotovelo'],
  [/\bFRATURA\w*\b.*\b(ZIGOMATICO|ORBITO|MAXILA\w*|MANDIBULA)\b/, 'Fratura de face'],
  [/\bFRATURA\w*\b.*\bNASA\w*/, 'Fratura nasal'],
  [/\bFRATURA\w*\b.*\bCOLUNA\b|\bFRATURA\w*\b.*\bVERTEBR\w*/, 'Fratura de coluna'],
  [/\bFRATURA\w*\b/, 'Fratura'],
  [/\bLUXACAO\b|\bLUXACOES\b/, (m, s) => {
    const art = primeiro(s, [[/\bQUADRIL\b|\bCOXOFEMORAL\b/, 'de quadril'], [/\bOMBRO\b|\bACROMIO\w*/, 'de ombro'], [/\bCOTOVELO\b/, 'de cotovelo'], [/\bPATEL\w*|\bJOELHO\b/, 'de patela'], [/\bTORNOZELO\b/, 'de tornozelo']])
    return art ? `Luxação ${art}` : 'Luxação'
  }],
  // ── neuro ──────────────────────────────────────────────────────────────
  [/\bMICROCIRURGIA\b.*\bINTRACRANIAN\w+|\bTUMOR(ES)? INTRACRANIAN\w+/, 'Tumor intracraniano'],
  [/\bTUMOR MEDULAR\b/, 'Tumor medular'],
  [/\bMICROCIRURGIA VASCULAR\b/, 'Microcirurgia vascular'],
  [/\bELETRODOS? (CEREBRAL|MEDULAR)\b/, 'Implante de eletrodos'],
  [/\bCOLUNA\b.*\bENDOSCOPIC\w+/, 'Coluna endoscópica'],
  // ── vascular / tórax ───────────────────────────────────────────────────
  [/\bVARIZES\b/, 'Varizes'],
  [/\bSIMPATECTOMIA\b/, 'Simpatectomia'],
  // torácica: "A + B" leva a que vem PRIMEIRO no texto (era "Cirurgia torácica" para todas)
  [/\bDECORTICACAO\b|\bRESSECCAO EM CUNHA\b|\bPLEURECTOMIA\b|\bPLEURODESE\b/, (m, s) => primeiro(s, [
    [/\bDECORTICACAO\b/, 'Decorticação pulmonar'], [/\bRESSECCAO EM CUNHA\b/, 'Ressecção pulmonar'],
    [/\bPLEURECTOMIA\b/, 'Pleurectomia'], [/\bPLEURODESE\b/, 'Pleurodese'],
  ])],
  // ── oftalmo ────────────────────────────────────────────────────────────
  [/\bESTRABISMO\b/, 'Estrabismo'],
  [/\bTRANSPLANTE CONJUNTIVAL\b|\bPTERIGIO\b/, 'Pterígio'],
  // ── outros ─────────────────────────────────────────────────────────────
  [/\bBIOPSIAS?\b/, (m, s) => {
    const obj = primeiro(s, [[/\bGANGLIO\b|\bLINFONODO\b/, 'de gânglio'], [/\bOSSE\w*|\bOSSOS?\b/, 'óssea'], [/\bMAMA\b/, 'de mama'], [/\bPELE\b/, 'de pele'], [/\bFIGADO\b|\bHEPATIC\w*/, 'hepática'], [/\bRENAL\b|\bRIM\b/, 'renal'], [/\bPULM\w*/, 'pulmonar'], [/\bTOMOGRAFIA\b|\bTC\b/, 'por TC'], [/\bMUSCUL\w*/, 'muscular']])
    return obj ? `Biópsia ${obj}` : 'Biópsia'
  }],
  [/\bMEDULA OSSEA\b|\bBMO\b/, 'Aspiração de medula'],
  [/\bCELULA TRONCO\b/, 'Célula-tronco'],
  [/\bDRENAGEM\b.*\bABSCESSO\b|\bABSCESSO\b.*\bDRENAGEM\b/, 'Drenagem de abscesso'],
  [/\bDRENAGEM\b/, 'Drenagem'],
  // EXÉRESE: "de quê" é o que identifica (dono 18/09: "exérese de que?"). Objetos vistos nos
  // 60 dias até 18/09: pele/mucosas, cervical (tumor/cisto/fístula), cisto branquial/
  // tireoglosso/escrotal, gânglio, nódulo, papiloma, tumor de partes moles, conjuntiva,
  // trombose hemorroidária, ferimentos/cicatrizes com retalho. Fora da lista, "Exérese de"
  // + o objeto que vem depois de "DE" no próprio texto (até 2 palavras).
  [/\bEXERESE\b|\bEXTIRPACAO\b|\bTUMOR DE PELE\b/, (m, s) => {
    const objeto = primeiro(s, [
      [/\bPELE\b/, 'lesão de pele'], [/\bMAMA\b/, 'lesão de mama'], [/\bCERVICAL\b/, 'tumor cervical'],
      [/\bCISTO BRANQUIAL\b/, 'cisto branquial'], [/\bCISTO TIREOGLOSSO\b/, 'cisto tireoglosso'],
      [/\bCISTO ESCROTAL\b/, 'cisto escrotal'], [/\bGANGLIO\b|\bLINFONODO\b/, 'gânglio'],
      [/\bNODULO\b/, 'nódulo'], [/\bPAPILOMA\b/, 'papiloma'], [/\bPARTES? MOLES\b/, 'tumor de partes moles'],
      [/\bCONJUNTIVA\b/, 'tumor de conjuntiva'], [/\bTROMBOSE\b/, 'trombose hemorroidária'],
      [/\bLIPOMA\b/, 'lipoma'], [/\bNEVUS?\b|\bNEVO\b/, 'nevo'],
      [/\b(FERIMENTOS?|CICATRIZES)\b/, 'ferimento/cicatriz'],
    ])
    if (objeto) return `Exérese de ${objeto}`
    const depois = /\b(?:EXERESE|EXTIRPACAO)\s+(?:E\s+SUPRESSAO\s+)?DE\s+(.+)$/.exec(s)?.[1] || ''
    const tokens = depois.split(/\s*[+/,(]\s*|\s+(?:COM|POR|OU|E)\s+/)[0].split(' ').filter((t) => t && !STOP.has(t)).slice(0, 2)
    return tokens.length ? `Exérese de ${frase(tokens.map((t) => ACENTOS[t] || t.toLowerCase())).toLowerCase()}` : 'Exérese'
  }],
  [/\bTRANSPLANTE OSSEO\b/, 'Transplante ósseo'],
  [/\bNEUROMA\b/, 'Neuroma'],
  [/\bCORPOS? ESTRANHOS?\b/, 'Corpo estranho'],
]

/** O que é embalagem no descritivo e some antes de olhar a cabeça da frase. */
const PREFIXOS = [
  // "TRATAMENTO CIRURGICO DE X" → X; o \b depois da preposição evita comer o "DOS" pela metade
  /^TRAT(AMENTO|\.)? (MICRO)?CIRURGICO\b\s*(?:(?:DE|DA|DO|DAS|DOS)\b\s*)?/,
  /^CORRECAO CIRURGICA\b\s*(?:(?:DE|DA|DO|DAS|DOS)\b\s*)?/,
  /^CIRURGIA (DE|DA|DO|DAS|DOS|PARA)\b\s*/,
  /^PROCEDIMENTO \w+ (DE|DO|DA)\b\s*/,
  /^\d+\s+/,
]
// Onde a frase acaba: o resto é via, lado, técnica, duração — embalagem.
const CORTES = [
  /\s+[-–]\s*.*$/, /\s*\(.*$/, /,.*$/, /;.*$/,
  /\s+(POR|COM|SEM|EM|VIA|PARA|NO|NA|NOS|NAS|CONFORME|UNI|UNILATERAL|BILATERAL|QUALQUER|AO NIVEL|C\/|S\/|P\/)\b.*$/,
  /\s+\d+\s*H(\d+)?\b.*$/, /\s+\d+\s*MIN\b.*$/, // "2H", "4H30", "45MIN" colados sem hífen
]
const STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'OU', 'A', 'O', 'AS', 'OS', 'UM', 'UMA', 'AO'])
/** Até quantas palavras de CONTEÚDO (fora as preposições) o rótulo do fallback leva. */
const MAX_PALAVRAS = 4

/**
 * O mapa da Unimed vem sem acento ("RESSECCAO DE OSSO DE PE"): o rótulo devolve a
 * grafia certa para as palavras que o fallback mais deixa passar. Quem já vem
 * acentuado do texto mantém o que veio.
 */
const ACENTOS = {
  RESSECCAO: 'ressecção', CORRECAO: 'correção', COLOCACAO: 'colocação', AMPUTACAO: 'amputação', LESAO: 'lesão',
  LESOES: 'lesões', EXERESE: 'exérese', BIOPSIA: 'biópsia', RECONSTRUCAO: 'reconstrução', DESCOMPRESSAO: 'descompressão',
  PUNCAO: 'punção', MANIPULACAO: 'manipulação', CONFECCAO: 'confecção', EXPLORACAO: 'exploração', TRANSPOSICAO: 'transposição',
  LUXACAO: 'luxação', FIXACAO: 'fixação', EMBOLIZACAO: 'embolização', MALFORMACAO: 'malformação', DILATACAO: 'dilatação',
  REVISAO: 'revisão', EXTRACAO: 'extração', CAPTACAO: 'captação', DERIVACAO: 'derivação', REMOCAO: 'remoção',
  HERNIA: 'hérnia', PROTESE: 'prótese', ORTESE: 'órtese', FEMUR: 'fêmur', TIBIA: 'tíbia', UMERO: 'úmero', RADIO: 'rádio',
  CALCANEO: 'calcâneo', ULCERA: 'úlcera', ABDOMEN: 'abdômen', TORAX: 'tórax', PELVICO: 'pélvico', PELVICA: 'pélvica',
  CIRURGICO: 'cirúrgico', CIRURGICA: 'cirúrgica', MAO: 'mão', CRANIO: 'crânio', MANDIBULA: 'mandíbula', ORBITA: 'órbita',
  MUSCULO: 'músculo', UTERO: 'útero', OVARIO: 'ovário', VESICULA: 'vesícula', ESOFAGO: 'esôfago', ESTOMAGO: 'estômago',
  COLON: 'cólon', TENDAO: 'tendão', PE: 'pé', OLEO: 'óleo', OSSEA: 'óssea', OSSEO: 'ósseo', UNICA: 'única',
  ORGAOS: 'órgãos', OBSTETRICO: 'obstétrico', VALVULA: 'válvula', FISTULA: 'fístula', CONGENITO: 'congênito',
  CONGENITA: 'congênita', URACO: 'úraco', NODULO: 'nódulo', PRE: 'pré', CARDIACO: 'cardíaco', CELULAS: 'células',
  ANATOMICA: 'anatômica', PAVILHAO: 'pavilhão', PENIS: 'pênis', GLANDULA: 'glândula', ADERENCIAS: 'aderências',
  ELETROFISIOLOGICO: 'eletrofisiológico', CICATRIZ: 'cicatriz', SUBMANDIBULAR: 'submandibular', HEMATOMA: 'hematoma',
  DIGITOS: 'dígitos', PROXIMO: 'próximo', MEDIO: 'médio', TORACICA: 'torácica', TORACICO: 'torácico', GLUTEO: 'glúteo',
  GLUTEA: 'glútea', SEPTICA: 'séptica', RESSECAO: 'ressecção', CRONICA: 'crônica', CRONICAS: 'crônicas',
  EMERGENCIA: 'emergência', REVASCULARIZACAO: 'revascularização', MIOCARDIO: 'miocárdio', SUSPENSAO: 'suspensão',
  SUBOCLUSAO: 'suboclusão', PERCUTANEA: 'percutânea', RECONSTITUICAO: 'reconstituição', RECOLOCACAO: 'recolocação',
  LAPAROSCOPICA: 'laparoscópica', LAPAROSCOPICO: 'laparoscópico', DENTARIOS: 'dentários', ECTOPICA: 'ectópica',
  CUTANEA: 'cutânea', CLAVICULA: 'clavícula', LIQUORICA: 'liquórica', NEUROLITICO: 'neurolítico',
  SUBARACNOIDEO: 'subaracnóideo', BRONQUICA: 'brônquica', CUPULA: 'cúpula', NAO: 'não', FASCIA: 'fáscia',
  OPERATORIO: 'operatório', 'INTRA-HEPATICA': 'intra-hepática', FEMORO: 'fêmoro', PERIFERICO: 'periférico',
  ARTERIA: 'artéria', ESTOMATOLOGICO: 'estomatológico', TRAQUEIA: 'traqueia', VESICAL: 'vesical',
}

/** Sentence case que respeita siglas ("Ressecção de osso do pé", "Implante de cateter", "LCA"). */
function frase(palavras) {
  return palavras.map((p, i) => {
    const up = norm(p)
    if (SIGLAS.has(up)) return up
    const base = p.toLowerCase()
    return i === 0 ? base.charAt(0).toUpperCase() + base.slice(1) : base
  }).join(' ')
}

function fallback(bruto) {
  let s = norm(bruto)
  for (const p of PREFIXOS) s = s.replace(p, '')
  // "C/ TOPICA", "P/VIDEO", "S/ PROTESE": abreviação de com/para/sem, não é separador de cirurgias
  s = s.replace(/\s+[CSP]\/.*$/, '')
  // "A + B" e "A / B": a primeira já identifica a cirurgia
  s = s.split(/\s*[+/]\s*/)[0] || s
  for (const c of CORTES) s = s.replace(c, '')
  const tokens = s.split(' ').map((t) => t.replace(/[(),;:]/g, '')).filter((t) => t && !/^\d+$/.test(t))
  if (!tokens.length) return ''
  // até MAX_PALAVRAS de conteúdo, com as preposições que ficam ENTRE elas; nunca termina em preposição
  const escolhidas = []
  let conteudo = 0
  for (const t of tokens) {
    if (!STOP.has(t)) {
      if (conteudo === MAX_PALAVRAS) break
      conteudo += 1
    }
    escolhidas.push(t)
  }
  while (escolhidas.length && STOP.has(escolhidas[escolhidas.length - 1])) escolhidas.pop()
  // grafia ORIGINAL (acentos) de cada palavra escolhida; sem acento no texto, o mapa completa
  const originais = new Map()
  for (const o of String(bruto || '').normalize('NFC').trim().split(/[\s/+]+/)) {
    const limpo = o.replace(/[(),;:]/g, '')
    const up = norm(limpo)
    if (up && !originais.has(up)) originais.set(up, limpo)
  }
  return frase(escolhidas.map((t) => {
    const o = originais.get(t) || t
    return semAcento(o) === o && ACENTOS[t] ? ACENTOS[t] : o
  }))
}

/**
 * @param {string} procedimento — texto do mapa, como veio
 * @returns {string} rótulo curto ('' quando não há texto)
 */
export function nomeCurtoProcedimento(procedimento) {
  const bruto = String(procedimento || '').trim()
  if (!bruto) return ''
  const s = norm(bruto)
  for (const [re, rotulo] of DICIONARIO) {
    const m = re.exec(s)
    if (!m) continue
    const r = typeof rotulo === 'function' ? rotulo(m, s, bruto) : rotulo
    if (r != null) return r   // null = "esta regra não decide" (linha contada sem item): segue para a próxima
  }
  return fallback(bruto)
}

export const _interno = { DICIONARIO, fallback }
