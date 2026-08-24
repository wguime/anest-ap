/**
 * pushDispatchService — dispara push (tela bloqueada) para OUTRAS pessoas.
 *
 * Par do `pushNotificationService.js`, que cuida do token DESTE aparelho. Aqui é
 * o outro lado: pedir à edge `send-fcm-push` que entregue um aviso a um ou a
 * vários usuários.
 *
 * Nasceu em 2026-08-24 com o recado do plantonista (dono: "quero que os usuários
 * recebam um pop-up da mensagem mesmo com o celular bloqueado"). O padrão de
 * fire-and-forget já existia dentro do `supabaseMessagesService`, privado; foi
 * extraído para cá porque agora há um segundo chamador e duas cópias do mesmo
 * disparo divergiriam na primeira correção.
 *
 * ⚠️ BEST-EFFORT POR DESENHO. Push é canal ADICIONAL:
 *   • quem não optou por notificação simplesmente não recebe (metade do grupo,
 *     medido em 24/08: 35 dos 71 perfis têm `fcmToken`) — e isso NÃO é erro;
 *   • no iPhone só existe token se o app estiver instalado na tela de início
 *     (em aba do Safari a API nem existe), então "não chegou" quase sempre
 *     significa "não instalou", não "falhou";
 *   • falha de rede é engolida: a fonte da verdade é sempre a tela, nunca o push.
 * Nada aqui pode bloquear ou desfazer a ação que o originou.
 *
 * ⚠️ LGPD: o `body` aparece na tela BLOQUEADA de quem recebe, visível a quem
 * estiver com o aparelho na mão. Não mandar dado de paciente — nem iniciais.
 */
import { getSupabaseToken } from '@/config/supabase'

const URL_EDGE = import.meta.env?.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-fcm-push`
  : null

/** Teto do body na notificação — o SO trunca de qualquer jeito e um texto longo
 *  na tela bloqueada é ilegível. */
const MAX_BODY = 160

/**
 * Envia um push para uma ou várias pessoas.
 *
 * @param {object}   p
 * @param {string[]} p.userIds   Firebase UIDs. Vazio = não faz nada.
 * @param {string}   p.title
 * @param {string}   [p.body]
 * @param {string}   [p.url]      deep-link aberto ao tocar (o SW usa data.url)
 * @param {string}   [p.tag]      agrupa pushes do mesmo tipo (evita empilhar)
 * @param {'normal'|'high'} [p.priority]
 * @returns {Promise<{enviados:number, semToken:number, falhas:number}|null>}
 *   null quando nem chegou a sair (sem URL da edge, sem destinatário, sem JWT).
 */
export async function enviarPush({ userIds, title, body, url, tag, priority = 'normal' }) {
  const alvos = [...new Set((userIds || []).filter(Boolean))]
  if (!URL_EDGE || !alvos.length || !title) return null
  try {
    // O cliente usa `accessToken` option, então `supabase.auth.getSession()`
    // lança — `getSupabaseToken()` é o helper canônico. A corrida com 3s evita
    // await pendurado quando o IndexedDB não está disponível (private mode).
    const jwt = await Promise.race([
      getSupabaseToken(),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ])
    if (!jwt) return null
    const res = await fetch(URL_EDGE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: alvos,
        title,
        body: String(body || '').slice(0, MAX_BODY),
        data: { ...(url ? { url } : {}), ...(tag ? { tag } : {}) },
        priority,
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null // best-effort: a tela já é a fonte da verdade
  }
}

/**
 * Mesma coisa, sem `await` — para chamar de dentro de um fluxo que não pode
 * esperar a rede (enviar um recado, marcar um tempo). O nome existe para o call
 * site declarar a intenção: quem usa isto NÃO quer saber o resultado.
 */
export function enviarPushBestEffort(p) {
  void enviarPush(p)
}

export default { enviarPush, enviarPushBestEffort }
