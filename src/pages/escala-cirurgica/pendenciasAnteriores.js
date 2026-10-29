/**
 * PENDÊNCIAS DE DIAS ANTERIORES — buscadas na ABERTURA DO APP e guardadas no aparelho
 * (dono 28/10/2026: "a abertura deve ser otimizada para não haver delays"; proposta aceita:
 * "buscar a lista de dias anteriores já na abertura do app e guardá-la no aparelho").
 *
 * Medido em 28/10 (produção, CPU 4× mais lenta): entrando pela Home a escala aparecia em
 * 0,05–0,2 s com as cirurgias de hoje já carregadas, mas a busca das anteriores só saía quando
 * a página montava e terminava 0,34–0,74 s depois da entrada. Era ela que seguraria o pop-up.
 * Agora o provider da escala pede a lista quando o app abre (`buscarAnteriores`), e a página
 * lê o que já chegou.
 *
 * Três camadas, nesta ordem: a memória (a resposta desta sessão), o aparelho (a última
 * resposta desta pessoa, para o app recém-aberto) e a rede. O aparelho guarda só o que a
 * regra e a lista usam — nada de paciente (iniciais, idade, nome): `CAMPOS_DO_CASO`.
 * "Em aberto" continua sendo `pendenciasDeDiasAnteriores` sobre estas escalas (fonte única
 * com a caixa e o pop-up), calculado em `useMinhasPendenciasAnteriores`.
 */
import svc from '@/services/supabaseEscalaCirurgicaService'
import { CORTE_PENDENCIAS_MINHAS } from '@/lib/escalaHorarioPendente'

const PREFIXO = 'anest-escala-anteriores-v1:'
/** O que `pendenciasDeDiasAnteriores`, a lista e a folha do horário leem — e mais nada. */
const CAMPOS_DO_CASO = [
  'id', 'escalaId', 'sala', 'ordem', 'hora', 'turno', 'procedimento', 'cirurgiao', 'anestesista',
  'anestesistaUserId', 'statusCirurgia', 'statusExtra', 'statusAtualizadoEm', 'inicioReal', 'terminoReal',
  'isContinuacao', 'semAnestesista',
]
const CAMPOS_DA_ESCALA = ['id', 'data', 'hospital', 'status']

const memoria = new Map() // uid → { hoje, escalas, fresca }
const emVoo = new Map() // `${uid}|${hoje}` → Promise
const falhou = new Set() // `${uid}|${hoje}` cuja última tentativa não voltou
const ouvintes = new Set()
const versoes = new Map() // uid → quantas vezes a lista dele mudou (o retrato só muda com ela)
const retratos = new Map() // `${uid}|${hoje}` → { versao, valor }

const so = (obj, campos) => Object.fromEntries(campos.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]))

/** As escalas de `fetchCasosDaPessoa` sem nada que identifique paciente. */
export function semDadoDePaciente(escalas) {
  return (escalas || []).filter(Boolean).map((e) => ({
    ...so(e, CAMPOS_DA_ESCALA),
    casos: (e.casos || []).map((c) => so(c, CAMPOS_DO_CASO)),
  }))
}

function lerDoAparelho(uid) {
  try {
    const bruto = globalThis.localStorage?.getItem(PREFIXO + uid)
    if (!bruto) return null
    const v = JSON.parse(bruto)
    if (!v || typeof v.hoje !== 'string' || !Array.isArray(v.escalas)) return null
    return { hoje: v.hoje, escalas: v.escalas }
  } catch {
    return null
  }
}

function guardarNoAparelho(uid, { hoje, escalas }) {
  try {
    globalThis.localStorage?.setItem(PREFIXO + uid, JSON.stringify({ hoje, escalas }))
  } catch { /* aparelho sem espaço ou sem armazenamento: a memória e a rede seguem valendo */ }
}

const avisar = (uid) => {
  versoes.set(uid, (versoes.get(uid) || 0) + 1)
  ouvintes.forEach((fn) => { try { fn(uid) } catch { /* ouvinte não derruba os outros */ } })
}

