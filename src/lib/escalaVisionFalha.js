/**
 * Por que a leitura da escala por imagem falhou — e o que a tela deve dizer.
 *
 * A edge devolve o motivo em 200 em vez de estourar (mesma decisão já tomada
 * para `extracao_truncada`): o corpo de uma resposta não-2xx não chega ao app
 * por `functions.invoke`, então um 502 aparece como erro sem texto e a tela cai
 * no genérico "tente de novo em alguns instantes".
 *
 * Isso custou caro em 17–18/08: a chave da IA ficou sem crédito no meio da
 * tarde e a tela seguiu pedindo para tentar de novo — duas pessoas reenviaram a
 * foto oito vezes e o vespertino do dia 18 ficou sem escala publicada. Falha de
 * conta/chave não se resolve reenviando: quem está no centro cirúrgico precisa
 * ouvir isso na PRIMEIRA tentativa, junto com a saída que funciona.
 */

export const FALHA_VISION = {
  SEM_CREDITO: 'ia_sem_credito',
  CHAVE_RECUSADA: 'ia_chave_recusada',
  SOBRECARGA: 'ia_sobrecarregada',
  DESCONHECIDA: 'ia_desconhecida',
}

/** Código devolvido pela edge quando a chamada à Anthropic não foi 2xx. */
export const ERRO_IA = 'ia_falhou'

/**
 * Classifica o que a Anthropic respondeu. O eixo que importa não é o status
 * HTTP e sim se REENVIAR resolve: crédito e chave são do administrador
 * (definitivo para quem está na tela), sobrecarga passa sozinha.
 */
export function classificarFalhaVision({ status, tipo, mensagem } = {}) {
  const txt = `${tipo || ''} ${mensagem || ''}`.toLowerCase()
  const st = Number(status) || 0
  if (/credit balance|insufficient (credit|fund)|billing/.test(txt)) return FALHA_VISION.SEM_CREDITO
  if (st === 401 || st === 403 || /authentication_error|permission_error|invalid x-api-key|invalid api key/.test(txt)) {
    return FALHA_VISION.CHAVE_RECUSADA
  }
  if (st === 429 || st >= 500 || /overloaded|rate.?limit/.test(txt)) return FALHA_VISION.SOBRECARGA
  return FALHA_VISION.DESCONHECIDA
}

/**
 * Texto do toast. `alternativa` é a saída que a tela em questão oferece — a
 * importação normal tem planilha e digitação; a do fim de semana, só reimportar.
 */
export function mensagemFalhaVision(codigo, alternativa = 'preencha à mão') {
  switch (codigo) {
    case FALHA_VISION.SEM_CREDITO:
      return {
        title: 'Leitura automática indisponível',
        description: `A conta da IA que lê a foto está sem créditos — reenviar a imagem não resolve. Avise o administrador para recarregar e, por ora, ${alternativa}.`,
      }
    case FALHA_VISION.CHAVE_RECUSADA:
      return {
        title: 'Leitura automática indisponível',
        description: `A chave da IA foi recusada pelo servidor — reenviar a imagem não resolve. Avise o administrador e, por ora, ${alternativa}.`,
      }
    case FALHA_VISION.SOBRECARGA:
      return {
        title: 'A IA não respondeu agora',
        description: `O serviço de leitura está sobrecarregado neste momento. Tente de novo em um minuto; se repetir, ${alternativa}.`,
      }
    default:
      // Sem diagnóstico: NÃO culpar a nitidez da foto (incidente 06/08) — a
      // imagem chegou ao servidor, mandar um print melhor não muda nada.
      return {
        title: 'Falha na extração',
        description: `A leitura falhou no servidor. Tente de novo em alguns instantes; se repetir, ${alternativa}.`,
      }
  }
}
