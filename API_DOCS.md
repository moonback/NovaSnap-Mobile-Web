# API Documentation

This project primarily uses Supabase APIs (Auth, PostgREST, RPC, Realtime, Storage) plus a custom Node endpoint for health and websocket AI streaming.

## 1) Custom HTTP Endpoints

### `GET /api/health`
- **Description**: Server healthcheck
- **Response**:
```json
{ "status": "ok" }
```

## 2) WebSocket Endpoint

### `WS /live`
Authenticated websocket used for live Gemini voice interactions.

#### Handshake contract
First message must be JSON:
```json
{ "auth": "<supabase_access_token>" }
```

If valid, connection is upgraded to AI stream mode.

#### Client → Server messages
- Audio frame:
```json
{ "audio": "<base64_pcm_16khz>" }
```
- Video frame:
```json
{ "video": "<base64_jpeg>" }
```

#### Server → Client messages
- AI audio chunk:
```json
{ "audio": "<base64_audio_chunk>" }
```
- AI text chunk:
```json
{ "text": "..." }
```
- Interrupt event:
```json
{ "interrupted": true }
```

## 3) Supabase Auth APIs (via `@supabase/supabase-js`)

Used in app flows:
- `auth.signUp(...)`
- `auth.signInWithPassword(...)`
- `auth.signOut()`
- `auth.getSession()`
- `auth.onAuthStateChange(...)`

## 4) Supabase RPCs

## `update_user_heartbeat`
Updates online heartbeat and optional geolocation.

### Parameters
| Name | Type | Required | Description |
|---|---|---:|---|
| `p_lat` | `double precision` | No | Latitude |
| `p_lng` | `double precision` | No | Longitude |
| `p_ghost` | `boolean` | No | If `true`, clears location and sets visibility to `NOBODY` |

### Return
`void`

## `get_nearby_friends`
Returns nearby accepted friends with fresh location.

### Parameters
| Name | Type | Required | Description |
|---|---|---:|---|
| `p_lat` | `double precision` | Yes | Caller latitude |
| `p_lng` | `double precision` | Yes | Caller longitude |
| `p_radius` | `integer` | No | Radius in meters (default 50000) |

### Return columns
| Column | Type |
|---|---|
| `user_id` | `uuid` |
| `username` | `text` |
| `avatar_url` | `text` |
| `lat` | `double precision` |
| `lng` | `double precision` |
| `distance_m` | `double precision` |
| `updated_at` | `timestamptz` |

## 5) Main Data Access Patterns by Domain

- **Users**: `from('users').select/update/...`
- **Friends**: `from('friendships')...`
- **Conversations/messages**: `from('conversations')`, `from('messages')`
- **Stories**: `from('stories')`, `from('story_views')`
- **Storage buckets**: `avatars`, `chats`, `stories`, `temporary_snaps`

## 6) Realtime

Supabase realtime publication includes messaging-related tables (see `supabase_schema.sql`).

## 7) Edge Function

`supabase/functions/send-push-notification`
- Sends push notifications to registered user tokens.
- Invoked from backend/db workflows depending on project setup.
