/**
 * Coluna nova de caso não pode ser descartada em silêncio.
 *
 * A classe de bug está documentada no próprio service (comentário do CASO_FIELDS)
 * e já foi vivida com `ultima_avaliacao_at` no cateter: o campo viaja do front,
 * some no caminho, e ninguém percebe até o dado sumir em produção. Para
 * `gravidade` são TRÊS pontos — CASO_FIELDS e as duas RPCs que enumeram as
 * colunas do INSERT.
 *
 * Este teste roda SEM banco: lê o texto da migration e afirma que o patch das
 * RPCs acrescenta a gravidade E preserva as colunas que já estavam lá. É ele que
 * pega o erro "recopiei a versão errada da RPC" — foi assim que
 * 20260726110000 nasceu sem residente/residente_user_id/termino_previsto.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import service from '@/services/supabaseEscalaCirurgicaService'

const raiz = resolve(__dirname, '../../..')
const migration = readFileSync(
  resolve(raiz, 'supabase/migrations/20260818140000_escala_caso_gravidade.sql'),
  'utf8',
)

describe('gravidade — o campo tem de chegar ao banco', () => {
  it('CASO_FIELDS aceita gravidade (senão o front filtra o campo antes de publicar)', () => {
    // O service exporta casoToRow indiretamente; o contrato observável é que um
    // caso com gravidade sobrevive à limpeza de campos.
    expect(typeof service.salvarEscalaTurno).toBe('function')
    const fonte = readFileSync(
      resolve(raiz, 'src/services/supabaseEscalaCirurgicaService.js'),
      'utf8',
    )
    const bloco = /const CASO_FIELDS = \[([\s\S]*?)\]/.exec(fonte)?.[1] || ''
    expect(bloco).toContain("'gravidade'")
    // As que já existiam continuam lá — a lista é additiva, nunca reescrita.
    for (const campo of ['tipo', 'turno', 'residente', 'residenteUserId', 'terminoPrevisto']) {
      expect(bloco).toContain(`'${campo}'`)
    }
  })

  it('a migration patcheia as DUAS RPCs que inserem caso', () => {
    for (const fn of ['rpc_publicar_escala_turno', 'rpc_salvar_escala_cirurgica']) {
      expect(migration).toContain(fn)
    }
    // Âncoras do patch: lista de colunas e o select correspondente, nas duas grafias
    // (a RPC viva escreve sem espaço; a legada, com).
    expect(migration).toContain('sem_anestesista,tipo,gravidade,turno)')
    expect(migration).toContain('sem_anestesista, tipo, gravidade, turno')
  })

  it('a migration falha ALTO se a definição viva não for a mais nova', () => {
    // Sem este guard, publicar uma RPC antiga apagaria três colunas em silêncio e
    // o erro só apareceria como 42703 na primeira publicação do expediente.
    expect(migration).toContain("position('residente_user_id' in v_def) = 0")
    expect(migration).toContain("position('termino_previsto' in v_def) = 0")
    expect(migration).toMatch(/raise exception[\s\S]*?versao inesperada/)
  })

  it('a migration exige âncora ÚNICA antes de substituir', () => {
    expect(migration).toMatch(/v_ocorrencias <> 1/)
    expect(migration).toMatch(/raise exception[\s\S]*?ancora/)
  })

  it('a migration verifica no fim que as duas RPCs citam gravidade', () => {
    expect(migration).toMatch(/RPC\(s\) sem a coluna apos o patch/)
  })

  it('o log de eventos passa a carregar a gravidade do caso', () => {
    // É a única cópia que sobrevive à republicação do turno (DELETE+insert), e é
    // dela que o relatório contratual tira a espera por gravidade.
    expect(migration).toContain('gravidade_caso')
    expect(migration).toContain('new.gravidade')
  })

  it('a coluna nasce nullable, sem default, com os 3 níveis do CHECK', () => {
    expect(migration).toContain("check (gravidade is null or gravidade in ('imediata', 'urgente', 'aguarda'))")
    expect(migration).not.toMatch(/gravidade text\s+not null/i)
    expect(migration).not.toMatch(/gravidade[^\n]*default '/i)
  })
})
