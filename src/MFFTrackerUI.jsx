import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CharacterIcon, CharacterOriginBadge, CharacterAcquisitionBadge, CharacterUpgradeBadges, CharacterUsageBadge, PriorityBadge, CTPPriorityBadge, getCharacterUniformOverride } from './CharacterComponents';
import CtpPicker from './CtpPicker';
import ArtifactPicker from './ArtifactPicker';
import { CTP_ICON_BY_TYPE } from './iconAssets';
import {
  CHARACTER_ARTIFACT_OVERRIDES_KEY,
  createDefaultArtifactState,
  loadCharacterArtifactOverrides,
  normalizeArtifactState,
} from './artifactUtils';
import {
  CTP_RARITY_OPTIONS,
  normalizeCtpSelection,
} from './ctpStateUtils';
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
  getCharacterEntry,
  getAcquisitionType,
  characterMatchesQuery,
  getUsageSelectionLabel,
  getUsageTypeFromSelection,
  normalizeUsageSelection,
  normalizeUsageType,
  normalizeCtpType,
  normalizePriority,
  cyclePriority,
  getCharacterDisplayName,
  isOldUniformDetail,
} from './mffTrackerUtils';
import {
  APP_LANGUAGE_KEY,
  CATEGORY_LABELS,
  DETAIL_LABELS,
  ORIGIN_LABELS,
  ACQUISITION_LABELS,
  UPGRADE_LABELS,
  USAGE_LABELS,
  CTP_LABELS,
  LANGUAGE_TOGGLE_LABELS,
  getUiText,
  translateValue,
  formatCountLabel,
} from './i18n';
import { characterNames } from './characterData';
import { loadImageCached } from './iconUtils';

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
const SHOW_ARTIFACT_KEY = 'mff_tracker_show_artifact_v1';
const SHOW_CTP_KEY = 'mff_tracker_show_ctp_v1';
const CHARACTER_CTP_OVERRIDES_KEY = 'mff_tracker_character_ctp_overrides_v2';
const LEGACY_CHARACTER_CTP_OVERRIDES_KEY = 'mff_tracker_character_ctp_overrides_v1';
const CHARACTER_CTP_PRIORITY_OVERRIDES_KEY = 'mff_tracker_character_ctp_priority_overrides_v1';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function CachedIcon({ src, alt = '', className = 'w-4 h-4 shrink-0' }) {
  useEffect(() => {
    if (!src) return;
    loadImageCached(src).catch(() => {
      // ignore cache population errors
    });
  }, [src]);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}

function normalizeLoadedRow(row) {
  if (!isPlainObject(row)) return null;

  const { ctp, uniformNumber, ...rest } = row || {};
  return {
    id: Number.isInteger(Number(rest.id)) ? Number(rest.id) : 0,
    character: sanitizeText(rest.character),
    category: sanitizeText(rest.category),
    detail:
      sanitizeText(rest.category) === '유니폼 필요' && sanitizeText(rest.detail) === '일반'
        ? '상시 판매'
        : sanitizeText(rest.detail),
    done: !!rest.done,
    priority: normalizePriority(rest.priority),
    usageType: normalizeUsageType(rest.usageType),
    uniformNumber: Number.isInteger(Number(uniformNumber)) && Number(uniformNumber) > 0 ? Number(uniformNumber) : 0,
  };
}

function normalizeImportedRow(row) {
  return normalizeLoadedRow(row);
}

function isExportPayload(value) {
  return isPlainObject(value) && Array.isArray(value.rows);
}

function getCharacterOverrideSubset(overrides, characters) {
  return Object.fromEntries(
    characters
      .filter((character) => Object.prototype.hasOwnProperty.call(overrides, character))
      .map((character) => [character, overrides[character]])
  );
}

function buildExportPayload(rows, ctpOverrides, ctpPriorityOverrides, artifactOverrides) {
  const characters = Array.from(new Set(rows.map((row) => row.character)));

  return {
    version: 2,
    rows,
    characterOverrides: {
      ctp: getCharacterOverrideSubset(ctpOverrides, characters),
      ctpPriority: getCharacterOverrideSubset(ctpPriorityOverrides, characters),
      artifact: getCharacterOverrideSubset(artifactOverrides, characters),
    },
  };
}

function parseImportPayload(parsed) {
  if (Array.isArray(parsed)) {
    return { rows: parsed, characterOverrides: null };
  }

  if (!isExportPayload(parsed)) {
    return null;
  }

  return {
    rows: parsed.rows,
    characterOverrides: {
      ctp: normalizeImportedCtpOverrides(parsed.characterOverrides?.ctp),
      ctpPriority: normalizeImportedCtpPriorityOverrides(parsed.characterOverrides?.ctpPriority),
      artifact: normalizeImportedArtifactOverrides(parsed.characterOverrides?.artifact),
    },
  };
}

function normalizeCharacterOverrideMap(map, normalizer) {
  if (!isPlainObject(map)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(map).map(([name, value]) => [name, normalizer(value)])
  );
}

function normalizeImportedArtifactOverrides(map) {
  return normalizeCharacterOverrideMap(map, normalizeArtifactState);
}

function normalizeImportedCtpOverrides(map) {
  return normalizeCharacterOverrideMap(map, normalizeCtpSelection);
}

function normalizeImportedCtpPriorityOverrides(map) {
  return normalizeCharacterOverrideMap(map, normalizePriority);
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
    const saved =
      window.localStorage.getItem(CHARACTER_CTP_OVERRIDES_KEY) ??
      window.localStorage.getItem(LEGACY_CHARACTER_CTP_OVERRIDES_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!isPlainObject(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, normalizeCtpSelection(value)])
    );
  } catch {
    return {};
  }
}

