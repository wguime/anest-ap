// =============================================================================
// supabase/functions/api-v1/_ferias.ts — GET /v1/ferias/extrato?ano=YYYY[&nome=]
//
// Extrato de Férias por sócio, com o MESMO número da tela (ExtratoFeriasPage):
//   registros de férias do Pega Plantão (12 meses do ano)
//   → normalizarRegistrosFerias
//   → aplicarMovimentacoes (replay de ferias_movimentacoes, append-only)
//   → construirExtrato (FDS nunca conta; feriado só não conta em semana inteira; cota por ano de entrada)
//   → penalidade da 7ª vaga (ultimoAMarcar + penalidadesSetimaVaga + aplicarPenalidades)
// As libs são CÓPIAS GERADAS de src/lib (_lib-ferias/, scripts/gerar-libs-ferias-api-v1.mjs);
// a paridade é travada em src/__tests__/functions/apiV1FeriasExtrato.test.js.
//
// Diferença consciente: a tela também GRAVA o first-seen dos códigos do PP
// (ferias_marcacoes_vistas) antes de ler; a API é read-only e só lê. Como todo
// registro do PP traz DataCriacao (que tem precedência sobre o first-seen), o
// resultado só pode divergir em registro do PP sem DataCriacao que nenhuma tela
// aberta tenha visto ainda.
//
// LGPD — whitelist campo a campo. FORA da resposta: licenças (o extrato só lê
// o setor "Férias"; da licença o cache guarda SÓ nome+data, para a rota
// /v1/ferias/ausencias em _ausencias.ts, com o motivo = setor do PP — dado sensível), campos
// crus do Pega Plantão, e-mail/CPF/CRM, user_id de quem registrou
// movimentação, avisos_aceitos, nomes do PP fora da lista de sócios.
//
// `id` do sócio (nov/2026, pedido do integrador): o MESMO uid de /v1/anestesistas
// (profiles.id, conta secundária resolvida para a principal). Ver
// resolverIdsSocios — identidade ambígua é NULA, nunca adivinhada.
// =============================================================================

import { type RotaCtx, type RotaResultado, ok, parametroInvalido, erroInterno } from './_contrato.ts'
import { getPlantoes, PegaPlantaoErro } from './_pegaplantao.ts'
import { normalizarRegistrosFerias, construirExtrato } from './_lib-ferias/extratoFerias.js'
import { aplicarMovimentacoes, vistasDasMovimentacoes } from './_lib-ferias/feriasMovimentacoes.js'
import { ultimoAMarcar, penalidadesSetimaVaga, aplicarPenalidades, excessoDoAno, aplicarExcessoAnterior } from './_lib-ferias/feriasAnalise.js'
import { MAX_VAGAS_DIA } from './_lib-ferias/extratoFeriasRegras.js'
import { getSocios } from './_lib-ferias/feriasSocios.js'
import { getFeriados } from './_lib-ferias/feriasFeriados.js'

// ─── Tipos mínimos ──────────────────────────────────────────────────────────

/** Projeção mínima de um plantão do PP — só o que a normalização lê. */
export interface PlantaoFeriasMin {
  CodigoPlantao: string | null
  Setor: string
  ProfDePlantao: string | null
  ProfFixo: string | null
  Inicio: string
  DataCriacao: string | null
}

export interface MovimentacaoMin {
  id: string
  nome: string
  data: string
  acao: 'marcar' | 'desmarcar'
  origemDia: string | null
  codigoPp: string | null
  criadoEm: string
}

export type MarcacoesVistas = Map<string, { nome: string; data: string; firstSeenAt: string }>

// deno-lint-ignore no-explicit-any
type Extrato = any

// ─── Composição pura (espelha ExtratoFeriasPage.jsx, memos registrosPP → extrato) ─

