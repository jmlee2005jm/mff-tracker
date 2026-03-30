import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CTP_TYPE_DISPLAY_NAMES, getCharacterEntry } from './mffTrackerUtils';
import {
  getUiText,
  translateValue,
  ORIGIN_LABELS,
  ACQUISITION_LABELS,
  UPGRADE_LABELS,
  USAGE_LABELS,
} from './i18n';
import {
  getBaseIconUrlBySlug,
  getUniformIconUrlBySlug,
  findLatestUniformNumber,
  findAvailableUniformNumbers,
} from './iconUtils';

const CHARACTER_UNIFORM_OVERRIDES_KEY = 'mff_character_uniform_overrides_v1';
const CHARACTER_UNIFORM_CHANGE_EVENT = 'mff:character-uniform-change';
const CHARACTER_UNIFORM_OPTIONS_KEY = 'mff_character_uniform_options_v1';
const CHARACTER_UNIFORM_AUTO = 0;
const CHARACTER_UNIFORM_BASE = -1;

const UPGRADE_ICON_BY_LEVEL = {
  '2티': 'https://thanosvibs.money/static/attributes/t2.png',
  '각초': 'https://thanosvibs.money/static/attributes/tp.png',
  '3티': 'https://thanosvibs.money/static/attributes/t3.png',
  '4티': 'https://thanosvibs.money/static/attributes/t4.png',
};

const DISPLAY_ACQUISITION_TYPES = new Set(['수정캐', '디럭스', '엑조디아', '매생/매엑']);
export const CTP_TYPES = ['통찰', '극복', '탐욕', '해방', '분노', '경쟁', '파괴', '제련', '권능', '심판', '재생', '역전', '격동', '인내', '초월'];
export const CTP_ICON_BY_TYPE = {
  통찰: 'https://thanosvibs.money/static/assets/items/ctp_insight.png',
  극복: 'https://thanosvibs.money/static/assets/items/ctp_conquest.png',
  탐욕: 'https://thanosvibs.money/static/assets/items/ctp_greed.png',
  해방: 'https://thanosvibs.money/static/assets/items/ctp_liberation.png',
  분노: 'https://thanosvibs.money/static/assets/items/ctp_rage.png',
  경쟁: 'https://thanosvibs.money/static/assets/items/ctp_competition.png',
  파괴: 'https://thanosvibs.money/static/assets/items/ctp_destruction.png',
  제련: 'https://thanosvibs.money/static/assets/items/ctp_refinement.png',
  권능: 'https://thanosvibs.money/static/assets/items/ctp_authority.png',
  심판: 'https://thanosvibs.money/static/assets/items/ctp_judgement.png',
  재생: 'https://thanosvibs.money/static/assets/items/ctp_regeneration.png',
  역전: 'https://thanosvibs.money/static/assets/items/ctp_veteran.png',
  격동: 'https://thanosvibs.money/static/assets/items/ctp_energy.png',
  인내: 'https://thanosvibs.money/static/assets/items/ctp_patience.png',
  초월: 'https://thanosvibs.money/static/assets/items/ctp_transcendence.png',
};
const CTP_BADGE_STYLE_BY_TYPE = {
  통찰: 'shadow-[0_0_14px_rgba(168,85,247,0.65),_0_0_24px_rgba(168,85,247,0.38)]',
  극복: 'shadow-[0_0_14px_rgba(59,130,246,0.62),_0_0_24px_rgba(59,130,246,0.36)]',
  탐욕: 'shadow-[0_0_14px_rgba(120,53,15,0.7),_0_0_24px_rgba(120,53,15,0.4)]',
  해방: 'shadow-[0_0_14px_rgba(234,179,8,0.66),_0_0_24px_rgba(234,179,8,0.38)]',
  분노: 'shadow-[0_0_14px_rgba(168,85,247,0.65),_0_0_24px_rgba(168,85,247,0.38)]',
  경쟁: 'shadow-[0_0_14px_rgba(59,130,246,0.62),_0_0_24px_rgba(59,130,246,0.36)]',
  파괴: 'shadow-[0_0_14px_rgba(239,68,68,0.72),_0_0_24px_rgba(239,68,68,0.42)]',
  제련: 'shadow-[0_0_14px_rgba(148,163,184,0.55),_0_0_24px_rgba(148,163,184,0.32)]',
  권능: 'shadow-[0_0_14px_rgba(234,179,8,0.66),_0_0_24px_rgba(234,179,8,0.38)]',
  심판: 'shadow-[0_0_14px_rgba(245,158,11,0.65),_0_0_24px_rgba(245,158,11,0.38)]',
  재생: 'shadow-[0_0_14px_rgba(34,197,94,0.62),_0_0_24px_rgba(34,197,94,0.36)]',
  역전: 'shadow-[0_0_14px_rgba(234,179,8,0.66),_0_0_24px_rgba(234,179,8,0.38)]',
  격동: 'shadow-[0_0_14px_rgba(251,146,60,0.62),_0_0_24px_rgba(251,146,60,0.36)]',
  인내: 'shadow-[0_0_14px_rgba(45,212,191,0.62),_0_0_24px_rgba(45,212,191,0.36)]',
  초월: 'shadow-[0_0_14px_rgba(59,130,246,0.62),_0_0_24px_rgba(59,130,246,0.36)]',
};
const USAGE_BADGE_STYLES = {
  PVE: 'bg-sky-100 text-sky-800 border-sky-200',
  PVP: 'bg-rose-100 text-rose-800 border-rose-200',
  'PVE/PVP': 'bg-zinc-800 text-white border-zinc-900',
};

