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
  SUGESTAO_REDUTOR,
  RECOMENDACAO_EXAME,
  RECOMENDACAO_DEFAULT,
} from './codificacaoAnestRules';
import { CODIGOS_ANESTESIA_MAP } from '@/data/codigosAnestesia';

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

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
 * @param {Array<{codigo:string, registro?:object|null, quantidade?:number, percentual?:number}>} itens
 * @param {{tabela?:string, valorAdicional?:number, regras?:object}} [opts]
 */
export function calcularGuia(itens, opts = {}) {
  const regras = { ...REGRAS_PADRAO, ...(opts.regras || {}) };
  const tabelaPedida = opts.tabela || regras.tabela;
  const tabela = MULTIPLICADORES[tabelaPedida] != null ? tabelaPedida : regras.tabela;
  const fator = MULTIPLICADORES[tabela] / MULTIPLICADORES.intercambio;
  const valorAdicional = Number(opts.valorAdicional) || 0;

  // Escala os valores de um código recomendado pela tabela escolhida (valores de
  // CODIGOS_ANESTESIA_MAP estão em intercâmbio; ver detalheCodigo).
  const escalarRec = (rec) => {
    if (!rec) return rec;
    const esc = (d) => (d && d.valor != null ? { ...d, valor: round2(d.valor * fator) } : d);
    return { ...rec, principal: esc(rec.principal), alternativa: esc(rec.alternativa) };
  };

  // Monta linhas. Percentual é POR LINHA (modelo Volan): default 100%, editável pelo faturista.
  // O referencial não define redutor por procedimento subsequente (ver codificacaoAnestRules.js).
  const linhas = (itens || []).map((item, i) => {
    const reg = item.registro || null;
    const encontrado = !!reg;
    const quantidade = Math.max(1, Math.round(Number(item.quantidade) || 1));
    const percentual = item.percentual == null ? regras.percentualPadrao : Math.max(0, Math.min(100, Number(item.percentual)));
    const escala = (percentual / 100) * quantidade;

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
      quantidade,
      percentual,
      valorCirurgiaoBase: valorCirBase,
      valorAnestesistaBase: valorAneBase,
      valorCirurgiaoPago: valorCirBase != null ? round2(valorCirBase * escala) : null,
      valorAnestesistaPago: valorAneBase != null ? round2(valorAneBase * escala) : null,
      statusAnestesia,
      recomendacao: statusAnestesia === 'recomenda_codigo' ? escalarRec(recomendarCodigo(reg)) : null,
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
    // valor potencial se o usuário adicionar os códigos recomendados (já escalados pela tabela)
    totalRecomendado: round2(
      linhas
        .filter((l) => l.recomendacao?.principal?.valor)
        .reduce((s, l) => s + l.recomendacao.principal.valor, 0)
    ),
  };

  return { linhas, totais, premissas: { tabela, fator: round2(fator) } };
}

/** Sugestão NÃO-oficial de redutor: maior valor 100%, demais SUGESTAO_REDUTOR[1] (50%). */
export function sugerirPercentuais(itens) {
  const ordenado = [...itens].sort(
    (a, b) => (b.registro?.valorCirurgiao || 0) - (a.registro?.valorCirurgiao || 0)
  );
  const pct = new Map();
  ordenado.forEach((it, rank) => pct.set(it.codigo, rank === 0 ? SUGESTAO_REDUTOR[0] : SUGESTAO_REDUTOR[1]));
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

export default { calcularGuia, recomendarCodigo, gerarJustificativa, sugerirPercentuais };
