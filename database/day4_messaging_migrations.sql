-- =============================================================================
-- Migration: Day 4 Real-Time One-to-One Messaging System
-- Database: username_chat_platform
-- =============================================================================

USE `username_chat_platform`;

-- 1. Create message_user_deletions table for "Delete For Me"
CREATE TABLE IF NOT EXISTS `message_user_deletions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mud_message_user` (`message_id`, `user_id`),
  KEY `idx_mud_user_id` (`user_id`),
  KEY `idx_mud_message_id` (`message_id`),
  CONSTRAINT `fk_mud_message` FOREIGN KEY (`message_id`)
    REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_mud_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add client_message_id and deleted_for_everyone to messages table
SET @col_exists1 = 0;
SELECT COUNT(*) INTO @col_exists1 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'messages' 
  AND COLUMN_NAME = 'client_message_id';

SET @sql1 = IF(@col_exists1 = 0, 'ALTER TABLE messages ADD COLUMN client_message_id VARCHAR(100) NULL AFTER reply_to_message_id, ADD INDEX idx_messages_client_id (client_message_id)', 'SELECT "Column client_message_id already exists"');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col_exists2 = 0;
SELECT COUNT(*) INTO @col_exists2 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'messages' 
  AND COLUMN_NAME = 'deleted_for_everyone';

SET @sql2 = IF(@col_exists2 = 0, 'ALTER TABLE messages ADD COLUMN deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE AFTER is_edited', 'SELECT "Column deleted_for_everyone already exists"');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. Extend conversation_members table
SET @col_exists3 = 0;
SELECT COUNT(*) INTO @col_exists3 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'conversation_members' 
  AND COLUMN_NAME = 'last_read_message_id';

SET @sql3 = IF(@col_exists3 = 0, 'ALTER TABLE conversation_members ADD COLUMN last_read_message_id BIGINT UNSIGNED NULL AFTER joined_at', 'SELECT "Column last_read_message_id already exists"');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @col_exists4 = 0;
SELECT COUNT(*) INTO @col_exists4 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'conversation_members' 
  AND COLUMN_NAME = 'last_read_at';

SET @sql4 = IF(@col_exists4 = 0, 'ALTER TABLE conversation_members ADD COLUMN last_read_at TIMESTAMP NULL AFTER last_read_message_id', 'SELECT "Column last_read_at already exists"');
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

SET @col_exists5 = 0;
SELECT COUNT(*) INTO @col_exists5 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'conversation_members' 
  AND COLUMN_NAME = 'cleared_at';

SET @sql5 = IF(@col_exists5 = 0, 'ALTER TABLE conversation_members ADD COLUMN cleared_at TIMESTAMP NULL AFTER last_read_at', 'SELECT "Column cleared_at already exists"');
PREPARE stmt5 FROM @sql5;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

SET @col_exists6 = 0;
SELECT COUNT(*) INTO @col_exists6 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'conversation_members' 
  AND COLUMN_NAME = 'archived_at';

SET @sql6 = IF(@col_exists6 = 0, 'ALTER TABLE conversation_members ADD COLUMN archived_at TIMESTAMP NULL AFTER cleared_at', 'SELECT "Column archived_at already exists"');
PREPARE stmt6 FROM @sql6;
EXECUTE stmt6;
DEALLOCATE PREPARE stmt6;

SET @col_exists7 = 0;
SELECT COUNT(*) INTO @col_exists7 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'conversation_members' 
  AND COLUMN_NAME = 'muted_until';

SET @sql7 = IF(@col_exists7 = 0, 'ALTER TABLE conversation_members ADD COLUMN muted_until TIMESTAMP NULL AFTER archived_at', 'SELECT "Column muted_until already exists"');
PREPARE stmt7 FROM @sql7;
EXECUTE stmt7;
DEALLOCATE PREPARE stmt7;

