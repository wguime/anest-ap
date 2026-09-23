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
  CAMPOS_RASTRO, FIM_TURNO, linhasPresentes, montarPreservacao, montarLinhaOverrides, decisoesPublicadas,
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

// O dicionário REAL (montarRoster) casa apelido exato: "CRISTINA (CONSULT)" não é apelido de
// ninguém. Este resolver estrito é o que reproduz o defeito de 22/09 — o `normalizar` do arquivo
// tira a nota e mascararia tudo.
const resolverEstrito = (nome) => ({ CRISTINA: 'uid-cris', ADRIANO: 'uid-adriano' }[String(nome || '').trim().toUpperCase()] || null)

describe('nota do rodapé não é identidade (dono 22/09: o selo de Troca sumiu de quem foi ao consultório)', () => {
  it('"CRISTINA (CONSULT)" é chaveada pelo UID, como a fila faz — não pelo nome', () => {
    const m = linhasPresentes({ ordem: ['CRISTINA (CONSULT)'], resolver: resolverEstrito, normalizar })
    expect([...m.keys()]).toEqual(['uid-cris'])
    expect(m.get('uid-cris')).toMatchObject({ chave: 'uid-cris', candidatas: ['CRISTINA'], posicao: 0 })
  })

  it('a decisão de troca cai na linha de quem tem a nota', () => {
    const ov = montarLinhaOverrides({
      decisoes: { CRISTINA: { tipo: 'troca', parceiroUid: 'uid-gui', parceiroNome: 'GUILHERME XAVIER', apenasRegistro: true, local: 'Consultório' } },
      ordem: ['ADRIANO (REUNIAO 11H)', 'CRISTINA (CONSULT)'], resolver: resolverEstrito, normalizar, hospital: 'hro',
    })
    expect(Object.keys(ov)).toEqual(['uid-cris'])
    expect(ov['uid-cris'].trocaCom).toMatchObject({ uid: 'uid-gui', local: 'Consultório', apenasRegistro: true })
  })

  it('preservação acha a posição antiga do nome anotado (o rastro sobrevive à republicação)', () => {
    const p = montarPreservacao({
      existente: { ordemLiberacao: { matutino: ['ADRIANO (REUNIAO 11H)', 'CRISTINA (CONSULT)'] } },
      turno: 'matutino', ordem: ['ADRIANO', 'CRISTINA'], resolver: resolverEstrito, normalizar,
    })
    expect(p.linhas.map((l) => l.chave).sort()).toEqual(['uid-adriano', 'uid-cris'])
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

  it('"Refazer" de decisão publicada grava null — a preservação não a traz de volta', () => {
    const o = montarLinhaOverrides({
      decisoes: { NATHALIA: { tipo: 'reaberta', chave: 'NATHALIA', uid: null, nomeNorm: 'NATHALIA' } },
      hospital: 'hro', ordem: ['NATHALIA'], resolver, normalizar,
    })
    // apagar do mapa local não bastaria: `p_preservar` copia `conferido`/`duplicidade` de volta
    expect(o).toEqual({ NATHALIA: { duplicidade: null, conferido: null } })
  })

  it('"está certo, sem cirurgia hoje" vira conferido: true', () => {
    const o = montarLinhaOverrides({ conferidos: { NATHALIA: true }, hospital: 'hro', ordem: ['NATHALIA'], resolver, normalizar })
    expect(o).toEqual({ NATHALIA: { conferido: true } })
  })

  // "X na equipe da Unimed até as 19h" (dono 21/09): membro da equipe deste hospital no turno —
  // o card ganha "Equipe até 13h/19h"; a hora é o FIM DO TURNO (dono 17/09), nunca chutada
  describe('tipo equipe → naEquipe { ate } com a hora do fim do turno', () => {
    const equipe = { tipo: 'equipe', chave: 'uid-dido', uid: 'uid-dido', nomeNorm: 'DIDO' }
    it('tarde → 19:00; manhã → 13:00; só onde a pessoa está', () => {
      const tarde = montarLinhaOverrides({ decisoes: { 'uid-dido': equipe }, hospital: 'unimed', ordem: ['DIDO'], resolver, normalizar, turno: 'vespertino' })
      expect(tarde).toEqual({ 'uid-dido': { naEquipe: { ate: '19:00' } } })
      const manha = montarLinhaOverrides({ decisoes: { 'uid-dido': equipe }, hospital: 'unimed', ordem: ['DIDO'], resolver, normalizar, turno: 'matutino' })
      expect(manha).toEqual({ 'uid-dido': { naEquipe: { ate: '13:00' } } })
      expect(montarLinhaOverrides({ decisoes: { 'uid-dido': equipe }, hospital: 'hro', ordem: ['PAULO'], resolver, normalizar, turno: 'vespertino' })).toEqual({})
    })
    it('sem turno conhecido não grava — hora inventada é pior que selo nenhum', () => {
      expect(montarLinhaOverrides({ decisoes: { 'uid-dido': equipe }, hospital: 'unimed', ordem: ['DIDO'], resolver, normalizar })).toEqual({})
      expect(montarLinhaOverrides({ decisoes: { 'uid-dido': equipe }, hospital: 'unimed', ordem: ['DIDO'], resolver, normalizar, turno: 'fds' })).toEqual({})
    })
    it('a marca veio do RECADO, não do documento: sobrevive à republicação (CAMPOS_RASTRO), ao contrário de turnoProprio', () => {
      expect(CAMPOS_RASTRO).toContain('naEquipe')
      expect(CAMPOS_RASTRO).not.toContain('turnoProprio')
      expect(FIM_TURNO).toEqual({ matutino: '13:00', vespertino: '19:00' })
    })
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
