/**
 * Trocas de feriado entre anestesistas — Firestore.
 *
 * Mesmo molde dos três módulos que já existem (residência, sobreaviso, plantão hospitalar):
 * documento de solicitação com `pendente → aceita | rejeitada | cancelada`, aceite da
 * contraparte, código curto para referência. Decisões do dono em 03/09: COM aceite e COM
 * notificação para a contraparte.
 *
 * Diferença deliberada para os outros três: NÃO há coleção de override espelhando a fila.
 * Lá a base é tabela estática e o override é a única forma de o dia mudar; aqui a fila do
 * feriado é derivada do dataset, então a troca aceita já É o fato e a tela a aplica na
 * leitura (`aplicarTrocasNaFila`). Sem dupla escrita, sem risco das duas fontes divergirem.
 *
 * Identidade: `uid` do Firebase (quem age) + `numero` da legenda (quem está na fila). O
 * número é o que a fila entende; o uid é o que a notificação e o gate entendem.
 */
import { collection, addDoc, doc, updateDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { createFirestoreSubscription } from './firestoreSubscriptionHelper'
import { validarPedido } from '../lib/trocasFeriado'
import dadosNumerica from '../data/escalaNumerica.json'

const COLLECTION = 'trocas_feriado'

function gerarCodigo() {
  return `FR${Math.floor(100000 + Math.random() * 900000)}`
}

async function acharPorCodigo(codigo) {
  const q = query(collection(db, COLLECTION), where('codigo', '==', codigo))
  const snap = await getDocs(q)
  if (snap.empty) return { trade: null, docId: null }
  const d = snap.docs[0]
  return { trade: { id: d.id, ...d.data() }, docId: d.id }
}

const nomeFeriado = (data) => dadosNumerica.feriados?.dias?.[data]?.nome || null

export async function createTradeRequest({
  solicitanteUid,
  solicitanteNome,
  solicitanteNumero,
  destinatarioUid = null,
  destinatarioNome,
  destinatarioNumero = null,
  escopo,
  feriadoData,
  feriadoDesejado = null,
  descricao,
}) {
  try {
    if (!solicitanteUid) return { trade: null, error: 'Solicitante não identificado' }
    if (!descricao?.trim()) return { trade: null, error: 'Escreva o motivo da troca' }

    // a mesma validação do formulário, de novo aqui: o formulário pode ser burlado
    const erro = validarPedido(dadosNumerica, {
      escopo,
      solicitante: { numero: solicitanteNumero, nome: solicitanteNome },
      destinatario: { numero: destinatarioNumero, nome: destinatarioNome },
      feriadoData,
      feriadoDesejado,
    })
    if (erro) return { trade: null, error: erro }

    const codigo = gerarCodigo()
    const dados = {
      codigo,
      solicitanteUid,
      solicitanteNome,
      solicitanteNumero: solicitanteNumero || null,
      destinatarioUid: destinatarioUid || null,
      destinatarioNome,
      destinatarioNumero: destinatarioNumero || null,
      escopo,
      feriadoData,
      feriadoNome: nomeFeriado(feriadoData),
      feriadoDesejado: escopo === 'data' ? feriadoDesejado : null,
      feriadoDesejadoNome: escopo === 'data' ? nomeFeriado(feriadoDesejado) : null,
      descricao: descricao.trim(),
      status: 'pendente',
      respondidoPorUid: null,
      respondidoPorNome: null,
      respostaEm: null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }
    const ref = await addDoc(collection(db, COLLECTION), dados)
    return { trade: { id: ref.id, ...dados }, error: null }
  } catch (error) {
    console.error('[trocaFeriado] erro ao criar:', error.message)
    return { trade: null, error: error.message }
  }
}

export async function acceptTrade(codigo, { uid, nome, numero }) {
  try {
    const { trade, docId } = await acharPorCodigo(codigo)
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null }
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade }
    if (trade.solicitanteUid === uid) return { success: false, error: 'Você não pode aceitar sua própria troca', trade }
    // a troca é sempre direcionada: quem responde tem de ser o colega escolhido
    const souODestinatario = (trade.destinatarioUid && trade.destinatarioUid === uid)
      || (trade.destinatarioNumero && numero && trade.destinatarioNumero === numero)
    if (!souODestinatario) return { success: false, error: 'Esta troca foi direcionada a outro colega', trade }

    await updateDoc(doc(db, COLLECTION, docId), {
      status: 'aceita',
      respondidoPorUid: uid,
      respondidoPorNome: nome,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    })
    return { success: true, error: null, trade: { ...trade, status: 'aceita' } }
  } catch (error) {
    console.error('[trocaFeriado] erro ao aceitar:', error.message)
    return { success: false, error: error.message, trade: null }
  }
}

