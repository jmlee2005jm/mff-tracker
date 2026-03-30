import React, { useEffect, useState } from 'react';
import MFFTrackerUI from './MFFTrackerUI';
import {
  UNIFORM_BOOTSTRAP_KEY,
  bootstrapUniformAssets,
  resetUniformBootstrapCache,
} from './uniformBootstrap';

let bootstrapPromise = null;

export default function App() {
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [bootstrapPhase, setBootstrapPhase] = useState(() => {
    try {
      return window.localStorage.getItem(UNIFORM_BOOTSTRAP_KEY) === 'done' ? 'hidden' : 'loading';
    } catch {
      return 'loading';
    }
  });
  const [bootstrapCycle, setBootstrapCycle] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let doneTimerId = null;

    async function runBootstrap() {
      const shouldBootstrap = (() => {
        try {
          return window.localStorage.getItem(UNIFORM_BOOTSTRAP_KEY) !== 'done';
        } catch {
          return true;
        }
      })();

      if (!shouldBootstrap) {
        setBootstrapPhase('hidden');
        return;
      }

      setProgress({ loaded: 0, total: 0 });
      setBootstrapPhase('loading');
      bootstrapPromise = null;
      bootstrapPromise =
        bootstrapUniformAssets((loaded, total) => {
          setProgress({ loaded, total });
        });

      try {
        await bootstrapPromise;
        if (!cancelled) {
          window.localStorage.setItem(UNIFORM_BOOTSTRAP_KEY, 'done');
          setBootstrapPhase('done');
          doneTimerId = window.setTimeout(() => {
            if (!cancelled) {
              setBootstrapPhase('hidden');
            }
          }, 10000);
        }
      } catch {
        if (!cancelled) {
          setBootstrapPhase('hidden');
        }
      }
    }

    runBootstrap();

    return () => {
      cancelled = true;
      if (doneTimerId) {
        window.clearTimeout(doneTimerId);
      }
    };
  }, [bootstrapCycle]);

  const refreshBootstrapCache = () => {
    resetUniformBootstrapCache();
    bootstrapPromise = null;
    setProgress({ loaded: 0, total: 0 });
    setBootstrapPhase('loading');
    setBootstrapCycle((current) => current + 1);
  };

  return (
    <MFFTrackerUI
      bootstrapStatus={{
        phase: bootstrapPhase,
        loaded: progress.loaded,
        total: progress.total,
      }}
      onRefreshBootstrap={refreshBootstrapCache}
    />
  );
}
