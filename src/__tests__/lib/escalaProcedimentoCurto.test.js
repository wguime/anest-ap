/**
 * NOME CURTO DA CIRURGIA (dono 14/09): "quero apenas um nome para identificar a
 * cirurgia — colecistectomia, RTU, prostatectomia". Os exemplos vêm dos 400
 * procedimentos distintos publicados entre 15/08 e 14/09/2026 (os mais frequentes
 * primeiro). O que o dicionário não conhece cai no fallback, que tira a embalagem
 * e fica com a cabeça da frase.
 *
 * Dono 17/09, com fotos da fila: "a descrição de alguns procedimentos está
 * incompleta, melhore a informação, quero que continue sendo direta". O rótulo
 * passa a levar o qualificador que muda a cirurgia (RTU de próstata × de bexiga,
 * artrodese cervical × de coluna, a contagem de "02 PROCEDIMENTOS") e o fallback
 * mantém o verbo ("Ressecção de osso de pé", não "Osso"). Recalibrado nos 1366
 * procedimentos distintos publicados entre 15/08 e 17/09.
 */
import { describe, it, expect } from 'vitest'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'

const casos = [
  // os três exemplos do dono
  ['COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPICA', 'Colecistectomia'],
  ['RESSECCAO ENDOSCOPICA DA PROSTATA', 'RTU de próstata'],
  ['RTU', 'RTU'],
  ['PROSTATOVESICULECTOMIA RADICAL ROBOTICA', 'Prostatectomia'],
  // os mais frequentes do corpus
  ['CESARIANA', 'Cesariana'],
  ['CESARIANA (FETO ÚNICO OU MÚLTIPLO)', 'Cesariana'],
  ['02 CESAREAS', '2 cesarianas'],
  ['CENTRO OBSTETRICO – 01 CESAREA', '1 cesariana'],
  ['AMIGDALECTOMIA', 'Amigdalectomia'],
  ['AMIGDALECTOMIA COM ADENOIDECTOMIA / TURBINECTOMIA', 'Adenoamigdalectomia'],
  ['ADENOIDECTOMIA POR VIDEOENDOSCOPIA', 'Adenoidectomia'],
  ['VARIZES - TRATAMENTO CIRURGICO BILATERAL', 'Varizes'],
  ['RUPTURA DO MANGUITO ROTADOR', 'Manguito rotador'],
  ['POSTECTOMIA', 'Postectomia'],
  ['DENERVACAO PERCUTANEA DE FACETAS ARTICULAR - POR SEGMENTO', 'Denervação'],
  ['FACECTOMIA COM LENTE INTRA-OCULAR COM FACOEMULSIFICAÇÃO', 'FACO'],
  ['05 FACO c/ bloqueio', 'FACO'],
  ['APENDICECTOMIA', 'Apendicectomia'],
  ['FRATURA DOS OSSOS DO ANTEBRAÇO', 'Fratura de antebraço'],
  ['ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO', 'Artroplastia de joelho'],
  ['ARTROPLASTIA TOTAL PRIMÁRIA DO QUADRIL', 'Artroplastia de quadril'],
  ['ARTROPLASTIA ESCAPULO UMERAL COM IMPLANTE - TRATAMENTO CIRURGICO', 'Artroplastia de ombro'],
  ['HEMORROIDECTOMIA ABERTA OU FECHADA COM OU SEM ESFINCTEROTOMIA', 'Hemorroidectomia'],
  ['SEPTOPLASTIA POR VIDEOENDOSCOPIA', 'Septoplastia'],
  ['SEPTOPLASTIA + RINOPLASTIA', 'Rinosseptoplastia'],
  ['DEBRIDAMENTO DE ÚLCERA / DE TECIDOS DESVITALIZADOS', 'Debridamento de úlcera'],
  ['DEBRIDAMENTO CIRURGICO - POR UNIDADE TOPOGRAFICA (UT)', 'Debridamento'],
  ['CONSULTORIO', 'Consultório'],
  ['CONSULTORIO – AJUDA', 'Consultório (ajuda)'],
  ['CONTINUAÇÃO +-14H', 'Continuação'],
  ['CONTINUAÇÃO RM', 'Continuação'],
  ['ARTRODESE DA COLUNA COM INSTRUMENT POR SEGMENTO', 'Artrodese de coluna'],
  ['MICROCIRURGIA PARA TUMOR INTRACRANIANO', 'Tumor intracraniano'],
  ['URETEROLITOTRIPSIA TRANSURETEROSCÓPICA', 'Ureterolitotripsia'],
  ['CATETERISMO CARDIACO E E/OU D COM CINEANGIOCORONARIOGRAFIA E VENTRICULOGRAFIA', 'Cateterismo'],
  ['HISTEROSCOPIA COM RESSECTOSCÓPIO PARA MIOMECTOMIA', 'Histeroscopia'],
  ['01 BRONCOSCOPIA', 'Endoscopia'],
  ['05 EDA + 02 COLO + 01 DILATAÇÃO', 'Endoscopia'],
  ['01 COLO C/ EDA + 04 COLO', 'Endoscopia'],
  ['08 RM (06 PCTES)', 'RM'],
  ['01 TC + 09 RM (07 PCTES)', 'TC + RM'],
  ['CIRURGIA ESTERELIZADORA MASCULINA CONFORME DIRETRIZ DE UTILIZA', 'Vasectomia'],
  ['EXERESE DE LESAO DA MAMA POR MARCACAO ESTEREOTAXICA OU ROLL', 'Setorectomia de mama'],
  ['MENISCECTOMIA - UM MENISCO', 'Menisco'],
  ['TUNEL DO CARPO - DESCOMPRESSAO', 'Túnel do carpo'],
  ['DUPLO J', 'Duplo J'],
  // retirada × colocação é a cirurgia (dono 18/09: "retirada ou colocação de duplo J?")
  ['RETIRADA ENDOSCOPICA DE DUPLO J', 'Retirada de duplo J'],
  ['COLOCAÇÃO URETEROSCÓPICA DE DUPLO J UNILATERAL', 'Colocação de duplo J'],
  ['INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J', 'Colocação de duplo J'],
  ['TROCA DE DUPLO J', 'Troca de duplo J'],
  ['RECONSTRUCAO, RETENCIONAMENTO OU REFORÇO DO LIGAMENTO CRUZADO ANTERIOR OU POSTERIOR', 'LCA'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA TRANSTROCANTERIANA', 'Fratura transtrocantérica'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DO FÊMUR', 'Fratura de fêmur'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DA TÍBIA', 'Fratura de tíbia'],
  ['FRATURA-LUXAÇÃO DO TORNOZELO', 'Fratura de tornozelo'],
  // o sítio entra no rótulo (dono 18/09: "herniorrafia de que?"); o primeiro do texto vence
  // varredura de 20/09 (dono, foto do Materno: "Osteotomia" era hálux valgo, "Dedo" era dedo em gatilho):
  // a técnica ou a parte não é a cirurgia; o qualificador que muda o ato entra no rótulo
  ['TRATAMENTO CIRÚRGICO DO HALUX VALGUS COM OSTEOTOMIA DO PRIMEIRO OSSO METATARSIANO', 'Hálux valgo'],
  ['TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO', 'Dedo em gatilho'],
  ['OSTEOTOMIAS OU PSEUDARTROSE DOS METATARSOS FALANGES - TRATAMENTO CIRURGICO', 'Osteotomia de metatarso'],
  ['PSEUDARTROSES – TRATAMENTO CIRÚRGICO', 'Pseudartrose'],
  ['OSTEOCONDROPLASTIA - ESTABILIZAÇÃO, RESSECÇÃO E OU PLASTIA', 'Osteocondroplastia'],
  ['PROCEDIMENTO VIDEOARTROSCÓPICO DE JOELHO', 'Artroscopia de joelho'],
  ['TENORRAFIA ÚNICA EM TÚNEL OSTEO-FIBROSO', 'Tenorrafia'],
  ['TENOPLASTIA OU ENXERTO DE TENDÃO ÚNICO', 'Tenoplastia'],
  ['LINFADENECTOMIA AXILAR', 'Linfadenectomia axilar'],
  ['LINFADENECTOMIA SELETIVA GUIADA (LINFONODO SENTINELA)', 'Linfonodo sentinela'],
  ['LAPAROSCOPIA GINECOLÓGICA COM OU SEM BIÓPSIA (INCLUI A CROMOTUBAGEM)', 'Laparoscopia ginecológica'],
  ['BIÓPSIA DE GÂNGLIO LINFÁTICO', 'Biópsia de gânglio'],
  ['COLUNA VERTEBRAL: INFILTRACAO FORAMINAL OU FACETARIA OU ARTICULAR', 'Infiltração de coluna'],
  ['TRATAMENTO CIRÚRGICO DE LUXAÇÃO DO QUADRIL', 'Luxação de quadril'],
  ['FRATURA DOS OSSOS NASAIS - REDUCAO CIRURGICA', 'Fratura nasal'],
  ['IMPLANTE DE STENT CORONARIO', 'Stent coronário'],
  ['FECHAMENTO DE COLOSTOMIA OU ENTEROSTOMIA', 'Fechamento de ostomia'],
  ['JEJUNOSTOMIA / ILEOSTOMIA', 'Ileostomia'],
  ['DRENAGEM DE ABSCESSO RENAL', 'Drenagem de abscesso'],
  ['RECONSTRUÇÃO LIGAMENTAR + MENISCECTOMIA', 'Reconstrução ligamentar'],
  ['LESOES LIGAMENTARES CRONICAS AO NIVEL DO TORNOZELO', 'Ligamento de tornozelo'],
  // abreviações à mão do HRO
  ['CESÁRIA', 'Cesariana'], ['CASARIANA', 'Cesariana'], ['CAT', 'Cateterismo'], ['02 LAPARO', 'Laparoscopia'],
  ['CO/EMERG.', 'CO / Emergência'], ['JJ', 'Duplo J'], ['RMN', 'RM'], ['02 BLEFARO 4H', 'Blefaroplastia'],
  ['MASTO C/ TROCA PROTESE+REF. BLEFARO - (04HS)', 'Masto'], // a 1ª cirurgia é a masto; BLEFARO só vale no início
  ['APENDICITE', 'Apendicectomia'], ['TAVI – 2H', 'TAVI'],
  ['HERNIORRAFIA INGUINAL - UNILATERAL POR VIDEOLAPAROSCOPIA', 'Herniorrafia inguinal'],
  ['HERNIOPLASTIA INCISIONAL', 'Herniorrafia incisional'],
  ['HERNIOPLASTIA INGUINAL / CRURAL (UNILATERAL)', 'Herniorrafia inguinal'],
  ['HERNIORRAFIA EPIGÁSTRICA + HERNIORRAFIA UMBILICAL', 'Herniorrafia epigástrica'],
  ['HERNIA INGUINAL EM CRIANÇA - UNILATERAL', 'Herniorrafia inguinal'],
  ['HERNIORRAFIA RECIDIVANTE POR VIDEOLAPAROSCOPIA', 'Herniorrafia recidivante'],
  ['HERNIORRAFIA', 'Herniorrafia'],
  ['DEBRIDAMENTO/ HERNIA ENCARCERADA', 'Hérnia encarcerada'],
  // exérese DE QUÊ (dono 18/09: "exérese de que?")
  ['EXERESE DE TUMORES BENIGNO CISTO OU FISTULA CERVICAL', 'Exérese de tumor cervical'],
  ['EXERESE DE LESÃO / TUMOR DE PELE E MUCOSAS', 'Exérese de lesão de pele'],
  ['EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO CELULAR SUBCUTÂNEO', 'Exérese de lesão de pele'],
  ['EXÉRESE DE CISTO BRANQUIAL', 'Exérese de cisto branquial'],
  ['EXERESE DE CISTO TIREOGLOSSO', 'Exérese de cisto tireoglosso'],
  ['EXERESE DE GANGLIO LINFÁTICO', 'Exérese de gânglio'],
  ['EXÉRESE DE PAPILOMA EM LARINGE', 'Exérese de papiloma'],
  ['TU PARTES MOLES - EXERESE', 'Exérese de tumor de partes moles'],
  ['TUMOR DE CONJUNTIVA - EXERESE', 'Exérese de tumor de conjuntiva'],
  ['EXTENSOS FERIMENTOS, CICATRIZES OU TUMORES - EXERESE E ROTAC', 'Exérese de ferimento/cicatriz'],
  // fora da lista de objetos: o que vem depois de "DE" no próprio texto
  ['EXERESE DE TUMOR COM FECHAMENTO PRIMARIO', 'Exérese de tumor'],
  ['EXERESE DE LESAO + ENXERTIA', 'Exérese de lesão'],
  ['EXERESE DE LIPOMA DE DORSO', 'Exérese de lipoma'],
  ['GASTROPLASTIA PARA OBESIDADE MORBIDA VIA LAPAROSCOPICA', 'Gastroplastia'],
  ['02 ANGIOPLASTIA – 4H', 'Angioplastia'],
  ['ABLAÇÃO PERCUTÂNEA POR CATETER PARA TRATAMENTO DE ARRITMIAS CARDÍACAS', 'Ablação de arritmia'],
  ['ABLAÇAO PROSTATICA A LASER', 'Ablação prostática'],
  ['COLOCACAO DE CATETER VENOSO CENTRAL OU PORTOCATH', 'Cateter central'],
  ['INCONTINENCIA URINARIA COM COLPOPLASTIA ANTERIOR', 'Sling'],
  ['MASTOPEXIA COM PROTESE - 4H30', 'Mastopexia'],
  ['BRAQUIOPLASTIA', 'Braquioplastia'],
  ['ACROMIOPLASTIA OMBRO', 'Acromioplastia'],
  ['CURETAGEM POS ABORTAMENTO', 'Curetagem'],
  ['COLECTOMIA PARCIAL (HEMICOLECTOMIA)', 'Colectomia'],
  ['PLEURECTOMIA + RESSECÇÃO EM CUNHA, TUMORECTOMIA', 'Pleurectomia'],
  ['DECORTICAÇÃO PULMONAR VIDEOTORACOSCOPIA', 'Decorticação pulmonar'],
  ['RECONSTRUÇÃO MAMÁRIA - RETALHOS CUTÂNEOS REGIONAIS', 'Reconstrução mamária'],
  ['AMPUTAÇÃO / DESARTICULAÇÃO DE DEDO', 'Amputação de dedo'],
  ['AMPUTAÇÃO/DESARTICULAÇÃO DE MEMBROS INFERIORES', 'Amputação de membro inferior'],
  ['07 PROCEDIMENTOS', '7 procedimentos'],
  ['01 PROCEDIMENTO', '1 procedimento'],
  ['TRATAMENTO ODONTOLÓGICO PARA PACIENTES COM NECESSIDADES ESPECIAIS', 'Odontologia'],
  ['VITRECTOMIA VIAS PARS PLANA', 'Vitrectomia'],
  ['URETROPLASTIA AUTÓGENA', 'Uretroplastia'],
  ['TRANSPLANTE ÓSSEO VASCULARIZADO', 'Transplante ósseo'],
  ['RESSECÇÃO DE NEUROMA', 'Neuroma'],
  ['EXPLANTE DE PRÓTESE', 'Explante'],
]

// Os cinco da foto do dono (17/09): o rótulo identificava a família, não a cirurgia.
const incompletos = [
  ['ANGIOGRAFIA POR CATETERISMO SELETIVO DE RAMO PRIMARIO - POR VASO', 'Angiografia por cateterismo'],
  ['RESSECCAO DE OSSO DE PE - TRATAMENTO CIRURGICO', 'Ressecção de osso de pé'],
  ['RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA', 'RTU de próstata'],
  ['RESSECÇÃO ENDOSCÓPICA DE TUMOR VESICAL', 'RTU de bexiga'],
  ['TUMOR VESICAL - RESSECCAO ENDOSCOPICA', 'RTU de bexiga'],
  ['ARTRODESE VIA PÓSTERO-LATERAL UM NÍVEL', 'Artrodese de coluna'],
  ['ARTRODESE CERVICAL ANTERIOR UM NÍVEL', 'Artrodese cervical'],
  ['ARTRODESE TORACO-LOMBO-SACRA POSTERIOR, QUATRO NÍVEIS', 'Artrodese toracolombar'],
  ['ARTRODESE INTERFALANGEANA / METACARPOFALANGEANA - TRATAMENTO CIRURGICO', 'Artrodese de dedo'],
  ['02 PROCEDIMENTOS', '2 procedimentos'],
  // o cateterismo cardíaco continua "Cateterismo" — é a angiografia que estava escondida atrás dele
  ['CATETERISMO CARDIACO E E/OU D COM CINEANGIOCORONARIOGRAFIA E VENTRICULOGRAFIA', 'Cateterismo'],
  // da mesma fila: a vitrectomia vinha como "FACO" e a lipoabdominoplastia como "Lipoaspiração"
  ['01 VITRECT. C/FACO + 01 VITRECT.', 'Vitrectomia'],
  ['LIPOABDOMINOPLASTIA + LIPOENXERTIA GLÚTEA', 'Lipoabdominoplastia'],
  ['TRATAMENTO MICROCIRURGICO DAS NEUROPATIAS COMPRESSIVAS (TUMO', 'Neuropatias compressivas'],
]

describe('nomeCurtoProcedimento — dicionário calibrado no corpus de 30 dias', () => {
  it.each(casos)('%s → %s', (texto, esperado) => {
    expect(nomeCurtoProcedimento(texto)).toBe(esperado)
  })
})

describe('nomeCurtoProcedimento — os incompletos da foto de 17/09', () => {
  it.each(incompletos)('%s → %s', (texto, esperado) => {
    expect(nomeCurtoProcedimento(texto)).toBe(esperado)
  })
})

describe('nomeCurtoProcedimento — fallback para o que o dicionário não conhece', () => {
  it('tira a embalagem e fica com a cabeça da frase, sem passar de 4 palavras de conteúdo', () => {
    expect(nomeCurtoProcedimento('TRATAMENTO CIRÚRGICO DE HIDRADENITE AXILAR - BILATERAL')).toBe('Hidradenite axilar')
    expect(nomeCurtoProcedimento('GASTRECTOMIA PARCIAL COM RECONSTRUÇÃO')).toBe('Gastrectomia parcial')
    expect(nomeCurtoProcedimento('RESSECÇÃO DE TUMOR DE PARTES MOLES EM ONCOLOGIA')).toBe('Ressecção de tumor de partes moles')
    expect(nomeCurtoProcedimento('PROTESE PENIANA 2H')).toBe('Prótese peniana')
  })
  it('mantém o verbo da cirurgia — uma palavra sozinha era o que virava "Osso"', () => {
    expect(nomeCurtoProcedimento('RETIRADA DE PONTOS - 1H')).toBe('Retirada de pontos')
    expect(nomeCurtoProcedimento('RETIRADA DE ÓLEO DE SILICONE VIA PARS PLANA')).toBe('Retirada de óleo de silicone')
    expect(nomeCurtoProcedimento('IMPLANTE DE CATETER')).toBe('Implante de cateter')
    // "TRATAMENTO CIRÚRGICO DOS OSSOS…" comia o "DOS" pela metade e sobrava "S"
    expect(nomeCurtoProcedimento('TRATAMENTO CIRÚRGICO DOS OSSOS DO ANTEBRAÇO')).toBe('Ossos do antebraço')
    expect(nomeCurtoProcedimento('TRATAMENTO CIRÚRGICO DE PÉ TORTO CONGÊNITO')).toBe('Pé torto congênito')
  })
  it('palavra genérica leva o complemento junto; sentence case como o dicionário', () => {
    expect(nomeCurtoProcedimento('LESÃO LABRAL - PROCEDIMENTO VIDEOARTROSCÓPICO DE OMBRO')).toBe('Artroscopia de ombro')
    expect(nomeCurtoProcedimento('RETIRADA DE CORPO ESTRANHO DO OUVIDO')).toBe('Corpo estranho')
    expect(nomeCurtoProcedimento('TROCA DE GERADOR')).toBe('Troca de gerador')
  })
  it('"C/", "P/", "S/" são abreviações, não separam cirurgias', () => {
    expect(nomeCurtoProcedimento('RESSECCAO DE TUMOR DE MEDIASTINO P/VIDEO')).toBe('Ressecção de tumor de mediastino')
    expect(nomeCurtoProcedimento('01 REINTERVENÇÃO c/ tópica')).toBe('Reintervenção')
  })
  it('vazio e nulo devolvem vazio', () => {
    expect(nomeCurtoProcedimento('')).toBe('')
    expect(nomeCurtoProcedimento(null)).toBe('')
  })
})
