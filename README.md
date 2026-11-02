# Aether | Production Username Real-Time Chat, Calling & Stories Platform

A high-performance, private, username-based communication platform built with **Node.js, Express, Socket.IO, WebRTC, MySQL, and React**. Inspired by the fluid UX of Discord, Telegram, and Linear with a responsive obsidian-glass dark design system.

---

## 1. Project Overview & Architecture

Aether is engineered for private, username-first real-time messaging, audio calling, HD video calling, group communication, and 24-hour ephemeral status stories. It eliminates the need to exchange phone numbers by providing unique handle discovery (`@username`) backed by a normalized relational database schema with full constraint verification and multi-layered security.

### Completed Milestones (Days 1 to 10)
- **Day 1: Foundation & Architecture**
  - Normalized MySQL schema (30 tables total), connection pool, health check (`GET /api/health`).
  - Socket.IO gateway, Express app, Helmet, CORS, and centralized error handling.
  - React 18 + Vite frontend with Tailwind design system, reusable UI components, and theme support.
- **Day 2: Authentication & Session System**
  - Unique username registration with live debounced availability verification.
  - Bcrypt password hashing (`cost = 12`) and password strength scoring.
  - 6-digit email OTP verification with cryptographic SHA-256 storage and 5-minute expiration.
  - Nodemailer email service with responsive HTML templates.
  - Secure login supporting username or email with rate limiting and session management via HTTP-only secure cookies.
- **Demo OTP Registration Mode**
  - Development-only fixed OTP `123456` enabled via `OTP_MODE=demo`. Cryptographic random OTP strictly required in production mode.
- **Day 3: Username Search, User Discovery & Profile Management**
  - Case-insensitive handle discovery with 350ms debouncing, suggestions, and pagination.
  - Public profile viewer (`/profile/:username`) and own profile management (`/profile/edit`).
  - One-to-one chat request system (`/requests`) with atomic database transactions.
- **Day 4: Real-Time One-to-One Messaging System**
  - Instant text messaging with Socket.IO rooms and MySQL message persistence.
  - Typing indicators, real-time presence (online/offline/last seen), and read receipts.
  - Message pagination, message editing (15-min window), delete-for-me, and delete-for-everyone.
- **Day 5: Advanced Media Sharing & Voice Messages**
  - Photo, video, document, and recorded voice message sharing (`/uploads/attachments`).
  - Emoji reactions with toggle removal and message replies referencing quote cards.
- **Day 6: Real-Time Audio Calling System**
  - WebRTC peer-to-peer audio calling with server-side signaling and state machine.
  - Incoming call overlay, ringtones, accept/reject, mute/unmute, and call history tracking.
- **Day 7: Real-Time Video Calling System**
  - Live HD WebRTC video calling with camera toggle, mic mute, screen sharing, and picture-in-picture.
  - Automatic reconnection handling, call duration tracking, and call history logging.
- **Day 8: Advanced Real-Time Group Chat System**
  - Group creation, member addition, role-based access control (`creator`, `admin`, `member`), group info editing.
  - Multi-participant mesh WebRTC group audio and video calling.
  - Ownership transfer, member removal, leaving groups, and group deletion.
- **Day 9: WhatsApp-Style Status / Stories System**
  - Ephemeral text, image, and video status creation with 24-hour expiration.
  - Segmented full-screen story viewer with auto-advancing progress bars and hold-to-pause.
  - Owner-only viewer drawer, emoji quick reactions, and direct chat replies.
  - Status privacy controls: *My Contacts*, *My Contacts Except...*, and *Only Share With...*.
  - Background expiration worker pruning expired statuses and media from disk.
- **Day 10: Finalization, Security, Optimization & Production Readiness**
  - Composite database performance indexes on messages, notifications, and chat requests.
  - Centralized notification service with Socket.IO live sync and click-to-navigate routing.
  - User settings & privacy persistence in MySQL `user_settings` and blocked contacts management.
  - Global API rate limiter (`express-rate-limit`) and sanitized production error handler.
  - Route code-splitting with `React.lazy` and `Suspense`, reducing initial bundle size.
  - 100% automated test coverage across 10 test suites (244/244 tests passing).

---

## 2. Technology Stack

### Frontend
- **Framework**: React.js 18 (Vite 6)
- **Language**: JavaScript (ES Modules, Strict)
- **Styling**: Tailwind CSS + Custom Obsidian Glass Tokens
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Routing**: React Router DOM (v6) with Code Splitting & Route Guards
- **HTTP Client**: Axios with `withCredentials: true`
- **Real-Time Client**: `socket.io-client` with authenticated private rooms
- **Notifications**: React Hot Toast

