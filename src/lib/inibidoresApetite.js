/**
 * Inibidores de apetite e antiobesidade — consulta perioperatória.
 *
 * Fonte PRIMÁRIA: Nota da Sociedade Brasileira de Anestesiologia
 * C.SBA-01744/2026, de 15/05/2026 — "atualização sobre as recomendações do
 * manejo perioperatório dos agonistas do receptor GLP-1 e coagonistas
 * GLP-1/GIP", consenso SBA + SBD + ABESO. É brasileira, é a mais recente e
 * traz o algoritmo inteiro (itens 1 a 9), por isso vence as internacionais
 * aqui — o contrário do card de Anticoagulantes, onde a referência nacional
 * é o contraponto.
 *
 * Contraponto na tela (COMPARATIVO): ANZCA 2025, SPAQI 2025, AOA/RCOA 2025 e
 * ASA+ASMBS 2025, como a própria SBA os resume na Tabela 1 da nota.
 *
 * ⚠️ A regra de suspensão da SBA classifica por DURAÇÃO DE AÇÃO (7 dias para
 * longa, 1 dia para curta), não por frequência de dose. A semaglutida ORAL
 * (Rybelsus) é o caso em que os dois critérios divergem: é diária, mas a
 * meia-vida é de ~7 dias. Aqui ela entra como LONGA, com a divergência escrita
 * na própria entrada — esconder isso mandaria o paciente para a sala com um
 * dia de suspensão contra uma droga de uma semana de meia-vida.
 *
 * Funções puras — sem estado, sem I/O. A UI vive em
 * src/design-system/showcase/displays/InibidoresApetiteDisplay.jsx
 */

// =============================================================================
// CLASSES E DURAÇÃO
// =============================================================================

export const CLASSES = {
  glp1: { id: 'glp1', label: 'Agonistas do receptor GLP-1', ordem: 1 },
  coagonista: { id: 'coagonista', label: 'Coagonistas GLP-1/GIP', ordem: 2 },
  simpatico: { id: 'simpatico', label: 'Anorexígenos simpaticomiméticos', ordem: 3 },
  outros: { id: 'outros', label: 'Outros antiobesidade', ordem: 4 },
};

/** Duração de ação — é o eixo que a SBA usa para decidir 7 dias × 1 dia. */
export const DURACAO = {
  longa: { id: 'longa', label: 'Longa duração', dias: 7 },
  curta: { id: 'curta', label: 'Curta duração', dias: 1 },
};

// =============================================================================
// BASE DE FÁRMACOS
// -----------------------------------------------------------------------------
// Campos por entrada:
//   duracao            → 'longa' | 'curta' | null (fora da regra GLP-1)
//   retardaEsvaziamento→ define se a droga entra na conta de broncoaspiração
//   suspensao          → conduta de ROTINA (paciente sem fator de risco)
//   suspensaoAltoRisco → conduta quando há QUALQUER fator dos itens 7/8/9
//   resumo             → rótulo curto do badge (o badge não encolhe)
// =============================================================================

