# 🧪 Test Nova AI - Nouvelle Architecture

## ✅ Checklist de test

### 1. Vérification de l'environnement

```bash
# Vérifier que la clé API est définie
cat .env | grep VITE_GEMINI_API_KEY

# Devrait afficher :
# VITE_GEMINI_API_KEY="AIza..."
```

### 2. Démarrage du serveur

```bash
npm run dev
```

**Attendu** :
```
🚀 NovaSnap server running on http://localhost:3000
✨ Nova AI : connexion directe à Gemini (pas de WebSocket serveur)
```

### 3. Test de l'interface

1. Ouvre http://localhost:3000
2. Connecte-toi avec un compte Supabase
3. Navigue vers l'écran avec l'orbe Nova

### 4. Test de Nova AI

#### Test 1 : Connexion basique

1. **Action** : Clique sur l'orbe Nova (bouton micro)
2. **Attendu** :
   - L'orbe passe en mode "Connexion..." (animation pulse jaune)
   - Demande d'autorisation caméra + micro
   - L'orbe devient coloré (gradient jaune/orange/rouge)
   - Vidéo preview visible dans l'orbe
   - Message "En écoute..." affiché

3. **Logs console attendus** :
   ```
   ✅ Session Gemini connectée
   ✅ Audio worklet chargé
   ✅ Frame vidéo envoyée
   ```

#### Test 2 : Conversation vocale

1. **Action** : Dis "Bonjour Nova, comment vas-tu ?"
2. **Attendu** :
   - Transcription apparaît en temps réel
   - Nova répond avec audio (voix Zephyr)
   - Réponse en français

#### Test 3 : Vision (caméra)

1. **Action** : Montre un objet à la caméra et dis "Que vois-tu ?"
2. **Attendu** :
   - Nova décrit l'objet visible
   - Réponse contextuelle basée sur l'image

#### Test 4 : Interruption

1. **Action** : Pendant que Nova parle, commence à parler
2. **Attendu** :
   - Nova s'arrête de parler
   - Transcription se réinitialise
   - Nova écoute ta nouvelle question

#### Test 5 : Déconnexion

1. **Action** : Clique sur l'orbe (bouton MicOff)
2. **Attendu** :
   - L'orbe revient à l'état initial (gris)
   - Caméra et micro s'arrêtent
   - Message "Nova AI - Connecté à Gemini Live"

### 5. Tests d'erreur

#### Test 6 : Clé API invalide

1. **Action** : Modifie `.env` avec une clé invalide
2. **Redémarre** : `npm run dev`
3. **Clique** sur l'orbe
4. **Attendu** :
   - Toast d'erreur : "Erreur de connexion à Nova AI"
   - Log console : "Erreur Gemini Live: ..."

#### Test 7 : Permissions refusées

1. **Action** : Refuse l'accès caméra/micro
2. **Attendu** :
   - Toast d'erreur avec message explicite
   - L'orbe revient à l'état initial

### 6. Tests de performance

#### Test 8 : Latence audio

1. **Action** : Dis "Répète après moi : test"
2. **Mesure** : Temps entre la fin de ta phrase et le début de la réponse
3. **Attendu** : < 500ms

#### Test 9 : Qualité vidéo

1. **Action** : Vérifie les logs console pour les frames vidéo
2. **Attendu** : 
   - Frame envoyée toutes les ~4 secondes
   - Taille ~10-30 KB par frame (base64)

#### Test 10 : Utilisation mémoire

1. **Action** : Ouvre DevTools → Performance → Memory
2. **Parle** pendant 2 minutes
3. **Attendu** : Pas de fuite mémoire (courbe stable)

## 🐛 Problèmes connus et solutions

### Problème : "Clé API Gemini manquante"

**Cause** : Variable d'environnement non chargée

**Solution** :
```bash
# Vérifier que le fichier .env existe
ls -la .env

# Redémarrer le serveur
npm run dev
```

### Problème : "Failed to connect to Gemini"

**Cause** : Clé API invalide ou restrictions

**Solution** :
1. Vérifie la clé sur [AI Studio](https://aistudio.google.com/apikey)
2. Vérifie les restrictions dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Assure-toi que `localhost:*` est autorisé

### Problème : Pas d'audio en retour

**Cause** : Fichier `pcm-capture-processor.js` manquant

**Solution** :
```bash
# Vérifier que le fichier existe
ls -la public/pcm-capture-processor.js

# Si manquant, le créer (voir documentation)
```

### Problème : Vidéo ne s'affiche pas

**Cause** : Permissions caméra refusées

**Solution** :
1. Clique sur l'icône cadenas dans la barre d'adresse
2. Autorise la caméra
3. Recharge la page

### Problème : "AudioWorklet not supported"

**Cause** : Navigateur ancien ou contexte non-sécurisé (HTTP)

**Solution** :
- Utilise HTTPS (ou localhost)
- Le fallback ScriptProcessor devrait s'activer automatiquement
- Log attendu : "AudioWorklet non disponible, utilisation de ScriptProcessor"

## 📊 Métriques de succès

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Temps de connexion | < 2s | Clic → "En écoute..." |
| Latence audio | < 500ms | Fin phrase → Début réponse |
| Qualité transcription | > 90% | Mots corrects / Total |
| Taux d'erreur | < 5% | Erreurs / Total sessions |
| Frames vidéo/min | ~15 | 1 frame / 4s |

## 🎯 Scénarios d'utilisation réels

### Scénario 1 : Assistant shopping

1. **Action** : Montre un produit et dis "C'est quoi ce produit ?"
2. **Attendu** : Nova identifie le produit et donne des infos

### Scénario 2 : Traduction visuelle

1. **Action** : Montre un texte en anglais et dis "Traduis ça en français"
2. **Attendu** : Nova lit le texte et traduit

### Scénario 3 : Aide aux devoirs

1. **Action** : Montre un problème de maths et dis "Comment résoudre ça ?"
2. **Attendu** : Nova explique étape par étape

### Scénario 4 : Identification d'objets

1. **Action** : Montre un objet et dis "C'est quoi ?"
2. **Attendu** : Nova identifie et décrit l'objet

## 📝 Rapport de test

### Template

```markdown
## Test effectué le : [DATE]

### Environnement
- Navigateur : [Chrome 120 / Firefox 121 / Safari 17]
- OS : [Windows 11 / macOS 14 / Linux]
- Connexion : [WiFi / 4G / 5G]

### Résultats

| Test | Statut | Notes |
|------|--------|-------|
| Connexion basique | ✅ / ❌ | |
| Conversation vocale | ✅ / ❌ | |
| Vision (caméra) | ✅ / ❌ | |
| Interruption | ✅ / ❌ | |
| Déconnexion | ✅ / ❌ | |
| Latence audio | ✅ / ❌ | [XXX ms] |
| Qualité transcription | ✅ / ❌ | [XX%] |

### Bugs trouvés
1. [Description du bug]
2. [Description du bug]

### Améliorations suggérées
1. [Suggestion]
2. [Suggestion]
```

## 🚀 Prochaines étapes

Après validation des tests :

1. [ ] Déployer sur environnement de staging
2. [ ] Tester avec plusieurs utilisateurs
3. [ ] Configurer les quotas Google Cloud
4. [ ] Implémenter le monitoring (erreurs, latence)
5. [ ] Déployer en production
6. [ ] Documenter les retours utilisateurs

## 📚 Ressources

- [Gemini Live API Docs](https://ai.google.dev/gemini-api/docs/live-api)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API)
