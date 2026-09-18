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
const DICIONARIO = [
  // ── blocos e seções (fora da grade) ────────────────────────────────────
  [/\bCONTINUACAO\b/, 'Continuação'],
  [/\bCONSULTORIO\b.*AJUDA/, 'Consultório (ajuda)'],
  [/\bCONSULTORIO\b|\bCONSULTAS?\b/, 'Consultório'],
  [/\b(EDA|COLO|COLONO|RETOSSIG\w*|ENDOSCOPIA|ECOEDA|ESD|CPRE|COLANGIOPANCREATOGRAFIA|GASTROSTOMIA ENDOSCOPICA|BRONCOSCOPIA)\b/, 'Endoscopia'],
  [/\bTC\b.*\bRM\b|\bRM\b.*\bTC\b/, 'TC + RM'],
  [/\bRM\b/, 'RM'],
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
  [/\bCESAR(EA|IANA)S?\b/, 'Cesariana'],
  [/\bPARTO\b/, 'Parto'],
  [/\bCURETAGEM\b|\bAMIU\b/, 'Curetagem'],
  // ── hemodinâmica / cardio ─────────────────────────────────────────────
  [/\bANGIOPLASTIA\b|\bANGIO\b/, 'Angioplastia'],
  [/\bSTENT\b/, 'Stent'],
  [/\bMARCAPASSO\b/, 'Marcapasso'],
  // "ANGIOGRAFIA POR CATETERISMO SELETIVO…" é angiografia, não o cateterismo cardíaco (dono 17/09)
  [/\bANGIOGRAFIA\b.*\bCATETERISMO\b/, 'Angiografia por cateterismo'],
  [/\bCATETERISMO\b|^CAT\.? CARD/, 'Cateterismo'],
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
  [/\bLIGAMENTO\b/, 'Ligamento'],
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
  [/\bINFILTRACAO\b|\bBLOQUEIO FENOLICO\b/, 'Infiltração'],
  [/\bDESCOMPRESSAO MEDULAR\b/, 'Descompressão medular'],
  [/\bTUNEL DO CARPO\b|\bNEUROLISE\b|\bSINDROMES COMPRESSIVAS\b/, 'Túnel do carpo'],
  [/\bNEUROPATIAS COMPRESSIVAS\b/, 'Neuropatias compressivas'],
  [/\bDEDO EM (MARTELO|GARRA|BOTOEIRA|BOTEIRA)\b/, (m) => `Dedo em ${m[1].toLowerCase()}`],
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
    if (m) return typeof rotulo === 'function' ? rotulo(m, s) : rotulo
  }
  return fallback(bruto)
}

export const _interno = { DICIONARIO, fallback }
