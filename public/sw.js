// ============================================================
// NovaSnap Service Worker v4 — Production-Grade PWA
// ============================================================
// Features:
//  ✅ Precache + versioned cache busting
//  ✅ Network-First for navigations (with offline fallback)
//  ✅ Stale-While-Revalidate for static assets
//  ✅ Network-First for API calls (with timeout)
//  ✅ Cache-First for images
//  ✅ Web Push Notifications with rich actions
//  ✅ App Badge API
//  ✅ Background Sync for failed messages
//  ✅ Update lifecycle management (SKIP_WAITING)
// ============================================================

const CACHE_VERSION = 'v4';
const STATIC_CACHE = `novasnap-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `novasnap-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `novasnap-images-${CACHE_VERSION}`;

// Core shell assets that MUST be available offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png',
  '/logo.png',
];

// Max entries per cache to prevent storage bloat
const MAX_RUNTIME_ENTRIES = 60;
const MAX_IMAGE_ENTRIES = 80;

// Network timeout before falling back to cache (ms)
const NETWORK_TIMEOUT_MS = 4000;

// ── Icons par type de notification ──────────────────────────
const NOTIFICATION_ICONS = {
  NEW_MESSAGE: '/icons/icon-192.png',
  SNAP_OPENED: '/icons/icon-192.png',
  FRIEND_REQUEST: '/icons/icon-192.png',
  FRIEND_ACCEPTED: '/icons/icon-192.png',
  NEW_STORY: '/icons/icon-192.png',
  SNAP_SCREENSHOT: '/icons/icon-192.png',
  DEFAULT: '/icons/icon-192.png',
};

// ── Couleurs badge par type ─────────────────────────────────
const NOTIFICATION_COLORS = {
  NEW_MESSAGE: '#FFC0CB',
  SNAP_OPENED: '#22c55e',
  FRIEND_REQUEST: '#3b82f6',
  FRIEND_ACCEPTED: '#22c55e',
  NEW_STORY: '#a855f7',
  SNAP_SCREENSHOT: '#ef4444',
  DEFAULT: '#FFC0CB',
};

// ═══════════════════════════════════════════════════════════
// INSTALL — Precache critical assets
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ═══════════════════════════════════════════════════════════
// ACTIVATE — Clean old caches, claim clients
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all clients that a new version is active
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
          });
        });
      })
  );
});

// ═══════════════════════════════════════════════════════════
// FETCH — Intelligent routing
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, etc.)
  if (request.method !== 'GET') return;

  // Skip Supabase API calls (real-time, auth, storage signed URLs)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) return;

  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Skip browser extensions and chrome-extension:// URLs
  if (url.protocol === 'chrome-extension:') return;

  // ─── Navigation requests → Network-First with offline fallback ───
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstWithTimeout(request, STATIC_CACHE, NETWORK_TIMEOUT_MS)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // ─── Images → Cache-First with network fallback ───
  if (request.destination === 'image' || isImageUrl(url)) {
    event.respondWith(cacheFirstWithRefresh(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // ─── JS/CSS bundles → Stale-While-Revalidate ───
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, MAX_RUNTIME_ENTRIES));
    return;
  }

  // ─── Everything else → Network-First ───
  event.respondWith(
    networkFirstWithTimeout(request, RUNTIME_CACHE, NETWORK_TIMEOUT_MS)
  );
});

// ═══════════════════════════════════════════════════════════
// PUSH — Rich notifications
// ═══════════════════════════════════════════════════════════
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
      timestamp: Date.now(),
    },
    actions: buildNotificationActions(type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => updateAppBadge())
  );
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATION CLICK — Deep-link routing
// ═══════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { type, url, conversation_id, requester_id } = event.notification.data || {};
  const action = event.action;

  // Quick actions
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

  // Main click
  event.waitUntil(openOrFocusApp(url || '/'));
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATION CLOSE
// ═══════════════════════════════════════════════════════════
self.addEventListener('notificationclose', () => {
  // Optional: analytics tracking
});

// ═══════════════════════════════════════════════════════════
// MESSAGE — Client → SW communication
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'UPDATE_BADGE':
      updateAppBadge(event.data.count);
      break;
    case 'CLEAR_BADGE':
      clearAppBadge();
      break;
    case 'GET_VERSION':
      event.source?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
      break;
    case 'CACHE_URLS':
      // Allow the app to dynamically add URLs to cache
      if (Array.isArray(event.data.urls)) {
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.addAll(event.data.urls).catch(() => { });
        });
      }
      break;
  }
});

