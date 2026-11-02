-- =============================================================================
-- DAY 10: PRODUCTION OPTIMIZATION & PERFORMANCE INDEXES
-- =============================================================================

USE username_chat_platform;

-- 1. Expand notifications notification_type for full category support
ALTER TABLE notifications MODIFY COLUMN notification_type VARCHAR(50) NOT NULL;

-- 2. Performance index on messages for paginated conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages (conversation_id, id DESC);

-- 3. Performance composite index on notifications for user badge checks
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications (user_id, is_read, created_at DESC);

-- 4. Composite index on chat_requests for quick pair lookup
CREATE INDEX IF NOT EXISTS idx_cr_pair_status ON chat_requests (sender_id, receiver_id, status);

-- 5. Performance index on conversation_members for direct member checks
CREATE INDEX IF NOT EXISTS idx_cm_user_conv ON conversation_members (user_id, conversation_id);

-- 6. Performance index on group_members for permission lookups
CREATE INDEX IF NOT EXISTS idx_gm_group_user_role ON group_members (group_id, user_id, role);

