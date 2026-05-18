# NovaSnap — Backlog d'exécution (Semaine 1-2)

## Tâches critiques (à lancer immédiatement)

### Sécurité (P0)

- [x] Corriger la policy RLS `conversation_members` pour restreindre la lecture aux membres de la conversation.
- [x] Durcir les policies Storage (`storage.objects`) pour limiter l'accès aux fichiers de l'utilisateur authentifié via un préfixe de chemin (`auth.uid()/...`).
- [x] Ajouter une migration SQL dédiée à ces correctifs afin de déployer proprement en environnement Supabase.
- [ ] Ajouter rate limiting global par IP + user sur toutes les écritures (messages/stories/uploads).
- [ ] Ajouter quotas journaliers anti-abus (stories/messages/IA).
- [ ] Ajouter journalisation sécurité structurée (abuse events) + dashboard de monitoring.
- [ ] Mettre en place rotation et validation stricte des secrets au runtime.

## Notes d'implémentation

Cette itération implémente les corrections immédiates côté base de données:
1. RLS stricte pour `conversation_members`.
2. Policies Storage orientées ownership utilisateur.

## Fichiers liés

- `supabase/migrations/20260518_security_p0_rls_storage.sql`
- `supabase_schema.sql`
