/**
 * Plano da TROCA DECLARADA (dono 30/07) — helpers puros de utils:
 * planoExecucaoTroca (swap SIMULTÂNEO: um lado por hospital onde cada pessoa do
 * par ocupa slot no rodapé) e planoDesfazerTroca (caminho de erro humano).
 *
 * Invariantes travadas:
 *  - NENHUM plano contém escrita de ordem_liberacao (só chave de override + ids de caso);
 *  - caso TERMINADO e sala compartilhada ("A + B") nunca entram na transferência;
 *  - quem assume sem uid resolvível → lado só de POSIÇÃO (casoIds vazio) — o
 *    service escreveria "?" nos casos;
 *  - o trocaCom do par é listado p/ limpeza (o badge some após executar).
 */
import { describe, it, expect } from 'vitest'
import { planoExecucaoTroca, planoDesfazerTroca, localizarSlotRodape, casosTransferiveis } from '../../pages/escala-cirurgica/utils'

const caso = (id, sala, anestesista, extra = {}) => ({
  id, sala, ordem: 0, anestesista, cirurgiao: 'Cirurgião X',
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// Caso real 30/07: Giovana no rodapé do HRO, Maurício no da Unimed.
const GIOVANA = { uid: 'uid-gio', nome: 'GIOVANA SILVA', apelido: 'GIOVANA' }
const MAURICIO = { uid: 'uid-mau', nome: 'MAURICIO COSTA', apelido: 'MAURICIO' }
const resolverUid = (n) => {
  const s = String(n || '').trim().toUpperCase()
  if (s === 'GIOVANA') return 'uid-gio'
  if (s === 'MAURICIO') return 'uid-mau'
  return null
}

const escalas = {
  unimed: {
    id: 'esc-uni', hospital: 'unimed',
    ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
    linhaOverrides: { 'uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
    casos: [
      caso('u1', 'S1', 'ANDRE'),
      caso('u2', 'S2', 'MAURICIO', { anestesistaUserId: 'uid-mau' }),
      caso('u3', 'S2', 'MAURICIO', { anestesistaUserId: 'uid-mau', statusCirurgia: 'terminada' }),
      caso('u4', 'S3', 'MAURICIO + ANDRE'), // compartilhado: nunca transfere
    ],
  },
  hro: {
    id: 'esc-hro', hospital: 'hro',
    ordemLiberacao: { vespertino: ['GIOVANA', 'KARINE'] },
    linhaOverrides: {},
    casos: [caso('h1', 'S1', 'GIOVANA', { anestesistaUserId: 'uid-gio' })],
  },
  materno: null,
}

describe('planoExecucaoTroca — swap simultâneo Giovana↔Maurício', () => {
  const plan = planoExecucaoTroca({ escalas, resolverUid, a: MAURICIO, b: GIOVANA })

  it('monta um lado por hospital: Giovana assume na Unimed, Maurício no HRO', () => {
    expect(plan.lados).toHaveLength(2)
    const uni = plan.lados.find((l) => l.hospital === 'unimed')
    expect(uni).toMatchObject({
      escalaId: 'esc-uni', chaveSlot: 'uid-mau', nomeSlot: 'MAURICIO',
      de: { uid: 'uid-mau' }, para: { uid: 'uid-gio', apelido: 'GIOVANA' },
    })
    const hro = plan.lados.find((l) => l.hospital === 'hro')
    expect(hro).toMatchObject({
      escalaId: 'esc-hro', chaveSlot: 'uid-gio', nomeSlot: 'GIOVANA',
      de: { uid: 'uid-gio' }, para: { uid: 'uid-mau', apelido: 'MAURICIO' },
    })
  })

  it('transfere só casos ABERTOS e não-compartilhados (terminada e "A + B" ficam)', () => {
    const uni = plan.lados.find((l) => l.hospital === 'unimed')
    expect(uni.casoIds).toEqual(['u2'])
    const hro = plan.lados.find((l) => l.hospital === 'hro')
    expect(hro.casoIds).toEqual(['h1'])
  })

  it('lista o trocaCom do par para limpeza (badge some após executar)', () => {
    expect(plan.limparTroca).toEqual([{ hospital: 'unimed', escalaId: 'esc-uni', chave: 'uid-mau' }])
  })

  it('nada no plano escreve ordem de liberação', () => {
    const raw = JSON.stringify(plan)
    expect(raw).not.toContain('ordemLiberacao')
    expect(raw).not.toContain('ordem_liberacao')
  })

  it('quem assume SEM uid → lado só de posição (sem transferir caso p/ "?")', () => {
    const semUid = { uid: null, nome: 'FULANO', apelido: 'FULANO' }
    const p = planoExecucaoTroca({ escalas, resolverUid, a: MAURICIO, b: semUid })
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni.para.uid).toBeNull()
    expect(uni.casoIds).toEqual([])
  })

  it('escala demo ENTRA no plano — o context a trata em memória (padrão do toggleLiberacao)', () => {
    const comDemo = { ...escalas, hro: { ...escalas.hro, id: 'demo-hro' } }
    const p = planoExecucaoTroca({ escalas: comDemo, resolverUid, a: MAURICIO, b: GIOVANA })
    expect(p.lados.map((l) => l.hospital).sort()).toEqual(['hro', 'unimed'])
    expect(p.lados.find((l) => l.hospital === 'hro').escalaId).toBe('demo-hro')
  })

  it('quando o turno é informado, ignora troca do outro turno e namespacia o lado', () => {
    const vespertino = {
      ...escalas.unimed,
      linhaOverrides: {
        'matutino:uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'Giovana' } },
        'vespertino:uid-mau': { trocaCom: { uid: 'uid-gio', nome: 'Giovana' } },
      },
    }
    const plan = planoExecucaoTroca({ escalas: { unimed: vespertino }, resolverUid, a: GIOVANA, b: MAURICIO, turno: 'vespertino' })
    expect(plan.limparTroca).toEqual([{ hospital: 'unimed', escalaId: 'esc-uni', chave: 'uid-mau', turno: 'vespertino' }])
  })
})

describe('planoDesfazerTroca — reverte os dois lados', () => {
  // estado PÓS-execução: assumidaPor nos dois slots, casos já transferidos
  const escalasPos = {
    unimed: {
      id: 'esc-uni', hospital: 'unimed',
      ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
      linhaOverrides: { 'uid-mau': { assumidaPor: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
      casos: [caso('u2', 'S2', 'GIOVANA', { anestesistaUserId: 'uid-gio' })],
    },
    hro: {
      id: 'esc-hro', hospital: 'hro',
      ordemLiberacao: { vespertino: ['GIOVANA', 'KARINE'] },
      linhaOverrides: { 'uid-gio': { assumidaPor: { uid: 'uid-mau', nome: 'MAURICIO COSTA' } } },
      casos: [caso('h1', 'S1', 'MAURICIO', { anestesistaUserId: 'uid-mau' })],
    },
    materno: null,
  }

  it('acha as duas assunções e devolve os casos ao dono original de cada slot', () => {
    const p = planoDesfazerTroca({ escalas: escalasPos, resolverUid, a: GIOVANA, b: MAURICIO })
    expect(p.lados).toHaveLength(2)
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni).toMatchObject({ chaveSlot: 'uid-mau', de: { uid: 'uid-gio' }, para: { uid: 'uid-mau' } })
    expect(uni.casoIds).toEqual(['u2'])
    const hro = p.lados.find((l) => l.hospital === 'hro')
    expect(hro).toMatchObject({ chaveSlot: 'uid-gio', de: { uid: 'uid-mau' }, para: { uid: 'uid-gio' } })
    expect(hro.casoIds).toEqual(['h1'])
  })

  it('dono original sem uid → só limpa a assunção (para null, sem casos)', () => {
    const p = planoDesfazerTroca({
      escalas: escalasPos, resolverUid,
      a: GIOVANA, b: { uid: null, nome: 'MAURICIO COSTA', apelido: 'MAURICIO' },
    })
    const uni = p.lados.find((l) => l.hospital === 'unimed')
    expect(uni.para).toBeNull()
    expect(uni.casoIds).toEqual([])
  })
})

describe('localizarSlotRodape / casosTransferiveis — resolução de identidade', () => {
  it('acha o slot pelo apelido do dicionário e pelo nome ensinado pelos casos', () => {
    // dicionário resolve GIOVANA→uid-gio
    expect(localizarSlotRodape(escalas.hro, GIOVANA, resolverUid)).toEqual({ nome: 'GIOVANA', chave: 'uid-gio' })
    // sem dicionário: os casos ensinam MAURICIO→uid-mau (chave cai no nome, estável)
    expect(localizarSlotRodape(escalas.unimed, MAURICIO, () => null)).toEqual({ nome: 'MAURICIO', chave: 'MAURICIO' })
    // quem não está em rodapé nenhum
    expect(localizarSlotRodape(escalas.unimed, { uid: 'uid-x', nome: 'NINGUEM' }, resolverUid)).toBeNull()
  })

  it('casosTransferiveis casa por uid mesmo com grafia diferente do nome', () => {
    const esc = {
      casos: [caso('c1', 'S1', 'G. SILVA', { anestesistaUserId: 'uid-gio' })],
    }
    expect(casosTransferiveis(esc, GIOVANA, resolverUid)).toEqual(['c1'])
  })
})
