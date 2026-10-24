// IndexedDB storage for local caching of APK binary files
const DB_NAME = 'motoride_apk_db';
const DB_VERSION = 1;
const STORE_NAME = 'apk_store';
const KEY = 'latest_uploaded_apk';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveApkBlobToIndexedDb(blob: Blob): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(blob, KEY);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (e) {
    console.warn('Failed to save APK blob to IndexedDB:', e);
    return false;
  }
}

export async function getApkBlobFromIndexedDb(): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => {
        resolve(getReq.result || null);
      };
      getReq.onerror = () => {
        resolve(null);
      };
    });
  } catch (e) {
    return null;
  }
}

export async function deleteApkBlobFromIndexedDb(): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(KEY);
      delReq.onsuccess = () => resolve(true);
      delReq.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}
