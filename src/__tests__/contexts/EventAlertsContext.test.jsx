/**
 * Tests for EventAlertsContext.
 *
 * Context sem backend: persiste em localStorage (jsdom fornece implementação
 * real — limpamos em beforeEach) e usa Notification API + navigator.setAppBadge,
 * ambos ausentes no jsdom → stubados aqui.
 *
 * Covers:
 * - shape do hook useEventAlerts (e throw fora do provider)
 * - leitura do localStorage no mount (filtro de expirados + JSON corrompido)
 * - persistência em localStorage quando alerts mudam
 * - requestPermission: granted / denied / default→prompt / API ausente
 * - scheduleEventAlerts: timers (1day/1hour) disparam alertas, dedupe,
 *   push Notification só com permission granted, registro em
 *   anest_scheduled_events sem duplicar
 * - re-hidratação de anest_scheduled_events no mount: evento futuro re-agenda
 *   timeouts (e dispara), evento passado é podado do storage, JSON corrompido
 *   tolerado, unmount limpa todos os timeouts pendentes
 * - markAsViewed / markAllAsViewed / removeAlert / clearAllAlerts + unreadCount
 * - badge do app (setAppBadge / clearAppBadge)
 * - identidade estável dos callbacks entre rerenders e após updates de estado
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { EventAlertsProvider, useEventAlerts } from '../../contexts/EventAlertsContext'

// ----------------------------------------------------------------------------
// Constantes (espelham o source — contrato público de timing dos alertas)
// ----------------------------------------------------------------------------
const STORAGE_KEY = 'anest_event_alerts'
const SCHEDULED_KEY = 'anest_scheduled_events'
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

// ----------------------------------------------------------------------------
// Stub da Notification API (jsdom não implementa)
// ----------------------------------------------------------------------------
class MockNotification {
  static permission = 'default'
  static requestPermission = vi.fn()
  static instances = []

  constructor(title, options) {
    this.title = title
    this.options = options
    this.onclick = null
    this.close = vi.fn()
    MockNotification.instances.push(this)
  }
}

function resetNotificationStub(permission = 'default') {
  MockNotification.permission = permission
  MockNotification.instances = []
  MockNotification.requestPermission = vi.fn().mockResolvedValue('default')
  vi.stubGlobal('Notification', MockNotification)
}

// ----------------------------------------------------------------------------
// Stub do app badge (navigator.setAppBadge / clearAppBadge — ausentes no jsdom)
// ----------------------------------------------------------------------------
let setAppBadgeMock
let clearAppBadgeMock

function stubAppBadge() {
  setAppBadgeMock = vi.fn().mockResolvedValue(undefined)
  clearAppBadgeMock = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'setAppBadge', {
    value: setAppBadgeMock,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(navigator, 'clearAppBadge', {
    value: clearAppBadgeMock,
    configurable: true,
    writable: true,
  })
}

function unstubAppBadge() {
  delete navigator.setAppBadge
  delete navigator.clearAppBadge
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function wrapper({ children }) {
  return <EventAlertsProvider>{children}</EventAlertsProvider>
}

const futureISO = (hoursFromNow) =>
  new Date(Date.now() + hoursFromNow * ONE_HOUR_MS).toISOString()

const makeAlert = (overrides = {}) => ({
  id: 'ev1_1day',
  eventId: 'ev1',
  eventTitle: 'Reunião Científica',
  eventDate: futureISO(30),
  alertType: '1day',
  createdAt: new Date().toISOString(),
  viewed: false,
  message: 'Evento amanhã: Reunião Científica',
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
  resetNotificationStub()
  stubAppBadge()
})

afterEach(() => {
  // O provider limpa seus próprios timeouts no unmount (re-hidratação);
  // clearAllTimers fica como cinto-de-segurança p/ timers fora do provider.
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  unstubAppBadge()
  localStorage.clear()
})

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------
describe('EventAlertsContext', () => {
  describe('useEventAlerts()', () => {
    it('lança erro quando usado fora do EventAlertsProvider', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(() => renderHook(() => useEventAlerts())).toThrow(
          'useEventAlerts must be used within EventAlertsProvider'
        )
      } finally {
        errorSpy.mockRestore()
      }
    })

    it('expõe o shape esperado do contexto', () => {
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      expect(result.current).toEqual(
        expect.objectContaining({
          alerts: expect.any(Array),
          unreadAlerts: expect.any(Array),
          unreadCount: expect.any(Number),
          permission: expect.any(String),
          requestPermission: expect.any(Function),
          scheduleEventAlerts: expect.any(Function),
          markAsViewed: expect.any(Function),
          markAllAsViewed: expect.any(Function),
          removeAlert: expect.any(Function),
          clearAllAlerts: expect.any(Function),
        })
      )
      expect(result.current.alerts).toEqual([])
      expect(result.current.unreadCount).toBe(0)
    })

    it('lê Notification.permission no mount', () => {
      resetNotificationStub('granted')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      expect(result.current.permission).toBe('granted')
    })
  })

  describe('leitura do localStorage no mount', () => {
    it('carrega alertas válidos persistidos', () => {
      const seed = [
        makeAlert(),
        makeAlert({ id: 'ev2_1hour', eventId: 'ev2', alertType: '1hour', viewed: true }),
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      expect(result.current.alerts).toHaveLength(2)
      expect(result.current.alerts.map((a) => a.id)).toEqual(['ev1_1day', 'ev2_1hour'])
      expect(result.current.unreadCount).toBe(1)
      expect(result.current.unreadAlerts).toEqual([
        expect.objectContaining({ id: 'ev1_1day', viewed: false }),
      ])
    })

    it('descarta alertas de eventos já passados e reescreve o storage', () => {
      const seed = [
        makeAlert(), // futuro → mantém
        makeAlert({ id: 'old_1day', eventId: 'old', eventDate: futureISO(-2) }), // passado → descarta
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      expect(result.current.alerts).toHaveLength(1)
      expect(result.current.alerts[0].id).toBe('ev1_1day')

      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(persisted).toHaveLength(1)
      expect(persisted[0].id).toBe('ev1_1day')
    })

    it('tolera JSON corrompido sem quebrar (estado vazio)', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const { result } = renderHook(() => useEventAlerts(), { wrapper })
        expect(result.current.alerts).toEqual([])
        expect(errorSpy).toHaveBeenCalledWith('Erro ao carregar alertas:', expect.any(Error))
      } finally {
        errorSpy.mockRestore()
      }
    })
  })

  describe('requestPermission()', () => {
    it('retorna true direto quando permission já é granted (sem prompt)', async () => {
      resetNotificationStub('granted')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      let outcome
      await act(async () => {
        outcome = await result.current.requestPermission()
      })

      expect(outcome).toBe(true)
      expect(result.current.permission).toBe('granted')
      expect(MockNotification.requestPermission).not.toHaveBeenCalled()
    })

    it('retorna false quando permission é denied (sem prompt)', async () => {
      resetNotificationStub('denied')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      let outcome
      await act(async () => {
        outcome = await result.current.requestPermission()
      })

      expect(outcome).toBe(false)
      expect(result.current.permission).toBe('denied')
      expect(MockNotification.requestPermission).not.toHaveBeenCalled()
    })

    it('em default, faz prompt e propaga o resultado granted', async () => {
      resetNotificationStub('default')
      MockNotification.requestPermission.mockResolvedValue('granted')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      let outcome
      await act(async () => {
        outcome = await result.current.requestPermission()
      })

      expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1)
      expect(outcome).toBe(true)
      expect(result.current.permission).toBe('granted')
    })

    it('em default, prompt negado retorna false e atualiza o estado', async () => {
      resetNotificationStub('default')
      MockNotification.requestPermission.mockResolvedValue('denied')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      let outcome
      await act(async () => {
        outcome = await result.current.requestPermission()
      })

      expect(outcome).toBe(false)
      expect(result.current.permission).toBe('denied')
    })

    it('retorna false quando a Notification API não existe', async () => {
      vi.unstubAllGlobals() // jsdom não tem Notification nativa
      expect('Notification' in window).toBe(false)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const { result } = renderHook(() => useEventAlerts(), { wrapper })

        let outcome
        await act(async () => {
          outcome = await result.current.requestPermission()
        })

        expect(outcome).toBe(false)
      } finally {
        warnSpy.mockRestore()
      }
    })
  })

  describe('scheduleEventAlerts() — timers e alertas', () => {
    it('dispara alerta 1day (24h antes) e 1hour (1h antes) do evento', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')

      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      const eventDate = futureISO(25) // 1day dispara em +1h; 1hour em +24h

      await act(async () => {
        await result.current.scheduleEventAlerts('ev1', 'Reunião Científica', eventDate)
      })
      expect(result.current.alerts).toHaveLength(0)

      // +1h → alerta "1 dia antes"
      act(() => {
        vi.advanceTimersByTime(ONE_HOUR_MS + 1000)
      })
      expect(result.current.alerts).toHaveLength(1)
      expect(result.current.alerts[0]).toEqual(
        expect.objectContaining({
          id: 'ev1_1day',
          eventId: 'ev1',
          alertType: '1day',
          viewed: false,
          message: 'Evento amanhã: Reunião Científica',
        })
      )

      // +24h → alerta "1 hora antes"
      act(() => {
        vi.advanceTimersByTime(23 * ONE_HOUR_MS)
      })
      expect(result.current.alerts).toHaveLength(2)
      expect(result.current.alerts[1]).toEqual(
        expect.objectContaining({
          id: 'ev1_1hour',
          alertType: '1hour',
          message: 'Evento em 1 hora: Reunião Científica',
        })
      )
      expect(result.current.unreadCount).toBe(2)
    })

    it('não duplica alerta com mesmo id quando o evento é agendado duas vezes', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')

      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      const eventDate = futureISO(25)

      await act(async () => {
        await result.current.scheduleEventAlerts('ev1', 'Reunião', eventDate)
        await result.current.scheduleEventAlerts('ev1', 'Reunião', eventDate)
      })

      act(() => {
        vi.advanceTimersByTime(2 * ONE_HOUR_MS)
      })
      // Dois timeouts disparam, mas o reducer deduplica por alertId
      expect(result.current.alerts).toHaveLength(1)
      expect(result.current.alerts[0].id).toBe('ev1_1day')
    })

    it('cria Notification push quando permission é granted', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')

      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      await act(async () => {
        await result.current.scheduleEventAlerts('ev1', 'Reunião', futureISO(25))
      })
      act(() => {
        vi.advanceTimersByTime(ONE_HOUR_MS + 1000)
      })

      expect(MockNotification.instances).toHaveLength(1)
      const push = MockNotification.instances[0]
      expect(push.title).toBe('ANEST - Lembrete de Evento')
      expect(push.options).toEqual(
        expect.objectContaining({
          tag: 'ev1_1day',
          icon: '/logo-anest.png',
          requireInteraction: true,
        })
      )
      expect(push.options.body).toContain('Evento amanhã: Reunião')
    })

    it('NÃO cria Notification push sem permission, mas mantém o alerta visual', async () => {
      vi.useFakeTimers()
      resetNotificationStub('denied')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const { result } = renderHook(() => useEventAlerts(), { wrapper })

        await act(async () => {
          await result.current.scheduleEventAlerts('ev1', 'Reunião', futureISO(25))
        })
        act(() => {
          vi.advanceTimersByTime(ONE_HOUR_MS + 1000)
        })

        expect(result.current.alerts).toHaveLength(1)
        expect(MockNotification.instances).toHaveLength(0)
      } finally {
        warnSpy.mockRestore()
      }
    })

    it('não agenda nada para eventos no passado', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')

      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      await act(async () => {
        await result.current.scheduleEventAlerts('old', 'Evento Antigo', futureISO(-1))
      })
      act(() => {
        vi.advanceTimersByTime(2 * ONE_DAY_MS)
      })

      expect(result.current.alerts).toHaveLength(0)
      expect(MockNotification.instances).toHaveLength(0)
    })

    it('registra o evento em anest_scheduled_events sem duplicar', async () => {
      resetNotificationStub('granted')
      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      const eventDate = futureISO(48)

      await act(async () => {
        await result.current.scheduleEventAlerts('ev1', 'Reunião', eventDate)
        await result.current.scheduleEventAlerts('ev1', 'Reunião', eventDate)
      })

      const scheduled = JSON.parse(localStorage.getItem(SCHEDULED_KEY))
      expect(scheduled).toHaveLength(1)
      expect(scheduled[0]).toEqual(
        expect.objectContaining({ id: 'ev1', title: 'Reunião', eventDate })
      )
    })
  })

  describe('re-hidratação de anest_scheduled_events (mount)', () => {
    const makeScheduled = (overrides = {}) => ({
      id: 'ev1',
      title: 'Reunião Científica',
      eventDate: futureISO(25),
      scheduledAt: new Date().toISOString(),
      ...overrides,
    })

    it('re-agenda timeouts de evento futuro persistido e dispara os alertas', () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')
      localStorage.setItem(SCHEDULED_KEY, JSON.stringify([makeScheduled()]))

      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      expect(result.current.alerts).toHaveLength(0)

      // +1h → alerta "1 dia antes" (evento em 25h)
      act(() => {
        vi.advanceTimersByTime(ONE_HOUR_MS + 1000)
      })
      expect(result.current.alerts).toHaveLength(1)
      expect(result.current.alerts[0]).toEqual(
        expect.objectContaining({
          id: 'ev1_1day',
          alertType: '1day',
          message: 'Evento amanhã: Reunião Científica',
        })
      )

      // +24h → alerta "1 hora antes"
      act(() => {
        vi.advanceTimersByTime(23 * ONE_HOUR_MS)
      })
      expect(result.current.alerts).toHaveLength(2)
      expect(result.current.alerts[1].id).toBe('ev1_1hour')
    })

    it('poda eventos passados do storage no mount (chave não cresce para sempre)', () => {
      const futureDate = futureISO(48)
      localStorage.setItem(
        SCHEDULED_KEY,
        JSON.stringify([
          makeScheduled({ id: 'old', title: 'Evento Antigo', eventDate: futureISO(-2) }),
          makeScheduled({ id: 'ev1', eventDate: futureDate }),
        ])
      )

      renderHook(() => useEventAlerts(), { wrapper })

      const persisted = JSON.parse(localStorage.getItem(SCHEDULED_KEY))
      expect(persisted).toHaveLength(1)
      expect(persisted[0]).toEqual(
        expect.objectContaining({ id: 'ev1', eventDate: futureDate })
      )
    })

    it('tolera JSON corrompido na chave sem quebrar', () => {
      localStorage.setItem(SCHEDULED_KEY, '{not valid json!!')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const { result } = renderHook(() => useEventAlerts(), { wrapper })
        expect(result.current.alerts).toEqual([])
        expect(errorSpy).toHaveBeenCalledWith(
          'Erro ao re-hidratar eventos agendados:',
          expect.any(Error)
        )
      } finally {
        errorSpy.mockRestore()
      }
    })

    it('unmount limpa todos os timeouts pendentes (re-hidratados e agendados em runtime)', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')
      localStorage.setItem(SCHEDULED_KEY, JSON.stringify([makeScheduled()]))

      const { result, unmount } = renderHook(() => useEventAlerts(), { wrapper })

      // +2 timers agendados em runtime (além dos 2 da re-hidratação)
      await act(async () => {
        await result.current.scheduleEventAlerts('ev2', 'Outra Reunião', futureISO(30))
      })

      // Delta (ambiente React/jsdom também agenda timers próprios): o unmount
      // deve limpar PELO MENOS os 4 timeouts do provider (2 rehydrate + 2 runtime).
      const before = vi.getTimerCount()
      unmount()
      const after = vi.getTimerCount()
      expect(before - after).toBeGreaterThanOrEqual(4)

      // Nada dispara depois do unmount
      act(() => {
        vi.advanceTimersByTime(2 * ONE_DAY_MS)
      })
      expect(MockNotification.instances).toHaveLength(0)
    })
  })

  describe('persistência em localStorage', () => {
    it('persiste alertas disparados no STORAGE_KEY', async () => {
      vi.useFakeTimers()
      resetNotificationStub('granted')

      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      await act(async () => {
        await result.current.scheduleEventAlerts('ev1', 'Reunião', futureISO(25))
      })
      act(() => {
        vi.advanceTimersByTime(ONE_HOUR_MS + 1000)
      })

      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(persisted).toHaveLength(1)
      expect(persisted[0].id).toBe('ev1_1day')

      // Mutação subsequente também persiste
      act(() => {
        result.current.removeAlert('ev1_1day')
      })
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([])
    })
  })

  describe('ações sobre alertas', () => {
    const seedTwoAlerts = () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          makeAlert(),
          makeAlert({ id: 'ev2_1hour', eventId: 'ev2', alertType: '1hour' }),
        ])
      )
    }

    it('markAsViewed marca apenas o alerta alvo', () => {
      seedTwoAlerts()
      const { result } = renderHook(() => useEventAlerts(), { wrapper })
      expect(result.current.unreadCount).toBe(2)

      act(() => {
        result.current.markAsViewed('ev1_1day')
      })

      expect(result.current.unreadCount).toBe(1)
      expect(result.current.alerts.find((a) => a.id === 'ev1_1day').viewed).toBe(true)
      expect(result.current.alerts.find((a) => a.id === 'ev2_1hour').viewed).toBe(false)
    })

    it('markAllAsViewed zera o unreadCount mantendo os alertas', () => {
      seedTwoAlerts()
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      act(() => {
        result.current.markAllAsViewed()
      })

      expect(result.current.alerts).toHaveLength(2)
      expect(result.current.unreadCount).toBe(0)
      expect(result.current.unreadAlerts).toEqual([])
    })

    it('removeAlert remove apenas o alvo', () => {
      seedTwoAlerts()
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      act(() => {
        result.current.removeAlert('ev1_1day')
      })

      expect(result.current.alerts).toHaveLength(1)
      expect(result.current.alerts[0].id).toBe('ev2_1hour')
    })

    it('clearAllAlerts esvazia tudo e limpa o badge', () => {
      seedTwoAlerts()
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      act(() => {
        result.current.clearAllAlerts()
      })

      expect(result.current.alerts).toEqual([])
      expect(result.current.unreadCount).toBe(0)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([])
      expect(clearAppBadgeMock).toHaveBeenCalled()
    })
  })

  describe('badge do app', () => {
    it('seta o badge com o nº de não-lidos e limpa quando zera', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([makeAlert(), makeAlert({ id: 'ev2_1hour', eventId: 'ev2' })])
      )
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      // Após o mount carregar 2 não-lidos, a última atualização de badge é 2
      expect(setAppBadgeMock).toHaveBeenLastCalledWith(2)

      act(() => {
        result.current.markAllAsViewed()
      })
      expect(clearAppBadgeMock).toHaveBeenCalled()
      expect(setAppBadgeMock).not.toHaveBeenLastCalledWith(0)
    })
  })

  describe('estabilidade de identidade dos callbacks', () => {
    const CALLBACK_KEYS = [
      'requestPermission',
      'scheduleEventAlerts',
      'markAsViewed',
      'markAllAsViewed',
      'removeAlert',
      'clearAllAlerts',
    ]

    it('callbacks mantêm identidade entre rerenders', () => {
      const { result, rerender } = renderHook(() => useEventAlerts(), { wrapper })

      const first = result.current
      rerender()
      const second = result.current

      for (const key of CALLBACK_KEYS) {
        expect(Object.is(first[key], second[key])).toBe(true)
      }
    })

    it('callbacks mantêm identidade após updates de estado', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([makeAlert()]))
      const { result } = renderHook(() => useEventAlerts(), { wrapper })

      const before = result.current
      act(() => {
        result.current.markAllAsViewed()
      })
      const after = result.current

      // O objeto agregado muda (alerts mudou), mas cada callback é estável
      expect(Object.is(before, after)).toBe(false)
      for (const key of CALLBACK_KEYS) {
        expect(Object.is(before[key], after[key])).toBe(true)
      }
    })
  })
})
