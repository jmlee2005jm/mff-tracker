import { characterData } from './characterData';

export const CATEGORY_OPTIONS = ['유니폼 필요', '성장 필요', '획득 필요'];

export const ORIGIN_TYPE_OPTIONS = ['전체', '일반캐', '태생캐 (2티)', '태생캐 (2티, 더블)', '태생캐 (3티)'];
export const ACQUISITION_TYPE_OPTIONS = ['전체', '수정캐', '디럭스', '엑조디아', '매생/매엑'];
export const UPGRADE_LEVEL_OPTIONS = ['전체', '4티', '3티', '각초', '2티'];
export const USAGE_TYPE_OPTIONS = ['전체', 'PVE', 'PVP', 'PVE/PVP', '없음'];
export const CTP_TYPE_OPTIONS = [
  '통찰',
  '극복',
  '탐욕',
  '해방',
  '분노',
  '경쟁',
  '파괴',
  '제련',
  '권능',
  '심판',
  '재생',
  '역전',
  '격동',
  '인내',
  '초월',
];
export const CTP_TYPE_DISPLAY_NAMES = {
  통찰: '통찰 / Insight',
  극복: '극복 / Conquest',
  탐욕: '탐욕 / Greed',
  해방: '해방 / Liberation',
  분노: '분노 / Rage',
  경쟁: '경쟁 / Competition',
  파괴: '파괴 / Destruction',
  제련: '제련 / Refinement',
  권능: '권능 / Authority',
  심판: '심판 / Judgement',
  재생: '재생 / Regeneration',
  역전: '역전 / Veteran',
  격동: '격동 / Energy',
  인내: '인내 / Patience',
  초월: '초월 / Transcendence',
};

const CTP_TYPE_ALIASES = {
  insight: '통찰',
  conquest: '극복',
  greed: '탐욕',
  liberation: '해방',
  rage: '분노',
  competition: '경쟁',
  destruction: '파괴',
  refinement: '제련',
  authority: '권능',
  judgement: '심판',
  judgment: '심판',
  regeneration: '재생',
  veteran: '역전',
  energy: '격동',
  patience: '인내',
  transcendence: '초월',
};

export const DETAIL_OPTIONS = {
  '유니폼 필요': ['일반', '한정'],
  '성장 필요': ['1티→2티', '2티→3티', '2티→각초', '3티→4티', '각초→4티'],
};

function isUsageSelection(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && ('PVE' in value || 'PVP' in value);
}

export function normalizeName(name) {
  return String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_./·,()[\]{}'’`\\]/g, '');
}

export function normalizeUsageType(value) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (normalized === 'PVE' || normalized === 'PVP') {
    return normalized;
  }

  if (normalized === 'PVE/PVP' || normalized === 'BOTH' || normalized === 'ALL') {
    return 'PVE/PVP';
  }

  return '';
}

export function normalizeCtpType(value) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim();

  if (CTP_TYPE_OPTIONS.includes(normalized)) return normalized;

  const asciiNormalized = normalized.toLowerCase().replace(/[\s\-_./·,()[\]{}'’`\\]/g, '');
  return CTP_TYPE_ALIASES[asciiNormalized] || '';
}

export function normalizePriority(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3) {
    return value;
  }

  const normalized = String(value || '')
    .normalize('NFKC')
    .trim();

  if (normalized === '' || normalized === '0' || normalized === '!' || normalized === '1') return 1;
  if (normalized === '!!' || normalized === '2') return 2;
  if (normalized === '!!!' || normalized === '3') return 3;

  return 1;
}

export function getPriorityLabel(priority) {
  const normalized = normalizePriority(priority);
  return '!'.repeat(normalized);
}

export function cyclePriority(priority) {
  const normalized = normalizePriority(priority);
  return normalized === 3 ? 1 : normalized + 1;
}

export function normalizeUsageSelection(value = {}) {
  return {
    PVE: !!value?.PVE,
    PVP: !!value?.PVP,
  };
}

export function getUsageTypeFromSelection(selection) {
  const normalized = normalizeUsageSelection(selection);

  if (normalized.PVE && normalized.PVP) return 'PVE/PVP';
  if (normalized.PVE) return 'PVE';
  if (normalized.PVP) return 'PVP';
  return '';
}