const PRIORITY_BADGE_STYLES = {
  0: 'bg-slate-100 text-slate-500 border-slate-200',
  1: 'bg-yellow-100 text-yellow-800 border-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.22)]',
  2: 'bg-orange-100 text-orange-800 border-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.28)]',
  3: 'bg-red-100 text-red-800 border-red-200 shadow-[0_0_12px_rgba(248,113,113,0.34)]',
};

function LoadingIconTile({ className = 'w-10 h-10', label = '' }) {
  return (
    <div
      className={`rounded-xl border bg-white flex items-center justify-center shrink-0 text-slate-400 border-slate-300 ${className}`}
      aria-label={label || 'Loading'}
      title={label || 'Loading'}
    >
      <span className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-sky-500 animate-spin" />
    </div>
  );
}

function loadCharacterUniformOverrides() {
  try {
    const saved = window.localStorage.getItem(CHARACTER_UNIFORM_OVERRIDES_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([slug, value]) => {
        const normalized = Number(value);
        return [slug, Number.isInteger(normalized) && normalized >= -1 ? normalized : 0];
      })
    );
  } catch {
    return {};
  }
}

function getCharacterUniformOverride(slug) {
  const overrides = loadCharacterUniformOverrides();
  const value = overrides[slug];
  return Number.isInteger(value) && value >= -1 ? value : 0;
}

function setCharacterUniformOverride(slug, uniformNumber) {
  try {
    const overrides = loadCharacterUniformOverrides();

    if (Number.isInteger(uniformNumber) && uniformNumber >= -1) {
      overrides[slug] = uniformNumber;
    } else {
      delete overrides[slug];
    }

    window.localStorage.setItem(CHARACTER_UNIFORM_OVERRIDES_KEY, JSON.stringify(overrides));
    window.dispatchEvent(
      new CustomEvent(CHARACTER_UNIFORM_CHANGE_EVENT, {
        detail: {
          slug,
          uniformNumber: Number.isInteger(uniformNumber) && uniformNumber >= -1 ? uniformNumber : 0,
        },
      })
    );
  } catch {
    // ignore storage errors
  }
}

