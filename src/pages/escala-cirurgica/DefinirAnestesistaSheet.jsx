/**
 * DefinirAnestesistaSheet — troca o RESPONSÁVEL (substitui o sistema de trocas,
 * aposentado 2026-07-23) em DOIS modos:
 *   - SALA (header da Completa): atinge SÓ os casos não terminados do
 *     responsável-BASE da sala (+ linhas herdadas "//"/vazias). Linha com
 *     anestesista PRÓPRIO fica de fora — lição 23/07: o update sala-inteira
 *     achatou o IOSC (multi-anestesista) p/ uma pessoa e dois anestesistas
 *     SUMIRAM da escala.
 *   - CASO (detalhe do caso): atinge só aquele caso — é o caminho p/ trocar
 *     uma linha específica de bloco multi (IOSC/Exames/Umanitá).
 * Completa/Liberações/Minhas derivam dos casos → atualizam juntas (realtime).
 *
 * DESENHO "LISTA DE COLEGAS" (dono 17/08, escolhido em protótipo): o Select saiu
 * e o roster É a tela. Dois problemas do desenho antigo:
 *   1. o painel ficava quase vazio (um Select e um botão dentro de 85% da tela);
 *   2. o que o sheet DECIDE — quem passa a responder por quais casos — não
 *      aparecia em lugar nenhum.
 * Agora o cabeçalho declara o alcance ("2 de 3 cirurgias mudam de dono"), cada
 * colega vem com onde ele está agora (posição na fila e cirurgias no turno) e o
 * rodapé repete o efeito inteiro antes de confirmar. Escolher passou de dois
 * toques (abrir o Select, escolher) para um.
 */
