/**
 * escalaAdesaoService — leitura do relatório de adesão à Escala Cirúrgica.
 *
 * Uma chamada = `public.escala_adesao_relatorio(p_dias)` (migration 20260923120000, ~200 ms no
 * plano free com 60 dias). Só leitura: nada aqui grava.
 *
 * Cache local por janela (stale-while-revalidate): a Home mostra o card com o último valor e só
 * busca de novo quando ele passou de `IDADE_CARD_MS` — com ~45 clientes abrindo a Home, chamar
 * a função a cada abertura repetiria o erro do plano free de 16/09 (refetch por evento × clientes).
 * A página do relatório sempre busca ao abrir ("ao vivo") e mostra o cache enquanto isso.
 */
import { supabase } from '@/config/supabase'
import { janelasComparacao, ultimasSemanasCompletas } from '@/lib/escalaAdesaoSemanal'

export const IDADE_CARD_MS = 30 * 60 * 1000
/**
 * Card do infográfico "Evolução da adesão": as semanas completas só mudam uma vez por dia (cron da
 * madrugada), e cada busca são 10 chamadas (evolução + 9 semanas) — 6 h de cache bastam.
 */
export const IDADE_INFOGRAFICO_MS = 6 * 60 * 60 * 1000

const chave = (id) => `anest-escala-adesao-v2:${id}`

/** `id`: 30 | 60 (janelas ao vivo) | 'mes:2026-09' | 'evolucao' | 'semanas'. */
export function lerCacheAdesao(id) {
  try {
    const raw = localStorage.getItem(chave(id))
    if (!raw) return null
    const v = JSON.parse(raw)
    return v && v.dados && typeof v.em === 'number' ? v : null
  } catch {
    return null // localStorage indisponível/corrompido — segue sem cache
  }
}

function salvarCache(id, dados) {
  try {
    localStorage.setItem(chave(id), JSON.stringify({ em: Date.now(), dados }))
  } catch {
    /* sem espaço/privado: o relatório funciona sem cache */
  }
}

export async function buscarAdesao(dias) {
  const { data, error } = await supabase.rpc('escala_adesao_relatorio', { p_dias: dias })
  if (error) throw new Error(error.message || 'Não foi possível carregar o relatório de adesão')
  salvarCache(dias, data)
  return data
}

/**
 * Um período fechado (aba de mês) — soma dos agregados DIÁRIOS gravados pelo cron
 * `escala-adesao-diario` (migration 20260923160000). Mesmo JSON de `buscarAdesao`.
 */
export async function buscarAdesaoPeriodo(id, desde, ate) {
  const { data, error } = await supabase.rpc('escala_adesao_periodo', { p_desde: desde, p_ate: ate })
  if (error) throw new Error(error.message || 'Não foi possível carregar o mês')
  salvarCache(id, data)
  return data
}

/** Evolução semanal + lista de meses com dados (as abas). */
export async function buscarAdesaoEvolucao() {
  const { data, error } = await supabase.rpc('escala_adesao_evolucao')
  if (error) throw new Error(error.message || 'Não foi possível carregar a evolução')
  salvarCache('evolucao', data)
  return data
}

/**
 * "Evolução da adesão" (dono 27/10): as `n` últimas semanas completas (segunda → domingo, a
 * última terminando no último domingo já gravado). Uma chamada de `escala_adesao_periodo` por
 * semana, em paralelo (cada uma soma só os agregados diários de 7 dias).
 *  - `previas`: semanas ANTERIORES às `n`, só de contexto (o infográfico escolhido pelo dono, o
 *    exemplo 3, mostra as 4 de antes em cinza e a inclinação antes × depois).
 *  - `janelas`: + as janelas da comparação antes × depois (4 semanas antes da 1ª do gráfico × as
 *    4 últimas), 2 chamadas a mais.
 * `semanas`/`previas` saem da mais antiga para a mais recente; sem dia gravado, `semanas` = [] e
 * as janelas null. Leitura com `montarEvolucao` (lib/escalaAdesaoSemanal).
 */
export async function buscarAdesaoSemanas(n = 5, { previas = 0, janelas = true, id = 'semanas' } = {}) {
  const evolucao = await buscarAdesaoEvolucao()
  const gravadoAte = evolucao?.gravado_ate ?? null
  const todas = ultimasSemanasCompletas(n + previas, gravadoAte)
  const limites = todas.slice(-n)
  const jan = janelas ? janelasComparacao(limites) : null
  if (!limites.length || (janelas && !jan)) {
    const vazio = { semanas: [], previas: [], antes: null, depois: null, gravadoAte }
    salvarCache(id, vazio)
    return vazio
  }
  const periodo = async ({ de, ate }) => {
    const { data, error } = await supabase.rpc('escala_adesao_periodo', { p_desde: de, p_ate: ate })
    if (error) throw new Error(error.message || 'Não foi possível carregar a evolução semanal')
    return data
  }
  const pedidos = jan ? [jan.antes, jan.depois, ...todas] : todas
  const r = await Promise.all(pedidos.map(periodo))
  const [antes, depois] = jan ? r.splice(0, 2) : [null, null]
  const dados = { semanas: r.slice(-n), previas: r.slice(0, r.length - n), antes, depois, gravadoAte }
  salvarCache(id, dados)
  return dados
}

/**
 * Horário NÃO preenchido no dia (dono 05/10) — as cirurgias dos dias já encerrados que
 * ficaram sem início ou sem término (`escala_horario_pendente_relatorio`, migration
 * 20261005150000). `desde`/`ate` null = os últimos 30 dias encerrados. Acesso = quem opera
 * a escala: para os demais a função recusa (42501) e a seção simplesmente não aparece.
 */
export async function buscarHorarioNaoPreenchido(id, desde = null, ate = null) {
  const { data, error } = await supabase.rpc('escala_horario_pendente_relatorio', { p_desde: desde, p_ate: ate })
  if (error) throw new Error(error.message || 'Não foi possível carregar o horário não preenchido')
  salvarCache(id, data)
  return data
}

/**
 * "Seu preenchimento" da aba Minhas (dono 14/10, modelo A): as cirurgias de QUEM ESTÁ LOGADO
 * nos 6 dias encerrados, com quantas não devem horário nenhum, + a média dos 5 melhores
 * (`escala_meu_preenchimento`, a mesma conta do aviso desde a migration 20261028130000). Hoje
 * a tela soma (dono 28/10), e os dois juntos são os "últimos 7 dias". O cache leva o uid na
 * chave — o mesmo aparelho pode trocar de conta (o dono tem duas).
 */
export async function buscarMeuPreenchimento(id) {
  const { data, error } = await supabase.rpc('escala_meu_preenchimento', { p_dias: 6 })
  if (error) throw new Error(error.message || 'Não foi possível carregar o seu preenchimento')
  salvarCache(id, data)
  return data
}
