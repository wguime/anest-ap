// =============================================================================
// supabase/functions/api-v1/_escala-numerica.ts — Escala Numérica e Feriados
//
//   GET /v1/escala-numerica?data=YYYY-MM-DD | ?inicio=&fim= (máx MAX_DIAS_INTERVALO)
//   GET /v1/feriados?ano=YYYY
//   escopo: read:escala-cirurgica (ENDPOINT_SCOPES no index.ts)
//
// O MESMO cálculo das telas (src/pages/escala-numerica/EscalaNumericaPage.jsx e
// FeriadosPage.jsx): as libs e o dataset são COPIADOS por
// scripts/gerar-libs-numerica-api-v1.mjs para ./_lib-numerica/ — nada é
// reimplementado aqui, só o I/O (o que a tela busca em hooks) e a serialização.
//
//   Numérica (dia útil): montarVistaNumerica = numérica → pós-plantão (noturno da
//     véspera: Pega Plantão ter–sex, documento de FDS publicado na segunda) →
//     férias e ausências MARCADAS (ninguém sai) → lugar vago.
//   Feriado: fila única da escala de feriados (sem pós-plantão).
//   Fim de semana: a numérica não vale — postos P1…P12 do Pega Plantão,
//     lançados no SÁBADO (o domingo lê o sábado anterior), como o BlocoFds.
//   Feriados: fila EFETIVA = impressa + trocas ACEITAS (Firestore trocas_feriado),
//     e a lista de TODAS as trocas do ano (pendente/aceita/rejeitada/cancelada).
//
// Identidade: o nome da legenda vira o nome do cadastro por CADASTRO_LEGENDA e
// casa com /v1/anestesistas pelo mesmo resolvedor da rota de plantões; dois ou
// mais candidatos → id null (identidade ambígua é nula).
//
// DADO SENSÍVEL, por decisão expressa do dono (nov/2026), coberto pelo contrato
// de operador: `observacao` (texto livre dos cards da numérica) e
// `justificativa` das trocas de feriado. Nunca saem: autor/e-mail das
// observações, uid de quem respondeu, campos crus do Pega Plantão.
// =============================================================================

import {
  dataIsoValida,
  erroInterno,
  ok,
  parametroInvalido,
  type RotaCtx,
  type RotaResultado,
} from './_contrato.ts'
import { getPlantoes, PegaPlantaoErro } from './_pegaplantao.ts'
import { criarResolvedor, listarDias, paredeSP, parseIntervalo, type Pessoa } from './_plantoes.ts'
import { ppDoAnoComCache } from './_ferias.ts'
import { listarColecao } from './_firestore.ts'
import { normalizarRegistrosFerias } from './_lib-ferias/extratoFerias.js'
import dadosGerados from './_lib-numerica/escalaNumericaDados.js'
import * as libNumerica from './_lib-numerica/escalaNumerica.js'
import * as libVista from './_lib-numerica/escalaNumericaVista.js'
import * as libPos from './_lib-numerica/posPlantao.js'
import * as libTrocas from './_lib-numerica/trocasFeriado.js'
import * as libNome from './_lib-numerica/nomeExibicao.js'
import * as libSituacao from './_lib-numerica/situacao.js'
import * as libFds from './_lib-numerica/plantonistasFds.js'
import * as libCalendario from './_lib-numerica/calendario.js'

// deno-lint-ignore no-explicit-any
type Qualquer = any
type Linha = Record<string, unknown>
// As libs são JS puro copiado das telas: tipadas aqui como `any` de propósito — o
// contrato delas é o teste de paridade, não o inferidor do TypeScript.
const dados: Qualquer = dadosGerados
const { anotarFerias, CADASTRO_LEGENDA, LABEL_HOSPITAL, LABEL_TURNO, normNomeNumerica } = libNumerica as Qualquer
const { montarVistaNumerica } = libVista as Qualquer
const { fonteDoNoturno, noturnosDoDocumentoFds, noturnosDoPegaPlantao, vesperaDe } = libPos as Qualquer
const { filasDoFeriado } = libTrocas as Qualquer
const { nomeExibicao } = libNome as Qualquer
const { contarTrabalhando, rotuloSituacao, situacao } = libSituacao as Qualquer
const { filaPn, sabadoDoFimDeSemana } = libFds as Qualquer
const { listarFeriados } = libCalendario as Qualquer

const TURNOS = ['matutino', 'vespertino'] as const
const DIA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const diaSemana = (d: string) => DIA_LONGO[new Date(`${d}T12:00:00Z`).getUTCDay()]

