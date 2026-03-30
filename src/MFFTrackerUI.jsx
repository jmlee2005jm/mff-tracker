import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CharacterIcon, CharacterOriginBadge, CharacterAcquisitionBadge, CharacterUpgradeBadges, CharacterUsageBadge, PriorityBadge, CTP_ICON_BY_TYPE } from './CharacterComponents';
import CtpPicker from './CtpPicker';
import { getBaseIconUrlBySlug, getUniformIconUrlBySlug } from './iconUtils';
import {
  CATEGORY_OPTIONS,
  ORIGIN_TYPE_OPTIONS,
  ACQUISITION_TYPE_OPTIONS,
  UPGRADE_LEVEL_OPTIONS,
  CTP_TYPE_OPTIONS,
  DETAIL_OPTIONS,
  getNextId,
  filterRows,
  groupRowsByCharacter,
  groupRowsByCategory,
  sortCharacterGroups,
  runSanityTests,
  getCharacterEntry,
  characterMatchesQuery,
  getUsageSelectionLabel,
  getUsageTypeFromSelection,
  normalizeUsageSelection,
  normalizeUsageType,
  normalizeCtpType,
  normalizePriority,
  cyclePriority,
  getCharacterDisplayName,
} from './mffTrackerUtils';
import { characterNames } from './characterData';

const STORAGE_KEY = 'mff_tracker_rows_v2';
const LEGACY_STORAGE_KEY = 'mff_tracker_rows_v1';
const LEGACY_STORAGE_KEYS_BY_MODE = {
  none: 'mff_tracker_rows_none_v1',
  PVE: 'mff_tracker_rows_pve_v1',
  PVP: 'mff_tracker_rows_pvp_v1',
};
const USAGE_FILTER_KEY = 'mff_tracker_usage_filter_v1';
const PVP_MIGRATION_KEY = 'mff_tracker_usage_migrated_to_pvp_v1';
const THEME_KEY = 'mff_tracker_theme_v1';
const CHARACTER_CTP_OVERRIDES_KEY = 'mff_tracker_character_ctp_overrides_v1';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function normalizeLoadedRow(row) {
  if (!isPlainObject(row)) return null;

  const { ctp, ...rest } = row || {};
  return {
    id: Number.isInteger(Number(rest.id)) ? Number(rest.id) : 0,
    character: sanitizeText(rest.character),
    category: sanitizeText(rest.category),
    detail: sanitizeText(rest.detail),
    done: !!rest.done,
    priority: normalizePriority(rest.priority),
    usageType: normalizeUsageType(rest.usageType),
  };
}

function normalizeImportedRow(row) {
  return normalizeLoadedRow(row);
}

function loadStoredRows(key) {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeLoadedRow).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mergeUsageTypes(first, second) {
  const normalized = new Set(
    [normalizeUsageType(first), normalizeUsageType(second)].filter(Boolean)
  );

  if (normalized.has('PVE/PVP')) return 'PVE/PVP';
  if (normalized.has('PVE') && normalized.has('PVP')) return 'PVE/PVP';
  if (normalized.has('PVE')) return 'PVE';
  if (normalized.has('PVP')) return 'PVP';
  return '';
}

function getLegacySignature(row) {
  return [
    row.character || '',
    row.category || '',
    row.detail || '',
    row.done ? '1' : '0',
  ].join('||');
}

function mergeRowsBySignature(rows) {
  const merged = new Map();

  for (const row of rows) {
    const normalizedRow = normalizeLoadedRow(row);
    const signature = getLegacySignature(normalizedRow);
    const existing = merged.get(signature);

    if (!existing) {
      merged.set(signature, normalizedRow);
      continue;
    }

    existing.usageType = mergeUsageTypes(existing.usageType, normalizedRow.usageType);
    const currentId = typeof existing.id === 'number' ? existing.id : Number.POSITIVE_INFINITY;
    const nextId = typeof normalizedRow.id === 'number' ? normalizedRow.id : Number.POSITIVE_INFINITY;
    if (nextId < currentId) {
      existing.id = normalizedRow.id;
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aId = typeof a.id === 'number' ? a.id : Number.POSITIVE_INFINITY;
    const bId = typeof b.id === 'number' ? b.id : Number.POSITIVE_INFINITY;
    return aId - bId;
  });
}

function loadLegacyRows() {
  const merged = [];

  const legacyRows = loadStoredRows(LEGACY_STORAGE_KEY);
  if (legacyRows) {
    merged.push(...legacyRows);
  }

  const modeRows = {
    none: loadStoredRows(LEGACY_STORAGE_KEYS_BY_MODE.none) || [],
    PVE: loadStoredRows(LEGACY_STORAGE_KEYS_BY_MODE.PVE) || [],
    PVP: loadStoredRows(LEGACY_STORAGE_KEYS_BY_MODE.PVP) || [],
  };

  merged.push(
    ...modeRows.none.map((row) => ({ ...row, usageType: '' })),
    ...modeRows.PVE.map((row) => ({ ...row, usageType: 'PVE' })),
    ...modeRows.PVP.map((row) => ({ ...row, usageType: 'PVP' })),
  );

  return merged;
}

function loadRows() {
  const storedRows = loadStoredRows(STORAGE_KEY);
  if (storedRows) {
    return storedRows;
  }

  return mergeRowsBySignature(loadLegacyRows());
}

function loadCharacterCtpOverrides() {
  try {
    const saved = window.localStorage.getItem(CHARACTER_CTP_OVERRIDES_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!isPlainObject(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, normalizeCtpType(value)])
    );
  } catch {
    return {};
  }
}

function getGrowthDetailOptions(character) {
  const entry = getCharacterEntry(character);

  if (!entry?.upgradeLevel) {
    return DETAIL_OPTIONS['성장 필요'];
  }

  let options;

  switch (entry.upgradeLevel) {
    case '2티':
      options = ['1티→2티'];
      break;
    case '3티':
      options = ['1티→2티', '2티→3티'];
      break;
    case '4티':
      options = entry.baseUpgradeLevel === '각초'
        ? ['1티→2티', '2티→각초', '각초→4티']
        : ['1티→2티', '2티→3티', '3티→4티'];
      break;
    case '각초':
      options = ['1티→2티', '2티→각초'];
      break;
    default:
      options = DETAIL_OPTIONS['성장 필요'];
  }

  if (entry.originType === '태생캐 (2티)' || entry.originType === '태생캐 (2티, 더블)') {
    return options.filter((option) => option !== '1티→2티');
  }

  if (entry.originType === '태생캐 (3티)') {
    return options.filter((option) => option !== '1티→2티' && option !== '2티→3티');
  }

  return options;
}

