/* eslint-disable react-refresh/only-export-components */
/**
 * DeferredReadyContext — sinal de "pode buscar" para os providers Tier 2.
 *
 * Antes (causa do "a Home recarrega sozinha"): DeferredProviders devolvia
 * `children` cru por 2s e depois envolvia nos 8 providers — a raiz do subtree
 * mudava de tipo e o React DESMONTAVA e REMONTAVA o App inteiro aos 2s: a Home
 * voltava toda a skeleton e cada fetch do boot rodava DUAS vezes.
 *
 * Agora a árvore de providers é estável desde o 1º render e o que se adia são
 * os FETCHES iniciais: cada provider Tier 2 espera este sinal antes do
 * loadData + subscription realtime (mesmo efeito de rede da montagem adiada,
 * sem o remount).
 *
 * Default true: provider montado fora do gate (testes, providers on-demand
 * como CirurgiasParticulares) se comporta como sempre — busca no mount.
 */
import { createContext, useContext } from 'react'

const DeferredReadyContext = createContext(true)

export function DeferredReadyProvider({ ready, children }) {
  return (
    <DeferredReadyContext.Provider value={ready}>
      {children}
    </DeferredReadyContext.Provider>
  )
}

export function useDeferredReady() {
  return useContext(DeferredReadyContext)
}
