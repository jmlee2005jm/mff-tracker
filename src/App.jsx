import React, { useEffect, useState } from 'react';
import MFFTrackerUI from './MFFTrackerUI';
import { UNIFORM_BOOTSTRAP_KEY, bootstrapUniformAssets } from './uniformBootstrap';

let bootstrapPromise = null;

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-6">
      <div className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-8 space-y-5">
        <h1 className="text-2xl font-bold text-center">아이콘 캐시를 준비하는 중</h1>
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
          <style>{`
            @keyframes loadingSweep {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(420%); }
            }
          `}</style>
          <div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-slate-900/80"
            style={{ animation: 'loadingSweep 1.2s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(() => {
    try {
      return window.localStorage.getItem(UNIFORM_BOOTSTRAP_KEY) === 'done';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (ready) return;

    let cancelled = false;

    async function runBootstrap() {
      bootstrapPromise =
        bootstrapPromise ||
        bootstrapUniformAssets();

      try {
        await bootstrapPromise;
        if (!cancelled) {
          window.localStorage.setItem(UNIFORM_BOOTSTRAP_KEY, 'done');
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    runBootstrap();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return <MFFTrackerUI />;
}