export function comporExtratoFerias({
  plantoesRaw,
  movimentacoes,
  marcacoesVistas,
  ano,
  excessoAnterior = null,
}: {
  plantoesRaw: PlantaoFeriasMin[]
  movimentacoes: MovimentacaoMin[]
  marcacoesVistas: MarcacoesVistas
  ano: number
  excessoAnterior?: Map<string, number> | null
}): Extrato {
  const socios = getSocios(ano)
  const feriados = getFeriados(ano)
  const registrosPP = normalizarRegistrosFerias(plantoesRaw)
  const registros = aplicarMovimentacoes(registrosPP, movimentacoes)
  const extratoBase = construirExtrato({ registros, ano, socios, feriados })

  const doPP = new Map(
    registrosPP
      .filter((r: { criadoEm: string | null }) => r.criadoEm)
      .map((r: { codigo: string; nome: string; data: string; criadoEm: string }) =>
        [r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.criadoEm }]),
  )
  const vistas = new Map([...marcacoesVistas, ...doPP, ...vistasDasMovimentacoes(movimentacoes)])

  const codigosPorDia = new Map<string, string[]>()
  for (const r of registros) {
    if (r.ehFimDeSemana) continue
    if (!codigosPorDia.has(r.data)) codigosPorDia.set(r.data, [])
    codigosPorDia.get(r.data)!.push(r.codigo)
  }
  const ultimosPorDia = new Map()
  for (const [data, nomes] of extratoBase.porDia) {
    if (nomes.length <= MAX_VAGAS_DIA) continue
    const info = ultimoAMarcar(codigosPorDia.get(data) || [], vistas)
    if (info) ultimosPorDia.set(data, info)
  }

  const penalidadesPorPessoa = penalidadesSetimaVaga(extratoBase.porDia, ultimosPorDia)
  // excesso do ano anterior sai da cota deste (dono 18/11/2026)
  return aplicarExcessoAnterior(aplicarPenalidades(extratoBase, penalidadesPorPessoa), excessoAnterior)
}

/** Excesso (dias acima da cota) do ano anterior, ou null antes de 2027. */
async function excessoDoAnoAnterior(ctx: RotaCtx, ano: number): Promise<Map<string, number> | null> {
  const anterior = ano - 1
  if (anterior < 2026) return null
  const [pp, movimentacoes, marcacoesVistas] = await Promise.all([
    ppDoAnoComCache(anterior),
    lerMovimentacoes(ctx, anterior),
    lerMarcacoesVistas(ctx, anterior),
  ])
  return excessoDoAno(comporExtratoFerias({ plantoesRaw: pp.ferias, movimentacoes, marcacoesVistas, ano: anterior }))
}

// ─── Serialização (WHITELIST) ───────────────────────────────────────────────

export function serializarSocio(p: Extrato, id: string | null = null) {
  return {
    id,
    nome: p.nomeCompleto,
    nome_escala: p.nome,
    cota: p.cota,
    regra_cota: p.regraCota,
    dias_marcados: p.diasContados,
    dias_penalidade: p.diasPenalidade,
    dias_usados: p.diasEfetivos,
    excesso_ano_anterior: p.excessoAnterior ?? 0,
    saldo: p.saldo,
    periodos: (p.periodos || []).map((per: { inicio: string; fim: string; diasUteis: number }) => ({
      inicio: per.inicio,
      fim: per.fim,
      dias_uteis: per.diasUteis,
    })),
    penalidades: (p.penalidades || []).map((x: { data: string; diasExtras: number }) => ({
      data: x.data,
      dias_extras: x.diasExtras,
    })),
  }
}

/** Comparação de nome sem caixa/acento/pontuação ("G. Melo" = "G. MELO", "Thayna" = "THAYNÁ"). */
export function normalizarNome(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase()
}

// ─── Identidade: sócio/nome do PP → uid de /v1/anestesistas ─────────────────
//
// Fontes, todas DETERMINÍSTICAS (nenhuma heurística de semelhança):
//   1. vw_api_anestesistas (a mesma de /v1/anestesistas): nome e apelidos da
//      escala, comparados por normalizarNome com o nomeCompleto E com o nome do
//      PP do sócio — igualdade exata, sem prefixo/substring;
//   2. EMAIL_TO_SOCIO (espelho de src/pages/ferias/gate.js, que é espelhado no
//      SQL por ferias_nome_socio()): e-mail da conta → sócio. A conta secundária
//      resolve para a principal (conta_duplicada_de), como na view.
// Todas as fontes se SOMAM: o id só sai quando o conjunto de candidatos tem
// exatamente 1 uid. 0 ou ≥2 candidatos → id null (identidade ambígua é nula).
// Nome do PP diferente do cadastro → cadastrar o nome do PP como apelido da
// escala (escala_anestesista_alias), sem código novo e sem mudar o nome exibido.
// 17/11/2026: feito para os 4 que faltavam → 46/46 sócios com id.

