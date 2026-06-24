/**
 * Núcleo de cálculo da codificação anestésica Unimed (puro, testável).
 *
 * Dado o conjunto de códigos autorizados de uma guia (já buscados na tabela de referência),
 * calcula por código: porte, valor base, percentual aplicado (múltiplos procedimentos) e valor
 * a pagar — para cirurgião e anestesista — e, quando a anestesia zera, recomenda o(s) código(s)
 * 31602 a adicionar com justificativa. Ver premissas/caveats em codificacaoAnestRules.js.
 */
import {
  REGRAS_PADRAO,
  MULTIPLICADORES,
  CASCATA_PERCENTUAL,
  RECOMENDACAO_EXAME,
} from './codificacaoAnestRules';
import { CODIGOS_ANESTESIA_MAP } from '@/data/codigosAnestesia';
import {
  LISTA_31602312,
  SEM_ATO_ANESTESICO,
  INDICADOR_UTM,
  dobraAcomodacao,
  motivoNaoDobra,
  indicaSegundoAnestesista,
} from '@/data/codificacaoAnestProtocolo';

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

/** Clampa um percentual em [0,100]; input nulo ou não-numérico cai no padrão (evita NaN no valor da linha). */
const clampPct = (v, padrao) => {
  if (v == null) return padrao;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : padrao;
};

/** Detalhe de um código recomendado a partir da referência curada. */
function detalheCodigo(codigo) {
  const r = CODIGOS_ANESTESIA_MAP[codigo];
  return r
    ? { codigo: r.codigo, descricao: r.descricao, valor: r.valor, indicador: r.indicador }
    : { codigo, descricao: null, valor: null, indicador: null };
}

/**
 * Recomenda o código 31602 a cobrar quando a anestesia não é paga embutida, seguindo a
 * hierarquia oficial das Instruções Gerais v2026.03 (seção 4.3). Retorna `null` quando o
 * procedimento NUNCA comporta ato anestésico (4.3.3).
 */
export function recomendarCodigo(registro) {
  const codigo = String(registro?.codigo || '');
  const desc = registro?.descricao || '';

  // 4.3.3 — procedimentos que em nenhuma hipótese estão vinculados ao ato anestésico.
  if (SEM_ATO_ANESTESICO.has(codigo)) return null;

  // 4.3.1 — exame específico (regex por natureza): RM/TC/US/endoscopia/angio/radio/nuclear.
  const exame = RECOMENDACAO_EXAME.find((e) => e.rx.test(desc));
  if (exame) {
    return {
      principal: detalheCodigo(exame.codigo),
      alternativa: exame.codigo === '31602304' ? null : detalheCodigo('31602304'),
      motivo: 'exame',
    };
  }

  // 4.3.2 — lista oficial de procedimentos sem previsão de anestesia → 31602312 (indicador A).
  if (LISTA_31602312.has(codigo)) {
    return {
      principal: detalheCodigo('31602312'),
      alternativa: detalheCodigo('31602355'),
      motivo: 'lista_312',
    };
  }

  // 4.3.4 — fallback p/ procedimento não listado: diagnóstico → 31602304 (B); terapêutico →
  // 31602355 (E, imperativo clínico). Aproxima diagnóstico↔SADT, terapêutico↔HM/cirúrgico.
  if (registro?.lista === 'SADT') {
    return {
      principal: detalheCodigo('31602304'),
      alternativa: detalheCodigo('31602312'),
      motivo: 'diagnostico',
    };
  }
  return {
    principal: detalheCodigo('31602355'),
    alternativa: detalheCodigo('31602312'),
    motivo: 'imperativo',
  };
}

/**
 * @param {Array<{codigo:string, registro?:object|null, via?:string}>} itens
 * @param {Array<{codigo:string, registro?:object|null, quantidade?:number, percentual?:number}>} itens
 * @param {{tabela?:string, valorAdicional?:number, acomodacaoMult?:number, urgencia?:boolean, regras?:object}} [opts]
 */
