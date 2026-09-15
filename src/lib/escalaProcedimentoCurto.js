/**
 * NOME CURTO DA CIRURGIA para a fila de Liberações (dono 14/09: "quero apenas um
 * nome para identificar a cirurgia — colecistectomia, RTU, prostatectomia").
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
 * Puro, sem acesso a nada. O texto completo continua no card da Completa e no
 * detalhe do caso — aqui é só o rótulo.
 */

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim()

/** Siglas que ficam em caixa alta no rótulo final. */
const SIGLAS = new Set(['EDA', 'RTU', 'LCA', 'LCP', 'TC', 'RM', 'FACO', 'DIU', 'AMIU', 'HIPEC', 'ESD', 'BMO', 'NPP',
  'QT', 'US', 'CPRE', 'PTGI', 'ATM', 'RN', 'UTI', 'HD', 'AV', 'CTI'])

/**
 * Dicionário por família — a ORDEM importa (a primeira que casa vence): as
 * específicas vêm antes das genéricas ("HEMORROIDECTOMIA" antes de qualquer
 * "…ECTOMIA" cair no fallback; "RTU" antes de "RESSECÇÃO").
 */
const DICIONARIO = [
  // ── blocos e seções (fora da grade) ────────────────────────────────────
  [/\bCONTINUACAO\b/, 'Continuação'],
  [/\bCONSULTORIO\b.*AJUDA/, 'Consultório (ajuda)'],
  [/\bCONSULTORIO\b|\bCONSULTAS?\b/, 'Consultório'],
  [/\b(EDA|COLO|COLONO|RETOSSIG\w*|ENDOSCOPIA|ECOEDA|ESD|CPRE|COLANGIOPANCREATOGRAFIA|GASTROSTOMIA ENDOSCOPICA|BRONCOSCOPIA)\b/, 'Endoscopia'],
  [/\bTC\b.*\bRM\b|\bRM\b.*\bTC\b/, 'TC + RM'],
  [/\bRM\b/, 'RM'],
  [/\bTC\b/, 'TC'],
  [/\bFACO\w*|FACECTOMIA|FACOEMULSIFICACAO/, 'FACO'],
  [/\bVITRECT\w*/, 'Vitrectomia'],
  [/\bECO ?TRANSESOFAG\w*/, 'Eco transesofágico'],
  [/\bPROCEDIMENTOS?\b$/, 'Procedimentos'],
  [/\bODONTO\w*|TRATAMENTO ODONTOLOGICO/, 'Odontologia'],
  [/\bCESAR(EA|IANA)S?\b/, 'Cesariana'],
  [/\bPARTO\b/, 'Parto'],
  [/\bCURETAGEM\b|\bAMIU\b/, 'Curetagem'],
  // ── hemodinâmica / cardio ─────────────────────────────────────────────
  [/\bANGIOPLASTIA\b|\bANGIO\b/, 'Angioplastia'],
  [/\bSTENT\b/, 'Stent'],
  [/\bMARCAPASSO\b/, 'Marcapasso'],
  [/\bCATETERISMO\b/, 'Cateterismo'],
  [/\bABLACAO\b/, 'Ablação'],
  [/\bANGIOGRAFIA\b/, 'Angiografia'],
  [/\bOCLUSAO PERCUTANEA\b/, 'Oclusão percutânea'],
  [/\bVALVAR\b/, 'Cirurgia valvar'],
  [/\bFISTULA AV\b|\bHEMODIALISE\b/, 'Fístula AV'],
  // ── urologia ───────────────────────────────────────────────────────────
  [/\bRTU\b|RESSECCAO ENDOSCOPICA/, 'RTU'],
  [/\bPROSTATOVESICULECTOMIA\b|\bPROSTATECTOMIA\b/, 'Prostatectomia'],
  [/\bBIOPSIAS? DE PROSTATA\b/, 'Biópsia de próstata'],
  [/\bURETER(O)?RRENOLITOTRIPSIA\b|\bURETEROLITOTRIPSIA\b|\bLITOTRIPSIA\b/, 'Ureterolitotripsia'],
  [/\bDUPLO J\b/, 'Duplo J'],
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
  [/\bLAPAROSCOPIA\b$/, 'Laparoscopia'],
  [/\bCOLPOPLASTIA\b|\bPERINEOPLASTIA\b/, 'Colpoplastia'],
  [/\bNINFOPLASTIA\b|\bPEQUENOS LABIOS\b/, 'Ninfoplastia'],
  // ── geral / digestivo ──────────────────────────────────────────────────
  [/\bCOLECISTECTOMIA\b/, 'Colecistectomia'],
  [/\bAPENDICECTOMIA\b/, 'Apendicectomia'],
  [/\bHEMORROIDECTOMIA\b/, 'Hemorroidectomia'],
  [/\bFISSURECTOMIA\b|\bESFINCTEROTOMIA\b/, 'Fissurectomia'],
  [/\bFISTULECTOMIA\b/, 'Fistulectomia'],
  [/\bHERNIO(RRAFIA|PLASTIA)\b|\bHERNIA (INGUINAL|UMBILICAL|EPIGASTRICA|INCISIONAL)\b/, 'Herniorrafia'],
  [/\bHERNIA DE HI\w*|\bREFLUXO GASTROESOFAGICO\b/, 'Hérnia de hiato'],
  [/\bGASTROPLASTIA\b|\bOBESIDADE\b/, 'Gastroplastia'],
  [/\bCOLECTOMIA\b|\bHEMICOLECTOMIA\b/, 'Colectomia'],
  [/\bRETOSSIGMOIDECTOMIA\b/, 'Retossigmoidectomia'],
  [/\bENTERECTOMIA\b/, 'Enterectomia'],
  [/\bCOLOSTOMIA\b|\bILEOSTOMIA\b|\bJEJUNOSTOMIA\b/, 'Ostomia'],
  [/\bHEPATECTOMIA\b/, 'Hepatectomia'],
  [/\bHIPEC\b|\bCITORREDUTORA\b/, 'HIPEC'],
  [/\bTIREOIDECTOMIA\b/, 'Tireoidectomia'],
  [/\bCATETER (VENOSO CENTRAL|DE LONGA PERMANENCIA)\b|\bPORTOCATH\b|\bCATETERDE LONGA\b/, 'Cateter central'],
  // ── mama / plástica ────────────────────────────────────────────────────
  [/\bMASTECTOMIA\b/, 'Mastectomia'],
  [/\bQUADRANTECTOMIA\b|\bSETORECTOMIA\b|\bSEGMENTECTOMIA\b|\bLESAO (NAO PALPAVEL )?(DE|DA) MAMA\b|\bMARCACAO ESTEREOTAXICA\b/, 'Setorectomia de mama'],
  [/\bLINFONODO SENTINELA\b|\bLINFADENECTOMIA\b/, 'Linfadenectomia'],
  [/\bMASTOPEXIA\b/, 'Mastopexia'],
  [/\bMAMOPLASTIA\b|\bMASTOPLASTIA\b|\bHIPERTROFIA MAMARIA\b/, 'Mamoplastia'],
  [/\bPROTESE DE MAMA\b|\bIMPLANTE DE MAMA\b/, 'Prótese de mama'],
  [/\bEXPLANTE\b/, 'Explante'],
  [/\bRECONSTRUCAO MAMARIA\b/, 'Reconstrução mamária'],
  [/\bRINOSSEPTOPLASTIA\b/, 'Rinosseptoplastia'],
  [/\bSEPTOPLASTIA\b.*\bRINOPLASTIA\b|\bRINOPLASTIA\b.*\bSEPTOPLASTIA\b/, 'Rinosseptoplastia'],
  [/\bRINOPLASTIA\b/, 'Rinoplastia'],
  [/\bBLEFAROPLASTIA\b/, 'Blefaroplastia'],
  [/\bLIFTING\b/, 'Lifting'],
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
  [/\bFARINGECTOMIA\b|\bLARINGE\b/, 'Cirurgia de laringe'],
  // ── ortopedia ──────────────────────────────────────────────────────────
  [/\bMANGUITO ROTADOR\b/, 'Manguito rotador'],
  [/\bLCA\b|\bLIGAMENTO CRUZADO\b/, 'LCA'],
  [/\bLIGAMENTO\b/, 'Ligamento'],
  [/\bMENISC(O|ECTOMIA)\b/, 'Menisco'],
  [/\bARTROPLASTIA\b.*\bJOELHO\b|\bJOELHO\b.*\bARTROPLASTIA\b/, 'Artroplastia de joelho'],
  [/\bARTROPLASTIA\b.*\bQUADRIL\b|\bQUADRIL\b.*\bARTROPLASTIA\b/, 'Artroplastia de quadril'],
  [/\bARTROPLASTIA\b.*\b(OMBRO|ESCAPULO)\b/, 'Artroplastia de ombro'],
  [/\bARTROPLASTIA\b/, 'Artroplastia'],
  [/\bACROMIOPLASTIA\b/, 'Acromioplastia'],
  [/\bARTRODESE\b/, 'Artrodese'],
  [/\bHERNIA DE DISCO\b|\bDISCECTOMIA\b/, 'Hérnia de disco'],
  [/\bDENERVACAO\b/, 'Denervação'],
  [/\bINFILTRACAO\b|\bBLOQUEIO FENOLICO\b/, 'Infiltração'],
  [/\bDESCOMPRESSAO MEDULAR\b/, 'Descompressão medular'],
  [/\bTUNEL DO CARPO\b|\bNEUROLISE\b|\bSINDROMES COMPRESSIVAS\b/, 'Túnel do carpo'],
  [/\bHALLUX VALGUS\b/, 'Hallux valgus'],
  [/\bTENDAO DE AQUILES\b/, 'Tendão de Aquiles'],
  [/\bTENO(PLASTIA|RRAFIA|TOMIA)\b|\bENXERTO DE TENDAO\b/, 'Tendão'],
  [/\bOSTEOCONDROPLASTIA\b|\bCONDROPLASTIA\b|\bVIDEOARTROSCOP\w*/, 'Artroscopia'],
  [/\bOSTEOTOMIA\b|\bPSEUDARTROSE\b/, 'Osteotomia'],
  [/\bOSTEOSSINTESE\b/, 'Osteossíntese'],
  [/\bRETIRADA DE (FIO|PINO|PLACA|MATERIAL|FIXADOR)\w*|\bRETIRADA DE PLACA\b/, 'Retirada de material'],
  [/\bFIOS PINOS\b|\bFIOS OU PINOS\b|\bHASTES METALICAS\b/, 'Fixação com pinos'],
  [/\bALONGAMENTO\b/, 'Alongamento ósseo'],
  [/\bAMPUTACAO\b|\bDESARTICULACAO\b/, 'Amputação'],
  [/\bDEBRIDAMENTO\b/, 'Debridamento'],
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
  [/\bFRATURA\w*\b/, 'Fratura'],
  [/\bLUXACAO\b|\bLUXACOES\b/, 'Luxação'],
  // ── neuro ──────────────────────────────────────────────────────────────
  [/\bMICROCIRURGIA\b.*\bINTRACRANIAN\w+|\bTUMOR(ES)? INTRACRANIAN\w+/, 'Tumor intracraniano'],
  [/\bTUMOR MEDULAR\b/, 'Tumor medular'],
  [/\bMICROCIRURGIA VASCULAR\b/, 'Microcirurgia vascular'],
  [/\bELETRODOS? (CEREBRAL|MEDULAR)\b/, 'Implante de eletrodos'],
  [/\bCOLUNA\b.*\bENDOSCOPIC\w+/, 'Coluna endoscópica'],
  // ── vascular / tórax ───────────────────────────────────────────────────
  [/\bVARIZES\b/, 'Varizes'],
  [/\bSIMPATECTOMIA\b/, 'Simpatectomia'],
  [/\bDECORTICACAO\b|\bPLEUR(ECTOMIA|ODESE)\b|\bRESSECCAO EM CUNHA\b/, 'Cirurgia torácica'],
  // ── oftalmo ────────────────────────────────────────────────────────────
  [/\bESTRABISMO\b/, 'Estrabismo'],
  [/\bTRANSPLANTE CONJUNTIVAL\b|\bPTERIGIO\b/, 'Pterígio'],
  // ── outros ─────────────────────────────────────────────────────────────
  [/\bBIOPSIA\b/, 'Biópsia'],
  [/\bMEDULA OSSEA\b|\bBMO\b/, 'Aspiração de medula'],
  [/\bCELULA TRONCO\b/, 'Célula-tronco'],
  [/\bDRENAGEM\b/, 'Drenagem'],
  [/\bEXERESE\b|\bEXTIRPACAO\b|\bTUMOR DE PELE\b/, 'Exérese'],
  [/\bTRANSPLANTE OSSEO\b/, 'Transplante ósseo'],
  [/\bNEUROMA\b/, 'Neuroma'],
  [/\bCORPOS? ESTRANHOS?\b/, 'Corpo estranho'],
]

