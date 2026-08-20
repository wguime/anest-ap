/**
 * Escalas de DEMONSTRAÇÃO (26/06/2026) — transcritas dos mapas reais (Unimed/HRO/Materno)
 * para testar a UI sem depender da migration nem do Vision.
 *
 * LGPD: paciente apenas por INICIAIS + idade (nomes completos NÃO entram no repositório).
 * Carregadas pelo contexto quando a data = DEMO_DATE e o banco não tem escala para o
 * hospital. Ações (liberar/reordenar/local) operam em memória (id 'demo-*').
 */
export const DEMO_DATE = '2026-06-26'

const c = (sala, ordem, hora, ini, idade, tempo, procedimento, cirurgiao, anestesista, convenio, extra = {}) => ({
  id: `demo-${sala}-${ordem}`.replace(/\s+/g, '_'),
  sala, ordem, hora,
  pacienteIniciais: ini, idade, tempoEstimado: tempo,
  procedimento, cirurgiao, anestesista, convenio,
  bloco: 'normal', isContinuacao: false, semAnestesista: false, tipo: 'eletiva',
  ...extra,
})

// ── UNIMED ──────────────────────────────────────────────────────────────────
const unimed = {
  id: 'demo-unimed', hospital: 'unimed', data: DEMO_DATE, status: 'publicada',
  liberacoes: {}, linhaOverrides: {},
  ordemLiberacao: ['LEONARDO', 'MARILIO', 'DIEGO', 'GARIM', 'RODNEI', 'OSCAR', 'CURY', 'ADRIANO', 'EDUARDO', 'STAUB', 'JOAO HENRIQUE', 'TIAGO', 'GUILHERME MELO', 'JOAO RICARDO', 'CRISTINA', 'RAQUEL'],
  casos: [
    c('C.O - CESAREA', 0, '13:30', 'C.D.', '37a', '01:15', 'Cesariana', 'Taciana Lidineia Alflen', 'DIEGO', 'Particular'),
    c('C.O - CESAREA', 1, '15:00', 'K.M.', '39a', '01:15', 'Cesariana', 'Fernanda Regina Becker', '//', 'Unimed Intercâmbio Estadual'),
    c('C.O - CESAREA', 2, '16:30', 'G.S.', '37a', '01:15', 'Cesariana', 'Fernanda Regina Becker', '//', 'Unimed Intercâmbio Estadual'),
    c('C.O - CESAREA', 3, '18:00', 'B.M.', '35a', '01:15', 'Cesariana', 'Fernanda Regina Becker', '//', 'Unimed Chapecó - VD'),
    c('C.O - SALA 3', 0, '13:30', 'G.C.', '6a', '02:30', 'Estrabismo horizontal - monocular', 'Achylles Neto', 'JOAO HENRIQUE', 'Particular'),
    c('C.O - SALA 3', 1, '16:30', 'V.B.', '32a', '00:45', 'Fratura de falanges - tratamento cirúrgico com fixação', 'Eduardo Jose Prochazka Frigeri', '//', 'Unimed Chapecó - VD'),
    c('SALA 1', 0, '13:30', 'M.C.', '3a', '02:00', 'Tratamento cirúrgico de sinus pré-auricular', 'Rodrigo Souza', 'EDUARDO', 'Particular'),
    c('SALA 1', 1, '16:00', 'A.K.', '41a', '01:00', 'Exérese de lesões circulares com rotação de retalho', 'Benito Bodanese', 'PED EDUARDO', 'Unimed Intercâmbio Nacional'),
    c('SALA 1', 2, '17:15', 'A.S.', '46a', '00:30', 'Implante cirúrgico de cateter de longa permanência para NPP', 'Benito Bodanese', '//', 'Unimed Fundação'),
    c('SALA 1', 3, '18:00', 'L.B.', '51a', '00:30', 'Implante cirúrgico de cateter de longa permanência para NPP', 'Benito Bodanese', '//', 'Unimed Intercâmbio Nacional'),
    c('SALA 2', 0, '13:30', 'L.F.', '49a', '01:00', 'Colecistectomia sem colangiografia por videolaparoscopia', 'Dirceu Felipe Valentini Junior', 'STAUB', 'Unimed Chapecó - VD'),
    c('SALA 2', 1, '14:45', 'T.T.', '28a', '01:00', 'Colecistectomia sem colangiografia por videolaparoscopia', 'Dirceu Felipe Valentini Junior', '//', 'Unimed Intercâmbio Estadual'),
    c('SALA 2', 2, '16:00', 'A.S.', '28a', '01:00', 'Colecistectomia sem colangiografia por videolaparoscopia', 'Dirceu Felipe Valentini Junior', '//', 'Unimed Intercâmbio Nacional'),
    c('SALA 3', 0, '13:30', '', '', '', 'Continuação', 'Leandro Trevizan', 'MARILIO', '', { isContinuacao: true }),
    c('SALA 3', 1, '14:30', 'J.C.', '38a', '04:30', 'Instalação de marca - passo epimiocárdio', 'Eduardo Menegat', '//', 'Unimed Intercâmbio Nacional'),
    c('SALA 4', 0, '13:30', 'I.B.', '21a', '04:00', 'Correção da hipertrofia mamária - unilateral', 'Liana Ortiz Ruas Winkelmann', 'LEONARDO', 'Unimed Chapecó - VD'),
    c('SALA 6', 0, '13:30', 'S.S.', '61a', '01:15', 'Histeroscopia com ressectoscópio para miomectomia', 'Venilton Vieira', 'RODNEI', 'Particular'),
    c('SALA 6', 1, '15:00', 'C.O.', '46a', '01:00', 'Histerectomia total laparoscópica com anexectomia', 'Juliano Esbissigo', '//', 'Unimed Fundação'),
    c('SALA 6', 2, '16:15', 'E.S.', '33a', '00:45', 'Histeroscopia com ressectoscópio para miomectomia', 'Juliano Esbissigo', '//', 'Unimed Chapecó - VD'),
    c('SALA 6', 3, '18:00', 'M.G.', '29a', '00:45', 'Implante de DIU hormonal', 'Ariane Fransozi', '//', 'Unimed Intercâmbio Estadual'),
    c('SALA 7', 0, '13:30', 'L.S.', '44a', '01:00', 'Reconstrução do ligamento cruzado anterior ou posterior', 'Pedro Barros', 'OSCAR', 'Unimed Intercâmbio Nacional'),
    c('SALA 7', 1, '14:45', 'E.B.', '48a', '01:00', 'Reparo ou sutura de um menisco do joelho', 'Pedro Barros', '//', 'Unimed Intercâmbio Estadual'),
    c('SALA 7', 2, '16:00', 'S.B.', '50a', '01:30', 'Reconstrução do ligamento cruzado anterior ou posterior', 'Pedro Barros', '//', 'Unimed Intercâmbio Estadual'),
    c('SRPA', 0, '13:30', '', '', '', '', '', 'GARIM', '', { bloco: 'srpa' }),
    c('EXAMES', 0, '13:30', '', '', '', '07 EDA + 03 COLO (08 pctes)', 'Elton', 'ADRIANO', '', { bloco: 'exames' }),
    c('EXAMES', 1, '13:30', '', '', '', '07 COLO', 'Farret', 'CURY', '', { bloco: 'exames' }),
    c('EXAMES', 2, '13:30', '', '', '', '03 COLO + 03 EDA (06 pctes)', 'Claudia', 'GUILHERME MELO', '', { bloco: 'exames' }),
    c('IMAGEM', 0, '16:00', '', '', '', '02 Ecotransesofágico', 'Ana', '', '', { bloco: 'imagem', semAnestesista: true }),
    c('CONSULTORIO', 0, '13:30', '', '', '', '', '', 'TIAGO', '', { bloco: 'consultorio' }),
  ],
}