export function calcularGuia(itens, opts = {}) {
  const regras = { ...REGRAS_PADRAO, ...(opts.regras || {}) };
  const tabelaPedida = opts.tabela || regras.tabela;
  const tabela = MULTIPLICADORES[tabelaPedida] != null ? tabelaPedida : regras.tabela;
  // fatorTabela = tabela de honorário (local 1,75 / intercâmbio 1,17). A DOBRA de acomodação
  // (apartamento/privativo/hospital-dia/UTI) é POR CÓDIGO (item XIV): 3xxx cirúrgico dobra geral;
  // 1/2/4 só se listados em LISTA_DOBRA; SADT não dobra (salvo listado). Ver dobraAcomodacao().
  const fatorTabela = MULTIPLICADORES[tabela] / MULTIPLICADORES.intercambio;
  const acomodacaoMult = Number(opts.acomodacaoMult) > 0 ? Number(opts.acomodacaoMult) : 1;
  const valorAdicional = Number(opts.valorAdicional) || 0;
  // Urgência/emergência: +30% (item 1.3.1). Só HM — SADT nunca sofre acréscimo (item 1.3.2).
  const urgencia = !!opts.urgencia;
  // UTM "crua" de um código: anestesia vem do indicador (tabela 4.1); senão deriva do valor (÷1,17).
  const utmDoValor = (valor) => (valor == null ? null : round2(valor / MULTIPLICADORES.intercambio));
  let sadtDiagCount = 0; // limite de 3 procedimentos p/ anestesia SADT diagnóstico (item 4.16)

  // Escala os valores de um código recomendado pelo fator da linha (valores de
  // CODIGOS_ANESTESIA_MAP estão em intercâmbio; ver detalheCodigo).
  const escalarRec = (rec, fator) => {
    if (!rec) return rec;
    const esc = (d) => (d && d.valor != null ? { ...d, valor: round2(d.valor * fator) } : d);
    return { ...rec, principal: esc(rec.principal), alternativa: esc(rec.alternativa) };
  };

  // Monta linhas. Percentual é POR LINHA (modelo Volan): default 100%, editável pelo faturista.
  // Cascata oficial de redutores em sugerirPercentuais (v2026.03 2.1.21/4.6).
  const linhas = (itens || []).map((item, i) => {
    const reg = item.registro || null;
    const encontrado = !!reg;
    const quantidade = Math.max(1, Math.round(Number(item.quantidade) || 1));
    const percentual = clampPct(item.percentual, regras.percentualPadrao);
    const escala = (percentual / 100) * quantidade;
    // % do código de anestesia RECOMENDADO (cascata da anestesia — independente do % do procedimento).
    const recPercentual = clampPct(item.recPercentual, 100);

    // Dobra de acomodação por código (item XIV). A anestesia recomendada segue a elegibilidade
    // do PRÓPRIO procedimento (SADT não dobra nem para o anestesista — item VIII).
    const dobra = acomodacaoMult > 1 && encontrado && dobraAcomodacao(reg.codigo, reg.lista) ? acomodacaoMult : 1;
    // Urgência só incide sobre HM (item 1.3.2 exclui SADT). Segue a lista do procedimento.
    const urgFator = urgencia && encontrado && reg.lista === 'HM' ? 1.3 : 1;
    const fator = fatorTabela * dobra * urgFator;

    const valorCirBase = encontrado && reg.valorCirurgiao != null ? round2(reg.valorCirurgiao * fator) : null;
    // só conta como "paga embutida" se houver indicador E valor — senão pagaria zero
    const temIndicador = encontrado && reg.indicadorAnestesico != null && reg.valorAnestesista != null;
    const valorAneBase = temIndicador ? round2(reg.valorAnestesista * fator) : null;

    // Recomendação 31602 (null = procedimento que nunca comporta anestesia, regra 4.3.3).
    const rec = encontrado && reg.cobertura !== 'sem_cobertura' && !temIndicador ? recomendarCodigo(reg) : null;

    let statusAnestesia;
    if (!encontrado) statusAnestesia = 'revisar';
    else if (reg.cobertura === 'sem_cobertura') statusAnestesia = 'sem_cobertura';
    else if (temIndicador) statusAnestesia = 'paga_embutida';
    else if (rec == null) statusAnestesia = 'sem_anestesia';
    else statusAnestesia = 'recomenda_codigo';

    // Item 4.16: anestesia p/ SADT exclusivamente diagnóstico limitada a 3 procedimentos.
    const isSadtDiag = encontrado && reg.lista === 'SADT' && statusAnestesia === 'recomenda_codigo';
    if (isSadtDiag) sadtDiagCount += 1;
    const limiteSadt = isSadtDiag && sadtDiagCount > 3;

    // UTM por código (item 4.1): anestesia pelo indicador; procedimento derivado do valor.
    const utmAnestesica = temIndicador
      ? (INDICADOR_UTM[reg.indicadorAnestesico] ?? utmDoValor(reg.valorAnestesista))
      : null;
    const utmCirurgiao = encontrado ? utmDoValor(reg.valorCirurgiao) : null;

    return {
      ordem: i,
      codigo: item.codigo,
      encontrado,
      descricao: reg?.descricao ?? null,
      lista: reg?.lista ?? null,
      cobertura: reg?.cobertura ?? null,
      porteCirurgico: reg?.porteCirurgico ?? null,
      porteAnestesico: reg?.porteAnestesico ?? null,
      numeroAuxiliares: reg?.numeroAuxiliares ?? null,
      classificacao: reg?.classificacao ?? null,
      documentacao: reg?.documentacao ?? null,
      indicadorAnestesico: reg?.indicadorAnestesico ?? null,
      utmAnestesica,
      utmCirurgiao,
      quantidade,
      percentual,
      recPercentual,
      valorCirurgiaoBase: valorCirBase,
      valorAnestesistaBase: valorAneBase,
      valorCirurgiaoPago: valorCirBase != null ? round2(valorCirBase * escala) : null,
      valorAnestesistaPago: valorAneBase != null ? round2(valorAneBase * escala) : null,
      dobraAcomodacao: dobra > 1,
      urgencia: urgFator > 1,
      motivoNaoDobra: acomodacaoMult > 1 && encontrado ? motivoNaoDobra(reg.codigo, reg.lista) : null,
      segundoAnestesista: encontrado ? indicaSegundoAnestesista(reg.descricao) : false,
      limiteSadt,
      statusAnestesia,
      // o valor recomendado reflete a quantidade e o % do PRÓPRIO código de anestesia (recPercentual —
      // cascata editável no card amarelo); limiteSadt zera (não remunera, item 4.16).
      recomendacao: rec ? escalarRec(rec, limiteSadt ? 0 : fator * (recPercentual / 100) * quantidade) : null,
    };
  });

  // Totais.
  const soma = (key) => round2(linhas.reduce((s, l) => s + (l[key] || 0), 0));
  const totalCir = soma('valorCirurgiaoPago') || 0;
  const totalAne = soma('valorAnestesistaPago') || 0;
  const totais = {
    totalCirurgiao: round2(totalCir),
    totalAnestesista: round2(totalAne),
    valorAdicional: round2(valorAdicional),
    totalGeral: round2(totalCir + totalAne + valorAdicional),
    // valor potencial se o usuário adicionar os códigos recomendados (já escalados por tabela, %,
    // quantidade e limite de 3 SADT — o principal.valor das linhas limiteSadt é 0).
    totalRecomendado: round2(
      linhas
        .filter((l) => l.recomendacao?.principal?.valor)
        .reduce((s, l) => s + l.recomendacao.principal.valor, 0)
    ),
  };

  return { linhas, totais, premissas: { tabela, fator: round2(fatorTabela), acomodacaoMult } };
}

