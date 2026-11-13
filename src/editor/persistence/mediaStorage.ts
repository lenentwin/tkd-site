const DB_NAME = "mft39-media-v1";
const STORE = "images";
export const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(
            "Браузер не разрешил открыть локальное хранилище изображений.",
          ),
        );
      request.onblocked = () =>
        reject(
          new Error("Закройте другие вкладки редактора и повторите загрузку."),
        );
    }).catch((error: unknown) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

export async function putMedia(key: string, blob: Blob): Promise<void> {
  if (
    !MEDIA_TYPES.includes(blob.type) ||
    blob.size > MAX_MEDIA_BYTES ||
    blob.size === 0
  )
    throw new Error("Выберите JPG, PNG, WebP или AVIF размером до 8 МБ.");
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        new Error(
          "Не удалось сохранить изображение: хранилище заполнено или недоступно.",
        ),
      );
  });
}

export async function getMedia(key: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : undefined);
    request.onerror = () =>
      reject(new Error("Изображение недоступно в этом браузере."));
  });
}

export async function storeMediaFile(file: File): Promise<string> {
  const key = crypto.randomUUID();
  await putMedia(key, file);
  return `idb:${key}`;
}

// Unreferenced blobs are retained so undo/reset cannot destroy a user's image.
// Portable export includes only blobs referenced by the current configuration.
