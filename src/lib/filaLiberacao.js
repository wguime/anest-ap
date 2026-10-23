/**
 * FILA DE LIBERAÇÃO — fonte única da ORDEM EXIBIDA e de QUEM PODE SAIR (dono 23/10/2026).
 *
 * Até 23/10 a ordem era decidida em dois lugares: `gerarColunaLiberacao` ordenava o fim
 * da fila pela origem (27/08: "sempre respeitando a ordem de liberação do hospital de
 * origem") e a `LiberacoesView` repartia a lista de novo por `isExtra`, desfazendo esse
 * sort. Foto da Unimed às 10:39: a cesárea do Diego (14º do HRO) foi passada ao Costa na
 * folha "Antes de liberar", o repasse o gravou no array de ajuda, e a partição da view o
 * jogou ACIMA do Paulo (9º do HRO) e do Rodnei (12º) — ele foi liberado na vez e apareceu
 * vermelho acima de dois colegas trabalhando. A lib sozinha o deixava em último.
 *
 * Aqui mora a composição da lista e a fila sobre ela (cauda, próximo, convocar, bloqueio).
 * A view só desenha; a folha "Antes de liberar" reconfere o bloqueio por aqui no
 * momento de liberar, porque o que se faz na folha (passar a cirurgia) muda a fila.
 */

/** P1/P2 da noite do dia útil nunca são o "próximo a ser liberado" (dono 24/07). */
export const SELO_SEM_PROXIMO = new Set(['P1', 'P2'])

/**
 * Está no rodapé mas não tem trabalho neste turno. "Sem caso aqui" não é "sem
 * trabalho" (30/08): a lib carimba `teveCasos` em quem está emprestado, tem nota no
 * rodapé ou veio de outro hospital — essa linha nunca cai aqui.
 */
export const naoEscaladoLinha = (l) => !l.teveCasos && !l.notaRodape && !(l.salas?.length) && !(l.cirurgioes?.length)

/**
 * Bloco de cada linha no fim da fila. A lib carimba `blocoFila` ao montar a lista;
 * linha que não passou por ela (card noturno sintético) cai nas flags.
 *   rodape      — posição publicada (inclui o emprestado para fora, que mantém a daqui)
 *   ajuda       — ajuda sem origem conhecida, na ordem do array (ou numerada pelo dono)
 *   extra       — tem caso aqui, não está em rodapé nenhum
 *   origem      — veio de outro hospital: ordem do rodapé de LÁ (lib, 27/08)
 *   contraturno — último do rodapé escalado, sai primeiro (29/07)
 */
export function blocoDaLinha(l) {
  if (l.blocoFila) return l.blocoFila
  return l.isExtra ? 'extra' : 'rodape'
}

const ORDEM_BLOCOS = ['rodape', 'ajuda', 'extra', 'origem', 'contraturno']

/**
 * Compõe a lista exibida. Dentro de cada bloco vale a ordem da lib; entre blocos,
 * de cima (sai por último) para baixo (sai primeiro):
 *   noturnos → rodapé → ajuda sem origem → extra → de outro hospital → contraturno →
 *   ajuda que é contraturno de OUTRO hospital (exceção ESTREITA de 31/08)
 *
 * O que muda em relação à partição antiga: a ajuda do array COM origem conhecida
 * desce para o bloco de origem e fica na ordem do hospital de lá, junto dos visitantes
 * (antes ela ficava acima de todos os extras). O resto é a ordem de sempre.
 *
 * @param {object[]} linhasFase lista da lib, já com fusão noturna e selos
 * @param {{ passaNaFrenteDoPlantao?: (l: object) => boolean }} [opts]
 */
export function ordenarListaExibicao(linhasFase, { passaNaFrenteDoPlantao = () => false } = {}) {
  const noturnos = linhasFase.filter((l) => l.noturno)
  const doTurno = linhasFase.filter((l) => !l.noturno)
  const naFrente = doTurno.filter(passaNaFrenteDoPlantao)
  const demais = doTurno.filter((l) => !passaNaFrenteDoPlantao(l))
  const porBloco = ORDEM_BLOCOS.map((b) => demais.filter((l) => blocoDaLinha(l) === b))
  return [...noturnos, ...porBloco.flat(), ...naFrente]
}

