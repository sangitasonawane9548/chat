# Database Architecture: `username_chat_platform`

This directory houses the foundational database schema and configuration for the **Username Chat Platform** (Aether Chat).

## Architecture Overview

The database uses **MySQL 8.0+ / MariaDB 10.4+** with the **InnoDB** storage engine, `utf8mb4` character set, and `utf8mb4_unicode_ci` collation for complete Unicode support (including full emoji spectrum and international character sets).

### Tables Summary

| # | Table Name | Purpose | Primary Relations |
|---|---|---|---|
| 1 | `users` | Core user identity, unique usernames, verified status, roles | Root entity |
| 2 | `user_profiles` | User bio, avatar url, online presence & last seen | 1-to-1 with `users` |
| 3 | `user_settings` | Privacy options, theme preference, call permissions | 1-to-1 with `users` |
| 4 | `conversations` | One-on-one direct chats and future group channels | Referenced by messages & members |
| 5 | `conversation_members` | Conversation participants (composite unique constraint) | `conversations`, `users` |
| 6 | `messages` | Chat messages with reply threading & edit tracking | `conversations`, `users` |
| 7 | `message_attachments` | Multimedia files, types, URLs, and sizes | `messages` |
| 8 | `message_receipts` | Message delivery and read receipts per member | `messages`, `users` |
| 9 | `calls` | WebRTC audio & video call sessions, status, duration | `users` (caller) |
| 10 | `call_participants` | Callee and participant status tracking | `calls`, `users` |
| 11 | `notifications` | System, call, message, and mention notifications | `users` |
| 12 | `blocked_users` | User block relationship (prevents spam/harassment) | `users` (blocker & blocked) |
| 13 | `reports` | Moderation reports against abusive actors | `users` (reporter & reported) |
| 14 | `user_sessions` | Secure hashed session tokens, IP, and device info | `users` |

## Importing Schema

### Via MySQL CLI (PowerShell / Command Prompt)

```powershell
# From project root
Get-Content database/schema.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
```

Or if MySQL is in your system PATH:
```bash
mysql -u root -p < database/schema.sql
```

### Via phpMyAdmin / MySQL Workbench
1. Open phpMyAdmin (`http://localhost/phpmyadmin`) or MySQL Workbench.
2. Select the **Import** tab or execute query tab.
3. Choose `database/schema.sql`.
4. Click **Go** / **Execute**.

## Key Design Principles
- **No plain-text passwords or tokens**: Passwords and session tokens are strictly stored as cryptographic hashes.
- **Data Integrity**: Foreign key constraints cascade appropriately (`ON DELETE CASCADE` or `ON DELETE SET NULL` for reply threads) to prevent orphaned records.
- **Performance Indexes**: High-frequency lookups (`username`, `email`, `conversation_id`, `created_at`, `is_online`) are indexed.