function loadUniformOptionsCache(slug) {
  try {
    const saved = window.localStorage.getItem(`${CHARACTER_UNIFORM_OPTIONS_KEY}_${slug}_v1`);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return null;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
}

function saveUniformOptionsCache(slug, numbers) {
  try {
    window.localStorage.setItem(
      `${CHARACTER_UNIFORM_OPTIONS_KEY}_${slug}_v1`,
      JSON.stringify(numbers)
    );
  } catch {
    // ignore storage errors
  }
}

function CharacterIconFace({
  name,
  className = 'w-10 h-10',
  uniformNumberOverride = 0,
  preferLatest = false,
  language = 'ko',
}) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveIcon() {
      setFailed(false);
      setLoading(true);
      setSrc(null);

      const entry = getCharacterEntry(name);
      if (!entry?.slug) {
        if (!cancelled) setLoading(false);
        return;
      }

      const slug = entry.slug;
      const overrideNumber = Number.isInteger(uniformNumberOverride) && uniformNumberOverride >= -1
        ? uniformNumberOverride
        : 0;
      let targetSrc = '';

      if (overrideNumber === CHARACTER_UNIFORM_BASE) {
        targetSrc = getBaseIconUrlBySlug(slug);
      } else if (overrideNumber > 0) {
        targetSrc = getUniformIconUrlBySlug(slug, overrideNumber);
      } else if (!preferLatest && Number.isInteger(entry.iconUniformNumber)) {
        targetSrc =
          entry.iconUniformNumber === CHARACTER_UNIFORM_BASE
            ? getBaseIconUrlBySlug(slug)
            : getUniformIconUrlBySlug(slug, entry.iconUniformNumber);
      } else {
        const cacheKey = `mff_latest_uniform_${slug}_v3`;
        const cached = window.localStorage.getItem(cacheKey);
        if (cached !== null) {
          const cachedNumber = Number(cached);
          targetSrc =
            cachedNumber > 0
              ? getUniformIconUrlBySlug(slug, cachedNumber)
              : getBaseIconUrlBySlug(slug);
        } else {
          const latest = await findLatestUniformNumber(slug, 50);
          window.localStorage.setItem(cacheKey, String(latest));
          targetSrc =
            latest > 0
              ? getUniformIconUrlBySlug(slug, latest)
              : getBaseIconUrlBySlug(slug);
        }
      }

      try {
        await loadImage(targetSrc);
        if (!cancelled) {
          setSrc(targetSrc);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    resolveIcon();

    return () => {
      cancelled = true;
    };
  }, [name, preferLatest, uniformNumberOverride]);

  if (!src || failed) {
    return (
      loading ? (
        <LoadingIconTile className={className} label={`${getUiText(language, 'loading')} ${name || getUiText(language, 'character')}`} />
      ) : (
        <div className={`rounded-xl border bg-white flex items-center justify-center shrink-0 text-slate-900 border-slate-300 ${className}`}>
          <span className="text-sm font-bold">{name?.[0] || '?'}</span>
        </div>
      )
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`rounded-xl object-cover border shrink-0 bg-white border-slate-300 ${className}`}
    />
  );
}

export function CharacterIcon({ name, preferLatest = false, language = 'ko' }) {
  const entry = getCharacterEntry(name);
  const slug = entry?.slug || '';
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [availableUniformNumbers, setAvailableUniformNumbers] = useState(() =>
    slug ? loadUniformOptionsCache(slug) || [] : []
  );
  const [loadingUniformNumbers, setLoadingUniformNumbers] = useState(false);
  const [uniformOverride, setUniformOverride] = useState(() => (slug ? getCharacterUniformOverride(slug) : 0));

  useEffect(() => {
    const syncFromStorage = () => {
      setUniformOverride(slug ? getCharacterUniformOverride(slug) : 0);
      setAvailableUniformNumbers(slug ? loadUniformOptionsCache(slug) || [] : []);
    };

    syncFromStorage();

    const handleUniformChange = (event) => {
      if (event.detail?.slug === slug) {
        const nextValue = Number(event.detail.uniformNumber);
        setUniformOverride(Number.isInteger(nextValue) && nextValue >= -1 ? nextValue : 0);
      }
    };

    window.addEventListener(CHARACTER_UNIFORM_CHANGE_EVENT, handleUniformChange);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener(CHARACTER_UNIFORM_CHANGE_EVENT, handleUniformChange);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [slug]);

  useEffect(() => {
    if (!open || !slug) return;

    let cancelled = false;

    async function loadUniformNumbers() {
      const cached = loadUniformOptionsCache(slug);
      if (cached && cached.length > 0) {
        setAvailableUniformNumbers(cached);
        setLoadingUniformNumbers(false);
        return;
      }

      setLoadingUniformNumbers(true);
      try {
        const numbers = await findAvailableUniformNumbers(slug, 50);
        if (cancelled) return;

        setAvailableUniformNumbers(numbers);
        saveUniformOptionsCache(slug, numbers);
      } finally {
        if (!cancelled) {
          setLoadingUniformNumbers(false);
        }
      }
    }

    loadUniformNumbers();

    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 304;
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - menuWidth - 8)
      );
      const top = Math.min(window.innerHeight - 8, rect.bottom + 8);

      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
      });
    };

    updatePosition();

    const handleWindowChange = () => updatePosition();
    const handlePointerDown = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedUniformNumber = Number.isInteger(uniformOverride) && uniformOverride >= -1 ? uniformOverride : 0;

  const optionButtonClass = (active = false) =>
    `w-14 h-14 rounded-xl border cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
      active ? 'border-sky-400 bg-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]' : 'border-slate-200 bg-white hover:bg-slate-50'
    }`;

  const triggerTitle = selectedUniformNumber > 0
    ? `Uniform ${selectedUniformNumber}`
    : selectedUniformNumber === CHARACTER_UNIFORM_BASE
      ? getUiText(language, 'base')
    : getUiText(language, 'auto');

  if (!entry?.slug) {
    return <CharacterIconFace name={name} className="w-10 h-10" preferLatest={preferLatest} language={language} />;
  }

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        ref={buttonRef}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="relative inline-flex items-center justify-center shrink-0 cursor-pointer p-0 bg-transparent border-0"
        title={triggerTitle}
        aria-label={triggerTitle}
      >
        <CharacterIconFace
          name={name}
          preferLatest={preferLatest}
          uniformNumberOverride={selectedUniformNumber}
          className="w-10 h-10"
          language={language}
        />
        <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] leading-none flex items-center justify-center shadow-sm">
          ▾
        </span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="z-[9999] rounded-2xl border bg-white shadow-2xl p-3 grid grid-cols-4 gap-2"
          style={
            menuStyle || {
              position: 'fixed',
              left: '-9999px',
              top: '-9999px',
              width: '304px',
              visibility: 'hidden',
            }
          }
        >
          <button
            type="button"
            onClick={() => {
              setCharacterUniformOverride(slug, CHARACTER_UNIFORM_BASE);
              setOpen(false);
            }}
            className={`${optionButtonClass(selectedUniformNumber === CHARACTER_UNIFORM_BASE)} col-span-1`}
            title={getUiText(language, 'base')}
          >
            <CharacterIconFace
              name={name}
              uniformNumberOverride={CHARACTER_UNIFORM_BASE}
              className="w-8 h-8"
              language={language}
            />
            <span className="text-[10px] font-semibold text-slate-500">{getUiText(language, 'base')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCharacterUniformOverride(slug, CHARACTER_UNIFORM_AUTO);
              setOpen(false);
            }}
            className={`${optionButtonClass(selectedUniformNumber === CHARACTER_UNIFORM_AUTO)} col-span-1`}
            title={getUiText(language, 'auto')}
          >
            <span className="text-[10px] font-semibold text-slate-500">{getUiText(language, 'auto')}</span>
          </button>

          {loadingUniformNumbers && availableUniformNumbers.length === 0 ? (
            <>
              <LoadingIconTile className="w-14 h-14" label={`${getUiText(language, 'loading')} ${getUiText(language, 'uniform')}`} />
              <LoadingIconTile className="w-14 h-14" label={`${getUiText(language, 'loading')} ${getUiText(language, 'uniform')}`} />
              <LoadingIconTile className="w-14 h-14" label={`${getUiText(language, 'loading')} ${getUiText(language, 'uniform')}`} />
              <LoadingIconTile className="w-14 h-14" label={`${getUiText(language, 'loading')} ${getUiText(language, 'uniform')}`} />
            </>
          ) : (
            availableUniformNumbers.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => {
                  setCharacterUniformOverride(slug, number);
                  setOpen(false);
                }}
                className={optionButtonClass(selectedUniformNumber === number)}
                title={`Uniform ${number}`}
              >
                <CharacterIconFace
                  name={name}
                  uniformNumberOverride={number}
                  className="w-10 h-10"
                  language={language}
                />
                <span className="text-[9px] leading-none text-slate-500 font-semibold">#{number}</span>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export function CharacterOriginBadge({ name, language = 'ko' }) {
  const entry = getCharacterEntry(name);
  const originType = entry?.originType || null;

  if (!originType || originType === '일반캐') return null;

  const styles = {
    '태생캐 (2티)': 'bg-gray-200 text-gray-800 border-gray-300 shadow-[0_0_8px_rgba(107,114,128,0.35)]',
    '태생캐 (2티, 더블)': 'bg-gray-700 text-white border-gray-800 shadow-[0_0_12px_rgba(17,24,39,0.75)]',
    '태생캐 (3티)': 'bg-yellow-300 text-yellow-800 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.65)]',
  };

  const style = styles[originType] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${style}`}>
      {translateValue(language, ORIGIN_LABELS, originType)}
    </span>
  );
}

export function CharacterAcquisitionBadge({ name, language = 'ko' }) {
  const entry = getCharacterEntry(name);
  const acquisitionType = entry?.acquisitionType || null;

  if (!acquisitionType || !DISPLAY_ACQUISITION_TYPES.has(acquisitionType)) return null;

  const styles = {
    '수정캐': 'bg-sky-100 text-sky-800 border-sky-200',
    '디럭스': 'bg-violet-100 text-violet-800 border-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.55)]',
    '엑조디아': 'bg-orange-100 text-orange-800 border-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.45)]',
    '매생/매엑': 'bg-zinc-800 text-white border-zinc-900',
  };

  const style = styles[acquisitionType] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${style}`}>
      {translateValue(language, ACQUISITION_LABELS, acquisitionType)}
    </span>
  );
}

