export type PendingMessage = {
  id: string; // clientMessageId
  conversationId: string;
  content: string;
  senderId: string;
  createdAt: string;
  retryCount: number;
};

const DB_NAME = 'novasnap-queue';
const DB_VERSION = 2;
const STORE_NAME = 'messages';
const CONFIG_STORE = 'config';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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

export const messageQueue = {
  async enqueue(msg: Omit<PendingMessage, 'retryCount'>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const pending: PendingMessage = { ...msg, retryCount: 0 };
      const request = store.put(pending);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async dequeue(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAll(): Promise<PendingMessage[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveConfig(url: string, key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONFIG_STORE, 'readwrite');
      const store = transaction.objectStore(CONFIG_STORE);
      store.put(url, 'supabaseUrl');
      store.put(key, 'supabaseAnonKey');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getConfig(): Promise<{ supabaseUrl: string; supabaseAnonKey: string }> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
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
      transaction.onerror = () => reject(transaction.error);
    });
  }
};
