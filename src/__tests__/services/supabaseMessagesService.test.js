import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Supabase client
// ============================================================================
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteFn = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockIs = vi.fn();

function createChain(finalData = null, finalError = null) {
  const chain = {
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: finalData, error: finalError })),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: finalData, error: finalError })),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
  };
  return chain;
}

let currentChain;

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => currentChain),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb) => { cb?.('SUBSCRIBED'); return {}; }),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: vi.fn((config) => ({
    cleanup: vi.fn(),
    _config: config, // Expose config for testing
  })),
}));

import supabaseMessagesService from '../../services/supabaseMessagesService';
import { createReliableSubscription } from '../../services/supabaseSubscriptionHelper';

// ============================================================================
// Tests
// ============================================================================
describe('supabaseMessagesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // fetchMessages
  // --------------------------------------------------------------------------
  describe('fetchMessages', () => {
    it('returns empty array for invalid userId', async () => {
      const result = await supabaseMessagesService.fetchMessages('');
      expect(result).toEqual([]);
    });

    it('returns empty array for null userId', async () => {
      const result = await supabaseMessagesService.fetchMessages(null);
      expect(result).toEqual([]);
    });

    it('fetches and transforms messages to camelCase', async () => {
      const dbRows = [
        {
          id: 'msg-1',
          sender_id: 'user-a',
          sender_name: 'Alice',
          recipient_id: 'user-b',
          recipient_name: 'Bob',
          read_at: null,
          is_archived: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          thread_id: null,
          parent_message_id: null,
        },
      ];

      currentChain = createChain(dbRows, null);
      // Override limit to return array result
      currentChain.limit = vi.fn(() => Promise.resolve({ data: dbRows, error: null }));

      const result = await supabaseMessagesService.fetchMessages('user-b');

      expect(result).toHaveLength(1);
      expect(result[0].senderId).toBe('user-a');
      expect(result[0].senderName).toBe('Alice');
      expect(result[0].recipientId).toBe('user-b');
      expect(result[0].readAt).toBeNull();
      expect(result[0].isArchived).toBe(false);
      expect(result[0].createdAt).toBe('2026-01-01T00:00:00Z');
    });

    it('returns empty array when table does not exist', async () => {
      currentChain = createChain(null, { code: 'PGRST205', message: 'table does not exist' });
      currentChain.limit = vi.fn(() =>
        Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'table does not exist' } })
      );

      const result = await supabaseMessagesService.fetchMessages('user-a');
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // sendMessage
  // --------------------------------------------------------------------------
  describe('sendMessage', () => {
    it('sends message and returns camelCase result', async () => {
      const dbResult = {
        id: 'msg-new',
        type: 'private',
        subject: 'Test',
        content: 'Hello',
        sender_id: 'user-a',
        sender_name: 'Alice',
        sender_role: '',
        sender_avatar: null,
        recipient_id: 'user-b',
        recipient_name: 'Bob',
        priority: 'normal',
        is_archived: false,
        read_at: null,
        thread_id: null,
        parent_message_id: null,
        attachments: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      currentChain = createChain(dbResult, null);

      const result = await supabaseMessagesService.sendMessage({
        subject: 'Test',
        content: 'Hello',
        senderId: 'user-a',
        senderName: 'Alice',
        recipientId: 'user-b',
        recipientName: 'Bob',
      });

      expect(result.id).toBe('msg-new');
      expect(result.senderId).toBe('user-a');
      expect(result.recipientId).toBe('user-b');
    });

    it('throws on error', async () => {
      currentChain = createChain(null, { code: '42501', message: 'RLS violation' });

      await expect(
        supabaseMessagesService.sendMessage({
          subject: 'Test',
          content: 'Hello',
          senderId: 'user-a',
          recipientId: 'user-b',
        })
      ).rejects.toThrow('sendMessage');
    });
  });

  // --------------------------------------------------------------------------
  // markAsRead
  // --------------------------------------------------------------------------
  describe('markAsRead', () => {
    it('updates read_at and returns camelCase result', async () => {
      const dbResult = {
        id: 'msg-1',
        read_at: '2026-01-01T12:00:00Z',
        sender_id: 'user-a',
        recipient_id: 'user-b',
      };

      currentChain = createChain(dbResult, null);

      const result = await supabaseMessagesService.markAsRead('msg-1');
      expect(result.readAt).toBe('2026-01-01T12:00:00Z');
    });
  });

  // --------------------------------------------------------------------------
  // deleteMessage
  // --------------------------------------------------------------------------
  describe('deleteMessage', () => {
    it('returns true on success', async () => {
      currentChain = createChain(null, null);
      // Delete doesn't call single(), only eq() which returns the chain
      // The chain.eq resolves without error
      currentChain.eq = vi.fn(() => Promise.resolve({ error: null }));

      const result = await supabaseMessagesService.deleteMessage('msg-1');
      expect(result).toBe(true);
    });

    it('throws on RLS error', async () => {
      currentChain = createChain(null, null);
      currentChain.eq = vi.fn(() =>
        Promise.resolve({ error: { code: '42501', message: 'permission denied' } })
      );

      await expect(
        supabaseMessagesService.deleteMessage('msg-1')
      ).rejects.toThrow('deleteMessage');
    });
  });

  // --------------------------------------------------------------------------
  // subscribeToMessages — filtered subscriptions
  // --------------------------------------------------------------------------
  describe('subscribeToMessages', () => {
    it('creates TWO subscriptions with recipient and sender filters', () => {
      const callback = vi.fn();
      const onRefetch = vi.fn();

      const { cleanup } = supabaseMessagesService.subscribeToMessages('user-123', callback, onRefetch);

      // Should create 2 subscriptions
      expect(createReliableSubscription).toHaveBeenCalledTimes(2);

      // First: recipient filter
      const call1 = createReliableSubscription.mock.calls[0][0];
      expect(call1.channelName).toBe('messages-recipient-user-123');
      expect(call1.filter).toBe('recipient_id=eq.user-123');
      expect(call1.table).toBe('messages');
      expect(call1.onRefetch).toBe(onRefetch);

      // Second: sender filter
      const call2 = createReliableSubscription.mock.calls[1][0];
      expect(call2.channelName).toBe('messages-sender-user-123');
      expect(call2.filter).toBe('sender_id=eq.user-123');
      expect(call2.table).toBe('messages');
      // Only first subscription should trigger refetch
      expect(call2.onRefetch).toBeUndefined();

      // Cleanup should call both
      cleanup();
    });

    it('deduplicates events from both subscriptions', () => {
      const userCallback = vi.fn();

      supabaseMessagesService.subscribeToMessages('user-123', userCallback);

      // Get the dedup callback passed to createReliableSubscription
      const dedupCb1 = createReliableSubscription.mock.calls[0][0].callback;
      const dedupCb2 = createReliableSubscription.mock.calls[1][0].callback;

      const payload = {
        eventType: 'INSERT',
        new: { id: 'msg-1', senderId: 'user-123', recipientId: 'user-123' },
        old: null,
      };

      // First call from recipient subscription
      dedupCb1(payload);
      expect(userCallback).toHaveBeenCalledTimes(1);

      // Second call from sender subscription (same event) — should be deduped
      dedupCb2(payload);
      expect(userCallback).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // subscribeToNotifications — single filtered subscription
  // --------------------------------------------------------------------------
  describe('subscribeToNotifications', () => {
    it('creates a subscription with recipient_id filter', () => {
      const callback = vi.fn();

      supabaseMessagesService.subscribeToNotifications('user-456', callback);

      expect(createReliableSubscription).toHaveBeenCalledTimes(1);

      const config = createReliableSubscription.mock.calls[0][0];
      expect(config.channelName).toBe('notifications-user-user-456');
      expect(config.filter).toBe('recipient_id=eq.user-456');
      expect(config.table).toBe('notifications');
    });
  });

  // --------------------------------------------------------------------------
  // Notifications CRUD
  // --------------------------------------------------------------------------
  describe('fetchNotifications', () => {
    it('returns empty array for invalid userId', async () => {
      const result = await supabaseMessagesService.fetchNotifications('');
      expect(result).toEqual([]);
    });

    it('fetches and transforms notifications to camelCase', async () => {
      const dbRows = [
        {
          id: 'notif-1',
          recipient_id: 'user-a',
          category: 'sistema',
          subject: 'Test Notif',
          content: 'Hello',
          sender_name: 'Sistema ANEST',
          read_at: null,
          created_at: '2026-01-01T00:00:00Z',
          action_url: null,
          action_label: null,
          action_params: null,
          related_entity_type: null,
          related_entity_id: null,
        },
      ];

      currentChain = createChain(dbRows, null);
      currentChain.limit = vi.fn(() => Promise.resolve({ data: dbRows, error: null }));

      const result = await supabaseMessagesService.fetchNotifications('user-a');

      expect(result).toHaveLength(1);
      expect(result[0].recipientId).toBe('user-a');
      expect(result[0].senderName).toBe('Sistema ANEST');
      expect(result[0].readAt).toBeNull();
    });
  });

  describe('dismissNotification', () => {
    it('returns true on success', async () => {
      currentChain = createChain(null, null);
      currentChain.eq = vi.fn(() => Promise.resolve({ error: null }));

      const result = await supabaseMessagesService.dismissNotification('notif-1');
      expect(result).toBe(true);
    });
  });
});
