/**
 * Fachada LAZY do índice de busca (searchUtils).
 *
 * `searchUtils` importa as 73 definições de calculadora (~284KB de fonte) para
 * indexá-las — importado eager pela Home e pelo useSearch, esse peso todo ia
 * para o chunk INICIAL do app e atrasava o primeiro paint. A busca só precisa
 * do índice quando o usuário efetivamente busca; aqui o módulo vira um chunk
 * sob demanda, pré-carregado em idle (pronto antes da primeira tecla).
 */
import { useEffect, useState } from 'react'

let _mod = null
let _promise = null

/** Dispara o carregamento do índice (idempotente). */
export function preloadSearchIndex() {
  if (!_promise) {
    _promise = import('./searchUtils').then((m) => {
      _mod = m
      return m
    })
  }
  return _promise
}

const buscaVazia = () => ({ pages: [], documents: [] })

/**
 * Devolve a função `searchAll` reativa: enquanto o chunk não chega, retorna
 * busca vazia; quando chega, a identidade muda e os memos dependentes
 * recomputam. Pré-carrega em idle no mount.
 */
export function useSearchAll() {
  const [mod, setMod] = useState(_mod)

  useEffect(() => {
    if (mod) return
    let vivo = true
    const carregar = () => {
      preloadSearchIndex().then((m) => { if (vivo) setMod(m) })
    }
    // idle: fora do caminho crítico do primeiro paint
    let cancelar
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(carregar, { timeout: 2000 })
      cancelar = () => cancelIdleCallback(id)
    } else {
      const id = setTimeout(carregar, 1500)
      cancelar = () => clearTimeout(id)
    }
    return () => {
      vivo = false
      cancelar()
    }
  }, [mod])

  return mod?.searchAll ?? buscaVazia
}