/** ESPELHO de EMAIL_TO_SOCIO (src/pages/ferias/gate.js). Paridade travada em apiV1FeriasAusencias.test.js. */
export const EMAIL_TO_SOCIO: Readonly<Record<string, string>> = {
  'mtcury19@gmail.com': 'MARCOS TADEU CURY',
  'raperizzolo@gmail.com': 'RAUL PERIZZOLO',
  'dallmagro@hotmail.com': 'ADRIANO DALL´MAGRO',
  'vicentepons4@gmail.com': 'VICENTE PONS',
  'dezembro71@hotmail.com': 'MAURICIO MAHALEM BASTOS',
  'rosecury64@gmail.com': 'ROSEMARY CURY',
  'eclampsium@yahoo.com.br': 'HUMBERTO HEPP',
  'rodneilima@gmail.com': 'RODNEI CABRAL LIMA',
  'marcoscc1211@gmail.com': 'MARCOS CARDOSO COSTA',
  'schneiderraquel17@gmail.com': 'RAQUEL SCHNEIDER',
  'alineanestesio@gmail.com': 'ALINE BOFF BONFANTE',
  'gustavogarim@hotmail.com': 'GUSTAVO ALMANSA GARIM',
  'oscarmorais3@hotmail.com': 'OSCAR AUGUSTO DE OLIVEIRA MORAIS',
  'janafavorito@gmail.com': 'JANAINA SANCHES FAVORITO MORAIS',
  'diegobori@hotmail.com': 'DIEGO B. RIGOTTI',
  'guollofernanda@gmail.com': 'FERNANDA GUOLLO',
  'gabicvedana@gmail.com': 'GABRIELA CITRON VEDANA',
  'robertagrando@yahoo.com.br': 'ROBERTA MARINA GRANDO',
  'gustavoo_b@hotmail.com': 'GUSTAVO BIESDORF',
  'leoferrazzo@gmail.com': 'LEONARDO FERRAZZO',
  'mariliojosef@hotmail.com': 'MARILIO JOSÉ FLACH',
  'fhm555@gmail.com': 'FERNANDO HENRIQUE MACHADO',
  'leandrobernardes03@hotmail.com': 'LEANDRO BERNARDES',
  'cristinabertolb@gmail.com': 'CRISTINA BERTOL BARBOSA MARCON',
  'tiagoiopviana@gmail.com': 'TIAGO IOP VIANA',
  'wguime@yahoo.com.br': 'G. MELO',
  'anestesista.guilherme@gmail.com': 'G. MELO',
  'paulotmed@gmail.com': 'PAULO TONINI',
  'guigostaub@hotmail.com': 'G. STAUB',
  'alexandre_danieli@yahoo.com.br': 'A. DANIELI',
  'joaormoreiraster@gmail.com': 'JOÃO RICARDO MOREIRA',
  'alexandre.schmidt82@gmail.com': 'A. SCHMIDT',
  'klismandrescherhilleshein@gmail.com': 'KLISMAN DRESCHER HILLESHEIN',
  'giovanagomes.noll@gmail.com': 'GIOVANA GOMES NOLL',
  'edusavoldi@gmail.com': 'EDUARDO SAVOLDI',
  'louisemwarnava@yahoo.com.br': 'LOUISE MACAGNAN WARNAVA',
  'dormatheuscunha@gmail.com': 'MATHEUS VIEIRA DA CUNHA',
  'thayna_santos9@hotmail.com': 'THAYNÁ REGINA SANTOS',
  'erlei@clinicacastelo.com.br': 'ERLEI PERINI',
  'gabrieljkc@gmail.com': 'GABRIEL JUAN KETTENHUBER COSTA',
  'karine.bedin9@gmail.com': 'KARINE BEDIN',
  'rafaelpelissaro@gmail.com': 'RAFAEL PELISSARO',
  'romulo_roxos@hotmail.com': 'ROMULO SANTOS ROXO',
  'joaohvanni@hotmail.com': 'JOAO HENRIQUE SALVAO VANNI',
  'guilhermexavier.d@gmail.com': 'GUILHERME XAVIER DI DOMENICO',
  'danikreis@gmail.com': 'DANIELA KLEIN REIS',
  'nathaliafornarifernandes@gmail.com': 'NATHALIA FORNARI FERNANDES',
}

