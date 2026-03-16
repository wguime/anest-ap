/**
 * Supabase Messages Service — Mensagens Privadas entre Usuarios
 *
 * CRUD completo + real-time subscriptions para mensagens internas.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseIncidentsService.js.
 *
 * ---------------------------------------------------------------
 * EXPECTED SQL SCHEMA (messages table):
 * ---------------------------------------------------------------
 * CREATE TABLE IF NOT EXISTS public.messages (
 *   id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   type          text NOT NULL DEFAULT 'private',          -- 'private'
 *   subject       text NOT NULL,
 *   content       text NOT NULL,
 *   sender_id     text NOT NULL,                            -- Firebase UID
 *   sender_name   text NOT NULL DEFAULT '',
 *   sender_role   text DEFAULT '',
 *   sender_avatar text,
 *   recipient_id  text NOT NULL,                            -- Firebase UID
 *   recipient_name text NOT NULL DEFAULT '',
 *   priority      text NOT NULL DEFAULT 'normal',           -- 'normal', 'alta', 'urgente'
 *   read_at       timestamptz,
 *   is_archived   boolean NOT NULL DEFAULT false,
 *   thread_id     text,
 *   parent_message_id uuid REFERENCES public.messages(id),
 *   attachments   jsonb DEFAULT '[]'::jsonb,
 *   created_at    timestamptz DEFAULT now(),
 *   updated_at    timestamptz DEFAULT now()
 * );
 *
 * -- Indexes
 * CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
 * CREATE INDEX idx_messages_sender    ON public.messages(sender_id);
 * CREATE INDEX idx_messages_thread    ON public.messages(thread_id);
 * CREATE INDEX idx_messages_created   ON public.messages(created_at DESC);
 *
 * -- RLS
 * ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can see own messages"
 *   ON public.messages FOR SELECT
 *   USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
 *
 * CREATE POLICY "Authenticated users can send messages"
 *   ON public.messages FOR INSERT
 *   WITH CHECK (auth.uid()::text = sender_id);
 *
 * CREATE POLICY "Recipients can update (mark read, archive)"
 *   ON public.messages FOR UPDATE
 *   USING (auth.uid()::text = recipient_id OR auth.uid()::text = sender_id);
 *
 * CREATE POLICY "Users can delete own messages"
 *   ON public.messages FOR DELETE
 *   USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
 *
 * -- Enable Realtime
 * ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
 * ---------------------------------------------------------------
 */
import { supabase } from '@/config/supabase'
import { createReliableSubscription } from './supabaseSubscriptionHelper'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  senderId: 'sender_id',
  senderName: 'sender_name',
  senderRole: 'sender_role',
  senderAvatar: 'sender_avatar',
  recipientId: 'recipient_id',
  recipientName: 'recipient_name',
  threadId: 'thread_id',
  readAt: 'read_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  isArchived: 'is_archived',
  parentMessageId: 'parent_message_id',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
}

function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function isValidUserId(str) {
  return typeof str === 'string' && str.trim().length > 0
}

