export function getBaseIconUrlBySlug(slug) {
  return `https://thanosvibs.money/static/assets/portraits_128/${slug}.png`;
}

export function getUniformIconUrlBySlug(slug, number) {
  return `https://thanosvibs.money/static/assets/portraits_128/${slug}${number}.png`;
}

export function preloadImage(src) {
  if (!src) return;

  const img = new Image();
  img.decoding = 'async';
  img.src = src;
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
  const cacheKey = `mff_character_uniform_options_${slug}_v1`;

  try {
    const saved = window.localStorage.getItem(cacheKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((value) => Number.isInteger(value) && value > 0);
      }
    }
  } catch {
    // ignore cache read errors
  }

  const numbers = await findAvailableUniformNumbers(slug, maxToCheck);

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(numbers));
  } catch {
    // ignore cache write errors
  }

  return numbers;
}
