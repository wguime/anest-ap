/**
 * Agrupamento de variantes do MESMO fármaco — compartilhado pelos cards de
 * Anticoagulantes e de Inibidores de apetite.
 *
 * Nasceu de um pedido do dono (25/08): "a lista ficou muito extensa e com
 * medicações repetidas, organize a mesma medicação num único card e ao clicar
 * apareçam os outros cards da mesma medicação". Nos anticoagulantes eram 30
 * linhas para 22 medicações (a HNF sozinha ocupava 4); nos inibidores, 15
 * para 13.
 *
 * Mora aqui, e não em cada lib, porque a regra de "o que é a mesma medicação"
 * não pode divergir entre os dois cards.
 *
 * Contrato da base: só quem TEM variante declara `grupo` (chave estável),
 * `grupoNome` (nome do cartão) e `variante` (rótulo curto da linha). Quem não
 * declara é o próprio grupo — assim 90% da base fica intocada.
 */

/**
 * Agrupa preservando a ORDEM de aparição da base: a sequência dentro de cada
 * classe é decisão clínica (dose baixa antes de dose alta), não alfabética.
 *
 * ⚠️ Um grupo com UMA variante presente exibe o nome COMPLETO do fármaco, não
 * o nome do grupo. É o que acontece quando a busca casa só "Enoxaparina —
 * dose alta": mostrar "Enoxaparina" ali esconderia qual das duas é.
 */
export function agruparVariantes(lista = []) {
  const ordem = [];
  const mapa = new Map();

  lista.forEach((f) => {
    const chave = f.grupo || f.id;
    if (!mapa.has(chave)) {
      mapa.set(chave, []);
      ordem.push(chave);
    }
    mapa.get(chave).push(f);
  });

  return ordem.map((chave) => {
    const variantes = mapa.get(chave);
    const unico = variantes.length === 1;
    return {
      chave,
      nome: unico ? variantes[0].farmaco : variantes[0].grupoNome || variantes[0].farmaco,
      unico,
      variantes,
      rotulos: unico ? [] : variantes.map((v) => v.variante).filter(Boolean),
      /* União das marcas de todas as apresentações, sem repetir e na ordem em
         que aparecem na base. O cartão do grupo PRECISA delas (dono 25/08):
         a medicação é procurada pelo nome comercial — quem atende o paciente
         ouve "Ozempic", não "semaglutida" —, e sem essa linha a Semaglutida
         era o único cartão da lista sem por onde ser reconhecida. */
      comerciais: [...new Set(variantes.flatMap((v) => v.comerciais || []))],
    };
  });
}

/**
 * Rótulo do badge de um cartão agrupado.
 *
 * ⚠️ Quando as variantes DIVERGEM, devolve `null` — o cartão fica SEM badge.
 * Um número ali seria lido como "o" intervalo daquela medicação, e ele depende
 * da dose/apresentação que ainda não foi escolhida (a enoxaparina vai de 12 h
 * a 24 h, e as regras de função renal esticam mais). Uma CONTAGEM ("2 opções")
 * também não serve: foi tentada e reprovada pelo dono em 25/08 — badge é lugar
 * de dado clínico, não de metadado da lista. Quem quer o número abre a
 * medicação. Convergindo, o valor vale para todas e pode aparecer fechado.
 */
export function resumoDoGrupo(variantes = [], lerResumo) {
  if (variantes.length === 0) return null;
  if (variantes.length === 1) return lerResumo(variantes[0]);

  const valores = variantes.map(lerResumo).filter(Boolean);
  if (valores.length !== variantes.length) return null;
  return new Set(valores).size === 1 ? valores[0] : null;
}

export default { agruparVariantes, resumoDoGrupo };
