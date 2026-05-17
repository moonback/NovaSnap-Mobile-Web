# Architecture

## 1) High-Level System Diagram

```mermaid
flowchart LR
  U[User / Browser PWA] --> FE[React App (Vite, TS)]
  FE -->|Supabase JS| SB[(Supabase: Auth + Postgres + Storage + Realtime)]
  FE -->|WebSocket /live + JWT| BE[Node/Express Server]
  BE -->|Auth verify (service role)| SB
  BE -->|Gemini Live API| AI[Google Gemini Live]
  FE --> SW[Service Worker / Push]
  SW --> EF[Supabase Edge Function: send-push-notification]
  EF --> Push[Push Providers]
```

## 2) Frontend Architecture

### Core principles
- **Screen-driven architecture** in `src/screens`.
- **Global UI/app state** in Zustand (`src/store/useAppStore.ts`).
- **Server data state** in TanStack Query hooks under `src/hooks`.
- **Reusable UI** in `src/components`.

### Navigation model
- Main shell in `App.tsx` with swipe-based horizontal views:
  - `map`
  - `chat`
  - `camera`
  - `stories`
- Overlay screens (profile, friends, memories, user profile) controlled from app store flags.

### Data flow pattern
1. Screen/component calls hook (`useFriends`, `useStories`, `useFriendLocations`, etc.).
2. Hook executes Supabase query/RPC.
3. React Query caches and refreshes data.
4. UI reacts to cached state and mutations.

## 3) Backend Architecture

## Express server (`server.ts`)
- Hosts app in dev (Vite middleware) and prod (static `dist`).
- Exposes health endpoint: `GET /api/health`.
- Provides WebSocket endpoint: `ws://.../live`.

## WebSocket AI bridge
- First WS message must include Supabase JWT (`{ auth: <token> }`).
- Server verifies JWT via Supabase Admin client (`SUPABASE_SERVICE_ROLE_KEY`).
- After auth, server opens Gemini Live session and proxies audio/video messages.
- Includes protections:
  - per-IP connection cap,
  - auth timeout,
  - WS payload size limit.

## 4) Database Architecture (Supabase/Postgres)

Core domains:
- Identity/profiles: `users`
- Social graph: `friendships`
- Messaging: `conversations`, `conversation_members`, `messages`, `message_status`
- Stories: `stories`, `story_views`
- Notifications: `notification_tokens`
- Geolocation: `users.last_location`, `location_updated_at`, `online_status_visibility`

### RPC-based location services
- `update_user_heartbeat(p_lat, p_lng, p_ghost)`
- `get_nearby_friends(p_lat, p_lng, p_radius)`

These centralize privacy rules server-side (ghost mode and freshness window).

## 5) Security Architecture

- Supabase RLS policies enforce row-level access.
- Service role key used **server-side only**.
- JWT required for `/live` websocket sessions.
- Sensitive credentials in `.env`, never in client bundle.

## 6) Scalability Notes

- React Query reduces redundant network calls.
- PostGIS GiST index on `users.last_location` for proximity search.
- Server-side limits on WS sessions reduce abuse.
- Supabase managed services simplify scaling for auth/data/realtime.
