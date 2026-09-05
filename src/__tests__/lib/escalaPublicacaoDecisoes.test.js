/**
 * As decisões da conferência viajam DENTRO da publicação (Onda 3, item 3.1).
 *
 * O que estas travas protegem: (1) republicar o mesmo turno preserva, de quem
 * segue na escala, o rastro — e NÃO a liberação (dono 05/09); (2) a troca
 * declarada vai para a escala da vaga obsoleta, e só ela; (3) "intencional" é
 * gravado onde a pessoa aparece e é lido de volta da escala publicada.
 */
import { describe, expect, it } from 'vitest'
import {
  CAMPOS_RASTRO, linhasPresentes, montarPreservacao, montarLinhaOverrides, decisoesPublicadas,
} from '@/lib/escalaPublicacaoDecisoes'

const normalizar = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase()
const resolver = (nome) => ({ DIDO: 'uid-dido', PAULO: 'uid-paulo', 'GUILHERME XAVIER': 'uid-dido' }[normalizar(nome)] || null)

describe('linhasPresentes — a chave é a da fila, com as grafias alternativas', () => {
  it('nome com vínculo vira uid; o nome normalizado fica como candidata', () => {
    const m = linhasPresentes({ ordem: ['DIDO', 'MATHEUS (CONSULT)'], resolver, normalizar })
    expect(m.get('uid-dido')).toMatchObject({ chave: 'uid-dido', candidatas: ['DIDO'], posicao: 0 })
    // sem vínculo: a chave é o nome SEM a nota de local
    expect(m.get('MATHEUS')).toMatchObject({ chave: 'MATHEUS', candidatas: [], posicao: 1 })
  })

  it('caso com uid entra pelo uid; "//", "?" e "A + B" não são pessoa', () => {
    const m = linhasPresentes({
      casos: [
        { anestesista: 'GABI', anestesistaUserId: 'uid-gabi' },
        { anestesista: '//' }, { anestesista: '?' }, { anestesista: 'ANA + BIA' },
      ],
      resolver, normalizar,
    })
    expect([...m.keys()]).toEqual(['uid-gabi'])
    expect(m.get('uid-gabi').candidatas).toEqual(['GABI'])
  })
})

describe('montarPreservacao — o que a RPC copia do override antigo', () => {
  const existente = { ordemLiberacao: { matutino: ['DIDO', 'PAULO', 'NATHALIA'] } }

  it('sem escala publicada não há o que preservar', () => {
    expect(montarPreservacao({ existente: null, turno: 'matutino', ordem: ['DIDO'], resolver, normalizar })).toBeNull()
  })

  it('preserva o RASTRO de quem segue na escala e nunca pede a liberação (dono 05/09)', () => {
    const p = montarPreservacao({ existente, turno: 'matutino', ordem: ['PAULO', 'DIDO'], ajuda: ['CURY'], resolver, normalizar })
    expect(p.campos).toEqual([...CAMPOS_RASTRO])
    expect(p.campos).toEqual(expect.arrayContaining(['trocaCom', 'assumidaPor', 'origem', 'observacao', 'local', 'termino']))
    expect(p.linhas).toEqual([
      { chave: 'uid-paulo', candidatas: ['PAULO'] },
      { chave: 'uid-dido', candidatas: ['DIDO'] },
      { chave: 'CURY' },
    ])
    expect(p.linhas.some((l) => 'liberacao' in l)).toBe(false)
  })

  it('quem saiu da ordem não entra na lista — o rastro dele vai embora com a republicação', () => {
    const p = montarPreservacao({ existente, turno: 'matutino', ordem: ['DIDO'], resolver, normalizar })
    expect(p.linhas.map((l) => l.chave)).toEqual(['uid-dido'])
  })

  it('regra alternativa "mesma_posicao": só quem continua no mesmo lugar leva a liberação', () => {
    const p = montarPreservacao({
      existente, turno: 'matutino', ordem: ['DIDO', 'NATHALIA', 'PAULO'], resolver, normalizar, regraLiberacao: 'mesma_posicao',
    })
    expect(p.linhas.find((l) => l.chave === 'uid-dido').liberacao).toBe(true)     // 1º nos dois
    expect(p.linhas.find((l) => l.chave === 'uid-paulo').liberacao).toBeUndefined() // era 2º, agora 3º
    expect(p.linhas.find((l) => l.chave === 'NATHALIA').liberacao).toBeUndefined()
  })

  it('regra alternativa "na_ordem": quem continua no rodapé leva a liberação em qualquer posição', () => {
    const p = montarPreservacao({
      existente, turno: 'matutino', ordem: ['PAULO', 'DIDO', 'CURY'], resolver, normalizar, regraLiberacao: 'na_ordem',
    })
    expect(p.linhas.find((l) => l.chave === 'uid-paulo').liberacao).toBe(true)
    expect(p.linhas.find((l) => l.chave === 'CURY').liberacao).toBeUndefined() // não estava
  })
})

