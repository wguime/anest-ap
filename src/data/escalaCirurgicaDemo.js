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
    c('Sala 1', 0, '13:00', 'M.S.', '52a', '', 'Artrodese toraco-lombo-sacra posterior, dois níveis', 'Eduardo Baldissera', 'ERLEI', 'SUS'),
    c('Sala 2', 0, '13:00', 'R.P.', '', '', 'Continuação +-14h', 'Ricardo Penteado', 'GABRIEL', 'SUS', { isContinuacao: true }),
    c('Sala 2', 1, '13:30', 'D.P.', '75a', '', 'Artroplastia total primária do quadril', 'Mauricio Sanagiotto', '//', 'SUS'),
    c('Sala 3', 0, '13:00', 'E.B.', '47a', '', 'Artroplastia de quadril - tratamento cirúrgico', 'Gustavo Guerreiro', 'ALEXANDRE D', 'BRF'),
    c('Sala 6', 0, '13:00', 'A.B.', '', '', 'Continuação', 'Amauri Biazi', 'GIOVANA', 'SUS', { isContinuacao: true }),
    c('Sala 6', 1, '13:30', 'A.K.', '65a', '', 'Excisão e sutura de lesão na pele com plástica em Z', 'Barbara Anahy', '//', 'SUS'),
    c('Sala 8', 0, '13:00', 'E.K.', '54a', '', 'Ruptura do manguito rotador', 'Eduardo Frigeri', 'RAUL', 'SC'),
    c('Sala 9', 0, '13:00', 'E.R.', '75a', '', 'Linfadenectomia profunda + tireoidectomia total', 'Fabio Rockenbach', 'RAFAEL', 'SC'),
    c('ORTO', 0, '13:00', 'E.L.', '50a', '', 'Ruptura do aparelho extensor do dedo', 'Gracieli Paludo', 'ALEXANDRE S', 'SUS'),
    c('ORTO', 1, '13:30', 'D.G.', '21a', '', 'Debridamento de úlcera / tecidos desvitalizados', 'Gracieli Paludo', '//', 'SUS'),
    c('ORTO', 2, '13:45', 'A.A.', '49a', '', 'Debridamento de úlcera / tecidos desvitalizados', 'Gracieli Paludo', '//', 'SUS'),
    c('Sala 5', 0, '13:00', '', '', '', '02 apendicectomia / 01 amputação perna / 02 duplo J / 01 amputação transtibial', 'Mateus Baptistella', 'DANIELA', 'SUS', { tipo: 'emergencia' }),
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
  ordemLiberacao: ['ROMULO'],
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

/** Retorna a escala demo do hospital se a data for a de demonstração. */
export function getDemoEscala(data, hospital) {
  return data === DEMO_DATE ? DEMO_ESCALAS[hospital] || null : null
}
