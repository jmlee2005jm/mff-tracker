import React, { useEffect, useRef, useState } from 'react';
import { CTPBadge } from './CharacterComponents';
import { DEFAULT_CTP_PREVIEW_ICON } from './iconAssets';
import { getUiText } from './i18n';
import { CTP_TYPE_DISPLAY_NAMES, CTP_TYPE_OPTIONS } from './mffTrackerUtils';
import { getCtpRarityLabel, normalizeCtpSelection } from './ctpStateUtils';
import { loadImageCached } from './iconUtils';

export default function CtpPicker({
  value,
  onChange,
  onCycleRarity,
  align = 'left',
  label = '',
  compact = false,
  secretDisplay = false,
  language = 'ko',
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const normalizedValue = normalizeCtpSelection(value);
  const selectedType = normalizedValue.type;
  const selectedRarity = normalizedValue.rarity;

  useEffect(() => {
    if (!selectedType) {
      loadImageCached(DEFAULT_CTP_PREVIEW_ICON).catch(() => {
        // ignore cache population errors
      });
    }
  }, [selectedType]);

  const previewContent = selectedType ? (
    <CTPBadge ctpType={selectedType} className={compact ? 'w-6 h-6' : 'w-10 h-10'} />
  ) : (
    <span
      className={`inline-flex items-center justify-center rounded-xl overflow-hidden bg-white border border-slate-300 shadow-sm shrink-0 ${
        compact ? 'w-6 h-6' : 'w-10 h-10'
      }`}
      title={getUiText(language, 'none')}
      aria-label={getUiText(language, 'none')}
    >
      <img
        src={DEFAULT_CTP_PREVIEW_ICON}
        alt=""
        className="w-full h-full object-contain p-0.5 scale-[1.02]"
      />
    </span>
  );

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 264;
      const left = align === 'right'
        ? Math.max(8, rect.right - menuWidth)
        : Math.max(8, rect.left);
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
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        setOpen(false);
        return;
      }
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open, align]);

  const rarityLabel = getCtpRarityLabel(selectedRarity, language);
  const rarityTitle = selectedType
    ? `${CTP_TYPE_DISPLAY_NAMES[selectedType] || selectedType} · ${rarityLabel}`
    : getUiText(language, 'none');

  return (
    <div className="relative inline-flex flex-col items-center gap-0.5">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1 text-slate-900 cursor-pointer whitespace-nowrap ${
          secretDisplay
            ? 'px-1 py-0.5 rounded-full bg-transparent shadow-none'
            : `px-3 rounded-xl border bg-white ${compact ? 'h-8' : 'h-11'}`
        }`}
        title={label || rarityTitle}
        aria-label={label || rarityTitle}
      >
        {previewContent}
        {!secretDisplay && <span className="text-[10px] leading-none text-slate-400">▾</span>}
      </button>

      {selectedType ? (
        <div className="inline-flex items-center gap-0.25 rounded-full border bg-white px-0.5 py-0.5 text-[9px] leading-none shadow-sm whitespace-nowrap">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCycleRarity?.(-1);
            }}
            className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label={`${getUiText(language, 'previous')} ${rarityLabel}`}
            title={`${getUiText(language, 'previous')} ${rarityLabel}`}
          >
            <svg className="w-2.25 h-2.25" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.5 4.5 7 10l5.5 5.5" />
            </svg>
          </button>
          <span className="min-w-4.5 px-0.25 text-center font-medium text-slate-700">
            {rarityLabel}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCycleRarity?.(1);
            }}
            className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label={`${getUiText(language, 'next')} ${rarityLabel}`}
            title={`${getUiText(language, 'next')} ${rarityLabel}`}
          >
            <svg className="w-2.25 h-2.25" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
            </svg>
          </button>
        </div>
      ) : null}

      {open && (
        <div
          ref={menuRef}
          className="z-40 rounded-2xl border bg-white shadow-2xl p-3 grid grid-cols-4 gap-2"
          style={
            menuStyle || {
              position: 'fixed',
              left: '-9999px',
              top: '-9999px',
              width: '264px',
              visibility: 'hidden',
            }
          }
        >
          <button
            type="button"
            onClick={() => {
              onChange({ type: '', rarity: 'regular' });
              setOpen(false);
            }}
            className="w-12 h-12 rounded-xl border bg-slate-100 text-slate-500 text-lg font-semibold cursor-pointer flex items-center justify-center"
            title="-"
          >
            -
          </button>
          {CTP_TYPE_OPTIONS.map((ctpType) => (
            <button
              key={ctpType}
              type="button"
              onClick={() => {
                onChange({ type: ctpType, rarity: 'regular' });
                setOpen(false);
              }}
              className="w-12 h-12 rounded-xl bg-white cursor-pointer flex items-center justify-center overflow-hidden"
              title={CTP_TYPE_DISPLAY_NAMES[ctpType] || ctpType}
            >
              <CTPBadge ctpType={ctpType} className="w-11 h-11" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