// ── HRO ─────────────────────────────────────────────────────────────────────
const hro = {
  id: 'demo-hro', hospital: 'hro', data: DEMO_DATE, status: 'publicada',
  liberacoes: {}, linhaOverrides: {},
  ordemLiberacao: ['ALEXANDRE S', 'DANIELA', 'RAFAEL', 'GABRIEL', 'ERLEI', 'ALEXANDRE D', 'GIOVANA', 'PAULO', 'MAURICIO', 'ROSE', 'ROBERTA', 'RAUL', 'VICENTE', 'GUILHERME DIDOMENICO', 'THAYNA'],
  casos: [
    c('Bloco A - Sala 1', 0, '13:00', 'M.S.', '52a', '', 'Artrodese toraco-lombo-sacra posterior, dois níveis', 'Eduardo Baldissera', 'ERLEI', 'SUS'),
    c('Bloco A - Sala 2', 0, '13:00', 'R.P.', '', '', 'Continuação +-14h', 'Ricardo Penteado', 'GABRIEL', 'SUS', { isContinuacao: true }),
    c('Bloco A - Sala 2', 1, '13:30', 'D.P.', '75a', '', 'Artroplastia total primária do quadril', 'Mauricio Sanagiotto', '//', 'SUS'),
    c('Bloco A - Sala 3', 0, '13:00', 'E.B.', '47a', '', 'Artroplastia de quadril - tratamento cirúrgico', 'Gustavo Guerreiro', 'ALEXANDRE D', 'BRF'),
    c('Bloco A - Sala 6', 0, '13:00', 'A.B.', '', '', 'Continuação', 'Amauri Biazi', 'GIOVANA', 'SUS', { isContinuacao: true }),
    c('Bloco A - Sala 6', 1, '13:30', 'A.K.', '65a', '', 'Excisão e sutura de lesão na pele com plástica em Z', 'Barbara Anahy', '//', 'SUS'),
    c('Bloco A - Sala 8', 0, '13:00', 'E.K.', '54a', '', 'Ruptura do manguito rotador', 'Eduardo Frigeri', 'RAUL', 'SC'),
    c('Bloco A - Sala 9', 0, '13:00', 'E.R.', '75a', '', 'Linfadenectomia profunda + tireoidectomia total', 'Fabio Rockenbach', 'RAFAEL', 'SC'),
    c('ORTO', 0, '13:00', 'E.L.', '50a', '', 'Ruptura do aparelho extensor do dedo', 'Gracieli Paludo', 'ALEXANDRE S', 'SUS'),
    c('ORTO', 1, '13:30', 'D.G.', '21a', '', 'Debridamento de úlcera / tecidos desvitalizados', 'Gracieli Paludo', '//', 'SUS'),
    c('ORTO', 2, '13:45', 'A.A.', '49a', '', 'Debridamento de úlcera / tecidos desvitalizados', 'Gracieli Paludo', '//', 'SUS'),
    c('Bloco A - Sala 5', 0, '13:00', '', '', '', '02 apendicectomia / 01 amputação perna / 02 duplo J / 01 amputação transtibial', 'Mateus Baptistella', 'DANIELA', 'SUS', { tipo: 'emergencia' }),
    c('HEMO', 0, '13:00', '', '', '', 'Continuação +-14h', '', 'ROSE', '', { bloco: 'hemodinamica', isContinuacao: true }),
    c('HEMO', 1, '15:00', '', '', '', 'Angiografia para ME', 'Alexandre Medeiros', '//', '', { bloco: 'hemodinamica' }),
    c('IOSC', 0, '13:00', '', '', '', 'Continuação +-14h30', 'Rafael', 'ROBERTA', '', { bloco: 'iosc', isContinuacao: true }),
    c('IOSC', 1, '13:00', '', '', '', 'Continuação', 'Marco Antonio', 'MAURICIO', '', { bloco: 'iosc', isContinuacao: true }),
    c('CONSULTORIO', 0, '13:30', '', '', '', 'Consultório – ajuda', '', 'PAULO', '', { bloco: 'consultorio' }),
  ],
}

