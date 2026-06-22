/**
 * Códigos de anestesiologia faturáveis diretamente pelo anestesista — Unimed (TUSS).
 *
 * Lista de consulta + fonte das sugestões do assistente de codificação. Os valores são
 * da tabela Intercâmbio Nacional (UTM R$ 1,17); o valor local Unimed Chapecó (UTM R$ 1,73)
 * é derivado em runtime pela config de multiplicador (ver src/lib/codificacaoAnestRules.js).
 *
 * `quandoUsar` é conteúdo editorial de auditoria que NÃO está nas planilhas referenciais —
 * por isso vive aqui (estático), não na tabela Supabase de lookup.
 */

// Indicador anestésico (letra) → R$ na tabela Intercâmbio Nacional (UTM × 1,17).
export const INDICADOR_VALOR = {
  A: 150, B: 175.5, C: 210.6, D: 257.4, E: 292.5, F: 327.6, G: 374.4,
  H: 409.5, I: 468, J: 526.5, K: 585, L: 643.5, M: 702, N: 760.5,
  P: 819, Q: 877.5, R: 994.5, S: 1111.5, T: 1345.5, U: 1521, V: 1755,
  W: 1989, X: 2263.95, Y: 2784.6, Z: 3123.9,
};

export const CATEGORIAS = {
  imperativo_clinico: { label: 'Imperativo clínico', descricao: 'Anestesia em procedimento que normalmente dispensa anestesista, exigida pela condição do paciente.' },
  sem_porte: { label: 'Ato sem porte previsto', descricao: 'Anestesia em ato médico cujo código não tem porte anestésico definido.' },
  anestesia_exame: { label: 'Anestesia para exames/procedimentos', descricao: 'Sedação/anestesia para exames de imagem, endoscopia e procedimentos diagnósticos/terapêuticos.' },
  analgesia: { label: 'Analgesia / dor', descricao: 'Acompanhamento de analgesia e bombas de infusão.' },
  bloqueio_dor: { label: 'Bloqueios anestésicos / dor', descricao: 'Bloqueios anestésicos e neurolíticos para diagnóstico e tratamento de dor.' },
};

/**
 * @typedef {Object} CodigoAnestesia
 * @property {string} codigo
 * @property {string} descricao
 * @property {string|null} indicador  letra A–Z
 * @property {number|null} valor      R$ intercâmbio
 * @property {number|null} porteAnestesico
 * @property {keyof typeof CATEGORIAS} categoria
 * @property {string} quandoUsar
 */