/** O que é embalagem no descritivo e some antes de olhar a cabeça da frase. */
const PREFIXOS = [
  /^TRATAMENTO CIRURGICO (DE|DA|DO|DAS|DOS)?\s*/, /^CORRECAO CIRURGICA (DE|DA|DO)?\s*/, /^CIRURGIA (DE|DA|DO|PARA)\s*/,
  /^PROCEDIMENTO \w+ (DE|DO|DA)\s*/, /^RESSECCAO (DE|DA|DO)\s*/, /^IMPLANTE (CIRURGICO )?(DE|DA|DO)\s*/,
  /^COLOCACAO (DE|DA|DO)\s*/, /^RETIRADA (CIRURGICA )?(DE|DA|DO)\s*/, /^\d+\s+/,
]
const CORTES = [/\s+[-–]\s+.*$/, /\s*\(.*$/, /,.*$/, /\s+(POR|COM|SEM|EM|VIA|PARA|NO|NA|NOS|NAS|CONFORME|UNI|UNILATERAL|BILATERAL|QUALQUER)\b.*$/]
const GENERICAS = new Set(['FRATURA', 'HERNIA', 'LUXACAO', 'TUMOR', 'LESAO', 'ROTURA', 'RUPTURA', 'IMPLANTE', 'RETIRADA',
  'EXERESE', 'BIOPSIA', 'DEBRIDAMENTO', 'AMPUTACAO', 'RECONSTRUCAO', 'DESCOMPRESSAO', 'COLOCACAO', 'CORRECAO', 'REPARO',
  'SUTURA', 'RESSECCAO', 'DRENAGEM', 'TRANSPLANTE', 'TRATAMENTO', 'CIRURGIA', 'PROCEDIMENTO', 'PLASTICA', 'TROCA',
  'EXPLORACAO', 'CONFECCAO', 'PUNCAO', 'MANIPULACAO'])
const STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'OU', 'A', 'O', 'AS', 'OS', 'UM', 'UMA', 'EM', 'POR', 'COM', 'SEM', 'PARA', 'VIA', 'AO', 'NO', 'NA'])

