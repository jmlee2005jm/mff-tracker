export const UNIFORM_CACHE_VERSION = 'v5';
const IMAGE_LOAD_CACHE_KEY = 'mff_loaded_image_cache_v1';
const IMAGE_LOAD_CACHE = new Map();
const PERSISTENT_IMAGE_LOAD_CACHE = new Set();
let persistentImageCacheLoaded = false;

function loadPersistentImageLoadCache() {
  if (persistentImageCacheLoaded) return;
  persistentImageCacheLoaded = true;

  try {
    const saved = window.localStorage.getItem(IMAGE_LOAD_CACHE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return;

    for (const src of parsed) {
      if (typeof src === 'string' && src) {
        PERSISTENT_IMAGE_LOAD_CACHE.add(src);
      }
    }
  } catch {
    // ignore cache load errors
  }
}

function savePersistentImageLoadCache() {
  try {
    window.localStorage.setItem(
      IMAGE_LOAD_CACHE_KEY,
      JSON.stringify(Array.from(PERSISTENT_IMAGE_LOAD_CACHE))
    );
  } catch {
    // ignore cache write errors
  }
}

export function getBaseIconUrlBySlug(slug) {
  return `https://thanosvibs.money/static/assets/portraits_128/${slug}.png`;
}

export function getUniformIconUrlBySlug(slug, number) {
  return `https://thanosvibs.money/static/assets/portraits_128/${slug}${number}.png`;
}

export function getUniformOptionsCacheKey(slug) {
  return `mff_character_uniform_options_${slug}_${UNIFORM_CACHE_VERSION}`;
}

export function preloadImage(src) {
  if (!src) return;

  loadImageCached(src).catch(() => {
    // ignore preload errors
  });
}

export function loadImageCached(src) {
  if (!src) {
    return Promise.resolve(null);
  }

  loadPersistentImageLoadCache();

  if (PERSISTENT_IMAGE_LOAD_CACHE.has(src)) {
    return Promise.resolve(src);
  }

  if (IMAGE_LOAD_CACHE.has(src)) {
    return IMAGE_LOAD_CACHE.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(src);
    img.onerror = () => {
      IMAGE_LOAD_CACHE.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });

  IMAGE_LOAD_CACHE.set(src, promise);
  promise
    .then((resolvedSrc) => {
      PERSISTENT_IMAGE_LOAD_CACHE.add(resolvedSrc);
      savePersistentImageLoadCache();
      return resolvedSrc;
    })
    .catch(() => {
      // ignore cache write errors
    });
  return promise;
}

export function imageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      resolve(false);
    }, 1200);

    const finish = (result) => {
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = src;
  });
}

export async function findAvailableUniformNumbers(slug, maxToCheck = 50) {
  const checks = Array.from({ length: maxToCheck }, (_, index) => index + 1).map(async (number) => ({
    number,
    exists: await imageExists(getUniformIconUrlBySlug(slug, number)),
  }));

  const results = await Promise.all(checks);
  return results.filter((result) => result.exists).map((result) => result.number);
}

export async function findLatestUniformNumber(slug, maxToCheck = 50) {
  const numbers = await findAvailableUniformNumbers(slug, maxToCheck);
  return numbers.length > 0 ? numbers[numbers.length - 1] : 0;
}

export async function warmUniformNumbersCache(slug, maxToCheck = 50) {
  const cacheKey = getUniformOptionsCacheKey(slug);

  try {
    const saved = window.localStorage.getItem(cacheKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(
          new Set(parsed.filter((value) => Number.isInteger(value) && value > 0))
        ).sort((a, b) => a - b);
      }
    }
  } catch {
    // ignore cache read errors
  }

  const numbers = Array.from(
    new Set(
      (await findAvailableUniformNumbers(slug, maxToCheck)).filter(
        (value) => Number.isInteger(value) && value > 0
      )
    )
  ).sort((a, b) => a - b);

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(numbers));
  } catch {
    // ignore cache write errors
  }

  return numbers;
}

export function clearUniformNumbersCache(slug) {
  try {
    window.localStorage.removeItem(getUniformOptionsCacheKey(slug));
  } catch {
    // ignore cache errors
  }
}

export function clearLoadedImageCache() {
  IMAGE_LOAD_CACHE.clear();
  PERSISTENT_IMAGE_LOAD_CACHE.clear();

  try {
    window.localStorage.removeItem(IMAGE_LOAD_CACHE_KEY);
  } catch {
    // ignore cache errors
  }
}

export async function refreshUniformNumbersCache(slug, maxToCheck = 50) {
  const numbers = Array.from(
    new Set(
      (await findAvailableUniformNumbers(slug, maxToCheck)).filter(
        (value) => Number.isInteger(value) && value > 0
      )
    )
  ).sort((a, b) => a - b);

  try {
    window.localStorage.setItem(getUniformOptionsCacheKey(slug), JSON.stringify(numbers));
  } catch {
    // ignore cache write errors
  }

  return numbers;
}
