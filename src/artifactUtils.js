export const CHARACTER_ARTIFACT_OVERRIDES_KEY = 'mff_character_artifact_overrides_v2';
const LEGACY_CHARACTER_ARTIFACT_OVERRIDES_KEY = 'mff_character_artifact_overrides_v1';
export const CHARACTER_ARTIFACT_CHANGE_EVENT = 'mff:character-artifact-change';

export function normalizeArtifactEnabled(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? 1 : 0;
}

export function normalizeArtifactStarLevel(value, enabled = false) {
  const normalized = Number(value);
  if (!enabled) {
    return 0;
  }

  if (Number.isInteger(normalized) && normalized >= 3 && normalized <= 6) {
    return normalized;
  }

  return 3;
}

export function normalizeArtifactState(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const enabled = normalizeArtifactEnabled(
      value.enabled ?? value.selected ?? value.hasArtifact ?? value.artifact
    );
    return {
      enabled,
      star: normalizeArtifactStarLevel(
        value.star ?? value.level ?? value.artifactLevel ?? 0,
        enabled
      ),
    };
  }

  const enabled = normalizeArtifactEnabled(value);
  return {
    enabled,
    star: normalizeArtifactStarLevel(0, enabled),
  };
}

export function createDefaultArtifactState() {
  return { enabled: 0, star: 0 };
}

export function loadCharacterArtifactOverrides() {
  try {
    const saved =
      window.localStorage.getItem(CHARACTER_ARTIFACT_OVERRIDES_KEY) ??
      window.localStorage.getItem(LEGACY_CHARACTER_ARTIFACT_OVERRIDES_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, normalizeArtifactState(value)])
    );
  } catch {
    return {};
  }
}