/**
 * Aplica a cascata oficial de percentuais (v2026.03 itens 2.1.21/4.6) por ordem decrescente de
 * valor: 1º=100%, 2º=50%, 3º=40%, 4º=30%, 5º+=10%. O 2º pode ser ajustado p/ 70% no badge se for
 * outra via de acesso (a UI não infere a via).
 */
export function sugerirPercentuais(itens) {
  const ordenado = [...itens].sort(
    (a, b) =>
      (b.registro?.valorCirurgiao || b.registro?.valorAnestesista || 0) -
      (a.registro?.valorCirurgiao || a.registro?.valorAnestesista || 0)
  );
  const ultimo = CASCATA_PERCENTUAL[CASCATA_PERCENTUAL.length - 1];
  const pct = new Map();
  ordenado.forEach((it, rank) => pct.set(it.codigo, CASCATA_PERCENTUAL[rank] ?? ultimo));
  return itens.map((it) => ({ ...it, percentual: pct.get(it.codigo) }));
}

/** Monta o texto de justificativa clínica para um código recomendado. */
export function gerarJustificativa({
  procedimento = '',
  codigoRecomendado = '',
  descricaoRecomendado = '',
  motivoClinico = '',
  tecnica = '',
  paciente = '',
  cid = '',
} = {}) {
  const linhas = [
    `Justificativa para cobrança do código ${codigoRecomendado}${descricaoRecomendado ? ` (${descricaoRecomendado})` : ''}:`,
    '',
    `Procedimento realizado: ${procedimento || '[procedimento]'}.`,
    `O procedimento não possui porte anestésico previsto na tabela referencial; a presença do anestesiologista foi necessária por ${motivoClinico || '[motivo clínico — ex.: imperativo clínico, paciente não colaborativo, faixa etária]'}.`,
    tecnica ? `Técnica anestésica empregada: ${tecnica}.` : 'Técnica anestésica empregada: [sedação / anestesia geral / bloqueio].',
    paciente ? `Condição do paciente: ${paciente}.` : 'Condição do paciente: [idade / comorbidades / particularidades].',
    cid ? `CID: ${cid}.` : 'CID: [_____].',
    '',
    'Solicita-se a remuneração do ato anestésico conforme indicador anestésico do código, nos termos do Protocolo Nacional (parecer CFM 12/2017).',
  ];
  return linhas.join('\n');
}

