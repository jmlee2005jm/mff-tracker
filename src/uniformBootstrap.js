import { characterNames } from './characterData';
import { getCharacterEntry } from './mffTrackerUtils';
import {
  UNIFORM_CACHE_VERSION,
  getBaseIconUrlBySlug,
  getUniformIconUrlBySlug,
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
      onProgress(results.length);
    }
  }
}
