/**
 * IndexedDB-based storage for layout page images.
 * 
 * localStorage has a ~5-10MB limit which is insufficient for
 * base64-encoded page images. IndexedDB provides much larger
 * storage capacity (typically 50MB+).
 */

import type { LayoutPagePreview } from "@/lib/layout-matching";

interface LayoutPersistenceOptions {
  pdNumber?: string | null;
  projectName?: string | null;
}

const DB_NAME = "wirelist_layout_db";
const DB_VERSION = 1;
const PAGES_STORE = "layout_pages";

function getLayoutStorageKey(projectId?: string | null): string {
  return projectId ? `project:${projectId}` : "unscoped";
}

async function fetchLayoutPagesFromShare(projectId: string): Promise<LayoutPagePreview[] | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/state/layout-pages`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { data?: { pages?: LayoutPagePreview[] } };
    return payload.data?.pages ?? [];
  } catch {
    // Network errors, JSON parse failures, etc. – caller falls back to IndexedDB
    return null;
  }
}

async function persistLayoutPagesToShare(
  pages: LayoutPagePreview[],
  projectId: string,
  options?: LayoutPersistenceOptions,
): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/state/layout-pages`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdNumber: options?.pdNumber ?? null,
      projectName: options?.projectName ?? null,
      pages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail.trim() || `Failed to persist layout pages to Share state (${response.status})`,
    );
  }
}

/**
 * Open the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(PAGES_STORE)) {
        db.createObjectStore(PAGES_STORE, { keyPath: "id" });
      }
    };
  });
}

/**
 * Save layout pages to IndexedDB.
 */
async function saveLayoutPagesToIndexedDb(pages: LayoutPagePreview[], projectId?: string | null): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PAGES_STORE, "readwrite");
    const store = transaction.objectStore(PAGES_STORE);
    const storageKey = getLayoutStorageKey(projectId);

    await new Promise<void>((resolve, reject) => {
      const putRequest = store.put({ id: storageKey, pages });
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    db.close();
  } catch (err) {
    console.error("Failed to save layout pages to IndexedDB:", err);
    throw err;
  }
}

export async function saveLayoutPages(
  pages: LayoutPagePreview[],
  projectId?: string | null,
  options?: LayoutPersistenceOptions,
): Promise<void> {
  await saveLayoutPagesToIndexedDb(pages, projectId);

  if (!projectId) {
    return;
  }

  await persistLayoutPagesToShare(pages, projectId, options);
}

/**
 * Load layout pages from IndexedDB.
 */
async function loadLayoutPagesFromIndexedDb(projectId?: string | null): Promise<LayoutPagePreview[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PAGES_STORE, "readonly");
    const store = transaction.objectStore(PAGES_STORE);
    const storageKey = getLayoutStorageKey(projectId);

    const result = await new Promise<{ id: string; pages: LayoutPagePreview[] } | undefined>((resolve, reject) => {
      const getRequest = store.get(storageKey);
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    });

    db.close();
    return result?.pages ?? [];
  } catch (err) {
    console.error("Failed to load layout pages from IndexedDB:", err);
    return [];
  }
}

export async function loadLayoutPages(projectId?: string | null): Promise<LayoutPagePreview[]> {
  if (projectId) {
    const sharedPages = await fetchLayoutPagesFromShare(projectId);
    if (sharedPages) {
      await saveLayoutPagesToIndexedDb(sharedPages, projectId);
      return sharedPages;
    }
  }

  return loadLayoutPagesFromIndexedDb(projectId);
}

/**
 * Clear all layout data from IndexedDB.
 */
export async function clearLayoutStorage(projectId?: string | null): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([PAGES_STORE], "readwrite");

    if (projectId === undefined) {
      await new Promise<void>((resolve, reject) => {
        const req = transaction.objectStore(PAGES_STORE).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const storageKey = getLayoutStorageKey(projectId);
      await new Promise<void>((resolve, reject) => {
        const req = transaction.objectStore(PAGES_STORE).delete(storageKey);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    db.close();
  } catch (err) {
    console.error("Failed to clear layout storage:", err);
  }
}
