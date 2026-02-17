import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from './types';
import { ASSETS } from './constants';
import Sidebar from './components/Sidebar';
import GameTrack from './components/GameTrack';
import GameInfo from './components/GameInfo';
import Notification from './components/Notification';
import BackgroundEffect from './components/BackgroundEffect';
import anime from 'animejs';

// Lazy load ManagementModal to avoid circular dependency/initialization issues
const ManagementModal = React.lazy(() => import('./components/ManagementModal'));

// Hooks
import { usePersistence } from './hooks/usePersistence';
import { useAudio } from './hooks/useAudio';
import { useAtmosphere } from './hooks/useAtmosphere';
import { usePerformance } from './hooks/usePerformance';
import { useTranslation } from './hooks/useTranslation';

const App: React.FC = () => {
  // --- Custom Hooks ---
  const { categories, setCategories, isDataLoaded, taskbarMargin, setTaskbarMargin, isBackendOnline } = usePersistence();
  const { playSfx } = useAudio();
  const { isPaused } = usePerformance();
  const { t } = useTranslation();

  // --- Local UI State ---
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [appState, setAppState] = useState('idle' as AppState);
  const [notification, setNotification] = useState<string | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [postLaunchNav, setPostLaunchNav] = useState(false);
  const konamiRef = useRef<string[]>([]);

  const launchTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const trackWrapperRef = useRef<HTMLDivElement>(null);

  // --- Derived State (Recent Games) ---
  const displayCategories = React.useMemo(() => {
    // 1. Get all unique games that have been played
    const allGamesMap = new Map();
    categories.forEach(c => {
      // STRICT FILTER: Exclude hidden/secret games unless unlocked
      if ((c.id === 'hidden' || c.id === 'secret') && !isSecretUnlocked) return;
      if (c.id === 'recent') return;

      c.games.forEach(g => {
        if (g.lastPlayed) allGamesMap.set(g.id, g);
      });
    });

    const recentGames = Array.from(allGamesMap.values())
      .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
      .slice(0, 10);

    // 2. Find if 'recent' category exists in state, otherwise create default
    const storedRecent = categories.find(c => c.id === 'recent');

    const recentCategory = {
      id: 'recent',
      name: storedRecent?.name || t('app.recent'),
      icon: storedRecent?.icon || ASSETS.templates.icon,
      color: storedRecent?.color || '#00ffcc',
      games: recentGames,
      enabled: storedRecent?.enabled ?? true,
      wallpaper: storedRecent?.wallpaper || '',
      wallpaperMode: storedRecent?.wallpaperMode || 'cover',
      gridOpacity: storedRecent?.gridOpacity ?? 0.15,
      cardOpacity: storedRecent?.cardOpacity ?? 0.7
    };

    // Placeholder if empty
    if (recentGames.length === 0) {
      recentCategory.games = [{
        id: 'placeholder_recent',
        title: t('app.no_recent_activity'),
        cover: ASSETS.templates.icon,
        banner: '',
        logo: '',
        execPath: '',
        source: 'manual'
      } as any];
    }

    // Insert RECENT after ALL (index 1) if ALL exists at 0
    const newCats = categories.filter(c => c.id !== 'recent'); // Remove old recent from list to re-insert

    const allIndex = newCats.findIndex(c => c.id === 'all');
    if (allIndex !== -1) {
      newCats.splice(allIndex + 1, 0, recentCategory as any);
    } else {
      newCats.unshift(recentCategory as any);
    }

    // Filter visible categories for rendering (redundant strictly speaking but safe)
    return newCats.filter(c => c.enabled !== false && (c.id !== 'hidden' || isSecretUnlocked));
  }, [categories, isSecretUnlocked, t]);

  // Computed
  const currentCategory = displayCategories[currentCatIndex] || displayCategories[0];
  const games = currentCategory?.games || [];
  const activeGame = games[activeGameIndex];

  const { atmosphereSettings, resolveAsset } = useAtmosphere(categories, currentCategory, activeGame);

  // Clamp indices
  useEffect(() => {
    if (displayCategories.length === 0) return;
    if (currentCatIndex >= displayCategories.length) {
      setCurrentCatIndex(Math.max(0, displayCategories.length - 1));
    }
    const currentCat = displayCategories[currentCatIndex];
    if (currentCat && activeGameIndex >= (currentCat.games?.length || 0)) {
      setActiveGameIndex(Math.max(0, (currentCat.games?.length || 1) - 1));
    }
  }, [displayCategories, currentCatIndex, activeGameIndex]);

  const switchCategory = useCallback(async (newIdx: number, direction: 'up' | 'down') => {
    if (appState !== 'idle') return;

    if (newIdx === currentCatIndex) {
      if (activeGameIndex !== 0) {
        setActiveGameIndex(0);
        playSfx('move');
      }
      return;
    }

    setAppState('transitioning');
    playSfx('move');
    const moveDist = direction === 'down' ? -40 : 40;
    await (anime as any)({
      targets: trackWrapperRef.current,
      translateY: [0, moveDist],
      opacity: [1, 0],
      duration: 250,
      easing: 'easeInQuint'
    }).finished;

    setCurrentCatIndex(newIdx);
    setActiveGameIndex(0); // Reset game index when switching category
    await new Promise(r => setTimeout(r, 20));
    (anime as any)({
      targets: trackWrapperRef.current,
      translateY: [-moveDist, 0],
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutExpo'
    });
    setAppState('idle');
  }, [appState, currentCatIndex, activeGameIndex, displayCategories.length, playSfx]);

  // --- Auto-Lock Protocol (Phase 16) ---
  const lockSecret = useCallback(() => {
    setIsSecretUnlocked(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    // Auto-Exit: If we are in the hidden category, go back to ALL
    if (categories[currentCatIndex]?.id === 'hidden') {
      const allIdx = categories.findIndex(c => c.id === 'all');
      switchCategory(allIdx !== -1 ? allIdx : 0, 'up');
    }
  }, [categories, currentCatIndex, switchCategory]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    if (!isSecretUnlocked) return;

    inactivityTimerRef.current = window.setTimeout(() => {
      lockSecret();
    }, 300000); // 5 minutes
  }, [isSecretUnlocked, lockSecret]);

  useEffect(() => {
    if (isSecretUnlocked) {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [isSecretUnlocked, resetInactivityTimer]);

  const handleLaunchRequest = useCallback(() => {
    if (!activeGame) return;
    if (appState === 'priming') {
      if (launchTimerRef.current) window.clearTimeout(launchTimerRef.current);
      setAppState('idle');
      playSfx('cancel');
      setNotification(t('app.launch_aborted'));
      setTimeout(() => setNotification(null), 1500);
      return;
    }
    setAppState('priming');
    playSfx('select');
    launchTimerRef.current = window.setTimeout(async () => {
      setAppState('launching');
      playSfx('launch');
      // LOCK SECRET ON LAUNCH (Phase 16)
      if (isSecretUnlocked) lockSecret();
      setNotification(`${t('app.launch_protocol')}::${activeGame.title}`);

      // Optimistic Update for Recent Games
      const now = new Date().toISOString();
      setCategories(prev => prev.map(c => {
        const gameExists = c.games.some(g => g.id === activeGame.id);
        if (!gameExists) return c;
        return {
          ...c,
          games: c.games.map(g => g.id === activeGame.id ? { ...g, lastPlayed: now } : g)
        };
      }));

      if (activeGame.execPath) {
        // NodeJS Server Logic - Launch EVERYTHING through backend to avoid sandbox
        try {
          const response = await fetch('/api/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: activeGame.execPath,
              args: activeGame.execArgs,
              gameId: activeGame.id
            })
          });

          if (!response.ok) throw new Error('SERVER_LINK_FAILURE');
        } catch (error) {
          console.error("SERVER EXECUTION FAILED:", error);
          setNotification(t('app.server_offline'));
        }
      }

      setTimeout(() => {
        setAppState('idle');

        // Trigger Navigation via Effect (Avoids Closure Staleness)
        setPostLaunchNav(true);

        setTimeout(() => setNotification(null), 2000); // Shortened duration
      }, 500);
    }, 1500);
  }, [appState, activeGame, playSfx, isSecretUnlocked, lockSecret]);

  // Handle Post-Launch Navigation
  useEffect(() => {
    if (!postLaunchNav) return;

    const recentIdx = displayCategories.findIndex(c => c.id === 'recent');
    if (recentIdx !== -1) {
      setCurrentCatIndex(recentIdx);
      setActiveGameIndex(0);
    }
    setPostLaunchNav(false);
  }, [postLaunchNav, displayCategories]);


  // Konami Code Listener
  useEffect(() => {
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    const handleKonami = (e: KeyboardEvent) => {
      if (isSecretUnlocked) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      konamiRef.current = [...konamiRef.current, key].slice(-sequence.length);

      if (JSON.stringify(konamiRef.current) === JSON.stringify(sequence)) {
        setIsSecretUnlocked(true);
        playSfx('select');
        setNotification(t('app.phantom_unlocked'));
        setTimeout(() => setNotification(null), 2000); // FIXED: Auto-hide after 2s
        resetInactivityTimer();
      }
    };
    window.addEventListener('keydown', handleKonami);
    return () => window.removeEventListener('keydown', handleKonami);
  }, [isSecretUnlocked, playSfx, resetInactivityTimer]);


  // Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore management or game-launching focus
      if (isManagementOpen) return;
      if (appState === 'priming' && e.key !== 'Enter') return;

      // Use displayCategories for navigation to ensure sync
      const visibleCategories = displayCategories;
      const currentCatId = displayCategories[currentCatIndex]?.id;
      const vIdx = currentCatIndex; // Since displayCategories IS the visible list

      switch (e.key) {
        case 'ArrowRight': setActiveGameIndex(p => (p + 1) % (games.length || 1)); playSfx('move'); break;
        case 'ArrowLeft': setActiveGameIndex(p => (p - 1 + (games.length || 1)) % (games.length || 1)); playSfx('move'); break;
        case 'ArrowDown': {
          const nextIdx = (vIdx + 1) % visibleCategories.length;
          switchCategory(nextIdx, 'down');
          break;
        }
        case 'ArrowUp': {
          const nextIdx = (vIdx - 1 + visibleCategories.length) % visibleCategories.length;
          switchCategory(nextIdx, 'up');
          break;
        }
        case 'Enter': handleLaunchRequest(); break;
        default: break;
      }

      // Reset timer on any valid interaction
      if (isSecretUnlocked) resetInactivityTimer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [games.length, displayCategories, currentCatIndex, isSecretUnlocked, switchCategory, handleLaunchRequest, appState, isManagementOpen, playSfx, resetInactivityTimer]);

  if (!isDataLoaded) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white animate-spin rounded-full"></div>
        <div className="font-['Space_Mono'] text-[8px] uppercase tracking-[0.5em] animate-pulse">{t('app.initializing_core')}</div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex select-none text-white overflow-hidden bg-transparent ${atmosphereSettings.performanceMode === 'low' ? 'low-perf' : ''}`}>
      <BackgroundEffect
        color={currentCategory?.color || '#fff'}
        wallpaper={atmosphereSettings.wallpaper}
        wallpaperMode={atmosphereSettings.mode}
        gridOpacity={atmosphereSettings.gridOpacity}
        animationsEnabled={atmosphereSettings.bgAnimationsEnabled}
        gridEnabled={atmosphereSettings.gridEnabled}
        vignetteEnabled={atmosphereSettings.vignetteEnabled}
        paused={isPaused || appState === 'launching'}
        performanceMode={atmosphereSettings.performanceMode}
      />

      {atmosphereSettings.scanlineEnabled && <div className="scanline"></div>}

      {/* CORE STATUS INDICATOR */}
      <div className="absolute top-6 right-8 z-[150] flex items-center gap-3 pointer-events-none">
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-['Space_Mono'] uppercase tracking-[0.3em] opacity-40">{t('app.core_status')}</span>
          <span className={`text-[8px] font-bold uppercase tracking-widest ${isBackendOnline === true ? 'text-emerald-500' : isBackendOnline === 'checking' ? 'text-white/40' : 'text-red-500'}`}>
            {isBackendOnline === true ? t('app.online') : isBackendOnline === 'checking' ? t('app.syncing') : t('app.offline')}
          </span>
        </div>
        <div className="relative w-2 h-2">
          <div className={`absolute inset-0 rounded-full ${isBackendOnline === true ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : isBackendOnline === 'checking' ? 'bg-white/20' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'} ${isBackendOnline === true ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>

      <Sidebar
        categories={displayCategories}
        activeIndex={currentCatIndex}
        onSelect={switchCategory}
        onOpenManagement={() => setIsManagementOpen(true)}
        taskbarMargin={taskbarMargin}
        onResolveAsset={resolveAsset}
        isSecretUnlocked={isSecretUnlocked}
      />

      <main className="main-content flex-1 flex flex-col relative z-10 max-h-screen" style={{ paddingLeft: 'calc(50px + 1.5vh + 30px)' }}>
        <Notification message={notification} color={currentCategory?.color || '#fff'} />

        <div ref={trackWrapperRef} className="h-[45%] flex items-start pt-0 mt-[4vh] overflow-visible">
          {games.length > 0 ? (
            <GameTrack
              key={currentCategory?.id || 'empty'}
              games={games}
              activeIdx={activeGameIndex}
              onSelect={setActiveGameIndex}
              color={currentCategory?.color || '#fff'}
              appState={appState}
              cardOpacity={atmosphereSettings.cardOpacity}
              onResolveAsset={resolveAsset}
              onLaunch={handleLaunchRequest}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20 font-['Press_Start_2P'] text-[10px] tracking-[0.2em]">{t('app.unit_storage_empty')}</div>
          )}
        </div>
      </main >

      <GameInfo
        game={activeGame}
        color={currentCategory?.color || '#fff'}
        isLaunching={appState === 'launching' || appState === 'priming'}
        onLaunch={handleLaunchRequest}
        taskbarMargin={taskbarMargin}
        onResolveAsset={resolveAsset}
      />

      <React.Suspense fallback={null}>
        <ManagementModal
          isOpen={isManagementOpen}
          onClose={() => setIsManagementOpen(false)}
          categories={categories}
          currentCatIdx={currentCatIndex}
          onUpdateCategories={setCategories}
          accentColor={currentCategory?.color || '#fff'}
          taskbarMargin={taskbarMargin}
          onUpdateTaskbarMargin={setTaskbarMargin}
          onResolveAsset={resolveAsset}
          isSecretUnlocked={isSecretUnlocked}
        />
      </React.Suspense>
    </div >
  );
};

export default App;
