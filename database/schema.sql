-- =============================================================================
-- Database Schema: username_chat_platform
-- Platform: Production-Grade Username Real-Time Chatting & Calling Application
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- Storage Engine: InnoDB
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `username_chat_platform`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `username_chat_platform`;

-- Disable foreign key checks during schema creation
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Table: users
-- Core user entity with secure credentials and unique username & email
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `account_status` ENUM('active', 'inactive', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  `role` ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_account_status` (`account_status`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: user_profiles
-- Extended user profile information, presence, and public details
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_profiles`;
CREATE TABLE `user_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `profile_picture` VARCHAR(500) DEFAULT NULL,
  `bio` VARCHAR(500) DEFAULT NULL,
  `last_seen` TIMESTAMP NULL DEFAULT NULL,
  `is_online` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_profiles_user_id` (`user_id`),
  KEY `idx_user_profiles_is_online` (`is_online`),
  KEY `idx_user_profiles_last_seen` (`last_seen`),
  CONSTRAINT `fk_user_profiles_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: user_settings
-- Granular user preferences, privacy controls, and UI theme options
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_settings`;
CREATE TABLE `user_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `theme` ENUM('dark', 'light', 'system') NOT NULL DEFAULT 'dark',
  `show_last_seen` BOOLEAN NOT NULL DEFAULT TRUE,
  `show_online_status` BOOLEAN NOT NULL DEFAULT TRUE,
  `show_read_receipts` BOOLEAN NOT NULL DEFAULT TRUE,
  `allow_username_search` BOOLEAN NOT NULL DEFAULT TRUE,
  `profile_visibility` ENUM('public', 'contacts_only', 'private') NOT NULL DEFAULT 'public',
  `allow_chat_requests` ENUM('everyone', 'nobody') NOT NULL DEFAULT 'everyone',
  `call_permissions` ENUM('everyone', 'contacts_only', 'nobody') NOT NULL DEFAULT 'everyone',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_settings_user_id` (`user_id`),
  CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table: chat_requests
-- One-to-one friendship / chat authorization requests
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chat_requests`;
CREATE TABLE `chat_requests` (
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

-- -----------------------------------------------------------------------------
-- 5. Table: conversations
-- Conversations (one-to-one direct or group channels)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_type` ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversations_type` (`conversation_type`),
  KEY `idx_conversations_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Table: conversation_members
-- Participant memberships in conversations
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `conversation_members`;
CREATE TABLE `conversation_members` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_read_message_id` BIGINT UNSIGNED DEFAULT NULL,
  `last_read_at` TIMESTAMP NULL DEFAULT NULL,
  `cleared_at` TIMESTAMP NULL DEFAULT NULL,
  `archived_at` TIMESTAMP NULL DEFAULT NULL,
  `muted_until` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_member` (`conversation_id`, `user_id`),
  KEY `idx_cm_user_id` (`user_id`),
  KEY `idx_cm_conversation_id` (`conversation_id`),
  CONSTRAINT `fk_cm_conversation` FOREIGN KEY (`conversation_id`)
    REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Table: messages
-- Message records
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `message_type` ENUM('text', 'image', 'video', 'audio', 'file', 'system') NOT NULL DEFAULT 'text',
  `message_content` TEXT DEFAULT NULL,
  `reply_to_message_id` BIGINT UNSIGNED DEFAULT NULL,
  `client_message_id` VARCHAR(100) DEFAULT NULL,
  `is_edited` BOOLEAN NOT NULL DEFAULT FALSE,
  `deleted_for_everyone` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation_id` (`conversation_id`),
  KEY `idx_messages_sender_id` (`sender_id`),
  KEY `idx_messages_reply_to` (`reply_to_message_id`),
  KEY `idx_messages_client_id` (`client_message_id`),
  KEY `idx_messages_created_at` (`created_at`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`)
    REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messages_reply` FOREIGN KEY (`reply_to_message_id`)
    REFERENCES `messages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Table: message_attachments
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `message_attachments`;
CREATE TABLE `message_attachments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_url` VARCHAR(1000) NOT NULL,
  `file_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attachments_message_id` (`message_id`),
  CONSTRAINT `fk_attachments_message` FOREIGN KEY (`message_id`)
    REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Table: message_receipts
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `message_receipts`;
CREATE TABLE `message_receipts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `delivered_at` TIMESTAMP NULL DEFAULT NULL,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_message_user` (`message_id`, `user_id`),
  KEY `idx_receipts_user_id` (`user_id`),
  KEY `idx_receipts_read_at` (`read_at`),
  CONSTRAINT `fk_receipts_message` FOREIGN KEY (`message_id`)
    REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_receipts_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9b. Table: message_user_deletions (Delete For Me)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `message_user_deletions`;
CREATE TABLE `message_user_deletions` (
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

-- -----------------------------------------------------------------------------
-- 10. Table: calls
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `calls`;
CREATE TABLE `calls` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `caller_id` BIGINT UNSIGNED NOT NULL,
  `call_type` ENUM('audio', 'video') NOT NULL,
  `call_status` ENUM('initiated', 'ringing', 'accepted', 'rejected', 'missed', 'ended', 'busy') NOT NULL DEFAULT 'initiated',
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `ended_at` TIMESTAMP NULL DEFAULT NULL,
  `duration` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calls_caller_id` (`caller_id`),
  KEY `idx_calls_call_status` (`call_status`),
  KEY `idx_calls_created_at` (`created_at`),
  CONSTRAINT `fk_calls_caller` FOREIGN KEY (`caller_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. Table: call_participants
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `call_participants`;
CREATE TABLE `call_participants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `call_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `joined_at` TIMESTAMP NULL DEFAULT NULL,
  `left_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_call_participant` (`call_id`, `user_id`),
  KEY `idx_call_participants_user_id` (`user_id`),
  CONSTRAINT `fk_cp_call` FOREIGN KEY (`call_id`)
    REFERENCES `calls` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. Table: notifications
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `notification_type` ENUM('message', 'call', 'mention', 'system', 'security', 'chat_request') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_id` (`user_id`),
  KEY `idx_notifications_is_read` (`is_read`),
  KEY `idx_notifications_created_at` (`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. Table: blocked_users
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `blocked_users`;
CREATE TABLE `blocked_users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `blocker_id` BIGINT UNSIGNED NOT NULL,
  `blocked_user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blocked_pair` (`blocker_id`, `blocked_user_id`),
  KEY `idx_blocked_users_blocker` (`blocker_id`),
  KEY `idx_blocked_users_blocked` (`blocked_user_id`),
  CONSTRAINT `fk_bu_blocker` FOREIGN KEY (`blocker_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_bu_blocked` FOREIGN KEY (`blocked_user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. Table: reports
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporter_id` BIGINT UNSIGNED NOT NULL,
  `reported_user_id` BIGINT UNSIGNED NOT NULL,
  `reason` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `report_status` ENUM('pending', 'under_review', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reports_reporter` (`reporter_id`),
  KEY `idx_reports_reported` (`reported_user_id`),
  KEY `idx_reports_status` (`report_status`),
  CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reports_reported` FOREIGN KEY (`reported_user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. Table: user_sessions
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `session_token_hash` VARCHAR(255) NOT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token_hash` (`session_token_hash`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. Table: email_verification_otps
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `email_verification_otps`;
CREATE TABLE `email_verification_otps` (
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

-- -----------------------------------------------------------------------------
-- 17. Table: password_reset_tokens
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
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

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
