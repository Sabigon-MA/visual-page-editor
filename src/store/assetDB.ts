// 埋め込んだ画像の自動保存。画像は大きく localStorage に入りきらないので IndexedDB に置く。
const DB = 'vpe';
const STORE = 'assets';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAssets(): Promise<Record<string, string>> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Record<string, string> | undefined) ?? {});
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

export async function saveAssets(assets: Record<string, string>): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(assets, KEY);
  } catch {
    // 使えない環境では保存しない
  }
}