/**
 * Justificativa COMPLETA e pronta (sem placeholders), derivada do procedimento + recomendação.
 * Para o caso de exame vs ato sem porte (recomendacao.motivo).
 */
export function gerarJustificativaCompleta({ procedimento = '', recomendacao } = {}) {
  const p = recomendacao?.principal || {};
  const proc = procedimento || 'o procedimento autorizado';
  const motivos = {
    // 4.3.1 — exame específico (RM/TC/US/endoscopia/...)
    exame: `Embora ${proc} não tenha porte anestésico próprio na tabela referencial, sua realização exigiu sedação/anestesia conduzida por anestesiologista, ante a impossibilidade de executá-lo em condições adequadas e seguras sem suporte anestésico (paciente não colaborativo, faixa etária, dor ou necessidade de imobilidade).`,
    // 4.3.2 — procedimento da lista oficial → 31602312
    lista_312: `${proc.charAt(0).toUpperCase() + proc.slice(1)} não possui previsão de indicação do ato anestésico na tabela referencial. Por motivo técnico justificável, foi necessária a participação do anestesiologista, valorizada pelo código 31602312 (procedimentos clínicos ambulatoriais e hospitalares não especificados — indicador A), nos termos do item 4.3.2 das Instruções Gerais do Sistema Unimed.`,
    // 4.3.4 — fallback diagnóstico → 31602304 (B)
    diagnostico: `${proc.charAt(0).toUpperCase() + proc.slice(1)} é procedimento diagnóstico sem previsão de ato anestésico; por motivo técnico justificável, exigiu a participação do anestesiologista, valorizada pelo código 31602304 (indicador B), nos termos do item 4.3.4 das Instruções Gerais.`,
    // 4.3.4 — fallback terapêutico → 31602355 (E, imperativo clínico)
    imperativo: `Embora ${proc} não possua porte anestésico previsto na tabela referencial, foi necessária a atuação do anestesiologista por imperativo clínico — condição do paciente (idade, comorbidades, intolerância ou alergia ao anestésico local, ausência de colaboração) e/ou particularidade do ato —, valorizada pelo código 31602355 (indicador E), nos termos do item 4.3.4 das Instruções Gerais.`,
  };
  const motivo = motivos[recomendacao?.motivo] || motivos.imperativo;
  return [
    `Justificativa técnica para cobrança do ato anestésico — código ${p.codigo || ''}${p.descricao ? ` (${p.descricao})` : ''}.`,
    '',
    motivo,
    '',
    'O ato anestésico foi integralmente conduzido pelo anestesiologista, contemplando avaliação pré-anestésica, indução e manutenção, monitorização contínua e responsabilidade pela segurança do paciente do início ao término do procedimento.',
    '',
    'Diante do exposto, e nos termos do Protocolo Nacional do Sistema Unimed e do Parecer CFM nº 12/2017, solicita-se a remuneração do ato anestésico conforme o indicador anestésico do referido código.',
  ].join('\n');
}

export default { calcularGuia, recomendarCodigo, gerarJustificativa, gerarJustificativaCompleta, sugerirPercentuais };
