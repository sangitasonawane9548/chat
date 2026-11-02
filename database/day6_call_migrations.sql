-- =============================================================================
-- Migration: Day 6 Real-Time One-to-One Audio Calling System
-- Database: username_chat_platform
-- =============================================================================

USE `username_chat_platform`;

-- 1. Extend calls table
SET @col_conv = 0;
SELECT COUNT(*) INTO @col_conv 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'conversation_id';

SET @sql_conv = IF(@col_conv = 0, 
  'ALTER TABLE calls ADD COLUMN conversation_id BIGINT UNSIGNED NULL AFTER id, ADD CONSTRAINT fk_calls_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL', 
  'SELECT "Column conversation_id already exists"');
PREPARE stmt_conv FROM @sql_conv;
EXECUTE stmt_conv;
DEALLOCATE PREPARE stmt_conv;

-- Add or update status column on calls
SET @col_status = 0;
SELECT COUNT(*) INTO @col_status 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'status';

SET @sql_status = IF(@col_status = 0, 
  'ALTER TABLE calls ADD COLUMN status ENUM("initiated", "ringing", "accepted", "connected", "rejected", "missed", "ended", "cancelled", "busy", "failed") NOT NULL DEFAULT "initiated" AFTER call_type', 
  'ALTER TABLE calls MODIFY COLUMN status ENUM("initiated", "ringing", "accepted", "connected", "rejected", "missed", "ended", "cancelled", "busy", "failed") NOT NULL DEFAULT "initiated"');
PREPARE stmt_status FROM @sql_status;
EXECUTE stmt_status;
DEALLOCATE PREPARE stmt_status;

-- Add answered_at
SET @col_ans = 0;
SELECT COUNT(*) INTO @col_ans 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'answered_at';

SET @sql_ans = IF(@col_ans = 0, 
  'ALTER TABLE calls ADD COLUMN answered_at TIMESTAMP NULL AFTER started_at', 
  'SELECT "Column answered_at already exists"');
PREPARE stmt_ans FROM @sql_ans;
EXECUTE stmt_ans;
DEALLOCATE PREPARE stmt_ans;

-- Add duration_seconds
SET @col_dur = 0;
SELECT COUNT(*) INTO @col_dur 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'duration_seconds';

SET @sql_dur = IF(@col_dur = 0, 
  'ALTER TABLE calls ADD COLUMN duration_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER ended_at', 
  'SELECT "Column duration_seconds already exists"');
PREPARE stmt_dur FROM @sql_dur;
EXECUTE stmt_dur;
DEALLOCATE PREPARE stmt_dur;

-- Add end_reason
SET @col_reason = 0;
SELECT COUNT(*) INTO @col_reason 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'end_reason';

SET @sql_reason = IF(@col_reason = 0, 
  'ALTER TABLE calls ADD COLUMN end_reason VARCHAR(100) NULL AFTER duration_seconds', 
  'SELECT "Column end_reason already exists"');
PREPARE stmt_reason FROM @sql_reason;
EXECUTE stmt_reason;
DEALLOCATE PREPARE stmt_reason;

-- Add updated_at
SET @col_updated = 0;
SELECT COUNT(*) INTO @col_updated 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'calls' 
  AND COLUMN_NAME = 'updated_at';

SET @sql_updated = IF(@col_updated = 0, 
  'ALTER TABLE calls ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 
  'SELECT "Column updated_at already exists"');
PREPARE stmt_updated FROM @sql_updated;
EXECUTE stmt_updated;
DEALLOCATE PREPARE stmt_updated;

-- 2. Extend call_participants table
SET @col_role = 0;
SELECT COUNT(*) INTO @col_role 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'call_participants' 
  AND COLUMN_NAME = 'participant_role';

SET @sql_role = IF(@col_role = 0, 
  'ALTER TABLE call_participants ADD COLUMN participant_role ENUM("caller", "receiver") NOT NULL DEFAULT "receiver" AFTER user_id', 
  'SELECT "Column participant_role already exists"');
PREPARE stmt_role FROM @sql_role;
EXECUTE stmt_role;
DEALLOCATE PREPARE stmt_role;

SET @col_part_status = 0;
SELECT COUNT(*) INTO @col_part_status 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'call_participants' 
  AND COLUMN_NAME = 'participant_status';

SET @sql_part_status = IF(@col_part_status = 0, 
  'ALTER TABLE call_participants ADD COLUMN participant_status ENUM("calling", "ringing", "joined", "rejected", "missed", "busy", "left") NOT NULL DEFAULT "calling" AFTER participant_role', 
  'SELECT "Column participant_status already exists"');
PREPARE stmt_part_status FROM @sql_part_status;
EXECUTE stmt_part_status;
DEALLOCATE PREPARE stmt_part_status;

SET @col_part_created = 0;
SELECT COUNT(*) INTO @col_part_created 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'call_participants' 
  AND COLUMN_NAME = 'created_at';

SET @sql_part_created = IF(@col_part_created = 0, 
  'ALTER TABLE call_participants ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER left_at', 
  'SELECT "Column created_at already exists"');
PREPARE stmt_part_created FROM @sql_part_created;
EXECUTE stmt_part_created;
DEALLOCATE PREPARE stmt_part_created;

SET @col_part_updated = 0;
SELECT COUNT(*) INTO @col_part_updated 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'username_chat_platform' 
  AND TABLE_NAME = 'call_participants' 
  AND COLUMN_NAME = 'updated_at';

SET @sql_part_updated = IF(@col_part_updated = 0, 
  'ALTER TABLE call_participants ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 
  'SELECT "Column updated_at already exists"');
PREPARE stmt_part_updated FROM @sql_part_updated;
EXECUTE stmt_part_updated;
DEALLOCATE PREPARE stmt_part_updated;

