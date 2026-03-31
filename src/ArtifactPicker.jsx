import React, { useEffect, useState } from 'react';
import { getCharacterEntry } from './mffTrackerUtils';
import { DEFAULT_ARTIFACT_PREVIEW_ICON, getArtifactIconUrlBySlug } from './iconAssets';
import { getUiText } from './i18n';
import { imageExists, loadImageCached } from './iconUtils';

const ARTIFACT_AVAILABILITY_CACHE = new Map();
const ARTIFACT_AVAILABILITY_PROMISES = new Map();

function ArtifactIconImage({ src, alt, className = 'w-10 h-10' }) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    loadImageCached(src).catch(() => {
      // ignore cache population errors
    });
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`object-contain ${className}`}
      onError={() => {
        if (currentSrc !== DEFAULT_ARTIFACT_PREVIEW_ICON) {
          setCurrentSrc(DEFAULT_ARTIFACT_PREVIEW_ICON);
        }
      }}
    />
  );
}

function getCachedArtifactAvailability(slug) {
  if (!slug) return null;
  if (ARTIFACT_AVAILABILITY_CACHE.has(slug)) {
    return ARTIFACT_AVAILABILITY_CACHE.get(slug);
  }
  return null;
}

function resolveArtifactAvailability(slug) {
  if (!slug) return Promise.resolve(false);
  if (ARTIFACT_AVAILABILITY_CACHE.has(slug)) {
    return Promise.resolve(ARTIFACT_AVAILABILITY_CACHE.get(slug));
  }
  if (ARTIFACT_AVAILABILITY_PROMISES.has(slug)) {
    return ARTIFACT_AVAILABILITY_PROMISES.get(slug);
  }

  const promise = imageExists(getArtifactIconUrlBySlug(slug)).then((exists) => {
    ARTIFACT_AVAILABILITY_CACHE.set(slug, exists);
    ARTIFACT_AVAILABILITY_PROMISES.delete(slug);
    return exists;
  });

  ARTIFACT_AVAILABILITY_PROMISES.set(slug, promise);
  return promise;
}

export default function ArtifactPicker({
  name,
  enabled = 0,
  starLevel = 0,
  onToggle,
  onCycleStar,
  language = 'ko',
}) {
  const entry = getCharacterEntry(name);
  const slug = entry?.slug || '';
  const isEnabled = enabled === 1;
  const [artifactAvailable, setArtifactAvailable] = useState(() => getCachedArtifactAvailability(slug));
  const [isResolving, setIsResolving] = useState(() => Boolean(slug) && getCachedArtifactAvailability(slug) === null);

  useEffect(() => {
    let cancelled = false;

    if (!slug) {
      setArtifactAvailable(null);
      setIsResolving(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = getCachedArtifactAvailability(slug);
    if (cached !== null) {
      setArtifactAvailable(cached);
      setIsResolving(false);
      return () => {
        cancelled = true;
      };
    }

    setArtifactAvailable(null);
    setIsResolving(true);
    resolveArtifactAvailability(slug).then((exists) => {
      if (!cancelled) {
        setArtifactAvailable(exists);
        setIsResolving(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isLoading = Boolean(slug) && artifactAvailable === null && isResolving;
  const shouldShowArtifact = isEnabled && artifactAvailable === true && Boolean(slug);
  const normalizedStar = shouldShowArtifact && Number.isInteger(starLevel) && starLevel >= 3 && starLevel <= 6 ? starLevel : 3;
  const iconSrc = shouldShowArtifact ? getArtifactIconUrlBySlug(slug) : DEFAULT_ARTIFACT_PREVIEW_ICON;
  const triggerTitle = isLoading
    ? getUiText(language, 'loading')
    : shouldShowArtifact
    ? `${getUiText(language, 'artifact')} ${normalizedStar}`
    : artifactAvailable === false
      ? getUiText(language, 'artifactUnavailable')
      : getUiText(language, 'artifactNotNeeded');
  const starLabel = isLoading ? '…' : shouldShowArtifact ? `${normalizedStar}★` : '❌';
  const starTitle = isLoading
    ? getUiText(language, 'loading')
    : shouldShowArtifact
    ? `${getUiText(language, 'artifact')} ${normalizedStar}`
    : artifactAvailable === false
      ? getUiText(language, 'artifactUnavailable')
      : getUiText(language, 'artifactNotNeeded');
  const toggleDisabled = artifactAvailable === false || (isLoading && !isEnabled);
  const starDisabled = artifactAvailable === false || isLoading || (!isEnabled && artifactAvailable !== true);

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={(event) => {
          if (starDisabled) {
            return;
          }
          event.stopPropagation();
          onCycleStar?.();
        }}
        disabled={starDisabled}
        className={`inline-flex items-center justify-center min-w-7 h-6 px-1 rounded-full border text-[10px] leading-none shadow-sm cursor-pointer ${
          shouldShowArtifact
            ? 'bg-yellow-300 text-yellow-950 border-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.48)]'
            : 'bg-rose-100 text-rose-700 border-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.18)]'
        } ${starDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        title={starTitle}
        aria-label={starTitle}
      >
        {starLabel}
      </button>
      <button
        type="button"
        onClick={(event) => {
          if (toggleDisabled) {
            return;
          }
          event.stopPropagation();
          onToggle?.();
        }}
        disabled={toggleDisabled}
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden bg-white shrink-0 border border-slate-300 w-10 h-10 cursor-pointer ${
          toggleDisabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        title={triggerTitle}
        aria-label={triggerTitle}
      >
        {isLoading ? (
          <span className="w-full h-full rounded-xl bg-white border border-slate-200 flex items-center justify-center">
            <span className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-sky-500 animate-spin" />
          </span>
        ) : (
          <ArtifactIconImage src={iconSrc} alt={name} className="w-full h-full p-0.5" />
        )}
      </button>
    </span>
  );
}
