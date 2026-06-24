/**
 * Códigos de anestesiologia faturáveis diretamente pelo anestesista — Unimed (TUSS).
 *
 * Lista de consulta + fonte das sugestões do assistente de codificação. Os valores são
 * da tabela Intercâmbio Nacional (UTM R$ 1,17); o valor local Unimed Chapecó (UTM R$ 1,75)
 * é derivado em runtime pela config de multiplicador (ver src/lib/codificacaoAnestRules.js).
 *
 * `quandoUsar` é conteúdo editorial de auditoria que NÃO está nas planilhas referenciais —
 * por isso vive aqui (estático), não na tabela Supabase de lookup.
 */

import { INDICADOR_UTM } from './codificacaoAnestProtocolo';

// Indicador anestésico (letra) → R$ na tabela Intercâmbio Nacional, derivado da tabela oficial de
// UTMs da v2026.03 (× 1,17). Fonte única = INDICADOR_UTM, evita drift (ex.: A = 128 UTM = R$149,76,
// não R$150 como em versões anteriores).
export const INDICADOR_VALOR = Object.freeze(
  Object.fromEntries(Object.entries(INDICADOR_UTM).map(([k, utm]) => [k, Math.round(utm * 1.17 * 100) / 100]))
);

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
 * @property {string[]} exemplos
 */