/** @type {CodigoAnestesia[]} */
export const CODIGOS_ANESTESIA = [
  // ── Imperativo clínico / sem porte (os dois "coringas" quando a anestesia zera) ──
  {
    codigo: '31602355', descricao: 'Anestesia realizada pelo anestesiologista para as situações de imperativo clínico', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'imperativo_clinico',
    quandoUsar: 'Procedimento que normalmente seria sob anestesia local/sem anestesista, mas a CONDIÇÃO DO PACIENTE exigiu sedação/geral (criança, paciente não colaborativo, deficiência, vaginismo, alergia a anestésico local). É o código mais defensável quando a indicação parte do paciente. Exige justificativa clínica no relatório (auditoria prévia).',
  },
  {
    codigo: '31602347', descricao: 'Anestesia realizada pelo anestesiologista em atos médicos que não tenham seus portes especialmente previstos', indicador: 'F', valor: 327.6, porteAnestesico: 3, categoria: 'sem_porte',
    quandoUsar: 'Ato médico cujo código NÃO possui porte anestésico na tabela (porte 0) e foi realizado sob anestesia. Use quando a anestesia decorre do próprio ato e não há indicação clínica específica do paciente. Exige justificativa (auditoria prévia).',
  },

  // ── Anestesia para exames e procedimentos ──
  { codigo: '31602231', descricao: 'Anestesia para endoscopia diagnóstica', indicador: 'B', valor: 175.5, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação/anestesia para endoscopia digestiva ou respiratória diagnóstica.' },
  { codigo: '31602240', descricao: 'Anestesia para endoscopia intervencionista', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Endoscopia terapêutica (polipectomia, dilatação, CPRE, etc.).' },
  { codigo: '31602258', descricao: 'Anestesia para exames radiológicos de angiorradiologia', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Procedimentos de angiografia/angiorradiologia intervencionista.' },
  { codigo: '31602266', descricao: 'Anestesia para exames de ultrassonografia', indicador: 'B', valor: 175.5, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para US (geralmente pediátrica ou intervencionista).' },
  { codigo: '31602274', descricao: 'Anestesia para exames de tomografia computadorizada', indicador: 'C', valor: 210.6, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para TC (paciente não colaborativo, criança, claustrofobia grave).' },
  { codigo: '31602282', descricao: 'Anestesia para exames de ressonância magnética', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Sedação para RM (criança, claustrofobia, paciente não colaborativo).' },
  { codigo: '31602290', descricao: 'Anestesia para procedimentos de radioterapia', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Sedação para sessões de radioterapia (tipicamente pediátrica).' },
  { codigo: '31602304', descricao: 'Anestesia para exames específicos, teste para diagnóstico e outros procedimentos', indicador: 'B', valor: 175.5, porteAnestesico: 1, categoria: 'anestesia_exame', quandoUsar: 'Exames/testes diagnósticos específicos não cobertos pelos códigos acima.' },
  { codigo: '31602312', descricao: 'Anestesia para procedimentos clínicos ambulatoriais e hospitalares', indicador: 'A', valor: 150, porteAnestesico: 1, categoria: 'anestesia_exame', quandoUsar: 'Procedimentos clínicos ambulatoriais/hospitalares de menor complexidade. Menor valor do grupo — preferir 31602347/355 quando couber.' },
  { codigo: '31602320', descricao: 'Anestesia para procedimentos de medicina nuclear', indicador: 'G', valor: 374.4, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para exames/terapias de medicina nuclear.' },

  // ── Analgesia / dor ──
  { codigo: '31602029', descricao: 'Analgesia por dia subsequente — acompanhamento de analgesia por cateter peridural', indicador: 'B', valor: 175.5, porteAnestesico: 1, categoria: 'analgesia', quandoUsar: 'Acompanhamento diário de analgesia por cateter peridural (cada dia subsequente).' },
  { codigo: '31602207', descricao: 'Instalação de bomba de infusão para analgesia em dor aguda ou crônica, por qualquer via', indicador: 'G', valor: 374.4, porteAnestesico: 3, categoria: 'analgesia', quandoUsar: 'Instalação de bomba de infusão para controle de dor aguda/crônica.' },
  { codigo: '31602223', descricao: 'Passagem de cateter peridural ou subaracnóideo com bloqueio de prova', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'analgesia', quandoUsar: 'Passagem de cateter peridural/subaracnóideo com bloqueio de prova para analgesia.' },

  // ── Bloqueios anestésicos / dor ──
  { codigo: '31602045', descricao: 'Bloqueio anestésico de nervos cranianos', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio diagnóstico/terapêutico de nervos cranianos.' },
  { codigo: '31602053', descricao: 'Bloqueio anestésico de plexo celíaco', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de plexo celíaco (dor visceral abdominal/oncológica).' },
  { codigo: '31602061', descricao: 'Bloqueio anestésico de simpático lombar', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio do simpático lombar.' },
  { codigo: '31602096', descricao: 'Bloqueio de gânglio estrelado com anestésico local', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de gânglio estrelado (SDRC, dor de membro superior/face).' },
  { codigo: '31602126', descricao: 'Bloqueio facetário para-espinhoso', indicador: 'F', valor: 327.6, porteAnestesico: 3, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio facetário para dor axial da coluna.' },
  { codigo: '31602169', descricao: 'Bloqueio peridural ou subaracnóideo com corticóide', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio peridural/subaracnóideo com corticóide (lombociatalgia, dor radicular).' },
  { codigo: '31602339', descricao: 'Bloqueio anestésico de plexos nervosos (lombossacro, braquial, cervical) para tratamento de dor', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de plexo (lombossacro/braquial/cervical) para tratamento de dor.' },
  { codigo: '31602037', descricao: 'Anestesia geral ou condutiva para realização de bloqueio neurolítico', indicador: 'J', valor: 526.5, porteAnestesico: 4, categoria: 'bloqueio_dor', quandoUsar: 'Anestesia geral/condutiva para realizar bloqueio neurolítico.' },
];

/** Mapa código → registro, para lookup O(1). */
export const CODIGOS_ANESTESIA_MAP = Object.fromEntries(
  CODIGOS_ANESTESIA.map((c) => [c.codigo, c])
);

/** Agrupado por categoria, na ordem de CATEGORIAS. */
export const CODIGOS_POR_CATEGORIA = Object.keys(CATEGORIAS).map((cat) => ({
  categoria: cat,
  ...CATEGORIAS[cat],
  codigos: CODIGOS_ANESTESIA.filter((c) => c.categoria === cat),
}));

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

export default { INDICADOR_VALOR, CATEGORIAS, CODIGOS_ANESTESIA, CODIGOS_ANESTESIA_MAP, CODIGOS_POR_CATEGORIA, formatarMoeda };
