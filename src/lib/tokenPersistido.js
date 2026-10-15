/**
 * Token do Firebase já guardado no aparelho — para as leituras do Supabase não
 * esperarem a ida à rede que o SDK faz antes de anunciar o usuário (abertura
 * instantânea, 15/10/2026).
 *
 * Ao abrir, o Firebase Auth só anuncia o usuário depois de confirmar a conta no
 * servidor (accounts:lookup, ~0,7 s medidos). Até lá `getSupabaseToken` ficava
 * parado e NENHUMA leitura saía — a escala aberta direto pelo push mostrava
 * "Carregando…" por ~2 s. O token que o SDK guardou no último uso é o mesmo que
 * o `getIdToken()` devolveria (ele só renova quando vence), então, ainda válido,
 * ele serve para o Supabase já.
 *
 * Só vale com TODAS as condições — qualquer dúvida devolve null e o chamador
 * espera o Firebase como sempre:
 *  - é do mesmo usuário da sessão salva (a tela já mostra o perfil dele);
 *  - traz o claim `role: 'authenticated'` (caminho Third-Party Auth; o legado
 *    HS256 continua pela edge);
 *  - ainda vale por pelo menos 2 min (relógio do aparelho, como o próprio SDK).
 * Conta desativada nesse meio-tempo: o Supabase aceitaria o token até vencer
 * (≤1 h), exatamente como num app que ficou aberto; a RLS segue valendo pelo
 * uid, e quando o Firebase desmente a sessão o app vai para o login.
 *
 * O formato `firebase:authUser:<apiKey>:<app>` é interno do SDK: se mudar numa
 * atualização, a leitura devolve null e tudo volta a esperar — nunca quebra.
 */

export const MARGEM_MINIMA_MS = 2 * 60 * 1000

export const chavePersistenciaFirebase = (apiKey, appName = '[DEFAULT]') =>
  `firebase:authUser:${apiKey}:${appName}`

function payloadDoJwt(token) {
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  )
  return JSON.parse(json)
}

/**
 * @returns {string|null} o ID token guardado, se ainda serve; senão null
 */
export function tokenPersistidoValido({ storage, apiKey, appName = '[DEFAULT]', uidEsperado, agora = Date.now() } = {}) {
  try {
    if (!storage || !apiKey || !uidEsperado) return null
    const bruto = storage.getItem(chavePersistenciaFirebase(apiKey, appName))
    if (!bruto) return null
    const salvo = JSON.parse(bruto)
    const token = salvo?.stsTokenManager?.accessToken
    if (typeof token !== 'string' || !token) return null
    if (salvo.uid !== uidEsperado) return null
    const p = payloadDoJwt(token)
    if (!p || (p.user_id || p.sub) !== uidEsperado) return null
    if (p.role !== 'authenticated') return null
    if (typeof p.exp !== 'number' || p.exp * 1000 - agora < MARGEM_MINIMA_MS) return null
    return token
  } catch {
    return null
  }
}

/**
 * O Firebase guardou ESTE login no aparelho (persistência local)? É a escolha
 * "Manter conectado" do login: desmarcada, o SDK guarda a sessão só na aba
 * (sessionStorage) e ela acaba ao fechar. A sessão salva do app (perfil para a
 * abertura instantânea) só pode existir quando a do Firebase também persiste —
 * senão, num tablet compartilhado, o próximo a abrir veria a Home de quem saiu
 * sem marcar "manter". Formato desconhecido = false (não grava; só fica lento).
 */
export function usuarioFirebaseNoAparelho({ storage, apiKey, appName = '[DEFAULT]', uid } = {}) {
  try {
    if (!storage || !apiKey || !uid) return false
    const bruto = storage.getItem(chavePersistenciaFirebase(apiKey, appName))
    if (!bruto) return false
    return JSON.parse(bruto)?.uid === uid
  } catch {
    return false
  }
}
