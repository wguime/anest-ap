/**
 * Conversão de opioides — equianalgesia por morfina VO equivalente (MME).
 *
 * Fontes:
 * - CDC Clinical Practice Guideline for Prescribing Opioids, 2022 (fatores MME)
 * - Ripamonti C et al. J Clin Oncol 1998;16(10):3216-21 (razão da metadona)
 * - McPherson ML. Demystifying Opioid Conversion Calculations. ASHP, 2019
 *
 * ⚠️ TODA dose é TOTAL DIÁRIO. O fator do fentanil transdérmico (2,4) é por
 * mcg/HORA e devolve MME por DIA — 25 mcg/h × 2,4 = 60 mg de morfina VO/dia —
 * então misturar dose avulsa com total diário produz número sem sentido.
 *
 * ⚠️ Estes fatores seguem a convenção MME do CDC, que NÃO é a equianalgesia
 * clássica de cabeceira. Pelo CDC, 100 mcg de fentanil IV valem 10 mg de morfina
 * VO (fator 0,1); pela equianalgesia clássica seriam 30 mg. O app declara o CDC
 * como fonte, então 0,1 está certo aqui — não "corrigir" para 0,3.
 */

/** Fator para morfina VO equivalente. Metadona fica de fora: é não-linear. */
export const MME_FACTORS = {
  morfina_vo: 1,
  morfina_iv: 3, // 1 mg IV = 3 mg VO
  tramadol_vo: 0.1,
  tramadol_iv: 0.1,
  codeina_vo: 0.15,
  oxicodona_vo: 1.5,
  fentanil_iv: 0.1, // por mcg
  fentanil_td: 2.4, // por mcg/h — devolve MME/dia
};

/**
 * Razão morfina VO : metadona, ESCALONADA pela dose diária de morfina.
 *
 * Ripamonti 1998 — a metadona fica relativamente MAIS potente quanto maior a
 * dose de morfina prévia, então uma razão fixa superdosa em dose alta:
 *
 *   30–90 mg/dia   → 4:1
 *   90–300 mg/dia  → 8:1
 *   > 300 mg/dia   → 12:1 (ou mais)
 *
 * ⚠️ A tabela começa em 30 mg/dia. Abaixo disso ela não fala, e aqui se estende
 * o 4:1 — é a razão mais baixa da tabela, portanto a que dá MAIS metadona, o que
 * só é aceitável porque em dose diária tão baixa o resultado fica na ordem da
 * dose inicial usual. Não extrapolar isso para cima.
 *
 * @param {number} meddMg Morfina VO equivalente, mg/dia
 * @returns {number} razão (mg de morfina VO por mg de metadona)
 */
export function methadoneRatioFromMedd(meddMg) {
  if (meddMg >= 300) return 12;
  if (meddMg >= 90) return 8;
  return 4;
}

/**
 * Inverso do anterior: dada a metadona, qual MME ela representa?
 *
 * A razão depende da MME e a MME depende da razão, então se procura a razão
 * COERENTE consigo mesma.
 *
 * ⚠️ **A tabela de Ripamonti NÃO é inversível.** Ela foi escrita para trocar
 * morfina POR metadona, não o contrário, e em duas faixas mais de uma razão
 * fecha: 11,3–22,4 mg/dia e 25–37,4 mg/dia. Quem toma 15 mg/dia de metadona
 * pode ter vindo de 60 (4:1) ou de 120 mg/dia de morfina (8:1) — os dois são
 * coerentes, e nada na dose atual distingue.
 *
 * A escolha aqui é a MENOR razão, que dá a MENOR morfina equivalente. É o lado
 * seguro do erro: subestimar a MME subdosa o opioide de destino, o que custa
 * dor; superestimar superdosa, o que custa depressão respiratória.
 *
 * @param {number} doseMg Metadona, mg/dia
 * @returns {{ medd: number, ratio: number, ambiguo: boolean }}
 *   `ambiguo` marca as faixas em que mais de uma razão fecha.
 */
export function meddFromMethadone(doseMg) {
  const coerentes = [4, 8, 12].filter((r) => methadoneRatioFromMedd(doseMg * r) === r);
  // Dose altíssima: a tabela manda "12:1 ou mais" e não fecha em cima.
  const ratio = coerentes.length > 0 ? Math.min(...coerentes) : 12;
  return { medd: doseMg * ratio, ratio, ambiguo: coerentes.length > 1 };
}

/** Morfina VO equivalente (mg/dia) da dose de origem. */
export function toMorphineEquivalent(opioide, dose) {
  if (opioide === 'metadona_vo') return meddFromMethadone(dose).medd;
  const fator = MME_FACTORS[opioide];
  return fator === undefined ? null : dose * fator;
}

/** Dose do opioide de destino que equivale a `medd` mg/dia de morfina VO. */
export function fromMorphineEquivalent(opioide, medd) {
  if (opioide === 'metadona_vo') return medd / methadoneRatioFromMedd(medd);
  const fator = MME_FACTORS[opioide];
  return fator === undefined ? null : medd / fator;
}

/**
 * Converte entre dois opioides, em total diário.
 *
 * @returns {{ morfinaVOeq, doseDestino, doseReduzida, razaoMetadona }|null}
 *   `doseReduzida` aplica −25% por tolerância cruzada incompleta.
 *   `razaoMetadona` só vem preenchida quando a metadona entra na conta.
 *
 * ⚠️ **O −25% vale TAMBÉM quando o destino é metadona — não retirar.** Surgiu a
 * hipótese de que a razão escalonada de Ripamonti já embutisse a tolerância
 * cruzada, e que o −25% descontaria duas vezes. A literatura diz o oposto:
 * trocar para metadona exige redução de **75–90%** da dose equianalgésica,
 * contra 50% nas demais trocas. Medindo contra a razão fixa 4:1 (o
 * comportamento antigo), Ripamonti + (−25%) entrega:
 *
 *   MEDD 300 mg/dia → 18,8 mg  = 75% de redução  ← piso do recomendado
 *   MEDD 600 mg/dia → 37,5 mg  = 75% de redução
 *
 * Sem o −25% a redução cairia para 67%, ABAIXO do piso. Retirar andaria na
 * direção contrária à recomendação.
 */
export function converterOpioide({ origem, destino, dose }) {
  const d = parseFloat(dose);
  if (!Number.isFinite(d) || d <= 0) return null;

  const conhecido = (o) => o === 'metadona_vo' || MME_FACTORS[o] !== undefined;
  if (!conhecido(origem) || !conhecido(destino)) return null;

  const morfinaVOeq = toMorphineEquivalent(origem, d);
  const doseDestino = fromMorphineEquivalent(destino, morfinaVOeq);

  let razaoMetadona = null;
  if (destino === 'metadona_vo') razaoMetadona = methadoneRatioFromMedd(morfinaVOeq);
  else if (origem === 'metadona_vo') razaoMetadona = meddFromMethadone(d).ratio;

  return {
    morfinaVOeq,
    doseDestino,
    doseReduzida: doseDestino * 0.75,
    razaoMetadona,
  };
}
