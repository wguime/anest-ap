/**
 * Velocidade de correção do sódio — Adrogué-Madias.
 *
 * ⚠️ Pergunta DIFERENTE da do card "Sódio Corrigido" (`renal_sódio`), que
 * corrige o sódio medido pela glicemia. Aqui a pergunta é "em quanto tempo, e
 * com qual solução, eu levo esse sódio até a meta sem passar do teto".
 * A colisão de nomes está registrada em
 * `docs/auditoria-calculadoras-uso-real.md` §7.10.
 *
 * Fórmula: Adrogué HJ, Madias NE. Hyponatremia. N Engl J Med 2000;342:1581-9.
 *   ΔNa por litro de solução = (Na_infusato + K_infusato − Na_sérico) / (ACT + 1)
 *
 * Tetos de correção:
 * - Hiponatremia: painel de especialistas americano recomenda **não passar de
 *   8 mmol/L em 24 h**; a diretriz europeia admite 10 mmol/L nas primeiras 24 h
 *   e 8 mmol/L a cada 24 h depois. Em Na < 115 mEq/L o limite de 8 é o prudente.
 * - Hipernatremia: baixar no máximo ~10 mmol/L em 24 h, pelo risco de edema
 *   cerebral.
 *
 * ⚠️ A fórmula é uma ESTIMATIVA estática: ignora perdas urinárias e insensíveis,
 * que na prática são a maior fonte de erro. Sódio sérico de controle a cada
 * 4–6 h vale mais que a conta.
 */

/** mEq/L de sódio (e potássio) das soluções usadas na correção. */
export const SOLUCOES = {
  salina3: { nome: 'NaCl 3% (hipertônica)', na: 513, k: 0 },
  salina09: { nome: 'NaCl 0,9% (fisiológica)', na: 154, k: 0 },
  ringer: { nome: 'Ringer lactato', na: 130, k: 4 },
  salina045: { nome: 'NaCl 0,45%', na: 77, k: 0 },
  glicosado5: { nome: 'Glicose 5% (água livre)', na: 0, k: 0 },
};

/** Fração da água corporal total sobre o peso (Adrogué-Madias). */
export const FRACAO_ACT = {
  homem_adulto: 0.6,
  mulher_adulta: 0.5,
  homem_idoso: 0.5,
  mulher_idosa: 0.45,
};

/** Água corporal total em litros. */
export function aguaCorporalTotal(pesoKg, perfil) {
  const fracao = FRACAO_ACT[perfil];
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || !fracao) return null;
  return pesoKg * fracao;
}

/**
 * Variação esperada do sódio sérico por LITRO de solução infundida.
 * Positiva = sobe o sódio; negativa = desce.
 */
export function deltaNaPorLitro({ naSerico, solucao, act }) {
  const s = SOLUCOES[solucao];
  if (!s || !Number.isFinite(naSerico) || !Number.isFinite(act) || act <= 0) return null;
  return (s.na + s.k - naSerico) / (act + 1);
}

/** Teto de variação em 24 h, em mmol/L, e o motivo. */
export function tetoDe24h({ naSerico, altoRisco }) {
  if (!Number.isFinite(naSerico)) return null;
  if (naSerico > 145) {
    return { teto: 10, motivo: 'Hipernatremia: baixar no máximo ~10 mmol/L em 24 h (risco de edema cerebral).' };
  }
  if (altoRisco || naSerico < 115) {
    return {
      teto: 8,
      motivo:
        naSerico < 115
          ? 'Na < 115 mEq/L: limitar a 8 mmol/L em 24 h — há desmielinização osmótica descrita mesmo dentro de 10.'
          : 'Alto risco (hipocalemia, desnutrição, hepatopatia, alcoolismo): limitar a 8 mmol/L em 24 h.',
    };
  }
  return { teto: 8, motivo: 'Hiponatremia sem alto risco: 8 mmol/L em 24 h é o limite recomendado (a diretriz europeia admite 10 nas primeiras 24 h).' };
}

/**
 * Plano de correção completo.
 *
 * `variacaoAlvo24h` é quanto se quer mover o sódio em 24 h. A função devolve o
 * volume e a velocidade, e AVISA quando o alvo passa do teto — sem impedir,
 * porque quem decide é quem está com o paciente, mas sem deixar passar calado.
 */
export function planoCorrecaoSodio({ naSerico, pesoKg, perfil, solucao, variacaoAlvo24h, altoRisco = false }) {
  const act = aguaCorporalTotal(pesoKg, perfil);
  const delta = deltaNaPorLitro({ naSerico, solucao, act });
  const limite = tetoDe24h({ naSerico, altoRisco });
  if (act === null || delta === null || limite === null) return null;
  if (!Number.isFinite(variacaoAlvo24h) || variacaoAlvo24h === 0) return null;

  // Solução que não move o sódio na direção pedida (ou não o move de todo).
  const direcaoOk = Math.sign(delta) === Math.sign(variacaoAlvo24h);
  const volumeLitros24h = direcaoOk ? variacaoAlvo24h / delta : null;

  return {
    act,
    deltaPorLitro: delta,
    solucaoNome: SOLUCOES[solucao].nome,
    direcaoOk,
    volumeLitros24h,
    volumeMl24h: volumeLitros24h === null ? null : volumeLitros24h * 1000,
    velocidadeMlH: volumeLitros24h === null ? null : (volumeLitros24h * 1000) / 24,
    teto24h: limite.teto,
    motivoTeto: limite.motivo,
    excedeTeto: Math.abs(variacaoAlvo24h) > limite.teto,
    naAlvo24h: naSerico + variacaoAlvo24h,
  };
}

/**
 * Bolus de resgate para hiponatremia SINTOMÁTICA (convulsão, coma).
 * 100–150 mL de NaCl 3% em 10 min, repetível até 3×, para subir 4–6 mmol/L
 * rápido — é a exceção ao teto, e serve para parar o sintoma, não para corrigir.
 */
export const BOLUS_SINTOMATICO = {
  solucao: 'NaCl 3%',
  volumeMl: '100–150 mL',
  tempo: 'em 10 min',
  repeticoes: 'repetir até 3× se o sintoma persistir',
  alvo: 'subir 4–6 mmol/L rapidamente',
  observacao: 'O bolus resolve o sintoma; depois dele o teto de 24 h volta a valer, contando o que o bolus já subiu.',
};
