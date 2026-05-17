# NovaSnap Mobile Web

NovaSnap is a mobile-first social PWA inspired by camera-first messaging apps: users can chat, share ephemeral media, publish stories, manage friends, and explore a live map with privacy-aware location sharing.  
The project combines a React 19 frontend, Supabase backend services, and a Node/Express realtime bridge for Gemini Live voice interactions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| UI/Animation | Tailwind CSS v4, Framer Motion, Lucide Icons |
| State | Zustand |
| Data Fetching | TanStack Query |
| Backend Platform | Supabase (PostgreSQL, Auth, Storage, Realtime, RPC) |
| Realtime Voice AI | WebSocket (`ws`) + Google Gemini Live API |
| Server Runtime | Node.js + Express + tsx/esbuild |

## MVP Features

- Authentication (signup/login) with Supabase Auth.
- Camera-first navigation (`Map → Chat → Camera → Stories`) with swipe transitions.
- Realtime chat and conversation management.
- Stories with expiration logic and view tracking.
- Friends system (requests/accepted relationships).
- Snap Map with:
  - user geolocation heartbeat,
  - nearby friends via PostGIS RPC,
  - ghost mode privacy.
- Profile/settings with privacy toggles and manual location refresh.
- Push notification plumbing (web + Supabase edge function).
- Live AI voice websocket channel (`/live`) authenticated by Supabase JWT.

## Prerequisites

- Node.js **18+** (recommended: latest LTS)
- npm **9+**
- Supabase project (URL + anon key + service role key)
- (Optional for local DB workflows) Supabase CLI
- Google Gemini API key (for `/live` voice assistant)

## Installation & Configuration

1. **Clone repository**
   ```bash
   git clone <your-repo-url>
   cd NovaSnap-Mobile-Web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create local env file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see section below).

5. **Prepare database schema**
   - Apply the baseline SQL (`supabase_schema.sql`) in your Supabase SQL editor.
   - Apply additional migration files (including `supabase/migrations/20240601_gps_location.sql`).

6. **Create Supabase Storage buckets** (if not already created by SQL):
   - `avatars`
   - `chats`
   - `stories`
   - `temporary_snaps`

## Running the Project

### Development
```bash
npm run dev
```
- Starts the Node server with Vite middleware (`tsx server.ts`)
- Default URL: `http://localhost:3000`

### Production build
```bash
npm run build
npm run start
```
- `build`: Vite client build + bundles `server.ts` to `dist/server.cjs`
- `start`: runs bundled server

### Type checking
```bash
npm run lint
# (mapped to tsc --noEmit)
```

## Project Structure

```text
.
├── public/                        # Static assets + service worker
├── src/
│   ├── components/                # Reusable UI, camera, chat/navigation widgets
│   ├── hooks/                     # React Query + app hooks (friends, stories, online, location)
│   ├── lib/                       # Supabase client, shared types, utilities
│   ├── screens/                   # Top-level app screens (Auth, Map, Chat, Stories, Profile...)
│   ├── store/                     # Zustand global app store
│   ├── App.tsx                    # App shell, view orchestration, overlays/modals
│   └── main.tsx                   # React entrypoint
├── supabase/
│   ├── config.toml
│   ├── functions/                 # Edge function(s) (e.g., push notifications)
│   └── migrations/                # SQL migrations (GPS/location migration included)
├── supabase_schema.sql            # Baseline DB schema and policies
├── server.ts                      # Express + WS + Gemini Live bridge
├── package.json
└── tsconfig.json
```

## Environment Variables

Use `.env` (server + Vite client vars):

| Variable | Required | Scope | Description |
|---|---:|---|---|
| `VITE_SUPABASE_URL` | ✅ | Client+Server | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Client | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only | Required by websocket auth verification |
| `GEMINI_API_KEY` | ✅ (for AI) | Server only | Google Gemini API key |
| `APP_URL` | Recommended | Server/links | Canonical app URL |
| `VITE_LIVEKIT_URL` | Optional | Client | LiveKit URL (if voice/video features enabled) |
| `VITE_LIVEKIT_API_KEY` | Optional | Client | LiveKit API key |
| `LIVEKIT_API_SECRET` | Optional | Server | LiveKit secret |

## Contributing Best Practices

- Prefer small, focused PRs (one feature/fix per PR).
- Keep strict TypeScript typing; avoid `any`.
- Never commit secrets or service-role keys.
- Update docs when changing schema, RPC contracts, or flows.
- Validate with `npm run lint` before opening PR.
- Follow existing app patterns (Zustand store + React Query hooks + screen-level orchestration).

See also: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Documentation Index

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API_DOCS.md](./API_DOCS.md)
- [DB_SCHEMA.md](./DB_SCHEMA.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT License.
