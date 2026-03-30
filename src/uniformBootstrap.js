import { characterNames } from './characterData';
import { getCharacterEntry } from './mffTrackerUtils';
import {
  STATIC_ICON_URLS,
  DEFAULT_ARTIFACT_PREVIEW_ICON,
  getArtifactIconUrlBySlug,
} from './iconAssets';
import {
  UNIFORM_CACHE_VERSION,
  getBaseIconUrlBySlug,
  getUniformIconUrlBySlug,
  clearUniformNumbersCache,
  preloadImage,
  warmUniformNumbersCache,
} from './iconUtils';

export const UNIFORM_BOOTSTRAP_KEY = `mff_tracker_uniform_bootstrap_${UNIFORM_CACHE_VERSION}`;

function getUniqueCharacterSlugs() {
  return Array.from(
    new Set(
      characterNames
        .map((name) => getCharacterEntry(name)?.slug || '')
        .filter(Boolean)
    )
  );
}

export async function bootstrapUniformAssets(onProgress) {
  const slugs = getUniqueCharacterSlugs();
  const total = STATIC_ICON_URLS.length + slugs.length;
  let loaded = 0;

  for (const iconUrl of STATIC_ICON_URLS) {
    preloadImage(iconUrl);
    loaded += 1;
    if (typeof onProgress === 'function') {
      onProgress(loaded, total);
    }
  }

  for (let index = 0; index < slugs.length; index += 4) {
    const batch = slugs.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (slug) => {
        const numbers = await warmUniformNumbersCache(slug, 50);
        const latest = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
        const iconUrl = latest > 0 ? getUniformIconUrlBySlug(slug, latest) : getBaseIconUrlBySlug(slug);
        preloadImage(iconUrl);
        return slug;
      })
    );

    if (typeof onProgress === 'function') {
      loaded += results.length;
      onProgress(loaded, total);
    }
  }

  // Artifact assets load after the portrait cache and do not affect progress UI.
  window.setTimeout(() => {
    preloadImage(DEFAULT_ARTIFACT_PREVIEW_ICON);
    for (const slug of slugs) {
      preloadImage(getArtifactIconUrlBySlug(slug));
    }
  }, 0);

  if (typeof onProgress === 'function' && total === 0) {
    onProgress(0, 0);
  }
}

export function resetUniformBootstrapCache() {
  try {
    window.localStorage.removeItem(UNIFORM_BOOTSTRAP_KEY);
  } catch {
    // ignore storage errors
  }

  for (const slug of getUniqueCharacterSlugs()) {
    clearUniformNumbersCache(slug);
  }
}
