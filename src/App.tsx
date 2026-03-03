import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from './types';
import { ASSETS } from './constants';
import Sidebar from './components/Sidebar';
import GameTrack from './components/GameTrack';
import GameInfo from './components/GameInfo';
import Notification from './components/Notification';
import BackgroundEffect from './components/BackgroundEffect';
import anime from 'animejs';

// Lazy load ModularModal and components
const ModularModal = React.lazy(() => import('./components/modular/ModularModal'));
const ModularHeader = React.lazy(() => import('./components/modular/ModularHeader'));
const GameRegistryModule = React.lazy(() => import('./components/modular/registry/GameRegistryModule'));
const ModularCategoriesModule = React.lazy(() => import('./components/modular/categories/ModularCategoriesModule'));
const SteamSync = React.lazy(() => import('./components/modular/integrations/SteamSync'));
const XboxSync = React.lazy(() => import('./components/modular/integrations/XboxSync'));
const EmuSync = React.lazy(() => import('./components/modular/integrations/EmuSync'));
const SgdbAsset = React.lazy(() => import('./components/modular/assets/SgdbAsset'));
const ModularExplorerModule = React.lazy(() => import('./components/modular/explorer/ModularExplorerModule'));
const LanguageConfigCard = React.lazy(() => import('./components/modular/system/LanguageConfigCard'));
const AppearanceConfigCard = React.lazy(() => import('./components/modular/system/AppearanceConfigCard'));
const PerformanceConfigCard = React.lazy(() => import('./components/modular/system/PerformanceConfigCard'));
const DataManagementConfigCard = React.lazy(() => import('./components/modular/system/DataManagementConfigCard'));

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
import ModularAssetSearchModule from './components/modular/assetSearch/ModularAssetSearchModule';

