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
const ModularModal = React.lazy(() => import('./components/modular/ModularModal'));
const ModularHeader = React.lazy(() => import('./components/modular/ModularHeader'));
const ModularSystemModule = React.lazy(() => import('./components/modular/modules/ModularSystemModule'));
const ModularIntegrationsModule = React.lazy(() => import('./components/modular/modules/ModularIntegrationsModule'));
const ModularCategoriesModule = React.lazy(() => import('./components/modular/modules/ModularCategoriesModule'));
const ModularGamesModule = React.lazy(() => import('./components/modular/modules/ModularGamesModule'));
const SteamSync = React.lazy(() => import('./components/modular/sync/SteamSync'));
const XboxSync = React.lazy(() => import('./components/modular/sync/XboxSync'));
const EmuSync = React.lazy(() => import('./components/modular/sync/EmuSync'));
const ModularExplorerModule = React.lazy(() => import('./components/modular/fileexplorer/ModularExplorerModule'));

// Hooks
import { usePersistence } from './hooks/usePersistence';
import { useAudio } from './hooks/useAudio';
import { useAtmosphere } from './hooks/useAtmosphere';
import { usePerformance } from './hooks/usePerformance';
import { useTranslation } from './hooks/useTranslation';
import { useKonami } from './hooks/useKonami';
import { useLibrary } from './hooks/useLibrary';
import { useColor } from './hooks/useColor';
import { useManagement } from './hooks/useManagement';
import FileExplorerModal from './components/FileExplorerModal';

