// ============================================================
// NovaSnap Service Worker — Cache + Web Push Notifications
// ============================================================

const CACHE_NAME = 'novasnap-cache-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Icônes par type de notification ─────────────────────────
const NOTIFICATION_ICONS = {
  NEW_MESSAGE:     '/icons/icon-192.png',
  SNAP_OPENED:     '/icons/icon-192.png',
  FRIEND_REQUEST:  '/icons/icon-192.png',
  FRIEND_ACCEPTED: '/icons/icon-192.png',
  NEW_STORY:       '/icons/icon-192.png',
  SNAP_SCREENSHOT: '/icons/icon-192.png',
  DEFAULT:         '/icons/icon-192.png',
};

// ── Couleurs badge par type ──────────────────────────────────
const NOTIFICATION_COLORS = {
  NEW_MESSAGE:     '#FFFC00',
  SNAP_OPENED:     '#22c55e',
  FRIEND_REQUEST:  '#3b82f6',
  FRIEND_ACCEPTED: '#22c55e',
  NEW_STORY:       '#a855f7',
  SNAP_SCREENSHOT: '#ef4444',
  DEFAULT:         '#FFFC00',
};

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch (Network-First pour navigations, Cache-First sinon) ────────────
self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes API Supabase
  if (event.request.url.includes('supabase.co')) return;

  // Stratégie Network-First pour les navigations (HTML)
  // Évite de servir un index.html de production obsolète en mode développement
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Stratégie Cache-First pour le reste
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});

// ── Push notification reçue ───────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'NovaSnap', body: event.data.text(), type: 'DEFAULT', data: {} };
  }

  const {
    title = 'NovaSnap',
    body = '',
    type = 'DEFAULT',
    data = {},
  } = payload;

  const icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.DEFAULT;
  const badgeColor = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.DEFAULT;

  const options = {
    body,
    icon,
    badge: '/icons/badge-72.png',
    tag: `novasnap-${type}-${data.conversation_id || data.friendship_id || data.story_id || Date.now()}`,
    renotify: true,
    silent: false,
    vibrate: [100, 50, 100],
    data: {
      ...data,
      type,
      url: buildNotificationUrl(type, data),
      badgeColor,
    },
    actions: buildNotificationActions(type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Mettre à jour le badge de l'app (API Badge)
      return updateAppBadge();
    })
  );
});

// ── Clic sur une notification ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { type, url, conversation_id, requester_id } = event.notification.data || {};
  const action = event.action;

  // Actions rapides
  if (action === 'reply' && conversation_id) {
    event.waitUntil(openOrFocusApp(`/?view=chat&conversation=${conversation_id}`));
    return;
  }
  if (action === 'accept_friend' && requester_id) {
    event.waitUntil(openOrFocusApp(`/?view=friends&accept=${requester_id}`));
    return;
  }
  if (action === 'view_story') {
    event.waitUntil(openOrFocusApp(`/?view=stories`));
    return;
  }

  // Clic principal
  event.waitUntil(openOrFocusApp(url || '/'));
});

// ── Fermeture d'une notification ──────────────────────────────
self.addEventListener('notificationclose', () => {
  // Optionnel : analytics
});

// ── Message depuis le client (badge update, etc.) ────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'UPDATE_BADGE':
      updateAppBadge(event.data.count);
      break;
    case 'CLEAR_BADGE':
      clearAppBadge();
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// ── Helpers ───────────────────────────────────────────────────

function buildNotificationUrl(type, data) {
  switch (type) {
    case 'NEW_MESSAGE':
      return data.conversation_id ? `/?view=chat&conversation=${data.conversation_id}` : '/?view=chat';
    case 'SNAP_OPENED':
      return '/?view=chat';
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
      return '/?view=friends';
    case 'NEW_STORY':
      return '/?view=stories';
    default:
      return '/';
  }
}

function buildNotificationActions(type) {
  switch (type) {
    case 'NEW_MESSAGE':
      return [{ action: 'reply', title: '💬 Répondre' }];
    case 'FRIEND_REQUEST':
      return [
        { action: 'accept_friend', title: '✅ Accepter' },
      ];
    case 'NEW_STORY':
      return [{ action: 'view_story', title: '👀 Voir' }];
    default:
      return [];
  }
}

async function openOrFocusApp(url) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Chercher une fenêtre déjà ouverte
  for (const client of clients) {
    if ('focus' in client) {
      await client.focus();
      if ('navigate' in client) {
        await client.navigate(url);
      } else {
        client.postMessage({ type: 'NAVIGATE', url });
      }
      return;
    }
  }

  // Ouvrir une nouvelle fenêtre
  if (self.clients.openWindow) {
    await self.clients.openWindow(url);
  }
}

async function updateAppBadge(count) {
  try {
    if ('setAppBadge' in self.navigator) {
      if (count !== undefined && count > 0) {
        await self.navigator.setAppBadge(count);
      } else {
        // Compter les notifications non lues depuis le cache si pas de count fourni
        await self.navigator.setAppBadge();
      }
    }
  } catch {
    // API Badge non supportée sur ce navigateur
  }
}

async function clearAppBadge() {
  try {
    if ('clearAppBadge' in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // ignore
  }
}
