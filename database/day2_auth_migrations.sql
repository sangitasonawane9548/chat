-- =============================================================================
-- Migration: Day 2 Complete Authentication System
-- Database: username_chat_platform
-- =============================================================================

USE `username_chat_platform`;

-- 1. Create email_verification_otps table
CREATE TABLE IF NOT EXISTS `email_verification_otps` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evo_user_id` (`user_id`),
  KEY `idx_evo_email` (`email`),
  KEY `idx_evo_expires_at` (`expires_at`),
  CONSTRAINT `fk_evo_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prt_token_hash` (`token_hash`),
  KEY `idx_prt_user_id` (`user_id`),
  KEY `idx_prt_expires_at` (`expires_at`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Enhance user_sessions with revoked_at if not present
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'user_sessions' 
  AND COLUMN_NAME = 'revoked_at';

SET @sql = IF(@col_exists = 0, 'ALTER TABLE user_sessions ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL AFTER expires_at', 'SELECT "Column revoked_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