export function CTPBadge({ ctpType, className = 'w-11 h-11' }) {
  if (!ctpType) return null;

  const iconSrc = CTP_ICON_BY_TYPE[ctpType];
  const badgeStyle = CTP_BADGE_STYLE_BY_TYPE[ctpType] || 'shadow-[0_0_16px_rgba(148,163,184,0.55)]';

  if (iconSrc) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden bg-white shrink-0 ${className} ${badgeStyle}`}
        title={CTP_TYPE_DISPLAY_NAMES[ctpType] || `CTP ${ctpType}`}
      >
        <img src={iconSrc} alt={`CTP ${ctpType}`} className="w-full h-full object-contain p-0.5 scale-[1.02]" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center rounded-xl overflow-hidden bg-slate-900 text-white shrink-0 ${className} ${badgeStyle}`}>
      CTP
    </span>
  );
}

export function CharacterCTPBadge({ name }) {
  const entry = getCharacterEntry(name);
  return <CTPBadge ctpType={entry?.ctp || null} />;
}

export function CharacterUsageBadge({ usageType, language = 'ko' }) {
  const normalized = usageType || '';
  if (!normalized) {
    return (
      <span className="text-xs px-2 py-1 rounded-full border font-medium bg-slate-100 text-slate-500 border-slate-200">
        {translateValue(language, USAGE_LABELS, 'None')}
      </span>
    );
  }

  if (normalized === 'PVE/PVP') {
    return (
      <div className="flex items-center gap-1">
        {['PVE', 'PVP'].map((label) => (
          <span
            key={label}
            className={`text-xs px-2 py-1 rounded-full border font-medium ${USAGE_BADGE_STYLES[label]}`}
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  const style = USAGE_BADGE_STYLES[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${style}`}>
      {translateValue(language, USAGE_LABELS, normalized === 'PVE' ? 'PVE only' : normalized === 'PVP' ? 'PVP only' : normalized)}
    </span>
  );
}

export function PriorityBadge({ priority = 0, onClick, className = 'w-8 h-8', language = 'ko' }) {
  const normalized = Number.isInteger(priority) && priority >= 0 && priority <= 3 ? priority : 0;
  const label = normalized === 0 ? '0' : '!'.repeat(normalized);
  const style = PRIORITY_BADGE_STYLES[normalized] || PRIORITY_BADGE_STYLES[0];
  const baseClass = `inline-flex items-center justify-center rounded-lg border font-bold shrink-0 ${className} ${style}`;

  if (onClick) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick(event);
          }}
          className={`${baseClass} cursor-pointer`}
          title={`${getUiText(language, 'priority')} ${label}`}
          aria-label={`${getUiText(language, 'priority')} ${label}`}
        >
        {label}
      </button>
    );
  }

  return (
    <span
      className={baseClass}
      title={`${getUiText(language, 'priority')} ${label}`}
      aria-label={`${getUiText(language, 'priority')} ${label}`}
    >
      {label}
    </span>
  );
}

export function CharacterUpgradeBadges({ name, language = 'ko' }) {
  const entry = getCharacterEntry(name);
  if (!entry?.upgradeLevel) return null;

  const levels = [
    entry.upgradeLevel,
    entry.upgradeLevel === '4티' ? entry.baseUpgradeLevel : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-1">
      {levels.map((level) => {
        const src = UPGRADE_ICON_BY_LEVEL[level];
        if (!src) return null;

        const styles = {
          '4티': 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.35)]',
          '3티': 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.42)]',
          '각초': 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.35)]',
          '2티': 'bg-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.35)]',
        };

        return (
          <span
            key={level}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 overflow-hidden ${styles[level] || 'bg-slate-200'}`}
            title={translateValue(language, UPGRADE_LABELS, level)}
          >
            <img
              src={src}
              alt={level}
              className="w-full h-full object-contain p-0"
            />
          </span>
        );
      })}
    </div>
  );
}
