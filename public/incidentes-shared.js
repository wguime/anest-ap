/**
 * ANEST — Incidentes/Denúncias — dados compartilhados entre formulários públicos.
 *
 * MANTER SINCRONIZADO com src/data/incidentesConfig.js — fonte de verdade do app.
 * Este arquivo espelha as constantes/funções para uso em scripts clássicos
 * (formulario-incidente.html / formulario-denuncia.html), que não passam pelo
 * pipeline Vite e portanto não conseguem importar o módulo ESM.
 *
 * Convenção: alterações estruturais em incidentesConfig.js exigem replay aqui.
 */
(function () {
  'use strict';

  // ============================================================
  // TIPOS DE INCIDENTE + SUBTIPOS (cascata)
  // ============================================================
  const INCIDENT_TYPES = {
    medicacao: {
      value: 'medicacao', label: 'Medicação',
      subtipos: [
        { value: 'erro_dose', label: 'Erro de Dose' },
        { value: 'erro_via', label: 'Via de Administração Errada' },
        { value: 'omissao', label: 'Omissão de Dose' },
        { value: 'medicamento_errado', label: 'Medicamento Errado' },
        { value: 'paciente_errado_med', label: 'Paciente Errado' },
        { value: 'reacao_adversa', label: 'Reação Adversa' },
        { value: 'alergia_nao_verificada', label: 'Alergia Não Verificada' },
        { value: 'interacao_medicamentosa', label: 'Interação Medicamentosa' },
      ],
    },
    cirurgia: {
      value: 'cirurgia', label: 'Cirurgia',
      subtipos: [
        { value: 'local_errado', label: 'Local Errado' },
        { value: 'procedimento_errado', label: 'Procedimento Errado' },
        { value: 'paciente_errado_cir', label: 'Paciente Errado' },
        { value: 'corpo_estranho', label: 'Corpo Estranho Retido' },
        { value: 'lateralidade', label: 'Erro de Lateralidade' },
      ],
    },
    identificacao: {
      value: 'identificacao', label: 'Identificação',
      subtipos: [
        { value: 'pulseira_incorreta', label: 'Pulseira Incorreta' },
        { value: 'pulseira_ausente', label: 'Pulseira Ausente' },
        { value: 'paciente_trocado', label: 'Paciente Trocado' },
        { value: 'prontuario_errado', label: 'Prontuário Errado' },
      ],
    },
    via_aerea: {
      value: 'via_aerea', label: 'Via Aérea',
      subtipos: [
        { value: 'intubacao_dificil', label: 'Intubação Difícil Não Prevista' },
        { value: 'extubacao_acidental', label: 'Extubação Acidental' },
        { value: 'aspiracao', label: 'Broncoaspiração' },
        { value: 'obstrucao', label: 'Obstrução de Via Aérea' },
        { value: 'laringoespasmo', label: 'Laringoespasmo' },
        { value: 'broncoespasmo', label: 'Broncoespasmo Severo' },
      ],
    },
    cardiovascular: {
      value: 'cardiovascular', label: 'Cardiovascular',
      subtipos: [
        { value: 'parada_cardiaca', label: 'Parada Cardíaca' },
        { value: 'hipotensao_grave', label: 'Hipotensão Grave' },
        { value: 'hipertensao_grave', label: 'Hipertensão Grave' },
        { value: 'arritmia', label: 'Arritmia Grave' },
        { value: 'isquemia', label: 'Isquemia Miocárdica' },
        { value: 'choque', label: 'Choque' },
      ],
    },
    equipamento: {
      value: 'equipamento', label: 'Equipamento',
      subtipos: [
        { value: 'falha_monitor', label: 'Falha de Monitor' },
        { value: 'falha_ventilador', label: 'Falha de Ventilador' },
        { value: 'falha_bomba_infusao', label: 'Falha de Bomba de Infusão' },
        { value: 'falha_desfibrilador', label: 'Falha de Desfibrilador' },
        { value: 'indisponibilidade', label: 'Equipamento Indisponível' },
        { value: 'calibracao', label: 'Calibração Incorreta' },
      ],
    },
    queda: {
      value: 'queda', label: 'Queda',
      subtipos: [
        { value: 'queda_leito', label: 'Queda do Leito' },
        { value: 'queda_maca', label: 'Queda da Maca' },
        { value: 'queda_deambulacao', label: 'Queda Durante Deambulação' },
        { value: 'queda_banheiro', label: 'Queda no Banheiro' },
      ],
    },
    outros: {
      value: 'outros', label: 'Outros',
      subtipos: [
        { value: 'lesao_pele', label: 'Lesão de Pele/Pressão' },
        { value: 'infeccao', label: 'Infecção Relacionada à Assistência' },
        { value: 'comunicacao', label: 'Falha de Comunicação' },
        { value: 'documentacao', label: 'Erro de Documentação' },
        { value: 'transferencia', label: 'Erro na Transferência de Cuidado' },
        { value: 'atraso', label: 'Atraso no Atendimento' },
        { value: 'outro', label: 'Outro' },
      ],
    },
  };

  // ============================================================
  // SEVERIDADES (B8 — mapping WHO ICPS / NCC MERP / NHS LFPSE)
  // ============================================================
  const SEVERITY_LEVELS = [
    { value: 'near_miss', label: 'Near Miss', description: 'Quase erro - interceptado antes de atingir o paciente' },
    { value: 'leve', label: 'Leve', description: 'Sem necessidade de intervenção adicional' },
    { value: 'moderado', label: 'Moderado', description: 'Necessitou intervenção adicional' },
    { value: 'grave', label: 'Grave', description: 'Prolongou internação ou causou dano permanente leve' },
    { value: 'critico', label: 'Crítico', description: 'Óbito ou dano permanente grave' },
  ];

  // ============================================================
  // NEVER EVENTS — NQF SRE / NHS NE / JCAHO
  // ============================================================
  const NEVER_EVENTS = [
    {
      code: 'NE-SUR-01', label: 'Cirurgia em local errado',
      description: 'Procedimento cirúrgico realizado em local anatômico diferente do planejado (lado errado, nível errado, sítio errado).',
      framework: 'NQF SRE 1 / NHS NE / JCAHO',
      triggers: [
        { tipo: 'cirurgia', subtipo: 'local_errado' },
        { tipo: 'cirurgia', subtipo: 'lateralidade' },
      ],
    },
    {
      code: 'NE-SUR-02', label: 'Cirurgia em paciente errado',
      description: 'Procedimento realizado em paciente diferente do programado, decorrente de falha de identificação.',
      framework: 'NQF SRE 2 / NHS NE / JCAHO',
      triggers: [
        { tipo: 'cirurgia', subtipo: 'paciente_errado_cir' },
        { tipo: 'identificacao', subtipo: 'paciente_trocado' },
      ],
    },
    {
      code: 'NE-SUR-03', label: 'Procedimento cirúrgico errado',
      description: 'Procedimento diferente do consentido/planejado executado no paciente correto e local correto.',
      framework: 'NQF SRE 3 / NHS NE / JCAHO',
      triggers: [{ tipo: 'cirurgia', subtipo: 'procedimento_errado' }],
    },
    {
      code: 'NE-SUR-04', label: 'Corpo estranho retido após cirurgia',
      description: 'Compressa, instrumento, agulha ou qualquer item retido no paciente após fechamento.',
      framework: 'NQF SRE 4 / NHS NE / JCAHO',
      triggers: [{ tipo: 'cirurgia', subtipo: 'corpo_estranho' }],
    },
    {
      code: 'NE-ANE-01', label: 'Morte intra ou peri-anestésica em paciente ASA I',
      description: 'Óbito associado à administração de anestesia em paciente ASA I, dentro do intra-op ou até 24h pós-procedimento.',
      framework: 'NQF SRE 5',
      triggers: [{ tipo: 'cardiovascular', subtipo: 'parada_cardiaca' }],
    },
    {
      code: 'NE-ANE-02', label: 'Bloqueio anestésico em local errado (wrong-site block)',
      description: 'Bloqueio regional (raqui, peridural, periférico) realizado em lateralidade ou nível diferente do planejado/consentido.',
      framework: 'NHS Never Event',
      triggers: [],
    },
    {
      code: 'NE-ANE-03', label: 'Falha catastrófica em via aérea com dano grave ou óbito',
      description: 'Incapacidade de obter via aérea com hipoxia prolongada, lesão cerebral hipoxica ou óbito (cannot intubate cannot oxygenate).',
      framework: 'NHS NE / consenso ANEST',
      triggers: [
        { tipo: 'via_aerea', subtipo: 'intubacao_dificil' },
        { tipo: 'via_aerea', subtipo: 'obstrucao' },
      ],
    },
    {
      code: 'NE-MED-01', label: 'Erro de medicação com óbito ou dano grave',
      description: 'Erro de dose, via, paciente ou medicamento errado resultando em óbito ou dano permanente grave.',
      framework: 'NQF SRE 6 / JCAHO',
      triggers: [
        { tipo: 'medicacao', subtipo: 'erro_dose' },
        { tipo: 'medicacao', subtipo: 'medicamento_errado' },
        { tipo: 'medicacao', subtipo: 'paciente_errado_med' },
      ],
    },
    {
      code: 'NE-MED-02', label: 'Reação anafilática a medicamento com alergia conhecida',
      description: 'Anafilaxia por administração de medicamento com alergia documentada em prontuário, com falha na verificação pré-administração.',
      framework: 'NQF SRE 6 (subtipo)',
      triggers: [{ tipo: 'medicacao', subtipo: 'alergia_nao_verificada' }],
    },
    {
      code: 'NE-PRO-01', label: 'Embolia gasosa por cateter venoso central',
      description: 'Entrada de ar via cateter venoso central durante inserção, manutenção ou remoção, com repercussão clínica.',
      framework: 'NHS Never Event',
      triggers: [],
    },
    {
      code: 'NE-PRO-02', label: 'Reação hemolítica por incompatibilidade ABO',
      description: 'Transfusão de hemocomponente ABO-incompatível resultando em reação hemolítica aguda.',
      framework: 'NQF SRE 18 / NHS NE',
      triggers: [],
    },
    {
      code: 'NE-ENV-01', label: 'Queimadura ou incêndio intra-operatório',
      description: 'Lesão térmica em paciente por fonte de calor (eletrocautério, laser, fluido aquecido) ou incêndio em campo cirúrgico.',
      framework: 'NQF SRE 11 / JCAHO',
      triggers: [],
    },
  ];

  // ============================================================
  // LOCAIS (clínicas/hospitais ANEST-específicos)
  // ============================================================
  const LOCAIS = [
    { value: 'clinica_consultorio', label: 'Clínica/Consultório de Anestesiologia' },
    { value: 'hospital_unimed', label: 'Hospital Unimed' },
    { value: 'hospital_regional_oeste', label: 'Hospital Regional do Oeste' },
    { value: 'hospital_materno_infantil', label: 'Hospital Materno Infantil' },
    { value: 'iosc', label: 'IOSC – Hospital dos Olhos SC' },
    { value: 'aho', label: 'AHO – Accurata Hospital dos Olhos' },
    { value: 'la_forme', label: 'La Forme' },
    { value: 'centro_coluna', label: 'Centro de Coluna e Imagem' },
    { value: 'conception', label: 'Conception' },
    { value: 'hospital_olhos_chapeco', label: 'Hospital dos Olhos Chapecó' },
    { value: 'umanita', label: 'Umanitá' },
    { value: 'digimax', label: 'Digimax' },
    { value: 'clinica_cirurgica', label: 'Clínica Cirúrgica Chapecó' },
    { value: 'clinicas_odontologicas', label: 'Clínicas odontológicas' },
    { value: 'outros', label: 'Outros' },
  ];

  // ============================================================
  // SETORES (granularidade dentro do local)
  // ============================================================
  const SETORES = [
    { value: 'centro_cirurgico', label: 'Centro Cirúrgico' },
    { value: 'centro_obstetrico', label: 'Centro Obstétrico' },
    { value: 'hemodinamica', label: 'Hemodinâmica' },
    { value: 'endoscopia', label: 'Endoscopia' },
    { value: 'tomografia', label: 'Tomografia' },
    { value: 'ressonancia', label: 'Ressonância Magnética' },
    { value: 'biopsia', label: 'Biopsia' },
    { value: 'transesofagico', label: 'Transesofágico' },
    { value: 'recuperacao_anestesica', label: 'Recuperação Anestésica' },
    { value: 'uti', label: 'UTI' },
    { value: 'internacao', label: 'Setores de Internação' },
    { value: 'consultorio_anestesia', label: 'Consultório de Anestesia' },
    { value: 'consultorio_odonto', label: 'Consultório Odontológico' },
    { value: 'outros', label: 'Outros' },
  ];

  const TURNOS = [
    { value: 'madrugada', label: 'Madrugada (00:00 – 05:59)' },
    { value: 'manha', label: 'Manhã (06:00 – 11:59)' },
    { value: 'tarde', label: 'Tarde (12:00 – 17:59)' },
    { value: 'noite', label: 'Noite (18:00 – 23:59)' },
  ];

  const FUNCOES = [
    { value: 'medico_anestesista', label: 'Médico Anestesista' },
    { value: 'medico_cirurgiao', label: 'Médico Cirurgião' },
    { value: 'medico_residente', label: 'Médico Residente' },
    { value: 'enfermeiro', label: 'Enfermeiro(a)' },
    { value: 'tecnico_enfermagem', label: 'Téc. Enfermagem' },
    { value: 'instrumentador', label: 'Instrumentador(a)' },
    { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
    { value: 'farmaceutico', label: 'Farmacêutico(a)' },
    { value: 'administrativo', label: 'Administrativo' },
    { value: 'outro', label: 'Outro' },
  ];

  const FASES_PROCEDIMENTO = [
    { value: 'pre_operatorio', label: 'Pré-operatório' },
    { value: 'inducao', label: 'Indução Anestésica' },
    { value: 'manutencao', label: 'Manutenção Anestésica' },
    { value: 'despertar', label: 'Despertar/Extubação' },
    { value: 'pos_operatorio_imediato', label: 'Pós-operatório Imediato (RPA)' },
    { value: 'pos_operatorio_tardio', label: 'Pós-operatório Tardio' },
    { value: 'nao_aplicavel', label: 'Não Aplicável' },
  ];

  const TIPOS_ANESTESIA = [
    { value: 'geral', label: 'Anestesia Geral' },
    { value: 'raquianestesia', label: 'Raquianestesia' },
    { value: 'peridural', label: 'Peridural' },
    { value: 'combinada', label: 'Combinada (Raqui + Peridural)' },
    { value: 'bloqueio_periferico', label: 'Bloqueio Periférico' },
    { value: 'sedacao', label: 'Sedação' },
    { value: 'local', label: 'Anestesia Local' },
    { value: 'nao_aplicavel', label: 'Não Aplicável' },
  ];

  const MONITORAMENTOS = [
    { value: 'oximetria', label: 'Oximetria (SpO2)' },
    { value: 'capnografia', label: 'Capnografia (EtCO2)' },
    { value: 'ecg', label: 'ECG' },
    { value: 'pni', label: 'Pressão Não Invasiva (PNI)' },
    { value: 'pai', label: 'Pressão Arterial Invasiva (PAI)' },
    { value: 'pvc', label: 'Pressão Venosa Central (PVC)' },
    { value: 'temperatura', label: 'Temperatura' },
    { value: 'bis', label: 'BIS/Entropia' },
    { value: 'tof', label: 'TOF (Bloqueio Neuromuscular)' },
    { value: 'debito_urinario', label: 'Débito Urinário' },
  ];

  const DENUNCIA_TYPES = [
    { value: 'etica', label: 'Questão Ética' },
    { value: 'assedio_moral', label: 'Assédio Moral' },
    { value: 'assedio_sexual', label: 'Assédio Sexual' },
    { value: 'seguranca_paciente', label: 'Segurança do Paciente' },
    { value: 'fraude', label: 'Fraude ou Irregularidade' },
    { value: 'discriminacao', label: 'Discriminação' },
    { value: 'conflito_interesse', label: 'Conflito de Interesse' },
    { value: 'violacao_politica', label: 'Violação de Política' },
    { value: 'negligencia', label: 'Negligência' },
    { value: 'outro', label: 'Outro' },
  ];

  // ============================================================
  // HELPERS
  // ============================================================

  function suggestNeverEventCode(tipo, subtipo) {
    for (let i = 0; i < NEVER_EVENTS.length; i++) {
      const ne = NEVER_EVENTS[i];
      for (let j = 0; j < ne.triggers.length; j++) {
        const t = ne.triggers[j];
        if (t.tipo === tipo && t.subtipo === subtipo) return ne.code;
      }
    }
    return null;
  }

  function getNeverEventConfig(code) {
    for (let i = 0; i < NEVER_EVENTS.length; i++) {
      if (NEVER_EVENTS[i].code === code) return NEVER_EVENTS[i];
    }
    return null;
  }

  function shouldSuggestNeverEvent(tipo, subtipo, severidade) {
    if (suggestNeverEventCode(tipo, subtipo)) return true;
    if (severidade === 'critico' && ['cirurgia', 'medicacao', 'via_aerea', 'cardiovascular'].indexOf(tipo) !== -1) {
      return true;
    }
    return false;
  }

  /**
   * Popula um <select> a partir de um array de { value, label }.
   * Mantém placeholder existente como primeira opção (vazio).
   */
  function populateSelect(selectId, options, opts) {
    opts = opts || {};
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const placeholder = opts.placeholder !== undefined ? opts.placeholder : (sel.options[0] && !sel.options[0].value ? sel.options[0].text : 'Selecione');
    const previousValue = opts.preserveValue ? sel.value : '';
    sel.innerHTML = '';
    if (placeholder !== null) {
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = placeholder;
      sel.appendChild(opt0);
    }
    for (let i = 0; i < options.length; i++) {
      const o = document.createElement('option');
      o.value = options[i].value;
      o.textContent = options[i].label;
      sel.appendChild(o);
    }
    if (previousValue && opts.preserveValue) sel.value = previousValue;
  }

  /**
   * Renderiza um grupo de checkboxes em um container, atualizando o array
   * passado em `state[stateKey]` à medida que o usuário marca/desmarca.
   * Layout 2 colunas mobile, 3 colunas em viewports ≥640px (CSS responsável).
   */
  function renderCheckboxGroup(containerId, options, state, stateKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(state[stateKey])) state[stateKey] = [];
    container.innerHTML = '';
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const id = containerId + '_' + opt.value;
      const wrap = document.createElement('label');
      wrap.className = 'checkbox-item';
      wrap.setAttribute('for', id);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.value = opt.value;
      input.checked = state[stateKey].indexOf(opt.value) !== -1;
      input.addEventListener('change', function () {
        const idx = state[stateKey].indexOf(opt.value);
        if (input.checked && idx === -1) state[stateKey].push(opt.value);
        if (!input.checked && idx !== -1) state[stateKey].splice(idx, 1);
      });
      const span = document.createElement('span');
      span.textContent = opt.label;
      wrap.appendChild(input);
      wrap.appendChild(span);
      container.appendChild(wrap);
    }
  }

  /**
   * Calcula data prazo RCA = today + 45 dias (padrão JCAHO).
   * Retorna string "YYYY-MM-DD".
   */
  function defaultRcaDeadline() {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().slice(0, 10);
  }

  // Expor namespace
  window.ANEST_INCIDENTES = {
    INCIDENT_TYPES: INCIDENT_TYPES,
    SEVERITY_LEVELS: SEVERITY_LEVELS,
    NEVER_EVENTS: NEVER_EVENTS,
    LOCAIS: LOCAIS,
    SETORES: SETORES,
    TURNOS: TURNOS,
    FUNCOES: FUNCOES,
    FASES_PROCEDIMENTO: FASES_PROCEDIMENTO,
    TIPOS_ANESTESIA: TIPOS_ANESTESIA,
    MONITORAMENTOS: MONITORAMENTOS,
    DENUNCIA_TYPES: DENUNCIA_TYPES,
    suggestNeverEventCode: suggestNeverEventCode,
    getNeverEventConfig: getNeverEventConfig,
    shouldSuggestNeverEvent: shouldSuggestNeverEvent,
    populateSelect: populateSelect,
    renderCheckboxGroup: renderCheckboxGroup,
    defaultRcaDeadline: defaultRcaDeadline,
  };
})();
