-- =============================================================================
-- DAY 9: WHATSAPP-STYLE STATUS / STORIES SYSTEM MIGRATIONS
-- =============================================================================

USE `username_chat_platform`;

-- 1. Create `statuses` table
CREATE TABLE IF NOT EXISTS `statuses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status_type` ENUM('text', 'image', 'video') NOT NULL DEFAULT 'text',
  `text_content` TEXT DEFAULT NULL,
  `media_url` VARCHAR(500) DEFAULT NULL,
  `caption` VARCHAR(500) DEFAULT NULL,
  `background_color` VARCHAR(50) DEFAULT '#0B0D12',
  `text_color` VARCHAR(50) DEFAULT '#FFFFFF',
  `font_size` VARCHAR(20) DEFAULT 'medium',
  `text_alignment` VARCHAR(20) DEFAULT 'center',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_statuses_user_expires` (`user_id`, `expires_at`),
  KEY `idx_statuses_expires` (`expires_at`),
  KEY `idx_statuses_deleted` (`deleted_at`),
  CONSTRAINT `fk_statuses_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create `status_views` table
CREATE TABLE IF NOT EXISTS `status_views` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `status_id` BIGINT UNSIGNED NOT NULL,
  `viewer_id` BIGINT UNSIGNED NOT NULL,
  `viewed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_status_viewer` (`status_id`, `viewer_id`),
  KEY `idx_sv_status` (`status_id`),
  KEY `idx_sv_viewer` (`viewer_id`),
  CONSTRAINT `fk_sv_status` FOREIGN KEY (`status_id`)
    REFERENCES `statuses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sv_viewer` FOREIGN KEY (`viewer_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create `status_reactions` table
CREATE TABLE IF NOT EXISTS `status_reactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `status_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `emoji` VARCHAR(32) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_status_user_reaction` (`status_id`, `user_id`),
  KEY `idx_sr_status` (`status_id`),
  KEY `idx_sr_user` (`user_id`),
  CONSTRAINT `fk_sr_status` FOREIGN KEY (`status_id`)
    REFERENCES `statuses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sr_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create `status_privacy` table
CREATE TABLE IF NOT EXISTS `status_privacy` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `privacy_type` ENUM('contacts', 'contacts_except', 'only_share_with') NOT NULL DEFAULT 'contacts',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_sp_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create `status_privacy_exclusions` table
CREATE TABLE IF NOT EXISTS `status_privacy_exclusions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `excluded_user_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sp_exclusion` (`user_id`, `excluded_user_id`),
  KEY `idx_spe_user` (`user_id`),
  KEY `idx_spe_excluded` (`excluded_user_id`),
  CONSTRAINT `fk_spe_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_spe_excluded` FOREIGN KEY (`excluded_user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create `status_privacy_allowed_users` table
CREATE TABLE IF NOT EXISTS `status_privacy_allowed_users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `allowed_user_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sp_allowed` (`user_id`, `allowed_user_id`),
  KEY `idx_spa_user` (`user_id`),
  KEY `idx_spa_allowed` (`allowed_user_id`),
  CONSTRAINT `fk_spa_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_spa_allowed` FOREIGN KEY (`allowed_user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Create `status_mutes` table (for muting contacts' status updates)
CREATE TABLE IF NOT EXISTS `status_mutes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `muted_user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_status_mute` (`user_id`, `muted_user_id`),
  KEY `idx_sm_user` (`user_id`),
  KEY `idx_sm_muted` (`muted_user_id`),
  CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sm_muted` FOREIGN KEY (`muted_user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