export function getUsageSelectionLabel(selection) {
  const usageType = getUsageTypeFromSelection(selection);
  if (!usageType) return 'None';
  if (usageType === 'PVE/PVP') return 'All';
  if (usageType === 'PVE') return 'PVE only';
  if (usageType === 'PVP') return 'PVP only';
  return usageType;
}

function splitNameParts(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[()[\]{}]/g, ' ')
    .split(/[\s\-_./·,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getNameAliases(name, entry) {
  const aliases = new Set();
  const normalized = normalizeName(name);

  if (normalized) {
    aliases.add(normalized);
  }

  const slugAlias = normalizeName(entry?.slug);
  if (slugAlias) {
    aliases.add(slugAlias);
  }

  const parts = splitNameParts(name);
  if (parts.length >= 2) {
    aliases.add(parts.map((part) => part[0]).join('').toLowerCase());
  }

  return Array.from(aliases);
}

const CHARACTER_LOOKUP = new Map();
const CHARACTER_SEARCH_TERMS = new Map();
const CHARACTER_DISPLAY_NAMES = new Map();

for (const [name, entry] of Object.entries(characterData)) {
  CHARACTER_DISPLAY_NAMES.set(entry, name);

  for (const alias of getNameAliases(name, entry)) {
    if (!CHARACTER_LOOKUP.has(alias)) {
      CHARACTER_LOOKUP.set(alias, entry);
    }

    const existing = CHARACTER_SEARCH_TERMS.get(entry);
    if (existing) {
      existing.add(alias);
    } else {
      CHARACTER_SEARCH_TERMS.set(entry, new Set([alias]));
    }
  }
}

export function getCharacterEntry(name) {
  const normalized = normalizeName(name);
  return CHARACTER_LOOKUP.get(normalized) || null;
}

export function getCharacterDisplayName(name) {
  const entry = getCharacterEntry(name);
  if (!entry) return name;

  return CHARACTER_DISPLAY_NAMES.get(entry) || name;
}

export function characterMatchesQuery(name, query) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return true;

  const entry = getCharacterEntry(name);
  if (!entry) return false;

  const searchTerms = CHARACTER_SEARCH_TERMS.get(entry) || new Set([normalizeName(name)]);
  return Array.from(searchTerms).some((term) => term.includes(normalizedQuery));
}

export function getNextId(rows) {
  return rows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
}

function getSortRank(list, value) {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

function getCharacterSortMeta(name) {
  const entry = getCharacterEntry(name);
  return {
    origin: entry?.originType || '',
    acquisition: entry?.acquisitionType || '',
    upgrade: entry?.upgradeLevel || '',
    baseUpgrade: entry?.baseUpgradeLevel || '',
  };
}

function getLatestRowId(items) {
  return items.reduce((maxId, row) => Math.max(maxId, row.id || 0), 0);
}

function getGroupPriority(items) {
  return items.reduce((maxPriority, row) => Math.max(maxPriority, normalizePriority(row.priority)), 0);
}

export function filterRows(rows, nameQuery, metadataFilters, usageSelectionOrCategoryFilter, categoryFilterOrShowDone, maybeShowDone) {
  const normalizedNameQuery = normalizeName(nameQuery);
  const originFilter = metadataFilters?.originType || '전체';
  const acquisitionFilter = metadataFilters?.acquisitionType || '전체';
  const upgradeFilter = metadataFilters?.upgradeLevel || '전체';
  const legacyUsageFilter = metadataFilters?.usageType || '전체';
  const usageSelection = isUsageSelection(usageSelectionOrCategoryFilter)
    ? normalizeUsageSelection(usageSelectionOrCategoryFilter)
    : null;
  const categoryFilter = isUsageSelection(usageSelectionOrCategoryFilter)
    ? categoryFilterOrShowDone || '전체'
    : usageSelectionOrCategoryFilter || '전체';
  const showDone = isUsageSelection(usageSelectionOrCategoryFilter)
    ? !!maybeShowDone
    : !!categoryFilterOrShowDone;

  return rows.filter((row) => {
    const entry = getCharacterEntry(row.character);
    const matchesNameQuery =
      normalizedNameQuery === '' ||
      characterMatchesQuery(row.character, normalizedNameQuery);
    const rowUsageType = normalizeUsageType(row.usageType) || '';
    const matchesUsageFilter = usageSelection
      ? (!usageSelection.PVE && !usageSelection.PVP && !rowUsageType) ||
        (usageSelection.PVE && (rowUsageType === 'PVE' || rowUsageType === 'PVE/PVP')) ||
        (usageSelection.PVP && (rowUsageType === 'PVP' || rowUsageType === 'PVE/PVP')) ||
        (usageSelection.PVE && usageSelection.PVP && !rowUsageType)
      : legacyUsageFilter === '전체' ||
        (legacyUsageFilter === '없음' && !rowUsageType) ||
        (legacyUsageFilter === 'PVE' && (rowUsageType === 'PVE' || rowUsageType === 'PVE/PVP')) ||
        (legacyUsageFilter === 'PVP' && (rowUsageType === 'PVP' || rowUsageType === 'PVE/PVP')) ||
        (legacyUsageFilter === 'PVE/PVP' && rowUsageType === 'PVE/PVP');

    const matchesMetadataQuery =
      (originFilter === '전체' || entry?.originType === originFilter) &&
      (acquisitionFilter === '전체' || entry?.acquisitionType === acquisitionFilter) &&
      (upgradeFilter === '전체' || entry?.upgradeLevel === upgradeFilter) &&
      matchesUsageFilter;

    const matchesCategory = categoryFilter === '전체' || row.category === categoryFilter;
    const matchesDone = showDone || !row.done;

    return matchesNameQuery && matchesMetadataQuery && matchesCategory && matchesDone;
  });
}

export function groupRowsByCharacter(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.character)) map.set(row.character, []);
    map.get(row.character).push(row);
  }

  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
}

