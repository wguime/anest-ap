/**
 * VISITANTE PRESERVADO NO REPASSE (dono 31/07 — caso real: a Cesárea do LEONARDO
 * na Unimed foi repassada ao Tiago e a linha dele sumiu das Liberações antes de
 * ele ser liberado). O helper decide quem entra em ajuda_externa[turno] para a
 * linha sobreviver — gente do rodapé local e quem ainda tem caso ficam de fora.
 */
import { describe, it, expect } from 'vitest'
import { ajudasPreservadasNoRepasse } from '../../pages/escala-cirurgica/utils'

const caso = (id, anestesista, extra = {}) => ({
  id, sala: 'CO - Cesárea', ordem: 0, hora: '13:30', anestesista,
  semAnestesista: false, ...extra,
})

const escalaBase = {
  ordemLiberacao: { vespertino: ['PAULO', 'RAUL'] },
  ajudaExterna: { vespertino: [] },
}

const repassa = (antes, ids, novoDono = { anestesista: 'TIAGO', anestesistaUserId: 'uid-tia' }) => {
  const idSet = new Set(ids)
  return antes.map((c) => (idSet.has(c.id) ? { ...c, ...novoDono } : c))
}

describe('ajudasPreservadasNoRepasse', () => {
  it('visitante que perdeu o ÚNICO caso do turno entra na ajuda do turno', () => {
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('quem ainda tem OUTRO caso no turno não precisa (a linha sobrevive sozinha)', () => {
    const antes = [
      caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' }),
      caso('c2', 'LEONARDO', { anestesistaUserId: 'uid-leo', sala: 'CC - Sala 6' }),
    ]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase)).toEqual([])
  })

  it('caso restante em OUTRO turno não conta como presença', () => {
    const antes = [
      caso('c1', 'LEONARDO'),
      caso('c2', 'LEONARDO', { hora: '08:00' }), // matutino
    ]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('gente do rodapé DAQUI fica de fora (a posição própria segura a linha)', () => {
    const antes = [caso('c1', 'PAULO')]
    const depois = repassa(antes, ['c1'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase)).toEqual([])
  })

  it('nome de rodapé com nota "(CONSULT)" ainda é gente daqui', () => {
    const antes = [caso('c1', 'MATHEUS')]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['MATHEUS (CONSULT)', 'RAUL'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala)).toEqual([])
  })

  it('quem já está na ajuda do turno não duplica', () => {
    const antes = [caso('c1', 'LEONARDO')]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ajudaExterna: { vespertino: ['LEONARDO'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala)).toEqual([])
  })

  it('sala compartilhada "A + B" e caso "?" ficam de fora', () => {
    const antes = [caso('c1', 'PAULO + GUILHERME MELO'), caso('c2', '?', { semAnestesista: true })]
    const depois = repassa(antes, ['c1', 'c2'])
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1', 'c2'], escalaBase)).toEqual([])
  })

  // ── identidade > grafia (caso real 19/08: swap Guilherme⇄Diego na Unimed) ──
  // A Vision escreveu "GUILHERME M ELO" nos casos e o rodapé diz "GUILHERME
  // MELO"; o repasse comparava texto contra texto, concluía "visitante" e
  // gravava gente do rodapé em ajuda_externa — badge de Ajuda indevido.

  it('grafia com espaço torto da Vision ainda é gente do rodapé (sem resolver)', () => {
    const antes = [caso('c1', 'GUILHERME M ELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['GUILHERME MELO', 'RAUL'] } }
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala)).toEqual([])
  })

  it('apelido diferente do rodapé resolve pela identidade (resolverUid)', () => {
    // caso diz "MELO", rodapé diz "GUILHERME MELO" — só o dicionário sabe que é a mesma pessoa
    const antes = [caso('c1', 'MELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ordemLiberacao: { vespertino: ['GUILHERME MELO', 'RAUL'] } }
    const resolverUid = (n) => (/MELO/.test(String(n)) && !/PAULO/.test(String(n)) ? 'uid-gui' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, resolverUid)).toEqual([])
  })

  it('visitante de verdade segue entrando mesmo com resolver presente', () => {
    const antes = [caso('c1', 'LEONARDO', { anestesistaUserId: 'uid-leo' })]
    const depois = repassa(antes, ['c1'])
    const resolverUid = (n) => (String(n).includes('LEONARDO') ? 'uid-leo' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escalaBase, resolverUid))
      .toEqual([{ nome: 'LEONARDO', turno: 'vespertino' }])
  })

  it('já listado na ajuda sob OUTRA grafia não duplica (identidade decide)', () => {
    const antes = [caso('c1', 'GUILHERME M ELO', { anestesistaUserId: 'uid-gui' })]
    const depois = repassa(antes, ['c1'])
    const escala = { ...escalaBase, ajudaExterna: { vespertino: ['MELO'] } }
    const resolverUid = (n) => (/MELO/.test(String(n)) ? 'uid-gui' : null)
    expect(ajudasPreservadasNoRepasse(antes, depois, ['c1'], escala, resolverUid)).toEqual([])
  })
})
