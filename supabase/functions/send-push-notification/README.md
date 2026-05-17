# Edge Function — send-push-notification

Envoie des notifications Web Push (RFC 8030 + RFC 8291) aux abonnés NovaSnap.
Utilise VAPID (RFC 8292) avec Web Crypto API native Deno — aucune dépendance npm.

## Architecture

```
DB Trigger (INSERT notifications)
    └─► pg_net HTTP POST
            └─► Edge Function send-push-notification
                    └─► Web Push API (FCM / Mozilla Push / etc.)
                            └─► Navigateur utilisateur
```

## Déploiement

### 1. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Résultat :
```
Public Key:  Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Configurer les secrets Supabase

Dans le Dashboard Supabase → **Project Settings → Edge Functions → Secrets** :

| Nom | Valeur |
|-----|--------|
| `VAPID_PUBLIC_KEY` | Ta clé publique VAPID |
| `VAPID_PRIVATE_KEY` | Ta clé privée VAPID |
| `VAPID_SUBJECT` | `mailto:ton@email.com` |

Les secrets `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.

### 3. Ajouter la clé publique dans le .env du front

```env
VITE_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Déployer la fonction

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier au projet
supabase link --project-ref YOUR_PROJECT_ID

# Déployer
supabase functions deploy send-push-notification --no-verify-jwt
```

### 5. Exécuter la migration v13

Dans le SQL Editor de Supabase, exécuter `supabase_migration_v13.sql` puis configurer :

```sql
ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT_ID.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.supabase_anon_key = 'YOUR_ANON_KEY';
```

## Format du payload

```json
{
  "user_id": "uuid-de-l-utilisateur",
  "title": "Titre de la notification",
  "body": "Corps du message",
  "type": "NEW_MESSAGE | SNAP_OPENED | FRIEND_REQUEST | FRIEND_ACCEPTED | NEW_STORY | SNAP_SCREENSHOT",
  "data": {
    "conversation_id": "...",
    "sender_id": "..."
  }
}
```

## Réponse

```json
{
  "sent": 2,
  "total": 2,
  "expired_cleaned": 0
}
```

## Flux automatique

Les triggers DB (migration v12) créent automatiquement des entrées dans `notifications`.
La migration v13 connecte ces insertions à l'Edge Function via `pg_net`.

**Aucun appel manuel nécessaire** — tout est déclenché automatiquement par les actions utilisateurs.

## Test manuel

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "votre-user-id",
    "title": "Test NovaSnap",
    "body": "Notification de test 🎉",
    "type": "NEW_MESSAGE",
    "data": {}
  }'
```
