import React, { useEffect, useRef, useState } from 'react';
import { CTPBadge } from './CharacterComponents';
import { getUiText } from './i18n';
import { CTP_TYPE_DISPLAY_NAMES, CTP_TYPE_OPTIONS } from './mffTrackerUtils';

export default function CtpPicker({
  value,
  onChange,
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
  const previewContent = <CTPBadge ctpType={value} className={compact ? 'w-6 h-6' : 'w-10 h-10'} />;

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

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [open, align]);

  return (
    <div className="relative">
      <button
      type="button"
      ref={buttonRef}
      onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1 text-slate-900 cursor-pointer whitespace-nowrap ${
          secretDisplay
            ? 'px-1 py-0.5 rounded-full bg-transparent shadow-none'
            : `px-3 rounded-xl border bg-white ${compact ? 'h-8' : 'h-11'}`
        }`}
        title={label || (value || getUiText(language, 'none'))}
        aria-label={label || (value || getUiText(language, 'none'))}
      >
        {value ? (
          previewContent
        ) : (
          <span className="text-[10px] font-semibold tracking-wide text-slate-500">{getUiText(language, 'ctp')}</span>
        )}
        {!secretDisplay && <span className="text-[10px] leading-none text-slate-400">▾</span>}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="z-50 rounded-2xl border bg-white shadow-2xl p-3 grid grid-cols-4 gap-2"
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
              onChange('');
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
                onChange(ctpType);
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