const App: React.FC = () => {
  // --- Custom Hooks ---
  const { categories, setCategories, isDataLoaded, taskbarMargin, setTaskbarMargin, uiScale, setUIScale, isBackendOnline } = usePersistence();
  const { playSfx } = useAudio();
  const { isPaused } = usePerformance();
  const { t, language, setLanguage } = useTranslation();
  const { resolve: resolveColor, isMonochrome } = useColor(categories);

  // --- Local UI State ---
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [appState, setAppState] = useState('idle' as AppState);
  const [notification, setNotification] = useState<string | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isModularOpen, setIsModularOpen] = useState(false);
  const [activeModularModule, setActiveModularModule] = useState<'categories' | 'system' | 'integrations' | 'registry' | 'games' | 'explorer' | 'assets' | 'assetSearch'>('categories');
  const [emuPath, setEmuPath] = useState('');
  const [romsDir, setRomsDir] = useState('');
  const [emuIcon, setEmuIcon] = useState('');
  const [explorer, setExplorer] = useState<{ target: string }>({
    target: '',
  });
  const [explorerMode, setExplorerMode] = useState<'browse' | 'select-file' | 'select-folder' | 'select-image'>('browse');
  const [explorerSelectedPath, setExplorerSelectedPath] = useState<string | null>(null);
  const [lastModularModule, setLastModularModule] = useState<'system' | 'integrations' | 'registry' | 'games' | 'explorer' | 'assets'>('system');
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void; isDanger?: boolean } | null>(null);

  const [postLaunchNav, setPostLaunchNav] = useState(false);
  const [initialNavDone, setInitialNavDone] = useState(false);
  const [assetVersion, setAssetVersion] = useState(0);
  const [activeCommand, setActiveCommand] = useState<{ text: string, desc: string } | null>(null);
  const [activeExecute, setActiveExecute] = useState<(() => void) | undefined>(undefined);
  const [activeProgress, setActiveProgress] = useState<number>(0);
  const [activeIsExecuting, setActiveIsExecuting] = useState<boolean>(false);
  const [activeIsReady, setActiveIsReady] = useState<boolean>(false);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
  const [globalIncludeAssets, setGlobalIncludeAssets] = useState(true);
  const [explorerCurrentPath, setExplorerCurrentPath] = useState('C:/'); // Default to C:/
  const [drives, setDrives] = useState<string[]>([]);
  const [libraries, setLibraries] = useState<{ name: string, path: string }[]>([]);
  const [sgdbKey, setSgdbKey] = useState('');
  const [sgdbEnabled, setSgdbEnabled] = useState(false);
  const [modularScrollProgress, setModularScrollProgress] = useState(0);
  const [showModularScrollMarker, setShowModularScrollMarker] = useState(false);
  const lastUnlockedRef = useRef(false);
  const registryGoBackRef = useRef<(() => boolean) | null>(null);
  const assetSearchGoBackRef = useRef<(() => boolean) | null>(null);
  const [registryCanGoBack, setRegistryCanGoBack] = useState(false);
  const [assetSearchCanGoBack, setAssetSearchCanGoBack] = useState(false);

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

  const resetEmuFields = useCallback(() => {
    setEmuPath('');
    setRomsDir('');
    setEmuIcon('');
  }, []);

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
    // Force Modular UI
    if (!isModularOpen) setIsModularOpen(true);
    setLastModularModule(activeModularModule as any);
    setActiveModularModule('explorer');
    setExplorerMode(type === 'folder' ? 'select-folder' : (type === 'exe' ? 'select-file' : 'select-image'));
    setExplorerSelectedPath(null);
    setExplorer({ target });
  };

  const [lastSelectedAsset, setLastSelectedAsset] = useState<{ target: string; path: string; timestamp: number } | null>(null);

  const [cloudExplorer, setCloudExplorer] = useState<{ target: string, type: 'grid' | 'hero' | 'logo' | 'banner' | 'icon', initialQuery: string } | null>(null);

  const triggerCloudBrowser = (target: string, type: string, initialQuery: string = '') => {
    if (!isModularOpen) setIsModularOpen(true);
    setLastModularModule(activeModularModule as any);
    setActiveModularModule('assetSearch');
    setCloudExplorer({ target, type: type as any, initialQuery });
  };

  const handleCloudExplorerSelect = async (url: string | null) => {
    setActiveModularModule(lastModularModule);
    if (!url || !cloudExplorer) return;

    const gameId = activeGame?.id || `temp_${Date.now()}`;
    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: url, gameId, assetType: cloudExplorer.target })
      });
      const data = await res.json();
      setLastSelectedAsset({ target: cloudExplorer.target, path: data.path || url, timestamp: Date.now() });
    } catch (e) {
      console.error("Cloud import failed", e);
      setLastSelectedAsset({ target: cloudExplorer.target, path: url, timestamp: Date.now() });
    }
    setCloudExplorer(null);
  };

  const handleExplorerSelect = (path: string) => {
    if (!path) return;

    if (explorer.target === 'emuPath') setEmuPath(path);
    if (explorer.target === 'romsDir') setRomsDir(path);
    if (explorer.target === 'emuIcon') setEmuIcon(path);

    // Support for GameEditForm targets
    if (['cover', 'banner', 'logo', 'wallpaper', 'execPath'].includes(explorer.target)) {
      setLastSelectedAsset({ target: explorer.target, path, timestamp: Date.now() });
    }

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
  const allGamesCategory = categories.find(c => c.id === 'all') || categories[0];
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
    setActiveIsExecuting(false);
    setActiveIsReady(false);
    setActiveSyncId(null);
  }, [activeModularModule]);

  // Contextual go-back handler for DISCONNECT button
  const handleModularGoBack = useCallback(() => {
    // Priority 1: Let children modules handle internal go-back
    if (activeModularModule === 'registry' && registryGoBackRef.current) {
      const handled = registryGoBackRef.current();
      if (handled) return;
    }
    if (activeModularModule === 'assetSearch' && assetSearchGoBackRef.current) {
      const handled = assetSearchGoBackRef.current();
      if (handled) return;
    }

    // Priority 2: Exit sub-modules mode back to previous module (Explorer/Cloud)
    if (activeModularModule === 'explorer' || activeModularModule === 'assetSearch') {
      setActiveModularModule(lastModularModule as any);
      if (activeModularModule === 'explorer') {
        setExplorerMode('browse');
        setExplorerSelectedPath(null);
      } else {
        setCloudExplorer(null);
      }
      return;
    }

    // Priority 3: Close any active sync/config card
    if (activeSyncId) {
      setActiveSyncId(null);
      setActiveCommand(null);
      setActiveProgress(0);
      setActiveIsExecuting(false);
      setActiveIsReady(false);
      activeExecuteRef.current = undefined;
      activeExecuteStartRef.current = undefined;
      activeExecuteEndRef.current = undefined;
      return;
    }

    // Priority 4: Actually close the modal
    setIsModularOpen(false);
    playSfx('close');
  }, [activeSyncId, activeModularModule, lastModularModule, playSfx]);

  const activeExecuteRef = useRef<(() => void) | undefined>(undefined);
  const activeExecuteStartRef = useRef<(() => void) | undefined>(undefined);
  const activeExecuteEndRef = useRef<(() => void) | undefined>(undefined);

  const handleCommandUpdate = useCallback((
    cmd: { text: string, desc: string } | null,
    exec: (() => void) | undefined | null,
    progress: number | undefined,
    isExecuting: boolean | undefined,
    isReady: boolean | undefined,
    _scrollProgress?: number | (() => void) | null,
    _showScrollMarker?: boolean | (() => void) | null,
    execStart?: (() => void) | null,
    execEnd?: (() => void) | null
  ) => {
    // Determine if _scrollProgress holds a function (old signature migration trick)
    const actualExecStart = typeof _scrollProgress === 'function' ? _scrollProgress : execStart;
    const actualExecEnd = typeof _showScrollMarker === 'function' ? _showScrollMarker : execEnd;

    // 1. Update refs (explicitly clear if undefined or null)
    if (exec !== undefined) {
      activeExecuteRef.current = exec === null ? undefined : exec;
    }

    // If command is provided, we should reset optional handlers unless explicitly provided
    if (cmd !== undefined) {
      activeExecuteStartRef.current = (actualExecStart === undefined || actualExecStart === null) ? undefined : actualExecStart;
      activeExecuteEndRef.current = (actualExecEnd === undefined || actualExecEnd === null) ? undefined : actualExecEnd;
    } else {
      // Partial updates
      if (actualExecStart !== undefined) activeExecuteStartRef.current = actualExecStart === null ? undefined : actualExecStart;
      if (actualExecEnd !== undefined) activeExecuteEndRef.current = actualExecEnd === null ? undefined : actualExecEnd;
    }

    if (isExecuting !== undefined) setActiveIsExecuting(isExecuting);
    if (isReady !== undefined) setActiveIsReady(isReady);

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

      fetch('/api/sgdb/key').then(r => r.json()).then(d => {
        setSgdbKey(d.key);
        setSgdbEnabled(d.enabled);
      });
    }
  }, [isModularOpen]);

  const handleUpdateSgdbKey = (key: string) => {
    setSgdbKey(key);
    fetch('/api/sgdb/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled: sgdbEnabled })
    });
  };

  const handleToggleSgdb = (enabled: boolean) => {
    if (enabled && !sgdbKey.trim()) return;
    setSgdbEnabled(enabled);
    fetch('/api/sgdb/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: sgdbKey, enabled })
    });
  };

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
      if (isManagementOpen || isModularOpen) return;
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
        onOpenSettings={() => {
          setIsModularOpen(true);
          setActiveModularModule('categories');
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
        {isModularOpen && (() => {
          const getBaseColor = (mod: string) => {
            const agc = allGamesCategory as any;
            if (mod === 'categories') return agc?.configColor || '#ff0055';
            if (mod === 'system') return agc?.coreColor || '#9acd32';
            if (mod === 'registry') return agc?.nodeColor || '#ff00ff';
            if (mod === 'integrations') return agc?.syncColor || '#22c55e';
            if (mod === 'assets') return agc?.assetColor || '#a855f7';
            if (mod === 'explorer' || mod === 'assetSearch') return agc?.explorerColor || categories[currentCatIndex]?.color || '#00ffff';
            return '#00ffcc';
          };

          const currentModularAccent = activeModularModule === 'explorer'
            ? getBaseColor(lastModularModule)
            : getBaseColor(activeModularModule);

          const resolvedModularAccent = resolveColor(currentModularAccent);
          return (
            <ModularModal
              isOpen={isModularOpen}
              onClose={handleModularGoBack}
              accentColor={resolvedModularAccent}
              commandText={
                explorerMode !== 'browse' ? (
                  explorer.target === 'emuPath' ? t('explorer.command_emu_exe') :
                    explorer.target === 'execPath' ? t('explorer.command_game_exe') :
                      explorer.target === 'romsDir' ? t('explorer.command_rom_dir') :
                        ['cover', 'banner', 'logo', 'wallpaper'].includes(explorer.target) ? t('explorer.command_image') :
                          activeCommand?.text || t('explorer.unknown')
                ) : (activeCommand?.text || t(`module.${activeModularModule}.title`))
              }
              commandDesc={
                explorerMode !== 'browse' ? (
                  explorer.target === 'emuPath' ? t('explorer.desc_emu_exe') :
                    explorer.target === 'execPath' ? t('explorer.desc_game_exe') :
                      explorer.target === 'romsDir' ? t('explorer.desc_rom_dir') :
                        ['cover', 'banner', 'logo', 'wallpaper'].includes(explorer.target) ? t('explorer.desc_image') :
                          t('explorer.desc_selection').replace('{{path}}', explorerSelectedPath || explorerCurrentPath)
                ) : (activeCommand?.desc || t(`module.${activeModularModule}.desc`))
              }
              onExecute={
                explorerMode !== 'browse'
                  ? () => handleExplorerSelect(explorerSelectedPath || explorerCurrentPath)
                  : (activeCommand && activeExecuteRef.current ? () => activeExecuteRef.current?.() : undefined)
              }
              onExecuteStart={activeCommand && activeExecuteStartRef.current ? () => activeExecuteStartRef.current?.() : undefined}
              onExecuteEnd={activeCommand && activeExecuteEndRef.current ? () => activeExecuteEndRef.current?.() : undefined}
              progress={activeProgress}
              isExecuting={activeIsExecuting}
              isReady={explorerMode !== 'browse' ? !!(explorerSelectedPath || (explorerMode === 'select-folder' && explorerCurrentPath)) : activeIsReady}
              scrollProgress={modularScrollProgress}
              showScrollMarker={showModularScrollMarker}
            >
              <ModularHeader
                title="MODULAR_RECONSTRUCTION_ALPHA"
                accentColor={resolvedModularAccent}
                onClose={handleModularGoBack}
                closeLabel={activeSyncId || activeModularModule === 'explorer' || registryCanGoBack || assetSearchCanGoBack || activeModularModule === 'assetSearch' ? t('nav.go_back') : undefined}
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
                    {/* Primary Application Modules */}
                    {['categories', 'registry', 'integrations', 'assets', 'system'].map(mod => {
                      const isActive = activeModularModule === mod;
                      // Only hide other modules when in EXPLORER to focus on drives/vaults
                      if (activeModularModule === 'explorer') return null;

                      return (
                        <div
                          key={mod}
                          onClick={() => {
                            setActiveModularModule(mod as any);
                            setActiveSyncId(null);
                            setActiveCommand(null);
                            activeExecuteRef.current = undefined;
                            activeExecuteStartRef.current = undefined;
                            activeExecuteEndRef.current = undefined;
                            playSfx('move');
                          }}
                          className={`w-full py-[18px] px-[20px] transition-all duration-150 font-['Space_Mono'] font-bold text-[10px] uppercase tracking-[0.3em] flex items-center cursor-pointer mb-0`}
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.40)',
                          }}
                        >
                          <div className={`w-[2px] h-[12px] mr-3 transition-all ${isActive ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: resolvedModularAccent }} />
                          {t(`module.${mod}.title`)}
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

                    {/* CATEGORIES */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar pl-[18px] pr-[52px] pt-[18px] pb-0 ${activeModularModule === 'categories' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      <ModularCategoriesModule
                        categories={categories}
                        activeAccent={resolvedModularAccent}
                        onResolveAsset={resolveAsset}
                        handleCreateCategory={handleCreateCategory}
                        handleDeleteCategory={handleDeleteCategory}
                        handleMoveCategory={handleMoveCategory}
                        handleMoveGameInCategory={handleMoveGameInCategory}
                        handleToggleGameInCategory={handleToggleGameInCategory}
                        handleFetchMissingAssets={handleFetchMissingAssets}
                        triggerFileBrowser={triggerFileBrowser}
                        onUpdateCategories={setCategories}
                        requestConfirmation={requestConfirmation}
                        onCommandUpdate={handleCommandUpdate}
                      />
                    </div>

                    {/* SYSTEM */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar pl-[18px] pr-[52px] pt-[18px] pb-0 ${activeModularModule === 'system' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      <div className="flex flex-col gap-[16px] p-0">
                        <LanguageConfigCard isActive={activeSyncId === 'language'} onActiveToggle={(active) => { setActiveSyncId(active ? 'language' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} onCommandUpdate={handleCommandUpdate} currentLanguage={language} setLanguage={setLanguage} />
                        <AppearanceConfigCard isActive={activeSyncId === 'appearance'} onActiveToggle={(active) => { setActiveSyncId(active ? 'appearance' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} onCommandUpdate={handleCommandUpdate} allGamesCategory={allGamesCategory} onUpdateCategories={setCategories} taskbarMargin={taskbarMargin} onUpdateTaskbarMargin={setTaskbarMargin} uiScale={uiScale} onUpdateUIScale={setUIScale} />
                        <PerformanceConfigCard isActive={activeSyncId === 'performance'} onActiveToggle={(active) => { setActiveSyncId(active ? 'performance' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} onCommandUpdate={handleCommandUpdate} allGamesCategory={allGamesCategory} onUpdateCategories={setCategories} />
                        <DataManagementConfigCard isActive={activeSyncId === 'data'} onActiveToggle={(active) => { setActiveSyncId(active ? 'data' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} onCommandUpdate={handleCommandUpdate} allGamesCategory={allGamesCategory} onUpdateCategories={setCategories} />
                      </div>
                    </div>

                    {/* REGISTRY */}
                    <div className={`flex-1 flex-col overflow-hidden relative ${activeModularModule === 'registry' ? 'flex' : 'hidden'}`}>
                      <GameRegistryModule
                        isActive={activeModularModule === 'registry'}
                        isSubModuleOpen={lastModularModule === 'registry' && (activeModularModule === 'explorer' || activeModularModule === 'assetSearch')}
                        accentColor={resolvedModularAccent}
                        categories={categories}
                        allGamesCategory={allGamesCategory}
                        onUpdateCategories={setCategories}
                        onCommandUpdate={handleCommandUpdate}
                        resolveAsset={resolveAsset}
                        triggerFileBrowser={triggerFileBrowser}
                        triggerCloudBrowser={triggerCloudBrowser}
                        handleSaveGame={handleSaveGame}
                        handleDeleteGame={handleDeleteGame}
                        sgdbKey={sgdbKey}
                        sgdbEnabled={sgdbEnabled}
                        lastSelectedAsset={lastSelectedAsset}
                        onClearLastAsset={() => setLastSelectedAsset(null)}
                        registerGoBack={(fn) => { registryGoBackRef.current = fn; }}
                        onCanGoBackChange={setRegistryCanGoBack}
                      />
                    </div>

                    {/* INTEGRATIONS */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar pl-[18px] pr-[52px] pt-[18px] pb-0 ${activeModularModule === 'integrations' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      <div className="flex flex-col gap-[16px] p-0">
                        <SteamSync isActive={activeSyncId === 'valve'} onActiveToggle={(active) => { setActiveSyncId(active ? 'valve' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} handleSyncSteamLibrary={handleSyncSteamLibrary} onCommandUpdate={handleCommandUpdate} />
                        <XboxSync isActive={activeSyncId === 'xbox'} onActiveToggle={(active) => { setActiveSyncId(active ? 'xbox' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} handleSyncXboxLibrary={handleSyncXboxLibrary} onCommandUpdate={handleCommandUpdate} includeAssets={globalIncludeAssets} setIncludeAssets={setGlobalIncludeAssets} sgdbEnabled={sgdbEnabled} />
                        <EmuSync isActive={activeSyncId === 'emu'} onActiveToggle={(active) => { setActiveSyncId(active ? 'emu' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} handleSyncEmuLibrary={handleSyncEmuLibrary} triggerFileBrowser={triggerFileBrowser} emuPath={emuPath} romsDir={romsDir} emuIcon={emuIcon} onCommandUpdate={handleCommandUpdate} includeAssets={globalIncludeAssets} setIncludeAssets={setGlobalIncludeAssets} sgdbEnabled={sgdbEnabled} onResetFields={resetEmuFields} />
                      </div>
                    </div>

                    {/* ASSETS */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar pl-[18px] pr-[52px] pt-[18px] pb-0 ${activeModularModule === 'assets' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      <div className="flex flex-col gap-[16px] p-0">
                        <SgdbAsset isActive={activeSyncId === 'sgdb'} onActiveToggle={(active) => { setActiveSyncId(active ? 'sgdb' : null); if (!active) setActiveCommand(null); }} accentColor={resolvedModularAccent} sgdbKey={sgdbKey} onKeyUpdate={handleUpdateSgdbKey} sgdbEnabled={sgdbEnabled} onToggleSgdb={handleToggleSgdb} onCommandUpdate={handleCommandUpdate} />
                      </div>
                    </div>

                    {/* EXPLORER */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar flex pl-[20px] pr-[52px] pt-[20px] pb-0 ${activeModularModule === 'explorer' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      <ModularExplorerModule accentColor={resolvedModularAccent} currentPath={explorerCurrentPath} onPathChange={setExplorerCurrentPath} mode={explorerMode} selectedPath={explorerSelectedPath} onSelect={setExplorerSelectedPath} />
                    </div>

                    {/* ASSET SEARCH (CLOUD) */}
                    <div className={`flex-1 flex-col overflow-y-auto custom-scrollbar flex pl-[20px] pr-[52px] pt-[20px] pb-0 ${activeModularModule === 'assetSearch' ? 'flex' : 'hidden'}`} ref={modularScrollRef}>
                      {cloudExplorer && (
                        <ModularAssetSearchModule
                          accentColor={resolvedModularAccent}
                          initialQuery={cloudExplorer.initialQuery}
                          assetType={cloudExplorer.type}
                          onSelect={handleCloudExplorerSelect}
                          onCancel={() => {
                            setActiveModularModule(lastModularModule);
                            setCloudExplorer(null);
                          }}
                          registerGoBack={(fn) => { assetSearchGoBackRef.current = fn; }}
                          onCanGoBackChange={setAssetSearchCanGoBack}
                        />
                      )}
                    </div>


                  </React.Suspense>
                </div>
              </div>
            </ModularModal>
          );
        })()}
      </React.Suspense>

      {
        confirmData && (
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
        )
      }
    </div >
  );
};

export default App;
