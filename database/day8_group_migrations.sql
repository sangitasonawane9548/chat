-- =============================================================================
-- DAY 8: ADVANCED REAL-TIME GROUP CHAT SYSTEM MIGRATIONS
-- =============================================================================

-- 1. Extend conversation_members with role & status
ALTER TABLE `conversation_members` 
  ADD COLUMN IF NOT EXISTS `role` ENUM('creator', 'admin', 'member') NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'left', 'removed') NOT NULL DEFAULT 'active';

-- 2. Create `groups` table for group metadata
CREATE TABLE IF NOT EXISTS `groups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `profile_image` VARCHAR(500) DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_groups_conv` (`conversation_id`),
  KEY `idx_groups_created_by` (`created_by`),
  CONSTRAINT `fk_groups_conversation` FOREIGN KEY (`conversation_id`)
    REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_groups_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create `group_members` table
CREATE TABLE IF NOT EXISTS `group_members` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `group_id` BIGINT UNSIGNED NOT NULL,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('creator', 'admin', 'member') NOT NULL DEFAULT 'member',
  `status` ENUM('active', 'left', 'removed') NOT NULL DEFAULT 'active',
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_read_message_id` BIGINT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_user` (`group_id`, `user_id`),
  KEY `idx_gm_conversation_id` (`conversation_id`),
  KEY `idx_gm_user_id` (`user_id`),
  CONSTRAINT `fk_gm_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gm_conversation` FOREIGN KEY (`conversation_id`)
    REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gm_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create `group_calls` table
CREATE TABLE IF NOT EXISTS `group_calls` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `group_id` BIGINT UNSIGNED NOT NULL,
  `initiated_by` BIGINT UNSIGNED NOT NULL,
  `call_type` ENUM('audio', 'video') NOT NULL DEFAULT 'audio',
  `status` ENUM('active', 'ended') NOT NULL DEFAULT 'active',
  `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gc_conversation` (`conversation_id`),
  KEY `idx_gc_group` (`group_id`),
  KEY `idx_gc_initiator` (`initiated_by`),
  CONSTRAINT `fk_gc_conversation` FOREIGN KEY (`conversation_id`)
    REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gc_group` FOREIGN KEY (`group_id`)
    REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gc_initiator` FOREIGN KEY (`initiated_by`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create `group_call_participants` table
CREATE TABLE IF NOT EXISTS `group_call_participants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `call_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('calling', 'joined', 'left', 'declined') NOT NULL DEFAULT 'calling',
  `joined_at` TIMESTAMP NULL DEFAULT NULL,
  `left_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_call_user` (`call_id`, `user_id`),
  CONSTRAINT `fk_gcp_call` FOREIGN KEY (`call_id`)
    REFERENCES `group_calls` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gcp_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
