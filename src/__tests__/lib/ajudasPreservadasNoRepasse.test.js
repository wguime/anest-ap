/**
 * VISITANTE PRESERVADO NO REPASSE (dono 31/07 — caso real: a Cesárea do LEONARDO
 * na Unimed foi repassada ao Tiago e a linha dele sumiu das Liberações antes de
 * ele ser liberado). O helper decide quem entra em ajuda_externa[turno] para a
 * linha sobreviver — gente do rodapé local e quem ainda tem caso ficam de fora.
 *
 * Desde 19/08 (dono, swap Guilherme⇄Diego): a preservação vale SÓ para quem é
 * comprovadamente de OUTRO hospital (rodapé ou caso do turno em outra escala do
 * dia, via opts.outrasEscalas). Troca entre colegas do MESMO hospital apenas
 * move os procedimentos — ninguém vira "ajuda".
 */
import { describe, it, expect } from 'vitest'
import { ajudasPreservadasNoRepasse } from '../../pages/escala-cirurgica/utils'

const caso = (id, anestesista, extra = {}) => ({
  id, sala: 'CO - Cesárea', ordem: 0, hora: '13:30', anestesista,
  semAnestesista: false, ...extra,
})

const escalaBase = {
  hospital: 'unimed',
  ordemLiberacao: { vespertino: ['PAULO', 'RAUL'] },
  ajudaExterna: { vespertino: [] },
}

// escala de OUTRO hospital com o LEONARDO no rodapé da tarde (origem conhecida)
const escalaHro = {
  hospital: 'hro',
  ordemLiberacao: { vespertino: ['LEONARDO', 'FERNANDO'] },
  ajudaExterna: {},
  casos: [],
}

const repassa = (antes, ids, novoDono = { anestesista: 'TIAGO', anestesistaUserId: 'uid-tia' }) => {
  const idSet = new Set(ids)
  return antes.map((c) => (idSet.has(c.id) ? { ...c, ...novoDono } : c))
}

describe('ajudasPreservadasNoRepasse', () => {
  it('visitante de OUTRO hospital que perdeu o ÚNICO caso do turno entra na ajuda', () => {
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [escalaHro] }))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('colega do MESMO hospital (sem prova de origem externa) troca só os procedimentos', () => {
    // dono 19/08: trocar de sala dentro do hospital não pode virar badge de Ajuda
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [] })).toEqual([])
  })

  it('origem sem rodapé (Materno) comprova pelo CASO do turno em nome dele', () => {
    const materno = {
      hospital: 'materno',
      ordemLiberacao: {},
      casos: [caso('m1', 'LEONARDO', { anestesistaUserId: 'uid-leo', sala: 'Materno' })],
    }
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [materno] }))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('caso do colega em OUTRO TURNO da outra escala não comprova origem', () => {
    const materno = {
      hospital: 'materno',
      ordemLiberacao: {},
      casos: [caso('m1', 'LEONARDO', { anestesistaUserId: 'uid-leo', hora: '08:00' })], // matutino
    }
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [materno] })).toEqual([])
  })

  it('quem ainda tem OUTRO caso no turno não precisa (a linha sobrevive sozinha)', () => {
    const antes = [
      caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' }),
      caso('c2', 'LEONARDO', { anestesistaUserId: 'uid-leo', sala: 'CC - Sala 6' }),
    ]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('caso restante em OUTRO turno não conta como presença aqui', () => {
    const antes = [
      caso('c1', 'LEONARDO'),
      caso('c2', 'LEONARDO', { hora: '08:00' }), // matutino
    ]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [escalaHro] }))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('gente do rodapé DAQUI fica de fora (a posição própria segura a linha)', () => {
    const antes = [caso('c1', 'PAULO')]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('nome de rodapé com nota "(CONSULT)" ainda é gente daqui', () => {
    const antes = [caso('c1', 'MATHEUS')]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['MATHEUS (CONSULT)', 'RAUL'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('quem já está na ajuda do turno não duplica', () => {
    const antes = [caso('c1', 'LEONARDO')]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ajudaExterna: { vespertino: ['LEONARDO'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('sala compartilhada "A + B" e caso "?" ficam de fora', () => {
    const antes = [caso('c1', 'PAULO + GUILHERME MELO'), caso('c2', '?', { semAnestesista: true })]
    const depois = repassa(antes, ['c1', 'c2'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1', 'c2'], escalaBase, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  // ── identidade > grafia (caso real 19/08: swap Guilherme⇄Diego na Unimed) ──
  // A Vision escreveu "GUILHERME M ELO" nos casos e o rodapé diz "GUILHERME
  // MELO"; o repasse comparava texto contra texto, concluía "visitante" e
  // gravava gente do rodapé em ajuda_externa — badge de Ajuda indevido.

  it('grafia com espaço torto da Vision ainda é gente do rodapé (sem resolver)', () => {
    const antes = [caso('c1', 'GUILHERME M ELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['GUILHERME MELO', 'RAUL'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, { outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('apelido diferente do rodapé resolve pela identidade (resolverUid)', () => {
    // caso diz "MELO", rodapé diz "GUILHERME MELO" — só o dicionário sabe que é a mesma pessoa
    const antes = [caso('c1', 'MELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['GUILHERME MELO', 'RAUL'] } }
    const resolverUid = (n) => (/MELO/.test(String(n)) && !/PAULO/.test(String(n)) ? 'uid-gui' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, { resolverUid, outrasEscalas: [escalaHro] })).toEqual([])
  })

  it('origem em outro hospital também casa por identidade, não pela grafia', () => {
    // caso daqui diz "GUILHERME M ELO"; o rodapé do outro hospital diz "GUILHERME MELO"
    const antes = [caso('c1', 'GUILHERME M ELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const outra = { hospital: 'hro', ordemLiberacao: { vespertino: ['GUILHERME MELO'] }, casos: [] }
    const resolverUid = (n) => (/MELO/.test(String(n)) ? 'uid-gui' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, { resolverUid, outrasEscalas: [outra] }))
      .toEqual([{ nome: 'GUILHERME M ELO', turno: 'vespertino' }])
  })

  it('já listado na ajuda sob OUTRA grafia não duplica (identidade decide)', () => {
    const antes = [caso('c1', 'GUILHERME M ELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ajudaExterna: { vespertino: ['MELO'] } }
    const resolverUid = (n) => (/MELO/.test(String(n)) ? 'uid-gui' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, { resolverUid, outrasEscalas: [escalaHro] })).toEqual([])
  })
})
