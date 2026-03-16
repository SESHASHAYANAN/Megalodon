/**
 * sessionStore.js — IndexedDB-based session persistence for GitAI.
 * 
 * Stores critical app state so it survives page refresh.
 * Auth tokens are handled by httpOnly cookies — NEVER stored here.
 */

const DB_NAME = 'GitAI_Session';
const DB_VERSION = 1;
const STORE_NAME = 'session';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveSession(key, data) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, key);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('Session save failed:', e);
    }
}

export async function loadSession(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Session load failed:', e);
        return null;
    }
}

export async function clearSession(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
    } catch (e) {
        console.warn('Session clear failed:', e);
    }
}
