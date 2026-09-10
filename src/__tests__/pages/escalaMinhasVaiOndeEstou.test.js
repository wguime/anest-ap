/**
 * "Minhas" leva onde eu estou — `localizarMeuPosto` (dono 2026-09-09).
 *
 * O relato: "se o usuário está escalado na unimed, e clica em minhas estando o
 * HRO marcado, nada aparece. quero que ao clicar em minhas apareçam as cirurgias
 * e as marcações no cabeçalho fiquem marcadas de forma automática onde o usuário
 * está". O layout não mudou: quem responde ONDE e QUANDO são os trilhos de
 * hospital e turno que já existiam — este helper é quem os move.
 *
 * ⚠️ A trava que importa é a ORDEM DA VARREDURA: turno por FORA, hospital por
 * dentro. A varredura antiga (autoSelRef, 23/07) era o contrário, e por isso
 * quem tinha cirurgia de manhã na Unimed e à tarde no HRO abria o app às 14h em
 * Unimed/Manhã — com o relógio PAUSADO, porque a escolha divergente segura o
 * automático na faixa. Era esse o "sempre marque o turno em curso" do pedido.
 */
import { describe, it, expect } from 'vitest'
import { localizarMeuPosto } from '@/pages/escala-cirurgica/utils'

const HOSPITAIS = ['unimed', 'hro', 'materno']
const EU = { uid: 'uid-guilherme', alias: 'GUILHERME' }

const caso = (over = {}) => ({
  id: `c-${Math.random().toString(36).slice(2)}`,
  sala: 'CC - Sala 1', turno: 'matutino', anestesista: 'OUTRO', anestesistaUserId: 'uid-outro',
  ...over,
})
const escala = (casos) => ({ id: `e-${casos.length}`, status: 'publicada', casos })

describe('localizarMeuPosto — a aba Minhas acha o meu posto', () => {
  it('acha o hospital certo mesmo com outro selecionado na tela', () => {
    const escalas = {
      unimed: escala([caso()]),
      hro: escala([caso({ anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
    }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' }))
      .toEqual({ hospital: 'hro', turno: 'matutino' })
  })

  it('o TURNO EM CURSO vence a ordem dos hospitais (regressão da varredura antiga)', () => {
    // manhã na Unimed, tarde no HRO. Às 14h o posto é o do HRO — 'unimed' vir
    // primeiro na lista não pode arrastar a tela para o turno da manhã.
    const escalas = {
      unimed: escala([caso({ turno: 'matutino', anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
      hro: escala([caso({ turno: 'vespertino', anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
    }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'vespertino' }))
      .toEqual({ hospital: 'hro', turno: 'vespertino' })
    // e de manhã, o oposto — pelo mesmo motivo
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' }))
      .toEqual({ hospital: 'unimed', turno: 'matutino' })
  })

  it('sem nada no turno em curso, cai no outro turno em vez de devolver tela vazia', () => {
    const escalas = {
      unimed: escala([caso({ turno: 'matutino', anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
    }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'vespertino' }))
      .toEqual({ hospital: 'unimed', turno: 'matutino' })
  })

  it('residente acha o posto pelos casos que acompanha', () => {
    const escalas = {
      materno: escala([caso({ turno: 'vespertino', residenteUserId: 'uid-residente' })]),
    }
    expect(localizarMeuPosto({
      escalas, hospitais: HOSPITAIS,
      eu: { uid: 'uid-residente', alias: 'BRUNA' }, turnoPreferido: 'vespertino',
    })).toEqual({ hospital: 'materno', turno: 'vespertino' })
  })

  it('dupla "A + B" é posto das DUAS', () => {
    // dupla é uid null por construção — quem casa é o apelido
    const escalas = { hro: escala([caso({ anestesista: 'RAQUEL + GUILHERME', anestesistaUserId: null })]) }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' }))
      .toEqual({ hospital: 'hro', turno: 'matutino' })
    expect(localizarMeuPosto({
      escalas, hospitais: HOSPITAIS, eu: { uid: 'uid-raquel', alias: 'RAQUEL' }, turnoPreferido: 'matutino',
    })).toEqual({ hospital: 'hro', turno: 'matutino' })
  })

  it('a posição assistencial (SRPA/Exames) também é posto', () => {
    const escalas = {
      unimed: escala([caso({ sala: 'SRPA', procedimento: '', anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
    }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' }))
      .toEqual({ hospital: 'unimed', turno: 'matutino' })
  })

  it('quem não está escalado em lugar nenhum devolve null — a tela não se mexe', () => {
    const escalas = { unimed: escala([caso()]), hro: escala([caso()]) }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' })).toBeNull()
  })

  it('sem identidade nenhuma devolve null (não chuta pelo primeiro caso)', () => {
    const escalas = { unimed: escala([caso({ anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]) }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: { uid: null, alias: '' }, turnoPreferido: 'matutino' }))
      .toBeNull()
  })

  it('escalas vazias ou ausentes não quebram a varredura', () => {
    expect(localizarMeuPosto({ escalas: {}, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' })).toBeNull()
    expect(localizarMeuPosto({ escalas: { unimed: null, hro: escala([]) }, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' }))
      .toBeNull()
  })

  it('a linha "fds" não entra: quem passa a lista de hospitais é a tela', () => {
    const escalas = {
      fds: escala([caso({ anestesista: 'GUILHERME', anestesistaUserId: EU.uid })]),
    }
    expect(localizarMeuPosto({ escalas, hospitais: HOSPITAIS, eu: EU, turnoPreferido: 'matutino' })).toBeNull()
  })
})