export function sortCharacterGroups(groups, sortBy, sortDirection = 'desc') {
  const sorted = [...groups];
  const direction = sortDirection === 'asc' ? 1 : -1;

  sorted.sort(([aChar, aItems], [bChar, bItems]) => {
    const aMeta = getCharacterSortMeta(aChar);
    const bMeta = getCharacterSortMeta(bChar);
    let result = 0;

    switch (sortBy) {
      case 'name': {
        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'origin': {
        const originOrder = ['일반캐', '태생캐 (2티)', '태생캐 (2티, 더블)', '태생캐 (3티)'];
        const acquisitionOrder = ['엑조디아', '디럭스', '수정캐', '매생/매엑'];
        const upgradeOrder = ['4티', '3티', '각초', '2티'];

        const originDiff =
          getSortRank(originOrder, aMeta.origin) - getSortRank(originOrder, bMeta.origin);
        if (originDiff !== 0) {
          result = originDiff;
          break;
        }

        const upgradeDiff =
          getSortRank(upgradeOrder, aMeta.upgrade) - getSortRank(upgradeOrder, bMeta.upgrade);
        if (upgradeDiff !== 0) {
          result = upgradeDiff;
          break;
        }

        const acquisitionDiff =
          getSortRank(acquisitionOrder, aMeta.acquisition) - getSortRank(acquisitionOrder, bMeta.acquisition);
        if (acquisitionDiff !== 0) {
          result = acquisitionDiff;
          break;
        }

        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'acquisition': {
        const acquisitionOrder = ['엑조디아', '디럭스', '수정캐', '매생/매엑', ''];
        const acquisitionDiff =
          getSortRank(acquisitionOrder, aMeta.acquisition) - getSortRank(acquisitionOrder, bMeta.acquisition);
        if (acquisitionDiff !== 0) {
          result = acquisitionDiff;
          break;
        }

        const originOrder = ['일반캐', '태생캐 (2티)', '태생캐 (2티, 더블)', '태생캐 (3티)'];
        const originDiff =
          getSortRank(originOrder, aMeta.origin) - getSortRank(originOrder, bMeta.origin);
        if (originDiff !== 0) {
          result = originDiff;
          break;
        }

        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'tier': {
        const tierOrder = ['4티', '3티', '각초', '2티', ''];
        const aTier = aMeta.upgrade || aMeta.baseUpgrade || '';
        const bTier = bMeta.upgrade || bMeta.baseUpgrade || '';
        const tierDiff = getSortRank(tierOrder, aTier) - getSortRank(tierOrder, bTier);
        if (tierDiff !== 0) {
          result = tierDiff;
          break;
        }

        const acquisitionOrder = ['엑조디아', '디럭스', '수정캐', '매생/매엑'];
        const acquisitionDiff =
          getSortRank(acquisitionOrder, aMeta.acquisition) - getSortRank(acquisitionOrder, bMeta.acquisition);
        if (acquisitionDiff !== 0) {
          result = acquisitionDiff;
          break;
        }

        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'completion': {
        const aDone = aItems.filter(item => item.done).length / aItems.length;
        const bDone = bItems.filter(item => item.done).length / bItems.length;
        if (aDone !== bDone) {
          result = bDone - aDone; // higher completion first
          break;
        }
        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'tasks': {
        if (aItems.length !== bItems.length) {
          result = bItems.length - aItems.length; // more tasks first
          break;
        }
        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'priority': {
        const priorityDiff = getGroupPriority(bItems) - getGroupPriority(aItems);
        if (priorityDiff !== 0) {
          result = priorityDiff;
          break;
        }

        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      case 'lastAdded': {
        const latestDiff = getLatestRowId(bItems) - getLatestRowId(aItems);
        if (latestDiff !== 0) {
          result = latestDiff;
          break;
        }
        result = aChar.localeCompare(bChar, 'ko');
        break;
      }
      default: {
        result = aChar.localeCompare(bChar, 'ko');
      }
    }

    return direction * result;
  });

  return sorted;
}

export function groupRowsByCategory(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = `${row.category}__${row.detail}`;
    if (!map.has(key)) {
      map.set(key, { category: row.category, detail: row.detail, items: [] });
    }
    map.get(key).items.push(row);
  }

  const categoryOrder = ['획득 필요', '성장 필요', '유니폼 필요'];

  return Array.from(map.values()).sort((a, b) => {
    const byCategory = getSortRank(categoryOrder, a.category) - getSortRank(categoryOrder, b.category);
    return byCategory !== 0 ? byCategory : a.detail.localeCompare(b.detail, 'ko');
  });
}

export function runSanityTests() {
  const sample = [
    { id: 1, character: 'A', category: '유니폼 필요', detail: '일반', done: false, usageType: 'PVE', priority: 1 },
    { id: 2, character: 'A', category: '성장 필요', detail: '1티→2티', done: true, usageType: 'PVP', priority: 2 },
    { id: 3, character: 'B', category: '획득 필요', detail: '4티', done: false, usageType: 'PVE/PVP', priority: 3 },
    { id: 4, character: 'C', category: '유니폼 필요', detail: '한정', done: false, usageType: '', priority: 0 },
  ];

  const prioritySample = [
    { id: 1, character: 'A', category: '유니폼 필요', detail: '일반', done: false, usageType: '', priority: 1 },
    { id: 2, character: 'B', category: '유니폼 필요', detail: '일반', done: false, usageType: '', priority: 3 },
  ];

  const tests = [
    {
      name: 'getNextId returns max id + 1',
      pass: getNextId(sample) === 4,
    },
    {
      name: 'filterRows hides done entries when showDone is false',
      pass: filterRows(sample, '', { originType: '전체', acquisitionType: '전체', upgradeLevel: '전체' }, normalizeUsageSelection(), '전체', false).length === 2,
    },
    {
      name: 'filterRows respects usage selection',
      pass: filterRows(sample, '', { originType: '전체', acquisitionType: '전체', upgradeLevel: '전체' }, { PVE: true, PVP: false }, '전체', true).length === 2,
    },
    {
      name: 'filterRows with no usage selection shows only untagged rows',
      pass: filterRows(sample, '', { originType: '전체', acquisitionType: '전체', upgradeLevel: '전체' }, { PVE: false, PVP: false }, '전체', true).length === 1,
    },
    {
      name: 'filterRows with both usage selections includes untagged rows',
      pass: filterRows(sample, '', { originType: '전체', acquisitionType: '전체', upgradeLevel: '전체' }, { PVE: true, PVP: true }, '전체', true).length === 3,
    },
    {
      name: 'groupRowsByCharacter groups duplicate character entries together',
      pass: groupRowsByCharacter(sample)[0][1].length === 2,
    },
    {
      name: 'groupRowsByCategory creates separate category-detail groups',
      pass: groupRowsByCategory(sample).length === 3,
    },
    {
      name: 'groupRowsByCategory orders categories by acquisition then growth then uniform',
      pass: groupRowsByCategory(sample).map((group) => group.category).join(',') === '획득 필요,성장 필요,유니폼 필요',
    },
    {
      name: 'priority normalization accepts exclamation marks',
      pass: normalizePriority('!!!') === 3,
    },
    {
      name: 'sortCharacterGroups orders higher priority first',
      pass: sortCharacterGroups(groupRowsByCharacter(prioritySample), 'priority')[0][0] === 'B',
    },
  ];

  return tests;
}