const App: React.FC = () => {
  // --- Custom Hooks ---
  const { categories, setCategories, isDataLoaded, taskbarMargin, setTaskbarMargin, uiScale, setUIScale, isBackendOnline } = usePersistence();
  const { playSfx } = useAudio();
  const { isPaused } = usePerformance();
  const { t } = useTranslation();
  const { resolve: resolveColor, isMonochrome } = useColor(categories);

  // --- Local UI State ---
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [appState, setAppState] = useState('idle' as AppState);
  const [notification, setNotification] = useState<string | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isModularOpen, setIsModularOpen] = useState(false);
  const [activeModularModule, setActiveModularModule] = useState<'system' | 'integrations' | 'categories' | 'games' | 'explorer'>('system');
  const [emuPath, setEmuPath] = useState('');
  const [romsDir, setRomsDir] = useState('');
  const [emuIcon, setEmuIcon] = useState('');
  const [explorer, setExplorer] = useState<{ isOpen: boolean; target: string; filter: 'exe' | 'image' | 'folder' | 'any'; initialPath?: string }>({
    isOpen: false,
    target: '',
    filter: 'any',
    initialPath: undefined
  });
  const [explorerMode, setExplorerMode] = useState<'browse' | 'select-file' | 'select-folder' | 'select-image'>('browse');
  const [explorerSelectedPath, setExplorerSelectedPath] = useState<string | null>(null);
  const [lastModularModule, setLastModularModule] = useState<'system' | 'integrations' | 'categories' | 'games' | 'explorer'>('system');
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void; isDanger?: boolean } | null>(null);

  const [postLaunchNav, setPostLaunchNav] = useState(false);
  const [initialNavDone, setInitialNavDone] = useState(false);
  const [assetVersion, setAssetVersion] = useState(0);
  const [activeCommand, setActiveCommand] = useState<{ text: string, desc: string } | null>(null);
  const [activeExecute, setActiveExecute] = useState<(() => void) | undefined>(undefined);
  const [activeProgress, setActiveProgress] = useState<number>(0);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
  const [explorerCurrentPath, setExplorerCurrentPath] = useState('C:/'); // Default to C:/
  const [drives, setDrives] = useState<string[]>([]);
  const [libraries, setLibraries] = useState<{ name: string, path: string }[]>([]);
  const [modularScrollProgress, setModularScrollProgress] = useState(0);
  const [showModularScrollMarker, setShowModularScrollMarker] = useState(false);
  const lastUnlockedRef = useRef(false);

  const modularScrollRef = useRef<HTMLDivElement>(null);

  const bumpAssetVersion = useCallback(() => setAssetVersion(v => v + 1), []);

  const launchTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const trackWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = modularScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight > clientHeight) {
        setShowModularScrollMarker(true);
        setModularScrollProgress(scrollTop / (scrollHeight - clientHeight));
      } else {
        setShowModularScrollMarker(false);
      }
    };

    handleScroll(); // Initial check
    const timeout = setTimeout(handleScroll, 150); // Second check for layout shifts

    el.addEventListener('scroll', handleScroll);

    const obs = new ResizeObserver(handleScroll);
    obs.observe(el);

    return () => {
      clearTimeout(timeout);
      el.removeEventListener('scroll', handleScroll);
      obs.disconnect();
    };
  }, [activeModularModule, explorerCurrentPath]); // Recalculate when module or path changes


  const { isSecretUnlocked, setIsSecretUnlocked } = useKonami(
    () => {
      const rand = Math.floor(Math.random() * 40);
      setNotification(`SECRET::${t(`secret_phrases.phrase_${rand}`)}`);
      setTimeout(() => setNotification(null), 3000);
    },
    playSfx
  );

  const { displayCategories } = useLibrary(categories, isSecretUnlocked, t);

  // --- Management Protocol ---
  const handleModularClose = useCallback(() => {
    // Modals stay open in modular view or context-specific logic
  }, []);

  const {
    handleSyncSteamLibrary,
    handleSyncXboxLibrary,
    handleSyncEmuLibrary,
    handleWipeMasterRegistry,
    handleCreateCategory,
    handleDeleteCategory,
    handleMoveCategory,
    handleMoveGameInCategory,
    handleToggleGameInCategory,
    handleFetchMissingAssets,
    handleDeleteGame,
    handleSaveGame,
    handleImportAsset,
    slugify
  } = useManagement({
    categories,
    onUpdateCategories: setCategories,
    onUpdateTaskbarMargin: setTaskbarMargin,
    onUpdateUIScale: setUIScale,
    bumpAssetVersion,
    onNotification: setNotification,
    onClose: handleModularClose
  });

  const requestConfirmation = (message: string, onConfirm: () => void, isDanger: boolean = true) => {
    setConfirmData({
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmData(null);
      },
      isDanger
    });
  };

  const triggerFileBrowser = (target: string, type: string) => {
    const filter: any = type === 'folder' ? 'folder' : (type === 'exe' ? 'exe' : 'image');

    if (isModularOpen) {
      // Internal Modular Selection Mode
      setLastModularModule(activeModularModule);
      setActiveModularModule('explorer');
      setExplorerMode(type === 'folder' ? 'select-folder' : (type === 'exe' ? 'select-file' : 'select-image'));
      setExplorerSelectedPath(null);
      setExplorer(prev => ({ ...prev, target })); // Still use explorer.target to know where to save
    } else {
      // Legacy Modal Mode
      setExplorer({
        isOpen: true,
        target,
        filter,
        initialPath: type === 'exe' ? 'DESKTOP' : (type === 'image' ? 'PICTURES' : undefined)
      });
    }
  };

  const handleExplorerSelect = (path: string) => {
    if (!path) return;

    if (explorer.target === 'emuPath') setEmuPath(path);
    if (explorer.target === 'romsDir') setRomsDir(path);
    if (explorer.target === 'emuIcon') setEmuIcon(path);

    // If coming from modular selection, go back
    if (explorerMode !== 'browse') {
      setActiveModularModule(lastModularModule);
      setExplorerMode('browse');
      setExplorerSelectedPath(null);
    } else {
      setExplorer(prev => ({ ...prev, isOpen: false }));
    }
  };

  // Computed
  const currentCategory = displayCategories[currentCatIndex] || displayCategories[0];
  const games = currentCategory?.games || [];
  const activeGame = games[activeGameIndex];

  const { atmosphereSettings, resolveAsset } = useAtmosphere(categories, currentCategory, activeGame, isManagementOpen, assetVersion);

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

  useEffect(() => {
    setActiveCommand(null);
    setActiveExecute(undefined);
    setActiveProgress(0);
  }, [activeModularModule]);

  const activeExecuteRef = useRef<(() => void) | undefined>(undefined);

  const handleCommandUpdate = useCallback((cmd: any, exec: any, progress: any) => {
    // 1. Silent update for the executor to avoid loops
    if (exec !== undefined) {
      activeExecuteRef.current = exec;
    }

    // 2. Controlled update for visual state
    setActiveCommand(prev => {
      if (JSON.stringify(prev) === JSON.stringify(cmd)) {
        if (progress !== undefined) {
          setActiveProgress(p => p === progress ? p : progress);
        }
        return prev;
      }

      // Command changed, update progress too
      if (progress !== undefined) {
        setActiveProgress(progress);
      }
      return cmd;
    });
  }, []);

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
      duration: 150,
      easing: 'easeInQuint'
    }).finished;

    setCurrentCatIndex(newIdx);
    setActiveGameIndex(0); // Reset game index when switching category
    await new Promise(r => setTimeout(r, 20));
    (anime as any)({
      targets: trackWrapperRef.current,
      translateY: [-moveDist, 0],
      opacity: [0, 1],
      duration: 250,
      easing: 'easeOutExpo'
    });
    setAppState('idle');
  }, [appState, currentCatIndex, activeGameIndex, displayCategories.length, playSfx]);

  // --- Auto-Lock Protocol (Phase 16) ---
  const lockSecret = useCallback((isLaunching = false) => {
    setIsSecretUnlocked(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    // Auto-Exit: If we are in the hidden category, go back to ALL (unless we are launching)
    if (displayCategories[currentCatIndex]?.id === 'hidden') {
      if (isLaunching) return;

      const allIdx = displayCategories.findIndex(c => c.id === 'all');
      switchCategory(allIdx !== -1 ? allIdx : 0, 'up');
    }
  }, [displayCategories, currentCatIndex, switchCategory, setIsSecretUnlocked]);

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
      // Auto-navigate to the hidden/secret category ONLY ONCE per unlock
      if (!lastUnlockedRef.current) {
        const hiddenIdx = displayCategories.findIndex(c => c.id === 'hidden');
        if (hiddenIdx !== -1 && hiddenIdx !== currentCatIndex) {
          const dir = hiddenIdx > currentCatIndex ? 'down' : 'up';
          switchCategory(hiddenIdx, dir);
        }
        lastUnlockedRef.current = true;
      }
    } else {
      lastUnlockedRef.current = false;
    }
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [isSecretUnlocked, resetInactivityTimer]);

  useEffect(() => {
    if (isModularOpen) {
      fetch('/api/files/drives')
        .then(res => res.json())
        .then(data => {
          setDrives(data.drives || []);
          setLibraries(data.libraries || []);
        })
        .catch(err => console.error("Failed to fetch drives", err));
    }
  }, [isModularOpen]);

  const handleLaunchRequest = useCallback(() => {
    if (!activeGame) return;

    if (appState === 'priming') {
      console.log("[App] Launch aborted by user.");
      if (launchTimerRef.current) window.clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
      setAppState('idle');
      playSfx('cancel');
      setNotification(t('app.launch_aborted'));
      setTimeout(() => setNotification(null), 1500);
      return;
    }

    console.log("[App] Preparing launch protocol for:", activeGame.title);
    setAppState('priming');
    playSfx('select');
    launchTimerRef.current = window.setTimeout(async () => {
      setAppState('launching');
      playSfx('launch');
      // LOCK SECRET ON LAUNCH (Phase 16) - SKIP REDIRECT TO ALL
      if (isSecretUnlocked) lockSecret(true);
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

  // Handle Initial Navigation to Recent
  useEffect(() => {
    if (isDataLoaded && !initialNavDone && displayCategories.length > 0) {
      const recentIdx = displayCategories.findIndex(c => c.id === 'recent');
      if (recentIdx !== -1) {
        setCurrentCatIndex(recentIdx);
      }
      setInitialNavDone(true);
    }
  }, [isDataLoaded, initialNavDone, displayCategories]);

  // --- Phase 5: Auto-Sync SSE Listener ---
  useEffect(() => {
    if (!isBackendOnline) return;

    // Use relative path so it correctly resolves via Vite proxy in dev, and absolute port in prod if needed.
    const isDev = (import.meta as any).env?.DEV;
    const baseUrl = isDev ? '' : 'http://127.0.0.1:3000';
    const source = new EventSource(`${baseUrl}/api/sync/events`);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ASSET_CHANGED') {
          console.log('[Sync] Asset change detected (Chokidar), busting cache...', data.path);
          bumpAssetVersion();
        }
      } catch (e) {
        console.error('[Sync] SSE parse failed:', e);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [isBackendOnline, bumpAssetVersion]);

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
    <div
      className={`relative w-full h-full flex select-none text-white overflow-hidden bg-transparent ${atmosphereSettings.performanceMode === 'low' ? 'low-perf' : ''} ${atmosphereSettings.performanceMode === 'high' ? 'high-perf' : ''}`}
      style={{
        transform: `scale(${uiScale})`,
        transformOrigin: 'top left',
        width: `${100 / uiScale}vw`,
        height: `${100 / uiScale}vh`,
      }}
    >
      <BackgroundEffect
        color={currentCategory?.color || '#fff'}
        gameWallpaper={activeGame?.wallpaper}
        categoryWallpaper={currentCategory?.wallpaper}
        globalWallpaper={categories.find(c => c.id === 'all')?.wallpaper || ASSETS.ui.wallpaper}
        wallpaperMode={atmosphereSettings.mode}
        gridOpacity={atmosphereSettings.gridOpacity}
        bgAnimationsEnabled={atmosphereSettings.bgAnimationsEnabled}
        gridEnabled={atmosphereSettings.gridEnabled}
        vignetteEnabled={atmosphereSettings.vignetteEnabled}
        paused={isPaused || appState === 'launching'}
        wallpaperAAEnabled={atmosphereSettings.wallpaperAAEnabled}
        highQualityBlobs={atmosphereSettings.highQualityBlobs}
        isLowRes={atmosphereSettings.lowResWallpaper}
        performanceMode={atmosphereSettings.performanceMode}
      />

      {atmosphereSettings.scanlineEnabled && <div className="scanline"></div>}

      {/* CORE STATUS INDICATOR */}
      <div className="absolute top-6 right-8 z-[150] flex items-center gap-3 pointer-events-none">
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-['Space_Mono'] uppercase tracking-[0.3em] opacity-40">{t('app.core_status')}</span>
          <span className={`text-[8px] font-bold uppercase tracking-widest`} style={{ color: resolveColor(isBackendOnline === true ? '#10b981' : isBackendOnline === 'checking' ? 'rgba(255,255,255,0.4)' : '#ef4444') }}>
            {isBackendOnline === true ? t('app.online') : isBackendOnline === 'checking' ? t('app.syncing') : t('app.offline')}
          </span>
        </div>
        <div className="relative w-2 h-2">
          <div className={`absolute inset-0 rounded-full ${isBackendOnline === true ? 'animate-pulse' : ''}`} style={{ backgroundColor: resolveColor(isBackendOnline === true ? '#10b981' : isBackendOnline === 'checking' ? 'rgba(255,255,255,0.2)' : '#ef4444'), boxShadow: `0 0 10px ${resolveColor(isBackendOnline === true ? '#10b981' : '#00000000')}` }}></div>
        </div>
      </div>

      <Sidebar
        categories={displayCategories}
        activeIndex={currentCatIndex}
        onSelect={(idx) => switchCategory(idx, idx > currentCatIndex ? 'down' : 'up')}
        onOpenManagement={() => {
          setIsManagementOpen(true);
          playSfx('select');
        }}
        onOpenModularTest={() => {
          setIsModularOpen(true);
          playSfx('select');
        }}
        taskbarMargin={taskbarMargin}
        onResolveAsset={resolveAsset}
        isSecretUnlocked={isSecretUnlocked}
        performanceMode={atmosphereSettings.performanceMode}
        resolveColor={resolveColor}
      />

      <main className="main-content flex-1 flex flex-col relative z-10 max-h-screen" style={{ paddingLeft: 'calc(50px + 1.5vh + 30px)' }}>
        <Notification message={notification} color={resolveColor(currentCategory?.color || '#fff')} />

        <div ref={trackWrapperRef} className="h-[45%] flex items-start pt-0 mt-[4vh] overflow-visible">
          {games.length > 0 ? (
            <GameTrack
              key={currentCategory?.id || 'empty'}
              games={games}
              activeIdx={activeGameIndex}
              onSelect={setActiveGameIndex}
              color={resolveColor(currentCategory?.color || '#fff')}
              appState={appState}
              cardBlurEnabled={atmosphereSettings.cardBlurEnabled}
              cardTransparencyEnabled={atmosphereSettings.cardTransparencyEnabled}
              cardOpacity={atmosphereSettings.cardOpacity}
              onResolveAsset={resolveAsset}
              onLaunch={handleLaunchRequest}
              performanceMode={atmosphereSettings.performanceMode}
              innerGlowEnabled={atmosphereSettings.innerGlowEnabled}
              outerGlowEnabled={atmosphereSettings.outerGlowEnabled}
              slimModeEnabled={atmosphereSettings.slimModeEnabled}
              primingAnimation={atmosphereSettings.primingAnimation}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20 font-['Press_Start_2P'] text-[10px] tracking-[0.2em]">{t('app.unit_storage_empty')}</div>
          )}
        </div>
      </main >

      <GameInfo
        game={activeGame}
        color={resolveColor(currentCategory?.color || '#fff')}
        isLaunching={appState === 'launching' || appState === 'priming'}
        onLaunch={handleLaunchRequest}
        taskbarMargin={taskbarMargin}
        onResolveAsset={resolveAsset}
        performanceMode={atmosphereSettings.performanceMode}
      />

      <React.Suspense fallback={null}>
        <ManagementModal
          isOpen={isManagementOpen}
          onClose={() => setIsManagementOpen(false)}
          categories={categories}
          currentCatIdx={currentCatIndex}
          onUpdateCategories={setCategories}
          accentColor={resolveColor(currentCategory?.color || '#fff')}
          taskbarMargin={taskbarMargin}
          onUpdateTaskbarMargin={setTaskbarMargin}
          uiScale={uiScale}
          onUpdateUIScale={setUIScale}
          onResolveAsset={resolveAsset}
          bumpAssetVersion={bumpAssetVersion}
          isSecretUnlocked={isSecretUnlocked}
          resolveColor={resolveColor}
          onNotification={setNotification}
        />
        {isModularOpen && (() => {
          const getBaseColor = (mod: string) => {
            if (mod === 'games') return '#00ff00';
            if (mod === 'explorer') return categories[currentCatIndex]?.color || '#00ffcc';
            return '#00ffcc';
          };

          const currentModularAccent = activeModularModule === 'explorer'
            ? getBaseColor(lastModularModule)
            : getBaseColor(activeModularModule);

          const resolvedModularAccent = resolveColor(currentModularAccent);
          return (
            <ModularModal
              isOpen={isModularOpen}
              onClose={() => {
                if (activeModularModule === 'explorer') {
                  setActiveModularModule(lastModularModule);
                } else {
                  setIsModularOpen(false);
                }
                playSfx('close');
              }}
              accentColor={resolvedModularAccent}
              commandText={
                explorerMode === 'select-file' ? 'CONFIRM_SELECTION' :
                  explorerMode === 'select-folder' ? 'CONFIRM_DIRECTORY' :
                    explorerMode === 'select-image' ? 'CONFIRM_IMAGE' :
                      activeCommand?.text || (
                        activeModularModule === 'system' ? 'SYS_AUDIT' :
                          activeModularModule === 'integrations' ? 'API_HANDSHAKE' :
                            activeModularModule === 'categories' ? 'CATALOG_INDEX' :
                              activeModularModule === 'games' ? 'PROTOCOL_HUB' :
                                activeModularModule === 'explorer' ? 'FS_SURVEILLANCE' : 'UNKNOWN'
                      )
              }
              commandDesc={
                explorerMode !== 'browse' ? `SELeCCIONA EL ELEMENTO DESEADO Y PRESIONA EXECUTE PARA VINCULAR. RUTA_ACTUAL::${explorerSelectedPath || explorerCurrentPath}` :
                  activeCommand?.desc || (
                    activeModularModule === 'system' ? 'MONITOR DE RECURSOS Y ESTADO DEL NUCLEO.' :
                      activeModularModule === 'integrations' ? 'GESTION DE SERVICIOS EXTERNOS Y SINCRONIZACION.' :
                        activeModularModule === 'categories' ? 'ORGANIZACION GEOMETRICA DE LA BIBLIOTECA.' :
                          activeModularModule === 'games' ? 'HUB DE PROTOCOLOS DE SINCRONIZACION DE JUEGOS.' :
                            activeModularModule === 'explorer' ? 'EXPLORADOR DE ARCHIVOS Y NODOS DE ALMACENAMIENTO.' : 'FALLBACK_PROTOCOL_ACTIVE.'
                  )
              }
              onExecute={
                explorerMode !== 'browse'
                  ? () => handleExplorerSelect(explorerSelectedPath || explorerCurrentPath)
                  : () => activeExecuteRef.current?.()
              }
              progress={activeProgress}
              scrollProgress={modularScrollProgress}
              showScrollMarker={showModularScrollMarker}
            >
              <ModularHeader
                title="MODULAR_RECONSTRUCTION_ALPHA"
                accentColor={resolvedModularAccent}
                onClose={() => {
                  if (activeModularModule === 'explorer') {
                    setActiveModularModule(lastModularModule);
                  } else {
                    setIsModularOpen(false);
                  }
                }}
                t={t}
                style={{ backgroundColor: `${resolvedModularAccent}26` }}
              />
              <div className="flex flex-1 overflow-hidden">
                {/* Modular Sidebar - Contextual Navigation */}
                <div
                  className="w-[220px] flex flex-col pt-0 shrink-0 relative z-[40] overflow-y-scroll custom-scrollbar"
                  style={{ backgroundColor: `${resolvedModularAccent}26` }}
                >
                  <div className="flex flex-col w-full">
                    {/* Primary Application Modules (EXPLORER removed from main sequential list) */}
                    {['system', 'integrations', 'categories', 'games'].map(mod => {
                      const isActive = activeModularModule === mod;
                      // Only hide other modules when in EXPLORER to focus on drives/vaults
                      if (activeModularModule === 'explorer') return null;

                      return (
                        <div
                          key={mod}
                          onClick={() => {
                            setActiveModularModule(mod as any);
                            playSfx('move');
                          }}
                          className={`w-full py-[18px] px-[20px] transition-all duration-150 font-['Space_Mono'] font-bold text-[10px] uppercase tracking-[0.3em] flex items-center cursor-pointer mb-0`}
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.40)',
                          }}
                        >
                          <div className={`w-[2px] h-[12px] mr-3 transition-all ${isActive ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: resolvedModularAccent }} />
                          {mod === 'games' ? 'SYNC_CORE' : mod.toUpperCase()}
                        </div>
                      );
                    })}

                    {/* Active EXPLORER header when in explorer mode */}
                    {activeModularModule === 'explorer' && (
                      <div
                        className={`w-full py-[18px] px-[20px] transition-all duration-150 font-['Space_Mono'] font-bold text-[10px] uppercase tracking-[0.3em] flex items-center mb-0 bg-white/10 text-white`}
                      >
                        <div className={`w-[2px] h-[12px] mr-3 opacity-100`} style={{ backgroundColor: resolvedModularAccent }} />
                        EXPLORER
                      </div>
                    )}

                    {/* Explorer Specific Sub-Items */}
                    {activeModularModule === 'explorer' && (
                      <>
                        <div className="h-[1px] w-full bg-white/5 my-2" />
                        <span className="text-[7px] font-black tracking-[0.3em] opacity-30 px-[20px] uppercase text-white/50 mb-2 mt-2">STORAGE_NODES</span>
                        {drives.map(drive => {
                          const isActive = explorerCurrentPath.startsWith(drive);
                          return (
                            <div
                              key={drive}
                              onClick={() => {
                                setExplorerCurrentPath(drive);
                              }}
                              className={`w-full py-[12px] px-[20px] transition-all duration-150 font-['Space_Mono'] font-bold text-[9px] uppercase tracking-[0.2em] flex items-center cursor-pointer mb-0`}
                              style={{
                                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.40)'
                              }}
                            >
                              <div className={`w-[1px] h-[8px] mr-3 transition-all ${isActive ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundColor: resolvedModularAccent }} />
                              VOLUME::{drive}
                            </div>
                          );
                        })}

                        <span className="text-[7px] font-black tracking-[0.3em] opacity-30 px-[20px] uppercase text-white/50 mb-2 mt-4">USER_VAULTS</span>
                        {libraries.map(lib => {
                          const isActive = explorerCurrentPath === lib.path;
                          return (
                            <div
                              key={lib.path}
                              onClick={() => {
                                setExplorerCurrentPath(lib.path);
                              }}
                              className={`w-full py-[12px] px-[20px] transition-all duration-150 font-['Space_Mono'] font-bold text-[9px] uppercase tracking-[0.2em] flex items-center cursor-pointer mb-0`}
                              style={{
                                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.40)'
                              }}
                            >
                              <div className={`w-[1px] h-[8px] mr-3 transition-all ${isActive ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundColor: resolvedModularAccent }} />
                              {lib.name.toUpperCase()}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Module Content Area - Green Zone (Transparent) */}
                <div className="flex-1 flex flex-col overflow-hidden relative mt-0 mb-[88px] bg-transparent">
                  <React.Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono opacity-20 uppercase tracking-widest text-[10px]">Loading Module...</div>}>
                    {activeModularModule === 'games' ? (
                      <div ref={modularScrollRef} className="flex flex-col overflow-y-auto custom-scrollbar flex-1 pl-[18px] pr-[52px] pt-[18px] pb-0">
                        <div className="flex flex-col gap-[16px] p-0">
                          <SteamSync
                            isActive={activeSyncId === 'valve'}
                            onActiveToggle={(active) => {
                              setActiveSyncId(active ? 'valve' : null);
                              if (!active) setActiveCommand(null);
                            }}
                            accentColor={resolvedModularAccent}
                            handleSyncSteamLibrary={handleSyncSteamLibrary}
                            onCommandUpdate={handleCommandUpdate}
                          />
                          <XboxSync
                            isActive={activeSyncId === 'xbox'}
                            onActiveToggle={(active) => {
                              setActiveSyncId(active ? 'xbox' : null);
                              if (!active) setActiveCommand(null);
                            }}
                            accentColor={resolvedModularAccent}
                            handleSyncXboxLibrary={handleSyncXboxLibrary}
                            onCommandUpdate={handleCommandUpdate}
                          />
                          <EmuSync
                            isActive={activeSyncId === 'emu'}
                            onActiveToggle={(active) => {
                              setActiveSyncId(active ? 'emu' : null);
                              if (!active) setActiveCommand(null);
                            }}
                            accentColor={resolvedModularAccent}
                            handleSyncEmuLibrary={handleSyncEmuLibrary}
                            triggerFileBrowser={triggerFileBrowser}
                            emuPath={emuPath}
                            romsDir={romsDir}
                            emuIcon={emuIcon}
                            onCommandUpdate={handleCommandUpdate}
                          />
                        </div>
                      </div>
                    ) : activeModularModule === 'explorer' ? (
                      <div ref={modularScrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pl-[20px] pr-[52px] pt-[20px] pb-0">
                        <ModularExplorerModule
                          accentColor={resolvedModularAccent}
                          currentPath={explorerCurrentPath}
                          onPathChange={setExplorerCurrentPath}
                          mode={explorerMode}
                          selectedPath={explorerSelectedPath}
                          onSelect={setExplorerSelectedPath}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                        <span className="font-['Space_Mono'] text-[10px] uppercase tracking-[1em] font-black opacity-10">
                          [ {activeModularModule.toUpperCase()}_ZONE_AWAITING_MIGRATION ]
                        </span>
                      </div>
                    )}
                  </React.Suspense>
                </div>
              </div>
            </ModularModal>
          );
        })()}
        <FileExplorerModal
          isOpen={explorer.isOpen}
          onClose={() => setExplorer(prev => ({ ...prev, isOpen: false }))}
          onSelect={(path) => handleExplorerSelect(path)}
          filter={explorer.filter}
          accentColor={resolveColor(categories[currentCatIndex]?.color || '#00ffff')}
          initialPath={explorer.initialPath}
        />
        {confirmData && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-[400px] w-full border border-red-500/20 bg-red-950/10 p-6 flex flex-col gap-6" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              <h3 className="font-['Press_Start_2P'] text-[8px] text-red-500 uppercase tracking-tighter">[ ERASE_PROTOCOL ]</h3>
              <p className="text-[10px] text-white/80 uppercase font-mono tracking-widest">{confirmData.message}</p>
              <div className="flex gap-4">
                <button
                  onClick={confirmData.onConfirm}
                  className="flex-1 py-3 bg-red-600 text-white font-bold text-[8px] uppercase tracking-widest hover:bg-red-500 transition-colors"
                >
                  COMMIT
                </button>
                <button
                  onClick={() => setConfirmData(null)}
                  className="flex-1 py-3 border border-white/20 text-white font-bold text-[8px] uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  ABORT
                </button>
              </div>
            </div>
          </div>
        )}
      </React.Suspense>
    </div >
  );
};

export default App;