/** O que já se sabe desta pessoa, sem esperar a rede: memória, senão o aparelho. */
export function lerAnteriores(uid) {
  if (!uid) return null
  if (memoria.has(uid)) return memoria.get(uid)
  const doAparelho = lerDoAparelho(uid)
  if (!doAparelho) return null
  const v = { ...doAparelho, fresca: false }
  memoria.set(uid, v)
  return v
}

/**
 * A lista já está decidida para este dia? Resposta desta sessão para `hoje`, ou a tentativa
 * acabou sem rede (aí vale o que estava guardado). É o que o pop-up espera para abrir.
 */
export function anterioresProntas(uid, hoje) {
  if (!uid || !hoje) return true
  if (!(hoje > CORTE_PENDENCIAS_MINHAS)) return true // antes do corte não há o que buscar
  const v = memoria.get(uid)
  return (!!v?.fresca && v.hoje === hoje) || falhou.has(`${uid}|${hoje}`)
}

/**
 * Busca (ou revalida) as escalas da pessoa desde o corte até ONTEM. Chamadas simultâneas
 * para a mesma pessoa e dia viram uma só. Sem rede, fica o que se sabia.
 */
export function buscarAnteriores({ uid, hoje }) {
  if (!uid || !hoje || !(hoje > CORTE_PENDENCIAS_MINHAS)) return Promise.resolve(null)
  const chave = `${uid}|${hoje}`
  if (emVoo.has(chave)) return emVoo.get(chave)
  const p = Promise.resolve()
    .then(() => svc.fetchCasosDaPessoa({ uid, desde: CORTE_PENDENCIAS_MINHAS, ate: hoje }))
    .then((lidas) => {
      const escalas = semDadoDePaciente(lidas)
      const v = { hoje, escalas, fresca: true }
      memoria.set(uid, v)
      falhou.delete(chave)
      guardarNoAparelho(uid, v)
      avisar(uid)
      return v
    })
    .catch(() => {
      falhou.add(chave)
      avisar(uid)
      return lerAnteriores(uid)
    })
    .finally(() => { emVoo.delete(chave) })
  emVoo.set(chave, p)
  return p
}

/**
 * O que a pessoa acabou de informar entra também no que está guardado: sem isto, o app
 * reaberto antes da próxima resposta mostraria de novo a cirurgia já preenchida.
 */
export function aplicarNoGuardado(uid, casoId, patch) {
  const v = memoria.get(uid)
  if (!v || !casoId) return
  const escalas = v.escalas.map((e) => ({
    ...e,
    casos: (e.casos || []).map((c) => (c.id === casoId ? { ...c, ...patch } : c)),
  }))
  const novo = { ...v, escalas }
  memoria.set(uid, novo)
  guardarNoAparelho(uid, novo)
  avisar(uid)
}

/**
 * O retrato desta pessoa neste dia — `{ guardado, pronto }` —, o MESMO objeto enquanto nada
 * mudar: é o `getSnapshot` do `useSyncExternalStore` em `useMinhasPendenciasAnteriores`.
 */
export function retratoAnteriores(uid, hoje) {
  const versao = versoes.get(uid) || 0
  const chave = `${uid}|${hoje}`
  const r = retratos.get(chave)
  if (r && r.versao === versao) return r.valor
  const valor = { guardado: lerAnteriores(uid), pronto: anterioresProntas(uid, hoje) }
  retratos.set(chave, { versao, valor })
  return valor
}

/** Avisa quando a lista de alguém muda (resposta da rede ou gravação). Devolve o "desligar". */
export function assinarAnteriores(fn) {
  ouvintes.add(fn)
  return () => { ouvintes.delete(fn) }
}

/** Só para os testes: começa do zero (o aparelho do teste é o localStorage do jsdom). */
export function _zerarAnteriores() {
  memoria.clear()
  emVoo.clear()
  falhou.clear()
  ouvintes.clear()
  versoes.clear()
  retratos.clear()
}