/**
 * Estado da fila sobre a lista exibida: quem nasce liberado (cauda), quem está na fila,
 * o próximo a sair, o próximo a voltar e o bloqueio de cada toque.
 *
 * @param {object[]} linhas lista exibida (`ordenarListaExibicao`)
 * @param {object} ctx
 * @param {boolean} [ctx.modoFds] fila única (sáb/dom/feriado)
 * @param {boolean} [ctx.noiteFds] turno noturno da fila única
 * @param {boolean} [ctx.caudaAutomatica] cauda sem cirurgia nasce liberada (29/08: sempre)
 * @param {(l: object) => boolean} [ctx.naoEscalado]
 * @param {(l: object) => (string|null)} [ctx.plantaoFisicoDe] posto da grade (fila única)
 * @param {(l: object) => (object|undefined)} [ctx.marcaDe] entrada em `liberacoes`
 * @param {(l: object) => boolean} [ctx.chegouHoraDe] hora de saída combinada já chegou
 * @param {(l: object) => (string|null)} [ctx.horaSaidaDe] 'HH:MM' de turno próprio/equipe
 */
export function estadoDaFila(linhas, ctx = {}) {
  const {
    modoFds = false, noiteFds = false, caudaAutomatica = true,
    naoEscalado = naoEscaladoLinha,
    plantaoFisicoDe = () => null,
    marcaDe = () => undefined,
    chegouHoraDe = () => false,
    horaSaidaDe = () => null,
  } = ctx

  // Ocupa posição na ordem publicada? Na noite da fila única a ordem é
  // `fds_meta.ordemNoite`, que `noRodape` (carimbado pela lib do dia) não alcança.
  const temPosicao = (l) => ((modoFds && l.noturno) ? true : !!l.noRodape)
  // NA NOITE DA FILA ÚNICA SÓ OS DOIS POSTOS TRABALHAM (dono 29/08): a cirurgia que
  // aparece no card noturno é herança da tarde, não escalação da noite.
  const semEscalacaoNoTurno = (l) => (noiteFds ? !plantaoFisicoDe(l) : naoEscalado(l))
  // O posto da grade (fila única) nunca fica liberado — nem por toque, nem pela cauda (05/09).
  const postoDoTurno = (l) => modoFds && !!plantaoFisicoDe(l)
  const liberadoReal = (l) => {
    const m = marcaDe(l)
    return !!m && m.escalado !== true && !postoDoTurno(l)
  }

  // DIA ÚTIL: A FRONTEIRA DA CAUDA É DA LISTA, NÃO DA ORDEM (dono 21/09). Quem está no
  // rodapé sem cirurgia ACIMA de uma ajuda que trabalha espera a vez — não nasce liberado.
  // No dia útil o card noturno (P1–P4 no topo) não define fronteira.
  let idxUltimoTrabalho = -1
  for (let i = linhas.length - 1; i >= 0; i--) {
    const l = linhas[i]
    const trabalha = !semEscalacaoNoTurno(l) || (modoFds && !!plantaoFisicoDe(l))
    const conta = modoFds ? temPosicao(l) : !l.noturno
    if (conta && trabalha) { idxUltimoTrabalho = i; break }
  }
  // NINGUÉM com trabalho = NÃO EXISTE CAUDA (dono 22/08): sem esta guarda a fila inteira
  // nasceria vermelha quando o mapa do turno chega sem anestesista definido.
  const temAlguemComTrabalho = idxUltimoTrabalho >= 0
  // A CAUDA É CALCULADA ANTES DA FILA: quem nasce liberado não conta como posição a liberar.
  const caudaLiberada = (l, i) => caudaAutomatica && temAlguemComTrabalho
    && temPosicao(l) && (modoFds || !l.noturno) && semEscalacaoNoTurno(l)
    && marcaDe(l)?.escalado !== true && i > idxUltimoTrabalho

  // ⚠️ `false` aqui significa que a fila PULA a pessoa. Só cabe a quem NUNCA sai por
  // esta fila (P1/P2 da noite, posto do FDS, já liberado, cauda). Quem só precisa
  // poder SAIR a qualquer hora (turno próprio, 11/09) fica DENTRO e é isentado no
  // bloqueio — confundir os dois pôs o amarelo no 3º do rodapé com a 4ª em sala.
  const naFila = (l, i) => {
    if (caudaLiberada(l, i)) return false
    if (l.noturno && (modoFds ? l.foraDaFila : SELO_SEM_PROXIMO.has(l.selo))) return false
    // FILA ÚNICA, TURNO DE DIA: o plantão da faixa nunca é o próximo (dono 29/08)
    if (modoFds && !l.noturno && plantaoFisicoDe(l)) return false
    const m = marcaDe(l)
    if (m && !m.escalado) return false // já liberada: saiu da fila
    // FILA ÚNICA: quem tem posição está na fila tenha ou não cirurgia (29/08);
    // extra/ajuda/visitante sem posição seguem por "está em sala?" (24/08)
    if (modoFds && !l.noturno && l.noRodape) return true
    if (modoFds) return m?.escalado === true || !naoEscalado(l)
    // DIA ÚTIL — A FILA É A LISTA (dono 18/09): "o último da lista deve ser SEMPRE o
    // próximo a ser liberado e NUNCA o próximo a ser liberado deve estar no meio da lista".
    return true
  }

  // A ORDEM (quem pode sair agora) = ÚLTIMO não-liberado da fila.
  let idxProximo = -1
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (naFila(linhas[i], i)) { idxProximo = i; break }
  }
  const proximoNome = idxProximo >= 0 ? linhas[idxProximo].anestesista : null

  // O CARTÃO AMARELO (dono 29/08, só na fila única): o último com escalação — a ordem
  // trava todo mundo que tem posição, mas a tinta cai sobre quem está trabalhando; o
  // toque que aciona alguém (`{ escalado: true }`) conta como escalação (19/09).
  // No dia útil o cartão segue sendo o `idxProximo`, como desde 27/07.
  let idxCartao = idxProximo
  if (modoFds) {
    idxCartao = -1
    for (let i = linhas.length - 1; i >= 0; i--) {
      const l = linhas[i]
      if (naFila(l, i) && (!naoEscalado(l) || marcaDe(l)?.escalado === true)) { idxCartao = i; break }
    }
  }

  // CONVOCAR TAMBÉM SEGUE A ORDEM (dono 20/08): a fila sai de baixo p/ cima, então volta
  // de cima p/ baixo — o próximo a convocar é o liberado mais próximo de quem ainda está
  // em sala. Quem nunca esteve na fila (sem caso) fica fora da conta.
  const voltaPraFila = (l) => !l.noturno && ((modoFds && l.noRodape) || !naoEscalado(l))
  const jaLiberada = (l) => { const m = marcaDe(l); return !!m && m.escalado !== true }
  let idxConvocar = -1
  for (let i = idxProximo + 1; i < linhas.length; i++) {
    if (jaLiberada(linhas[i]) && voltaPraFila(linhas[i])) { idxConvocar = i; break }
  }
  const nomeConvocar = idxConvocar >= 0 ? linhas[idxConvocar].anestesista : null

  /**
   * Bloqueio do toque no círculo — nos DOIS sentidos: só o "próximo" sai e só o
   * "próximo a convocar" volta. HORA DE SAÍDA (21/09): quem tem hora combinada sai a
   * partir dela, esteja a fila onde estiver; antes, a ordem vale como para todos.
   * @returns {null|{modo:'liberar',faltam:number,proximo:string,horaSaida:string|null}|{modo:'convocar',proximo:string}}
   */
  const bloqueioDe = (l, i) => {
    if (liberadoReal(l)) {
      return (idxConvocar >= 0 && i > idxProximo && i !== idxConvocar && voltaPraFila(l))
        ? { modo: 'convocar', proximo: nomeConvocar }
        : null
    }
    if (idxProximo >= 0 && i !== idxProximo && naFila(l, i) && !chegouHoraDe(l)) {
      return {
        modo: 'liberar',
        faltam: linhas.slice(i + 1).filter((x, k) => naFila(x, i + 1 + k)).length,
        proximo: proximoNome,
        horaSaida: horaSaidaDe(l),
      }
    }
    return null
  }

  return {
    idxUltimoTrabalho, temAlguemComTrabalho, idxProximo, proximoNome, idxCartao, idxConvocar, nomeConvocar,
    caudaLiberada, naFila, voltaPraFila, postoDoTurno, liberadoReal, bloqueioDe,
  }
}
