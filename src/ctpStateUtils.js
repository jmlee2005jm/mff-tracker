import { normalizeCtpType } from './mffTrackerUtils';

export const CTP_RARITY_OPTIONS = ['regular', 'mighty', 'brilliant'];

export function normalizeCtpRarity(value) {
  const normalized = String(value || '').normalize('NFKC').trim().toLowerCase();
  if (normalized === 'mighty' || normalized === '강력' || normalized === '2') return 'mighty';
  if (normalized === 'brilliant' || normalized === '찬란' || normalized === '3') return 'brilliant';
  return 'regular';
}

export function cycleCtpRarity(value) {
  const normalized = normalizeCtpRarity(value);
  const index = CTP_RARITY_OPTIONS.indexOf(normalized);
  return CTP_RARITY_OPTIONS[(index + 1) % CTP_RARITY_OPTIONS.length];
}

export function getCtpRarityLabel(rarity, language = 'ko') {
  const normalized = normalizeCtpRarity(rarity);
  if (language === 'en') {
    if (normalized === 'mighty') return 'Mighty';
    if (normalized === 'brilliant') return 'Brilliant';
    return 'Regular';
  }

  if (normalized === 'mighty') return '강력';
  if (normalized === 'brilliant') return '찬란';
  return '일반';
}

export function normalizeCtpSelection(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const type = normalizeCtpType(value.type ?? value.ctp ?? value.value ?? value.name);
    return {
      type,
      rarity: type ? normalizeCtpRarity(value.rarity ?? value.level ?? value.grade ?? value.tier) : 'regular',
    };
  }

  const type = normalizeCtpType(value);
  return {
    type,
    rarity: type ? 'regular' : 'regular',
  };
}
