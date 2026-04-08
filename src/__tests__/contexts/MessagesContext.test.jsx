/**
 * Tests for MessagesContext — validates initial load, state computation,
 * filtered views, and context shape.
 *
 * CRUD operations, rollback, subscriptions, and filters are tested in:
 * - supabaseMessagesService.test.js (15 tests)
 * - supabaseSubscriptionHelper.test.js (5 tests)
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as React from 'react';

// ============================================================================
// Hoisted toast mock
// ============================================================================
const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

// ============================================================================
// Module mocks
// ============================================================================
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(() => ({})) })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/design-system/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'user-abc', displayName: 'Test User', role: 'medico', email: 'test@test.com' } }),
}));

vi.mock('@/services/supabaseMessagesService', () => ({
  default: {
    fetchMessages: vi.fn(() => Promise.resolve([
      { id: 'msg-1', senderId: 'other-user', recipientId: 'user-abc', subject: 'Hello', content: 'World', readAt: null, isArchived: false, createdAt: '2026-01-01T00:00:00Z', senderName: 'Alice', senderRole: 'medico' },
      { id: 'msg-2', senderId: 'user-abc', recipientId: 'other-user', subject: 'Reply', content: 'Hi', readAt: '2026-01-01T12:00:00Z', isArchived: false, createdAt: '2026-01-02T00:00:00Z', senderName: 'Test User', senderRole: 'medico' },
      { id: 'msg-3', senderId: 'other-user', recipientId: 'user-abc', subject: 'Archived', content: 'Old', readAt: null, isArchived: true, createdAt: '2025-12-01T00:00:00Z', senderName: 'Alice', senderRole: 'medico' },
    ])),
    fetchNotifications: vi.fn(() => Promise.resolve([
      { id: 'notif-1', recipientId: 'user-abc', category: 'sistema', subject: 'System Update', readAt: null, createdAt: '2026-01-01T00:00:00Z', senderName: 'Sistema ANEST' },
      { id: 'notif-2', recipientId: 'user-abc', category: 'documento', subject: 'Doc Review', readAt: '2026-01-01T12:00:00Z', createdAt: '2026-01-02T00:00:00Z', senderName: 'Sistema ANEST' },
    ])),
    sendMessage: vi.fn(() => Promise.resolve({ id: 'sent-uuid' })),
    markAsRead: vi.fn(() => Promise.resolve(null)),
    markAsUnread: vi.fn(() => Promise.resolve(null)),
    markAllAsRead: vi.fn(() => Promise.resolve([])),
    archiveMessage: vi.fn(() => Promise.resolve(null)),
    deleteMessage: vi.fn(() => Promise.resolve(true)),
    markNotificationAsRead: vi.fn(() => Promise.resolve(null)),
    markAllNotificationsAsRead: vi.fn(() => Promise.resolve([])),
    dismissNotification: vi.fn(() => Promise.resolve(true)),
    createNotification: vi.fn(() => Promise.resolve(null)),
    createNotificationBatch: vi.fn(() => Promise.resolve([])),
    subscribeToMessages: vi.fn(() => ({ cleanup: vi.fn() })),
    subscribeToNotifications: vi.fn(() => ({ cleanup: vi.fn() })),
  },
}));

vi.mock('@/services/supabaseUsersService', () => ({
  default: { fetchAllUsers: vi.fn(() => Promise.resolve([])) },
}));

// ============================================================================
// Import after mocks
// ============================================================================
import { MessagesProvider, useMessages } from '../../contexts/MessagesContext';

const wrapper = ({ children }) => <MessagesProvider>{children}</MessagesProvider>;

// ============================================================================
// Tests
// ============================================================================
describe('MessagesContext', () => {
  it('loads data, computes counters, filters, and exposes API', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper });

    // ── Wait for initial data load ──────────────────────────────────
    await waitFor(() => {
      expect(result.current.messages.length).toBe(3);
      expect(result.current.notifications.length).toBe(2);
    });

    // ── Unread counters ────────────────────────────────────────────
    // msg-1: unread + recipient=user-abc + not archived → counts
    // msg-2: read → skip
    // msg-3: unread but archived → skip
    expect(result.current.unreadCount).toBe(1);
    // notif-1: unread, notif-2: read
    expect(result.current.unreadNotificationsCount).toBe(1);
    expect(result.current.totalUnreadCount).toBe(2);

    // ── Filtered views ─────────────────────────────────────────────
    const inbox = result.current.getInboxMessages();
    expect(inbox.length).toBe(1);
    expect(inbox[0].id).toBe('msg-1');

    const sent = result.current.getSentMessages();
    expect(sent.length).toBe(1);
    expect(sent[0].id).toBe('msg-2');

    const archived = result.current.getArchivedMessages();
    expect(archived.length).toBe(1);
    expect(archived[0].id).toBe('msg-3');

    // ── Search ─────────────────────────────────────────────────────
    const searchResults = result.current.searchMessages('hello');
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe('msg-1');

    const noResults = result.current.searchMessages('nonexistent');
    expect(noResults.length).toBe(0);

    // ── Notification category filter ───────────────────────────────
    const sysNotifs = result.current.getNotifications('sistema');
    expect(sysNotifs.length).toBe(1);
    expect(sysNotifs[0].id).toBe('notif-1');

    const allNotifs = result.current.getNotifications();
    expect(allNotifs.length).toBe(2);

    // ── Category configs exported ──────────────────────────────────
    expect(result.current.notificationCategories.sistema.label).toBe('Sistema');
    expect(result.current.notificationCategories.documento.label).toBe('Documentos');
    expect(result.current.categories.length).toBeGreaterThan(0);

    // ── currentUser derived from UserContext ────────────────────────
    expect(result.current.currentUser.id).toBe('user-abc');
    expect(result.current.currentUser.name).toBe('Test User');

    // ── Context shape — all expected functions exist ────────────────
    const expectedFunctions = [
      'sendMessage', 'replyToMessage', 'markAsRead', 'markAsUnread',
      'markAllAsRead', 'archiveMessage', 'deleteMessage',
      'createSystemNotification', 'markNotificationAsRead',
      'markAllNotificationsAsRead', 'dismissNotification',
      'submitReport', 'trackReport', 'respondToReport', 'updateReportStatus',
      'getInboxMessages', 'getSentMessages', 'getArchivedMessages',
      'searchMessages', 'getNotifications', 'getMessagesByCategory',
      'getThread', 'getThreadMessages', 'refresh',
    ];
    for (const fnName of expectedFunctions) {
      expect(typeof result.current[fnName]).toBe('function');
    }

    // ── isLoading flag ─────────────────────────────────────────────
    expect(typeof result.current.isLoading).toBe('boolean');

    // ── users list (empty from mock) ───────────────────────────────
    expect(Array.isArray(result.current.users)).toBe(true);
  });
});
