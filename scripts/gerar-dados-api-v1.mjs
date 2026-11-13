#!/usr/bin/env node
/**
 * Gera supabase/functions/api-v1/_dados-gerados.ts — a BASE ESTÁTICA que as rotas
 * /v1/residentes* e /v1/funcionarias/escala da API externa somam aos ajustes do
 * Firestore (escala efetiva = base + override do dia).
 *
 * QUANDO RODAR DE NOVO (e redeployar a edge api-v1):
 *   - editou src/data/residencia2026.js (residentes, ROTACOES_2026) ou
 *     src/data/plantao2026.js (PLANTOES_2026, FERIADOS_2026, labels);
 *   - editou src/data/sobreavisoMaterno2026.js ou hospitaisTecnicas2026.js
 *     (funcionárias, meses estáticos);
 *   - virou o ano da residência (tabelas 2027 novas).
 * NÃO precisa rodar quando o dono publica um mês das funcionárias pelo app
 * (escalasFuncionarias/{YYYY-MM}) nem quando há troca/ajuste — isso a edge lê
 * do Firestore em tempo real.
 *
 * O teste src/__tests__/functions/apiV1PessoasEscalas.test.js compara este
 * arquivo com src/data/* e FALHA se ele ficou velho.
 *
 * LGPD: os data files têm e-mail pessoal e cargo — aqui sai SÓ id/nome/ano e
 * as tabelas de escala. Whitelist campo a campo; nunca espalhar o objeto.
 *
 * Uso: node scripts/gerar-dados-api-v1.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = resolve(raiz, 'supabase/functions/api-v1/_dados-gerados.ts')
const ARQUIVOS = ['residencia2026', 'plantao2026', 'sobreavisoMaterno2026', 'hospitaisTecnicas2026']

// Os data files importam './residencia2026' sem extensão (Vite aceita, Node não).
// Copia para um diretório temporário como .mjs com os imports corrigidos.
const tmp = mkdtempSync(join(tmpdir(), 'api-v1-dados-'))
let mods
try {
  for (const nome of ARQUIVOS) {
    const src = readFileSync(resolve(raiz, `src/data/${nome}.js`), 'utf8')
    writeFileSync(join(tmp, `${nome}.mjs`), src.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"))
  }
  mods = {}
  for (const nome of ARQUIVOS) mods[nome] = await import(pathToFileURL(join(tmp, `${nome}.mjs`)).href)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

const { RESIDENTES_2026, ROTACOES_2026, formatEstagio } = mods.residencia2026
const { PLANTOES_2026, FERIADOS_2026, FERIADO_LABELS, FERIADO_LABELS_FUNCIONARIAS } = mods.plantao2026
const { FUNCIONARIAS_SOBREAVISO, SOBREAVISO_MATERNO_2026 } = mods.sobreavisoMaterno2026
const { FUNCIONARIAS_HOSPITAIS, HOSPITAIS_2026 } = mods.hospitaisTecnicas2026

const ordenado = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))

const dados = {
  RESIDENTES: RESIDENTES_2026.map((r) => ({ id: r.id, nome: r.nome, ano: r.ano })),
  PLANTOES_RESIDENCIA: ordenado(PLANTOES_2026),
  // Estágio já formatado como o app mostra (getEstagiosParaData → formatEstagio).
  ROTACOES: ROTACOES_2026.map((q) => ({
    inicio: q.inicio,
    fim: q.fim,
    estagios: Object.fromEntries(Object.entries(q.estagios).map(([id, e]) => [id, e ? formatEstagio(e) : null])),
  })),
  FERIADOS_RESIDENCIA: Object.fromEntries([...FERIADOS_2026].sort().map((d) => [d, FERIADO_LABELS[d] ?? null])),
  FERIADOS_FUNCIONARIAS: ordenado(FERIADO_LABELS_FUNCIONARIAS),
  FUNCIONARIAS_SOBREAVISO: FUNCIONARIAS_SOBREAVISO.map((f) => ({ id: f.id, nome: f.nome })),
  FUNCIONARIAS_HOSPITAIS: FUNCIONARIAS_HOSPITAIS.map((f) => ({ id: f.id, nome: f.nome })),
  SOBREAVISO_BASE_ESTATICA: ordenado(SOBREAVISO_MATERNO_2026),
  HOSPITAIS_BASE_ESTATICA: ordenado(Object.fromEntries(
    Object.entries(HOSPITAIS_2026).map(([d, h]) => [d, { hro: h.hro ?? null, unimed: h.unimed ?? null, plantaoPago: h.plantaoPago ?? null }]),
  )),
}

const json = (v) => JSON.stringify(v, null, 2)
const out = `// AUTO-GERADO por scripts/gerar-dados-api-v1.mjs — NÃO EDITAR À MÃO.
// Fonte: src/data/{residencia2026,plantao2026,sobreavisoMaterno2026,hospitaisTecnicas2026}.js
// Sem e-mail nem cargo (LGPD): só id, nome, ano e as tabelas de escala.

export interface Pessoa { id: string; nome: string }
export interface Residente extends Pessoa { ano: string }
export interface Quinzena { inicio: string; fim: string; estagios: Record<string, string | null> }
export interface HospitaisDia { hro: string | null; unimed: string | null; plantaoPago: string | null }

export const RESIDENTES: Residente[] = ${json(dados.RESIDENTES)}

export const PLANTOES_RESIDENCIA: Record<string, string> = ${json(dados.PLANTOES_RESIDENCIA)}

export const ROTACOES: Quinzena[] = ${json(dados.ROTACOES)}

/** Feriados da residência (sáb/dom/feriado = plantão 24h; sem estágio). */
export const FERIADOS_RESIDENCIA: Record<string, string | null> = ${json(dados.FERIADOS_RESIDENCIA)}

/** Feriados das funcionárias (24/12 e 31/12 são dia útil para elas). */
export const FERIADOS_FUNCIONARIAS: Record<string, string> = ${json(dados.FERIADOS_FUNCIONARIAS)}

export const FUNCIONARIAS_SOBREAVISO: Pessoa[] = ${json(dados.FUNCIONARIAS_SOBREAVISO)}

export const FUNCIONARIAS_HOSPITAIS: Pessoa[] = ${json(dados.FUNCIONARIAS_HOSPITAIS)}

/** dateKey → funcionariaId. Meses publicados no app (escalasFuncionarias) substituem o mês inteiro. */
export const SOBREAVISO_BASE_ESTATICA: Record<string, string> = ${json(dados.SOBREAVISO_BASE_ESTATICA)}

/** dateKey → NOMES por slot (a base de hospitais guarda nome, não id). */
export const HOSPITAIS_BASE_ESTATICA: Record<string, HospitaisDia> = ${json(dados.HOSPITAIS_BASE_ESTATICA)}
`

writeFileSync(DESTINO, out)
console.log(`Gerado: ${DESTINO}`)
console.log(`  residentes ${dados.RESIDENTES.length} · plantões ${Object.keys(dados.PLANTOES_RESIDENCIA).length} · quinzenas ${dados.ROTACOES.length}`)
console.log(`  sobreaviso ${Object.keys(dados.SOBREAVISO_BASE_ESTATICA).length} dias · hospitais ${Object.keys(dados.HOSPITAIS_BASE_ESTATICA).length} dias`)