// ── MATERNO / HC ────────────────────────────────────────────────────────────
const materno = {
  id: 'demo-materno', hospital: 'materno', data: DEMO_DATE, status: 'publicada',
  liberacoes: {}, linhaOverrides: {},
  // O Materno é publicado SEM rodapé — assim em 17/17 escalas até 13/08. Quem
  // trabalha lá só existe nos casos, e é isso que a troca precisa enxergar.
  ordemLiberacao: [],
  casos: [
    c('Sala 3 HC', 0, '07:30', 'M.S.', '9a', '', 'Amigdalectomia com adenoidectomia + turbinectomia', 'Larissa Vendrame de Marchi', 'ROMULO', 'SUS'),
    c('Sala 3 HC', 1, '08:30', 'L.B.', '4a', '', 'Amigdalectomia com adenoidectomia + turbinectomia', 'Larissa Vendrame de Marchi', '//', 'SUS'),
    c('Sala 3 HC', 2, '09:30', 'D.S.', '8a', '', 'Turbinectomia + amigdalectomia com adenoidectomia', 'Larissa Vendrame de Marchi', '//', 'SUS'),
    c('Sala 3 HC', 3, '11:30', 'H.O.', '5a', '', 'Timpanotomia p/ tubo de ventilação', 'Larissa Vendrame de Marchi', '//', 'SUS'),
    c('Sala 3 HC', 4, '13:30', 'C.S.', '13a', '', 'Adenoidectomia + turbinectomia', 'Vanessa Bau', '//', 'SUS'),
    c('Sala 3 HC', 5, '14:30', 'H.S.', '8a', '', 'Turbinectomia + adenoidectomia', 'Vanessa Bau', '//', 'SUS'),
    c('Sala 3 HC', 6, '15:30', 'H.S.', '5a', '', 'Turbinectomia + adenoidectomia', 'Vanessa Bau', '//', 'SUS'),
    c('Sala 3 HC', 7, '16:30', 'A.N.', '9a', '', 'Amigdalectomia com adenoidectomia + turbinectomia', 'Vanessa Bau', '//', 'SUS'),
  ],
}