// ── Identidade ──────────────────────────────────────────────────────────────

export interface Identificador {
  /** nome da legenda ("MELO", "HUMBERTO / ROBERTA") → uma pessoa por parte */
  daLegenda: (nomeLegenda: string) => { id: string | null; nome: string }[]
  /** nome completo do Pega Plantão → pessoa */
  doPP: (nome: string) => { id: string | null; nome: string }
  nomeDoId: (id: string) => string | null
}

export function criarIdentificador(pessoas: Pessoa[]): Identificador {
  const resolver = criarResolvedor(pessoas)
  const nomePorId = new Map(pessoas.map((p) => [p.id, p.nome]))
  const parte = (nome: string) => {
    const cadastros: string[] = CADASTRO_LEGENDA[normNomeNumerica(nome)] || []
    const candidatos = cadastros.length ? cadastros : [nome]
    const ids = new Set(candidatos.map((c) => resolver(c)).filter((x): x is string => Boolean(x)))
    const id = ids.size === 1 ? [...ids][0] : null
    return { id, nome: (id && nomePorId.get(id)) || cadastros[0] || nomeExibicao(nome) }
  }
  return {
    daLegenda: (nomeLegenda) =>
      String(nomeLegenda || '').split('/').map((s) => s.trim()).filter(Boolean).map(parte),
    doPP: (nome) => {
      const id = resolver(nome)
      return { id, nome: (id && nomePorId.get(id)) || nome }
    },
    nomeDoId: (id) => nomePorId.get(id) ?? null,
  }
}

async function lerPessoas(ctx: RotaCtx): Promise<Pessoa[]> {
  const { data, error } = await ctx.supabase.from('vw_api_anestesistas').select('id,nome,ativo,apelidos')
  if (error) throw new Error('db_anestesistas')
  return ((data ?? []) as Linha[])
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : '',
      nome: typeof r.nome === 'string' ? r.nome.trim() : '',
      apelidos: Array.isArray(r.apelidos) ? r.apelidos.filter((a): a is string => typeof a === 'string') : [],
      ativo: r.ativo !== false,
    }))
    .filter((r) => r.id && r.nome)
}

// ── Serialização de uma linha da fila ───────────────────────────────────────

const SITUACAO_API: Record<string, string> = {
  ferias: 'ferias',
  ausente: 'ausente',
  pos: 'pos_plantao',
  noite: 'plantao_noturno',
}

export function linhaApi(p: Qualquer, ident: Identificador) {
  const base = {
    numero: p.numero ?? null,
    nome_legenda: p.nome,
    nome: nomeExibicao(p.nome),
    anestesistas: ident.daLegenda(p.nome),
  }
  if (p.lugarVago) {
    return {
      posicao: null,
      ...base,
      situacao: 'lugar_vago',
      rotulo: `subiu para o ${p.postoPlantao} (${LABEL_HOSPITAL[p.destino] ?? p.destino})`,
      posto_plantao: p.postoPlantao ?? null,
      destino: p.destino ?? null,
      em_ferias: [],
      inserida: false,
      trocado: false,
    }
  }
  const s = situacao(p)
  return {
    posicao: typeof p.posicao === 'number' ? p.posicao : null,
    ...base,
    situacao: s ? SITUACAO_API[s] : null,
    rotulo: rotuloSituacao(p),
    posto_plantao: p.postoPlantao ?? null,
    destino: null,
    em_ferias: Array.isArray(p.ferias) ? p.ferias : [],
    inserida: Boolean(p.inserida),
    trocado: Boolean(p.trocado),
  }
}

// ── Pega Plantão (o que a tela busca em getPlantoesPorData / useFeriasDoAno) ─

/** Espelha getPlantoesPorData (pegaPlantaoApi.js): plantões (não-férias) por data de início. */
export function plantoesPorData(raw: unknown): Map<string, { nome: string; setor: string; horario: string; horarioFim: string | null }[]> {
  const out = new Map<string, { nome: string; setor: string; horario: string; horarioFim: string | null }[]>()
  for (const p of Array.isArray(raw) ? (raw as Linha[]) : []) {
    const nome = String(p?.ProfDePlantao || p?.ProfFixo || '')
    if (!nome) continue
    const setorRaw = typeof p.Setor === 'string' ? p.Setor : ''
    if (setorRaw.toLowerCase().includes('férias')) continue
    const ini = paredeSP(p.Inicio)
    if (!ini) continue
    const fim = paredeSP(p.Fim)
    const m = setorRaw.match(/P(\d+)/i)
    const item = { nome, setor: setorRaw ? (m ? `P${m[1]}` : setorRaw) : '', horario: ini.slice(11, 16), horarioFim: fim ? fim.slice(11, 16) : null }
    const dia = ini.slice(0, 10)
    out.set(dia, [...(out.get(dia) ?? []), item])
  }
  return out
}