export async function rejectTrade(codigo, { uid, nome, numero }) {
  try {
    const { trade, docId } = await acharPorCodigo(codigo)
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null }
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade }
    if (trade.solicitanteUid === uid) return { success: false, error: 'Você não pode recusar sua própria troca', trade }
    const souODestinatario = (trade.destinatarioUid && trade.destinatarioUid === uid)
      || (trade.destinatarioNumero && numero && trade.destinatarioNumero === numero)
    if (!souODestinatario) return { success: false, error: 'Esta troca foi direcionada a outro colega', trade }

    await updateDoc(doc(db, COLLECTION, docId), {
      status: 'rejeitada',
      respondidoPorUid: uid,
      respondidoPorNome: nome,
      respostaEm: Timestamp.now(),
      atualizadoEm: serverTimestamp(),
    })
    return { success: true, error: null, trade: { ...trade, status: 'rejeitada' } }
  } catch (error) {
    console.error('[trocaFeriado] erro ao recusar:', error.message)
    return { success: false, error: error.message, trade: null }
  }
}

export async function cancelTrade(codigo, uid) {
  try {
    const { trade, docId } = await acharPorCodigo(codigo)
    if (!trade) return { success: false, error: 'Troca não encontrada', trade: null }
    if (trade.status !== 'pendente') return { success: false, error: 'Esta troca não está mais pendente', trade }
    if (trade.solicitanteUid !== uid) return { success: false, error: 'Somente quem pediu pode cancelar a troca', trade }

    await updateDoc(doc(db, COLLECTION, docId), { status: 'cancelada', atualizadoEm: serverTimestamp() })
    return { success: true, error: null, trade: { ...trade, status: 'cancelada' } }
  } catch (error) {
    console.error('[trocaFeriado] erro ao cancelar:', error.message)
    return { success: false, error: error.message, trade: null }
  }
}

/**
 * Todas as trocas, mais os recortes que a tela usa. As ACEITAS vão inteiras porque a fila
 * de qualquer feriado depende delas — não é uma lista "minha", é o estado do quadro.
 */
export function subscribeTrocas(uid, getNumero, callback) {
  const q = query(collection(db, COLLECTION), orderBy('criadoEm', 'desc'))
  const { cleanup } = createFirestoreSubscription(q, {
    onData: (snapshot) => {
      const todas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const numero = typeof getNumero === 'function' ? getNumero() : getNumero
      const souEu = (t, campoUid, campoNumero) =>
        (t[campoUid] && t[campoUid] === uid) || (numero && t[campoNumero] && t[campoNumero] === numero)
      callback({
        todas,
        aceitas: todas.filter((t) => t.status === 'aceita'),
        minhas: todas.filter((t) => souEu(t, 'solicitanteUid', 'solicitanteNumero') || souEu(t, 'destinatarioUid', 'destinatarioNumero')),
        pendentesParaMim: todas.filter((t) => t.status === 'pendente'
          && t.solicitanteUid !== uid && souEu(t, 'destinatarioUid', 'destinatarioNumero')),
        erro: null,
      })
    },
    onError: (error) => {
      console.error('[trocaFeriado] listener:', error.message)
      callback({ todas: [], aceitas: [], minhas: [], pendentesParaMim: [], erro: error.message })
    },
  })
  return cleanup
}
