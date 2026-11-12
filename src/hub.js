/**
 * Formats a quiz path to guarantee a clean relative quizzes/... link.
 */
function formatQuizHref(path, subject = '', id = '') {
  const sub = String(subject).trim().toLowerCase().replace(/\s+/g, '-');
  const raw = path ? String(path).replace(/^\/+/, '') : `quizzes/${sub}/${id}.html`;
  return raw.startsWith('quizzes/') ? raw : `quizzes/${raw}`;
}

/**
 * Safely renders categorized subject sections into a container element without innerHTML injection.
 * @param {HTMLElement} container
 * @param {Array<{ subject: string, quizzes: Array<{ id: string, title: string, path: string }> }>} catalog
 */
export function renderSubjectHub(container, catalog) {
  if (!container) return;
  container.textContent = '';
  if (!Array.isArray(catalog)) return;

  const doc = container.ownerDocument || globalThis.document;

  for (const group of catalog) {
    if (!group || !group.subject) continue;

    const section = doc.createElement('section');
    section.className = 'subject-section';
    section.setAttribute('data-subject', group.subject);

    const h2 = doc.createElement('h2');
    h2.textContent = group.subject;
    section.appendChild(h2);

    const ul = doc.createElement('ul');
    if (Array.isArray(group.quizzes)) {
      for (const quiz of group.quizzes) {
        if (!quiz || !quiz.id) continue;
        const li = doc.createElement('li');
        const a = doc.createElement('a');
        a.setAttribute('href', formatQuizHref(quiz.path, group.subject, quiz.id));
        a.setAttribute('data-quiz-id', quiz.id);
        a.textContent = quiz.title || quiz.id;
        li.appendChild(a);
        ul.appendChild(li);
      }
    }

    section.appendChild(ul);
    container.appendChild(section);
  }
}

/**
 * Marks cached quizzes with an offline-ready badge and data attribute idempotently.
 * @param {HTMLElement} container
 * @param {string[]|Set<string>} cachedQuizIds
 */
export function decorateOfflineStatus(container, cachedQuizIds) {
  if (!container || typeof container.querySelectorAll !== 'function') return;

  const cachedSet = cachedQuizIds instanceof Set
    ? cachedQuizIds
    : new Set(Array.isArray(cachedQuizIds) ? cachedQuizIds : []);

  const anchors = container.querySelectorAll('[data-quiz-id]');
  const doc = container.ownerDocument || globalThis.document;

  for (const anchor of anchors) {
    const id = anchor.getAttribute('data-quiz-id');
    const isCached = cachedSet.has(id);
    const card = typeof anchor.closest === 'function' ? anchor.closest('[data-quiz-card]') : null;
    const slot = (card && typeof card.querySelector === 'function' && card.querySelector(`[data-badges="${id}"]`)) || anchor;
    const existingBadge = slot.querySelector ? slot.querySelector('.offline-badge') : null;

    if (isCached) {
      anchor.setAttribute('data-offline-ready', 'true');
      if (!existingBadge && doc && typeof doc.createElement === 'function') {
        const badge = doc.createElement('span');
        badge.className = 'offline-badge';
        badge.textContent = 'Offline Ready';
        slot.appendChild(badge);
      }
    } else {
      anchor.removeAttribute('data-offline-ready');
      if (existingBadge && typeof existingBadge.remove === 'function') {
        existingBadge.remove();
      }
    }
  }
}

/**
 * Resolves actually cached quiz IDs from Cache Storage, falling back to storedIds if unavailable.
 * @param {HTMLElement} container
 * @param {string[]} storedIds
 * @param {CacheStorage} [cacheStorage]
 * @returns {Promise<string[]>}
 */
