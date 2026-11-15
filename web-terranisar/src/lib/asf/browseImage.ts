/**
 * Caché de quicklooks: cada PNG de browse se descarga una sola vez por
 * sesión, para que la reproducción (time-lapse) sea fluida.
 */

const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadBrowseImage(url: string): Promise<HTMLImageElement> {
  let entry = cache.get(url);
  if (!entry) {
    entry = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        cache.delete(url);
        reject(new Error("No se pudo cargar el quicklook"));
      };
      img.src = url;
    });
    cache.set(url, entry);
  }
  return entry;
}

const PRELOAD_CONCURRENCY = 6;

/**
 * Precarga concurrente (6 en paralelo): llena la caché mucho más rápido
 * que en cola, para que el time-lapse arranque con todas las imágenes ya
 * disponibles y las transiciones sean instantáneas.
 */
export async function preloadBrowseImages(
  urls: string[],
  shouldContinue: () => boolean,
): Promise<void> {
  const queue = [...urls];
  const workers = Array.from(
    { length: Math.min(PRELOAD_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        if (!shouldContinue()) return;
        const url = queue.shift()!;
        try {
          await loadBrowseImage(url);
        } catch {
          // Si falla una imagen, la reproducción sigue con las demás
        }
      }
    },
  );
  await Promise.all(workers);
}