/** Nomes num dia (feriasNaData de useFeriasDoAno.js). */
export function nomesNaData(registros: { nome: string; data: string }[] | null, d: string): string[] | null {
  if (!Array.isArray(registros)) return null
  return [...new Set(registros.filter((r) => r.data === d).map((r) => r.nome))]
}

interface FontesPP {
  ferias: { nome: string; data: string }[] | null
  licencas: { nome: string; data: string }[] | null
  porData: ReturnType<typeof plantoesPorData>
  disponivel: boolean
}

async function lerPP(anos: number[], inicio: string, fim: string): Promise<FontesPP> {
  try {
    const [porAno, raw] = await Promise.all([
      Promise.all(anos.map((a) => ppDoAnoComCache(a))),
      getPlantoes(`${inicio}T00:00:00`, `${fim}T23:59:59`),
    ])
    return {
      ferias: porAno.flatMap((pp) => normalizarRegistrosFerias(pp.ferias)),
      // a tela só usa nome+data da licença para marcar "ausente"
      licencas: porAno.flatMap((pp) => pp.licencas.map((l) => ({ nome: l.nome, data: l.data }))),
      porData: plantoesPorData(raw),
      disponivel: true,
    }
  } catch (err) {
    // a tela segue sem as marcas e avisa "férias NÃO conferidas" — a API faz o mesmo
    if (!(err instanceof PegaPlantaoErro)) throw err
    return { ferias: null, licencas: null, porData: new Map(), disponivel: false }
  }
}

// ── /v1/escala-numerica ─────────────────────────────────────────────────────

export type Observacoes = Map<string, { texto: string; atualizado_em: string | null }>
const chaveObs = (d: string, turno: string, hospital: string) => `${d}|${turno}|${hospital}`

export function comporDiaNumerica({
  data: d,
  pp,
  noturnos,
  observacoes,
  ident,
}: {
  data: string
  pp: FontesPP
  noturnos: { hro: string | null; unimed: string | null }
  observacoes: Observacoes
  ident: Identificador
}) {
  const ferias = nomesNaData(pp.ferias, d)
  const ausentes = nomesNaData(pp.licencas, d)
  const sonda = montarVistaNumerica(dados, d, 'matutino', ferias, noturnos, ausentes)
  const cabecalho = { data: d, dia_semana: diaSemana(d) }

  if (sonda.tipo === 'vazio') {
    if (sonda.motivo === 'fim_de_semana') {
      const sabado = sabadoDoFimDeSemana(d)
      const fila = filaPn(pp.porData.get(sabado) ?? [])
      return {
        ...cabecalho,
        tipo: 'fim_de_semana',
        feriado: null,
        sabado_referencia: sabado,
        fim_de_semana: fila.map((f: Qualquer) => ({ posicao: f.pn, faixa: f.faixa, anestesista: ident.doPP(f.nome) })),
        turnos: null,
      }
    }
    return { ...cabecalho, tipo: sonda.motivo === 'feriado' ? 'feriado_sem_escala' : 'fora_da_vigencia', feriado: null, turnos: null }
  }

  const turnos = TURNOS.map((turno) => {
    const v = turno === 'matutino' ? sonda : montarVistaNumerica(dados, d, turno, ferias, noturnos, ausentes)
    const obs = (hospital: string) => observacoes.get(chaveObs(d, turno, hospital)) ?? null
    if (v.tipo === 'feriado') {
      return { turno, rotulo: LABEL_TURNO[turno], lista: v.lista.map((p: Qualquer) => linhaApi(p, ident)), pendencias: v.pendencias }
    }
    return {
      turno,
      rotulo: LABEL_TURNO[turno],
      hospitais: v.blocos.map((b: Qualquer) => ({
        hospital: b.hospital,
        rotulo: LABEL_HOSPITAL[b.hospital],
        lista: b.lista.map((p: Qualquer) => linhaApi(p, ident)),
        // "quantos trabalham" só no HRO e na Unimed (dono 07/10), como a tela
        trabalhando: b.hospital === 'materno' ? null : contarTrabalhando(b.lista).trabalhando,
        observacao: obs(b.hospital),
      })),
      consultorio: { lista: v.consultorio.map((p: Qualquer) => linhaApi(p, ident)), observacao: obs('consultorio') },
      pendencias: v.pendencias,
    }
  })
  return {
    ...cabecalho,
    tipo: sonda.tipo === 'feriado' ? 'feriado' : 'dia_util',
    feriado: sonda.tipo === 'feriado' ? sonda.feriado : null,
    turnos,
  }
}