export async function resolveOfflineQuizIds(container, storedIds = [], cacheStorage = globalThis.caches) {
  const fallback = Array.isArray(storedIds) ? storedIds : [];
  if (!container || typeof container.querySelectorAll !== 'function') return fallback;
  if (!cacheStorage || typeof cacheStorage.open !== 'function') return fallback;

  try {
    const cache = await cacheStorage.open('quiz-hub-v1');
    const anchors = container.querySelectorAll('[data-quiz-id]');
    const ready = [];
    for (const anchor of anchors) {
      const id = anchor.getAttribute('data-quiz-id');
      const target = anchor.href || anchor.getAttribute('href');
      if (id && target && await cache.match(target)) {
        ready.push(id);
      }
    }
    return ready;
  } catch {
    return fallback;
  }
}

/**
 * Filters quiz cards by search query and exam track, hiding empty exam columns when filtering.
 * @param {HTMLElement} container
 * @param {string} [query='']
 * @param {string} [examFilter='all']
 * @returns {number} Number of visible quiz cards
 */
export function filterQuizHub(container, query = '', examFilter = 'all') {
  if (!container || typeof container.querySelectorAll !== 'function') return 0;

  const q = String(query || '').trim().toLowerCase();
  const exam = String(examFilter || 'all').toLowerCase();
  const cards = container.querySelectorAll('[data-quiz-card]');
  const visibleByExam = new Map();
  let visibleCount = 0;

  for (const card of cards) {
    const cardExam = (card.getAttribute('data-exam') || '').toLowerCase();
    const haystack = `${card.getAttribute('data-search') || ''} ${card.textContent || ''}`.toLowerCase();
    const matchesExam = exam === 'all' || cardExam === exam;
    const matchesQuery = !q || haystack.includes(q);
    const visible = matchesExam && matchesQuery;

    card.hidden = !visible;
    if (visible) {
      visibleCount++;
      visibleByExam.set(cardExam, (visibleByExam.get(cardExam) || 0) + 1);
    }
  }

  const sections = container.querySelectorAll('section[data-exam]');
  for (const section of sections) {
    const secExam = (section.getAttribute('data-exam') || '').toLowerCase();
    const matchesExam = exam === 'all' || secExam === exam;
    const hasMatches = !q || (visibleByExam.get(secExam) || 0) > 0;
    section.hidden = !(matchesExam && hasMatches);
  }

  return visibleCount;
}

/**
 * Wires a 2-state color-scheme toggle that stores overrides only when diverging from OS preference.
 * @param {HTMLElement} button
 * @param {HTMLMetaElement} metaEl
 * @param {Storage} [storage]
 * @param {Window} [win]
 */
export function initThemeToggle(
  button,
  metaEl,
  storage = globalThis.localStorage,
  win = globalThis.window
) {
  if (!button || !metaEl) return;

  const media = typeof win?.matchMedia === 'function'
    ? win.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const isOsDark = () => Boolean(media?.matches);

  const isEffectiveDark = () => {
    const content = metaEl.getAttribute('content') || 'light dark';
    if (content === 'dark') return true;
    if (content === 'light') return false;
    return isOsDark();
  };

  const sync = () => {
    const dark = isEffectiveDark();
    button.setAttribute('aria-pressed', String(dark));
    const docEl = metaEl.ownerDocument?.documentElement;
    if (docEl) {
      const content = metaEl.getAttribute('content') || 'light dark';
      if (content === 'dark' || content === 'light') {
        docEl.setAttribute('data-theme', content);
      } else {
        docEl.removeAttribute('data-theme');
      }
    }
  };

  sync();

  button.addEventListener('click', () => {
    const target = isEffectiveDark() ? 'light' : 'dark';
    const osScheme = isOsDark() ? 'dark' : 'light';

    if (target === osScheme) {
      try { storage?.removeItem?.('color-scheme'); } catch {}
      metaEl.setAttribute('content', 'light dark');
    } else {
      try { storage?.setItem?.('color-scheme', target); } catch {}
      metaEl.setAttribute('content', target);
    }
    sync();
  });

  media?.addEventListener?.('change', sync);
  win?.addEventListener?.('storage', (e) => {
    if (e.key === 'color-scheme') {
      metaEl.setAttribute('content', e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'light dark');
      sync();
    }
  });
}