### Backend
- **Runtime**: Node.js (v24+)
- **Server**: Express.js (v4)
- **Real-Time Engine**: Socket.IO (v4) with JWT authentication handshake
- **Database Engine**: MySQL 8.0+ / MariaDB 10.4+
- **File Uploads**: `multer` with disk storage and mime/extension validation
- **Security & Cryptography**: `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `helmet`, `express-rate-limit`
- **Email Service**: `nodemailer` with responsive HTML templates

---

## 3. Database Architecture (`username_chat_platform`)

### Complete Database Schema (30 Tables)
1. `users`: Core identity, unique handle & email, verified flag, account status.
2. `user_profiles`: Avatar, bio, presence, last seen timestamp.
3. `user_settings`: Privacy preferences, theme, profile visibility, call permissions, username search toggle.
4. `user_sessions`: Active device sessions, hashed tokens, IP address, user-agent, revoked status.
5. `email_verification_otps`: 6-digit OTP hashes, attempt counters, 5-minute expiration.
6. `password_reset_tokens`: 32-byte secure reset token hashes, 15-minute expiration.
7. `chat_requests`: Sender, receiver, status (`pending`, `accepted`, `declined`, `cancelled`), timestamps.
8. `conversations`: Direct (1-on-1) and group conversations.
9. `conversation_members`: Composite unique memberships, role, status.
10. `groups`: Group metadata, name, description, avatar, creator.
11. `group_members`: Group membership, permissions (`creator`, `admin`, `member`), joined date.
12. `messages`: Threaded messages, reply references, client message IDs, edit flags.
13. `message_attachments`: File attachments, media types, sizes, paths.
14. `message_reactions`: Emoji reactions per user per message.
15. `message_receipts`: Delivered and read timestamps.
16. `message_user_deletions`: Delete-for-me user tracking.
17. `calls`: WebRTC 1-on-1 audio and video call records, durations, end reasons.
18. `call_participants`: Caller and receiver status tracking.
19. `group_calls`: Group audio and video call sessions.
20. `group_call_participants`: Group call mesh attendees, status (`joined`, `left`, `calling`).
21. `statuses`: Ephemeral text, image, and video status stories with 24-hour expiration.
22. `status_views`: Deduplicated status view logs.
23. `status_reactions`: Emoji reactions on statuses.
24. `status_privacy`: User privacy preference (`contacts`, `contacts_except`, `only_share_with`).
25. `status_privacy_exclusions`: Excluded user IDs for `contacts_except`.
26. `status_privacy_allowed_users`: Allowed user IDs for `only_share_with`.
27. `status_mutes`: Status muting preferences per user.
28. `notifications`: Centralized alerts with unread counter.
29. `blocked_users`: Mutual user block records.
30. `reports`: Moderation reports.

---

## 4. API Endpoints Catalog

### Authentication APIs (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/check-username?username=...` | Check handle availability |
| `POST` | `/register` | Create account (triggers email OTP) |
| `POST` | `/verify-email` | Verify 6-digit OTP & activate account |
| `POST` | `/resend-otp` | Resend verification code |
| `POST` | `/login` | Authenticate using username or email |
| `GET` | `/me` | Get authenticated user identity from session |
| `POST` | `/logout` | Invalidate session & clear HTTP-only cookie |
| `POST` | `/forgot-password` | Request password reset email |
| `POST` | `/reset-password` | Reset password using reset token |
| `POST` | `/change-password` | Change password with current password verification |
| `GET` | `/sessions` | List active device sessions |
| `POST` | `/logout-all` | Revoke all active device sessions |

### User & Privacy APIs (`/api/users`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search?q=...&page=1&limit=20` | Debounced user search |
| `GET` | `/suggestions` | Discoverable user suggestions |
| `GET` | `/settings` | Get user privacy preferences & theme |
| `PUT` | `/settings` | Update user privacy preferences & theme |
| `GET` | `/blocked` | List blocked contacts |
| `POST` | `/block/:targetUserId` | Block a user |
| `DELETE` | `/block/:targetUserId` | Unblock a user |
| `PUT` | `/me/profile` | Update display name, handle, and bio |
| `POST` | `/me/avatar` | Upload profile avatar (Multer 5MB) |
| `GET` | `/:username` | View public or own user profile |

### Chat Requests APIs (`/api/chat-requests`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Send chat request by username or ID |
| `GET` | `/incoming` | List pending received chat requests |
| `GET` | `/sent` | List pending sent chat requests |
| `POST` | `/:id/accept` | Accept request & create direct conversation |
| `POST` | `/:id/decline` | Decline incoming request |
| `POST` | `/:id/cancel` | Cancel outgoing request |