function loadCharacterCtpPriorityOverrides() {
  try {
    const saved = window.localStorage.getItem(CHARACTER_CTP_PRIORITY_OVERRIDES_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!isPlainObject(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, normalizePriority(value)])
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

export default function MFFTrackerUI({
  bootstrapStatus = { phase: 'hidden', loaded: 0, total: 0 },
  onRefreshBootstrap = () => {},
}) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLanguage] = useState(() => {
    try {
      const saved = window.localStorage.getItem(APP_LANGUAGE_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch {
      // ignore storage errors
    }

    return 'ko';
  });
  const [usageFilterMode, setUsageFilterMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem(USAGE_FILTER_KEY);
      if (!saved) return 'PVE';

      const parsed = JSON.parse(saved);
      if (parsed === 'PVE' || parsed === 'PVP' || parsed === 'All') {
        return parsed;
      }

      const normalized = normalizeUsageSelection(parsed);
      if (normalized.PVE && normalized.PVP) return 'All';
      if (normalized.PVP) return 'PVP';
      return 'PVE';
    } catch {
      return 'PVE';
    }
  });
  const [rows, setRows] = useState(() => loadRows());
  const [view, setView] = useState('character');
  const [nameQuery, setNameQuery] = useState('');
  const [showTrackingSearchAutocomplete, setShowTrackingSearchAutocomplete] = useState(false);
  const [trackingSearchIndex, setTrackingSearchIndex] = useState(0);
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [selectedAcquisitions, setSelectedAcquisitions] = useState([]);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [selectedCtps, setSelectedCtps] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDetails, setSelectedDetails] = useState([]);
  const [showDone, setShowDone] = useState(true);
  const [showArtifactDetails, setShowArtifactDetails] = useState(() => {
    try {
      const saved = window.localStorage.getItem(SHOW_ARTIFACT_KEY);
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const [showCtpDetails, setShowCtpDetails] = useState(() => {
    try {
      const saved = window.localStorage.getItem(SHOW_CTP_KEY);
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const [minimumPriorityFilter, setMinimumPriorityFilter] = useState(1);
  const [characterSort, setCharacterSort] = useState('lastAdded');
  const [characterSortDirection, setCharacterSortDirection] = useState('asc');
  const [rosterSort, setRosterSort] = useState('name');
  const [rosterSortDirection, setRosterSortDirection] = useState('asc');
  const [entryUsageSelection, setEntryUsageSelection] = useState(normalizeUsageSelection({ PVE: true, PVP: false }));
  const [formUniformNumber, setFormUniformNumber] = useState(0);
  const [form, setForm] = useState({
    character: '',
    category: '유니폼 필요',
    detail: '상시 판매',
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
  const [characterArtifactOverrides, setCharacterArtifactOverrides] = useState(() => loadCharacterArtifactOverrides());
  const [editErrors, setEditErrors] = useState({
    detail: '',
    general: '',
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [transferNotice, setTransferNotice] = useState(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showRightDock, setShowRightDock] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferDialogKind, setTransferDialogKind] = useState(null);
  const [importMode, setImportMode] = useState('merge');
  const [pendingImportMode, setPendingImportMode] = useState('merge');
  const [exportDoneMode, setExportDoneMode] = useState('asIs');
  const [exportSearchQuery, setExportSearchQuery] = useState('');
  const [exportDeselectedRowIds, setExportDeselectedRowIds] = useState([]);
  const [draggingRowId, setDraggingRowId] = useState(null);
  const [dragTargetGroupKey, setDragTargetGroupKey] = useState('');

  const importFileRef = useRef(null);
  const characterDropdownItemRefs = useRef([]);
  const rightDockHideTimerRef = useRef(null);
  const addDrawerRef = useRef(null);
  const filtersDrawerRef = useRef(null);
  const addDockButtonRef = useRef(null);
  const filtersDockButtonRef = useRef(null);
  const [characterCtpPriorityOverrides, setCharacterCtpPriorityOverrides] = useState(() => loadCharacterCtpPriorityOverrides());
  const exportDeselectedRowIdSet = useMemo(() => new Set(exportDeselectedRowIds), [exportDeselectedRowIds]);
  const isRowExportSelected = (rowId) => !exportDeselectedRowIdSet.has(rowId);
  const exportFilteredRows = useMemo(
    () =>
      rows.filter((row) =>
        characterMatchesQuery(row.character, exportSearchQuery)
      ),
    [rows, exportSearchQuery]
  );
  const exportRowsByCharacter = useMemo(() => groupRowsByCharacter(exportFilteredRows), [exportFilteredRows]);
  const selectedExportRows = useMemo(
    () => rows.filter((row) => !exportDeselectedRowIdSet.has(row.id)),
    [rows, exportDeselectedRowIdSet]
  );
  const selectedExportRowCount = selectedExportRows.length;
  const usageFilterSelection = useMemo(() => {
    if (usageFilterMode === 'PVP') {
      return normalizeUsageSelection({ PVE: false, PVP: true });
    }

    if (usageFilterMode === 'All') {
      return normalizeUsageSelection({ PVE: true, PVP: true });
    }

    return normalizeUsageSelection({ PVE: true, PVP: false });
  }, [usageFilterMode]);
  const trackingSearchSuggestions = useMemo(() => {
    const query = nameQuery.trim();
    if (!query) return [];

    return characterNames
      .filter((character) => characterMatchesQuery(character, query))
      .sort((a, b) =>
        getCharacterDisplayName(a, language).localeCompare(
          getCharacterDisplayName(b, language),
          language === 'en' ? 'en' : 'ko'
        )
      )
      .slice(0, 8);
  }, [nameQuery, language]);

  useEffect(() => {
    if (!transferNotice) return undefined;

    const timer = window.setTimeout(() => {
      setTransferNotice(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [transferNotice]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_ARTIFACT_KEY, String(showArtifactDetails));
    } catch {
      // ignore storage errors
    }
  }, [showArtifactDetails]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_CTP_KEY, String(showCtpDetails));
    } catch {
      // ignore storage errors
    }
  }, [showCtpDetails]);

  const openAddEntryDrawer = (character = '') => {
    if (!character) {
      setForm({ character: '', category: '유니폼 필요', detail: '상시 판매' });
      setErrors({ character: '', detail: '', general: '' });
      setEntryUsageSelection(normalizeUsageSelection({ PVE: true, PVP: false }));
      setFormUniformNumber(0);
      setFilteredCharacters(characterNames);
      setShowCharacterDropdown(false);
      setCharacterDropdownIndex(0);
    }

    setShowFiltersDrawer(false);
    setShowAddDrawer(true);
    setShowRightDock(true);
    if (character) {
      setForm((prev) => ({
        ...prev,
        character,
      }));
      setErrors((prev) => ({ ...prev, character: '' }));
    }
  };

  const openTransferDialog = (kind) => {
    setTransferDialogKind(kind);
    setShowTransferDialog(true);
    setShowAddDrawer(false);
    setShowFiltersDrawer(false);
    setShowRightDock(true);
    if (kind === 'import') {
      setImportMode('merge');
      setPendingImportMode('merge');
    } else if (kind === 'export') {
      setExportDoneMode('asIs');
      setExportSearchQuery('');
    }
  };

  const shouldShowArtifactControls = showArtifactDetails;
  const shouldShowCtpControls = showCtpDetails;

  const closeTransferDialog = () => {
    setShowTransferDialog(false);
    setTransferDialogKind(null);
  };

  const setExportRowSelected = (rowId, selected) => {
    setExportDeselectedRowIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return Array.from(next);
    });
  };

  const setExportCharacterSelected = (character, selected) => {
    setExportDeselectedRowIds((current) => {
      const next = new Set(current);
      rows
        .filter((row) => row.character === character)
        .forEach((row) => {
          if (selected) {
            next.delete(row.id);
          } else {
            next.add(row.id);
          }
        });
      return Array.from(next);
    });
  };

  const selectAllExportRows = (targetRows) => {
    setExportDeselectedRowIds((current) => {
      const next = new Set(current);
      targetRows.forEach((row) => next.delete(row.id));
      return Array.from(next);
    });
  };

  const clearAllExportRows = (targetRows) => {
    setExportDeselectedRowIds((current) => {
      const next = new Set(current);
      targetRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  };

  const openRightDock = () => {
    if (rightDockHideTimerRef.current) {
      window.clearTimeout(rightDockHideTimerRef.current);
      rightDockHideTimerRef.current = null;
    }
    setShowRightDock(true);
  };

  const closeRightDockSoon = () => {
    if (rightDockHideTimerRef.current) {
      window.clearTimeout(rightDockHideTimerRef.current);
    }

    rightDockHideTimerRef.current = window.setTimeout(() => {
      setShowRightDock(false);
      rightDockHideTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    const updateRightDockFromPointer = (event) => {
      if (typeof window === 'undefined') return;

      const threshold = window.innerWidth * 0.85;
      if (event.clientX >= threshold) {
        openRightDock();
      } else if (!showAddDrawer && !showFiltersDrawer) {
        closeRightDockSoon();
      }
    };

    window.addEventListener('mousemove', updateRightDockFromPointer, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateRightDockFromPointer);
    };
  }, [showAddDrawer, showFiltersDrawer]);

  useEffect(() => {
    return () => {
      if (rightDockHideTimerRef.current) {
        window.clearTimeout(rightDockHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showAddDrawer && !showFiltersDrawer) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      const dockRefs = [addDrawerRef, filtersDrawerRef, addDockButtonRef, filtersDockButtonRef];
      const clickedInsideDock =
        dockRefs.some((ref) => ref.current && ref.current.contains(target)) ||
        (target instanceof Element && target.closest('.mff-uniform-menu'));

      if (clickedInsideDock) {
        return;
      }

      setShowAddDrawer(false);
      setShowFiltersDrawer(false);
      setShowRightDock(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [showAddDrawer, showFiltersDrawer]);

  const getCharacterCtp = (character) => {
    if (Object.prototype.hasOwnProperty.call(characterCtpOverrides, character)) {
      return normalizeCtpSelection(characterCtpOverrides[character]);
    }

    return normalizeCtpSelection(getCharacterEntry(character)?.ctp);
  };

  const updateCharacterCtp = (character, ctp) => {
    const currentCtp = getCharacterCtp(character);
    const nextCtp = typeof ctp === 'function' ? ctp(currentCtp) : ctp;
    setCharacterCtpOverrides((current) => ({
      ...current,
      [character]: normalizeCtpSelection(nextCtp),
    }));
  };

  const getCharacterCtpPriority = (character) => {
    if (Object.prototype.hasOwnProperty.call(characterCtpPriorityOverrides, character)) {
      return normalizePriority(characterCtpPriorityOverrides[character]);
    }

    return 1;
  };

  const cycleCharacterCtpPriority = (character) => {
    setCharacterCtpPriorityOverrides((current) => ({
      ...current,
      [character]: cyclePriority(current[character]),
    }));
  };

  const getCharacterArtifact = (character) => {
    if (Object.prototype.hasOwnProperty.call(characterArtifactOverrides, character)) {
      return normalizeArtifactState(characterArtifactOverrides[character]);
    }

    return createDefaultArtifactState();
  };

  const updateCharacterArtifact = (character, nextArtifactState) => {
    const currentArtifact = getCharacterArtifact(character);
    const nextState =
      typeof nextArtifactState === 'function'
        ? nextArtifactState(currentArtifact)
        : nextArtifactState;

    setCharacterArtifactOverrides((current) => ({
      ...current,
      [character]: normalizeArtifactState(nextState),
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
  const formSelectedUniformNumber = formUniformNumber;

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
    setFormUniformNumber(0);
    setShowCharacterDropdown(false);
    setCharacterDropdownIndex(0);
    if (errors.character) {
      setErrors({ ...errors, character: '' });
    }
  };

  const selectTrackingSearchSuggestion = (name) => {
    setNameQuery(getCharacterDisplayName(name, language));
    setShowTrackingSearchAutocomplete(false);
    setTrackingSearchIndex(0);
  };

  const resetAddEntryForm = () => {
    setForm({ character: '', category: '유니폼 필요', detail: '상시 판매' });
    setErrors({ character: '', detail: '', general: '' });
    setEntryUsageSelection(normalizeUsageSelection({ PVE: true, PVP: false }));
    setFormUniformNumber(0);
    setFilteredCharacters(characterNames);
    setShowCharacterDropdown(false);
    setCharacterDropdownIndex(0);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // ignore storage errors
    }
  }, [rows]);

  useEffect(() => {
    setExportDeselectedRowIds((current) => {
      if (!current.length) return current;
      const rowIdSet = new Set(rows.map((row) => row.id));
      const next = current.filter((id) => rowIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [rows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(USAGE_FILTER_KEY, JSON.stringify(usageFilterMode));
    } catch {
      // ignore storage errors
    }
  }, [usageFilterMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHARACTER_CTP_OVERRIDES_KEY, JSON.stringify(characterCtpOverrides));
    } catch {
      // ignore storage errors
    }
  }, [characterCtpOverrides]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHARACTER_ARTIFACT_OVERRIDES_KEY, JSON.stringify(characterArtifactOverrides));
    } catch {
      // ignore storage errors
    }
  }, [characterArtifactOverrides]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHARACTER_CTP_PRIORITY_OVERRIDES_KEY,
        JSON.stringify(characterCtpPriorityOverrides)
      );
    } catch {
      // ignore storage errors
    }
  }, [characterCtpPriorityOverrides]);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_LANGUAGE_KEY, language);
    } catch {
      // ignore storage errors
    }

    document.documentElement.lang = language === 'en' ? 'en' : 'ko';
  }, [language]);
  
  const t = (key) => getUiText(language, key);

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

    const detailOrder = new Map(DETAIL_OPTIONS['성장 필요'].map((detail, index) => [detail, index]));

    return Array.from(map.entries()).map(([category, detailSet]) => ({
      category,
      details: Array.from(detailSet).sort((a, b) => {
        if (category === '성장 필요') {
          const aRank = detailOrder.has(a) ? detailOrder.get(a) : Number.MAX_SAFE_INTEGER;
          const bRank = detailOrder.has(b) ? detailOrder.get(b) : Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
        }

        return a.localeCompare(b, 'ko');
      }),
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
      usageFilterSelection,
      '전체',
      showDone
    );
  }, [rows, nameQuery, usageFilterSelection, showDone]);

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
        ? normalizeCtpSelection(characterCtpOverrides[row.character]).type
        : normalizeCtpSelection(entry?.ctp).type;
      const rowDetailKey = makeDetailKey(row.category, row.detail);

      const matchesOrigin = originSet.size === 0 || originSet.has(entry?.originType || '');
      const matchesAcquisition = acquisitionSet.size === 0 || acquisitionSet.has(getAcquisitionType(entry));
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
        label: `${t('search')}: ${nameQuery.trim()}`,
        clear: () => setNameQuery(''),
      });
    }

    selectedOrigins.forEach((origin) => {
      chips.push({
        label: `${t('origin')}: ${translateValue(language, ORIGIN_LABELS, origin)}`,
        clear: () => setSelectedOrigins((current) => current.filter((item) => item !== origin)),
      });
    });

    selectedAcquisitions.forEach((acquisition) => {
      chips.push({
        label: `${t('acquisition')}: ${translateValue(language, ACQUISITION_LABELS, acquisition)}`,
        clear: () => setSelectedAcquisitions((current) => current.filter((item) => item !== acquisition)),
      });
    });

    selectedUpgrades.forEach((upgrade) => {
      chips.push({
        label: `${t('maxTier')}: ${translateValue(language, UPGRADE_LABELS, upgrade)}`,
        clear: () => setSelectedUpgrades((current) => current.filter((item) => item !== upgrade)),
      });
    });

    const usageLabel = getUsageSelectionLabel(usageFilterSelection);
    if (usageLabel !== 'All') {
      chips.push({
        label: `${t('usage')}: ${translateValue(language, USAGE_LABELS, usageLabel)}`,
        clear: () => setUsageFilterMode('All'),
      });
    }

    chips.push({
      label: `${t('priority')}: ${'!'.repeat(minimumPriorityFilter)}`,
      clear: () => setMinimumPriorityFilter(1),
    });

    selectedCtps.forEach((ctp) => {
      chips.push({
        label: `${t('ctp')}: ${translateValue(language, CTP_LABELS, ctp)}`,
        clear: () => setSelectedCtps((current) => current.filter((item) => item !== ctp)),
        icon: CTP_ICON_BY_TYPE[ctp] || '',
        title: ctp,
      });
    });

    selectedCategories.forEach((category) => {
      chips.push({
        label: `${t('category')}: ${translateValue(language, CATEGORY_LABELS, category)}`,
        clear: () => setSelectedCategories((current) => current.filter((item) => item !== category)),
      });
    });

    selectedDetails.forEach((detailKey) => {
      const [category, detail] = detailKey.split('__');
      chips.push({
        label: `${t('detail')}: ${translateValue(language, CATEGORY_LABELS, category)} / ${translateValue(language, DETAIL_LABELS, detail)}`,
        clear: () => setSelectedDetails((current) => current.filter((item) => item !== detailKey)),
      });
    });

    return chips;
  }, [
    nameQuery,
    selectedOrigins,
    selectedAcquisitions,
    selectedUpgrades,
    usageFilterSelection,
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
      newErrors.character = t('requiredField');
    } else if (!getCharacterEntry(character)) {
      newErrors.character = t('invalidCharacterName');
    }

    if (category === '성장 필요' && availableDetailOptions.length === 0) {
      newErrors.detail = t('noGrowthOptions');
    } else if (category === '유니폼 필요' && detail === '구유니폼' && formSelectedUniformNumber <= 0) {
      newErrors.detail = t('requiredField');
    } else if (category !== '획득 필요' && !isDetailValidForCategory(category, character, detail)) {
      newErrors.detail = t('requiredField');
    }

    const normalizedDetail = category === '획득 필요' ? '' : detail;
    const isDuplicate = rows.some(row =>
      row.character === character &&
      row.category === category &&
      row.detail === normalizedDetail
    );

    if (isDuplicate) {
      newErrors.general = t('duplicateEntry');
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
        uniformNumber: category === '유니폼 필요' && detail === '구유니폼' ? formSelectedUniformNumber : 0,
      },
    ]);

    setSuccessMessage(t('entryAdded'));

    setForm((prev) => {
      const nextOptions = DETAIL_OPTIONS[prev.category] || [];
      return {
        character: prev.character, // Keep character for convenience
        category: prev.category,
        detail: nextOptions[0] || '',
      };
    });

    setEntryUsageSelection(normalizeUsageSelection({ PVE: true, PVP: false }));
    setFormUniformNumber(0);
  }

  function openEditRow(row) {
    setEditingRow({ ...row });
    setEditUsageSelection(
      normalizeUsageSelection({
        PVE: normalizeUsageType(row.usageType) !== 'PVP',
        PVP: normalizeUsageType(row.usageType) === 'PVP',
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
      newErrors.detail = t('noGrowthOptions');
    } else if (editingRow.category !== '획득 필요' && !isDetailValidForCategory(editingRow.category, editingRow.character, nextDetail)) {
      newErrors.detail = t('requiredField');
    }

    const normalizedDetail = editingRow.category === '획득 필요' ? '' : nextDetail;
    const isDuplicate = rows.some((row) =>
      row.id !== editingRow.id &&
      row.character === editingRow.character &&
      row.category === editingRow.category &&
      row.detail === normalizedDetail
    );

    if (isDuplicate) {
      newErrors.general = t('duplicateEntry');
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

    setSuccessMessage(t('entryUpdated'));
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

  function updateRowUniformNumber(id, uniformNumber) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, uniformNumber: Number.isInteger(uniformNumber) && uniformNumber > 0 ? uniformNumber : 0 }
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

  function getRowSignature(row) {
    return [row.character || '', row.category || '', row.detail || ''].join('||');
  }

  function exportFile(forceIncomplete = false) {
    const exportRows = selectedExportRows.map((row) => (forceIncomplete ? { ...row, done: false } : row));
    const payload = buildExportPayload(
      exportRows,
      characterCtpOverrides,
      characterCtpPriorityOverrides,
      characterArtifactOverrides
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mff_tracker.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setTransferNotice({ kind: 'success', text: t('exportDone') });
  }

  function resetAll() {
    setRows([]);
    setExportDeselectedRowIds([]);
    setNameQuery('');
    setSelectedOrigins([]);
    setSelectedAcquisitions([]);
    setSelectedUpgrades([]);
    setSelectedCtps([]);
      setUsageFilterMode('PVE');
    setSelectedCategories([]);
    setSelectedDetails([]);
    setShowDone(true);
    setMinimumPriorityFilter(1);
    setEntryUsageSelection(normalizeUsageSelection({ PVE: true, PVP: false }));
    setForm({ character: '', category: '유니폼 필요', detail: '상시 판매' });
    setShowResetConfirm(false);
    setExportSearchQuery('');
    setCharacterCtpOverrides({});
    setCharacterArtifactOverrides({});
    setCharacterCtpPriorityOverrides({});

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      Object.values(LEGACY_STORAGE_KEYS_BY_MODE).forEach((key) => {
        window.localStorage.removeItem(key);
      });
      window.localStorage.removeItem(CHARACTER_CTP_OVERRIDES_KEY);
      window.localStorage.removeItem(LEGACY_CHARACTER_CTP_OVERRIDES_KEY);
      window.localStorage.removeItem(CHARACTER_ARTIFACT_OVERRIDES_KEY);
      window.localStorage.removeItem(CHARACTER_CTP_PRIORITY_OVERRIDES_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const text = loadEvent.target?.result;
        const parsed = JSON.parse(text);

        const payload = parseImportPayload(parsed);
        const rawRows = payload?.rows || null;

        if (!rawRows) {
          window.alert(t('jsonExpectedArray'));
          return;
        }

        if (rawRows.length > 5000) {
          window.alert(t('jsonTooManyRows'));
          return;
        }

        const isValid = rawRows.every((row) => {
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
          window.alert(t('jsonInvalidFormat'));
          return;
        }

        const normalizedRows = rawRows.map(normalizeImportedRow).filter(Boolean);
        const validRows = normalizedRows.filter((row) => {
          if (!getCharacterEntry(row.character)) {
            return false;
          }

          if (row.category === '획득 필요') {
            return true;
          }

          return isDetailValidForCategory(row.category, row.character, row.detail);
        });

        const importedArtifactOverrides = payload?.characterOverrides?.artifact || {};
        const importedCtpOverrides = payload?.characterOverrides?.ctp || {};
        const importedCtpPriorityOverrides = payload?.characterOverrides?.ctpPriority || {};

        if (Object.keys(importedArtifactOverrides).length > 0) {
          setCharacterArtifactOverrides((current) => ({
            ...current,
            ...importedArtifactOverrides,
          }));
        }

        if (Object.keys(importedCtpOverrides).length > 0) {
          setCharacterCtpOverrides((current) => ({
            ...current,
            ...importedCtpOverrides,
          }));
        }

        if (Object.keys(importedCtpPriorityOverrides).length > 0) {
          setCharacterCtpPriorityOverrides((current) => ({
            ...current,
            ...importedCtpPriorityOverrides,
          }));
        }

        if (pendingImportMode === 'replace') {
          setRows(validRows);
          setExportDeselectedRowIds([]);
          setTransferNotice({ kind: 'success', text: t('importDone') });
        } else {
          const existingSignatures = new Set(rows.map(getRowSignature));
          let skippedCount = normalizedRows.length - validRows.length;
          const mergedRows = [...rows];

          validRows.forEach((row) => {
            const signature = getRowSignature(row);
            if (existingSignatures.has(signature)) {
              skippedCount += 1;
              return;
            }

            mergedRows.push({
              ...row,
              id: getNextId(mergedRows),
            });
            existingSignatures.add(signature);
          });

          setRows(mergedRows);
          setTransferNotice(
            skippedCount > 0
              ? { kind: 'warning', text: t('importMergeWarning') }
              : { kind: 'success', text: t('importDone') }
          );
        }
        setShowResetConfirm(false);
      } catch {
        window.alert(t('jsonFailed'));
      } finally {
        event.target.value = '';
        closeTransferDialog();
      }
    };

    reader.readAsText(file);
  }
  return (
    <div className={`mff-app ${theme === 'dark' ? 'mff-theme-dark' : 'mff-theme-light'} min-h-screen p-6`}>
      <input
        ref={importFileRef}
        type="file"
        accept="application/json"
        onChange={handleImportFile}
        className="hidden"
      />
      <div className="max-w-7xl mx-auto space-y-6 pb-24">
          <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-sm text-slate-600 mt-1">
                {t('subtitle')}
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
                type="button"
                onClick={() => setLanguage((current) => (current === 'ko' ? 'en' : 'ko'))}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-sm font-semibold ${
                  theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                }`}
                title={language === 'ko' ? 'English' : '한국어'}
                aria-label={language === 'ko' ? 'Switch to English' : 'Switch to Korean'}
              >
                {LANGUAGE_TOGGLE_LABELS[language]}
              </button>
              <button
                onClick={() => setView('character')}
                className={`px-4 py-2 rounded-2xl border transition-colors duration-150 ${
                  view === 'character'
                    ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('characterView')}
              </button>
              <button
                onClick={() => setView('roster')}
                className={`px-4 py-2 rounded-2xl border transition-colors duration-150 ${
                  view === 'roster'
                    ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('characterList')}
              </button>
              <button
                onClick={() => setView('category')}
                className={`px-4 py-2 rounded-2xl border transition-colors duration-150 ${
                  view === 'category'
                    ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('categoryView')}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          ref={filtersDockButtonRef}
          onClick={() => {
            setShowAddDrawer(false);
            setShowFiltersDrawer(true);
          }}
          onMouseEnter={openRightDock}
          onMouseLeave={closeRightDockSoon}
          aria-hidden={showFiltersDrawer}
          tabIndex={showFiltersDrawer ? -1 : 0}
          className={`fixed right-0 top-[40%] z-[80] -translate-y-1/2 w-36 justify-center rounded-l-2xl border border-r-0 bg-white px-5 py-3 shadow-xl text-base font-semibold transition-all duration-200 ease-out ${
            showRightDock && !showAddDrawer && !showFiltersDrawer
              ? 'pointer-events-auto opacity-100 translate-x-0'
              : 'pointer-events-none opacity-80 translate-x-[78%]'
          }`}
        >
          {t('filters')}
        </button>

        <button
          type="button"
          ref={addDockButtonRef}
          onClick={() => {
            openAddEntryDrawer();
          }}
          onMouseEnter={openRightDock}
          onMouseLeave={closeRightDockSoon}
          aria-hidden={showAddDrawer}
          tabIndex={showAddDrawer ? -1 : 0}
          className={`fixed right-0 top-[33%] z-[80] -translate-y-1/2 w-36 justify-center rounded-l-2xl border border-r-0 bg-white px-5 py-3 shadow-xl text-base font-semibold transition-all duration-200 ease-out ${
            showRightDock && !showAddDrawer && !showFiltersDrawer
              ? 'pointer-events-auto opacity-100 translate-x-0'
              : 'pointer-events-none opacity-80 translate-x-[78%]'
          }`}
        >
          {t('addEntry')}
        </button>

        <div
          ref={addDrawerRef}
          onMouseEnter={openRightDock}
          className={`fixed right-4 top-1/2 z-[80] w-[28rem] max-w-[80vw] -translate-y-1/2 rounded-3xl border bg-white shadow-2xl p-5 space-y-4 transition-all duration-200 ${
            showAddDrawer
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{t('addEntry')}</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {['PVE', 'PVP'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setEntryUsageSelection((current) => {
                        const nextValue =
                          label === 'PVE'
                            ? current.PVE
                              ? { PVE: false, PVP: true }
                              : { PVE: true, PVP: false }
                            : current.PVP
                              ? { PVE: true, PVP: false }
                              : { PVE: false, PVP: true };

                        return normalizeUsageSelection(nextValue);
                      });
                    }}
                    aria-pressed={!!entryUsageSelection[label]}
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
              <button
                type="button"
                onClick={() => {
                  setShowAddDrawer(false);
                  setShowRightDock(false);
                }}
                className="text-sm px-3 py-1.5 rounded-full border bg-slate-100 text-slate-700"
              >
                {t('close')}
              </button>
            </div>
          </div>
          <form onSubmit={addRow} className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t('character')}</label>
                    <div className="relative flex items-center gap-2">
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
                    setTimeout(() => setShowCharacterDropdown(false), 150);
                  }}
                  placeholder={t('search')}
                  className={`flex-1 mt-1 px-3 py-2 rounded-2xl border ${
                    errors.character ? 'border-red-500' : ''
                  }`}
                />
                {form.character && selectedCharacterEntry && (
                  <div className="ml-2 mt-1 flex items-center gap-2">
                    <CharacterIcon name={form.character} preferLatest language={language} />
                    <span
                      className={`text-xs px-2 py-1 rounded-full border font-medium whitespace-nowrap ${
                        selectedCharacterRowCount > 0
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                      title={
                        selectedCharacterRowCount > 0
                          ? formatCountLabel(language, selectedCharacterRowCount)
                          : t('noEntries')
                      }
                    >
                      {selectedCharacterRowCount > 0
                        ? formatCountLabel(language, selectedCharacterRowCount)
                        : t('new')}
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
                        <CharacterIcon name={name} preferLatest language={language} />
                        <span>{getCharacterDisplayName(name, language)}</span>
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
              <label className="text-sm font-medium">{t('category')}</label>
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
                  if (nextCategory !== '유니폼 필요' || nextOptions[0] !== '구유니폼') {
                    setFormUniformNumber(0);
                  }
                }}
                className="w-full mt-1 px-3 py-2 rounded-2xl border"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {translateValue(language, CATEGORY_LABELS, option)}
                  </option>
                ))}
              </select>
            </div>
            {form.category !== '획득 필요' && (
              <div>
                <label className="text-sm font-medium">{t('detail')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={formDetailValue}
                    disabled={availableDetailOptions.length === 0}
                    onChange={(event) => {
                      setForm({ ...form, detail: event.target.value });
                      if (errors.detail) {
                        setErrors({ ...errors, detail: '' });
                      }
                      if (event.target.value !== '구유니폼') {
                        setFormUniformNumber(0);
                      }
                    }}
                    className={`flex-1 px-3 py-2 rounded-2xl border ${
                      errors.detail ? 'border-red-500' : ''
                    }`}
                  >
                    {availableDetailOptions.length > 0 ? (
                      availableDetailOptions.map((option) => (
                        <option key={option} value={option}>
                          {translateValue(language, DETAIL_LABELS, option)}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        -
                      </option>
                    )}
                  </select>
                  {form.category === '유니폼 필요' && formDetailValue === '구유니폼' ? (
                    <CharacterIcon
                      name={form.character}
                      preferLatest
                      language={language}
                      uniformSelectionNumber={formSelectedUniformNumber}
                      onUniformSelect={setFormUniformNumber}
                      keepOpenOnSelect
                    />
                  ) : null}
                </div>

                {errors.detail && (
                  <p className="text-red-500 text-xs mt-1">{errors.detail}</p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button className="mff-add-button flex-1 px-4 py-2 rounded-2xl font-medium cursor-pointer">
                {t('addEntry')}
              </button>
              <button
                type="button"
                onClick={resetAddEntryForm}
                className="px-4 py-2 rounded-2xl border bg-slate-100 text-slate-700 cursor-pointer"
              >
                {t('reset')}
              </button>
            </div>
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

        <div
          ref={filtersDrawerRef}
          onMouseEnter={openRightDock}
          className={`fixed right-4 top-1/2 z-[80] w-80 max-w-[80vw] -translate-y-1/2 rounded-3xl border bg-white shadow-2xl p-5 space-y-4 transition-all duration-200 ${
            showFiltersDrawer
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{t('filters')}</h2>
            <button
              type="button"
              onClick={() => setShowFiltersDrawer(false)}
              className="text-sm px-3 py-1.5 rounded-full border bg-slate-100 text-slate-700"
            >
              {t('close')}
            </button>
          </div>

          <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">{t('origin')}</label>
                <button
                  type="button"
                  onClick={() => setSelectedOrigins([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {t('clear')}
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
                      {translateValue(language, ORIGIN_LABELS, option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">{t('acquisition')}</label>
                <button
                  type="button"
                  onClick={() => setSelectedAcquisitions([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {t('clear')}
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
                      {translateValue(language, ACQUISITION_LABELS, option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">{t('maxTier')}</label>
                <button
                  type="button"
                  onClick={() => setSelectedUpgrades([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {t('clear')}
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
                      {translateValue(language, UPGRADE_LABELS, option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">{t('ctp')}</label>
                <button
                  type="button"
                  onClick={() => setSelectedCtps([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {t('clear')}
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
                <label className="text-xs font-medium text-slate-500">{t('category')}</label>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    {t('clear')}
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
                          {translateValue(language, CATEGORY_LABELS, category)}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-500">{t('detail')}</label>
                  <button
                    type="button"
                    onClick={() => setSelectedDetails([])}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    {t('clear')}
                  </button>
                </div>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {(selectedCategories.length > 0
                    ? detailOptionsByCategory.filter((group) => selectedCategories.includes(group.category))
                    : detailOptionsByCategory
                  ).map((group) => (
                    <div key={group.category} className="space-y-2">
                      <div className="text-xs font-medium text-slate-500">
                        {translateValue(language, CATEGORY_LABELS, group.category)}
                      </div>
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
                              {translateValue(language, DETAIL_LABELS, detail)}
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
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border px-4 py-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showResetConfirm) {
                    resetAll();
                  } else {
                    setShowResetConfirm(true);
                  }
                }}
                className={`px-4 py-2 rounded-2xl border cursor-pointer ${
                  showResetConfirm ? 'border-red-300 bg-red-50 text-red-700' : ''
                }`}
              >
                {showResetConfirm ? t('resetConfirm') : t('reset')}
              </button>

              <button
                type="button"
                onClick={() => openTransferDialog('import')}
                className="px-4 py-2 rounded-2xl border cursor-pointer whitespace-nowrap"
              >
                {t('importFile').replace('\n', ' ')}
              </button>

              <button
                type="button"
                onClick={() => openTransferDialog('export')}
                className="px-4 py-2 rounded-2xl border cursor-pointer whitespace-nowrap"
              >
                {t('exportFile').replace('\n', ' ')}
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-2.5">
              {bootstrapStatus.phase === 'done' ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                    ✓
                  </span>
                  <span className="text-sm font-medium">{t('loadingIconsDone')}</span>
                </div>
              ) : bootstrapStatus.phase === 'loading' ? (
                <div className="min-w-[14rem] space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                    <span>{t('loadingIcons')}</span>
                    <span>
                      {bootstrapStatus.loaded} / {bootstrapStatus.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all duration-200"
                      style={{
                        width: `${bootstrapStatus.total > 0 ? Math.round((bootstrapStatus.loaded / bootstrapStatus.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={onRefreshBootstrap}
                className="px-3 py-2 rounded-xl border bg-white text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {t('refreshCache')}
              </button>
            </div>
          </div>

          {transferNotice && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                transferNotice.kind === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {transferNotice.text}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm border p-5">
              <div className="flex items-center justify-between gap-4 mb-4 flex-nowrap">
              <div className="flex items-center gap-3 min-w-0 flex-nowrap">
                <h2 className="text-xl font-semibold whitespace-nowrap">
                  {view === 'character'
                    ? t('groupedByCharacter')
                    : view === 'category'
                      ? t('groupedByCategory')
                      : t('characterList')}
                </h2>
                <PriorityBadge
                  priority={minimumPriorityFilter}
                  onClick={() => setMinimumPriorityFilter((current) => cyclePriority(current))}
                  className="w-9 h-9"
                  language={language}
                />
                <div className="relative flex-1 min-w-0 max-w-[28rem]">
                  <input
                    onFocus={() => {
                      if (nameQuery.trim()) {
                        setShowTrackingSearchAutocomplete(true);
                      }
                    }}
                    value={nameQuery}
                    onChange={(event) => {
                      setNameQuery(event.target.value);
                      setShowTrackingSearchAutocomplete(true);
                      setTrackingSearchIndex(0);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowTrackingSearchAutocomplete(false), 120);
                    }}
                    onKeyDown={(event) => {
                      if (!showTrackingSearchAutocomplete || trackingSearchSuggestions.length === 0) return;

                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setTrackingSearchIndex((current) => (current + 1) % trackingSearchSuggestions.length);
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setTrackingSearchIndex((current) => (current - 1 + trackingSearchSuggestions.length) % trackingSearchSuggestions.length);
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        const selected = trackingSearchSuggestions[trackingSearchIndex];
                        if (selected) {
                          selectTrackingSearchSuggestion(selected);
                        }
                      } else if (event.key === 'Escape') {
                        setShowTrackingSearchAutocomplete(false);
                      }
                    }}
                    placeholder={t('search')}
                    className="w-full pl-10 pr-10 py-2 rounded-2xl border"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {nameQuery.trim() && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        setNameQuery('');
                        setShowTrackingSearchAutocomplete(false);
                        setTrackingSearchIndex(0);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-full bg-transparent text-slate-500 hover:bg-slate-100 cursor-pointer"
                      aria-label={t('clear')}
                      title={t('clear')}
                    >
                      ×
                    </button>
                  )}
                  {showTrackingSearchAutocomplete && trackingSearchSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-white shadow-2xl z-40 overflow-hidden">
                      {trackingSearchSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectTrackingSearchSuggestion(suggestion);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm ${
                            index === trackingSearchIndex
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {getCharacterDisplayName(suggestion, language)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showArtifactDetails}
                      onChange={(event) => setShowArtifactDetails(event.target.checked)}
                    />
                    <span>{t('artifact')}</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCtpDetails}
                      onChange={(event) => setShowCtpDetails(event.target.checked)}
                    />
                    <span>{t('ctp')}</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showDone}
                    onChange={(event) => setShowDone(event.target.checked)}
                  />
                  {t('showCompletedEntries')}
                </label>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
                  {translateValue(language, USAGE_LABELS, getUsageSelectionLabel(usageFilterSelection))}
                </span>
                {view === 'character' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">{t('sortBy')}</span>
                    <select
                      value={['lastAdded', 'name', 'priority', 'completion', 'tasks'].includes(characterSort) ? characterSort : 'lastAdded'}
                      onChange={(e) => setCharacterSort(e.target.value)}
                      className="px-3 py-1 rounded-xl border text-sm"
                    >
                      <option value="lastAdded">{t('lastAdded')}</option>
                      <option value="name">{t('name')}</option>
                      <option value="priority">{t('priority')}</option>
                      <option value="completion">{t('completion')}</option>
                      <option value="tasks">{t('taskCount')}</option>
                    </select>
                      <button
                        type="button"
                        onClick={() => setCharacterSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                        className="w-9 h-9 rounded-xl border flex items-center justify-center text-sm"
                        title={characterSortDirection === 'desc' ? t('descending') : t('ascending')}
                        aria-label={characterSortDirection === 'desc' ? t('descending') : t('ascending')}
                      >
                        <span aria-hidden="true">{characterSortDirection === 'desc' ? '↓' : '↑'}</span>
                      </button>
                  </div>
                )}
                {view === 'roster' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">{t('sortBy')}</span>
                    <select
                      value={['lastAdded', 'name', 'priority', 'completion', 'tasks'].includes(rosterSort) ? rosterSort : 'name'}
                      onChange={(e) => setRosterSort(e.target.value)}
                      className="px-3 py-1 rounded-xl border text-sm"
                    >
                      <option value="lastAdded">{t('lastAdded')}</option>
                      <option value="name">{t('name')}</option>
                      <option value="priority">{t('priority')}</option>
                      <option value="completion">{t('completion')}</option>
                      <option value="tasks">{t('taskCount')}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setRosterSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                      className="w-9 h-9 rounded-xl border flex items-center justify-center text-sm"
                      title={rosterSortDirection === 'desc' ? t('descending') : t('ascending')}
                      aria-label={rosterSortDirection === 'desc' ? t('descending') : t('ascending')}
                    >
                      <span aria-hidden="true">{rosterSortDirection === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </div>
                )}
                <div className="text-sm text-slate-500">{formatCountLabel(language, priorityFilteredRows.length)}</div>
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
                  {chip.icon ? <CachedIcon src={chip.icon} alt="" className="w-4 h-4 shrink-0" /> : null}
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
                        <CharacterIcon name={quickAddCharacter} preferLatest language={language} />
                        <div className="text-lg font-semibold truncate">{getCharacterDisplayName(quickAddCharacter, language)}</div>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{t('noTrackedEntries')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        openAddEntryDrawer(quickAddCharacter);
                        setErrors({ character: '', detail: '', general: '' });
                      }}
                      className="px-4 py-2 rounded-2xl border bg-slate-900 text-white cursor-pointer"
                    >
                      {t('quickAdd')}
                    </button>
                  </div>
                )}
                {!displayedGroupedByCharacter.length && (!quickAddCharacter || hasTrackedEntryForQuickAddCharacter) && (
                      <div className="rounded-3xl border p-6 text-sm text-slate-600">
                        {t('noEntries')}
                      </div>
                )}
                {displayedGroupedByCharacter.map(([character, items]) => {
                  const characterCtp = getCharacterCtp(character);
                  const characterCtpType = characterCtp.type;
                  const characterArtifact = getCharacterArtifact(character);
                  const artifactEnabled = characterArtifact.enabled;
                  const artifactStar = characterArtifact.star;

                  return (
                    <div key={character} className="rounded-3xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <CharacterIcon name={character} theme={theme} language={language} />
                          <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-semibold">{getCharacterDisplayName(character, language)}</h3>
                              <CharacterUpgradeBadges name={character} language={language} />
                              <CharacterAcquisitionBadge name={character} language={language} />
                              <CharacterOriginBadge name={character} language={language} />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openAddEntryDrawer(character);
                                }}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full border bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                                title={t('quickAdd')}
                                aria-label={t('quickAdd')}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        <div className="flex items-center gap-2">
                          {shouldShowArtifactControls ? (
                            <ArtifactPicker
                              name={character}
                              enabled={artifactEnabled}
                              starLevel={artifactStar}
                              onToggle={() =>
                                updateCharacterArtifact(character, (current) =>
                                  current.enabled
                                    ? createDefaultArtifactState()
                                    : { enabled: 1, star: 3 }
                                )
                              }
                              onCycleStar={() =>
                                updateCharacterArtifact(character, (current) => ({
                                  enabled: 1,
                                  star: current.enabled && current.star >= 3 && current.star <= 5 ? current.star + 1 : 3,
                                }))
                              }
                              align="right"
                              language={language}
                            />
                          ) : null}
                          {shouldShowCtpControls ? (
                            <>
                              <CtpPicker
                                value={characterCtp}
                                onChange={(next) => updateCharacterCtp(character, next)}
                                onCycleRarity={(direction = 1) =>
                                  updateCharacterCtp(character, (current) => {
                                    const normalized = normalizeCtpSelection(current);
                                    const index = CTP_RARITY_OPTIONS.indexOf(normalized.rarity);
                                    const nextIndex =
                                      direction < 0
                                        ? (index - 1 + CTP_RARITY_OPTIONS.length) % CTP_RARITY_OPTIONS.length
                                        : (index + 1) % CTP_RARITY_OPTIONS.length;

                                    return {
                                      ...normalized,
                                      rarity: CTP_RARITY_OPTIONS[nextIndex],
                                    };
                                  })
                                }
                                align="right"
                                label={characterCtpType || '-'}
                                secretDisplay
                                language={language}
                              />
                              <CTPPriorityBadge
                                priority={getCharacterCtpPriority(character)}
                                onClick={() => cycleCharacterCtpPriority(character)}
                                className="w-8 h-8"
                                language={language}
                              />
                            </>
                          ) : null}
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{formatCountLabel(language, items.length)}</span>
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
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                              <div className="min-w-0">
                                <div className={`font-medium ${item.done ? 'line-through text-slate-400' : ''}`}>
                                  {translateValue(language, CATEGORY_LABELS, item.category)}
                                </div>
                                <div className={`text-sm text-slate-600 ${item.done ? 'line-through text-slate-400' : ''}`}>
                                  {translateValue(language, DETAIL_LABELS, item.detail)}
                                </div>
                              </div>
                              {item.category === '유니폼 필요' && isOldUniformDetail(item.detail) ? (
                                <CharacterIcon
                                  name={item.character}
                                  preferLatest
                                  language={language}
                                  uniformSelectionNumber={item.uniformNumber > 0 ? item.uniformNumber : 0}
                                  onUniformSelect={(next) => updateRowUniformNumber(item.id, next)}
                                  keepOpenOnSelect
                                />
                              ) : null}
                            </div>
                            <PriorityBadge
                              priority={item.priority}
                              onClick={() => cycleRowPriority(item.id)}
                              language={language}
                            />
                            <CharacterUsageBadge usageType={item.usageType} language={language} />
                            <button
                              type="button"
                              onClick={() => openAddEntryDrawer(item.character)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full border bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                              title={t('quickAdd')}
                              aria-label={t('quickAdd')}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditRow(item)}
                              className="text-sm px-3 py-1 rounded-xl border cursor-pointer"
                            >
                              {t('editEntry')}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(item.id)}
                              className="text-sm px-3 py-1 rounded-xl border cursor-pointer"
                            >
                              {t('delete')}
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
                  const characterCtpType = characterCtp.type;
                  const characterArtifact = getCharacterArtifact(character);
                  const artifactEnabled = characterArtifact.enabled;
                  const artifactStar = characterArtifact.star;

                  return (
                    <div key={character} className="rounded-3xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CharacterIcon name={character} theme={theme} language={language} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{getCharacterDisplayName(character, language)}</div>
                            <div className="text-xs text-slate-500">{formatCountLabel(language, items.length)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {shouldShowArtifactControls ? (
                            <ArtifactPicker
                              name={character}
                              enabled={artifactEnabled}
                              starLevel={artifactStar}
                              onToggle={() =>
                                updateCharacterArtifact(character, (current) =>
                                  current.enabled
                                    ? createDefaultArtifactState()
                                    : { enabled: 1, star: 3 }
                                )
                              }
                              onCycleStar={() =>
                                updateCharacterArtifact(character, (current) => ({
                                  enabled: 1,
                                  star: current.enabled && current.star >= 3 && current.star <= 5 ? current.star + 1 : 3,
                                }))
                              }
                              align="right"
                              language={language}
                            />
                          ) : null}
                          {shouldShowCtpControls ? (
                            <>
                              <CtpPicker
                                value={characterCtp}
                                onChange={(next) => updateCharacterCtp(character, next)}
                                onCycleRarity={(direction = 1) =>
                                  updateCharacterCtp(character, (current) => {
                                    const normalized = normalizeCtpSelection(current);
                                    const index = CTP_RARITY_OPTIONS.indexOf(normalized.rarity);
                                    const nextIndex =
                                      direction < 0
                                        ? (index - 1 + CTP_RARITY_OPTIONS.length) % CTP_RARITY_OPTIONS.length
                                        : (index + 1) % CTP_RARITY_OPTIONS.length;

                                    return {
                                      ...normalized,
                                      rarity: CTP_RARITY_OPTIONS[nextIndex],
                                    };
                                  })
                                }
                                align="right"
                                label={characterCtpType || '-'}
                                secretDisplay
                                language={language}
                              />
                              <CTPPriorityBadge
                                priority={getCharacterCtpPriority(character)}
                                onClick={() => cycleCharacterCtpPriority(character)}
                                className="w-8 h-8"
                                language={language}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <CharacterUpgradeBadges name={character} language={language} />
                          <CharacterAcquisitionBadge name={character} language={language} />
                          <CharacterOriginBadge name={character} language={language} />
                          <button
                            type="button"
                            onClick={() => openAddEntryDrawer(character)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full border bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                            title={t('quickAdd')}
                            aria-label={t('quickAdd')}
                          >
                            +
                          </button>
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
                      <h3 className="text-lg font-semibold">{translateValue(language, CATEGORY_LABELS, group.category)}</h3>
                      <p className="text-sm text-slate-600">{translateValue(language, DETAIL_LABELS, group.detail)}</p>
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
                            <CharacterIcon
                              name={item.character}
                              theme={theme}
                              language={language}
                            />
                            <span className={`max-w-36 truncate text-sm font-medium ${item.done ? 'line-through text-slate-400' : ''}`}>
                              {getCharacterDisplayName(item.character, language)}
                            </span>
                            <CharacterAcquisitionBadge name={item.character} language={language} />
                            <CharacterOriginBadge name={item.character} language={language} />
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openAddEntryDrawer(item.character);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full border bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                              title={t('quickAdd')}
                              aria-label={t('quickAdd')}
                            >
                              +
                            </button>
                            <PriorityBadge
                              priority={item.priority}
                              onClick={() => cycleRowPriority(item.id)}
                              language={language}
                            />
                            <CharacterUsageBadge usageType={item.usageType} language={language} />
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

        {showTransferDialog && transferDialogKind && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border p-6 space-y-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">
                    {transferDialogKind === 'import' ? t('importOptions') : t('exportOptions')}
                  </h3>
                  {transferDialogKind === 'export' && (
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={exportDoneMode === 'forceFalse'}
                        onChange={(event) => setExportDoneMode(event.target.checked ? 'forceFalse' : 'asIs')}
                      />
                      {t('keepDone')}
                    </label>
                  )}
                </div>
                {transferDialogKind === 'import' && (
                  <p className="text-sm text-amber-700 mt-1">{t('importMergeWarning')}</p>
                )}
              </div>

                {transferDialogKind === 'import' ? (
                <div className="space-y-2">
                  {[
                    ['merge', t('mergeImport')],
                    ['replace', t('replaceImport')],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setImportMode(value)}
                      className={`w-full px-4 py-3 rounded-2xl border text-left ${
                        importMode === value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-700">{t('selectedRowsOnly')}</div>
                    <div className="mt-2 relative">
                      <input
                        value={exportSearchQuery}
                        onChange={(event) => setExportSearchQuery(event.target.value)}
                        placeholder={t('search')}
                        className="w-full pl-10 pr-3 py-2 rounded-xl border bg-white text-sm"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllExportRows(exportFilteredRows)}
                        className="px-3 py-1.5 rounded-xl border bg-white text-sm"
                      >
                        {t('selectAllRows')}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAllExportRows(exportFilteredRows)}
                        className="px-3 py-1.5 rounded-xl border bg-white text-sm"
                      >
                        {t('clearAllRows')}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border bg-white">
                    <div className="space-y-3 p-3">
                      {exportRowsByCharacter.map(([character, groupedRows]) => {
                        const allSelected = groupedRows.every((row) => isRowExportSelected(row.id));
                        const someSelected = groupedRows.some((row) => isRowExportSelected(row.id));
                        const groupState = allSelected ? 'selected' : someSelected ? 'partial' : 'none';

                        return (
                          <div
                            key={character}
                            className={`rounded-2xl border p-3 ${
                              groupState === 'selected'
                                ? theme === 'dark'
                                  ? 'border-emerald-500 bg-emerald-900/80 text-emerald-50'
                                  : 'border-emerald-300 bg-emerald-100'
                                : theme === 'dark'
                                  ? 'border-slate-700 bg-slate-900/60'
                                  : 'border-slate-200 bg-white'
                            }`}
                          >
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) {
                                    el.indeterminate = groupState === 'partial';
                                  }
                                }}
                                onChange={(event) => setExportCharacterSelected(character, event.target.checked)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{getCharacterDisplayName(character, language)}</div>
                                <div className="text-xs text-slate-500">{groupedRows.length} {t('items')}</div>
                              </div>
                            </label>
                            <div className="mt-3 space-y-2">
                              {groupedRows.map((row) => {
                                const selected = isRowExportSelected(row.id);
                                return (
                                  <label
                                    key={row.id}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer ${
                                      selected
                                        ? theme === 'dark'
                                          ? 'bg-emerald-700 border-emerald-400 text-white'
                                          : 'bg-emerald-200 border-emerald-400'
                                        : theme === 'dark'
                                          ? 'bg-slate-950 border-slate-700 text-slate-200'
                                          : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={(event) => setExportRowSelected(row.id, event.target.checked)}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium truncate">
                                        {translateValue(language, CATEGORY_LABELS, row.category)}
                                      </div>
                                      <div className="text-xs truncate">
                                        {translateValue(language, DETAIL_LABELS, row.detail)}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {exportRowsByCharacter.length === 0 && (
                        <div className="px-3 py-8 text-center text-sm text-slate-500">
                          {t('noEntries')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeTransferDialog}
                  className="flex-1 px-4 py-2 rounded-2xl border cursor-pointer"
                >
                  {t('cancel')}
                </button>
                {transferDialogKind === 'import' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingImportMode(importMode);
                      closeTransferDialog();
                      importFileRef.current?.click();
                    }}
                    className="flex-1 px-4 py-2 rounded-2xl border bg-slate-900 text-white cursor-pointer"
                  >
                    {t('continueAction')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedExportRowCount) return;
                      exportFile(exportDoneMode === 'forceFalse');
                      closeTransferDialog();
                    }}
                    disabled={!selectedExportRowCount}
                    className={`flex-1 px-4 py-2 rounded-2xl border bg-slate-900 text-white cursor-pointer ${
                      !selectedExportRowCount ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {t('exportNow')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {editingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{t('editEntry')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{editingRow.character}</p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="px-3 py-1 rounded-xl border text-sm"
                >
                  {t('close')}
                </button>
              </div>

              <form onSubmit={saveEditRow} className="space-y-4">
                <div className="text-sm">
                  <div className="font-medium">{t('category')}</div>
                  <div className="mt-1 text-slate-600">{translateValue(language, CATEGORY_LABELS, editingRow.category)}</div>
                </div>

                <div className="text-sm">
                  <div className="font-medium">{t('detail')}</div>
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
                          {translateValue(language, DETAIL_LABELS, option)}
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
                  <div className="font-medium">{t('usage')}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {['PVE', 'PVP'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setEditUsageSelection(
                            label === 'PVE'
                              ? normalizeUsageSelection({ PVE: true, PVP: false })
                              : normalizeUsageSelection({ PVE: false, PVP: true })
                          );
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
                  <div className="font-medium">{t('priority')}</div>
                  <div className="mt-1">
                    <PriorityBadge
                      priority={editPriority}
                      onClick={() => setEditPriority((current) => cyclePriority(current))}
                      className="w-9 h-9"
                      language={language}
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
                  {t('completion')}
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
                    {t('cancel')}
                  </button>
                <button
                  type="submit"
                  className="mff-save-button flex-1 px-4 py-2 rounded-2xl font-medium cursor-pointer"
                >
                  {t('save')}
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
                  setUsageFilterMode(label);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  label === 'PVE'
                    ? usageFilterMode === label
                      ? 'bg-sky-200 text-sky-900'
                      : 'bg-slate-100 text-slate-600'
                    : usageFilterMode === label
                      ? 'bg-rose-200 text-rose-900'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUsageFilterMode('All')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                usageFilterMode === 'All'
                  ? 'bg-amber-300 text-amber-950 border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t('all')}
            </button>
          </div>
        </div>

        <div className="pb-2 text-center text-[11px] text-slate-400">
          Built by JM Lee with Codex. Thanks to the Marvel Future Fight community, especially 겁쟁이들의 쉼터 and thanosvibs.money.
        </div>
      </div>
    </div>
  );
}