function handleError(error, context) {
  // PGRST205 = table not found — tables may not be created yet, return gracefully
  if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
    console.warn(`[SupabaseMessagesService] ${context}: table not found (${error.code}). Skipping.`)
    return 'TABLE_NOT_FOUND'
  }
  console.error(`[SupabaseMessagesService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Fetch all messages where user is sender or recipient.
 * Returns sorted by created_at descending.
 */
async function fetchMessages(userId, options = {}) {
  if (!isValidUserId(userId)) return []
  const { limit = 200 } = options

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (handleError(error, 'fetchMessages') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(toCamelCase)
}

/**
 * Fetch threads where user is a participant.
 * Groups messages by thread_id and returns metadata.
 */
async function fetchThreads(userId, options = {}) {
  if (!isValidUserId(userId)) return []
  const { limit = 100 } = options

  const { data, error } = await supabase
    .from('messages')
    .select('thread_id, subject, created_at, sender_id, recipient_id')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .not('thread_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (handleError(error, 'fetchThreads') === 'TABLE_NOT_FOUND') return []
  }

  // Group by thread_id, keep most recent message per thread
  const threadMap = new Map()
  for (const row of data || []) {
    if (!threadMap.has(row.thread_id)) {
      threadMap.set(row.thread_id, toCamelCase(row))
    }
  }
  return Array.from(threadMap.values())
}

/**
 * Fetch a single message by ID.
 */
async function fetchMessageById(messageId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single()

  if (error) {
    if (handleError(error, 'fetchMessageById') === 'TABLE_NOT_FOUND') return null
  }
  return toCamelCase(data)
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Send a new message.
 * @param {Object} messageData - { senderId, senderName, senderRole, senderAvatar, recipientId, recipientName, content, subject, threadId, priority, parentMessageId, attachments }
 * @returns {Object} The created message in camelCase
 */
async function sendMessage(messageData) {
  const row = {
    type: messageData.type || 'private',
    subject: messageData.subject,
    content: messageData.content,
    sender_id: messageData.senderId,
    sender_name: messageData.senderName || '',
    sender_role: messageData.senderRole || '',
    sender_avatar: messageData.senderAvatar || null,
    recipient_id: messageData.recipientId,
    recipient_name: messageData.recipientName || '',
    priority: messageData.priority || 'normal',
    is_archived: false,
    thread_id: messageData.threadId || null,
    parent_message_id: messageData.parentMessageId || null,
    attachments: messageData.attachments || [],
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'sendMessage')
  return toCamelCase(data)
}

/**
 * Mark a message as read.
 */
async function markAsRead(messageId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()

  if (error) handleError(error, 'markAsRead')
  return toCamelCase(data)
}

/**
 * Mark a message as unread.
 */
async function markAsUnread(messageId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: null })
    .eq('id', messageId)
    .select()
    .single()

  if (error) handleError(error, 'markAsUnread')
  return toCamelCase(data)
}

/**
 * Mark all unread messages for a user as read.
 */
async function markAllAsRead(userId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null)
    .select()

  if (error) handleError(error, 'markAllAsRead')
  return (data || []).map(toCamelCase)
}

/**
 * Archive a message.
 */
async function archiveMessage(messageId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ is_archived: true })
    .eq('id', messageId)
    .select()
    .single()

  if (error) handleError(error, 'archiveMessage')
  return toCamelCase(data)
}

/**
 * Delete a message.
 */
async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)

  if (error) handleError(error, 'deleteMessage')
  return true
}

// ============================================================================
// REAL-TIME — MESSAGES
// ============================================================================

/**
 * Subscribe to real-time changes on messages for a specific user.
 * Uses createReliableSubscription for automatic reconnection.
 *
 * @param {string} userId - Firebase UID
 * @param {Function} callback - Called with { eventType, new, old } on changes
 * @param {Function} [onRefetch] - Called on reconnection to re-fetch full data
 * @returns {{ cleanup: Function }}
 */
function subscribeToMessages(userId, callback, onRefetch) {
  return createReliableSubscription({
    channelName: `messages-user-${userId}`,
    table: 'messages',
    event: '*',
    callback,
    transformRow: toCamelCase,
    onRefetch,
  })
}

// ============================================================================
// NOTIFICATIONS — FIELD MAPPING
// ============================================================================

const NOTIF_CAMEL_TO_SNAKE = {
  recipientId: 'recipient_id',
  senderName: 'sender_name',
  readAt: 'read_at',
  actionUrl: 'action_url',
  actionLabel: 'action_label',
  actionParams: 'action_params',
  relatedEntityType: 'related_entity_type',
  relatedEntityId: 'related_entity_id',
  createdAt: 'created_at',
}

const NOTIF_SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(NOTIF_CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function notifToCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(notifToCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = NOTIF_SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// NOTIFICATIONS — LEITURA
// ============================================================================

/**
 * Fetch all notifications for a user.
 */
async function fetchNotifications(userId, options = {}) {
  if (!isValidUserId(userId)) return []
  const { limit = 200 } = options

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (handleError(error, 'fetchNotifications') === 'TABLE_NOT_FOUND') return []
  }
  return (data || []).map(notifToCamelCase)
}

// ============================================================================
// NOTIFICATIONS — ESCRITA
// ============================================================================

/**
 * Create a single notification.
 * @param {Object} data - { recipientId, category, subject, content, senderName, priority, actionUrl, actionLabel, actionParams, dismissable, relatedEntityType, relatedEntityId }
 */
async function createNotification(notifData) {
  const row = {
    recipient_id: notifData.recipientId,
    category: notifData.category || 'sistema',
    subject: notifData.subject,
    content: notifData.content || null,
    sender_name: notifData.senderName || 'Sistema ANEST',
    priority: notifData.priority || 'normal',
    action_url: notifData.actionUrl || null,
    action_label: notifData.actionLabel || null,
    action_params: notifData.actionParams || null,
    dismissable: notifData.dismissable !== false,
    related_entity_type: notifData.relatedEntityType || null,
    related_entity_id: notifData.relatedEntityId || null,
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createNotification')
  return notifToCamelCase(data)
}

/**
 * Create notifications for multiple recipients (batch insert).
 * @param {string[]} recipientIds - Array of Firebase UIDs
 * @param {Object} notifData - Notification data (without recipientId)
 */
async function createNotificationBatch(recipientIds, notifData) {
  if (!recipientIds || recipientIds.length === 0) return []

  const rows = recipientIds.map((recipientId) => ({
    recipient_id: recipientId,
    category: notifData.category || 'sistema',
    subject: notifData.subject,
    content: notifData.content || null,
    sender_name: notifData.senderName || 'Sistema ANEST',
    priority: notifData.priority || 'normal',
    action_url: notifData.actionUrl || null,
    action_label: notifData.actionLabel || null,
    action_params: notifData.actionParams || null,
    dismissable: notifData.dismissable !== false,
    related_entity_type: notifData.relatedEntityType || null,
    related_entity_id: notifData.relatedEntityId || null,
  }))

  const { data, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select()

  if (error) handleError(error, 'createNotificationBatch')
  return (data || []).map(notifToCamelCase)
}

/**
 * Mark a notification as read.
 */
async function markNotificationAsRead(notifId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
    .select()
    .single()

  if (error) handleError(error, 'markNotificationAsRead')
  return notifToCamelCase(data)
}

/**
 * Mark all unread notifications for a user as read.
 */
async function markAllNotificationsAsRead(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null)
    .select()

  if (error) handleError(error, 'markAllNotificationsAsRead')
  return (data || []).map(notifToCamelCase)
}

/**
 * Dismiss (delete) a notification.
 */
async function dismissNotification(notifId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notifId)

  if (error) handleError(error, 'dismissNotification')
  return true
}

// ============================================================================
// REAL-TIME — NOTIFICATIONS
// ============================================================================

/**
 * Subscribe to real-time changes on notifications for a specific user.
 */
function subscribeToNotifications(userId, callback, onRefetch) {
  return createReliableSubscription({
    channelName: `notifications-user-${userId}`,
    table: 'notifications',
    event: '*',
    callback,
    transformRow: notifToCamelCase,
    onRefetch,
  })
}

// ============================================================================
// EXPORT
// ============================================================================

export { toCamelCase as messagesToCamelCase, notifToCamelCase }

const supabaseMessagesService = {
  // Messages
  fetchMessages,
  fetchThreads,
  fetchMessageById,
  sendMessage,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  archiveMessage,
  deleteMessage,
  subscribeToMessages,
  // Notifications
  fetchNotifications,
  createNotification,
  createNotificationBatch,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  subscribeToNotifications,
}

export default supabaseMessagesService