describe('montarLinhaOverrides — as decisões que valem NESTA escala', () => {
  const decisaoTroca = { tipo: 'troca', parceiroUid: 'uid-paulo', parceiroNome: 'PAULO TONINI', chave: 'uid-dido', uid: 'uid-dido', nomeNorm: 'DIDO' }

  it('troca declarada vira trocaCom na chave da pessoa, tipo entre_hospitais, com o carimbo interno', () => {
    const o = montarLinhaOverrides({
      decisoes: { 'uid-dido': decisaoTroca }, hospital: 'unimed',
      ordem: ['DIDO'], resolver, normalizar, carimbo: { por: 'u-sec', em: '2026-09-05T15:00:00.000Z' },
    })
    expect(o).toEqual({
      'uid-dido': { trocaCom: { uid: 'uid-paulo', nome: 'PAULO TONINI', tipo: 'entre_hospitais', por: 'u-sec', em: '2026-09-05T15:00:00.000Z' } },
    })
  })

  it('a pessoa não está nesta escala → nada é gravado aqui (o órfão de A3 não nasce)', () => {
    const o = montarLinhaOverrides({ decisoes: { 'uid-dido': decisaoTroca }, hospital: 'materno', ordem: ['PAULO'], resolver, normalizar })
    expect(o).toEqual({})
  })

  it('com hospitalVaga a troca só vai para a escala da vaga obsoleta, mesmo com a pessoa nas duas', () => {
    const d = { ...decisaoTroca, hospitalVaga: 'unimed' }
    expect(montarLinhaOverrides({ decisoes: { 'uid-dido': d }, hospital: 'hro', casos: [{ anestesista: 'DIDO' }], resolver, normalizar })).toEqual({})
    expect(Object.keys(montarLinhaOverrides({ decisoes: { 'uid-dido': d }, hospital: 'unimed', ordem: ['DIDO'], resolver, normalizar }))).toEqual(['uid-dido'])
  })

  it('intencional é gravado onde a pessoa aparece, pela chave da linha', () => {
    const o = montarLinhaOverrides({
      decisoes: { 'uid-dido': { tipo: 'intencional', chave: 'uid-dido', uid: 'uid-dido', nomeNorm: 'DIDO' } },
      hospital: 'hro', casos: [{ anestesista: 'DIDO', anestesistaUserId: 'uid-dido' }], resolver, normalizar,
    })
    expect(o).toEqual({ 'uid-dido': { duplicidade: 'intencional' } })
  })

  it('decisão respondida pelo NOME antes de o dicionário aprender o login cai na chave nova (uid)', () => {
    const o = montarLinhaOverrides({
      decisoes: { JOAO: { tipo: 'intencional', chave: 'JOAO', uid: null, nomeNorm: 'JOAO' } },
      hospital: 'hro', ordem: ['JOAO'],
      resolver: (n) => (normalizar(n) === 'JOAO' ? 'uid-joao' : null), normalizar,
    })
    expect(o).toEqual({ 'uid-joao': { duplicidade: 'intencional' } })
  })

  it('"está certo, fica Livre" vira conferido: true', () => {
    const o = montarLinhaOverrides({ conferidos: { NATHALIA: true }, hospital: 'hro', ordem: ['NATHALIA'], resolver, normalizar })
    expect(o).toEqual({ NATHALIA: { conferido: true } })
  })
})

describe('decisoesPublicadas — o que a escala publicada já sabe', () => {
  it('lê só o turno pedido e só os campos de decisão', () => {
    const lo = {
      'matutino:uid-dido': { duplicidade: 'intencional', por: 'x' },
      'matutino:NATHALIA': { conferido: true },
      'matutino:uid-paulo': { observacao: 'nada de decisão' },
      'vespertino:uid-dido': { duplicidade: 'intencional' },
      'uid-legado': { duplicidade: 'intencional' },
    }
    expect(decisoesPublicadas(lo, 'matutino')).toEqual([
      { chave: 'uid-dido', duplicidade: 'intencional' },
      { chave: 'NATHALIA', conferido: true },
    ])
    expect(decisoesPublicadas(null, 'matutino')).toEqual([])
  })
})
