# Contributing Guide

Thanks for contributing to NovaSnap.

## 1) Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment file:
   ```bash
   cp .env.example .env
   ```
4. Run app:
   ```bash
   npm run dev
   ```

## 2) Branching Strategy

- Create a feature branch from `main`:
  - `feat/<short-name>`
  - `fix/<short-name>`
  - `docs/<short-name>`

## 3) Coding Standards

- TypeScript-first; avoid `any`.
- Reuse existing hooks/store patterns.
- Keep components focused and composable.
- Use React Query for server state and Zustand for app/UI state.
- Keep Supabase access logic inside hooks/lib helpers when possible.

## 4) Database Changes

- Add SQL migrations for schema changes under `supabase/migrations/`.
- Keep migrations idempotent where possible.
- Update `DB_SCHEMA.md` and API docs when RPCs/tables change.

## 5) Validation Before PR

Run at minimum:
```bash
npm run lint
npm run build
```

## 6) Pull Request Checklist

- [ ] Scope is focused and understandable.
- [ ] Typecheck/build passes locally.
- [ ] No secrets added to code/history.
- [ ] Docs updated (README/API/DB/architecture as needed).
- [ ] Screenshots or recordings attached for UI changes.

## 7) Commit Message Guidelines

Use concise conventional-style messages, e.g.:
- `feat(map): add nearby friends clustering`
- `fix(chat): prevent duplicate optimistic messages`
- `docs(readme): update local setup`
