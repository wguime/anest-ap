/**
 * CAM (MAC) corrigida pela idade, e a fração de CAM total com N₂O.
 *
 * Fonte primária: Mapleson WW. Effect of age on MAC in humans: a meta-analysis.
 * Br J Anaesth 1996;76:179-85 — log10(MAC) cai linearmente com a idade, ~6% por
 * década, na forma `MAC = MAC₄₀ × 10^(b × (idade − 40))` com **b = −0,00269**.
 *
 * Os MAC₄₀ e a soma das frações são os da própria implementação de Nickalls,
 * publicada em Nickalls RWD & Mapleson WW. Age-related iso-MAC charts.
 * Br J Anaesth 2003;91:170-4, e reproduzida na sub-rotina do autor:
 *   HAL 0,75 · ISO 1,17 · ENF 1,63 · SEV 1,8 · DES 6,6 · N₂O 104
 *   totalFmac = Fmac(vapor) + Fmac(N₂O)
 *
 * ⚠️ Por que isso importa na conta e não só na curiosidade: aos 80 anos a CAM é
 * ~30% menor que aos 40. Conduzir pelo valor de bula em idoso é aprofundar
 * anestesia sem saber; conduzir pelo valor de jovem em criança é o contrário.
 */

/** Constante de Mapleson (1996): 10^(b) por ano ⇒ ~6% por década. */
export const B_MAPLESON = -0.00269;

/** CAM aos 40 anos, em % de concentração expirada (1 atm). */
export const MAC_40 = {
  sevoflurano: 1.8,
  isoflurano: 1.17,
  desflurano: 6.6,
  halotano: 0.75,
  enflurano: 1.63,
  oxidoNitroso: 104,
};

export const NOME_AGENTE = {
  sevoflurano: 'Sevoflurano',
  isoflurano: 'Isoflurano',
  desflurano: 'Desflurano',
  halotano: 'Halotano',
  enflurano: 'Enflurano',
};

/**
 * CAM do agente na idade informada, em %.
 *
 * ⚠️ A relação de Mapleson foi derivada em adultos e é usada de 5 a 95 anos nas
 * cartas de Nickalls. Abaixo de 1 ano a CAM tem pico no lactente e NÃO segue
 * esta reta — a função devolve o valor mesmo assim, e a tela avisa; recusar em
 * silêncio seria pior, mas usar sem o aviso é erro.
 */
export function macNaIdade(agente, idadeAnos) {
  const mac40 = MAC_40[agente];
  if (!Number.isFinite(mac40) || !Number.isFinite(idadeAnos)) return null;
  return mac40 * Math.pow(10, B_MAPLESON * (idadeAnos - 40));
}

/** Faixa etária fora da qual a reta de Mapleson não foi validada. */
export function idadeForaDaValidacao(idadeAnos) {
  if (!Number.isFinite(idadeAnos)) return null;
  if (idadeAnos < 1) return 'lactente';
  if (idadeAnos < 5) return 'pre_escolar';
  if (idadeAnos > 95) return 'muito_idoso';
  return null;
}

/**
 * Fração de CAM total: vapor + N₂O somam, como na sub-rotina de Nickalls.
 *
 * `vaporPercent` e `n2oPercent` são as concentrações EXPIRADAS medidas.
 */
export function fracaoMacTotal({ agente, idadeAnos, vaporPercent, n2oPercent = 0 }) {
  const macVapor = macNaIdade(agente, idadeAnos);
  const macN2O = macNaIdade('oxidoNitroso', idadeAnos);
  if (macVapor === null || macN2O === null) return null;

  const vapor = Number.isFinite(vaporPercent) && vaporPercent > 0 ? vaporPercent : 0;
  const n2o = Number.isFinite(n2oPercent) && n2oPercent > 0 ? n2oPercent : 0;

  const fracaoVapor = vapor / macVapor;
  const fracaoN2O = n2o / macN2O;

  return {
    macVapor,
    macN2O,
    fracaoVapor,
    fracaoN2O,
    total: fracaoVapor + fracaoN2O,
    // Concentração de vapor que sozinha daria 1 CAM nessa idade — é o número
    // que se procura ao ajustar o vaporizador.
    vaporPara1Mac: macVapor,
    // Com N₂O em uso, o vapor precisa cobrir só o que falta para 1 CAM.
    vaporPara1MacComN2O: Math.max(0, (1 - fracaoN2O) * macVapor),
  };
}
