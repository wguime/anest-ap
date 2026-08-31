/**
 * Dose máxima de anestésico local e o volume que ela vale na seringa.
 *
 * O app já calculava o ANTÍDOTO — emulsão lipídica escalada pelo peso, dentro
 * do `acls_unificado` — e não calculava a PREVENÇÃO. A lacuna está em
 * `docs/auditoria-calculadoras-uso-real.md` §7.3.
 *
 * Fontes:
 * - Iowa Head and Neck Protocols, University of Iowa — "Maximum Recommended
 *   Doses and Duration of Local Anesthetics" (tabela mg/kg e teto absoluto).
 * - ASRA Pain Medicine. Checklist for Treatment of Local Anesthetic Systemic
 *   Toxicity, 2020 (o que fazer quando o teto é ultrapassado).
 *
 * ⚠️ Dose máxima é limite de SEGURANÇA, não alvo terapêutico, e a ASRA orienta
 * dosar pelo PESO MAGRO em obesos — o teto por peso real superestima em quem
 * tem muita massa gorda, que não capta anestésico local proporcionalmente.
 */

/**
 * mg/kg por fármaco. `semVaso`/`comVaso` guardam o limite superior da faixa
 * publicada; `faixa` preserva o intervalo para exibição, porque mostrar só o
 * teto esconde que a referência é uma faixa.
 * `tetoMg` é o teto absoluto por dose, independente do peso.
 */
export const ANESTESICOS_LOCAIS = {
  lidocaina: {
    nome: 'Lidocaína',
    grupo: 'Amida',
    semVaso: 4.5, faixaSemVaso: '3–4,5',
    comVaso: 7, faixaComVaso: '6–7',
    tetoMgComVaso: 500,
    duracaoMin: '30–120 (120–240 com adrenalina)',
    concentracoes: [0.5, 1, 2],
  },
  bupivacaina: {
    nome: 'Bupivacaína',
    grupo: 'Amida',
    semVaso: 2.5, faixaSemVaso: '2–2,5',
    comVaso: 3, faixaComVaso: '2,5–3',
    tetoMgSemVaso: 175,
    tetoMgComVaso: 225,
    duracaoMin: '120–175 (180–480 com adrenalina)',
    concentracoes: [0.125, 0.25, 0.5, 0.75],
  },
  ropivacaina: {
    nome: 'Ropivacaína',
    grupo: 'Amida',
    semVaso: 3, faixaSemVaso: '2–3',
    comVaso: 4, faixaComVaso: '3–4',
    tetoMgComVaso: 225,
    duracaoMin: '120–240 (180–480 com adrenalina)',
    concentracoes: [0.2, 0.375, 0.5, 0.75, 1],
  },
  mepivacaina: {
    nome: 'Mepivacaína',
    grupo: 'Amida',
    semVaso: 5, faixaSemVaso: '4,5–5',
    comVaso: 6.6, faixaComVaso: '6,6',
    tetoMgSemVaso: 400,
    tetoMgComVaso: 500,
    duracaoMin: '45–90 (120 com adrenalina)',
    concentracoes: [1, 2],
  },
  cloroprocaina: {
    nome: 'Cloroprocaína',
    grupo: 'Éster',
    semVaso: 12, faixaSemVaso: '10–12',
    comVaso: 14, faixaComVaso: '14',
    tetoMgSemVaso: 800,
    tetoMgComVaso: 1000,
    duracaoMin: '30–60 (60–90 com adrenalina)',
    concentracoes: [1, 2, 3],
  },
  procaina: {
    nome: 'Procaína',
    grupo: 'Éster',
    semVaso: 10, faixaSemVaso: '7–10',
    comVaso: 10, faixaComVaso: '10',
    tetoMgSemVaso: 1000,
    duracaoMin: '20–30 (30–45 com adrenalina)',
    concentracoes: [1, 2],
  },
};

/** 1% = 10 mg/mL. */
export function mgPorMl(concentracaoPercent) {
  if (!Number.isFinite(concentracaoPercent) || concentracaoPercent <= 0) return null;
  return concentracaoPercent * 10;
}

/**
 * Dose máxima em mg e o volume correspondente em mL.
 *
 * `pesoKg` deve ser o peso usado para dose — em obeso, o PESO MAGRO (ASRA).
 * O teto absoluto por dose, quando existe, vence o cálculo por peso: é isso que
 * impede um paciente de 120 kg receber 840 mg de lidocaína com adrenalina.
 */
export function doseMaximaAnestesicoLocal({ farmaco, pesoKg, comVasoconstritor, concentracaoPercent }) {
  const dados = ANESTESICOS_LOCAIS[farmaco];
  if (!dados) return null;
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null;

  const mgPorKg = comVasoconstritor ? dados.comVaso : dados.semVaso;
  const tetoAbsoluto = comVasoconstritor ? dados.tetoMgComVaso : dados.tetoMgSemVaso;

  const doseporPeso = mgPorKg * pesoKg;
  const limitadoPeloTeto = Number.isFinite(tetoAbsoluto) && doseporPeso > tetoAbsoluto;
  const doseMaximaMg = limitadoPeloTeto ? tetoAbsoluto : doseporPeso;

  const mgMl = mgPorMl(concentracaoPercent);
  const volumeMaximoMl = mgMl ? doseMaximaMg / mgMl : null;

  return {
    farmaco: dados.nome,
    grupo: dados.grupo,
    mgPorKg,
    faixaMgPorKg: comVasoconstritor ? dados.faixaComVaso : dados.faixaSemVaso,
    doseporPeso,
    tetoAbsoluto: Number.isFinite(tetoAbsoluto) ? tetoAbsoluto : null,
    limitadoPeloTeto,
    doseMaximaMg,
    mgPorMl: mgMl,
    volumeMaximoMl,
    duracaoMin: dados.duracaoMin,
  };
}
