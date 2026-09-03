/**
 * Notificações da troca de feriado (dono 03/09: notifica, e só quem precisa agir).
 *
 * A trava que importa é a última: o documento da troca carrega uid do Firebase e número da
 * legenda, e nada disso pode acabar dentro de uma notificação, que vive no banco e é lida por
 * outra pessoa. Mesmo teste que o módulo de plantão hospitalar já tem.
 */
import { describe, it, expect } from 'vitest'
import {
  buildFeriadoTrocaNotificationContent,
  getFeriadoTrocaNotificationRecipients,
  FERIADO_TROCA_NOTIF_META,
} from '../../utils/feriadoTrocaNotifications'

const trocaData = {
  codigo: 'FR123456',
  escopo: 'data',
  solicitanteUid: 'uid-giovana',
  solicitanteNome: 'GIOVANA',
  solicitanteNumero: '08',
  destinatarioUid: 'uid-marilio',
  destinatarioNome: 'MARILIO',
  destinatarioNumero: '36',
  feriadoData: '2026-09-07',
  feriadoNome: 'INDEPENDENCIA',
  feriadoDesejado: '2026-10-12',
  feriadoDesejadoNome: 'NSA SENHORA',
  descricao: 'viagem marcada',
}

const trocaPosicao = {
  ...trocaData,
  codigo: 'FR654321',
  escopo: 'posicao',
  feriadoDesejado: null,
  feriadoDesejadoNome: null,
}

describe('conteúdo por evento', () => {
  it('o pedido diz quem quer o quê, com as duas datas e o motivo', () => {
    const { subject, content } = buildFeriadoTrocaNotificationContent('created', trocaData)
    expect(subject).toBe('Pedido de troca de feriado')
    expect(content).toContain('GIOVANA')
    expect(content).toContain('INDEPENDENCIA (07/09/2026)')
    expect(content).toContain('NSA SENHORA (12/10/2026)')
    expect(content).toContain('FR123456')
    expect(content).toContain('viagem marcada')
  })

  it('a troca de posição fala de UM feriado só', () => {
    const { content } = buildFeriadoTrocaNotificationContent('created', trocaPosicao)
    expect(content).toContain('posição na fila')
    expect(content).toContain('INDEPENDENCIA (07/09/2026)')
    expect(content).not.toContain('12/10')
  })

  it('o aceite avisa que a fila já mudou', () => {
    const { subject, content } = buildFeriadoTrocaNotificationContent('accepted', trocaData, { actorNome: 'MARILIO' })
    expect(subject).toBe('Troca de feriado aceita')
    expect(content).toContain('MARILIO aceitou')
    expect(content).toMatch(/fila do feriado já mostra a troca/i)
  })

  it('recusa e cancelamento têm assunto próprio', () => {
    expect(buildFeriadoTrocaNotificationContent('rejected', trocaData, { actorNome: 'MARILIO' }).subject)
      .toBe('Troca de feriado recusada')
    expect(buildFeriadoTrocaNotificationContent('cancelled', trocaData).subject)
      .toBe('Troca de feriado cancelada')
  })

  it('evento desconhecido estoura em vez de mandar notificação vazia', () => {
    expect(() => buildFeriadoTrocaNotificationContent('inventado', trocaData)).toThrow(/Evento inválido/)
  })
})

describe('destinatários — só quem precisa agir', () => {
  it('o pedido e o cancelamento vão para a contraparte, nunca para quem pediu', () => {
    expect(getFeriadoTrocaNotificationRecipients('created', trocaData)).toEqual(['uid-marilio'])
    expect(getFeriadoTrocaNotificationRecipients('cancelled', trocaData)).toEqual(['uid-marilio'])
  })

  it('o aceite e a recusa voltam para quem pediu', () => {
    expect(getFeriadoTrocaNotificationRecipients('accepted', trocaData)).toEqual(['uid-giovana'])
    expect(getFeriadoTrocaNotificationRecipients('rejected', trocaData)).toEqual(['uid-giovana'])
  })

  it('sem uid da contraparte ninguém é notificado — nunca cai no grupo', () => {
    expect(getFeriadoTrocaNotificationRecipients('created', { ...trocaData, destinatarioUid: null })).toEqual([])
  })

  it('a categoria e o destino do toque apontam para a tela de Feriados', () => {
    expect(FERIADO_TROCA_NOTIF_META.ACTION_URL).toBe('feriados')
    expect(FERIADO_TROCA_NOTIF_META.CATEGORY).toBe('plantao')
  })
})

describe('LGPD — o texto não carrega identificador interno', () => {
  it.each(['created', 'accepted', 'rejected', 'cancelled'])('%s não vaza uid nem número da legenda', (evento) => {
    const { subject, content } = buildFeriadoTrocaNotificationContent(evento, trocaData, { actorNome: 'MARILIO' })
    const texto = `${subject} ${content}`
    expect(texto).not.toContain('uid-')
    expect(texto).not.toMatch(/\b08\b/)
    expect(texto).not.toMatch(/\b36\b/)
  })

  it('campo extra do documento não entra no texto', () => {
    const { content } = buildFeriadoTrocaNotificationContent('created', {
      ...trocaData,
      segredoInterno: 'NAO-PODE-VAZAR',
      respondidoPorUid: 'uid-alguem',
    })
    expect(content).not.toContain('NAO-PODE-VAZAR')
    expect(content).not.toContain('uid-alguem')
  })
})
