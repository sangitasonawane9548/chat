-- =============================================================================
-- Migration: Day 3 Username Search, User Discovery & Profile Management
-- Database: username_chat_platform
-- =============================================================================

USE `username_chat_platform`;

-- 1. Create chat_requests table
CREATE TABLE IF NOT EXISTS `chat_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `receiver_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `responded_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cr_sender` (`sender_id`),
  KEY `idx_cr_receiver` (`receiver_id`),
  KEY `idx_cr_status` (`status`),
  CONSTRAINT `fk_cr_sender` FOREIGN KEY (`sender_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cr_receiver` FOREIGN KEY (`receiver_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Extend user_settings table with profile_visibility and allow_chat_requests if not present
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'user_settings' 
  AND COLUMN_NAME = 'profile_visibility';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE user_settings ADD COLUMN profile_visibility ENUM("public", "contacts_only", "private") NOT NULL DEFAULT "public" AFTER allow_username_search', 'SELECT "Column profile_visibility already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 = 0;
SELECT COUNT(*) INTO @col_exists2 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'user_settings' 
  AND COLUMN_NAME = 'allow_chat_requests';

SET @sql2 = IF(@col_exists2 = 0, 'ALTER TABLE user_settings ADD COLUMN allow_chat_requests ENUM("everyone", "nobody") NOT NULL DEFAULT "everyone" AFTER profile_visibility', 'SELECT "Column allow_chat_requests already exists"');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. Extend notifications table with chat_request enum and reference data
ALTER TABLE `notifications` 
  MODIFY COLUMN `notification_type` ENUM('message', 'call', 'mention', 'system', 'security', 'chat_request') NOT NULL;

SET @col_exists3 = 0;
SELECT COUNT(*) INTO @col_exists3 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'notifications' 
  AND COLUMN_NAME = 'reference_id';

SET @sql3 = IF(@col_exists3 = 0, 'ALTER TABLE notifications ADD COLUMN reference_id BIGINT UNSIGNED NULL AFTER description', 'SELECT "Column reference_id already exists"');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