export interface AnestesistaMin {
  id: string
  nome: string
  apelidos: string[]
}

export interface Identidades {
  anestesistas: AnestesistaMin[]
  /** nome do sócio no PP → uids canônicos vindos do e-mail (EMAIL_TO_SOCIO) */
  idsPorEmailSocio: Map<string, Set<string>>
}

/** chave normalizada (nome ou apelido) → uids que a carregam */
export function indexarAnestesistas(lista: AnestesistaMin[]): Map<string, Set<string>> {
  const idx = new Map<string, Set<string>>()
  const add = (chave: string, id: string) => {
    const k = normalizarNome(chave)
    if (!k || !id) return
    if (!idx.has(k)) idx.set(k, new Set())
    idx.get(k)!.add(id)
  }
  for (const a of lista) {
    add(a.nome, a.id)
    for (const ap of a.apelidos || []) add(ap, a.id)
  }
  return idx
}

/** uid único para um conjunto de nomes (candidatos somados); senão null. */
export function idUnico(idx: Map<string, Set<string>>, nomes: string[], extras: Iterable<string> = []): string | null {
  const ids = new Set<string>(extras)
  for (const n of nomes) for (const id of idx.get(normalizarNome(n)) || []) ids.add(id)
  return ids.size === 1 ? [...ids][0] : null
}

/** nome do sócio no PP (chave do extrato) → uid ou null. */
export function resolverIdsSocios(
  socios: { nome: string; nomeCompleto: string }[],
  { anestesistas, idsPorEmailSocio }: Identidades,
): Map<string, string | null> {
  const idx = indexarAnestesistas(anestesistas)
  const out = new Map<string, string | null>()
  for (const s of socios) {
    out.set(s.nome, idUnico(idx, [s.nomeCompleto, s.nome], idsPorEmailSocio.get(s.nome) || []))
  }
  return out
}

export async function lerIdentidades(ctx: RotaCtx): Promise<Identidades> {
  const [roster, contas] = await Promise.all([
    ctx.supabase.from('vw_api_anestesistas').select('id, nome, apelidos'),
    // e-mail só serve de chave aqui; não sai da função
    ctx.supabase.from('profiles').select('id, email, conta_duplicada_de').in('email', Object.keys(EMAIL_TO_SOCIO)),
  ])
  if (roster.error) throw new Error('db_identidades')
  if (contas.error) throw new Error('db_identidades')
  const anestesistas: AnestesistaMin[] = (roster.data || []).map(
    (r: { id: string; nome: string | null; apelidos: string[] | null }) => ({
      id: r.id,
      nome: r.nome || '',
      apelidos: Array.isArray(r.apelidos) ? r.apelidos : [],
    }),
  )
  const idsPorEmailSocio = new Map<string, Set<string>>()
  for (const c of contas.data || []) {
    const socio = EMAIL_TO_SOCIO[String(c.email || '').trim().toLowerCase()]
    if (!socio) continue
    if (!idsPorEmailSocio.has(socio)) idsPorEmailSocio.set(socio, new Set())
    idsPorEmailSocio.get(socio)!.add(c.conta_duplicada_de || c.id)
  }
  return { anestesistas, idsPorEmailSocio }
}

// ─── I/O ────────────────────────────────────────────────────────────────────