/** Title case que respeita siglas e preposições curtas ("Fratura do fêmur", "LCA"). */
function titulo(palavras) {
  return palavras.map((p, i) => {
    const up = norm(p)
    if (SIGLAS.has(up)) return up
    if (i > 0 && STOP.has(up)) return p.toLowerCase()
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  }).join(' ')
}

function fallback(bruto) {
  let s = norm(bruto)
  for (const p of PREFIXOS) s = s.replace(p, '')
  // "A + B" e "A / B": a primeira já identifica a cirurgia
  s = s.split(/\s*[+/]\s*/)[0] || s
  for (const c of CORTES) s = s.replace(c, '')
  const tokens = s.split(' ').filter((t) => t && !/^\d+$/.test(t))
  if (!tokens.length) return ''
  // dois nomes quando o primeiro é genérico: "FRATURA" sozinha não diz nada
  let n = 1
  if (GENERICAS.has(tokens[0]) && tokens.length > 1) {
    n = 2
    while (n < tokens.length && STOP.has(tokens[n - 1])) n += 1
    if (n < tokens.length && STOP.has(tokens[n])) n += 2 // "FRATURA DO FEMUR" → 3 tokens
  }
  // devolve com a grafia ORIGINAL (acentos) das palavras escolhidas
  const originais = String(bruto || '').normalize('NFC').replace(/\s+/g, ' ').trim().split(' ')
  const escolhidas = []
  let vistos = 0
  for (const o of originais) {
    const up = norm(o).replace(/[(),]/g, '')
    if (!up || /^\d+$/.test(up)) continue
    if (tokens[vistos] && up.startsWith(tokens[vistos].replace(/[(),]/g, ''))) {
      escolhidas.push(o.replace(/[(),]/g, ''))
      vistos += 1
      if (vistos >= n) break
    } else if (vistos > 0) break
  }
  return titulo(escolhidas.length ? escolhidas : tokens.slice(0, n))
}

/**
 * @param {string} procedimento — texto do mapa, como veio
 * @returns {string} rótulo curto ('' quando não há texto)
 */
export function nomeCurtoProcedimento(procedimento) {
  const bruto = String(procedimento || '').trim()
  if (!bruto) return ''
  const s = norm(bruto)
  for (const [re, rotulo] of DICIONARIO) if (re.test(s)) return rotulo
  return fallback(bruto)
}

export const _interno = { DICIONARIO, fallback }
