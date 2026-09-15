/**
 * NOME CURTO DA CIRURGIA (dono 14/09): "quero apenas um nome para identificar a
 * cirurgia — colecistectomia, RTU, prostatectomia". Os exemplos vêm dos 400
 * procedimentos distintos publicados entre 15/08 e 14/09/2026 (os mais frequentes
 * primeiro). O que o dicionário não conhece cai no fallback, que tira a embalagem
 * e fica com a cabeça da frase.
 */
import { describe, it, expect } from 'vitest'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'

const casos = [
  // os três exemplos do dono
  ['COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPICA', 'Colecistectomia'],
  ['RESSECCAO ENDOSCOPICA DA PROSTATA', 'RTU'],
  ['RTU', 'RTU'],
  ['PROSTATOVESICULECTOMIA RADICAL ROBOTICA', 'Prostatectomia'],
  // os mais frequentes do corpus
  ['CESARIANA', 'Cesariana'],
  ['CESARIANA (FETO ÚNICO OU MÚLTIPLO)', 'Cesariana'],
  ['02 CESAREAS', 'Cesariana'],
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
  ['DEBRIDAMENTO DE ÚLCERA / DE TECIDOS DESVITALIZADOS', 'Debridamento'],
  ['CONSULTORIO', 'Consultório'],
  ['CONSULTORIO – AJUDA', 'Consultório (ajuda)'],
  ['CONTINUAÇÃO +-14H', 'Continuação'],
  ['CONTINUAÇÃO RM', 'Continuação'],
  ['ARTRODESE DA COLUNA COM INSTRUMENT POR SEGMENTO', 'Artrodese'],
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
  ['RECONSTRUCAO, RETENCIONAMENTO OU REFORÇO DO LIGAMENTO CRUZADO ANTERIOR OU POSTERIOR', 'LCA'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA TRANSTROCANTERIANA', 'Fratura transtrocantérica'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DO FÊMUR', 'Fratura de fêmur'],
  ['TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DA TÍBIA', 'Fratura de tíbia'],
  ['FRATURA-LUXAÇÃO DO TORNOZELO', 'Fratura de tornozelo'],
  ['HERNIORRAFIA INGUINAL - UNILATERAL POR VIDEOLAPAROSCOPIA', 'Herniorrafia'],
  ['HERNIOPLASTIA INCISIONAL', 'Herniorrafia'],
  ['GASTROPLASTIA PARA OBESIDADE MORBIDA VIA LAPAROSCOPICA', 'Gastroplastia'],
  ['02 ANGIOPLASTIA – 4H', 'Angioplastia'],
  ['ABLAÇÃO PERCUTÂNEA POR CATETER PARA TRATAMENTO DE ARRITMIAS CARDÍACAS', 'Ablação'],
  ['COLOCACAO DE CATETER VENOSO CENTRAL OU PORTOCATH', 'Cateter central'],
  ['INCONTINENCIA URINARIA COM COLPOPLASTIA ANTERIOR', 'Sling'],
  ['MASTOPEXIA COM PROTESE - 4H30', 'Mastopexia'],
  ['BRAQUIOPLASTIA', 'Braquioplastia'],
  ['ACROMIOPLASTIA OMBRO', 'Acromioplastia'],
  ['CURETAGEM POS ABORTAMENTO', 'Curetagem'],
  ['COLECTOMIA PARCIAL (HEMICOLECTOMIA)', 'Colectomia'],
  ['PLEURECTOMIA + RESSECÇÃO EM CUNHA, TUMORECTOMIA', 'Cirurgia torácica'],
  ['RECONSTRUÇÃO MAMÁRIA - RETALHOS CUTÂNEOS REGIONAIS', 'Reconstrução mamária'],
  ['AMPUTAÇÃO / DESARTICULAÇÃO DE DEDO', 'Amputação'],
  ['07 PROCEDIMENTOS', 'Procedimentos'],
  ['TRATAMENTO ODONTOLÓGICO PARA PACIENTES COM NECESSIDADES ESPECIAIS', 'Odontologia'],
  ['VITRECTOMIA VIAS PARS PLANA', 'Vitrectomia'],
  ['URETROPLASTIA AUTÓGENA', 'Uretroplastia'],
  ['TRANSPLANTE ÓSSEO VASCULARIZADO', 'Transplante ósseo'],
  ['RESSECÇÃO DE NEUROMA', 'Neuroma'],
  ['EXPLANTE DE PRÓTESE', 'Explante'],
]

describe('nomeCurtoProcedimento — dicionário calibrado no corpus de 30 dias', () => {
  it.each(casos)('%s → %s', (texto, esperado) => {
    expect(nomeCurtoProcedimento(texto)).toBe(esperado)
  })
})

describe('nomeCurtoProcedimento — fallback para o que o dicionário não conhece', () => {
  it('tira a embalagem e fica com a cabeça da frase', () => {
    expect(nomeCurtoProcedimento('TRATAMENTO CIRÚRGICO DE HIDRADENITE AXILAR - BILATERAL')).toBe('Hidradenite')
    expect(nomeCurtoProcedimento('GASTRECTOMIA PARCIAL COM RECONSTRUÇÃO')).toBe('Gastrectomia')
  })
  it('palavra genérica leva o complemento junto', () => {
    expect(nomeCurtoProcedimento('LESÃO LABRAL - PROCEDIMENTO VIDEOARTROSCÓPICO DE OMBRO')).toBe('Artroscopia')
    expect(nomeCurtoProcedimento('RETIRADA DE CORPO ESTRANHO DO OUVIDO')).toBe('Corpo estranho')
    expect(nomeCurtoProcedimento('TROCA DE GERADOR')).toBe('Troca de Gerador')
  })
  it('vazio e nulo devolvem vazio', () => {
    expect(nomeCurtoProcedimento('')).toBe('')
    expect(nomeCurtoProcedimento(null)).toBe('')
  })
})
