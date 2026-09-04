/**
 * Store do lote (Onda 2, item 2.1; audit A2/A3): uma fonte de verdade por lote, com a
 * LEITURA separada do TRABALHO. O que estas travas protegem: leitura nova zera SÓ o trabalho
 * daquele hospital; tirar um hospital leva o trabalho dele junto; trocar data/período não
 * apaga trabalho nenhum (só as decisões, que são do dia); o rascunho volta inteiro; e um
 * updater que não muda nada não muda a identidade do estado (senão as abas entram em laço).
 */
import { describe, it, expect } from 'vitest'
import {
  estadoInicialLote, reduzirLote, hospitaisDoLote, abaDoLote, hospitaisParaRascunho,
} from '@/lib/escalaLoteStore'
import { TRABALHO_VAZIO } from '@/pages/escala-cirurgica/trabalhoConferencia'

const leitura = (h, rows = [{ _lid: `${h}-1`, sala: 'Sala 1', anestesista: 'CURY' }]) => ({
  hospital: h, nome: `${h}.png`, truncado: false, lote: { rows, posicoes: [], ordemLiberacao: ['CURY'], ajudaExterna: [] },
})
const comLote = () => reduzirLote(estadoInicialLote(), { type: 'leituras_recebidas', itens: { hro: leitura('hro'), materno: leitura('materno') } })
const trabalho = (extra = {}) => ({ ...TRABALHO_VAZIO, ordemTexto: 'CURY, PAULO', ...extra })

describe('leitura × trabalho', () => {
  it('leituras entram na ordem canônica das abas e a primeira vira a aba ativa', () => {
    const e = comLote()
    expect(hospitaisDoLote(e)).toEqual(['hro', 'materno'])
    expect(abaDoLote(e)).toBe('hro')
    expect(e.leitura.hro.hospital).toBe('hro')
  })

  it('leitura nova do MESMO hospital zera só o trabalho dele; o do vizinho fica', () => {
    let e = comLote()
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: () => trabalho() })
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'materno', updater: () => trabalho({ ordemTexto: 'PAULO' }) })
    e = reduzirLote(e, { type: 'publicados_definidos', updater: ['hro'] })
    e = reduzirLote(e, { type: 'leituras_recebidas', itens: { hro: leitura('hro', [{ _lid: 'hro-9', sala: 'Sala 9', anestesista: 'PAULO' }]) } })
    expect(e.trabalho.hro).toBeUndefined()
    expect(e.trabalho.materno.ordemTexto).toBe('PAULO')
    expect(e.leitura.hro.lote.rows[0]._lid).toBe('hro-9')
    // relido não está mais "publicado" com a leitura antiga
    expect(e.publicados).toEqual([])
  })

  it('tirar um hospital do lote leva leitura, trabalho e "publicado" dele', () => {
    let e = comLote()
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: () => trabalho() })
    e = reduzirLote(e, { type: 'publicados_definidos', updater: ['hro', 'materno'] })
    e = reduzirLote(e, { type: 'leitura_removida', hospital: 'hro' })
    expect(hospitaisDoLote(e)).toEqual(['materno'])
    expect(e.trabalho.hro).toBeUndefined()
    expect(e.publicados).toEqual(['materno'])
    expect(abaDoLote(e)).toBe('materno')
  })

  it('updater que devolve o mesmo trabalho não muda o estado (identidade preservada)', () => {
    let e = comLote()
    const t = trabalho()
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: () => t })
    const igual = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: (atual) => atual })
    expect(igual).toBe(e)
    const mesmoDecisoes = reduzirLote(e, { type: 'decisoes_definidas', updater: (d) => d })
    expect(mesmoDecisoes).toBe(e)
  })

  it('trocar data/período zera as decisões do dia e NADA mais', () => {
    let e = comLote()
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: () => trabalho() })
    e = reduzirLote(e, { type: 'decisoes_definidas', updater: { 'uid-cury': { tipo: 'intencional' } } })
    e = reduzirLote(e, { type: 'trocas_definidas', updater: (p) => ({ ...p, 'uid-cury': 'uid-paulo' }) })
    e = reduzirLote(e, { type: 'contexto_mudou' })
    expect(e.decisoes).toEqual({})
    expect(e.trocas).toEqual({})
    expect(e.trabalho.hro.ordemTexto).toBe('CURY, PAULO')
    expect(hospitaisDoLote(e)).toEqual(['hro', 'materno'])
  })

  it('aba ativa cai para a primeira quando a escolhida saiu do lote', () => {
    let e = reduzirLote(comLote(), { type: 'aba_definida', updater: 'materno' })
    expect(abaDoLote(e)).toBe('materno')
    e = reduzirLote(e, { type: 'leitura_removida', hospital: 'materno' })
    expect(abaDoLote(e)).toBe('hro')
  })
})

describe('rascunho — ida e volta pelo store', () => {
  it('o rascunho restaurado devolve o lote inteiro; o descarte volta ao zero', () => {
    let e = comLote()
    e = reduzirLote(e, { type: 'trabalho_atualizado', hospital: 'hro', updater: () => trabalho() })
    e = reduzirLote(e, { type: 'decisoes_definidas', updater: { 'uid-cury': { tipo: 'intencional' } } })
    e = reduzirLote(e, { type: 'publicados_definidos', updater: ['materno'] })
    e = reduzirLote(e, { type: 'aba_definida', updater: 'materno' })
    const hospitais = hospitaisParaRascunho(e, { hro: { publicadaAtualizadaEm: '2026-09-04T11:00:00.000Z' } })
    expect(hospitais.hro.escalaPublicadaUpdatedAt).toBe('2026-09-04T11:00:00.000Z')
    expect(hospitais.materno.trabalho).toBeNull()

    const volta = reduzirLote(estadoInicialLote(), {
      type: 'rascunho_restaurado',
      rascunho: { hospitais, decisoes: e.decisoes, trocas: e.trocas, publicados: e.publicados, abaAtiva: e.abaAtiva },
    })
    expect(hospitaisDoLote(volta)).toEqual(['hro', 'materno'])
    expect(volta.trabalho.hro.ordemTexto).toBe('CURY, PAULO')
    expect(volta.trabalho.materno).toBeUndefined()
    expect(volta.decisoes).toEqual({ 'uid-cury': { tipo: 'intencional' } })
    expect(volta.publicados).toEqual(['materno'])
    expect(abaDoLote(volta)).toBe('materno')

    expect(reduzirLote(volta, { type: 'lote_descartado' })).toEqual(estadoInicialLote())
  })

  it('rascunho sem hospital válido não mexe no estado; hospital desconhecido é ignorado', () => {
    const e = comLote()
    expect(reduzirLote(e, { type: 'rascunho_restaurado', rascunho: { hospitais: {} } })).toBe(e)
    const volta = reduzirLote(estadoInicialLote(), { type: 'rascunho_restaurado', rascunho: { hospitais: { fds: { lido: leitura('fds') }, hro: { lido: leitura('hro') } } } })
    expect(hospitaisDoLote(volta)).toEqual(['hro'])
  })

  it('ação desconhecida devolve o mesmo estado', () => {
    const e = comLote()
    expect(reduzirLote(e, { type: 'nada' })).toBe(e)
    expect(reduzirLote(e, null)).toBe(e)
  })
})
