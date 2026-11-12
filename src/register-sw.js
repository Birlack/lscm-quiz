export async function registerServiceWorker(swUrl = './sw.js') {
  if (typeof globalThis.navigator?.serviceWorker?.register !== 'function') {
    return null;
  }
  try {
    return await globalThis.navigator.serviceWorker.register(swUrl);
  } catch {
    return null;
  }
}
