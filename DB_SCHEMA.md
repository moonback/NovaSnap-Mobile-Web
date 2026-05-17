# Database Schema (Supabase)

This document summarizes the human-readable data model used by NovaSnap.

## Extensions

- `uuid-ossp`
- `postgis`

## Core Tables

## `users`
User profile linked to `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` |
| `username` | `text` | unique, min length check |
| `display_name` | `text` | nullable |
| `avatar_url` | `text` | nullable |
| `bio` | `text` | nullable |
| `snap_score` | `bigint` | default `0` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |
| `last_location` | `geography(Point,4326)` | optional user location |
| `location_updated_at` | `timestamptz` | last GPS update |
| `online_status_visibility` | `text` | `EVERYONE`/`FRIENDS`/`NOBODY` |

## `friendships`
Bidirectional friend relationship rows.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK → users |
| `friend_id` | `uuid` FK → users |
| `status` | `text` (`PENDING`,`ACCEPTED`,`BLOCKED`) |
| `created_at` | `timestamptz` |
| `updated_at` | `timestamptz` |

## `conversations`
Chat containers (1:1 or group).

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `is_group` | `boolean` |
| `title` | `text` nullable |
| `created_at` | `timestamptz` |
| `updated_at` | `timestamptz` |

## `conversation_members`
Membership and read markers.

| Column | Type |
|---|---|
| `conversation_id` | `uuid` FK |
| `user_id` | `uuid` FK |
| `joined_at` | `timestamptz` |
| `last_read_at` | `timestamptz` |

PK: (`conversation_id`, `user_id`)

## `messages`
Text/media messages.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `conversation_id` | `uuid` FK |
| `sender_id` | `uuid` FK |
| `message_type` | `text` (`TEXT`,`IMAGE`,`VIDEO`,`AUDIO`) |
| `content` | `text` |
| `media_url` | `text` |
| `is_ephemeral` | `boolean` |
| `expires_in_seconds` | `int` |
| `created_at` | `timestamptz` |

## `message_status`
Per-user delivery/view state.

| Column | Type |
|---|---|
| `message_id` | `uuid` FK |
| `user_id` | `uuid` FK |
| `status` | `text` (`DELIVERED`,`OPENED`,`REPLAYED`,`SCREENSHOTTED`) |
| `updated_at` | `timestamptz` |

PK: (`message_id`, `user_id`)

## `stories`
24h media stories.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK |
| `media_url` | `text` |
| `media_type` | `text` (`IMAGE`,`VIDEO`) |
| `duration_seconds` | `int` |
| `expires_at` | `timestamptz` |
| `created_at` | `timestamptz` |

## `story_views`
Who viewed which story.

| Column | Type |
|---|---|
| `story_id` | `uuid` FK |
| `viewer_id` | `uuid` FK |
| `viewed_at` | `timestamptz` |

PK: (`story_id`, `viewer_id`)

## `notification_tokens`
Push tokens per user and platform.

| Column | Type |
|---|---|
| `user_id` | `uuid` FK |
| `token` | `text` |
| `platform` | `text` (`IOS`,`ANDROID`,`WEB`) |
| `created_at` | `timestamptz` |

PK: (`user_id`, `token`)

## Key Relationships

- `users` 1↔N `friendships` (as requester or friend).
- `conversations` N↔N `users` through `conversation_members`.
- `conversations` 1↔N `messages`.
- `messages` 1↔N `message_status`.
- `users` 1↔N `stories`.
- `stories` 1↔N `story_views`.

## Storage Buckets

Expected buckets:
- `avatars`
- `chats`
- `stories`
- `temporary_snaps`

## Security Notes

- RLS enabled on major app tables.
- Policies constrain read/write to authenticated or relationship-scoped operations.
- Service role key must never be exposed in client-side code.