const RE_FERIAS = /f[ée]rias/i
/** Mesmo filtro de getLicencasDoAno (pegaPlantaoApi.js): setor "LICENÇA SAÚDE" e afins. */
const RE_LICENCA = /licen[çc]a/i
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Licença minimizada: quem, quando e o MOTIVO (o setor do PP, ex. "LICENÇA SAÚDE").
 * O motivo sai em /v1/ferias/ausencias por decisão expressa do dono (nov/2026) —
 * DADO SENSÍVEL (saúde, LGPD art. 11), coberto pelo contrato de operador. Código,
 * comentário e o resto do PP continuam nunca ficando em memória.
 */
export interface LicencaMin {
  nome: string
  data: string
  motivo: string
}

export interface PPDoAno {
  ferias: PlantaoFeriasMin[]
  licencas: LicencaMin[]
}

const cachePP = new Map<number, { expira: number; promessa: Promise<PPDoAno> }>()

/** Espelha registrosDoAnoPorSetor (pegaPlantaoApi.js): 12 meses em lotes de 3, dedup por código. */
async function varrerPPDoAno(ano: number): Promise<PPDoAno> {
  const porCodigo = new Map<string, PlantaoFeriasMin>()
  const licencas = new Map<string, LicencaMin>()
  for (let i = 1; i <= 12; i += 3) {
    const lote = [i, i + 1, i + 2]
    const resultados = await Promise.all(
      lote.map((mes) => {
        const mm = String(mes).padStart(2, '0')
        const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
        return getPlantoes(`${ano}-${mm}-01T00:00:00`, `${ano}-${mm}-${ultimoDia}T23:59:59`)
      }),
    )
    for (const plantoes of resultados) {
      if (!Array.isArray(plantoes)) continue
      for (const p of plantoes) {
        if (!p?.Setor) continue
        if (RE_LICENCA.test(p.Setor) && !RE_FERIAS.test(p.Setor)) {
          // mesma normalização de normalizarLicencas (useFeriasDoAno.js): dedup nome|data
          const nome = String(p.ProfDePlantao || p.ProfFixo || '').trim().toUpperCase()
          const data = String(p.Inicio || '').slice(0, 10)
          const motivo = String(p.Setor).trim()
          if (nome && /^\d{4}-\d{2}-\d{2}$/.test(data) && !licencas.has(`${nome}|${data}`)) {
            licencas.set(`${nome}|${data}`, { nome, data, motivo })
          }
          continue
        }
        if (!RE_FERIAS.test(p.Setor)) continue
        const codigo = p.CodigoPlantao || `${p.ProfDePlantao || p.ProfFixo}|${p.Inicio}`
        if (porCodigo.has(codigo)) continue
        // minimização: só os 6 campos que a normalização lê; o resto do PP nunca fica em memória
        porCodigo.set(codigo, {
          CodigoPlantao: p.CodigoPlantao ?? null,
          Setor: p.Setor,
          ProfDePlantao: p.ProfDePlantao ?? null,
          ProfFixo: p.ProfFixo ?? null,
          Inicio: p.Inicio,
          DataCriacao: p.DataCriacao ?? null,
        })
      }
    }
  }
  return { ferias: [...porCodigo.values()], licencas: [...licencas.values()] }
}

/**
 * Cache em memória por isolate (5 min) + dedup de requisições simultâneas.
 * Uma varredura serve o extrato (férias) e as ausências (férias + licenças).
 */
export function ppDoAnoComCache(ano: number): Promise<PPDoAno> {
  const agora = Date.now()
  const hit = cachePP.get(ano)
  if (hit && hit.expira > agora) return hit.promessa
  const promessa = varrerPPDoAno(ano)
  cachePP.set(ano, { expira: agora + CACHE_TTL_MS, promessa })
  promessa.catch(() => cachePP.delete(ano)) // erro não fica cacheado
  return promessa
}

const PAGINA = 1000