/** @type {CodigoAnestesia[]} */
export const CODIGOS_ANESTESIA = [
  // ── Imperativo clínico / sem porte (os dois "coringas" quando a anestesia zera) ──
  {
    codigo: '31602355', descricao: 'Anestesia realizada pelo anestesiologista para as situações de imperativo clínico', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'imperativo_clinico',
    quandoUsar: 'Procedimento que normalmente seria sob anestesia local/sem anestesista, mas a CONDIÇÃO DO PACIENTE exigiu sedação/geral. É o código mais defensável quando a indicação parte do paciente. Exige justificativa clínica no relatório (auditoria prévia).',
    exemplos: [
      'Criança não colaborativa para sutura de ferimento ou exérese de lesão de pele.',
      'Inserção de DIU em nulípara com estenose cervical e dor intolerável à tentativa ambulatorial.',
      'Paciente com deficiência intelectual ou demência que não tolera o ato sob anestesia local.',
      'Paciente com transtorno do espectro autista ou agitação psicomotora grave.',
      'Alergia documentada a anestésico local, exigindo outra técnica anestésica.',
      'Retirada de corpo estranho em criança que não coopera.',
      'Curativo/troca de curativo doloroso em grande queimado.',
      'Endoscopia/colonoscopia em paciente com comorbidade que exige anestesista.',
    ],
  },
  {
    codigo: '31602347', descricao: 'Anestesia realizada pelo anestesiologista em atos médicos que não tenham seus portes especialmente previstos', indicador: 'F', valor: 327.6, porteAnestesico: 3, categoria: 'sem_porte',
    quandoUsar: 'Ato médico cujo código NÃO possui porte anestésico na tabela (porte 0) e foi realizado sob anestesia. Use quando a anestesia decorre do próprio ato e não há indicação clínica específica do paciente. Exige justificativa (auditoria prévia).',
    exemplos: [
      'Curativo extenso de queimadura sob sedação.',
      'Cauterização/eletrocauterização de múltiplas lesões que exigiu sedação.',
      'Redução incruenta de fratura com necessidade de relaxamento sob anestesia.',
      'Manipulação articular sob anestesia (ex.: ombro congelado).',
      'Drenagem de abscesso extenso/profundo sob sedação.',
      'Exérese de unha ou de lesões múltiplas de pele sob sedação.',
      'Toalete/desbridamento de ferida complexa sob anestesia.',
      'Punção/biópsia profunda que exigiu sedação para imobilidade.',
    ],
  },

  // ── Anestesia para exames e procedimentos ──
  { codigo: '31602231', descricao: 'Anestesia para endoscopia diagnóstica', indicador: 'B', valor: 175.5, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação/anestesia para endoscopia digestiva ou respiratória diagnóstica.', exemplos: ['Endoscopia digestiva alta diagnóstica sob sedação.', 'Colonoscopia diagnóstica.', 'Broncoscopia diagnóstica.', 'Ecoendoscopia diagnóstica.', 'Endoscopia em criança ou paciente não colaborativo.'] },
  { codigo: '31602240', descricao: 'Anestesia para endoscopia intervencionista', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Endoscopia terapêutica (polipectomia, dilatação, CPRE, etc.).', exemplos: ['Colonoscopia com polipectomia.', 'CPRE (colangiopancreatografia retrógrada).', 'Dilatação endoscópica de estenose esofágica.', 'Ligadura elástica de varizes esofágicas.', 'Gastrostomia endoscópica (PEG).'] },
  { codigo: '31602258', descricao: 'Anestesia para exames radiológicos de angiorradiologia', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Procedimentos de angiografia/angiorradiologia intervencionista.', exemplos: ['Arteriografia/angiografia por cateterismo.', 'Embolização por angiorradiologia.', 'Cateterismo vascular diagnóstico sob anestesia.', 'Quimioembolização hepática.', 'Angioplastia/stent periférico por via percutânea.'] },
  { codigo: '31602266', descricao: 'Anestesia para exames de ultrassonografia', indicador: 'B', valor: 175.5, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para US (geralmente pediátrica ou intervencionista).', exemplos: ['Ultrassonografia em criança não colaborativa.', 'Biópsia guiada por ultrassom sob sedação.', 'Doppler que exigiu imobilidade sob sedação.', 'Drenagem guiada por ultrassom.', 'Punção aspirativa guiada por US em criança.'] },
  { codigo: '31602274', descricao: 'Anestesia para exames de tomografia computadorizada', indicador: 'C', valor: 210.6, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para TC (paciente não colaborativo, criança, claustrofobia grave).', exemplos: ['TC em criança pequena.', 'TC em paciente com claustrofobia grave.', 'TC em paciente agitado/não colaborativo.', 'TC com biópsia guiada.', 'TC em politraumatizado agitado.'] },
  { codigo: '31602282', descricao: 'Anestesia para exames de ressonância magnética', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Sedação para RM (criança, claustrofobia, paciente não colaborativo).', exemplos: ['RM em criança (exame longo, exige imobilidade).', 'RM em paciente claustrofóbico.', 'RM em paciente com distúrbio de movimento.', 'RM cardíaca/neurológica longa.', 'RM em paciente com deficiência intelectual.'] },
  { codigo: '31602290', descricao: 'Anestesia para procedimentos de radioterapia', indicador: 'E', valor: 292.5, porteAnestesico: 3, categoria: 'anestesia_exame', quandoUsar: 'Sedação para sessões de radioterapia (tipicamente pediátrica).', exemplos: ['Sessões diárias de radioterapia em criança.', 'Braquiterapia sob sedação.', 'Radiocirurgia estereotáxica.', 'Radioterapia em lactente/recém-nascido.'] },
  { codigo: '31602304', descricao: 'Anestesia para exames específicos, teste para diagnóstico e outros procedimentos', indicador: 'B', valor: 175.5, porteAnestesico: 1, categoria: 'anestesia_exame', quandoUsar: 'Exames/testes diagnósticos específicos não cobertos pelos códigos acima.', exemplos: ['Potencial evocado sob sedação.', 'Teste diagnóstico que exige imobilidade.', 'Eletroneuromiografia em criança.', 'Exame oftalmológico sob narcose em criança.', 'Eletroencefalograma em paciente não colaborativo.'] },
  { codigo: '31602312', descricao: 'Anestesia para procedimentos clínicos ambulatoriais e hospitalares', indicador: 'A', valor: 149.76, porteAnestesico: 1, categoria: 'anestesia_exame', quandoUsar: 'Código oficial (v2026.03 item 4.3.2) para os ~159 procedimentos sem previsão de anestesia, quando o ato anestésico é tecnicamente justificado. Indicador A (128 UTMs).', exemplos: ['Procedimento clínico ambulatorial de baixa complexidade sob sedação leve.', 'Curativo simples em ambiente hospitalar com sedação.', 'Procedimento ambulatorial doloroso em paciente ansioso.', 'Punção lombar/medular em criança.'] },
  { codigo: '31602320', descricao: 'Anestesia para procedimentos de medicina nuclear', indicador: 'G', valor: 374.4, porteAnestesico: 2, categoria: 'anestesia_exame', quandoUsar: 'Sedação para exames/terapias de medicina nuclear.', exemplos: ['Cintilografia em criança não colaborativa.', 'PET-CT sob sedação.', 'Cintilografia óssea em criança.', 'Terapia com radioiodo que exige imobilidade.'] },

  // ── Analgesia / dor ──
  { codigo: '31602029', descricao: 'Analgesia por dia subsequente — acompanhamento de analgesia por cateter peridural', indicador: 'B', valor: 175.5, porteAnestesico: 1, categoria: 'analgesia', quandoUsar: 'Acompanhamento diário de analgesia por cateter peridural (cada dia subsequente).', exemplos: ['Acompanhamento de analgesia peridural no 1º PO de cirurgia abdominal de grande porte.', 'Controle diário de dor por cateter peridural em paciente oncológico.', 'Analgesia peridural pós-toracotomia.', 'Acompanhamento de cateter peridural em pancreatite grave.'] },
  { codigo: '31602207', descricao: 'Instalação de bomba de infusão para analgesia em dor aguda ou crônica, por qualquer via', indicador: 'G', valor: 374.4, porteAnestesico: 3, categoria: 'analgesia', quandoUsar: 'Instalação de bomba de infusão para controle de dor aguda/crônica.', exemplos: ['Bomba de PCA (analgesia controlada pelo paciente) no pós-operatório.', 'Bomba de infusão para dor oncológica refratária.', 'Bomba intratecal para espasticidade/dor crônica.', 'Infusão contínua peridural no pós-operatório de grande porte.'] },
  { codigo: '31602223', descricao: 'Passagem de cateter peridural ou subaracnóideo com bloqueio de prova', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'analgesia', quandoUsar: 'Passagem de cateter peridural/subaracnóideo com bloqueio de prova para analgesia.', exemplos: ['Cateter peridural para analgesia de parto.', 'Cateter peridural para dor crônica com bloqueio de prova.', 'Cateter peridural pré-operatório para analgesia multimodal.'] },

  // ── Bloqueios anestésicos / dor ──
  { codigo: '31602045', descricao: 'Bloqueio anestésico de nervos cranianos', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio diagnóstico/terapêutico de nervos cranianos.', exemplos: ['Bloqueio do nervo trigêmeo na neuralgia do trigêmeo.', 'Bloqueio de nervo craniano para dor facial.', 'Bloqueio do nervo occipital na neuralgia occipital.'] },
  { codigo: '31602053', descricao: 'Bloqueio anestésico de plexo celíaco', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de plexo celíaco (dor visceral abdominal/oncológica).', exemplos: ['Dor por câncer de pâncreas.', 'Dor visceral abdominal crônica refratária.', 'Pancreatite crônica dolorosa.'] },
  { codigo: '31602061', descricao: 'Bloqueio anestésico de simpático lombar', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio do simpático lombar.', exemplos: ['Síndrome dolorosa regional complexa de membro inferior.', 'Dor isquêmica de membro inferior.', 'Hiperidrose plantar.'] },
  { codigo: '31602096', descricao: 'Bloqueio de gânglio estrelado com anestésico local', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de gânglio estrelado (SDRC, dor de membro superior/face).', exemplos: ['SDRC de membro superior.', 'Dor facial atípica / cefaleia em salvas.', 'Dor isquêmica de membro superior.'] },
  { codigo: '31602126', descricao: 'Bloqueio facetário para-espinhoso', indicador: 'F', valor: 327.6, porteAnestesico: 3, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio facetário para dor axial da coluna.', exemplos: ['Lombalgia facetária crônica.', 'Cervicalgia de origem facetária.', 'Dor axial pós-laminectomia.'] },
  { codigo: '31602169', descricao: 'Bloqueio peridural ou subaracnóideo com corticóide', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio peridural/subaracnóideo com corticóide (lombociatalgia, dor radicular).', exemplos: ['Lombociatalgia por hérnia de disco.', 'Dor radicular cervical/lombar.', 'Estenose de canal com dor radicular.'] },
  { codigo: '31602339', descricao: 'Bloqueio anestésico de plexos nervosos (lombossacro, braquial, cervical) para tratamento de dor', indicador: 'D', valor: 257.4, porteAnestesico: 2, categoria: 'bloqueio_dor', quandoUsar: 'Bloqueio de plexo (lombossacro/braquial/cervical) para tratamento de dor.', exemplos: ['Dor de plexo braquial pós-trauma.', 'Bloqueio de plexo lombossacro para dor de membro inferior.', 'Dor neuropática de plexo após radioterapia.'] },
  { codigo: '31602037', descricao: 'Anestesia geral ou condutiva para realização de bloqueio neurolítico', indicador: 'J', valor: 526.5, porteAnestesico: 4, categoria: 'bloqueio_dor', quandoUsar: 'Anestesia geral/condutiva para realizar bloqueio neurolítico.', exemplos: ['Neurólise de plexo celíaco em dor oncológica sob anestesia geral.', 'Bloqueio neurolítico que exige sedação profunda.', 'Neurólise de simpático em paciente não colaborativo.'] },
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

/**
 * Procedimentos SADT (exames) → código de anestesia a cobrar (item 4.3.1 das Instruções Gerais).
 * Referência rápida na aba Consulta: quando o exame SADT não paga anestesia embutida, é este o
 * código 31602 que o anestesista lança. Indicador/valor vêm de CODIGOS_ANESTESIA_MAP.
 */
export const SADT_EXAME_ANESTESIA = [
  { tipo: 'Endoscopia diagnóstica', codigo: '31602231' },
  { tipo: 'Endoscopia intervencionista', codigo: '31602240' },
  { tipo: 'Angiografia / angiorradiologia', codigo: '31602258' },
  { tipo: 'Ultrassonografia', codigo: '31602266' },
  { tipo: 'Tomografia computadorizada', codigo: '31602274' },
  { tipo: 'Ressonância magnética', codigo: '31602282' },
  { tipo: 'Radioterapia', codigo: '31602290' },
  { tipo: 'Medicina nuclear', codigo: '31602320' },
  { tipo: 'Exames específicos / outros diagnósticos', codigo: '31602304' },
  { tipo: 'Procedimentos clínicos ambulatoriais/hospitalares', codigo: '31602312' },
].map((e) => ({ ...e, ...CODIGOS_ANESTESIA_MAP[e.codigo] }));

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

export default { INDICADOR_VALOR, CATEGORIAS, CODIGOS_ANESTESIA, CODIGOS_ANESTESIA_MAP, CODIGOS_POR_CATEGORIA, SADT_EXAME_ANESTESIA, formatarMoeda };
