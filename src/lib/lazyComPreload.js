import { lazy } from 'react'

/**
 * `React.lazy` com pré-carga e SEM suspender quando o módulo já chegou.
 *
 * Por que existe (abertura da Escala Cirúrgica, 15/10/2026): o `lazy` comum
 * sempre suspende no primeiro render — a promessa do `import()` só resolve num
 * microtask, mesmo com o chunk já baixado — e o React 19 segura o conteúdo por
 * ~300 ms depois de mostrar o fallback. Resultado medido: tocar no card da
 * escala mostrava uma tela vazia com spinner por ~0,3–0,5 s antes da página,
 * mesmo com o chunk no cache do service worker.
 *
 * Com o módulo pré-carregado, a fábrica do `lazy` devolve um thenable que
 * resolve NA HORA: o React marca o payload como resolvido dentro do próprio
 * `then` e renderiza a página sem passar pelo fallback. Sem pré-carga, o
 * comportamento é o do `lazy` de sempre.
 *
 * @param {() => Promise<{ default: any }>} carregar mesma fábrica do `lazy`
 * @returns componente lazy com `.preload()` (idempotente; nova tentativa após falha)
 */
export function lazyComPreload(carregar) {
  let modulo = null
  let promessa = null

  const preload = () => {
    if (modulo) return Promise.resolve(modulo)
    if (!promessa) {
      promessa = carregar().then(
        (m) => {
          modulo = m
          return m
        },
        (erro) => {
          // falha de rede: a próxima pré-carga (ou o render) tenta de novo
          promessa = null
          throw erro
        },
      )
    }
    return promessa
  }

  const Componente = lazy(() => (modulo ? { then: (resolver) => resolver(modulo) } : preload()))
  Componente.preload = preload
  return Componente
}
