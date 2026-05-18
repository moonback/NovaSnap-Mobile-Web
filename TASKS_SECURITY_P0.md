Voici l'analyse complète de l'application NovaSnap :

🔍 Rapport d'audit — Fonctionnalités incomplètes / mockées / à implémenter
1. 🟡 "Bientôt disponible" explicite
Fichier	Ligne	Problème
StoriesScreen.tsx
~201	"Analyse ma vue et dis-moi ce que tu vois..." (Bientôt disponible) — La fonctionnalité d'analyse visuelle de la caméra via Gemini AI est affichée mais non implémentée. Le bouton "Nova AI" ouvre le GeminiOrb mais la feature "vision" est juste un texte placeholder.
2. 🔴 Données hardcodées / approximations non réelles
Fichier	Ligne	Problème
MapScreen.tsx
~410–412	// Note: stories table has no lat/lng columns yet — Les marqueurs de stories sur la carte sont positionnés artificiellement autour de l'utilisateur avec un offset angulaire calculé (0.003 * Math.cos(angle)), pas depuis de vraies coordonnées GPS.
MapScreen.tsx
~139	Coordonnées par défaut hardcodées : [48.8566, 2.3522] (Paris) si la géolocalisation échoue — acceptable mais non documenté pour l'utilisateur.
MapScreen.tsx
~380–400	Les zones de heatmap pour les stories sont calculées avec des offsets fictifs, pas depuis des données réelles de localisation.
ProfileScreen.tsx
~299	supabase.auth.admin.deleteUser(user.id) — Cette méthode nécessite des droits admin côté serveur. Elle échoue silencieusement côté client (console.warn) et se contente de déconnecter l'utilisateur sans vraiment supprimer le compte auth.
3. 🔴 Console.log de debug laissés en production
Fichier	Lignes	Problème
ConversationScreen.tsx
450, 463, 488, 512, 537, 543, 551, 558, 562, 573, 582, 587, 602, 608, 623, 630, 631, 657, 664, 672, 680, 690	Très nombreux console.log de debug laissés dans le code de production ([NovaChat:Query], [NovaChat:Realtime], [NovaChat:Lifecycle], [NovaChat:Cleanup], [NovaChat:Mutation]). Ces logs exposent des données sensibles (IDs de messages, contenu) dans la console.
GeminiOrb.tsx
~60, 75, 90, 100, 110, 130, 145, 165, 185	Nombreux console.log de debug Nova AI laissés ([Nova AI] ✅ WebSocket connecté, [Nova AI] Message reçu, etc.)
4. 🟠 Fonctionnalités partiellement implémentées
MapScreen.tsx
Stories sur la carte (ligne ~410) : La table stories n'a pas de colonnes lat/lng. Les marqueurs sont placés en cercle autour de l'utilisateur — fonctionnalité visuellement présente mais géographiquement fausse.
Paramètres de la carte (bouton Settings) : Le panneau showSettings s'ouvre mais les toggles showFriendsOnMap et mapStyle sont fonctionnels. Cependant, il n'y a pas de persistance de ces préférences (pas de localStorage).
StoriesScreen.tsx
Section "Découvrir" : Affiche toutes les stories sans filtrage par popularité/tendance. Le label "Tendance" est affiché mais il n'y a aucune logique de tri par popularité — c'est juste l'ordre de création.
ProfileScreen.tsx
Suppression de compte (ligne ~280–315) : supabase.auth.admin.deleteUser() échoue côté client (pas de droits admin). Le compte Supabase Auth n'est pas réellement supprimé, seules les données DB le sont. Il faudrait une Edge Function.
"NovaSnap Premium" (ligne ~390) : Affiché dans le header du profil mais aucune logique premium n'existe dans l'app (pas de paywall, pas de feature gate).
UserProfileScreen.tsx
Stories de l'utilisateur (ligne ~120) : Les URLs des stories ne sont pas signées (media_url: s.media_url — commentaire // signed URL resolution could be added here). Les images peuvent ne pas s'afficher si le bucket est privé.
GeminiOrb.tsx
Analyse visuelle : Le composant capture bien la vidéo et envoie des frames toutes les 4 secondes, mais la feature "analyse ma vue" affichée dans StoriesScreen est marquée "Bientôt disponible" — le GeminiOrb fonctionne en mode vocal mais l'intégration contextuelle Stories n'est pas faite.
5. 🟠 Hooks avec comportements incomplets
Hook	Problème
useFriendLocations.ts
Dépend de la RPC get_nearby_friends — si la fonction SQL n'existe pas en DB, retourne silencieusement [] sans message d'erreur UI.
useOnlineStatus.ts
Dépend de get_user_online_status et get_batch_online_status — même problème. Le canView retourné n'est jamais utilisé pour conditionner l'affichage dans les composants.
useRateLimit.ts
Le checkQuota est implémenté mais n'est appelé nulle part dans les écrans (ni dans ConversationScreen, ni dans CameraView). Le rate limiting est donc inactif côté client.
usePushNotifications.ts
VAPID_PUBLIC_KEY peut être vide ('') si VITE_VAPID_PUBLIC_KEY n'est pas défini — les push notifications sont alors silencieusement désactivées sans feedback utilisateur.
6. 🟡 Boutons/toggles sans logique complète
Fichier	Élément	Problème
ProfileScreen.tsx
Toggle "Qualité d'envoi" (mediaQuality)	Sauvegardé en localStorage et lu dans CameraView — fonctionnel, mais le mode 'eco'/'low' est traité identiquement dans le code (`mediaQuality === 'eco'
ProfileScreen.tsx
Toggle "Sauvegarde automatique"	Sauvegardé en localStorage mais lu uniquement dans CameraView — si l'utilisateur envoie depuis un autre chemin, l'auto-save ne se déclenche pas.
MapScreen.tsx
Toggle "Afficher les amis sur la carte" (showFriendsOnMap)	Fonctionnel mais non persisté entre sessions.
MapScreen.tsx
Toggle "Style de carte" (mapStyle)	Fonctionnel mais non persisté entre sessions.
NotificationBell.tsx
Bouton BellOff (activer push)	Appelle subscribe() mais n'affiche aucun feedback si la permission est refusée ou si VAPID_PUBLIC_KEY est absent.
7. 🟡 Sections UI vides / placeholders
Fichier	Section	Problème
StoriesScreen.tsx
Section "Découvrir" — label "Tendance"	Aucun algorithme de tendance — affiche simplement toutes les stories.
ProfileScreen.tsx
Badge "NovaSnap Premium"	Affiché pour tous les utilisateurs, aucune logique de tier.
MapScreen.tsx
Panneau "Autour de moi" — section stories	Affiche les stories avec des positions fictives, pas géolocalisées.
UserProfileScreen.tsx
Stories de l'utilisateur	URLs non signées — risque d'images cassées sur bucket privé.
Résumé par priorité
🔴 Critique (à corriger avant prod)

ConversationScreen.tsx — Purger les ~20 console.log de debug
ProfileScreen.tsx — Suppression de compte via Edge Function (pas admin.deleteUser côté client)
UserProfileScreen.tsx — Signer les URLs des stories
🟠 Important (fonctionnalité incomplète) 4. MapScreen.tsx — Stories sans coordonnées GPS réelles (colonne lat/lng manquante en DB) 5. useRateLimit.ts — Hook implémenté mais jamais appelé 6. MapScreen.tsx — Persistance des préférences carte manquante

🟡 Mineur (polish) 7. StoriesScreen.tsx — "Bientôt disponible" à retirer ou implémenter 8. ProfileScreen.tsx — Badge "Premium" sans logique 9. GeminiOrb.tsx — Nettoyer les console.log de debug 10. StoriesScreen.tsx — Algorithme "Tendance" à implémenter

---

## 📚 Documentation des solutions

### ✅ Solutions détaillées disponibles

Les problèmes de **données hardcodées** (section 2 ci-dessus) ont des solutions complètes documentées :

📄 **SOLUTIONS_HARDCODED_DATA.md**
- Solutions détaillées pour chaque problème
- Code TypeScript prêt à l'emploi
- Exemples de migration SQL
- Checklist de déploiement

📄 **scripts/migrations/add_gps_to_stories.sql**
- Migration SQL complète pour ajouter les colonnes GPS
- Fonctions helper pour calculs de distance
- Index optimisés pour les requêtes géospatiales
- Vue pour les stories géolocalisées

📄 **supabase/functions/delete-account/index.ts**
- Edge Function complète pour suppression RGPD
- Gestion des erreurs et logs détaillés
- Suppression en cascade de toutes les données
- Conforme au droit à l'effacement

📄 **DEPLOYMENT_GUIDE_HARDCODED_FIXES.md**
- Guide pas à pas pour le déploiement
- Procédures de test complètes
- Dépannage et monitoring
- Checklist de vérification

### 🎯 Prochaines étapes recommandées

1. **Priorité 1** : Déployer la migration GPS pour les stories
2. **Priorité 2** : Déployer l'Edge Function de suppression de compte (RGPD)
3. **Priorité 3** : Améliorer le feedback de géolocalisation
4. **Priorité 4** : Nettoyer les console.log de debug (ConversationScreen, GeminiOrb)
5. **Priorité 5** : Implémenter le rate limiting actif