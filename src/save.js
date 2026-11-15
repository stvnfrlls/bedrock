const DB = 'bedrock-station';
const STORE = 'campaign';
const SLOT = 'active';
let connection;
let queue = Promise.resolve();

function database() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Save database is blocked by another tab.'));
  }).catch(error => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function loadCampaign() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(SLOT);
    request.onsuccess = () => {
      const save = request.result;
      if (save && (save.version !== 1 || !save.state?.tiles || !Number.isFinite(save.savedAt))) {
        reject(new Error('This save format could not be loaded.'));
      } else {
        resolve(save);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export function saveCampaign(state, savedAt = Date.now()) {
  const snapshot = { version: 1, savedAt, state: structuredClone(state) };
  const write = queue.catch(() => {}).then(async () => {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(snapshot, SLOT);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error ?? new Error('Save aborted.'));
    });
  });
  queue = write;
  return write;
}

