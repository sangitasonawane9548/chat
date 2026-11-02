-- =============================================================================
-- Migration: Day 5 Advanced Messaging, Media Sharing & Reactions
-- Database: username_chat_platform
-- =============================================================================

USE `username_chat_platform`;

-- 1. Create message_reactions table
CREATE TABLE IF NOT EXISTS `message_reactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `reaction` VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reaction_msg_user` (`message_id`, `user_id`, `reaction`),
  KEY `idx_reactions_msg` (`message_id`),
  KEY `idx_reactions_user` (`user_id`),
  CONSTRAINT `fk_mr_message` FOREIGN KEY (`message_id`)
    REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_mr_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add forwarded_from_message_id to messages table
SET @col_forwarded = 0;
SELECT COUNT(*) INTO @col_forwarded 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'messages' 
  AND COLUMN_NAME = 'forwarded_from_message_id';

SET @sql_fwd = IF(@col_forwarded = 0, 
  'ALTER TABLE messages ADD COLUMN forwarded_from_message_id BIGINT UNSIGNED NULL AFTER reply_to_message_id, ADD CONSTRAINT fk_messages_forwarded FOREIGN KEY (forwarded_from_message_id) REFERENCES messages(id) ON DELETE SET NULL', 
  'SELECT "Column forwarded_from_message_id already exists"');
PREPARE stmt_fwd FROM @sql_fwd;
EXECUTE stmt_fwd;
DEALLOCATE PREPARE stmt_fwd;

-- 3. Extend message_attachments columns
SET @col_uploaded = 0;
SELECT COUNT(*) INTO @col_uploaded 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'uploaded_by';

SET @sql_up = IF(@col_uploaded = 0, 
  'ALTER TABLE message_attachments ADD COLUMN uploaded_by BIGINT UNSIGNED NULL AFTER message_id, ADD CONSTRAINT fk_ma_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE', 
  'SELECT "Column uploaded_by already exists"');
PREPARE stmt_up FROM @sql_up;
EXECUTE stmt_up;
DEALLOCATE PREPARE stmt_up;

SET @col_orig_fn = 0;
SELECT COUNT(*) INTO @col_orig_fn 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'original_filename';

SET @sql_orig = IF(@col_orig_fn = 0, 
  'ALTER TABLE message_attachments ADD COLUMN original_filename VARCHAR(255) NULL AFTER uploaded_by', 
  'SELECT "Column original_filename already exists"');
PREPARE stmt_orig FROM @sql_orig;
EXECUTE stmt_orig;
DEALLOCATE PREPARE stmt_orig;

SET @col_stor_fn = 0;
SELECT COUNT(*) INTO @col_stor_fn 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'storage_filename';

SET @sql_stor = IF(@col_stor_fn = 0, 
  'ALTER TABLE message_attachments ADD COLUMN storage_filename VARCHAR(255) NULL AFTER original_filename', 
  'SELECT "Column storage_filename already exists"');
PREPARE stmt_stor FROM @sql_stor;
EXECUTE stmt_stor;
DEALLOCATE PREPARE stmt_stor;

SET @col_att_type = 0;
SELECT COUNT(*) INTO @col_att_type 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'attachment_type';

SET @sql_att = IF(@col_att_type = 0, 
  'ALTER TABLE message_attachments ADD COLUMN attachment_type ENUM("image", "video", "audio", "document") NOT NULL DEFAULT "document" AFTER file_size', 
  'SELECT "Column attachment_type already exists"');
PREPARE stmt_att FROM @sql_att;
EXECUTE stmt_att;
DEALLOCATE PREPARE stmt_att;

SET @col_duration = 0;
SELECT COUNT(*) INTO @col_duration 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'duration_seconds';

SET @sql_dur = IF(@col_duration = 0, 
  'ALTER TABLE message_attachments ADD COLUMN duration_seconds INT UNSIGNED NULL AFTER attachment_type', 
  'SELECT "Column duration_seconds already exists"');
PREPARE stmt_dur FROM @sql_dur;
EXECUTE stmt_dur;
DEALLOCATE PREPARE stmt_dur;

SET @col_thumb = 0;
SELECT COUNT(*) INTO @col_thumb 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'message_attachments' 
  AND COLUMN_NAME = 'thumbnail_url';

SET @sql_thm = IF(@col_thumb = 0, 
  'ALTER TABLE message_attachments ADD COLUMN thumbnail_url VARCHAR(1000) NULL AFTER duration_seconds', 
  'SELECT "Column thumbnail_url already exists"');
PREPARE stmt_thm FROM @sql_thm;
EXECUTE stmt_thm;
DEALLOCATE PREPARE stmt_thm;

