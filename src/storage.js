const PREFIX = 'quiz_hub_progress_';

function getStorage() {
  return globalThis.window?.localStorage ?? globalThis.localStorage;
}

export function saveQuizProgress(quizId, state) {
  if (typeof quizId !== 'string' || !quizId) return false;
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(`${PREFIX}${quizId}`, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getQuizProgress(quizId) {
  if (typeof quizId !== 'string' || !quizId) return null;
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(`${PREFIX}${quizId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAllCachedQuizIds() {
  try {
    const storage = getStorage();
    if (!storage) return [];
    const ids = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX) && key.length > PREFIX.length) {
        ids.push(key.slice(PREFIX.length));
      }
    }
    return ids;
  } catch {
    return [];
  }
}