import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Input } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { HOSPITAL_LABEL, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { fraseClinica, nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import {
  alvosTrocaResponsavel, anestesistaDaSala, filtrarPorTurno,
  nomeAnestesistaExibicao, normNome, salaExibicao,
} from './utils'
import { doHospital, ladosDeComoEntra, situacaoDeQuemRecebe, textosComoEntra } from './repasseForaDoRodape'
import ComoEntra from './PerguntaComoEntra'
import { avaliarEscolhaAnestesista } from './foraDaOrdem'
import { ehDiaOperacionalAtual } from '@/lib/escalaHorarioReal'
import useAgoraMinutoEscala from './useAgoraMinutoEscala'
import { CartaoCirurgia, CasasCirurgia, TempoTotalPessoa, tempoTotalDaPessoa } from './TemposCirurgia'
import ConfirmarForaDaOrdem from './ConfirmarForaDaOrdem'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

// Sentinela: "deixar sem anestesista" (valor impossível como uid).
const SEM_ANESTESISTA = '__sem__'
const TURNO_LABEL = { matutino: 'Manhã', vespertino: 'Tarde' }

/**
 * @param {boolean} encerrado  TURNO JÁ ENCERRADO (dono 28/10, modelo A+): passar a cirurgia a
 *   quem a fez é a saída da que ficou no nome errado — e só isso. A fila daquele turno acabou,
 *   então nada aqui mexe nela: sem "assumir também a posição", sem a pergunta da troca entre
 *   hospitais, sem o aviso de "fora da ordem" (é sobre chamar alguém AGORA) e sem os efeitos do
 *   repasse na fila (`semEfeitosNaFila`).
 * @param {boolean} corrigirQuemFez  A FOLHA DO HORÁRIO (dono 29/10, modelo B de
 *   `.tmp/popup-horarios/trocar-responsavel.html`): quem recebe na caixa ou no pop-up uma cirurgia
 *   que não fez passa-a a quem fez. É correção, não repasse: a terminada entra (a regra de 24/07 é
 *   do repasse), "Sem anestesista" sai da lista (a cirurgia não some da conta) e saem as decisões
 *   de fila — assumir a posição, a troca entre hospitais e o "fora da ordem" ficam na Completa.
 *   Os cuidados automáticos do repasse continuam valendo no turno em curso; quem os desliga é
 *   `encerrado`.
 * @param {Function} gravar  `(ids, payload, { rotulo }) => Promise` no lugar do context — a
 *   cirurgia de DIA ANTERIOR, cuja escala não está carregada (grava pelo id).
 * @param {Function} onConfirmado  avisa que a troca foi feita (a folha fecha nos dois casos).
 * @param {string} dia  o dia da cirurgia, quando não é hoje ("Ontem · qua 28/10").
 */
export default function DefinirAnestesistaSheet({ escala, sala, casosAlvo = null, turno = null, onClose, encerrado = false, corrigirQuemFez = false, gravar = null, onConfirmado = null, dia = null }) {
  // a correção de quem fez (turno encerrado ou folha do horário) alcança a terminada e não decide fila
  const correcao = encerrado || corrigirQuemFez
  const { user } = useUser()
  const { setAnestesistaCasos, executarSubstituicao } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  // `undefined` = ainda não tocado: a dupla já gravada preenche o segundo por baixo
  // (ver `duplaAtual`); '' = "Só um anestesista" escolhido de propósito.
  const [uidSegundo, setUidSegundo] = useState(undefined) // dupla na MESMA cirurgia
  const [abrirSegundo, setAbrirSegundo] = useState(null) // null = aberto se já há dupla
  // SELETOR EM FOLHA (dono 17/08, 3ª rodada): o dropdown do Select do DS herda a
  // LARGURA DO GATILHO (`width = triggerWidth` em computePosition), e o gatilho
  // aqui é meio card — a lista saía num popover estreito, com os nomes quebrando.
  // Uma folha própria dá largura inteira, busca no topo e altura fixa com rolagem.
  const [pickerAberto, setPickerAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  // COMO QUEM RECEBE ENTRA NA FILA (dono 10–11/11, `repasseForaDoRodape.js`): 'ajuda' | 'assume' |
  // 'trocaram'. Nada vem marcado, e trocar a pessoa escolhida zera a resposta.
  const [comoEntra, setComoEntra] = useState(null)
  // ANESTESISTA FORA DA ORDEM (dono 15/10, modelo A) — { avaliacao, uid, podeUsar }
  const [foraDaOrdem, setForaDaOrdem] = useState(null)
  const { escalas, hoje } = useEscalaCirurgica()

  // MODO SALA opera SÓ no turno exibido (bug 31/07): a sala existe nos dois
  // turnos e o sheet consultava os casos do DIA INTEIRO — "Responsável atual"
  // mostrava o dono da MANHÃ com o board na tarde (CC-Sala 3: header
  // "Paulo + Guilherme", sheet "Aline"), e o repasse alcançaria caso
  // não-terminado do outro turno. Sem turno (chamada legada) = dia inteiro.
  const casosTurno = useMemo(() => filtrarPorTurno(escala?.casos || [], turno), [escala, turno])

  // casosAlvo explícito (grupo por anestesista / caso do detalhe) → alvos são
  // exatamente eles (não-terminados); senão modo SALA = TODOS os casos não-terminados
  // da sala NO TURNO (pedido do dono 24/07 — terminados mantêm quem os fez).
  // ⚠️ EXCEÇÃO DO TURNO ENCERRADO (dono 28/10, modelo A+): ali o "Trocar" é CORRIGIR QUEM FEZ a
  // cirurgia aberta no detalhe — e a que ficou no nome errado quase sempre já está terminada.
  // A regra de 24/07 é sobre o REPASSE (passar a sala adiante não reescreve quem já fez); a
  // correção de uma cirurgia só, num turno que acabou, é outra coisa. Só com `casosAlvo`.
  // Vale também para a folha do horário (29/10, `corrigirQuemFez`): ali o turno pode estar em
  // curso, e a terminada aparecia riscada com "Nada a passar" — a pessoa ficava sem saída.
  const { alvos } = useMemo(() => {
    if (casosAlvo?.length) {
      return { alvos: correcao ? casosAlvo : casosAlvo.filter((c) => (c.statusCirurgia || 'agendada') !== 'terminada') }
    }
    return alvosTrocaResponsavel(casosTurno, sala)
  }, [casosTurno, sala, casosAlvo, correcao])

  // O QUE NÃO MUDA: cirurgia terminada mantém quem a fez. Era a parte invisível
  // da decisão — quem repassava a sala não sabia que uma das linhas ficava para
  // trás, e só descobria olhando o quadro depois.
  const naoMudam = useMemo(() => {
    if (correcao && casosAlvo?.length) return [] // a correção de quem fez alcança a terminada
    const base = casosAlvo?.length ? casosAlvo : casosTurno.filter((c) => c.sala === sala)
    return base.filter((c) => (c.statusCirurgia || 'agendada') === 'terminada')
  }, [casosAlvo, casosTurno, sala, correcao])

  const atual = useMemo(() => {
    const ref = casosAlvo?.[0]
    if (ref) {
      const alias = String(ref.anestesista || '').trim()
      return { alias, uid: ref.anestesistaUserId || (alias ? resolver(alias) : null) }
    }
    const direto = anestesistaDaSala(casosTurno, sala)
    const alias = direto.alias || casosTurno.find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    return { alias, uid: direto.uid || (alias ? resolver(alias) : null) }
  }, [casosTurno, sala, casosAlvo, resolver])

  // Nome mostrado = MESMA função do cabeçalho da sala na Completa (bug 29/07: o
  // cabeçalho vinha do cadastro e este texto vinha do alias importado, então
  // "Guilherme Staub" no cabeçalho e "Staub" aqui — o dono leu como duas pessoas).
  const nomeAtual = useMemo(
    () => nomeAnestesistaExibicao({ uid: atual.uid, alias: atual.alias, rosterByUid }),
    [atual, rosterByUid]
  )

  // A LISTA É SÓ DE NOMES (dono 17/08): a posição na fila e a contagem de
  // cirurgias saíram do rótulo. Quem escolhe aqui está procurando UMA pessoa pelo
  // nome, e o texto extra fazia cada linha virar uma frase para ler.
  const jaSemAnestesista = !!alvos.length && alvos.every((c) => c.semAnestesista)
  // O seletor nasce VAZIO quando já existe responsável: repetir o nome de quem
  // está lá, com "Confirmar" desabilitado, era o botão morto do print de 29/07.
  const escolhido = uidEscolhido || (jaSemAnestesista ? SEM_ANESTESISTA : '')
  const casoUnico = casosAlvo?.length === 1 ? casosAlvo[0] : null

  // OPÇÕES: "Sem anestesista" primeiro e o resto em ORDEM ALFABÉTICA, só o nome
  // (dono 17/08). Ordenação com `localeCompare` pt-BR — sem ela, nome acentuado
  // vai parar depois do Z.
  // Na folha do horário (29/10) não há "Sem anestesista": a cirurgia passa para quem a fez —
  // tirar o nome apagaria a cobrança do horário em vez de levá-la a alguém.
  const opcoes = useMemo(() => [
    ...(corrigirQuemFez ? [] : [{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }]),
    ...[...(rosterOpcoes || [])].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  ], [rosterOpcoes, corrigirQuemFez])

  // BUSCA no topo da folha (dono 17/08): o roster passa de 45 pessoas e rolar
  // tudo com o dedo no meio do plantão é pior que digitar duas letras. Casa por
  // nome OU apelido — quem procura "Staub" não digita "Guilherme".
  const lista = useMemo(() => {
    const q = normNome(busca)
    if (!q) return opcoes
    return opcoes.filter((o) => {
      const r = rosterByUid.get(o.value)
      return normNome(o.label).includes(q) || (r?.apelidos || []).some((a) => normNome(a).includes(q))
    })
  }, [opcoes, rosterByUid, busca])

  const agoraMin = useAgoraMinutoEscala()
  // tempo total de quem SAI, lido da linha dele na fila (não entra na correção de quem fez)
  const totalDeQuemSai = !correcao && nomeAtual && alvos.length
    ? (tempoTotalDaPessoa(escala, alvos[0], escalas)?.termino || '') : ''
  const pergunta = casoUnico
    ? 'Quem responde por esta cirurgia?'
    : `Quem responde pela ${salaExibicao(sala)}?`
  // Contexto do alvo. "agora com X" NÃO é decoração: é o que denunciou o bug de
  // 31/07 (com o board na tarde, o sheet mostrava o dono da MANHÃ). Some com o
  // nome daqui e a divergência de turno volta a ser invisível.
  const contexto = [
    dia,
    TURNO_LABEL[turno],
    HOSPITAL_LABEL?.[escala?.hospital],
    casoUnico
      ? [casoUnico.hora, nomeCirurgiaoCurto(titleCaseNome(casoUnico.cirurgiao))].filter(Boolean).join(' · ')
      : null,
    nomeAtual ? `agora com ${nomeAtual}` : null,
  ].filter(Boolean).join(' · ')
  const rotulo = casoUnico
    ? `${salaExibicao(sala)}${casoUnico.cirurgiao ? ` · ${nomeCirurgiaoCurto(casoUnico.cirurgiao)}` : ''}`
    : `${salaExibicao(sala)}${casosAlvo?.length && atual.alias ? ` — ${nomeAtual}` : ''} (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`


  // DUPLA NA MESMA CIRURGIA (dono 11/08). Duas pessoas não cabem num uid: o
  // texto "A + B" É o dado — a Completa mostra as duas no cabeçalho, a fila
  // conta presença das duas e nenhuma transferência mexe em sala compartilhada.
  //
  // EM TODOS OS MODOS (dono 14/09). Até aqui era "só no modo CASO", e foi assim
  // que a Hemodinâmica da tarde perdeu a dupla: o dono abriu pelo cabeçalho da
  // sala (modo SALA, 3 linhas com "//" herdado), a linha "Dois anestesistas" não
  // existia, confirmou uma pessoa e as três ficaram com ela. A dupla vale para os
  // ALVOS — no modo SALA são os casos não terminados que mudam de mão, e sala
  // multi-anestesista já chega SPLIT por pessoa (BoardView), então a lição de
  // 27/07 (um bloco por anestesista) continua de pé.
  //
  // O PRIMEIRO da dupla é quem foi escolhido — ou, sem escolha, quem JÁ responde:
  // "acrescentar a Gabriela ao Adriano" não pode exigir re-escolher o Adriano num
  // seletor que nasce vazio de propósito. Quem já é dupla ("A + B") ou "?" não
  // tem uid, e aí o primeiro precisa ser escolhido.
  // DUPLA JÁ GRAVADA ("A + B", uid nulo por construção): as duas metades resolvidas
  // pelo dicionário. Com as duas resolvidas a folha nasce com o par PREENCHIDO
  // (dono 14/09: "quero que o segundo anestesista já venha preenchido, conforme
  // veio do mapa") — trocar UM dos dois, ou desmarcar o segundo, vira um toque.
  // Antes, uma dupla abria a folha sem uid nenhum: era preciso escolher os dois de
  // novo, e o dono leu como "não há opção de trocar um dos anestesistas".
  const duplaAtual = useMemo(() => {
    const alias = String(atual.alias || '')
    if (!alias.includes('+')) return null
    const metades = alias.split(/\s*\+\s*/).map((s) => s.trim()).filter((s) => s && !/^\?+$/.test(s))
    if (metades.length !== 2) return null
    const [p, s] = metades.map((m) => resolver(m) || null)
    // `textos` guarda a grafia ORIGINAL de cada metade: a metade que não muda volta
    // como estava, nunca reescrita pelo dicionário (apelidos[0] é o primeiro em
    // ordem alfabética — "GUILHERME M ELO" —, o dicionário envenenado de 02/09)
    return p && s && p !== s ? { primeiro: p, segundo: s, textos: { [p]: metades[0], [s]: metades[1] } } : null
  }, [atual.alias, resolver])
  const primeiroUid = escolhido === SEM_ANESTESISTA ? '' : (escolhido || atual.uid || duplaAtual?.primeiro || '')
  const podeDupla = !!primeiroUid && alvos.length > 0
  const opcoesSegundo = useMemo(
    () => [{ value: '', label: 'Só um anestesista' }, ...(rosterOpcoes || []).filter((o) => o.value !== primeiroUid)],
    [rosterOpcoes, primeiroUid]
  )
  // segundo não tocado numa dupla: a outra metade. Se o novo PRIMEIRO escolhido é
  // justamente quem era o segundo, as metades trocam de lugar em vez de a dupla
  // virar uma pessoa só em silêncio.
  const segundoUid = uidSegundo !== undefined
    ? uidSegundo
    : !duplaAtual ? ''
      : (escolhido && escolhido === duplaAtual.segundo) ? duplaAtual.primeiro : duplaAtual.segundo
  const segundo = podeDupla && segundoUid && segundoUid !== primeiroUid ? rosterByUid.get(segundoUid) : null
  const segundoEscolhido = segundo
  const primeiro = primeiroUid ? rosterByUid.get(primeiroUid) || null : null

  /**
   * QUEM RECEBE NÃO ESTÁ NA FILA DAQUI (dono 10–11/11/2026, modelo B). A ordem do rodapé
   * vale sempre; quando o repasse mexe nela, a folha pergunta por quê. Substitui o
   * interruptor "Assumir também a posição" (30/07) e a pergunta "Os dois trocaram de
   * hospital?" (27/10), que só cobria uma das situações. Entre colegas do MESMO rodapé
   * (85% dos repasses) `situacao` é nula e nada muda. Fora: correção de quem fez, dupla,
   * "sem anestesista" e caso sem dono (definir não é repassar).
   */
  const quemPassa = useMemo(() => {
    if (!atual.uid && !atual.alias) return null
    const r = atual.uid ? rosterByUid.get(atual.uid) : null
    return { uid: atual.uid || null, nome: r?.nome || atual.alias, apelido: atual.alias || r?.apelidos?.[0] || '' }
  }, [atual, rosterByUid])
  const quemRecebe = useMemo(() => (primeiro && !segundo && escolhido && escolhido !== SEM_ANESTESISTA
    ? { uid: primeiro.uid, nome: primeiro.nome, apelido: primeiro.apelidos?.[0] || primeiroNomeUpper(primeiro.nome) }
    : null), [primeiro, segundo, escolhido])
  const idsPassando = useMemo(() => alvos.map((c) => c.id).filter(Boolean), [alvos])
  const situacao = useMemo(() => (correcao || !quemPassa || !quemRecebe || !idsPassando.length ? null
    : situacaoDeQuemRecebe({ escalas, escala, turno: turno || alvos[0]?.turno, resolverUid: resolver, quemPassa, quemRecebe, idsPassando })),
  [correcao, quemPassa, quemRecebe, idsPassando, escalas, escala, turno, alvos, resolver])
  const textosEntrada = situacao
    ? textosComoEntra({
      situacao, hospital: escala?.hospital, turno: situacao.turno,
      nomeA: nomeAtual, nomeB: nomeAnestesistaExibicao({ uid: quemRecebe.uid, alias: '', rosterByUid }),
    })
    : null
  // a resposta em vigor: com uma opção só é aviso (ajuda); senão, o que foi tocado — e só
  // vale se ainda é uma das opções (mudar a pessoa muda as opções)
  const entrada = !situacao ? null
    : textosEntrada.aviso ? 'ajuda'
      : (situacao.opcoes.includes(comoEntra) ? comoEntra : null)
  const planoEntrada = situacao && entrada && entrada !== 'ajuda'
    ? ladosDeComoEntra({ escolha: entrada, situacao, escalas, escala, turno: situacao.turno, resolverUid: resolver, quemPassa, quemRecebe, idsPassando })
    : { lados: [], limparTroca: [] }
  const segundoAberto = abrirSegundo ?? !!duplaAtual
  const apelidoDe = (r) => duplaAtual?.textos?.[r?.uid] || r?.apelidos?.[0] || primeiroNomeUpper(r?.nome)
  const nomeEscolhido = escolhido && escolhido !== SEM_ANESTESISTA
    ? nomeAnestesistaExibicao({ uid: escolhido, alias: '', rosterByUid })
    : ''
  const nomeSegundo = segundo ? nomeAnestesistaExibicao({ uid: segundo.uid, alias: '', rosterByUid }) : ''
  // nome do PRIMEIRO no card ASSUME: o escolhido; sem escolha, quem já responde (na
  // dupla, a primeira metade — `nomeAtual` inteiro repetiria "A + B + B")
  const nomePrimeiro = nomeEscolhido
    || (duplaAtual ? nomeAnestesistaExibicao({ uid: duplaAtual.primeiro, alias: '', rosterByUid }) : nomeAtual)
  // O QUE VAI SER GRAVADO, comparado com o que já está: Confirmar só acende quando
  // muda alguma coisa (o botão morto do print de 29/07 continua proibido). Na dupla
  // já gravada, "desmarcar o segundo" e "trocar uma metade" SÃO mudanças.
  const resultado = escolhido === SEM_ANESTESISTA
    ? { tipo: 'sem' }
    : segundo && primeiro
      ? { tipo: 'dupla', a: primeiro.uid, b: segundo.uid }
      : primeiro ? { tipo: 'um', a: primeiro.uid } : null
  const semMudanca = !resultado
    || (resultado.tipo === 'um' && !duplaAtual && resultado.a === atual.uid)
    || (resultado.tipo === 'dupla' && !!duplaAtual && duplaAtual.primeiro === resultado.a && duplaAtual.segundo === resultado.b)
    || (resultado.tipo === 'sem' && jaSemAnestesista)

  /**
   * FORA DA ORDEM (dono 15/10, `foraDaOrdem.js`): só quando a cirurgia é URGÊNCIA ou
   * emergência — repassar a sala eletiva a um colega no fim do turno é rotina e não
   * é "chamar alguém". Confere só quem ENTRA (quem já responde não foi chamado
   * agora), e as cirurgias que estão mudando de mão não contam como ocupação.
   * Assumir a posição é troca de lugar na fila, não chamada: fica de fora.
   */
  const avaliarQuemEntra = (pessoas) => {
    if (correcao || escala?.data !== hoje || entrada === 'assume' || entrada === 'trocaram') return null
    if (!alvos.some((c) => c.tipo === 'urgencia' || c.tipo === 'emergencia')) return null
    const jaResponde = new Set([atual.uid, duplaAtual?.primeiro, duplaAtual?.segundo].filter(Boolean))
    for (const p of pessoas) {
      if (!p?.uid || jaResponde.has(p.uid)) continue
      const avaliacao = avaliarEscolhaAnestesista({
        escalas, escala, turno: turno || alvos[0]?.turno,
        pessoa: { uid: p.uid, nome: p.apelidos?.[0] || p.nome },
        resolverUid: resolver, ignorarCasos: alvos.map((c) => c.id).filter(Boolean), quemSai: [...jaResponde],
      })
      if (avaliacao?.foraDaOrdem) return { avaliacao, uid: p.uid }
    }
    return null
  }

  const confirmar = async ({ confirmado = false, uidForcado = null } = {}) => {
    const semAnest = !uidForcado && escolhido === SEM_ANESTESISTA
    // com segundo, o primeiro pode ser quem já responde (nenhuma escolha nova)
    // o primeiro pode ser quem já responde (nenhuma escolha nova) — inclusive a
    // primeira metade de uma dupla já gravada
    const r = uidForcado ? rosterByUid.get(uidForcado) : semAnest ? null : primeiro
    const segundo = uidForcado ? null : segundoEscolhido
    if (!semAnest && !r) return
    if (!confirmado && !semAnest) {
      const fora = avaliarQuemEntra([r, segundo])
      if (fora) { setForaDaOrdem({ ...fora, podeUsar: !segundo }); return }
    }
    setForaDaOrdem(null)
    // QUEM RECEBE É DE FORA DA FILA DAQUI: a resposta decide o que se grava (10–11/11).
    // A folha só chega aqui com a resposta dada (o botão fica apagado sem ela).
    const sit = uidForcado ? null : situacao
    if (sit && !entrada) return
    const B = sit ? textosEntrada.nomes.B : ''
    const A = sit ? textosEntrada.nomes.A : ''
    if (sit && (entrada === 'assume' || entrada === 'trocaram') && planoEntrada.lados.length) {
      // posição + cirurgias numa transação (RPC) — espera a persistência com spinner,
      // como o TrocaSheet; só então fecha. O aviso traz "Desfazer" por 10 s.
      setSalvando(true)
      try {
        await executarSubstituicao(planoEntrada, { userId: user?.uid || user?.id || null }, {
          desfazivel: true,
          aviso: entrada === 'trocaram'
            ? { title: `${A} e ${B} trocaram de hospital`, description: `${B} é o ${sit.slotA.posicao}º ${doHospital(escala.hospital)}` }
            : { title: `${B} assumiu a posição de ${A}`, description: `${B} é o ${sit.slotA.posicao}º ${doHospital(escala.hospital)}` },
        })
        onConfirmado?.()
        onClose?.()
      } catch { /* toast de erro já vem do context */ } finally {
        setSalvando(false)
      }
      return
    }
    // Caminho OTIMISTA (dono 19/08): o context pinta o quadro no dispatch — a
    // folha fecha no toque em vez de segurar o spinner um RTT inteiro; erro
    // reverte + toasta por conta do context. (Dupla: a posição na fila NÃO é
    // oferecida junto — com dois donos não existe um slot único a assumir.)
    const payload = segundo
      ? { uid: null, apelido: `${apelidoDe(r)} + ${apelidoDe(segundo)}`, dupla: true }
      : semAnest
        ? { uid: null, apelido: '?' }
        : { uid: r.uid, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) }
    const ids = alvos.map((c) => c.id)
    // de dia anterior quem grava é quem chamou (pelo id); o resto passa pelo context
    const gravacao = gravar
      ? gravar(ids, payload, { rotulo })
      : setAnestesistaCasos(escala, ids, payload, {
        rotulo, resolverUid: resolver, userId: user?.uid || user?.id || null, semEfeitosNaFila: encerrado,
        // entrou como AJUDA: mudou a fila (linha a mais no fim) — o aviso diz e dá 10 s para voltar
        ...(sit ? {
          desfazivel: true,
          aviso: { title: `${B} entrou como ajuda`, description: sit.slotA ? `${A} segue ${sit.slotA.posicao}º ${doHospital(escala.hospital)}` : `Fim da fila ${doHospital(escala.hospital)}` },
        } : {}),
      })
    Promise.resolve(gravacao).catch(() => { /* o aviso de erro já vem de quem grava */ })
    onConfirmado?.()
    onClose?.()
  }

  // Resumo do lado que SAI: quantas cirurgias ele tem aqui e quantas ficam com
  // ele por já terem terminado.
  const totalLado = alvos.length + naoMudam.length
  const resumoSai = [
    totalLado ? `${totalLado} ${totalLado === 1 ? 'cirurgia' : 'cirurgias'}` : 'sem cirurgia',
    naoMudam.length ? `${naoMudam.length} terminada${naoMudam.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')

  if (foraDaOrdem) {
    return (
      <ConfirmarForaDaOrdem
        avaliacao={foraDaOrdem.avaliacao}
        nome={rosterByUid.get(foraDaOrdem.uid)?.nome || ''}
        hospitalLabel={HOSPITAL_LABEL[escala?.hospital] || escala?.hospital || ''}
        turno={turno || alvos[0]?.turno}
        rosterByUid={rosterByUid}
        salvando={salvando}
        onConfirmar={() => confirmar({ confirmado: true })}
        onUsarProximo={foraDaOrdem.podeUsar
          ? (p) => { setUidEscolhido(p.uid); confirmar({ confirmado: true, uidForcado: p.uid }) }
          : undefined}
        onTrocar={() => setForaDaOrdem(null)}
      />
    )
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      {/* o painel acompanha o conteúdo: o default do DS fixa 85% da tela e era
          justamente o que fazia este sheet parecer vazio (dono 17/08) */}
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-2">
            {!casoUnico && (
              <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-primary-foreground">
                {salaExibicao(sala)}
              </span>
            )}
            <SheetTitle className="text-[17px] leading-tight">{pergunta}</SheetTitle>
          </div>
          {contexto && <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{contexto}</p>}
        </SheetHeader>

        <div className="px-4 pb-4">
          {/* ── DE → PARA (dono 17/08): quem sai e quem assume lado a lado, no
              topo, logo abaixo do título. O card ASSUME É o seletor: o Select do
              DS (o mesmo que está em produção, com busca) fica INVISÍVEL por
              cima dele, então o toque abre o dropdown ancorado no card e o
              painel não vira uma lista rolante (dono 17/08, 2ª rodada). ── */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
            <div className="flex min-h-[58px] flex-col justify-center gap-px rounded-2xl border border-border-strong px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sai</span>
              <span className="text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">{nomeAtual || '—'}</span>
              <span className="text-[11px] text-muted-foreground">{resumoSai}</span>
            </div>
            <ChevronRight className="h-4 w-4 self-center text-muted-foreground" />
            <button
              type="button"
              onClick={() => !rosterLoading && setPickerAberto(true)}
              aria-label="Escolher quem assume"
              className="flex min-h-[58px] items-center gap-1.5 rounded-2xl border border-primary bg-primary/[0.08] px-2.5 py-1.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assume</span>
                <span className={[
                  'block text-[15px] font-bold leading-tight [overflow-wrap:anywhere]',
                  escolhido ? '' : 'text-primary',
                ].join(' ')}>
                  {escolhido === SEM_ANESTESISTA
                    ? 'Sem anestesista'
                    : segundo
                      ? `${nomePrimeiro} + ${nomeSegundo}`
                      : (nomeEscolhido || 'Escolher…')}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {escolhido || segundo ? 'toque para trocar' : 'toque para ver a lista'}
                </span>
              </span>
              {rosterLoading
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                : <ChevronDown className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          </div>

          {/* ── O QUE MUDA DE MÃOS ─────────────────────────────────────────── */}
          {/* CADA CIRURGIA QUE PASSA COM AS TRÊS CASAS DELA (dono 10/11, modelo A): Início ·
              Tempo estimado · Término, com o nome no título — os horários são da cirurgia e
              vão junto com ela. Era "Procedimentos assumidos", uma linha por cirurgia, sem
              dizer o que acontecia com os tempos. Só leitura: aqui se troca quem responde. */}
          <p className="mb-1.5 mt-3 flex items-baseline gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cirurgias que passam
            {alvos.length > 0 && <span className="font-medium normal-case tracking-normal">{alvos.length} · os horários vão junto</span>}
          </p>
          <div className="grid gap-1.5">
            {alvos.map((c) => (
              <CartaoCirurgia key={c.id} titulo={[c.hora || '—', c.pacienteIniciais, fraseClinica(c.procedimento)].filter(Boolean).join(' · ')}>
                <CasasCirurgia caso={c} agoraMin={agoraMin} diaAtual={ehDiaOperacionalAtual(escala?.data)} />
              </CartaoCirurgia>
            ))}
          </div>
          {!alvos.length && (
            <p className="py-1.5 text-[12.5px] text-muted-foreground">
              Nada a passar: as cirurgias já terminaram e mantêm quem as fez.
            </p>
          )}
          {naoMudam.map((c) => (
            <div key={c.id} className="flex items-baseline gap-2 border-b border-border py-1.5 text-[12.5px] text-muted-foreground last:border-b-0">
              <b className="tabular-nums">{c.hora || '—'}</b>
              {c.pacienteIniciais && <span>{c.pacienteIniciais}</span>}
              <span className="min-w-0 truncate line-through">{fraseClinica(c.procedimento)}</span>
            </div>
          ))}
          {naoMudam.length > 0 && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {naoMudam.length === 1 ? `A das ${naoMudam[0].hora} já terminou` : `${naoMudam.length} já terminaram`}
              : fica{naoMudam.length === 1 ? '' : 'm'} com {nomeAtual || 'quem fez'}.
            </p>
          )}

          {/* DUPLA (dono 11/08; em todos os modos desde 14/09). A linha diz a
              quantas cirurgias a dupla vai — no modo SALA são as que mudam de mão. */}
          {podeDupla && (
            <>
              <button
                type="button"
                onClick={() => setAbrirSegundo(!segundoAberto)}
                className="flex min-h-[48px] w-full items-center gap-2 border-t border-border py-2 text-left"
              >
                <span className="text-[14.5px] font-semibold">
                  {alvos.length === 1 ? 'Dois anestesistas nesta cirurgia' : `Dois anestesistas nestas ${alvos.length} cirurgias`}
                </span>
                <span className="ml-auto text-[11.5px] text-muted-foreground">
                  {segundo ? nomeSegundo : 'não'}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abrirSegundo ? 'rotate-180' : ''}`} />
              </button>
              {segundoAberto && (
                <div className="mb-2 rounded-xl border border-border bg-muted/30 p-3">
                  <Select
                    className="w-full"
                    searchable
                    options={opcoesSegundo}
                    value={segundoUid}
                    onChange={setUidSegundo}
                    placeholder="Só um anestesista"
                  />
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {alvos.length === 1
                      ? 'A cirurgia fica com os dois no cabeçalho da Completa e conta presença dos dois na fila.'
                      : 'As cirurgias ficam com os dois no cabeçalho da Completa e contam presença dos dois na fila.'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* O TEMPO TOTAL É DA PESSOA E FICA COM ELA (dono 10/11, modelo A): à parte das
              cirurgias, com o nome de quem sai e outro desenho — "não passa para quem assume".
              Só aparece quando há tempo total informado na fila. */}
          {totalDeQuemSai && (
            <TempoTotalPessoa
              className="mt-2"
              nome={nomeAtual}
              termino={totalDeQuemSai}
              sub={`fica com ${String(nomeAtual || '').trim().split(/\s+/)[0]}: não passa para quem assume`}
            />
          )}

          {/* COMO QUEM RECEBE ENTRA (dono 10–11/11, modelo B, opção A): só quando quem
              recebe não é da fila daqui. Nada marcado; a mini-fila aparece depois de escolher. */}
          {situacao && (
            <ComoEntra
              situacao={situacao} textos={textosEntrada} escolha={entrada} onEscolha={setComoEntra}
              lados={planoEntrada.lados} escalas={escalas} escala={escala} turno={situacao.turno}
              resolver={resolver} desabilitado={salvando}
            />
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-4 pb-4 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => onClose?.()}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={salvando || !alvos.length || semMudanca || (!!situacao && !entrada)}
              onClick={() => confirmar()}
            >
              {salvando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : situacao ? textosEntrada.botao(entrada)
                  : segundo ? 'Confirmar os dois anestesistas'
                    : escolhido === SEM_ANESTESISTA ? 'Deixar sem anestesista'
                      : 'Confirmar responsável'}
          </Button>
        </div>
      </SheetContent>

      {/* LISTA DE BAIXO PARA CIMA (dono 17/08): folha própria com busca no topo,
          largura inteira e altura FIXA — a lista rola por dentro e a folha não
          muda de tamanho conforme o filtro. */}
      {pickerAberto && (
        <Sheet open onOpenChange={(o) => { if (!o) { setPickerAberto(false); setBusca('') } }}>
          <SheetContent side="bottom" className="!h-[72vh]">
            <SheetHeader className="sticky top-0 z-10 bg-card pb-2">
              <SheetTitle className="text-[17px]">
                {casoUnico ? 'Quem assume esta cirurgia?' : `Quem assume a ${salaExibicao(sala)}?`}
              </SheetTitle>
              <div className="mt-2">
                <Input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar anestesista…"
                  aria-label="Buscar anestesista"
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
            </SheetHeader>
            <div role="listbox" aria-label="Anestesistas" className="px-4 pb-4">
              {lista.map((o) => {
                const marcado = escolhido === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    onClick={() => { setUidEscolhido(o.value); setComoEntra(null); setPickerAberto(false); setBusca('') }}
                    className={[
                      'flex min-h-[52px] w-full items-center gap-2 border-b border-border px-2 py-2 text-left',
                      marcado ? 'bg-primary/10' : 'active:bg-muted/60',
                    ].join(' ')}
                  >
                    {/* SÓ O NOME, em ordem alfabética (decisão de 17/08): posição na
                        fila e contagem de cirurgias faziam cada linha virar uma frase */}
                    <span className="min-w-0 flex-1 text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">
                      {o.label}
                    </span>
                    {marcado && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
              {!lista.length && (
                <p className="px-1 py-6 text-sm text-muted-foreground">Ninguém com esse nome no roster.</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Sheet>
  )
}