export async function lerMovimentacoes(ctx: RotaCtx, ano: number): Promise<MovimentacaoMin[]> {
  const out: MovimentacaoMin[] = []
  for (let de = 0; ; de += PAGINA) {
    // colunas explícitas: user_id, avisos_aceitos, req_id, custo_dias NUNCA saem do banco
    const { data, error } = await ctx.supabase
      .from('ferias_movimentacoes')
      .select('id, nome, data, acao, origem_dia, codigo_pp, criado_em')
      .eq('ano', ano)
      .order('criado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw new Error('db_movimentacoes')
    for (const r of data || []) {
      out.push({ id: r.id, nome: r.nome, data: r.data, acao: r.acao, origemDia: r.origem_dia, codigoPp: r.codigo_pp, criadoEm: r.criado_em })
    }
    if (!data || data.length < PAGINA) return out
  }
}

async function lerMarcacoesVistas(ctx: RotaCtx, ano: number): Promise<MarcacoesVistas> {
  const out: MarcacoesVistas = new Map()
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await ctx.supabase
      .from('ferias_marcacoes_vistas')
      .select('codigo, nome, data, first_seen_at')
      .eq('ano', ano)
      .order('codigo', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw new Error('db_marcacoes_vistas')
    for (const r of data || []) out.set(r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.first_seen_at })
    if (!data || data.length < PAGINA) return out
  }
}

export function anoCorrenteSaoPaulo(): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date()))
}

export const ANO_MINIMO = 2023 // o Pega Plantão serve 2023+ (mesmo piso do Mapa)

// ─── Rota ───────────────────────────────────────────────────────────────────

export async function rotaFeriasExtrato(ctx: RotaCtx): Promise<RotaResultado> {
  const anoAtual = anoCorrenteSaoPaulo()
  const anoParam = ctx.url.searchParams.get('ano')
  let ano = anoAtual
  if (anoParam !== null) {
    if (!/^\d{4}$/.test(anoParam)) return parametroInvalido('ano deve ser YYYY')
    ano = Number(anoParam)
    if (ano < ANO_MINIMO || ano > anoAtual + 1) {
      return parametroInvalido(`ano deve estar entre ${ANO_MINIMO} e ${anoAtual + 1}`)
    }
  }
  const nomeParam = ctx.url.searchParams.get('nome')
  if (nomeParam !== null && (nomeParam.trim().length < 2 || nomeParam.length > 120)) {
    return parametroInvalido('nome deve ter entre 2 e 120 caracteres')
  }

  try {
    const [pp, movimentacoes, marcacoesVistas, identidades, excessoAnterior] = await Promise.all([
      ppDoAnoComCache(ano),
      lerMovimentacoes(ctx, ano),
      lerMarcacoesVistas(ctx, ano),
      lerIdentidades(ctx),
      excessoDoAnoAnterior(ctx, ano),
    ])
    const plantoesRaw = pp.ferias
    const idsSocios = resolverIdsSocios(getSocios(ano), identidades)
    const extrato = comporExtratoFerias({ plantoesRaw, movimentacoes, marcacoesVistas, ano, excessoAnterior })

    let socios = extrato.porPessoa
    if (nomeParam !== null) {
      const alvo = normalizarNome(nomeParam)
      socios = socios.filter(
        (p: Extrato) => normalizarNome(p.nome) === alvo || normalizarNome(p.nomeCompleto) === alvo,
      )
      if (socios.length === 0) {
        return { status: 404, body: { error: 'not_found', detail: 'sócio não encontrado' } }
      }
    }

    return ok({
      ano,
      fonte: 'pega_plantao+ferias_movimentacoes',
      regras: {
        fim_de_semana: 'não conta',
        feriado: 'em semana com feriado, só não conta quando a semana inteira está marcada; senão o feriado conta como dia de férias',
        setima_vaga: 'quem marcou por último um dia com mais de 6 sócios paga 3 dias (2 extras), exceto nos períodos nobres e em dia de congresso',
        excesso: 'dias acima da cota no ano são descontados da cota do ano seguinte',
      },
      total: socios.length,
      socios: socios.map((p: Extrato) => serializarSocio(p, idsSocios.get(p.nome) ?? null)),
    })
  } catch (err) {
    // só o código da etapa — nunca mensagem/corpo do upstream
    if (err instanceof PegaPlantaoErro) {
      return { status: 502, body: { error: 'upstream_unavailable', detail: err.message } }
    }
    const msg = err instanceof Error && /^db_/.test(err.message) ? err.message : 'internal_error'
    console.error('[api-v1/ferias] falha:', msg)
    return erroInterno(msg)
  }
}