### Conversations & Messages APIs (`/api/conversations`, `/api/messages`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/conversations` | List user authorized conversations |
| `GET` | `/api/conversations/:id` | Get conversation details |
| `GET` | `/api/conversations/:id/messages` | Paginated message history |
| `POST` | `/api/conversations/:id/messages` | Send a text message |
| `POST` | `/api/conversations/:id/attachments` | Upload media / document / voice attachment |
| `POST` | `/api/conversations/:id/read` | Mark all messages in conversation read |
| `GET` | `/api/conversations/:id/search` | Search messages within conversation |
| `POST` | `/api/conversations/:id/clear` | Clear message history for me |
| `PATCH` | `/api/messages/:id` | Edit message (within 15-minute window) |
| `DELETE` | `/api/messages/:id` | Delete message for me |
| `POST` | `/api/messages/:id/delete-for-everyone`| Delete message for everyone |
| `POST` | `/api/messages/:id/reactions` | Add or toggle emoji reaction |
| `DELETE` | `/api/messages/:id/reactions` | Remove emoji reaction |

### Calling APIs (`/api/calls`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/initiate` | Initiate 1-on-1 audio/video call |
| `POST` | `/accept` | Accept incoming call |
| `POST` | `/reject` | Reject incoming call |
| `POST` | `/end` | End ongoing call & compute duration |
| `GET` | `/history` | Paginated call history log |
| `GET` | `/:id` | Single call record details |

### Groups APIs (`/api/groups`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Create group with initial members |
| `GET` | `/` | List user groups |
| `GET` | `/:id` | Get group details & members list |
| `PATCH` / `PUT` | `/:id` | Update group name, description, avatar |
| `POST` | `/:id/members` | Add new members (admin/creator only) |
| `DELETE` | `/:id/members/:userId` | Remove member (admin/creator only) |
| `POST` | `/:id/leave` | Leave group |
| `POST` | `/:id/members/:userId/role` | Promote/demote member role |
| `POST` | `/:id/transfer-ownership` | Transfer creator role to another member |
| `DELETE` | `/:id` | Delete group (creator only) |

### Status / Stories APIs (`/api/statuses`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/text` | Create rich text status (palette, font, alignment) |
| `POST` | `/media` | Create image or video status with caption |
| `GET` | `/me` | Get own active statuses |
| `GET` | `/feed` | Get contacts status feed (recent, viewed, muted) |
| `GET` | `/privacy` | Get current status privacy preference |
| `PUT` | `/privacy` | Update status privacy preference |
| `POST` | `/mute/:userId` | Toggle mute status updates for user |
| `GET` | `/:id` | Get single status details |
| `POST` | `/:id/views` | Record status view (deduplicated) |
| `GET` | `/:id/viewers` | Get viewers list (owner only) |
| `POST` | `/:id/reactions` | Toggle emoji reaction on status |
| `POST` | `/:id/reply` | Reply to status via direct chat message |
| `DELETE` | `/:id` | Delete status update (owner only) |

### Notifications APIs (`/api/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List user notifications & unread count |
| `PATCH` | `/:id/read` | Mark single notification as read |
| `PATCH` | `/read-all` | Mark all notifications as read |

---

## 5. Automated Verification & Testing

Execute the comprehensive automated test suite across all 10 milestones:

```powershell
node backend/tests/run_all_tests.js
```

### Complete Test Suites (244/244 Passing):
- `day2_auth_test.js`: 15 tests passed
- `demo_otp_test.js`: 12 tests passed
- `day3_discovery_test.js`: 24 tests passed
- `day4_messaging_test.js`: 26 tests passed
- `day5_media_test.js`: 20 tests passed
- `day6_calling_test.js`: 22 tests passed
- `day7_video_calling_test.js`: 22 tests passed
- `day8_group_test.js`: 30 tests passed
- `day9_status_test.js`: 41 tests passed
- `day10_final_integration_test.js`: 32 tests passed

---

## 6. How to Run Locally

### Prerequisites
- Node.js (v20+ recommended)
- MySQL Server (Port 3306)
- Git

### 1. Database Setup
```sql
CREATE DATABASE IF NOT EXISTS username_chat_platform;
```
Import base schema and migrations:
```powershell
node backend/scripts/run_day10_migrations.js
```

### 2. Backend Server
```powershell
cd backend
npm install
npm run dev
```
Backend runs at: [http://localhost:5000](http://localhost:5000)

### 3. Frontend Client
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at: [http://localhost:5173](http://localhost:5173)

---

## 7. Production Deployment Instructions

1. **Environment Configuration:**
   - Copy `backend/.env.example` to `backend/.env` and replace all secrets with strong 32+ character keys.
   - Set `NODE_ENV=production` and `OTP_MODE=production`.
   - Configure real SMTP credentials for email delivery.
   - Configure STUN/TURN servers for NAT traversal during audio and video calls.
2. **Frontend Production Build:**
   ```powershell
   cd frontend
   npm run build
   ```
   Static files are compiled to `frontend/dist`.
3. **Process Management:**
   Use PM2 or Docker for production daemon management:
   ```powershell
   pm2 start backend/server.js --name "aether-backend"
   ```
4. **Reverse Proxy & SSL:**
   Configure Nginx or Caddy with TLS/SSL certificates and WebSocket upgrade headers for Socket.IO.