export async function rotaEscalaNumerica(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseIntervalo(ctx.url.searchParams)
  if (!p.ok) return p.erro
  const { inicio, fim } = p
  const dias = listarDias(inicio, fim)

  // o PP é lido de inicio-1 (véspera do 1º dia e o sábado de um domingo) até fim
  const desde = vesperaDe(inicio)
  const domingosVespera = dias.filter((d) => fonteDoNoturno(d) === 'documento-fds').map((d) => vesperaDe(d))
  const anos = [...new Set(dias.map((d) => Number(d.slice(0, 4))))]

  try {
    const [pp, pessoas, obsRes, fdsRes] = await Promise.all([
      lerPP(anos, desde, fim),
      lerPessoas(ctx),
      ctx.supabase
        .from('escala_numerica_observacao')
        .select('data,turno,hospital,texto,atualizado_em') // autor_id/autor_nome nunca saem
        .gte('data', inicio)
        .lte('data', fim),
      domingosVespera.length
        ? ctx.supabase.from('escala_cirurgica').select('data,fds_meta').eq('hospital', 'fds').in('data', domingosVespera)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (obsRes.error || fdsRes.error) throw new Error('db_escala_numerica')

    const observacoes: Observacoes = new Map()
    for (const r of (obsRes.data ?? []) as Linha[]) {
      const texto = typeof r.texto === 'string' ? r.texto.trim() : ''
      if (!texto) continue // apagar = gravar vazio
      observacoes.set(chaveObs(String(r.data).slice(0, 10), String(r.turno), String(r.hospital)), {
        texto,
        atualizado_em: typeof r.atualizado_em === 'string' ? r.atualizado_em : null,
      })
    }
    const gradeFds = new Map<string, unknown>()
    for (const r of (fdsRes.data ?? []) as Linha[]) {
      gradeFds.set(String(r.data).slice(0, 10), (r.fds_meta as Linha | null)?.grade ?? null)
    }

    const ident = criarIdentificador(pessoas)
    const VAZIO = { hro: null, unimed: null }
    const saida = dias.map((d) => {
      const fonte = fonteDoNoturno(d)
      const vespera = fonte ? vesperaDe(d) : null
      const noturnos = !vespera
        ? VAZIO
        : fonte === 'pega-plantao'
          ? (pp.disponivel ? noturnosDoPegaPlantao(pp.porData.get(vespera) ?? []) : VAZIO)
          : noturnosDoDocumentoFds(gradeFds.get(vespera))
      return comporDiaNumerica({ data: d, pp, noturnos, observacoes, ident })
    })

    return ok({
      data: saida,
      meta: {
        inicio,
        fim,
        total_dias: saida.length,
        edicao: { ano: dados.ano, vigencia: dados.vigencia },
        ferias_conferidas: pp.disponivel,
        fonte: 'escala_numerica+pega_plantao+escala_numerica_observacao',
        situacoes: {
          ferias: 'férias no Pega Plantão — fica na posição, não trabalha',
          ausente: 'licença no Pega Plantão — fica na posição, não trabalha',
          pos_plantao: 'fez o plantão noturno da véspera — à tarde fica na posição, não trabalha',
          plantao_noturno: 'fez o plantão da véspera — de manhã TRABALHA, na 2ª posição do hospital do plantão',
          lugar_vago: 'lugar de quem subiu para o P1/P2 em outro hospital — não é ninguém ali',
        },
      },
    })
  } catch (err) {
    const msg = err instanceof Error && /^db_/.test(err.message) ? err.message : 'internal_error'
    console.error('[api-v1/escala-numerica] falha:', msg)
    return erroInterno(msg)
  }
}

// ── /v1/feriados ────────────────────────────────────────────────────────────

const STATUS_TROCA = new Set(['pendente', 'aceita', 'rejeitada', 'cancelada'])

export function trocaApi(t: Linha, ident: Identificador) {
  const pessoa = (uid: unknown, nomeLegenda: unknown) => {
    const u = typeof uid === 'string' ? uid : ''
    if (u && ident.nomeDoId(u)) return { id: u, nome: ident.nomeDoId(u)! }
    const [p] = ident.daLegenda(String(nomeLegenda || ''))
    return p ?? { id: null, nome: String(nomeLegenda || '') }
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const status = String(t.status || '')
  return {
    codigo: str(t.codigo),
    status,
    escopo: t.escopo === 'posicao' ? 'posicao' : 'data',
    feriado: { data: str(t.feriadoData), nome: str(t.feriadoNome) },
    feriado_desejado: t.escopo === 'data' && str(t.feriadoDesejado)
      ? { data: str(t.feriadoDesejado), nome: str(t.feriadoDesejadoNome) }
      : null,
    de: pessoa(t.solicitanteUid, t.solicitanteNome),
    para: pessoa(t.destinatarioUid, t.destinatarioNome),
    justificativa: str(t.descricao),
    criada_em: str(t.criadoEm),
    decidida_em: str(t.respostaEm) ?? (status === 'cancelada' ? str(t.atualizadoEm) : null),
  }
}

export function comporFeriados({
  ano,
  trocas,
  pp,
  ident,
}: {
  ano: number
  trocas: Linha[]
  pp: FontesPP
  ident: Identificador
}) {
  if (Number(dados.ano) !== ano) return { feriados: [], trocas: [] }
  const aceitas = trocas.filter((t) => t.status === 'aceita')
  const feriados = listarFeriados(dados, '0000-00-00').map((f: Qualquer) => {
    const filas = filasDoFeriado(dados, f.data, aceitas)
    const ferias = nomesNaData(pp.ferias, f.data)
    return {
      data: f.data,
      nome: f.nome,
      dia_semana: f.diaSemana,
      fila: filas
        ? {
          matutino: anotarFerias(filas.matutino, ferias).map((p: Qualquer) => linhaApi(p, ident)),
          vespertino: anotarFerias(filas.vespertino, ferias).map((p: Qualquer) => linhaApi(p, ident)),
        }
        : null,
    }
  })
  const doAno = (t: Linha) =>
    [t.feriadoData, t.feriadoDesejado].some((d) => typeof d === 'string' && d.startsWith(String(ano)))
  return {
    feriados,
    trocas: trocas
      .filter((t) => STATUS_TROCA.has(String(t.status)) && doAno(t))
      .map((t) => trocaApi(t, ident))
      .sort((a, b) => String(a.criada_em ?? '').localeCompare(String(b.criada_em ?? ''))),
  }
}

export async function rotaFeriados(ctx: RotaCtx): Promise<RotaResultado> {
  const anoQ = ctx.url.searchParams.get('ano')
  let ano = Number(dados.ano)
  if (anoQ !== null) {
    if (!/^\d{4}$/.test(anoQ)) return parametroInvalido('ano deve ser YYYY')
    ano = Number(anoQ)
  }
  try {
    const datas = Object.keys(dados?.feriados?.dias || {}).sort()
    const [trocasDocs, pessoas, pp] = await Promise.all([
      listarColecao('trocas_feriado').catch(() => {
        throw new Error('upstream_firestore')
      }),
      lerPessoas(ctx),
      datas.length && Number(dados.ano) === ano && dataIsoValida(datas[0])
        ? lerPP([ano], datas[0], datas[0])
        : Promise.resolve({ ferias: null, licencas: null, porData: new Map(), disponivel: false } as FontesPP),
    ])
    const corpo = comporFeriados({ ano, trocas: Object.values(trocasDocs), pp, ident: criarIdentificador(pessoas) })
    return ok({
      ano,
      ...corpo,
      meta: {
        total_feriados: corpo.feriados.length,
        total_trocas: corpo.trocas.length,
        ferias_conferidas: pp.disponivel,
        fonte: 'escala_de_feriados+trocas_feriado+pega_plantao',
        regras: {
          fila: 'fila única do feriado (todos os hospitais); a tarde é a manhã invertida',
          trocas: 'a fila já vem com as trocas ACEITAS aplicadas; `trocas` lista todas, de qualquer status',
        },
        ...(Number(dados.ano) !== ano && { aviso: `sem escala de feriados publicada para ${ano}` }),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'upstream_firestore') {
      return { status: 502, body: { error: 'upstream_unavailable', detail: 'firestore' } }
    }
    const msg = err instanceof Error && /^db_/.test(err.message) ? err.message : 'internal_error'
    console.error('[api-v1/feriados] falha:', msg)
    return erroInterno(msg)
  }
}
