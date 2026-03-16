// EventAlertsContext.jsx
// Context para gerenciar alertas de eventos com notificações push

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const EventAlertsContext = createContext(null);

// Constantes
const STORAGE_KEY = 'anest_event_alerts';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Helper para formatar data
const formatEventDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function EventAlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [permission, setPermission] = useState('default');

  // Carregar alertas do localStorage ao iniciar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Filtrar alertas expirados (evento já passou)
        const now = new Date().getTime();
        const valid = parsed.filter((alert) => new Date(alert.eventDate).getTime() > now);
        setAlerts(valid);
        if (valid.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        }
      } catch (e) {
        console.error('Erro ao carregar alertas:', e);
      }
    }

    // Verificar permissão de notificação
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Salvar alertas no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    // Atualizar badge do app
    updateAppBadge();
  }, [alerts]);

  // Atualizar badge do ícone do app
  const updateAppBadge = useCallback(() => {
    const unreadCount = alerts.filter((a) => !a.viewed).length;
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(console.error);
      } else {
        navigator.clearAppBadge().catch(console.error);
      }
    }
  }, [alerts]);

  // Solicitar permissão para notificações
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Notificações não suportadas neste navegador');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }

    return false;
  }, []);

  // Agendar notificação
  const scheduleNotification = useCallback((eventId, eventTitle, eventDate, millisBefore, alertType) => {
    const eventTime = new Date(eventDate).getTime();
    const notifyTime = eventTime - millisBefore;
    const now = Date.now();

    if (notifyTime <= now) {
      // Já passou o tempo de notificar
      return null;
    }

    const delay = notifyTime - now;
    const alertId = `${eventId}_${alertType}`;

    // Agendar timeout
    const timeoutId = setTimeout(() => {
      // Criar alerta visual
      const newAlert = {
        id: alertId,
        eventId,
        eventTitle,
        eventDate,
        alertType,
        createdAt: new Date().toISOString(),
        viewed: false,
        message:
          alertType === '1day'
            ? `Evento amanhã: ${eventTitle}`
            : `Evento em 1 hora: ${eventTitle}`,
      };

      setAlerts((prev) => {
        // Evitar duplicatas
        if (prev.some((a) => a.id === alertId)) return prev;
        return [...prev, newAlert];
      });

      // Mostrar notificação push
      if (Notification.permission === 'granted') {
        const notification = new Notification('ANEST - Lembrete de Evento', {
          body: newAlert.message + `\n${formatEventDateTime(eventDate)}`,
          icon: '/logo-anest.png',
          badge: '/logo-anest.png',
          tag: alertId,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }, delay);

    return timeoutId;
  }, []);

  // Agendar alertas para um evento (1 dia antes e 1 hora antes)
  const scheduleEventAlerts = useCallback(
    async (eventId, eventTitle, eventDate) => {
      // Solicitar permissão primeiro
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        console.warn('Permissão de notificação negada');
      }

      // Agendar 1 dia antes
      scheduleNotification(eventId, eventTitle, eventDate, ONE_DAY_MS, '1day');

      // Agendar 1 hora antes
      scheduleNotification(eventId, eventTitle, eventDate, ONE_HOUR_MS, '1hour');

      // Salvar info do evento para recriar timeouts se necessário
      const eventInfo = {
        id: eventId,
        title: eventTitle,
        eventDate,
        scheduledAt: new Date().toISOString(),
      };

      // Armazenar eventos agendados separadamente
      const scheduledKey = 'anest_scheduled_events';
      const scheduled = JSON.parse(localStorage.getItem(scheduledKey) || '[]');
      if (!scheduled.some((e) => e.id === eventId)) {
        scheduled.push(eventInfo);
        localStorage.setItem(scheduledKey, JSON.stringify(scheduled));
      }
    },
    [requestPermission, scheduleNotification]
  );

  // Marcar alerta como visto
  const markAsViewed = useCallback((alertId) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, viewed: true } : alert
      )
    );
  }, []);

  // Marcar todos como vistos
  const markAllAsViewed = useCallback(() => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, viewed: true })));
  }, []);

  // Remover alerta
  const removeAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  // Limpar todos os alertas
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(console.error);
    }
  }, []);

  // Alertas não lidos
  const unreadAlerts = alerts.filter((a) => !a.viewed);
  const unreadCount = unreadAlerts.length;

  const value = {
    alerts,
    unreadAlerts,
    unreadCount,
    permission,
    requestPermission,
    scheduleEventAlerts,
    markAsViewed,
    markAllAsViewed,
    removeAlert,
    clearAllAlerts,
  };

  return (
    <EventAlertsContext.Provider value={value}>
      {children}
    </EventAlertsContext.Provider>
  );
}

export function useEventAlerts() {
  const context = useContext(EventAlertsContext);
  if (!context) {
    throw new Error('useEventAlerts must be used within EventAlertsProvider');
  }
  return context;
}

export default EventAlertsContext;