export const INIBIDORES = [
  // ------------------------------------------------------- AGONISTAS GLP-1
  {
    id: 'semaglutida_sc',
    grupo: 'semaglutida',
    grupoNome: 'Semaglutida',
    variante: 'Injetável',
    farmaco: 'Semaglutida injetável',
    comerciais: ['Ozempic', 'Wegovy'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '1×/semana',
    duracao: 'longa',
    meiaVida: '~7 dias',
    dosesTipicas: 'Ozempic 0,25 → 2,0 mg/sem · Wegovy 0,25 → 2,4 mg/sem',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo:
        'Meia-vida de ~7 dias, então entra na regra dos 7 dias. Sem POCUS gástrico disponível, a manutenção não é considerada (SBA itens 3.3 e 4).',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar quando houver dieta oral estabelecida e sem náusea/vômito. Sem prazo fixo em diretriz.',
    riscos: [
      'É o fármaco com mais relatos de resíduo gástrico sólido apesar do jejum habitual.',
      'Náusea e vômito no pós-operatório podem se somar aos da anestesia.',
    ],
    interacoes: [
      'Hipoglicemia só é relevante em associação com insulina ou sulfonilureia.',
      'Retarda a absorção de medicação oral tomada junto.',
    ],
    notas: {
      sba: 'Manutenção só é opção com POCUS gástrico sistemático no dia da cirurgia (SBA item 3).',
    },
  },
  {
    id: 'semaglutida_oral',
    grupo: 'semaglutida',
    grupoNome: 'Semaglutida',
    variante: 'Oral',
    farmaco: 'Semaglutida oral',
    comerciais: ['Rybelsus'],
    classe: 'glp1',
    via: 'Oral',
    regime: '1×/dia, em jejum',
    duracao: 'longa',
    meiaVida: '~7 dias',
    dosesTipicas: '3 · 7 · 14 mg/dia',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'A meia-vida é de ~7 dias, ainda que a tomada seja diária.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar com dieta oral estabelecida; exige jejum de 30 min após a tomada.',
    riscos: [
      '⚠️ Diária, mas de LONGA duração: as diretrizes que classificam por frequência de dose (ASA 2023) a tratariam como "suspender no dia". A farmacologia é de uma semana.',
    ],
    interacoes: ['Absorção própria é errática — qualquer alimento ou outro comprimido junto a reduz.'],
    notas: {
      sba: 'A SBA classifica por duração de ação, não por frequência de dose: cai na regra dos 7 dias.',
    },
  },
  {
    id: 'liraglutida',
    farmaco: 'Liraglutida',
    comerciais: ['Victoza', 'Saxenda'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '1×/dia',
    duracao: 'curta',
    meiaVida: '~13 h',
    dosesTipicas: 'Victoza 0,6 → 1,8 mg/dia · Saxenda 0,6 → 3,0 mg/dia',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 1,
      resumo: '1 dia',
      texto: '1 dia antes',
      motivo: 'Meia-vida de ~13 h, então basta pular a dose do dia anterior e a do dia da cirurgia.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar com dieta oral estabelecida. Reescalonar a dose se ficou mais de 3 dias sem usar.',
    riscos: ['O efeito no esvaziamento gástrico é menor que o da semaglutida, mas existe.'],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: { sba: 'Mesmo em curta duração, o alto risco leva a suspensão de 7 dias (SBA item 5).' },
  },
  {
    id: 'dulaglutida',
    farmaco: 'Dulaglutida',
    comerciais: ['Trulicity'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '1×/semana',
    duracao: 'longa',
    meiaVida: '~4,7 dias',
    dosesTipicas: '0,75 · 1,5 · 3,0 · 4,5 mg/sem',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Meia-vida de ~4,7 dias, então entra na regra dos 7 dias.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar na dose habitual com dieta oral estabelecida.',
    riscos: ['Efeito sobre o esvaziamento gástrico é menos pronunciado que o da semaglutida.'],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: {},
  },
  {
    id: 'exenatida',
    grupo: 'exenatida',
    grupoNome: 'Exenatida',
    variante: 'Diária',
    farmaco: 'Exenatida',
    comerciais: ['Byetta'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '2×/dia',
    duracao: 'curta',
    meiaVida: '~2,4 h',
    dosesTipicas: '5 → 10 µg 2×/dia',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 1,
      resumo: '1 dia',
      texto: '1 dia antes',
      motivo: 'Meia-vida de ~2,4 h, então basta pular as doses do dia anterior e do dia da cirurgia.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar com dieta oral estabelecida.',
    riscos: ['É a que mais retarda o esvaziamento por dose, mas o efeito passa rápido.'],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: {},
  },
  {
    id: 'exenatida_lar',
    grupo: 'exenatida',
    grupoNome: 'Exenatida',
    variante: 'Liberação prolongada',
    farmaco: 'Exenatida de liberação prolongada',
    comerciais: ['Bydureon'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '1×/semana',
    duracao: 'longa',
    meiaVida: 'Liberação por semanas',
    dosesTipicas: '2 mg/sem',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Microesferas liberam o fármaco por semanas — 7 dias é o mínimo da diretriz, não a depuração completa.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias · POCUS mesmo assim' },
    reinicio: 'Retomar na dose habitual com dieta oral estabelecida.',
    riscos: ['⚠️ Concentração ainda detectável semanas após a última dose — suspender não zera o risco.'],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: {},
  },
  {
    id: 'lixisenatida',
    farmaco: 'Lixisenatida',
    comerciais: ['Lyxumia'],
    classe: 'glp1',
    via: 'Subcutânea',
    regime: '1×/dia',
    duracao: 'curta',
    meiaVida: '~3 h',
    dosesTipicas: '10 → 20 µg/dia',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 1,
      resumo: '1 dia',
      texto: '1 dia antes',
      motivo: 'Meia-vida de ~3 h, então basta pular a dose do dia anterior e a do dia da cirurgia.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar com dieta oral estabelecida.',
    riscos: ['Efeito marcado sobre o esvaziamento gástrico pós-prandial.'],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: {},
  },

  // --------------------------------------------------- COAGONISTAS GLP-1/GIP
  {
    id: 'tirzepatida',
    farmaco: 'Tirzepatida',
    comerciais: ['Mounjaro'],
    classe: 'coagonista',
    via: 'Subcutânea',
    regime: '1×/semana',
    duracao: 'longa',
    meiaVida: '~5 dias',
    dosesTipicas: '2,5 → 15 mg/sem',
    retardaEsvaziamento: true,
    fonteSuspensao: { orgao: 'SBA', detalhe: 'Itens 4 e 5 da nota de 15/05/2026.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo:
        'Meia-vida de ~5 dias, então entra na regra dos 7 dias. A nota da SBA aplica ao coagonista GLP-1/GIP as mesmas regras dos agonistas GLP-1.',
    },
    suspensaoAltoRisco: { dias: 7, texto: 'No mínimo 7 dias' },
    reinicio: 'Retomar com dieta oral estabelecida. Reescalonar se houve interrupção longa.',
    riscos: [
      'Perda de peso e efeitos gastrointestinais mais intensos que os do GLP-1 isolado.',
      'A dupla ação GIP + GLP-1 não tem dado próprio de esvaziamento gástrico perioperatório — trate como semaglutida.',
    ],
    interacoes: ['Hipoglicemia com insulina ou sulfonilureia.'],
    notas: { sba: 'A nota SBA/SBD/ABESO 2026 é explícita em incluir os coagonistas GLP-1/GIP.' },
  },

  // -------------------------------------------- ANOREXÍGENOS SIMPATICOMIMÉTICOS
  {
    id: 'sibutramina',
    farmaco: 'Sibutramina',
    comerciais: ['Reductil', 'Biomag', 'Vazy'],
    classe: 'simpatico',
    via: 'Oral',
    regime: '1×/dia',
    duracao: null,
    meiaVida: 'Metabólitos ativos 14–16 h',
    dosesTipicas: '10 → 15 mg/dia (teto no Brasil: 15 mg)',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: Stephens & Katz, Anaesth Intens Care 2005.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Risco CARDIOVASCULAR e serotoninérgico, não de broncoaspiração.',
    },
    suspensaoAltoRisco: { dias: 7, texto: '7 dias — o motivo aqui não muda com o risco de aspiração' },
    reinicio: 'Retomar após alta, fora do uso de opioide serotoninérgico.',
    riscos: [
      'Hipertensão e taquicardia sustentadas; relatos de crise hipertensiva perioperatória.',
      'Arritmias; resposta exagerada a efedrina e outros simpaticomiméticos indiretos.',
      'Estoques de noradrenalina depletados podem dar HIPOtensão refratária — nesse caso use vasopressor de ação DIRETA (fenilefrina, noradrenalina).',
    ],
    interacoes: [
      '⚠️ Síndrome serotoninérgica com fentanil, tramadol, meperidina, ondansetrona em dose alta, azul de metileno e linezolida.',
      'Contraindicada com IMAO; intervalo de 14 dias entre os dois.',
    ],
    notas: {
      internacional: 'Stephens & Katz (Anaesth Intensive Care 2005) recomendam 1 semana; o SPAQI aceita ≥ 4 dias para a fentermina, da mesma classe.',
    },
  },
  {
    id: 'anfepramona',
    farmaco: 'Anfepramona (dietilpropiona)',
    comerciais: ['Hipofagin', 'Inibex'],
    classe: 'simpatico',
    via: 'Oral',
    regime: '1×/dia',
    duracao: null,
    meiaVida: '4–6 h (metabólitos mais longos)',
    dosesTipicas: '75 mg/dia (liberação prolongada)',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: farmacologia da classe.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Simpaticomimético: risco hemodinâmico.',
    },
    suspensaoAltoRisco: { dias: 7, texto: '7 dias' },
    reinicio: 'Retomar após alta.',
    riscos: [
      'Hipertensão, taquicardia e arritmia; hipertensão pulmonar em uso prolongado.',
      'Resposta imprevisível a efedrina — prefira vasopressor de ação direta.',
    ],
    interacoes: ['IMAO: intervalo de 14 dias.', 'Somatório com halogenados sensibilizando o miocárdio a catecolaminas.'],
    notas: {
      internacional: 'No Brasil, a comercialização foi reautorizada pela Lei 13.454/2017, sob prescrição.',
    },
  },
  {
    id: 'femproporex',
    farmaco: 'Femproporex',
    comerciais: ['Desobesi-M'],
    classe: 'simpatico',
    via: 'Oral',
    regime: '1×/dia',
    duracao: null,
    meiaVida: 'Metabolizado a anfetamina',
    dosesTipicas: '25 mg/dia',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: farmacologia da classe.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Pró-fármaco de anfetamina: risco hemodinâmico.',
    },
    suspensaoAltoRisco: { dias: 7, texto: '7 dias' },
    reinicio: 'Retomar após alta.',
    riscos: [
      'Converte-se em anfetamina — hipertensão, taquiarritmia, agitação.',
      '⚠️ Positiva o rastreio toxicológico para anfetamina; não interprete como uso ilícito.',
    ],
    interacoes: ['IMAO: intervalo de 14 dias.', 'Aumenta a CAM dos halogenados no uso agudo.'],
    notas: { internacional: 'Reautorizado no Brasil pela Lei 13.454/2017, sob prescrição.' },
  },
  {
    id: 'mazindol',
    farmaco: 'Mazindol',
    comerciais: ['Absten S', 'Fagolipo'],
    classe: 'simpatico',
    via: 'Oral',
    regime: '1×/dia',
    duracao: null,
    meiaVida: '~10 h',
    dosesTipicas: '1 → 3 mg/dia',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: farmacologia da classe.' },
    suspensao: {
      dias: 7,
      resumo: '7 dias',
      texto: '7 dias antes',
      motivo: 'Simpaticomimético: risco hemodinâmico.',
    },
    suspensaoAltoRisco: { dias: 7, texto: '7 dias' },
    reinicio: 'Retomar após alta.',
    riscos: ['Hipertensão e taquicardia; glaucoma de ângulo fechado.'],
    interacoes: ['IMAO: intervalo de 14 dias.'],
    notas: { internacional: 'Reautorizado no Brasil pela Lei 13.454/2017, sob prescrição.' },
  },

  // ---------------------------------------------------- OUTROS ANTIOBESIDADE
  {
    id: 'naltrexona_bupropiona',
    farmaco: 'Naltrexona + bupropiona',
    comerciais: ['Contrave', 'Mysimba'],
    classe: 'outros',
    via: 'Oral',
    regime: '2×/dia',
    duracao: null,
    meiaVida: 'Naltrexona 4 h; metabólito 6-β-naltrexol 13 h, com acúmulo',
    dosesTipicas: '8/90 mg até 32/360 mg/dia',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: SPAQI, Mayo Clin Proc 2021.' },
    suspensao: {
      dias: 3,
      resumo: '72 h',
      texto: '72 h antes, se for usar opioide',
      motivo: 'A naltrexona BLOQUEIA o receptor opioide — a analgesia planejada pode simplesmente não funcionar.',
    },
    suspensaoAltoRisco: { dias: 3, texto: '72 h antes, se for usar opioide' },
    reinicio: 'Só reintroduzir 7 a 10 dias depois da ÚLTIMA dose de opioide, sob risco de precipitar abstinência.',
    riscos: [
      '⚠️ Este é o fármaco desta lista que mais muda o plano anestésico: sem suspensão, conte com falha de analgesia opioide.',
      'Se a última dose foi há menos de 72 h, a dose de opioide necessária é maior e a depressão respiratória, quando o bloqueio cede, é mais profunda e mais prolongada.',
      'Bupropiona reduz o limiar convulsivo.',
    ],
    interacoes: [
      'Planeje analgesia MULTIMODAL: bloqueio regional, dipirona/paracetamol, AINE, cetamina, dexmedetomidina, lidocaína IV.',
      'Bupropiona: cuidado com outros agentes pró-convulsivantes e com IMAO.',
    ],
    notas: {
      internacional: 'SPAQI (Mayo Clin Proc 2021): suspender 72 h antes quando houver previsão de opioide no perioperatório.',
    },
  },
  {
    id: 'orlistate',
    farmaco: 'Orlistate',
    comerciais: ['Xenical', 'Lipiblock'],
    classe: 'outros',
    via: 'Oral',
    regime: '3×/dia, às refeições',
    duracao: null,
    meiaVida: 'Ação local no intestino; absorção mínima',
    dosesTipicas: '120 mg 3×/dia',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: age sobre a gordura da refeição.' },
    suspensao: {
      dias: 0,
      resumo: 'No dia',
      texto: 'Suspender no dia',
      motivo: 'Age sobre a gordura da refeição — com o paciente em jejum, não tem função.',
    },
    suspensaoAltoRisco: { dias: 0, texto: 'Suspender no dia' },
    reinicio: 'Retomar quando voltar a comer gordura.',
    riscos: [
      'Má absorção de vitaminas lipossolúveis. A queda da vitamina K pode ALARGAR o RNI de quem usa varfarina — cheque o RNI.',
      'Não retarda o esvaziamento gástrico: fica fora da conta de broncoaspiração.',
    ],
    interacoes: ['Reduz a absorção de ciclosporina, levotiroxina, amiodarona e anticonvulsivantes.'],
    notas: {},
  },
  {
    id: 'topiramato',
    farmaco: 'Topiramato',
    comerciais: ['Topamax', 'Amato'],
    classe: 'outros',
    via: 'Oral',
    regime: '1–2×/dia',
    duracao: null,
    meiaVida: '~21 h',
    dosesTipicas: '25 → 200 mg/dia no uso para peso',
    retardaEsvaziamento: false,
    fonteSuspensao: { orgao: 'Fora da nota da SBA', detalhe: 'Base: risco de convulsão na retirada.' },
    suspensao: {
      dias: 0,
      resumo: 'Manter',
      texto: 'Manter — não suspender',
      motivo: 'Suspensão abrupta baixa o limiar convulsivo em quem também o usa como anticonvulsivante.',
    },
    suspensaoAltoRisco: { dias: 0, texto: 'Manter — não suspender' },
    reinicio: 'Não se aplica — mantido no perioperatório.',
    riscos: [
      '⚠️ Causa acidose metabólica hiperclorêmica SEM ânion gap, por inibição da anidrase carbônica. Bicarbonato baixo na gasometria pré-operatória pode ser o fármaco, não hipoperfusão.',
      'Nefrolitíase; parestesias; oligoidrose com hipertermia.',
    ],
    interacoes: ['Somatório com acetazolamida e com dieta cetogênica.'],
    notas: {
      internacional: 'Usado no Brasil off-label para peso, isolado ou associado; a associação fentermina/topiramato não tem registro na ANVISA.',
    },
  },
];

// =============================================================================
// FATORES DE RISCO — itens 7, 8 e 9 da nota SBA C.SBA-01744/2026
// =============================================================================

export const FATORES_RISCO = [
  {
    grupo: 'tecnica',
    label: 'Técnica anestésica',
    fonte: 'SBA item 7',
    itens: [
      {
        id: 'sedacao_sem_via_aerea',
        label: 'Sedação moderada ou profunda sem via aérea com balonete',
        detalhe: 'Eletroconvulsoterapia, radiologia intervencionista, endoscopia sob sedação.',
      },
      {
        id: 'protecao_prejudicada',
        label: 'Proteção de via aérea prejudicada',
        detalhe: 'Cabeça imobilizada, decúbito ventral ou sedação com mais de 30 minutos.',
      },
      {
        id: 'via_aerea_dificil',
        label: 'Previsão de via aérea difícil',
        detalhe: 'Diagnosticada na avaliação pré-anestésica ou pelo anestesiologista assistente.',
      },
    ],
  },
  {
    grupo: 'farmaco',
    label: 'Uso do fármaco',
    fonte: 'SBA item 8',
    itens: [
      {
        id: 'inicio_recente',
        label: 'Início há menos de 12 semanas',
        detalhe: 'A dose só é considerada estável depois de 12 semanas sem mudança.',
      },
      {
        id: 'escalonamento',
        label: 'Dose aumentada ou em escalonamento nos últimos 3 meses',
        detalhe: 'A fase de escalonamento é a de maior retardo do esvaziamento gástrico.',
      },
      {
        id: 'sintomas_tgi',
        label: 'Sintomas gastrointestinais',
        detalhe: 'Náusea, vômito, refluxo, plenitude gástrica ou empachamento, dispepsia. A AUSÊNCIA de sintomas não exclui resíduo gástrico.',
      },
      {
        id: 'uso_irregular',
        label: 'Uso irregular ou sem acompanhamento médico',
        detalhe: 'Uso errático, sem indicação clara ou sem acompanhamento especializado.',
      },
    ],
  },
  {
    grupo: 'paciente',
    label: 'Paciente',
    fonte: 'SBA item 9',
    itens: [
      { id: 'hba1c', label: 'HbA1c > 8% ou diabetes há mais de 8 anos', detalhe: 'Neuropatia autonômica somada ao efeito do fármaco.' },
      { id: 'gastroparesia', label: 'Gastroparesia documentada', detalhe: '' },
      { id: 'cirurgia_gi', label: 'Cirurgia gastrointestinal prévia', detalhe: 'Inclui cirurgia bariátrica.' },
      { id: 'residuo_eda', label: 'Resíduo gástrico em endoscopia prévia', detalhe: 'Achado documentado em EDA anterior.' },
      { id: 'obstrucao', label: 'Obstrução gastrointestinal suspeita ou documentada', detalhe: '' },
      { id: 'acalasia', label: 'Acalasia', detalhe: '' },
      { id: 'imc40', label: 'IMC ≥ 40', detalhe: '' },
      { id: 'opioide_cronico', label: 'Uso crônico de opioides', detalhe: '' },
      {
        id: 'outras_drogas',
        label: 'Outras drogas que lentificam o esvaziamento',
        detalhe: 'Antidepressivos tricíclicos, anticolinérgicos, bloqueadores de canal de cálcio.',
      },
      {
        id: 'degluticao',
        label: 'Dificuldade de deglutição ou doença neurológica limitante',
        detalhe: 'Especialmente em idosos.',
      },
    ],
  },
];

// =============================================================================
// DIETA E JEJUM — SBA item 6
// =============================================================================

export const DIETA = {
  regra: 'Dieta líquida sem resíduos nas 24 h que antecedem o procedimento, com jejum completo de 8 a 12 h. Vale para TODOS os pacientes em uso, tenham ou não fator de risco.',
  permitidos: [
    'Água',
    'Café preto, sem leite',
    'Chá',
    'Água de coco sem resíduos',
    'Sucos coados e sem polpa',
    'Bebidas de carboidrato sem resíduos (glicose, frutose, maltodextrina)',
    'Soluções de reidratação oral',
  ],
  proibidos: [
    'Qualquer alimento sólido',
    'Leite e derivados',
    'Sucos com polpa ou resíduo',
    'Caldos com pedaços',
  ],
  nota: 'A evidência vem da redução de resíduo gástrico em colonoscopia com dieta líquida sem resíduos por 24 h. Para quem JÁ suspendeu o fármaco, não há evidência de a partir de quando a dieta deixa de agregar — siga o protocolo da instituição.',
};

// =============================================================================
// POCUS GÁSTRICO — SBA item 3 + Perlas (Can J Anaesth 2018;65:437-48)
// =============================================================================

export const POCUS_QUANDO = [
  'No DIA da cirurgia eletiva, nunca antes.',
  'Depois da admissão do paciente e até pelo menos 1 hora antes do início da anestesia.',
  'Por profissional treinado, com aparelho de qualidade disponível no centro cirúrgico.',
  'Sem essa estrutura, a manutenção do fármaco não deve ser considerada — suspenda pela regra dos 7 dias / 1 dia.',
];

export const POCUS_PASSOS = [
  'Transdutor curvilíneo de baixa frequência (2–5 MHz), plano parassagital no epigástrio.',
  'Referências internas: lobo esquerdo do fígado, veia cava inferior e veia mesentérica superior.',
  'Avalie primeiro em decúbito dorsal e depois em DECÚBITO LATERAL DIREITO — é neste que o volume é estimado.',
  'Meça o antro entre contrações: dois diâmetros perpendiculares, anteroposterior e craniocaudal.',
  'Antro vazio tem aspecto de "alvo"; líquido claro é hipoecoico; sólido dá o padrão de "vidro fosco" com sombra.',
];

export const PERLAS_GRAUS = [
  {
    grau: 0,
    titulo: 'Grau 0 — antro vazio',
    descricao: 'Sem conteúdo em decúbito dorsal nem em lateral direito.',
    risco: 'baixo',
    conduta: 'Prosseguir com segurança.',
  },
  {
    grau: 1,
    titulo: 'Grau 1 — líquido só em lateral direito',
    descricao: 'Compatível com volume basal de jejum, em geral ≤ 1,5 mL/kg.',
    risco: 'baixo',
    conduta: 'Prosseguir com segurança, confirmando o volume estimado.',
  },
  {
    grau: 2,
    titulo: 'Grau 2 — líquido nas duas posições',
    descricao: 'Volume estimado acima de 1,5 mL/kg.',
    risco: 'alto',
    conduta: 'Adiar a cirurgia eletiva ou prosseguir com intubação em sequência rápida.',
  },
  {
    grau: null,
    titulo: 'Conteúdo sólido ou particulado',
    descricao: 'Padrão de vidro fosco, com ou sem sombra acústica. Independe de volume.',
    risco: 'alto',
    conduta: 'Adiar a cirurgia eletiva ou prosseguir com intubação em sequência rápida.',
  },
];

/** Corte de volume que separa baixo e alto risco (mL/kg). */
export const LIMIAR_VOLUME_ML_KG = 1.5;

// =============================================================================
// CONDUTA NO DIA E SEQUÊNCIA RÁPIDA
// =============================================================================

/**
 * O único item da conduta que é DE GLP-1, e não de estômago cheio em geral.
 * Mora fora da lista porque pertence ao momento de REAVALIAR na admissão —
 * é ali que a tentação de confiar no jejum aparece —, não ao de conduzir.
 */
export const AVISO_JEJUM_NAO_BASTA =
  'Não se acomode com o tempo de jejum: nestes pacientes ele não afasta resíduo gástrico.';

export const CONDUTA_ALTO_RISCO = [
  'Adiar o procedimento eletivo é a primeira opção sempre que ele puder esperar.',
  'Não podendo adiar: intubação em sequência rápida, com via aérea protegida por tubo com balonete.',
  'Planeje a via aérea antes — inclusive o plano B — e tenha aspiração de grosso calibre testada e ao alcance.',
  'Considere descompressão gástrica por sonda antes da extubação, quando houver conteúdo.',
  'Extube acordado, com reflexos protetores presentes.',
];

// =============================================================================
// FLUXO DA CONSULTA PRÉ-ANESTÉSICA — SBA itens 1, 2 e 3
// =============================================================================

export const PRE_ANESTESICA = [
  {
    id: 'triagem',
    titulo: 'Pergunte a todo mundo, e pelos últimos 6 meses',
    itens: [
      'Todo paciente de cirurgia eletiva que usou GLP-1 ou coagonista GLP-1/GIP nos ÚLTIMOS 6 MESES deve ser avaliado com antecedência.',
      'Pergunte pelo nome comercial: muita gente não sabe que Ozempic, Mounjaro, Saxenda ou Wegovy são a mesma classe.',
      'Registre a dose e a data e hora da última aplicação.',
      'Fórmula manipulada e compra sem prescrição são comuns — pergunte diretamente.',
    ],
  },
  {
    id: 'decisao',
    titulo: 'Decida junto, e por escrito',
    itens: [
      'A decisão de manter ou suspender é da equipe de anestesiologia, compartilhada com a equipe cirúrgica e a endocrinologia.',
      'Pese o custo-benefício da suspensão contra o risco de broncoaspiração e a urgência do procedimento.',
      'A SBA sugere um termo de consentimento PRÓPRIO para estes pacientes, aplicado junto com o termo geral de anestesia.',
      'Institua um protocolo interno: a nota é explícita em recomendar que cada serviço tenha o seu.',
    ],
  },
  {
    id: 'estrutura',
    titulo: 'Manter o fármaco exige estrutura',
    itens: [
      'A manutenção só é opção onde o POCUS gástrico é feito de forma sistemática, por gente treinada e com aparelho no centro cirúrgico.',
      'Sem essa estrutura, não considere manter: suspenda pela regra dos 7 dias / 1 dia.',
      'Mesmo tendo suspendido, faça o POCUS sempre que ele estiver disponível.',
    ],
  },
];

// =============================================================================
// COMPARATIVO — Tabela 1 da nota SBA C.SBA-01744/2026
// =============================================================================

export const COMPARATIVO = [
  {
    id: 'sba',
    fonte: 'SBA / SBD / ABESO 2026',
    principal: true,
    suspensao: 'Não rotineira se a dose está estável há mais de 12 semanas e não há fator de risco. Suspensão seletiva: longa ação 7 dias, curta ação 1 dia, em alto risco, escalonamento ou uso instável por menos de 12 semanas.',
    dieta: 'Dieta líquida 24 h + jejum de 8 a 12 h.',
    pocus: 'Recomendada quando disponível.',
  },
  {
    id: 'anzca',
    fonte: 'ANZCA 2025',
    suspensao: 'Suspensão não recomendada.',
    dieta: 'Dieta obrigatória com líquidos sem resíduos por 24 h + jejum total de 6 h.',
    pocus: 'Recomendada.',
  },
  {
    id: 'spaqi',
    fonte: 'SPAQI 2025',
    suspensao: 'Não recomendada em pacientes sem sintomas gastrointestinais significativos. Com sintomas intensos (náusea, vômito, dificuldade de ingerir alimentos), adiar.',
    dieta: 'Líquidos sem resíduos obrigatórios por 24 h para todos + nada por via oral nas últimas 4 h. Jejum de 8 h para líquidos com 10% ou mais de glicose, se não houver sintomas.',
    pocus: 'Recomendada.',
  },
  {
    id: 'aoa',
    fonte: 'AOA / RCOA 2025',
    suspensao: 'Suspensão não recomendada.',
    dieta: 'Não detalha.',
    pocus: 'Recomenda considerar.',
  },
  {
    id: 'asa',
    fonte: 'ASA + ASMBS 2025',
    suspensao: 'Suspensão rotineira não recomendada. Em alto risco (escalonamento, dose alta, longa ação, sintomas gastrointestinais ou condições associadas), suspensão seletiva: longa ação 7 dias, curta ação 1 dia.',
    dieta: 'Dieta líquida 24 h antes, nos casos de alto risco.',
    pocus: 'Recomendada.',
  },
];

// =============================================================================
// CO-MEDICAÇÃO QUE VIAJA JUNTO
// =============================================================================

export const COMEDICACAO = [
  {
    id: 'sglt2',
    titulo: 'Inibidores de SGLT2',
    detalhe: 'Dapagliflozina, empagliflozina, canagliflozina. Não são inibidores de apetite, mas acompanham metade destes pacientes. Suspender 3 a 4 dias antes pelo risco de cetoacidose euglicêmica — glicemia normal NÃO afasta o diagnóstico; peça cetonemia se houver acidose inexplicada.',
  },
  {
    id: 'insulina',
    titulo: 'Insulina e sulfonilureia',
    detalhe: 'É a associação que transforma o GLP-1 em risco de hipoglicemia. Reveja a dose com a endocrinologia e meça a glicemia na admissão.',
  },
  {
    id: 'metformina',
    titulo: 'Metformina',
    detalhe: 'Pode ser mantida até o dia da cirurgia na maioria dos protocolos; suspender se houver risco de injúria renal aguda ou uso de contraste iodado.',
  },
];

// =============================================================================
// REFERÊNCIAS
// =============================================================================

export const REFERENCIAS = [
  {
    id: 'sba2026',
    titulo: 'SBA — Nota de atualização sobre o manejo perioperatório dos agonistas do receptor GLP-1 e coagonistas GLP-1/GIP',
    detalhe: 'C.SBA-01744/2026, 15 de maio de 2026. Consenso SBA + SBD + ABESO. Fonte primária deste card.',
  },
  {
    id: 'sbd2026',
    titulo: 'Marino EC et al. Perioperative screening and management of hyperglycemia: joint position statement SBD/SBA/ABESO',
    detalhe: 'Diabetol Metab Syndr. 2026;18(1):91. doi:10.1186/s13098-025-02060-5',
  },
  {
    id: 'spaqi2025',
    titulo: 'Oprea AD et al. SPAQI multidisciplinary consensus statement',
    detalhe: 'Br J Anaesth. 2025;135(1):48-78. doi:10.1016/j.bja.2025.04.001',
  },
  {
    id: 'multi2025',
    titulo: 'Kindel TL et al. Multisociety Clinical Practice Guidance (ASA, AGA, ASMBS, ISPCOP, SAGES)',
    detalhe: 'Clin Gastroenterol Hepatol. 2025;23(12):2083-5. doi:10.1016/j.cgh.2024.10.003',
  },
  {
    id: 'elboghdadly',
    titulo: 'El-Boghdadly K et al. Elective peri-operative management of adults taking GLP-1RA, GIP agonists and SGLT2 inhibitors',
    detalhe: 'Anaesthesia. 2025;80:412-424. doi:10.1111/anae.16541',
  },
  {
    id: 'perlas',
    titulo: 'Perlas A, Arzola C, Van de Putte P. Point-of-care gastric ultrasound and aspiration risk assessment',
    detalhe: 'Can J Anaesth. 2018;65(4):437-48. doi:10.1007/s12630-017-1031-9',
  },
  {
    id: 'nersessian',
    titulo: 'Nersessian RSF et al. Residual gastric content and peri-operative semaglutide use assessed by gastric ultrasound',
    detalhe: 'Anaesthesia. 2024;79(12):1317-24. Estudo brasileiro. doi:10.1111/anae.16454',
  },
  {
    id: 'spaqi_gi',
    titulo: 'SPAQI — Preoperative Management of Gastrointestinal and Pulmonary Medications',
    detalhe: 'Mayo Clin Proc. 2021. Origem da regra de 72 h para naltrexona/bupropiona.',
  },
];

// =============================================================================
// FUNÇÕES PURAS
// =============================================================================

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Busca por nome do fármaco, marca comercial ou classe. */
export function buscarFarmacos(termo) {
  const t = semAcento(termo).trim();
  if (!t) return INIBIDORES;
  return INIBIDORES.filter((f) => {
    const alvo = [f.farmaco, f.regime, CLASSES[f.classe]?.label, ...(f.comerciais || [])]
      .map(semAcento)
      .join(' ');
    return alvo.includes(t);
  });
}

export function getFarmaco(id) {
  return INIBIDORES.find((f) => f.id === id) || null;
}

/** Agrupa por classe respeitando a ordem declarada em CLASSES. */
export function agruparPorClasse(lista = INIBIDORES) {
  const mapa = new Map();
  lista.forEach((f) => {
    if (!mapa.has(f.classe)) mapa.set(f.classe, []);
    mapa.get(f.classe).push(f);
  });
  return Array.from(mapa.entries())
    .map(([classe, farmacos]) => ({
      classe,
      label: CLASSES[classe]?.label || classe,
      ordem: CLASSES[classe]?.ordem ?? 99,
      farmacos,
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

/** Lista plana de todos os fatores de risco, com o grupo de origem. */
export function todosFatores() {
  return FATORES_RISCO.flatMap((g) =>
    g.itens.map((i) => ({ ...i, grupo: g.grupo, grupoLabel: g.label, fonte: g.fonte }))
  );
}

export function getFator(id) {
  return todosFatores().find((f) => f.id === id) || null;
}

/** "7 dias" / "1 dia" / "No dia" / "72 h" — rótulo curto e legível. */
export function diasParaTexto(dias) {
  if (dias == null) return '—';
  if (dias === 0) return 'No dia';
  if (dias === 1) return '1 dia';
  if (dias === 3) return '72 h';
  return `${dias} dias`;
}

export function formatarMomento(data) {
  if (!data) return null;
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Quanto falta (ou passou) até um instante alvo.
 * Devolve { falta: boolean, texto } — nunca número cru, é rótulo de tela.
 */
export function faltamTexto(alvo, agora = new Date()) {
  if (!alvo) return null;
  const ms = alvo.getTime() - agora.getTime();
  const falta = ms > 0;
  const horas = Math.abs(ms) / 36e5;
  let texto;
  if (horas < 1) texto = `${Math.round(Math.abs(ms) / 6e4)} min`;
  else if (horas < 48) texto = `${Math.round(horas)} h`;
  else texto = `${Math.round(horas / 24)} dias`;
  return { falta, texto: falta ? `faltam ${texto}` : `há ${texto}` };
}

/**
 * Quando o intervalo de suspensão se completa a partir da última dose.
 * `dias === 0` (suspender no dia / manter) não gera alvo: não há espera.
 */
export function calcularLiberacao(ultimaDose, dias, agora = new Date()) {
  if (!ultimaDose || dias == null || dias <= 0) return null;
  const base = ultimaDose instanceof Date ? ultimaDose : new Date(ultimaDose);
  if (Number.isNaN(base.getTime())) return null;
  const alvo = new Date(base.getTime() + dias * 24 * 36e5);
  const f = faltamTexto(alvo, agora);
  return {
    alvo,
    texto: formatarMomento(alvo),
    falta: f?.texto || '',
    cumprido: !f?.falta,
  };
}

/**
 * Área antral em cm² pela elipse: π × AP × CC / 4.
 * Diâmetros em cm, medidos em decúbito lateral DIREITO.
 */
export function areaAntral({ ap, cc } = {}) {
  const a = Number(ap);
  const c = Number(cc);
  if (!Number.isFinite(a) || !Number.isFinite(c) || a <= 0 || c <= 0) return null;
  return (Math.PI * a * c) / 4;
}

/**
 * Volume gástrico estimado (mL) pela fórmula de Perlas, validada em decúbito
 * lateral direito para adultos não gestantes com IMC < 40:
 *   V = 27,0 + 14,6 × ACSA − 1,28 × idade
 * Fora do intervalo validado de ACSA (até ~10 cm²) o resultado é extrapolação.
 */
export function volumeGastrico({ acsa, idade } = {}) {
  const a = Number(acsa);
  const i = Number(idade);
  if (!Number.isFinite(a) || !Number.isFinite(i) || a <= 0 || i <= 0) return null;
  const v = 27.0 + 14.6 * a - 1.28 * i;
  return Math.max(0, v);
}

/**
 * Classifica o achado do POCUS.
 * `solido` vence qualquer volume: conteúdo particulado é alto risco por si.
 */
export function classificarPocus({ solido = false, volumeMl, pesoKg } = {}) {
  if (solido) {
    return {
      grau: null,
      risco: 'alto',
      titulo: 'Conteúdo sólido ou particulado',
      conduta: 'Adiar a cirurgia eletiva ou prosseguir com intubação em sequência rápida.',
      mlPorKg: null,
    };
  }
  const v = Number(volumeMl);
  const p = Number(pesoKg);
  if (!Number.isFinite(v) || !Number.isFinite(p) || p <= 0) return null;
  const mlPorKg = v / p;
  const alto = mlPorKg > LIMIAR_VOLUME_ML_KG;
  return {
    grau: alto ? 2 : 1,
    risco: alto ? 'alto' : 'baixo',
    titulo: alto ? 'Grau 2 — volume acima do limiar' : 'Grau 0 ou 1 — volume compatível com jejum',
    conduta: alto
      ? 'Adiar a cirurgia eletiva ou prosseguir com intubação em sequência rápida.'
      : 'Prosseguir com segurança.',
    mlPorKg,
  };
}

/**
 * Conduta pré-operatória a partir do fármaco, dos fatores marcados e da
 * estrutura disponível. É o algoritmo dos itens 3, 4, 5 e 6 da nota da SBA.
 *
 * Devolve sempre a MESMA forma, com `risco`, a conduta escolhida, o intervalo
 * de suspensão que vale para o caso e os passos que se aplicam a todos.
 */
export function avaliarPreOperatorio({
  farmacoId,
  fatores = [],
  pocusDisponivel = false,
  ultimaDose = null,
  agora = new Date(),
} = {}) {
  const farmaco = getFarmaco(farmacoId);
  if (!farmaco) return null;

  const ativos = todosFatores().filter((f) => fatores.includes(f.id));
  const alto = ativos.length > 0;

  // Fármaco que não retarda o esvaziamento sai do algoritmo de aspiração: a
  // suspensão dele existe por outro motivo (hemodinâmico, opioide, RNI).
  if (!farmaco.retardaEsvaziamento) {
    return {
      farmaco,
      foraDoAlgoritmo: true,
      risco: 'na',
      fatoresAtivos: ativos,
      explicacao: farmaco.suspensao?.motivo || '',
      suspensao: farmaco.suspensao,
      liberacao: calcularLiberacao(ultimaDose, farmaco.suspensao?.dias, agora),
      conduta: {
        id: 'fora_algoritmo',
        tom: 'info',
        chip: 'Outro motivo',
        heroi: farmaco.suspensao?.texto || '—',
        titulo: 'Fora do algoritmo de broncoaspiração',
        texto: `${farmaco.farmaco} não retarda o esvaziamento gástrico. A conduta abaixo existe por outro motivo — leia os riscos do fármaco.`,
      },
      passos: [],
      avisos: farmaco.riscos || [],
    };
  }

  const suspensao = alto ? farmaco.suspensaoAltoRisco : farmaco.suspensao;

  /* ⚠️ `heroi` existe porque o card do veredito é UM só desde 26/08 (o dono
     apagou o alerta que o duplicava). O número sozinho MENTIRIA no caso
     "manter": ler "7 dias antes" em corpo 24 quando a conduta é não suspender
     é o oposto da conduta. Daí o herói ser a FRASE do veredito, e o intervalo
     descer para `alternativa`. */
  let conduta;
  if (alto) {
    conduta = {
      id: 'alto_risco',
      tom: 'destructive',
      chip: 'Alto risco',
      heroi: suspensao?.texto || '—',
      titulo: 'Alto risco — suspender por no mínimo 7 dias',
      texto:
        'SBA item 5: havendo fator de risco, suspenda por no mínimo 7 dias antes da data programada. Faça POCUS gástrico no dia e prepare-se para adiar ou para sequência rápida.',
    };
  } else if (pocusDisponivel) {
    conduta = {
      id: 'manter',
      tom: 'success',
      chip: 'Pode manter',
      heroi: 'Não é obrigatória',
      titulo: 'Suspensão não é obrigatória',
      texto:
        'SBA item 3: dose estável, sem fator de risco e com POCUS gástrico sistemático disponível — o fármaco pode ser mantido. O achado do ultrassom no dia é que decide.',
      alternativa: `Optando por suspender assim mesmo: ${farmaco.suspensao?.texto || '—'}.`,
    };
  } else {
    conduta = {
      id: 'suspender_rotina',
      tom: 'warning',
      chip: 'Suspender',
      heroi: suspensao?.texto || '—',
      titulo: `Suspender ${suspensao?.texto || '—'}`,
      texto:
        'SBA itens 3.3 e 4: sem POCUS gástrico sistemático no centro cirúrgico, a manutenção não deve ser considerada. Suspenda pela duração de ação do fármaco.',
    };
  }

  const passos = [
    DIETA.regra,
    'Confirme a data e a hora da última aplicação na admissão.',
    'Reavalie sintomas gastrointestinais no DIA, mesmo que a pré-anestésica estivesse limpa.',
    pocusDisponivel
      ? 'Faça o POCUS gástrico depois da admissão e até 1 h antes da anestesia.'
      : 'Faça o POCUS gástrico assim que houver aparelho e profissional disponíveis.',
  ];

  const avisos = [];
  if (alto) {
    avisos.push('A ausência de sintomas gastrointestinais NÃO exclui resíduo gástrico aumentado.');
  }
  if (!alto && !pocusDisponivel) {
    avisos.push('Suspender sem POCUS não garante estômago vazio — mantenha o plano de sequência rápida à mão.');
  }
  if (farmaco.riscos?.length) avisos.push(...farmaco.riscos);

  return {
    farmaco,
    foraDoAlgoritmo: false,
    risco: alto ? 'alto' : 'padrao',
    fatoresAtivos: ativos,
    /* O `motivo` do fármaco explica por que se suspende; no veredito "manter"
       ele contradiz a conduta, então ali quem explica é a própria conduta. */
    explicacao: conduta.id === 'manter' ? conduta.texto : suspensao?.motivo || conduta.texto,
    suspensao,
    liberacao: calcularLiberacao(ultimaDose, suspensao?.dias, agora),
    conduta,
    passos,
    avisos,
  };
}

export default {
  CLASSES,
  DURACAO,
  INIBIDORES,
  FATORES_RISCO,
  DIETA,
  POCUS_QUANDO,
  POCUS_PASSOS,
  PERLAS_GRAUS,
  LIMIAR_VOLUME_ML_KG,
  AVISO_JEJUM_NAO_BASTA,
  CONDUTA_ALTO_RISCO,
  PRE_ANESTESICA,
  COMPARATIVO,
  COMEDICACAO,
  REFERENCIAS,
  buscarFarmacos,
  getFarmaco,
  agruparPorClasse,
  todosFatores,
  getFator,
  diasParaTexto,
  formatarMomento,
  faltamTexto,
  calcularLiberacao,
  areaAntral,
  volumeGastrico,
  classificarPocus,
  avaliarPreOperatorio,
};
