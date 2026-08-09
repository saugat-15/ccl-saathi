/**
 * Local practice-session drafts (IndexedDB).
 * Survives full page reload until submit / try-again clears them.
 */

const DB_NAME = "ccl-sathi-practice-drafts";
const DB_VERSION = 1;
const STORE = "dialogues";

export type PracticeDraftSegment = {
  segmentIndex: number;
  mimeType: string;
  blob: Blob;
};

export type PracticeDraft = {
  /** `${userId}::${dialogueId}` */
  id: string;
  userId: string;
  dialogueId: string;
  updatedAt: number;
  segments: PracticeDraftSegment[];
};

function draftId(userId: string, dialogueId: string): string {
  return `${userId}::${dialogueId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function loadPracticeDraft(
  userId: string,
  dialogueId: string,
): Promise<PracticeDraft | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const result = await idbReq(
        tx.objectStore(STORE).get(draftId(userId, dialogueId)),
      );
      return (result as PracticeDraft | undefined) ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function savePracticeDraftSegment(
  userId: string,
  dialogueId: string,
  segmentIndex: number,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const db = await openDb();
  try {
    const id = draftId(userId, dialogueId);
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = ((await idbReq(store.get(id))) as PracticeDraft | undefined) ?? null;
    const segments = (existing?.segments ?? []).filter(
      (s) => s.segmentIndex !== segmentIndex,
    );
    segments.push({ segmentIndex, mimeType, blob });
    segments.sort((a, b) => a.segmentIndex - b.segmentIndex);

    const draft: PracticeDraft = {
      id,
      userId,
      dialogueId,
      updatedAt: Date.now(),
      segments,
    };
    store.put(draft);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
    });
  } finally {
    db.close();
  }
}

export async function deletePracticeDraftSegment(
  userId: string,
  dialogueId: string,
  segmentIndex: number,
): Promise<void> {
  const db = await openDb();
  try {
    const id = draftId(userId, dialogueId);
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = ((await idbReq(store.get(id))) as PracticeDraft | undefined) ?? null;
    if (!existing) return;

    const segments = existing.segments.filter((s) => s.segmentIndex !== segmentIndex);
    if (segments.length === 0) {
      store.delete(id);
    } else {
      store.put({ ...existing, segments, updatedAt: Date.now() });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
    });
  } finally {
    db.close();
  }
}

export async function clearPracticeDraft(
  userId: string,
  dialogueId: string,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(draftId(userId, dialogueId));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB delete aborted"));
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore — draft clear is best-effort */
  }
}
