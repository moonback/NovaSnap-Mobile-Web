# NovaSnap — Backlog d'exécution (Semaine 1-2)

## Tâches critiques (à lancer immédiatement)

### Sécurité (P0)

- [x] Corriger la policy RLS `conversation_members` pour restreindre la lecture aux membres de la conversation.
- [x] Durcir les policies Storage (`storage.objects`) pour limiter l'accès aux fichiers de l'utilisateur authentifié via un préfixe de chemin (`auth.uid()/...`).
- [x] Ajouter une migration SQL dédiée à ces correctifs afin de déployer proprement en environnement Supabase.
- [x] Corriger les policies Storage P0 pour préserver les usages produit (lecture médias partagés en chat/stories) tout en gardant un contrôle strict par appartenance conversationnelle/ownership.
- [x] Ajouter rate limiting global par IP + user sur toutes les écritures (messages/stories/uploads).
- [x] Ajouter quotas journaliers anti-abus (stories/messages/IA).
- [x] Ajouter journalisation sécurité structurée (abuse events) + dashboard de monitoring.
- [x] Ajouter journalisation sécurité structurée minimale côté serveur Gemini Live (security events de connexion/auth/rate limit).
- [x] Mettre en place validation stricte des secrets au runtime (interdiction fallback `VITE_GEMINI_API_KEY` côté serveur).

## Notes d'implémentation

Cette itération implémente les corrections immédiates côté base de données:
1. RLS stricte pour `conversation_members`.
2. Policies Storage orientées ownership utilisateur.
3. Correctif de compatibilité produit:
   - `avatars`: lecture authentifiée globale, écriture owner-only (`<uid>/...`)
   - `stories`: lecture authentifiée globale, écriture owner-only (`<uid>/...`)
   - `chats` + `temporary_snaps`: lecture/écriture conditionnées à l'appartenance à la conversation et chemin normalisé `<conversation_id>/<sender_uid>/...`
4. Rate limiting + quotas journaliers + journalisation sécurité persistée:
   - Table `security_events` avec index et RLS (service role full access, users read own)
   - Table `daily_usage` + table `quota_config` (limites configurables sans redéploiement)
   - Fonction `check_and_increment_quota` (appelée côté client via RPC, auth.uid())
   - Fonction `check_and_increment_quota_for_user` (appelée par le serveur WS via service role)
   - Fonction `log_security_event` (service role uniquement, utilisée par le serveur WS et les Edge Functions)
   - Vue `security_events_dashboard` (agrégation 24h, service role uniquement)
   - Edge Function `check-rate-limit`: IP rate limit (60 req/min) + quota journalier DB-authoritative, retourne 429 avec `retry_after`
   - Edge Function `security-dashboard`: dashboard admin (service role), agrégation configurable sur 1–168h
   - Hook React `useRateLimit`: wraps `check-rate-limit`, expose `checkQuota(resourceType)` + état `usage`
   - `gemini-ws-server.ts`: `logSecurityEvent` persiste maintenant en DB + quota AI session vérifié à la connexion

## Fichiers liés

- `supabase/migrations/20260518_security_p0_rls_storage.sql`
- `supabase/migrations/20260518_security_p0_storage_policy_fix.sql`
- `supabase/migrations/20260518_security_p0_rate_limiting.sql`
- `supabase/functions/check-rate-limit/index.ts`
- `supabase/functions/security-dashboard/index.ts`
- `src/hooks/useRateLimit.ts`
- `gemini-ws-server.ts`
- `supabase_schema.sql`
