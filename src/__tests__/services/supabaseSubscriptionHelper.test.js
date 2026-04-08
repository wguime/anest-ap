import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Hoisted mocks (available in vi.mock factories)
// ============================================================================
const { mockRemoveChannel, capturedCallbacks } = vi.hoisted(() => ({
  mockRemoveChannel: vi.fn(),
  capturedCallbacks: { on: null, subscribe: null },
}));

vi.mock('@/config/supabase', () => {
  const channelObj = {
    on: vi.fn((_type, _config, cb) => {
      capturedCallbacks.on = cb;
      return channelObj;
    }),
    subscribe: vi.fn((cb) => {
      capturedCallbacks.subscribe = cb;
      return channelObj;
    }),
  };

  return {
    supabase: {
      channel: vi.fn(() => channelObj),
      removeChannel: mockRemoveChannel,
    },
  };
});

import { createReliableSubscription } from '../../services/supabaseSubscriptionHelper';
import { supabase } from '@/config/supabase';

// ============================================================================
// Tests
// ============================================================================
describe('supabaseSubscriptionHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallbacks.on = null;
    capturedCallbacks.subscribe = null;
  });

  it('creates subscription without filter when not provided', () => {
    createReliableSubscription({
      channelName: 'test-no-filter',
      table: 'messages',
      event: '*',
      callback: vi.fn(),
    });

    const channelInstance = supabase.channel();
    const onCall = channelInstance.on;
    const configArg = onCall.mock.calls[0]?.[1];

    expect(configArg).toEqual({
      event: '*',
      schema: 'public',
      table: 'messages',
    });
  });

  it('passes filter to postgres_changes when provided', () => {
    createReliableSubscription({
      channelName: 'test-filter',
      table: 'messages',
      event: '*',
      filter: 'recipient_id=eq.user123',
      callback: vi.fn(),
    });

    const channelInstance = supabase.channel();
    const onCall = channelInstance.on;
    const configArg = onCall.mock.calls[0]?.[1];

    expect(configArg).toEqual({
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: 'recipient_id=eq.user123',
    });
  });

  it('applies transformRow to INSERT payload', () => {
    const callback = vi.fn();
    const transformRow = vi.fn((row) => ({ ...row, transformed: true }));

    createReliableSubscription({
      channelName: 'test-transform',
      table: 'messages',
      callback,
      transformRow,
    });

    expect(capturedCallbacks.on).toBeTruthy();
    capturedCallbacks.on({
      eventType: 'INSERT',
      new: { id: '1', sender_id: 'abc' },
      old: null,
    });

    expect(transformRow).toHaveBeenCalledWith({ id: '1', sender_id: 'abc' });
    expect(callback).toHaveBeenCalledWith({
      eventType: 'INSERT',
      new: { id: '1', sender_id: 'abc', transformed: true },
      old: null,
    });
  });

  it('applies transformRow to DELETE payload old row', () => {
    const callback = vi.fn();
    const transformRow = vi.fn((row) => ({ ...row, t: true }));

    createReliableSubscription({
      channelName: 'test-delete',
      table: 'messages',
      callback,
      transformRow,
    });

    capturedCallbacks.on({
      eventType: 'DELETE',
      new: null,
      old: { id: 'msg-1' },
    });

    expect(callback).toHaveBeenCalledWith({
      eventType: 'DELETE',
      new: null,
      old: { id: 'msg-1', t: true },
    });
  });

  it('cleanup removes channel', () => {
    const { cleanup } = createReliableSubscription({
      channelName: 'test-cleanup',
      table: 'messages',
      callback: vi.fn(),
    });

    cleanup();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