function getAvailableDetailOptions(category, character) {
  if (category === '성장 필요') {
    return getGrowthDetailOptions(character);
  }

  return DETAIL_OPTIONS[category] || [];
}

function isDetailValidForCategory(category, character, detail) {
  if (category === '획득 필요') {
    return true;
  }

  const options = getAvailableDetailOptions(category, character);
  return options.includes(detail);
}

  function canDropRowIntoGroup(row, targetCategory, targetDetail) {
    if (!row) return false;
    if (row.category !== targetCategory) return false;
    if (row.detail === targetDetail) return false;
    return isDetailValidForCategory(targetCategory, row.character, targetDetail);
  }

  function getCategoryDragState(row, targetCategory, targetDetail) {
    if (!row) return 'idle';
    if (row.category !== targetCategory) return 'idle';
    if (row.detail === targetDetail) return 'idle';
    return isDetailValidForCategory(targetCategory, row.character, targetDetail) ? 'valid' : 'invalid';
  }

export default function MFFTrackerUI() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [usageFilter, setUsageFilter] = useState(() => {
    try {
      const saved = window.localStorage.getItem(USAGE_FILTER_KEY);
      if (!saved) return normalizeUsageSelection();

      const parsed = JSON.parse(saved);
      return normalizeUsageSelection(parsed);
    } catch {
      return normalizeUsageSelection();
    }
  });
  const [rows, setRows] = useState(() => loadRows());
  const [view, setView] = useState('character');
  const [nameQuery, setNameQuery] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [selectedAcquisitions, setSelectedAcquisitions] = useState([]);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [selectedCtps, setSelectedCtps] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDetails, setSelectedDetails] = useState([]);
  const [showDone, setShowDone] = useState(true);
  const [minimumPriorityFilter, setMinimumPriorityFilter] = useState(1);
  const [characterSort, setCharacterSort] = useState('lastAdded');
  const [characterSortDirection, setCharacterSortDirection] = useState('asc');
  const [rosterSort, setRosterSort] = useState('name');
  const [rosterSortDirection, setRosterSortDirection] = useState('asc');
  const [entryUsageSelection, setEntryUsageSelection] = useState(normalizeUsageSelection({ PVE: true, PVP: true }));
  const [form, setForm] = useState({
    character: '',
    category: '유니폼 필요',
    detail: '일반',
  });
  const [errors, setErrors] = useState({
    character: '',
    detail: '',
    general: '',
  });
  const [showCharacterDropdown, setShowCharacterDropdown] = useState(false);
  const [filteredCharacters, setFilteredCharacters] = useState(characterNames);
  const [characterDropdownIndex, setCharacterDropdownIndex] = useState(0);
  const [editingRow, setEditingRow] = useState(null);
  const [editUsageSelection, setEditUsageSelection] = useState(normalizeUsageSelection());
  const [editPriority, setEditPriority] = useState(1);
  const [characterCtpOverrides, setCharacterCtpOverrides] = useState(() => loadCharacterCtpOverrides());
  const [editErrors, setEditErrors] = useState({
    detail: '',
    general: '',
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSanityTests, setShowSanityTests] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [draggingRowId, setDraggingRowId] = useState(null);
  const [dragTargetGroupKey, setDragTargetGroupKey] = useState('');

  const importFileRef = useRef(null);
  const characterDropdownItemRefs = useRef([]);

  const getCharacterCtp = (character) => {
    if (Object.prototype.hasOwnProperty.call(characterCtpOverrides, character)) {
      return normalizeCtpType(characterCtpOverrides[character]);
    }

    return normalizeCtpType(getCharacterEntry(character)?.ctp);
  };

  const updateCharacterCtp = (character, ctp) => {
    const nextCtp = normalizeCtpType(ctp);
    setCharacterCtpOverrides((current) => ({
      ...current,
      [character]: nextCtp,
    }));
  };

  const availableDetailOptions = useMemo(
    () => getAvailableDetailOptions(form.category, form.character),
    [form.category, form.character]
  );
  const formDetailValue = useMemo(() => {
    if (form.category === '획득 필요') return '';
    return availableDetailOptions.includes(form.detail) ? form.detail : availableDetailOptions[0] || '';
  }, [availableDetailOptions, form.category, form.detail]);

  const editingAvailableDetailOptions = useMemo(
    () => getAvailableDetailOptions(editingRow?.category || '', editingRow?.character || ''),
    [editingRow?.category, editingRow?.character]
  );
  const editingDetailValue = useMemo(() => {
    if (!editingRow || editingRow.category === '획득 필요') return '';
    return editingAvailableDetailOptions.includes(editingRow.detail)
      ? editingRow.detail
      : editingAvailableDetailOptions[0] || '';
  }, [editingAvailableDetailOptions, editingRow]);

  const selectCharacter = (name) => {
    const nextOptions = getAvailableDetailOptions(form.category, name);

    setForm((current) => ({
      ...current,
      character: name,
      detail: current.category === '성장 필요' ? nextOptions[0] || '' : current.detail,
    }));
    setShowCharacterDropdown(false);
    setCharacterDropdownIndex(0);
    if (errors.character) {
      setErrors({ ...errors, character: '' });
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // ignore storage errors
    }
  }, [rows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(USAGE_FILTER_KEY, JSON.stringify(usageFilter));
    } catch {
      // ignore storage errors
    }
  }, [usageFilter]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHARACTER_CTP_OVERRIDES_KEY, JSON.stringify(characterCtpOverrides));
    } catch {
      // ignore storage errors
    }
  }, [characterCtpOverrides]);

  useEffect(() => {
    try {
      const migrated = window.localStorage.getItem(PVP_MIGRATION_KEY);
      if (migrated === 'true') return;

      const updatedRows = rows.map((row) => {
        const usageType = normalizeUsageType(row.usageType);
        if (usageType === 'PVE' || usageType === 'PVE/PVP') {
          return { ...row, usageType: 'PVP' };
        }

        return row;
      });

      if (updatedRows.some((row, index) => row !== rows[index])) {
        setRows(updatedRows);
      }

      window.localStorage.setItem(PVP_MIGRATION_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!showResetConfirm) return;

    const timer = window.setTimeout(() => {
      setShowResetConfirm(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [showResetConfirm]);

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage('');
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  
  const sanityTests = useMemo(() => runSanityTests(), []);

  const categories = useMemo(() => {
    return ['전체', ...Array.from(new Set(rows.map((row) => row.category)))];
  }, [rows]);

  const detailOptionsByCategory = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (!row.detail) return;
      if (!map.has(row.category)) {
        map.set(row.category, new Set());
      }
      map.get(row.category).add(row.detail);
    });

    return Array.from(map.entries()).map(([category, detailSet]) => ({
      category,
      details: Array.from(detailSet),
    }));
  }, [rows]);

  const originOptions = useMemo(() => ORIGIN_TYPE_OPTIONS.filter((option) => option !== '전체'), []);
  const acquisitionOptions = useMemo(() => ACQUISITION_TYPE_OPTIONS.filter((option) => option !== '전체'), []);
  const upgradeOptions = useMemo(() => UPGRADE_LEVEL_OPTIONS.filter((option) => option !== '전체'), []);
  const ctpOptions = useMemo(() => CTP_TYPE_OPTIONS, []);

  const toggleSelectedValue = (currentValues, value) => {
    if (currentValues.includes(value)) {
      return currentValues.filter((item) => item !== value);
    }

    return [...currentValues, value];
  };

  const makeDetailKey = (category, detail) => `${category}__${detail}`;

  const filteredRows = useMemo(() => {
    return filterRows(
      rows,
      nameQuery,
      {
        originType: '전체',
        acquisitionType: '전체',
        upgradeLevel: '전체',
      },
      usageFilter,
      '전체',
      showDone
    );
  }, [rows, nameQuery, usageFilter, showDone]);

  const metadataFilteredRows = useMemo(() => {
    const originSet = new Set(selectedOrigins);
    const acquisitionSet = new Set(selectedAcquisitions);
    const upgradeSet = new Set(selectedUpgrades);
    const ctpSet = new Set(selectedCtps);
    const categorySet = new Set(selectedCategories);
    const detailSet = new Set(selectedDetails);

    return filteredRows.filter((row) => {
      const entry = getCharacterEntry(row.character);
      const entryCtp = Object.prototype.hasOwnProperty.call(characterCtpOverrides, row.character)
        ? normalizeCtpType(characterCtpOverrides[row.character])
        : normalizeCtpType(entry?.ctp);
      const rowDetailKey = makeDetailKey(row.category, row.detail);

      const matchesOrigin = originSet.size === 0 || originSet.has(entry?.originType || '');
      const matchesAcquisition = acquisitionSet.size === 0 || acquisitionSet.has(entry?.acquisitionType || '');
      const matchesUpgrade = upgradeSet.size === 0 || upgradeSet.has(entry?.upgradeLevel || '');
      const matchesCtp = ctpSet.size === 0 || ctpSet.has(entryCtp || '');
      const matchesCategory = categorySet.size === 0 || categorySet.has(row.category);
      const matchesDetail = detailSet.size === 0 || detailSet.has(rowDetailKey);

      return matchesOrigin && matchesAcquisition && matchesUpgrade && matchesCtp && matchesCategory && matchesDetail;
    });
  }, [
    filteredRows,
    selectedOrigins,
    selectedAcquisitions,
    selectedUpgrades,
    selectedCtps,
    selectedCategories,
    selectedDetails,
    characterCtpOverrides,
  ]);

  const ctpFilteredRows = useMemo(() => metadataFilteredRows, [metadataFilteredRows]);

  const priorityFilteredRows = useMemo(
    () => ctpFilteredRows.filter((row) => normalizePriority(row.priority) >= minimumPriorityFilter),
    [ctpFilteredRows, minimumPriorityFilter]
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (nameQuery.trim()) {
      chips.push({
        label: `Search: ${nameQuery.trim()}`,
        clear: () => setNameQuery(''),
      });
    }

    selectedOrigins.forEach((origin) => {
      chips.push({
        label: `Origin: ${origin}`,
        clear: () => setSelectedOrigins((current) => current.filter((item) => item !== origin)),
      });
    });

    selectedAcquisitions.forEach((acquisition) => {
      chips.push({
        label: `Acquisition: ${acquisition}`,
        clear: () => setSelectedAcquisitions((current) => current.filter((item) => item !== acquisition)),
      });
    });

    selectedUpgrades.forEach((upgrade) => {
      chips.push({
        label: `Tier: ${upgrade}`,
        clear: () => setSelectedUpgrades((current) => current.filter((item) => item !== upgrade)),
      });
    });

    const usageLabel = getUsageSelectionLabel(usageFilter);
    if (usageLabel !== 'All') {
      chips.push({
        label: `Usage: ${usageLabel}`,
        clear: () => setUsageFilter(normalizeUsageSelection({ PVE: true, PVP: true })),
      });
    }

    chips.push({
      label: `Priority: ${'!'.repeat(minimumPriorityFilter)}`,
      clear: () => setMinimumPriorityFilter(1),
    });

    selectedCtps.forEach((ctp) => {
      chips.push({
        label: `CTP: ${ctp}`,
        clear: () => setSelectedCtps((current) => current.filter((item) => item !== ctp)),
        icon: CTP_ICON_BY_TYPE[ctp] || '',
        title: ctp,
      });
    });

    selectedCategories.forEach((category) => {
      chips.push({
        label: `Category: ${category}`,
        clear: () => setSelectedCategories((current) => current.filter((item) => item !== category)),
      });
    });

    selectedDetails.forEach((detailKey) => {
      const [category, detail] = detailKey.split('__');
      chips.push({
        label: `Detail: ${category} / ${detail}`,
        clear: () => setSelectedDetails((current) => current.filter((item) => item !== detailKey)),
      });
    });

    return chips;
  }, [
    nameQuery,
    selectedOrigins,
    selectedAcquisitions,
    selectedUpgrades,
    usageFilter,
    minimumPriorityFilter,
    selectedCtps,
    selectedCategories,
    selectedDetails,
  ]);

  const groupedByCharacter = useMemo(() => {
    const grouped = groupRowsByCharacter(priorityFilteredRows);
    return sortCharacterGroups(grouped, characterSort, characterSortDirection);
  }, [priorityFilteredRows, characterSort, characterSortDirection]);

  const rosterGroupedByCharacter = useMemo(() => {
    const grouped = groupRowsByCharacter(priorityFilteredRows);
    return sortCharacterGroups(grouped, rosterSort, rosterSortDirection);
  }, [priorityFilteredRows, rosterSort, rosterSortDirection]);

  const displayedGroupedByCharacter = view === 'roster' ? rosterGroupedByCharacter : groupedByCharacter;

  const groupedByCategory = useMemo(() => {
    return groupRowsByCategory(priorityFilteredRows);
  }, [priorityFilteredRows]);

  const getGroupPriority = (items) => items.reduce(
    (maxPriority, row) => Math.max(maxPriority, normalizePriority(row.priority)),
    0
  );

  const matchingCharacterNames = useMemo(() => {
    const query = nameQuery.trim();
    if (!query) return [];

    return characterNames.filter((name) => characterMatchesQuery(name, query));
  }, [nameQuery]);

  const quickAddCharacter = matchingCharacterNames.length === 1 ? matchingCharacterNames[0] : '';
  const hasTrackedEntryForQuickAddCharacter =
    quickAddCharacter && rows.some((row) => row.character === quickAddCharacter);
  const selectedCharacterEntry = useMemo(
    () => getCharacterEntry(form.character),
    [form.character]
  );
  const selectedCharacterRowCount = useMemo(() => {
    if (!selectedCharacterEntry) return 0;
    return rows.filter((row) => getCharacterEntry(row.character) === selectedCharacterEntry).length;
  }, [rows, selectedCharacterEntry]);
  const visibleCharacterOptions = filteredCharacters.slice(0, 10);

  useEffect(() => {
    if (!showCharacterDropdown || visibleCharacterOptions.length === 0) return;

    const target = characterDropdownItemRefs.current[characterDropdownIndex];
    target?.scrollIntoView({ block: 'nearest' });
  }, [characterDropdownIndex, showCharacterDropdown, visibleCharacterOptions]);

  function addRow(event) {
    event.preventDefault();

    const character = form.character.trim();
    const category = form.category.trim();
    const detail = form.detail.trim();
    const usageType = getUsageTypeFromSelection(entryUsageSelection);
    const priority = 1;

    const newErrors = {
      character: '',
      detail: '',
      general: '',
    };

    if (!character) {
      newErrors.character = 'This field is required';
    } else if (!getCharacterEntry(character)) {
      newErrors.character = 'Invalid character name';
    }

    if (category === '성장 필요' && availableDetailOptions.length === 0) {
      newErrors.detail = 'This character has no growth options';
    } else if (category !== '획득 필요' && !isDetailValidForCategory(category, character, detail)) {
      newErrors.detail = 'This field is required';
    }

    const normalizedDetail = category === '획득 필요' ? '' : detail;
    const isDuplicate = rows.some(row =>
      row.character === character &&
      row.category === category &&
      row.detail === normalizedDetail
    );

    if (isDuplicate) {
      newErrors.general = 'This entry already exists';
    }

    if (newErrors.character || newErrors.detail || newErrors.general) {
      setErrors(newErrors);
      return;
    }

    // clear errors if valid
    setErrors({ character: '', detail: '', general: '' });
    setCharacterDropdownIndex(0);

    setRows((prev) => [
      ...prev,
      {
        id: getNextId(prev),
        character,
        category,
        detail: category === '획득 필요' ? '' : detail,
        usageType,
        priority,
        done: false,
      },
    ]);

    setSuccessMessage('Entry added successfully!');

    setForm((prev) => {
      const nextOptions = DETAIL_OPTIONS[prev.category] || [];
      return {
        character: prev.character, // Keep character for convenience
        category: prev.category,
        detail: nextOptions[0] || '',
      };
    });
  }

  function openEditRow(row) {
    setEditingRow({ ...row });
    setEditUsageSelection(
      normalizeUsageSelection({
        PVE: normalizeUsageType(row.usageType) === 'PVE' || normalizeUsageType(row.usageType) === 'PVE/PVP',
        PVP: normalizeUsageType(row.usageType) === 'PVP' || normalizeUsageType(row.usageType) === 'PVE/PVP',
      })
    );
    setEditPriority(normalizePriority(row.priority));
    setEditErrors({ detail: '', general: '' });
  }

  function closeEditRow() {
    setEditingRow(null);
    setEditErrors({ detail: '', general: '' });
  }

  function saveEditRow(event) {
    event.preventDefault();
    if (!editingRow) return;

    const nextDetail = (editingRow.detail || '').trim();
    const nextUsageType = getUsageTypeFromSelection(editUsageSelection);
    const newErrors = {
      detail: '',
      general: '',
    };

    if (editingRow.category === '성장 필요' && editingAvailableDetailOptions.length === 0) {
      newErrors.detail = 'This character has no growth options';
    } else if (editingRow.category !== '획득 필요' && !isDetailValidForCategory(editingRow.category, editingRow.character, nextDetail)) {
      newErrors.detail = 'This field is required';
    }

    const normalizedDetail = editingRow.category === '획득 필요' ? '' : nextDetail;
    const isDuplicate = rows.some((row) =>
      row.id !== editingRow.id &&
      row.character === editingRow.character &&
      row.category === editingRow.category &&
      row.detail === normalizedDetail
    );

    if (isDuplicate) {
      newErrors.general = 'This entry already exists';
    }

    if (newErrors.detail || newErrors.general) {
      setEditErrors(newErrors);
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === editingRow.id
          ? {
              ...row,
              detail: editingRow.category === '획득 필요' ? '' : normalizedDetail,
              done: !!editingRow.done,
              usageType: nextUsageType,
              priority: normalizePriority(editPriority),
            }
          : row
      )
    );

    setSuccessMessage('Entry updated successfully!');
    closeEditRow();
  }

  function toggleDone(id) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, done: !row.done } : row)));
  }

  function cycleRowPriority(id) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, priority: cyclePriority(row.priority) }
          : row
      )
    );
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function moveRowToGroup(rowId, targetCategory, targetDetail) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (row.category !== targetCategory) return row;
        if (row.detail === targetDetail) return row;
        return {
          ...row,
          detail: targetDetail,
        };
      })
    );
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mff_tracker.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    setRows([]);
    setNameQuery('');
    setSelectedOrigins([]);
    setSelectedAcquisitions([]);
    setSelectedUpgrades([]);
    setSelectedCtps([]);
    setUsageFilter(normalizeUsageSelection({ PVE: true, PVP: true }));
    setSelectedCategories([]);
    setSelectedDetails([]);
    setShowDone(true);
    setMinimumPriorityFilter(1);
    setEntryUsageSelection(normalizeUsageSelection({ PVE: true, PVP: true }));
    setForm({ character: '', category: '유니폼 필요', detail: '' });
    setShowResetConfirm(false);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      Object.values(LEGACY_STORAGE_KEYS_BY_MODE).forEach((key) => {
        window.localStorage.removeItem(key);
      });
    } catch {
      // ignore storage errors
    }
  }

  function handleImportJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const text = loadEvent.target?.result;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          window.alert('Invalid JSON: expected an array of rows.');
          return;
        }

        if (parsed.length > 5000) {
          window.alert('Invalid JSON: too many rows.');
          return;
        }

        const isValid = parsed.every((row) => {
          return (
            isPlainObject(row) &&
            typeof row.id === 'number' &&
            typeof row.character === 'string' &&
            typeof row.category === 'string' &&
            typeof row.detail === 'string' &&
            typeof row.done === 'boolean' &&
            (row.priority === undefined || typeof row.priority === 'number' || typeof row.priority === 'string') &&
            (row.usageType === undefined || typeof row.usageType === 'string')
          );
        });

        if (!isValid) {
          window.alert('Invalid JSON format.');
          return;
        }

        setRows(parsed.map(normalizeImportedRow).filter(Boolean));
        setShowResetConfirm(false);
      } catch {
        window.alert('Failed to import JSON.');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  }
  const passedCount = sanityTests.filter((test) => test.pass).length;

  return (
    <div className={`mff-app ${theme === 'dark' ? 'mff-theme-dark' : 'mff-theme-light'} min-h-screen p-6`}>
      <input
        ref={importFileRef}
        type="file"
        accept="application/json"
        onChange={handleImportJson}
        className="hidden"
      />
      <div className="max-w-7xl mx-auto space-y-6 pb-24">
          <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Marvel Future Fight Tracker</h1>
              <p className="text-sm text-slate-600 mt-1">
                캐릭터별 성장/유니폼/획득 메모를 깔끔하게 관리하는 UI
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-lg ${
                  theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-yellow-100 text-slate-900'
                }`}
              >
                <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
              </button>
              <button
                onClick={() => setView('character')}
                className={`px-4 py-2 rounded-2xl border ${view === 'character' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              >
                Character View
              </button>
              <button
                onClick={() => setView('category')}
                className={`px-4 py-2 rounded-2xl border ${view === 'category' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              >
                Category View
              </button>
              <button
                onClick={() => setView('roster')}
                className={`px-4 py-2 rounded-2xl border ${view === 'roster' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              >
                Character List
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFiltersDrawer(true)}
          aria-hidden={showFiltersDrawer}
          tabIndex={showFiltersDrawer ? -1 : 0}
          className={`fixed left-0 top-1/2 z-50 -translate-y-1/2 rounded-r-2xl border border-l-0 bg-white px-5 py-3 shadow-xl text-base font-semibold transition-all duration-200 ease-out ${
            showFiltersDrawer
              ? 'pointer-events-none opacity-0 -translate-x-8'
              : 'pointer-events-auto opacity-100 translate-x-0'
          }`}
        >
          Filters
        </button>

        <div
          className={`fixed left-4 top-1/2 z-40 w-80 max-w-[80vw] -translate-y-1/2 rounded-3xl border bg-white shadow-2xl p-5 space-y-4 transition-all duration-200 ${
            showFiltersDrawer
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Filters</h2>
            <button
              type="button"
              onClick={() => setShowFiltersDrawer(false)}
              className="text-sm px-3 py-1.5 rounded-full border bg-slate-100 text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">Origin</label>
                <button
                  type="button"
                  onClick={() => setSelectedOrigins([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {originOptions.map((option) => {
                  const selected = selectedOrigins.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOrigins((current) => toggleSelectedValue(current, option))}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">Acquisition</label>
                <button
                  type="button"
                  onClick={() => setSelectedAcquisitions([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {acquisitionOptions.map((option) => {
                  const selected = selectedAcquisitions.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedAcquisitions((current) => toggleSelectedValue(current, option))}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">Tier</label>
                <button
                  type="button"
                  onClick={() => setSelectedUpgrades([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {upgradeOptions.map((option) => {
                  const selected = selectedUpgrades.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedUpgrades((current) => toggleSelectedValue(current, option))}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">CTP</label>
                <button
                  type="button"
                  onClick={() => setSelectedCtps([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ctpOptions.map((option) => {
                  const selected = selectedCtps.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedCtps((current) => toggleSelectedValue(current, option))}
                      title={option}
                      className={`w-11 h-11 rounded-full border flex items-center justify-center ${
                        selected
                          ? 'bg-slate-900 border-slate-900'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <img
                        src={CTP_ICON_BY_TYPE[option]}
                        alt=""
                        className={`w-6 h-6 ${selected ? '' : 'opacity-80'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-500">Category</label>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((category) => category !== '전체')
                    .map((category) => {
                      const selected = selectedCategories.includes(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setSelectedCategories((current) => toggleSelectedValue(current, category));
                          }}
                          className={`px-3 py-1.5 rounded-full border text-sm ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-500">Detail</label>
                  <button
                    type="button"
                    onClick={() => setSelectedDetails([])}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {(selectedCategories.length > 0
                    ? detailOptionsByCategory.filter((group) => selectedCategories.includes(group.category))
                    : detailOptionsByCategory
                  ).map((group) => (
                    <div key={group.category} className="space-y-2">
                      <div className="text-xs font-medium text-slate-500">{group.category}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.details.map((detail) => {
                          const key = makeDetailKey(group.category, detail);
                          const selected = selectedDetails.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedDetails((current) => toggleSelectedValue(current, key));
                              }}
                              className={`px-3 py-1.5 rounded-full border text-sm ${
                                selected
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {detail}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto bg-white rounded-3xl shadow-sm border p-5 h-fit space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold">Add Entry</h2>
                <div className="flex items-center gap-2">
                  {['PVE', 'PVP'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setEntryUsageSelection((current) => ({
                          ...current,
                          [label]: !current[label],
                        }));
                      }}
                      className={`px-3 py-2 rounded-2xl border text-sm font-medium ${
                        label === 'PVE'
                          ? entryUsageSelection[label]
                            ? 'bg-sky-200 text-sky-900 border-sky-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          : entryUsageSelection[label]
                            ? 'bg-rose-200 text-rose-900 border-rose-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <form onSubmit={addRow} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Character</label>
                  <div className="relative flex items-center">
                    <input
                      value={form.character}
                      onChange={(event) => {
                        const value = event.target.value;
                        const nextOptions = getAvailableDetailOptions(form.category, value);
                        if (errors.character) {
                          setErrors({ ...errors, character: '' });
                        }
                        const filtered = characterNames.filter((name) => characterMatchesQuery(name, value));
                        setFilteredCharacters(filtered);
                        setShowCharacterDropdown(value.length > 0 && filtered.length > 0);
                        setCharacterDropdownIndex(0);
                        setForm((prev) => ({
                          ...prev,
                          character: value,
                          detail: prev.category === '성장 필요' ? nextOptions[0] || '' : prev.detail,
                        }));
                      }}
                      onFocus={() => {
                        if (form.character) {
                          const filtered = characterNames.filter((name) =>
                            characterMatchesQuery(name, form.character)
                          );
                          setFilteredCharacters(filtered);
                          setShowCharacterDropdown(filtered.length > 0);
                          setCharacterDropdownIndex(0);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!showCharacterDropdown || filteredCharacters.length === 0) return;

                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setCharacterDropdownIndex((current) => (current + 1) % Math.min(filteredCharacters.length, 10));
                        } else if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setCharacterDropdownIndex((current) => {
                            const limit = Math.min(filteredCharacters.length, 10);
                            return (current - 1 + limit) % limit;
                          });
                        } else if (event.key === 'Enter') {
                          event.preventDefault();
                          const selected = visibleCharacterOptions[characterDropdownIndex];
                          if (selected) {
                            selectCharacter(selected);
                          }
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setShowCharacterDropdown(false);
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow click on options
                        setTimeout(() => setShowCharacterDropdown(false), 150);
                      }}
                      placeholder="Type to search characters..."
                      className={`flex-1 mt-1 px-3 py-2 rounded-2xl border ${
                        errors.character ? 'border-red-500' : ''
                      }`}
                    />
                    {form.character && selectedCharacterEntry && (
                      <div className="ml-2 mt-1 flex items-center gap-2">
                        <CharacterIcon name={form.character} preferLatest />
                        <span
                          className={`text-xs px-2 py-1 rounded-full border font-medium whitespace-nowrap ${
                            selectedCharacterRowCount > 0
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                          title={
                            selectedCharacterRowCount > 0
                              ? `${selectedCharacterRowCount} entries already exist`
                              : 'No entries yet'
                          }
                        >
                          {selectedCharacterRowCount > 0
                            ? `${selectedCharacterRowCount} in table`
                            : 'New'}
                        </span>
                      </div>
                    )}
                    {showCharacterDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto top-full">
                        {visibleCharacterOptions.map((name, index) => (
                          <div
                            key={name}
                            ref={(node) => {
                              characterDropdownItemRefs.current[index] = node;
                            }}
                            onClick={() => {
                              selectCharacter(name);
                            }}
                            className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                              characterDropdownIndex === index
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <CharacterIcon name={name} preferLatest />
                            <span>{name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.character && (
                    <p className="text-red-500 text-xs mt-1">{errors.character}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => {
                      const nextCategory = event.target.value;
                      const nextOptions = getAvailableDetailOptions(nextCategory, form.character);

                      setForm({
                        ...form,
                        category: nextCategory,
                        detail: nextOptions[0] || '',
                      });
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-2xl border"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              {form.category !== '획득 필요' && (
                <div>
                    <label className="text-sm font-medium">Detail</label>
                      <select
                      value={formDetailValue}
                      disabled={availableDetailOptions.length === 0}
                      onChange={(event) => {
                        setForm({ ...form, detail: event.target.value });
                        if (errors.detail) {
                          setErrors({ ...errors, detail: '' });
                        }
                      }}
                      className={`w-full mt-1 px-3 py-2 rounded-2xl border ${
                        errors.detail ? 'border-red-500' : ''
                      }`}
                    >
                      {availableDetailOptions.length > 0 ? (
                        availableDetailOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          -
                        </option>
                      )}
                    </select>

                    {errors.detail && (
                      <p className="text-red-500 text-xs mt-1">{errors.detail}</p>
                    )}
                  </div>
                )}
                <button className="mff-add-button w-full px-4 py-2 rounded-2xl font-medium cursor-pointer">
                  Add
                </button>
              </form>

              {successMessage && (
                <div className="mt-3 px-3 py-2 rounded-2xl bg-green-50 text-green-800 border border-green-200 text-sm">
                  {successMessage}
                </div>
              )}

              {errors.general && (
                <div className="mt-3 px-3 py-2 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-sm">
                  {errors.general}
                </div>
              )}
            </div>
            <div className="pt-6 border-t space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(event) => setShowDone(event.target.checked)}
                />
                Show completed entries
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="flex-1 px-4 py-2 rounded-2xl border cursor-pointer"
                >
                  Import JSON
                </button>

                <button
                  type="button"
                  onClick={exportJson}
                  className="flex-1 px-4 py-2 rounded-2xl border cursor-pointer"
                >
                  Export JSON
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (showResetConfirm) {
                      resetAll();
                    } else {
                      setShowResetConfirm(true);
                    }
                  }}
                  className={`flex-1 px-4 py-2 rounded-2xl border cursor-pointer ${
                    showResetConfirm ? 'border-red-300 bg-red-50 text-red-700' : ''
                  }`}
                >
                  {showResetConfirm ? 'Are you sure?' : 'Reset'}
                </button>
              </div>
            </div>

            <div className="pt-6 border-t space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Sanity Tests</h2>
                <button
                  type="button"
                  onClick={() => setShowSanityTests((current) => !current)}
                  className="px-3 py-1 rounded-xl border text-sm"
                >
                  {showSanityTests ? 'Hide' : 'Show'}
                </button>
              </div>
              {showSanityTests && (
                <>
                  <div className="text-sm text-slate-500">
                    {passedCount}/{sanityTests.length} passed
                  </div>
                  <div className="space-y-2">
                    {sanityTests.map((test) => (
                      <div
                        key={test.name}
                        className={`rounded-2xl border px-3 py-2 text-sm ${test.pass ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        <span className="font-medium">{test.pass ? 'PASS' : 'FAIL'}</span> — {test.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border p-5">
              <div className="flex items-center justify-between gap-4 mb-4 flex-nowrap">
              <div className="flex items-center gap-3 min-w-0 flex-nowrap">
                <h2 className="text-xl font-semibold whitespace-nowrap">
                  {view === 'character'
                    ? 'Grouped by Character'
                    : view === 'category'
                      ? 'Grouped by Category'
                      : 'Character List'}
                </h2>
                <PriorityBadge
                  priority={minimumPriorityFilter}
                  onClick={() => setMinimumPriorityFilter((current) => cyclePriority(current))}
                  className="w-9 h-9"
                />
                <div className="relative w-36 max-w-[20vw] shrink-0">
                  <input
                    value={nameQuery}
                    onChange={(event) => setNameQuery(event.target.value)}
                    placeholder="Search"
                    className="w-full pl-10 pr-3 py-2 rounded-2xl border"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
                  {getUsageSelectionLabel(usageFilter)}
                </span>
                {view === 'character' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">Sort by</span>
                    <select
                      value={characterSort}
                      onChange={(e) => setCharacterSort(e.target.value)}
                      className="px-3 py-1 rounded-xl border text-sm"
                    >
                      <option value="name">Name</option>
                      <option value="origin">Origin</option>
                      <option value="acquisition">Acquisition</option>
                      <option value="tier">Tier</option>
                      <option value="lastAdded">Last Added</option>
                      <option value="priority">Priority</option>
                      <option value="completion">Completion</option>
                      <option value="tasks">Task Count</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setCharacterSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                      className="w-9 h-9 rounded-xl border flex items-center justify-center text-sm"
                      title={characterSortDirection === 'desc' ? 'Descending' : 'Ascending'}
                      aria-label={characterSortDirection === 'desc' ? 'Descending' : 'Ascending'}
                    >
                      <span aria-hidden="true">{characterSortDirection === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </div>
                )}
                {view === 'roster' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">Sort by</span>
                    <select
                      value={rosterSort}
                      onChange={(e) => setRosterSort(e.target.value)}
                      className="px-3 py-1 rounded-xl border text-sm"
                    >
                      <option value="name">Name</option>
                      <option value="origin">Origin</option>
                      <option value="acquisition">Acquisition</option>
                      <option value="tier">Tier</option>
                      <option value="lastAdded">Last Added</option>
                      <option value="priority">Priority</option>
                      <option value="completion">Completion</option>
                      <option value="tasks">Task Count</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setRosterSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                      className="w-9 h-9 rounded-xl border flex items-center justify-center text-sm"
                      title={rosterSortDirection === 'desc' ? 'Descending' : 'Ascending'}
                      aria-label={rosterSortDirection === 'desc' ? 'Descending' : 'Ascending'}
                    >
                      <span aria-hidden="true">{rosterSortDirection === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </div>
                )}
                <div className="text-sm text-slate-500">{priorityFilteredRows.length} entries</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title={chip.title || chip.label}
                >
                  {chip.icon ? <img src={chip.icon} alt="" className="w-4 h-4 shrink-0" /> : null}
                  <span className={chip.icon ? 'sr-only' : 'whitespace-nowrap'}>{chip.label}</span>
                  <span className="text-slate-400 font-semibold">×</span>
                </button>
              ))}
            </div>

            {view === 'character' ? (
              <div className="space-y-4">
                {!displayedGroupedByCharacter.length && quickAddCharacter && !hasTrackedEntryForQuickAddCharacter && (
                  <div className="rounded-3xl border p-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <CharacterIcon name={quickAddCharacter} preferLatest />
                        <div className="text-lg font-semibold truncate">{quickAddCharacter}</div>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">No tracked entries yet for this character.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          character: quickAddCharacter,
                        }));
                        setErrors({ character: '', detail: '', general: '' });
                      }}
                      className="px-4 py-2 rounded-2xl border bg-slate-900 text-white cursor-pointer"
                    >
                      Quick add
                    </button>
                  </div>
                )}
                {!displayedGroupedByCharacter.length && (!quickAddCharacter || hasTrackedEntryForQuickAddCharacter) && (
                  <div className="rounded-3xl border p-6 text-sm text-slate-600">
                    No entries match this search.
                  </div>
                )}
                {displayedGroupedByCharacter.map(([character, items]) => {
                  const characterCtp = getCharacterCtp(character);

                  return (
                    <div key={character} className="rounded-3xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <CharacterIcon name={character} theme={theme} />
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold">{character}</h3>
                            <CharacterUpgradeBadges name={character} />
                            <CharacterAcquisitionBadge name={character} />
                            <CharacterOriginBadge name={character} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CtpPicker
                            value={characterCtp}
                            onChange={(next) => updateCharacterCtp(character, next)}
                            align="right"
                            label={characterCtp || '-'}
                            secretDisplay
                          />
                          <PriorityBadge priority={getGroupPriority(items)} className="w-8 h-8" />
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{items.length} items</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                          >
                            <button
                              onClick={() => toggleDone(item.id)}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition
                                ${item.done ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}
                              `}
                            >
                              {item.done && (
                                <span className="text-white text-sm font-bold">✓</span>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium ${item.done ? 'line-through text-slate-400' : ''}`}>
                                {item.category}
                              </div>
                              <div className={`text-sm text-slate-600 ${item.done ? 'line-through text-slate-400' : ''}`}>
                                {item.detail}
                              </div>
                            </div>
                            <PriorityBadge
                              priority={item.priority}
                              onClick={() => cycleRowPriority(item.id)}
                            />
                            <CharacterUsageBadge usageType={item.usageType} />
                            <button
                              type="button"
                              onClick={() => openEditRow(item)}
                              className="text-sm px-3 py-1 rounded-xl border cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(item.id)}
                              className="text-sm px-3 py-1 rounded-xl border cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : view === 'roster' ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {displayedGroupedByCharacter.map(([character, items]) => {
                  const characterCtp = getCharacterCtp(character);

                  return (
                    <div key={character} className="rounded-3xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CharacterIcon name={character} theme={theme} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{character}</div>
                            <div className="text-xs text-slate-500">{items.length} items</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <CtpPicker
                            value={characterCtp}
                            onChange={(next) => updateCharacterCtp(character, next)}
                            align="right"
                            label={characterCtp || '-'}
                            secretDisplay
                          />
                          <PriorityBadge priority={getGroupPriority(items)} className="w-8 h-8" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <CharacterUpgradeBadges name={character} />
                        <CharacterAcquisitionBadge name={character} />
                        <CharacterOriginBadge name={character} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByCategory.map((group) => (
                  (() => {
                    const activeRow = rows.find((row) => row.id === draggingRowId);
                    const dragState = getCategoryDragState(activeRow, group.category, group.detail);

                    return (
                  <div
                    key={`${group.category}-${group.detail}`}
                    className={`rounded-3xl border p-4 transition-colors ${
                      dragState === 'valid'
                        ? 'border-sky-400 bg-sky-50/60'
                        : dragState === 'invalid'
                          ? 'border-red-400 bg-red-50/60'
                          : ''
                    }`}
                    onDragOver={(event) => {
                      if (!canDropRowIntoGroup(activeRow, group.category, group.detail)) return;

                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDragTargetGroupKey(`${group.category}__${group.detail}`);
                    }}
                    onDragEnter={() => {
                      if (!canDropRowIntoGroup(activeRow, group.category, group.detail)) return;

                      setDragTargetGroupKey(`${group.category}__${group.detail}`);
                    }}
                    onDragLeave={() => {
                      setDragTargetGroupKey((current) =>
                        current === `${group.category}__${group.detail}` ? '' : current
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const rowId = Number(event.dataTransfer.getData('text/plain'));
                      const sourceRow = rows.find((row) => row.id === rowId);

                      if (!canDropRowIntoGroup(sourceRow, group.category, group.detail)) {
                        setDraggingRowId(null);
                        setDragTargetGroupKey('');
                        return;
                      }

                      moveRowToGroup(rowId, group.category, group.detail);
                      setDraggingRowId(null);
                      setDragTargetGroupKey('');
                    }}
                  >
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold">{group.category}</h3>
                      <p className="text-sm text-slate-600">{group.detail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.items
                        .slice()
                        .sort((a, b) => {
                          const priorityDiff = normalizePriority(b.priority) - normalizePriority(a.priority);
                          if (priorityDiff !== 0) {
                            return priorityDiff;
                          }

                          return a.character.localeCompare(b.character, 'ko');
                        })
                        .map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', String(item.id));
                              const preview = event.currentTarget.cloneNode(true);
                              preview.style.background = 'transparent';
                              preview.style.boxShadow = 'none';
                              preview.style.opacity = '1';
                              preview.style.position = 'absolute';
                              preview.style.top = '-1000px';
                              preview.style.left = '-1000px';
                              preview.style.pointerEvents = 'none';
                              document.body.appendChild(preview);
                              event.dataTransfer.setDragImage(
                                preview,
                                preview.offsetWidth / 2,
                                preview.offsetHeight / 2
                              );
                              window.requestAnimationFrame(() => {
                                preview.remove();
                              });
                              setDraggingRowId(item.id);
                            }}
                            onDragEnd={() => {
                              setDraggingRowId(null);
                              setDragTargetGroupKey('');
                            }}
                            onClick={() => toggleDone(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                toggleDone(item.id);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border cursor-pointer select-none ${
                              item.done ? 'bg-slate-50 border-slate-200' : 'bg-white'
                            }`}
                          >
                            <CharacterIcon name={item.character} theme={theme} />
                            <span className={`max-w-36 truncate text-sm font-medium ${item.done ? 'line-through text-slate-400' : ''}`}>
                              {getCharacterDisplayName(item.character)}
                            </span>
                            <CharacterAcquisitionBadge name={item.character} />
                            <CharacterOriginBadge name={item.character} />
                            <PriorityBadge
                              priority={item.priority}
                              onClick={() => cycleRowPriority(item.id)}
                            />
                            <CharacterUsageBadge usageType={item.usageType} />
                          </div>
                        ))}
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </div>

        {editingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Edit Entry</h3>
                  <p className="text-sm text-slate-500 mt-1">{editingRow.character}</p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="px-3 py-1 rounded-xl border text-sm"
                >
                  Close
                </button>
              </div>

              <form onSubmit={saveEditRow} className="space-y-4">
                <div className="text-sm">
                  <div className="font-medium">Category</div>
                  <div className="mt-1 text-slate-600">{editingRow.category}</div>
                </div>

                <div className="text-sm">
                  <div className="font-medium">Detail</div>
                  <select
                    value={editingDetailValue}
                    disabled={editingAvailableDetailOptions.length === 0}
                    onChange={(event) => {
                      setEditingRow((current) => ({ ...current, detail: event.target.value }));
                      if (editErrors.detail) {
                        setEditErrors({ ...editErrors, detail: '' });
                      }
                    }}
                    className={`w-full mt-1 px-3 py-2 rounded-2xl border ${editErrors.detail ? 'border-red-500' : ''}`}
                  >
                    {editingAvailableDetailOptions.length > 0 ? (
                      editingAvailableDetailOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        -
                      </option>
                    )}
                  </select>
                </div>

                <div className="text-sm">
                  <div className="font-medium">Usage</div>
                  <div className="mt-1 flex items-center gap-2">
                    {['PVE', 'PVP'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                        setEditUsageSelection((current) => ({
                          ...current,
                          [label]: !current[label],
                        }));
                      }}
                        className={`px-3 py-2 rounded-2xl border text-sm font-medium ${
                          label === 'PVE'
                            ? editUsageSelection[label]
                              ? 'bg-sky-200 text-sky-900 border-sky-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                            : editUsageSelection[label]
                              ? 'bg-rose-200 text-rose-900 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="font-medium">Priority</div>
                  <div className="mt-1">
                    <PriorityBadge
                      priority={editPriority}
                      onClick={() => setEditPriority((current) => cyclePriority(current))}
                      className="w-9 h-9"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editingRow.done}
                    onChange={(event) => {
                      setEditingRow((current) => ({ ...current, done: event.target.checked }));
                    }}
                  />
                  Completed
                </label>

                {editErrors.detail && (
                  <p className="text-red-500 text-xs">{editErrors.detail}</p>
                )}
                {editErrors.general && (
                  <div className="px-3 py-2 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-sm">
                    {editErrors.general}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditRow}
                    className="flex-1 px-4 py-2 rounded-2xl border cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mff-save-button flex-1 px-4 py-2 rounded-2xl font-medium cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
            <div className="mff-mode-pill inline-flex items-center gap-1">
            {['PVE', 'PVP'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setUsageFilter((current) => ({
                    ...current,
                    [label]: !current[label],
                  }));
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  label === 'PVE'
                    ? usageFilter[label]
                      ? 'bg-sky-200 text-sky-900'
                      : 'bg-slate-100 text-slate-600'
                    : usageFilter[label]
                      ? 'bg-rose-200 text-rose-900'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pb-2 text-center text-[11px] text-slate-400">
          Built by Jeongmin Lee with Codex. Thanks to the Marvel Future Fight community and thanosvibs.money.
        </div>
      </div>
    </div>
  );
}