// ═══════════════════════════════════════════════════════════
// BACKGROUND SYNC — Retry failed operations
// ═══════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-message') {
    event.waitUntil(retrySendMessages());
  }
});

// ═══════════════════════════════════════════════════════════
// CACHING STRATEGIES
// ═══════════════════════════════════════════════════════════

/**
 * Network-First with timeout — Try network, fall back to cache after timeout
 */
async function networkFirstWithTimeout(request, cacheName, timeout) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await promiseTimeout(fetch(request), timeout);

    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // For navigation, return offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    return new Response('Network error', { status: 408, statusText: 'Request Timeout' });
  }
}

/**
 * Cache-First — Serve from cache, update in background
 */
async function cacheFirstWithRefresh(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Background refresh
    fetch(request).then((response) => {
      if (response && response.ok) {
        cache.put(request, response);
        trimCache(cacheName, maxEntries);
      }
    }).catch(() => { });

    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

/**
 * Stale-While-Revalidate — Serve cached, update in background
 */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  }).catch(() => cached);

  return cached || networkFetch;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function isImageUrl(url) {
  return /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)(\?.*)?$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot)(\?.*)?$/i.test(url.pathname) ||
    url.pathname.startsWith('/assets/');
}

/**
 * Promise with timeout wrapper
 */
function promiseTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Trim cache to max entries (FIFO)
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

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
      return [{ action: 'accept_friend', title: '✅ Accepter' }];
    case 'NEW_STORY':
      return [{ action: 'view_story', title: '👀 Voir' }];
    default:
      return [];
  }
}

async function openOrFocusApp(url) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Focus existing window
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

  // Open new window
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
        await self.navigator.setAppBadge();
      }
    }
  } catch {
    // Badge API not supported
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

const DB_NAME = 'novasnap-queue';
const STORE_NAME = 'messages';
const CONFIG_STORE = 'config';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // DB version 2 supporting both messages and config
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoredConfig(db) {
  return new Promise((resolve) => {
    const transaction = db.transaction(CONFIG_STORE, 'readonly');
    const store = transaction.objectStore(CONFIG_STORE);
    const reqUrl = store.get('supabaseUrl');
    const reqKey = store.get('supabaseAnonKey');
    transaction.oncomplete = () => {
      resolve({
        supabaseUrl: reqUrl.result || '',
        supabaseAnonKey: reqKey.result || '',
      });
    };
    transaction.onerror = () => resolve({ supabaseUrl: '', supabaseAnonKey: '' });
  });
}

function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function removePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retry sending messages stored in IndexedDB (Background Sync)
 */
async function retrySendMessages() {
  let db;
  try {
    db = await openQueueDB();
  } catch (err) {
    console.error('[SW:BackgroundSync] Impossible d\'ouvrir IndexedDB:', err);
    return;
  }

  const config = await getStoredConfig(db);
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('[SW:BackgroundSync] Configuration Supabase manquante dans IndexedDB.');
    return;
  }

  const messages = await getPendingMessages(db);
  if (messages.length === 0) {
    return;
  }

  console.log(`[SW:BackgroundSync] ${messages.length} messages en attente de synchronisation...`);

  const processedIds = [];

  for (const msg of messages) {
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey,
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          conversation_id: msg.conversationId,
          content: msg.content,
          message_type: 'TEXT',
          sender_id: msg.senderId,
          client_message_id: msg.id,
          is_ephemeral: true,
          is_saved: false,
          opened_by: [],
          created_at: msg.createdAt,
        }),
      });

      if (response.ok) {
        await removePendingMessage(db, msg.id);
        processedIds.push(msg.id);
        console.log(`[SW:BackgroundSync] Message ${msg.id} synchronisé avec succès.`);
      } else {
        const errorText = await response.text();
        console.error(`[SW:BackgroundSync] Erreur lors de l'envoi du message ${msg.id}: Status ${response.status} - ${errorText}`);
      }
    } catch (err) {
      console.error(`[SW:BackgroundSync] Exception lors de l'envoi du message ${msg.id}:`, err);
    }
  }

  if (processedIds.length > 0) {
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({ type: 'MESSAGES_SYNCED', ids: processedIds });
      });
    } catch (e) {
      console.warn('Failed to notify clients of processed sync:', e);
    }
  }
}
