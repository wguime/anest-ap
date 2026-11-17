/**
 * api-v1 — /v1/escala-numerica, /v1/feriados e /v1/plantoes (nov/2026).
 *
 * Trava:
 *  1. as cópias em supabase/functions/api-v1/_lib-numerica/ estão em dia com src/ (gerador --check);
 *  2. PARIDADE com a tela: a vista da API é a da lib que a EscalaNumericaPage usa
 *     (montarVistaNumerica de src/lib) e a fila do feriado é a da FeriadosPage
 *     (filasDoFeriado + trocas aceitas) — mesma ordem, mesma situação;
 *  3. identidade: nome da legenda → id de /v1/anestesistas; ambíguo = null;
 *  4. LGPD: observação sem autor, troca sem uid de quem respondeu, PP sem campo cru.
 *     Motivo de licença, observação e justificativa SAEM (decisão do dono, dado sensível).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dados from '../../data/escalaNumerica.json'
import { montarVistaNumerica } from '../../lib/escalaNumericaVista'
import { filasDoFeriado } from '../../lib/trocasFeriado'
import { CADASTRO_LEGENDA } from '../../lib/escalaNumerica'
import { situacao } from '../../pages/escala-numerica/situacao'
import { DESTINO, gerarTodos } from '../../../scripts/gerar-libs-numerica-api-v1.mjs'
import {
  comporDiaNumerica,
  comporFeriados,
  criarIdentificador,
  plantoesPorData,
  rotaEscalaNumerica,
} from '../../../supabase/functions/api-v1/_escala-numerica.ts'
import { comporPlantoesPP } from '../../../supabase/functions/api-v1/_plantoes-pp.ts'

// _firestore.ts importa o jose por URL (https:) — o Node não carrega; a rota de feriados
// só precisa de listarColecao, simulada aqui.
vi.mock('../../../supabase/functions/api-v1/_firestore.ts', () => ({ listarColecao: vi.fn(async () => ({})) }))

const PESSOAS = [
  { id: 'uid-melo', nome: 'GUILHERME SOUZA MELO', apelidos: ['MELO'], ativo: true },
  { id: 'uid-romulo', nome: 'ROMULO SANTOS ROXO', apelidos: ['ROMULO'], ativo: true },
  { id: 'uid-karine', nome: 'KARINE BEDIN', apelidos: ['KARINE'], ativo: true },
  { id: 'uid-humberto', nome: 'HUMBERTO HEPP', apelidos: ['HUMBERTO'], ativo: true },
  { id: 'uid-roberta', nome: 'ROBERTA MARINA GRANDO', apelidos: ['ROBERTA'], ativo: true },
  { id: 'uid-oscar', nome: 'OSCAR MORAIS', apelidos: ['OSCAR', 'OSCAR AUGUSTO DE OLIVEIRA MORAIS'], ativo: true },
]
const IDENT = criarIdentificador(PESSOAS)

describe('api-v1 numérica — cópias geradas', () => {
  it('_lib-numerica está em dia com src/ (rode scripts/gerar-libs-numerica-api-v1.mjs)', () => {
    for (const { arquivo, conteudo } of gerarTodos()) {
      const alvo = resolve(DESTINO, arquivo)
      expect(existsSync(alvo), `${arquivo} não gerado`).toBe(true)
      expect(readFileSync(alvo, 'utf8') === conteudo, `${arquivo} desatualizado`).toBe(true)
    }
  })
})

describe('api-v1 /v1/escala-numerica — paridade com a tela', () => {
  const D = '2026-11-04' // quarta, Louise inserida na tarde da Unimed
  const FERIAS = ['DIEGO BONIATTI RIGOTTI']
  const AUSENTES = ['FERNANDA GUOLLO']
  // Karine fez o P2 (Unimed) e a numérica a põe no HRO → sobe de card e deixa lugar vago
  const NOTURNOS = { hro: 'ROMULO SANTOS ROXO', unimed: 'KARINE BEDIN' }
  const pp = {
    ferias: FERIAS.map((nome) => ({ nome, data: D })),
    licencas: AUSENTES.map((nome) => ({ nome, data: D })),
    porData: new Map(),
    disponivel: true,
  }
  const observacoes = new Map([[`${D}|matutino|hro`, { texto: 'sala 3 fechada', atualizado_em: '2026-11-03T20:00:00Z' }]])
  const api = comporDiaNumerica({ data: D, pp, noturnos: NOTURNOS, observacoes, ident: IDENT })

  it.each(['matutino', 'vespertino'])('%s: mesma ordem e mesma situação da tela', (turno) => {
    const tela = montarVistaNumerica(dados, D, turno, FERIAS, NOTURNOS, AUSENTES)
    const t = api.turnos.find((x) => x.turno === turno)
    const SIT = { ferias: 'ferias', ausente: 'ausente', pos: 'pos_plantao', noite: 'plantao_noturno' }
    for (const b of tela.blocos) {
      const h = t.hospitais.find((x) => x.hospital === b.hospital)
      expect(h.lista.map((l) => [l.posicao, l.nome_legenda, l.situacao])).toEqual(
        b.lista.map((p) => [p.lugarVago ? null : p.posicao, p.nome, p.lugarVago ? 'lugar_vago' : (situacao(p) ? SIT[situacao(p)] : null)]),
      )
    }
    expect(t.consultorio.lista.map((l) => l.nome_legenda)).toEqual(tela.consultorio.map((c) => c.nome))
  })

  it('a fixture exercita férias, ausente, plantão da noite, pós-plantão, lugar vago e Louise', () => {
    const tudo = api.turnos.flatMap((t) => t.hospitais.flatMap((h) => h.lista))
    const sits = new Set(tudo.map((l) => l.situacao))
    for (const s of ['ferias', 'ausente', 'plantao_noturno', 'pos_plantao', 'lugar_vago']) expect(sits.has(s), s).toBe(true)
    expect(tudo.some((l) => l.nome_legenda === 'LOUISE' && l.inserida)).toBe(true)
  })

  it('identidade pela legenda (MELO → cadastro), dupla rende duas pessoas, observação sem autor', () => {
    const hro = api.turnos[0].hospitais.find((h) => h.hospital === 'hro')
    expect(hro.lista.find((l) => l.nome_legenda === 'MELO').anestesistas).toEqual([{ id: 'uid-melo', nome: 'GUILHERME SOUZA MELO' }])
    const unimed = api.turnos[0].hospitais.find((h) => h.hospital === 'unimed')
    expect(unimed.lista.find((l) => l.numero === '05').anestesistas.map((p) => p.id)).toEqual(['uid-humberto', 'uid-roberta'])
    expect(hro.observacao).toEqual({ texto: 'sala 3 fechada', atualizado_em: '2026-11-03T20:00:00Z' })
    expect(typeof hro.trabalhando).toBe('number')
    expect(api.turnos[0].hospitais.find((h) => h.hospital === 'materno').trabalhando).toBeNull()
  })

  it('feriado = fila única; fim de semana = postos do sábado; fora da vigência', () => {
    const fer = comporDiaNumerica({ data: '2026-11-20', pp, noturnos: {}, observacoes: new Map(), ident: IDENT })
    expect(fer.tipo).toBe('feriado')
    expect(fer.turnos[0].lista.length).toBeGreaterThan(15)
    const sab = new Map([['2026-11-07', [{ nome: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS', setor: 'P2', horario: '07:00', horarioFim: '19:00' }, { nome: 'ROMULO SANTOS ROXO', setor: 'P1', horario: '07:00', horarioFim: '19:00' }]]])
    const dom = comporDiaNumerica({ data: '2026-11-08', pp: { ...pp, porData: sab }, noturnos: {}, observacoes: new Map(), ident: IDENT })
    expect(dom.tipo).toBe('fim_de_semana')
    expect(dom.sabado_referencia).toBe('2026-11-07')
    expect(dom.fim_de_semana.map((f) => [f.posicao, f.anestesista.id])).toEqual([['P1', 'uid-romulo'], ['P2', 'uid-oscar']])
    expect(comporDiaNumerica({ data: '2027-03-03', pp, noturnos: {}, observacoes: new Map(), ident: IDENT }).tipo).toBe('fora_da_vigencia')
  })

  it('plantoesPorData espelha getPlantoesPorData (setor Pn, HH:MM, sem férias)', () => {
    const m = plantoesPorData([
      { Setor: 'E10 - P10', Inicio: '2026-11-07T07:00:00', Fim: '2026-11-07T19:00:00', ProfDePlantao: 'A' },
      { Setor: 'Férias', Inicio: '2026-11-07T07:00:00', ProfFixo: 'B' },
      { Setor: '1 - P1', Inicio: '2026-11-06T19:00:00', Fim: '2026-11-07T07:00:00', ProfFixo: 'C' },
    ])
    expect(m.get('2026-11-07')).toEqual([{ nome: 'A', setor: 'P10', horario: '07:00', horarioFim: '19:00' }])
    expect(m.get('2026-11-06')).toEqual([{ nome: 'C', setor: 'P1', horario: '19:00', horarioFim: '07:00' }])
  })
})

describe('api-v1 /v1/feriados — fila efetiva e trocas', () => {
  const D = '2026-11-20'
  const fila = filasDoFeriado(dados, D, []).matutino
  const [a, b] = [fila[0], fila[1]]
  const TROCAS = [
    { codigo: 'FR1', status: 'aceita', escopo: 'posicao', feriadoData: D, feriadoNome: 'Consciência Negra', solicitanteUid: 'uid-x', solicitanteNome: a.nome, solicitanteNumero: a.numero, destinatarioUid: null, destinatarioNome: b.nome, destinatarioNumero: b.numero, descricao: 'compromisso de família', criadoEm: '2026-10-01T10:00:00Z', respostaEm: '2026-10-02T10:00:00Z', respondidoPorUid: 'uid-segredo' },
    { codigo: 'FR2', status: 'pendente', escopo: 'data', feriadoData: D, feriadoDesejado: '2026-11-02', solicitanteUid: 'uid-melo', solicitanteNome: 'MELO', destinatarioNome: 'OSCAR', descricao: 'viagem', criadoEm: '2026-10-05T10:00:00Z' },
    { codigo: 'FR3', status: 'rejeitada', escopo: 'posicao', feriadoData: D, solicitanteNome: 'X', destinatarioNome: 'Y', descricao: 'motivo recusado', criadoEm: '2026-10-06T10:00:00Z', respostaEm: '2026-10-07T10:00:00Z' },
    { codigo: 'FR4', status: 'aceita', escopo: 'posicao', feriadoData: '2025-11-20', solicitanteNome: 'X', destinatarioNome: 'Y', criadoEm: '2025-10-01T10:00:00Z' },
  ]
  const c = fila[3] // de férias no feriado (nome completo do cadastro, como vem do PP)
  const pp = { ferias: [{ nome: CADASTRO_LEGENDA[c.nome][0], data: D }], licencas: [], porData: new Map(), disponivel: true }
  const out = comporFeriados({ ano: 2026, trocas: TROCAS, pp, ident: IDENT })

  it('fila do feriado = filasDoFeriado com as trocas ACEITAS (a da tela)', () => {
    const f = out.feriados.find((x) => x.data === D)
    const tela = filasDoFeriado(dados, D, TROCAS.filter((t) => t.status === 'aceita'))
    expect(f.fila.matutino.map((l) => [l.posicao, l.nome_legenda, l.trocado])).toEqual(tela.matutino.map((p) => [p.posicao, p.nome, Boolean(p.trocado)]))
    expect(f.fila.vespertino.map((l) => l.nome_legenda)).toEqual(tela.vespertino.map((p) => p.nome))
    expect(f.fila.matutino[0].nome_legenda).toBe(b.nome) // a troca de posição foi aplicada
    expect(out.feriados.length).toBe(Object.keys(dados.feriados.dias).length)
  })

  it('férias marcadas no feriado, como a FeriadosPage', () => {
    const f = out.feriados.find((x) => x.data === D)
    const linha = f.fila.matutino.find((l) => l.nome_legenda === c.nome)
    expect(linha.situacao).toBe('ferias')
    expect(f.fila.matutino.filter((l) => l.situacao === 'ferias')).toHaveLength(1)
  })

  it('trocas do ano em qualquer status, com justificativa e sem uid de quem respondeu', () => {
    expect(out.trocas.map((t) => [t.codigo, t.status])).toEqual([['FR1', 'aceita'], ['FR2', 'pendente'], ['FR3', 'rejeitada']])
    const fr2 = out.trocas.find((t) => t.codigo === 'FR2')
    expect(fr2.justificativa).toBe('viagem')
    expect(fr2.de).toEqual({ id: 'uid-melo', nome: 'GUILHERME SOUZA MELO' })
    expect(fr2.para).toEqual({ id: 'uid-oscar', nome: 'OSCAR MORAIS' })
    expect(fr2.feriado_desejado.data).toBe('2026-11-02')
    expect(out.trocas.find((t) => t.codigo === 'FR1').decidida_em).toBe('2026-10-02T10:00:00Z')
    expect(JSON.stringify(out)).not.toContain('uid-segredo')
  })

  it('ano sem escala de feriados → listas vazias', () => {
    expect(comporFeriados({ ano: 2030, trocas: TROCAS, pp, ident: IDENT })).toEqual({ feriados: [], trocas: [] })
  })
})

describe('api-v1 /v1/plantoes — registros do PP', () => {
  const REG = [
    { Setor: '2- P2', Tipo: 'Noturno', Inicio: '2026-11-10T19:00:00', Fim: '2026-11-11T07:00:00', ProfDePlantao: 'ROMULO SANTOS ROXO', CpfProfDePlantao: '000.000.000-00', Valor: 1234, ComentarioInterno: 'interno', Descricao: 'desc' },
    { Setor: '1 - P1', Tipo: 'Noturno', Inicio: '2026-11-10T19:00:00', Fim: '2026-11-11T07:00:00', ProfFixo: 'KARINE BEDIN' },
    { Setor: 'LICENÇA SAÚDE', Tipo: 'Licença', Inicio: '2026-11-10T07:00:00', Fim: '2026-11-10T19:00:00', ProfDePlantao: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS' },
    { Setor: 'Férias', Tipo: 'Férias', Inicio: '2026-11-10T07:00:00', ProfDePlantao: 'GUILHERME SOUZA MELO' },
    { Setor: '1 - P1', Inicio: '2026-11-12T19:00:00', ProfDePlantao: 'FORA' },
  ]
  const [dia] = comporPlantoesPP({ registros: REG, pessoas: PESSOAS, inicio: '2026-11-10', fim: '2026-11-10' })

  it('plantões ordenados por posto, licença com motivo no fim, férias fora', () => {
    expect(dia.plantoes.map((p) => [p.posicao, p.anestesista.id, p.licenca, p.motivo])).toEqual([
      ['P1', 'uid-karine', false, null],
      ['P2', 'uid-romulo', false, null],
      [null, 'uid-oscar', true, 'LICENÇA SAÚDE'],
    ])
    expect(dia.plantoes[0].inicio).toBe('2026-11-10T19:00:00-03:00')
  })

  it('nenhum campo cru do PP (CPF, valor, comentário, descrição)', () => {
    const txt = JSON.stringify(dia)
    expect(txt).not.toMatch(/000\.000|1234|interno|desc|Cpf|Valor|Comentario|Descricao/)
  })
})

// ─── Rota inteira com PP e banco simulados ──────────────────────────────────

function fakeSupabase(tabelas) {
  return {
    from(tabela) {
      const q = {
        select: () => q, eq: () => q, in: () => q, gte: () => q, lte: () => q, order: () => q, range: () => q,
        then: (res, rej) => Promise.resolve({ data: tabelas[tabela] ?? [], error: null }).then(res, rej),
      }
      return q
    },
  }
}

describe('api-v1 /v1/escala-numerica — rota', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: () => 'configurado' } })
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
      return new Response(JSON.stringify([
        { Setor: '2- P2', Inicio: '2026-11-09T19:00:00', Fim: '2026-11-10T07:00:00', ProfDePlantao: 'KARINE BEDIN' },
      ]), { status: 200 })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('segunda lê a noite de domingo do documento de FDS; observação sem autor', async () => {
    const r = await rotaEscalaNumerica({
      supabase: fakeSupabase({
        vw_api_anestesistas: PESSOAS,
        escala_numerica_observacao: [
          { data: '2026-11-09', turno: 'vespertino', hospital: 'unimed', texto: 'recado', atualizado_em: '2026-11-09T12:00:00Z', autor_nome: 'NAO SAI', autor_id: 'NAO SAI' },
          { data: '2026-11-09', turno: 'matutino', hospital: 'hro', texto: '', atualizado_em: null },
        ],
        escala_cirurgica: [{ data: '2026-11-08', fds_meta: { grade: { '19-07': { hro: 'ROMULO', unimed: '' } } } }],
      }),
      url: new URL('https://x/v1/escala-numerica?inicio=2026-11-09&fim=2026-11-10'),
      pathname: '/v1/escala-numerica',
    })
    expect(r.status).toBe(200)
    const [seg, ter] = r.body.data
    expect(seg.tipo).toBe('dia_util')
    const hroSeg = seg.turnos[0].hospitais.find((h) => h.hospital === 'hro')
    expect(hroSeg.lista[1]).toMatchObject({ nome_legenda: 'ROMULO', situacao: 'plantao_noturno', posto_plantao: 'P1' })
    expect(hroSeg.observacao).toBeNull() // texto vazio = apagado
    expect(seg.turnos[1].hospitais.find((h) => h.hospital === 'unimed').observacao).toEqual({ texto: 'recado', atualizado_em: '2026-11-09T12:00:00Z' })
    // terça: a noite de segunda vem do Pega Plantão (P2 = Karine sobe na Unimed)
    const unimedTer = ter.turnos[0].hospitais.find((h) => h.hospital === 'unimed')
    expect(unimedTer.lista[1]).toMatchObject({ nome_legenda: 'KARINE', situacao: 'plantao_noturno', posto_plantao: 'P2' })
    expect(JSON.stringify(r.body)).not.toContain('NAO SAI')
    expect(r.body.meta.ferias_conferidas).toBe(true)
  })

  it('parâmetro inválido devolve 400', async () => {
    const r = await rotaEscalaNumerica({ supabase: fakeSupabase({}), url: new URL('https://x/v1/escala-numerica'), pathname: '/v1/escala-numerica' })
    expect(r.status).toBe(400)
  })
})
