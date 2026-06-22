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
  RECOMENDACAO_EXAME,
  RECOMENDACAO_DEFAULT,
} from './codificacaoAnestRules';
import { CODIGOS_ANESTESIA_MAP } from '@/data/codigosAnestesia';

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

/** Percentual da ladder para um dado rank (0-based); o último item se repete. */
function pctLadder(ladder, rank) {
  if (!ladder || ladder.length === 0) return 1;
  return ladder[Math.min(rank, ladder.length - 1)];
}

/** Detalhe de um código recomendado a partir da referência curada. */
function detalheCodigo(codigo) {
  const r = CODIGOS_ANESTESIA_MAP[codigo];
  return r
    ? { codigo: r.codigo, descricao: r.descricao, valor: r.valor, indicador: r.indicador }
    : { codigo, descricao: null, valor: null, indicador: null };
}

/** Recomenda código(s) 31602 quando a anestesia não é paga embutida. */
export function recomendarCodigo(registro) {
  const desc = registro?.descricao || '';
  const exame = RECOMENDACAO_EXAME.find((e) => e.rx.test(desc));
  if (exame) {
    return {
      principal: detalheCodigo(exame.codigo),
      alternativa: detalheCodigo(RECOMENDACAO_DEFAULT.imperativoClinico),
      motivo: 'exame',
    };
  }
  return {
    principal: detalheCodigo(RECOMENDACAO_DEFAULT.imperativoClinico),
    alternativa: detalheCodigo(RECOMENDACAO_DEFAULT.semPorte),
    motivo: 'sem_porte',
  };
}

/**
 * @param {Array<{codigo:string, registro?:object|null, via?:string}>} itens
 * @param {{tabela?:string, modoAnestesia?:string, regras?:object}} [opts]
 */
export function calcularGuia(itens, opts = {}) {
  const regras = { ...REGRAS_PADRAO, ...(opts.regras || {}) };
  const tabelaPedida = opts.tabela || regras.tabela;
  const tabela = MULTIPLICADORES[tabelaPedida] != null ? tabelaPedida : regras.tabela;
  const modoAnestesia = opts.modoAnestesia || regras.modoAnestesia;
  const fator = MULTIPLICADORES[tabela] / MULTIPLICADORES.intercambio;

  // Escala os valores de um código recomendado pela tabela escolhida (valores de
  // CODIGOS_ANESTESIA_MAP estão em intercâmbio; ver detalheCodigo).
  const escalarRec = (rec) => {
    if (!rec) return rec;
    const esc = (d) => (d && d.valor != null ? { ...d, valor: round2(d.valor * fator) } : d);
    return { ...rec, principal: esc(rec.principal), alternativa: esc(rec.alternativa) };
  };

  // 1. Monta linhas com valores base (escalados pela tabela escolhida).
  const linhas = (itens || []).map((item, i) => {
    const reg = item.registro || null;
    const encontrado = !!reg;
    const via = item.via || 'unica';

    const valorCirBase = encontrado && reg.valorCirurgiao != null ? round2(reg.valorCirurgiao * fator) : null;
    // só conta como "paga embutida" se houver indicador E valor — senão pagaria zero
    const temIndicador = encontrado && reg.indicadorAnestesico != null && reg.valorAnestesista != null;
    const valorAneBase = temIndicador ? round2(reg.valorAnestesista * fator) : null;

    let statusAnestesia;
    if (!encontrado) statusAnestesia = 'revisar';
    else if (reg.cobertura === 'sem_cobertura') statusAnestesia = 'sem_cobertura';
    else if (temIndicador) statusAnestesia = 'paga_embutida';
    else statusAnestesia = 'recomenda_codigo';

    return {
      ordem: i,
      codigo: item.codigo,
      via,
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
      valorCirurgiaoBase: valorCirBase,
      valorAnestesistaBase: valorAneBase,
      // preenchidos abaixo
      percentualCirurgico: null,
      percentualAnestesico: null,
      valorCirurgiaoPago: null,
      valorAnestesistaPago: null,
      statusAnestesia,
      recomendacao: statusAnestesia === 'recomenda_codigo' ? escalarRec(recomendarCodigo(reg)) : null,
    };
  });

  // 2. Percentualização cirúrgica: por via, ordem decrescente de valor (cobertos com valor).
  const porVia = {};
  linhas.forEach((l) => {
    if (l.cobertura === 'coberto' && l.valorCirurgiaoBase > 0) {
      (porVia[l.via] = porVia[l.via] || []).push(l);
    }
  });
  Object.values(porVia).forEach((grupo) => {
    grupo
      .sort((a, b) => b.valorCirurgiaoBase - a.valorCirurgiaoBase)
      .forEach((l, rank) => {
        l.percentualCirurgico = pctLadder(regras.percentualCirurgico, rank);
        l.valorCirurgiaoPago = round2(l.valorCirurgiaoBase * l.percentualCirurgico);
      });
  });

  // 3. Percentualização anestésica: global, ordem decrescente de valor do indicador (instr. 7).
  const comAnestesia = linhas
    .filter((l) => l.valorAnestesistaBase > 0)
    .sort((a, b) => b.valorAnestesistaBase - a.valorAnestesistaBase);
  comAnestesia.forEach((l, rank) => {
    let pct;
    if (modoAnestesia === 'somente_maior') pct = rank === 0 ? 1 : 0;
    else pct = pctLadder(regras.percentualAnestesico, rank);
    l.percentualAnestesico = pct;
    l.valorAnestesistaPago = round2(l.valorAnestesistaBase * pct);
  });

  // 4. Totais.
  const soma = (arr, key) => round2(arr.reduce((s, l) => s + (l[key] || 0), 0));
  const totais = {
    totalCirurgiao: soma(linhas, 'valorCirurgiaoPago'),
    totalAnestesista: soma(linhas, 'valorAnestesistaPago'),
    totalGeral: round2((soma(linhas, 'valorCirurgiaoPago') || 0) + (soma(linhas, 'valorAnestesistaPago') || 0)),
    // valor potencial se o usuário adicionar os códigos recomendados (já escalados pela tabela)
    totalRecomendado: round2(
      linhas
        .filter((l) => l.recomendacao?.principal?.valor)
        .reduce((s, l) => s + l.recomendacao.principal.valor, 0)
    ),
  };

  return {
    linhas,
    totais,
    premissas: {
      tabela,
      modoAnestesia,
      fator: round2(fator),
      percentualCirurgico: regras.percentualCirurgico,
      percentualAnestesico: regras.percentualAnestesico,
    },
  };
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

export default { calcularGuia, recomendarCodigo, gerarJustificativa };
