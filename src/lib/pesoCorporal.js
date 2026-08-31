/**
 * Pesos de referência para dose e superfície corporal.
 *
 * Existe porque o app JÁ ACONSELHA usar peso ideal/magro em três telas
 * (`adt_balanco_hidrico_transop`, `doses_adultos`, `ped_via_aerea`) e não
 * oferecia onde calcular — a lacuna está registrada em
 * `docs/auditoria-calculadoras-uso-real.md` §7.4.
 *
 * Fontes primárias:
 * - Devine BJ. Gentamicin therapy. Drug Intell Clin Pharm 1974 (peso ideal).
 * - Janmahasatian S et al. Quantification of lean bodyweight.
 *   Clin Pharmacokinet 2005;44:1051-65 (peso magro / massa livre de gordura).
 * - Du Bois D & Du Bois EF. Arch Intern Med 1916 (superfície corporal).
 * - Mosteller RD. Simplified calculation of body-surface area.
 *   N Engl J Med 1987;317:1098.
 *
 * Qual escalar usar, e por quê: Ingrande J & Lemmens HJM. Dose adjustment of
 * anaesthetics in the morbidly obese. Br J Anaesth 2010;105(Suppl 1):i16-23 —
 * *"Lean body weight is the optimal dosing scalar for most drugs used in
 * anaesthesia including opioids and anaesthetic induction agents, with the
 * exception of neuromuscular antagonists."*
 */

const CM_POR_POLEGADA = 2.54;

/** Abaixo disto a Devine sai do intervalo em que foi derivada (5 pés). */
export const ALTURA_MINIMA_DEVINE_CM = 152.4;

const finito = (n) => Number.isFinite(n) && n > 0;

/** Índice de massa corporal, kg/m². */
export function imc(pesoKg, alturaCm) {
  if (!finito(pesoKg) || !finito(alturaCm)) return null;
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

/**
 * Peso ideal (Devine 1974), kg.
 *
 * ⚠️ Devolve `null` abaixo de 152,4 cm: a fórmula é linear a partir de 5 pés e,
 * extrapolada para baixo, produz número sem sentido (a 100 cm daria 2,6 kg).
 * Melhor não mostrar nada do que mostrar isso numa tela de dose.
 */
export function pesoIdealDevine(alturaCm, sexo) {
  if (!finito(alturaCm)) return null;
  if (alturaCm < ALTURA_MINIMA_DEVINE_CM) return null;
  const base = sexo === 'feminino' ? 45.5 : 50.0;
  return base + 2.3 * (alturaCm / CM_POR_POLEGADA - 60);
}

/**
 * Peso magro / massa livre de gordura (Janmahasatian 2005), kg.
 *
 * É o escalar de dose preferido em anestesia para indutores e opioides.
 * Não depende de altura em polegadas — vale em qualquer estatura com IMC válido.
 */
export function pesoMagroJanmahasatian(pesoKg, alturaCm, sexo) {
  const bmi = imc(pesoKg, alturaCm);
  if (bmi === null) return null;
  return sexo === 'feminino'
    ? (9270 * pesoKg) / (8780 + 244 * bmi)
    : (9270 * pesoKg) / (6680 + 216 * bmi);
}

/**
 * Peso ajustado (corrigido), kg: IBW + 0,4 × (peso real − IBW).
 *
 * Usado para fármacos hidrofílicos em obesos (aminoglicosídeos, e o escalar
 * clássico de BNM despolarizante em algumas referências). `null` quando a
 * Devine não se aplica.
 */
export function pesoAjustado(pesoKg, alturaCm, sexo, fator = 0.4) {
  const ibw = pesoIdealDevine(alturaCm, sexo);
  if (ibw === null || !finito(pesoKg)) return null;
  return ibw + fator * (pesoKg - ibw);
}

/** Superfície corporal de Mosteller (1987), m². */
export function superficieMosteller(pesoKg, alturaCm) {
  if (!finito(pesoKg) || !finito(alturaCm)) return null;
  return Math.sqrt((alturaCm * pesoKg) / 3600);
}

/** Superfície corporal de Du Bois (1916), m². */
export function superficieDuBois(pesoKg, alturaCm) {
  if (!finito(pesoKg) || !finito(alturaCm)) return null;
  return 0.007184 * Math.pow(alturaCm, 0.725) * Math.pow(pesoKg, 0.425);
}

/** Faixa de IMC (OMS), para o badge de risco. */
export function faixaImc(valor) {
  if (!Number.isFinite(valor)) return null;
  if (valor < 18.5) return 'baixo_peso';
  if (valor < 25) return 'eutrofico';
  if (valor < 30) return 'sobrepeso';
  if (valor < 35) return 'obesidade_1';
  if (valor < 40) return 'obesidade_2';
  return 'obesidade_3';
}

/** Tudo de uma vez, para o `compute` da calculadora. */
export function pesosDeReferencia(pesoKg, alturaCm, sexo) {
  if (!finito(pesoKg) || !finito(alturaCm)) return null;
  return {
    imc: imc(pesoKg, alturaCm),
    faixaImc: faixaImc(imc(pesoKg, alturaCm)),
    pesoIdeal: pesoIdealDevine(alturaCm, sexo),
    pesoMagro: pesoMagroJanmahasatian(pesoKg, alturaCm, sexo),
    pesoAjustado: pesoAjustado(pesoKg, alturaCm, sexo),
    superficieMosteller: superficieMosteller(pesoKg, alturaCm),
    superficieDuBois: superficieDuBois(pesoKg, alturaCm),
    devineAplicavel: alturaCm >= ALTURA_MINIMA_DEVINE_CM,
  };
}