export const DEMO_ESCALAS = { unimed, hro, materno }

// ── FIM DE SEMANA (fila única, 2026-08-15) ─────────────────────────────────
// Sábado seguinte à demo: fixture do MODO FDS — linha 'fds' (rodapé invertido
// do documento real de 15/08 + fds_meta) + escalas por hospital SEM rodapé
// (no FDS a ordem vem do documento único, não das listas por hospital).
// Base determinística p/ e2e/screenshot; PROD nunca vê (gate DEV no context).
export const DEMO_DATE_FDS = '2026-06-27'

const unimedFds = {
  id: 'demo-unimed-fds', hospital: 'unimed', data: DEMO_DATE_FDS, status: 'publicada',
  liberacoes: {}, linhaOverrides: {}, ordemLiberacao: { matutino: [], vespertino: [] },
  casos: [
    c('C.O - Sala 3', 0, '07:30', 'I.R.', '26a', '01:15', 'Cesariana', 'Taissa Seminate', 'STAUB', 'Unimed Intercâmbio Estadual', { turno: 'matutino' }),
    c('CC - Sala 1', 0, '07:30', 'L.A.', '82a', '03:00', 'Revisão de artroplastia de quadril', 'Airton Pagani', 'MARILIO', 'Intercâmbio Mercosul', { turno: 'matutino' }),
    c('CC - Sala 2', 0, '07:30', 'C.S.', '3a', '01:15', 'Himenotomia', 'Ricardo Filipak', 'GABRIELA', 'Unimed Intercâmbio Estadual', { turno: 'matutino' }),
    c('CC - Sala 6', 0, '07:30', 'S.G.', '45a', '01:30', 'Varizes - tratamento cirúrgico de um membro', 'Fernando Schinko', 'GUILHERME DIDOMENICO', 'Unimed Intercâmbio Estadual', { turno: 'matutino' }),
    c('CC - Sala 1', 1, '13:45', 'L.V.', '34a', '01:30', 'Reconstrução do ligamento cruzado', 'Rodolfo Pagani', 'ERLEI', 'Unimed Chapecó - VD', { turno: 'vespertino' }),
    c('CC - Sala 2', 1, '13:30', 'D.V.', '34a', '03:00', 'Artrodese da coluna com instrumentação', 'Eduardo Baldissera', 'ROBERTA', 'Unimed Chapecó - VD', { turno: 'vespertino' }),
  ],
}
const hroFds = {
  id: 'demo-hro-fds', hospital: 'hro', data: DEMO_DATE_FDS, status: 'publicada',
  liberacoes: {}, linhaOverrides: {}, ordemLiberacao: { matutino: [], vespertino: [] },
  casos: [
    c('Bloco A - Sala 1', 0, '07:00', '', '', '', 'Emergência/CO', '', 'MATHEUS', 'BRF', { tipo: 'emergencia', turno: 'matutino' }),
    c('Bloco A - Sala 2', 0, '08:00', 'R.W.', '63a', '', 'Artroplastia total de joelho com implantes', 'Airton Pagani', 'STAUB', 'SUS', { turno: 'matutino' }),
    c('Bloco A - Sala 4', 0, '13:00', 'A.F.', '59a', '', 'Artroplastia de quadril + tenotomia', 'Rodolfo Pagani', 'GABRIEL', 'SUS', { turno: 'vespertino' }),
  ],
}
const fdsRow = {
  id: 'demo-fds', hospital: 'fds', data: DEMO_DATE_FDS, status: 'publicada',
  liberacoes: {}, linhaOverrides: {}, ajudaExterna: {}, casos: [],
  // rodapé = INVERSO da linha do doc ("1º→último a ser liberado":
  // P4,P3,P12,P09,P10,P11,P6,P5,P8,P7,P2,P1) — 1ª posição sai por último
  ordemLiberacao: {
    matutino: ['GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'MARILIO', 'RAFAEL', 'GABRIELA', 'ERLEI', 'GABRIEL', 'STAUB', 'ROBERTA', 'VICENTE', 'CRISTINA', 'MATHEUS'],
    vespertino: ['CRISTINA', 'MATHEUS', 'ERLEI', 'GABRIELA', 'ROBERTA', 'STAUB', 'GABRIEL'],
  },
  fdsMeta: {
    grade: {
      '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' },
      '13-19': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
      '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' },
    },
    posicoes: {
      P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS',
      P5: 'GABRIELA', P6: 'ERLEI', P7: 'MARILIO', P8: 'RAFAEL',
      P9: 'ROBERTA', P10: 'STAUB', P11: 'GABRIEL', P12: 'VICENTE',
    },
    escalacao: {
      matutino: ['P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'],
      vespertino: ['P6', 'P5', 'P9', 'P10', 'P11'],
    },
    ordemFonte: { matutino: 'documento', vespertino: 'documento' },
    // fila da NOITE (dono 16/08): a linha 19-07 da grade + os Pn da lista
    // numerada que também ficam — estes liberam primeiro (ficam no fim)
    ordemNoite: ['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'RAFAEL', 'MARILIO'],
  },
}
export const DEMO_ESCALAS_FDS = { unimed: unimedFds, hro: hroFds, materno: null, fds: fdsRow }

/** Retorna a escala demo do hospital se a data for uma das de demonstração. */
export function getDemoEscala(data, hospital) {
  if (data === DEMO_DATE) return DEMO_ESCALAS[hospital] || null
  if (data === DEMO_DATE_FDS) return DEMO_ESCALAS_FDS[hospital] || null
  return null
}
