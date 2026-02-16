import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Category, Game } from '../types';
import { ASSETS, APP_VERSION } from '../constants';
// import { GoogleGenAI, Type } from "@google/genai";
import AssetInput from './AssetInput';
import FileExplorerModal from './FileExplorerModal';
import Subsection from './management/Subsection';
import GameEditForm from './management/GameEditForm';
import CategoryEditForm from './management/CategoryEditForm';
import SystemTab from './management/SystemTab';
import AssetSearchModal from './AssetSearchModal';
import { useTranslation } from '../hooks/useTranslation';

interface ManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currentCatIdx: number;
  onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  accentColor: string;
  taskbarMargin: number;
  onUpdateTaskbarMargin: (val: number) => void;
  onResolveAsset: (path: string | undefined) => string;
  isSecretUnlocked?: boolean;
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
  isDanger?: boolean;
}

const ManagementModal: React.FC<ManagementModalProps> = ({
  isOpen, onClose, categories, currentCatIdx, onUpdateCategories, accentColor,
  taskbarMargin, onUpdateTaskbarMargin, onResolveAsset,
  isSecretUnlocked = false
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'games' | 'categories' | 'integrations' | 'system' | 'secret'>('games');
  const [explorer, setExplorer] = useState<{ isOpen: boolean; target: string; filter: 'exe' | 'image' | 'any'; initialPath?: string }>({
    isOpen: false,
    target: '',
    filter: 'any',
    initialPath: undefined
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // const [isSyncingGemini, setIsSyncingGemini] = useState(false); // Removed for offline
  const [confirmData, setConfirmData] = useState<ConfirmState | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const allGamesCategory = categories.find(c => c.id === 'all')!;
  const otherCategories = categories.filter(c => c.id !== 'all' && c.id !== 'hidden');

  const [gameForm, setGameForm] = useState({ title: '', cover: '', banner: '', logo: '', execPath: '', execArgs: '', categoryIds: [] as string[], wallpaper: '' });
  const [catForm, setCatForm] = useState({ name: '', icon: '', color: '#ffffff', wallpaper: '', wallpaperMode: 'cover' as any, gridOpacity: 0.15, enabled: true });
  const [steamOptions, setSteamOptions] = useState({ includeHidden: false, includeSoftware: false });
  const [sgdbKey, setSgdbKey] = useState('');
  const [sgdbEnabled, setSgdbEnabled] = useState(false);

  // Hoisted Search Modal State
  const [searchModal, setSearchModal] = useState({ isOpen: false, type: 'grid' as 'grid' | 'hero' | 'logo', targetField: 'cover' as 'cover' | 'banner' | 'logo' | 'icon' });
  const [activeTempId, setActiveTempId] = useState<string | null>(null);

  // When opening the form, if it's a new game, generate a stable tempId
  useEffect(() => {
    if (isFormOpen && !editingId && !activeTempId) {
      setActiveTempId('temp_' + Date.now());
    } else if (!isFormOpen) {
      setActiveTempId(null);
    }
  }, [isFormOpen, editingId]);


  const handleCloudSelect = async (url: string) => {
    const gameId = editingId || activeTempId;
    if (!gameId) return;

    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: url, gameId, assetType: searchModal.targetField })
      });
      const data = await res.json();
      if (data.path) {
        const newPath = data.path;
        setGameForm(prev => ({ ...prev, [searchModal.targetField]: newPath }));

        // Instant Persistence: Update the global state if we are in a known category
        if (editingId) {
          onUpdateCategories(prev => prev.map(cat => ({
            ...cat,
            games: cat.games.map(g => g.id === editingId ? { ...g, [searchModal.targetField]: newPath } : g)
          })));
        }
      }
    } catch (e) {
      console.error("Cloud import failed", e);
    }
    // Don't close modal yet if user wants to pick more? 
    // Usually, one pick is enough, but user might want to pick cover then hero.
    // Let's keep it closing for now as per original logic, but persistence is fixed.
    setSearchModal(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    fetch('/api/sgdb/key').then(r => r.json()).then(d => {
      setSgdbKey(d.key);
      setSgdbEnabled(d.enabled);
    });
  }, []);

  const handleUpdateSgdbKey = (key: string) => {
    setSgdbKey(key);
    fetch('/api/sgdb/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled: sgdbEnabled })
    });
  };

  const handleToggleSgdb = (enabled: boolean) => {
    if (enabled && !sgdbKey.trim()) {
      console.warn("Attempted to enable SGDB without a key.");
      return;
    }
    setSgdbEnabled(enabled);
    fetch('/api/sgdb/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: sgdbKey, enabled })
    });
  };

  const [activeFileTarget, setActiveFileTarget] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all'); // NEW: Filter state

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setSearchQuery('');
      setConfirmData(null);
      resetForms();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isSecretUnlocked) {
      const hasHidden = categories.some(c => c.id === 'hidden');
      if (!hasHidden) {
        onUpdateCategories(prev => [...prev, {
          id: 'hidden',
          name: 'HIDDEN NODE',
          icon: (ASSETS.external as any).hidden || './res/external/hidden.png',
          color: '#ec4899',
          games: [],
          enabled: true,
          wallpaper: '',
          wallpaperMode: 'cover',
          gridOpacity: 0.15
        }]);
      }
    }
  }, [isSecretUnlocked, categories, onUpdateCategories]);

  // FIX: Populate form when editing a category
  useEffect(() => {
    if (tab === 'categories' && editingId) {
      const cat = categories.find(c => c.id === editingId);
      if (cat) {
        setCatForm({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          wallpaper: cat.wallpaper || '',
          wallpaperMode: cat.wallpaperMode || 'cover',
          gridOpacity: cat.gridOpacity ?? 0.15,
          enabled: cat.enabled ?? true
        });
      }
    }
  }, [editingId, tab, categories]);

  const resetForms = () => {
    setGameForm({ title: '', cover: '', banner: '', logo: '', execPath: '', execArgs: '', categoryIds: [], wallpaper: '' });
    setCatForm({ name: '', icon: '', color: '#ffffff', wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15, enabled: true });
  };

  const activeAccent = useMemo(() => {
    const all = categories.find(c => c.id === 'all');
    if (tab === 'games') return all?.assetColor || accentColor;
    if (tab === 'categories') return all?.nodeColor || accentColor;
    if (tab === 'integrations') return all?.syncColor || accentColor;
    if (tab === 'system') return all?.coreColor || accentColor;
    return accentColor;
  }, [tab, categories, accentColor]);

  useEffect(() => {
    setIsFormOpen(false);
  }, [tab]);

  const scrollToForm = () => {
    setIsFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.classList.add('animate-focus-glow');
      setTimeout(() => {
        formRef.current?.classList.remove('animate-focus-glow');
      }, 2000);
    }, 100);
  };

  const sortedAndFilteredMasterGames = useMemo(() => {
    let games = [...allGamesCategory.games];

    // 1. Filter by Category
    if (filterCategory !== 'all') {
      const targetCat = categories.find(c => c.id === filterCategory);
      if (targetCat) {
        const targetIds = new Set(targetCat.games.map(g => g.id));
        games = games.filter(g => targetIds.has(g.id));
      }
    }

    // 2. Filter by Search Query
    if (searchQuery) {
      games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return games.sort((a, b) => a.title.localeCompare(b.title));
  }, [allGamesCategory.games, searchQuery, filterCategory, categories]);

  /* Gemini sync removed for offline mode */
  const handleSyncWithGemini = async () => {
    // Offline mode: No AI sync
  };

  const handleSyncSteamLibrary = async () => {
    try {
      const response = await fetch('/api/steam/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steamOptions)
      });
      if (!response.ok) throw new Error('Steam scan failed');
      const { games: steamGames } = await response.json();

      onUpdateCategories(prev => {
        const steamCatIndex = prev.findIndex(c => c.id === 'steam');
        let newCategories = [...prev];

        // Create STEAM category if not exists
        if (steamCatIndex === -1 && steamGames.length > 0) {
          newCategories.push({
            id: 'steam',
            name: 'STEAM',
            icon: (ASSETS as any).external?.steam || './res/external/steam_icon.png',
            color: '#1b2838', // Steam blue
            games: [],
            enabled: true,
            wallpaper: '',
            wallpaperMode: 'cover',
            gridOpacity: 0.15
          });
        }

        return newCategories.map(cat => {
          if (cat.id === 'all' || cat.id === 'steam') {
            const existingIds = new Set(cat.games.map(g => g.id));
            const uniqueNew = steamGames.filter((g: Game) => !existingIds.has(g.id));
            return { ...cat, games: [...cat.games, ...uniqueNew] };
          }
          return cat;
        });
      });
      console.log(`Synced ${steamGames.length} Steam games`);
    } catch (e) {
      console.error("Steam sync failed", e);
    }
  };

  const handleSyncXboxLibrary = async () => {
    try {
      const response = await fetch('/api/xbox/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Xbox scan failed');
      const { games: xboxGames } = await response.json();

      onUpdateCategories(prev => {
        const xboxCatIndex = prev.findIndex(c => c.id === 'xbox');

        let newCategories = [...prev];

        // Create XBOX category if not exists
        if (xboxCatIndex === -1 && xboxGames.length > 0) {
          newCategories.push({
            id: 'xbox',
            name: 'XBOX',
            icon: './res/external/xbox.png',
            color: '#107C10', // Xbox Green
            games: [],
            enabled: true,
            wallpaper: '',
            wallpaperMode: 'cover',
            gridOpacity: 0.15
          });
        }

        const res = newCategories.map(cat => {
          if (cat.id === 'all' || cat.id === 'xbox') {
            const existingIds = new Set(cat.games.map(g => g.id));
            const uniqueNew = xboxGames.filter((g: Game) => !existingIds.has(g.id));
            return { ...cat, games: [...cat.games, ...uniqueNew] };
          }
          return cat;
        });

        return res;
      });
      console.log(`Synced ${xboxGames.length} Xbox games`);
    } catch (e: any) {
      console.error("Xbox sync failed", e);
    }
  };

  const handleSaveGame = async () => {
    if (!gameForm.title.trim()) return;
    const slug = slugify(gameForm.title);

    let newId = editingId;

    if (!newId) {
      let candidateId = `manual_${slug}`;
      let counter = 0;

      const idExists = (id: string) => categories.some(c => c.games.some(g => g.id === id));

      while (idExists(candidateId)) {
        counter++;
        candidateId = `manual_${slug}-${counter}`;
      }
      newId = candidateId;
    }

    const gameObj: Game = {
      id: newId!,
      title: gameForm.title,
      cover: gameForm.cover,
      banner: gameForm.banner,
      logo: gameForm.logo,
      execPath: gameForm.execPath,
      execArgs: gameForm.execArgs,
      source: 'manual',
      wallpaper: gameForm.wallpaper
    };
    onUpdateCategories(prev => prev.map(cat => {
      // Logic for standard categories
      let isTarget = cat.id === 'all' || gameForm.categoryIds.includes(cat.id);

      // ISOLATION: Explicitly exclude hidden games from 'ALL GAMES' view
      if (cat.id === 'all' && gameForm.categoryIds.includes('hidden')) {
        isTarget = false;
      }

      const exists = cat.games.some(g => g.id === newId);
      if (isTarget) return exists ? { ...cat, games: cat.games.map(g => g.id === newId ? gameObj : g) } : { ...cat, games: [...cat.games, gameObj] };
      return { ...cat, games: cat.games.filter(g => g.id !== newId) };
    }));
    setIsFormOpen(false);
    setEditingId(null);
    resetForms();
  };

  const requestConfirmation = (message: string, onConfirm: () => void, isDanger: boolean = true) => {
    setConfirmData({ message, onConfirm: () => { onConfirm(); setConfirmData(null); }, isDanger });
  };

  const triggerFileBrowser = (target: string, type: string) => {
    setExplorer({
      isOpen: true,
      target,
      filter: type === 'exe' ? 'exe' : 'image',
      initialPath: type === 'exe' ? 'DESKTOP' : 'PICTURES'
    });
  };

  const handleExplorerSelect = async (path: string) => {
    const { target } = explorer;
    setExplorer(prev => ({ ...prev, isOpen: false }));

    // HANDLE CATEGORY ASSETS
    if (tab === 'categories') {
      const catId = editingId;
      if (!catId) return;

      // Ideally we would import this to a persistent location, but for now apply the local path
      // consistent with how the form expects a value to display.
      // If the path is absolute, onResolveAsset handles `file://` or direct path usage.
      setCatForm(prev => ({ ...prev, [target]: path }));

      // Also update the main state immediately for preview in the grid
      onUpdateCategories(prev => prev.map(c => c.id === catId ? { ...c, [target]: path } : c));
      return;
    }

    if (target === 'execPath') {
      try {
        const infoRes = await fetch('/api/files/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: path })
        });
        const info = await infoRes.json();

        setGameForm(prev => ({
          ...prev,
          execPath: info.TargetPath || path,
          execArgs: info.Arguments || '',
          title: prev.title || path.split('\\').pop()?.split('/').pop()?.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').toUpperCase() || ''
        }));

        if (editingId) {
          onUpdateCategories(prev => prev.map(cat => ({
            ...cat,
            games: cat.games.map(g => g.id === editingId ? { ...g, execPath: info.TargetPath || path, execArgs: info.Arguments || '' } : g)
          })));
        }
      } catch (e) {
        console.error("Failed to get file info", e);
        setGameForm(prev => ({ ...prev, execPath: path }));
      }
      return;
    }

    const gameId = editingId || activeTempId;
    if (!gameId) return;

    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: path, gameId, assetType: target })
      });
      const data = await res.json();
      if (data.path) {
        const newPath = data.path;
        setGameForm(prev => ({ ...prev, [target]: newPath }));

        // If taking cover and no title, auto-fill title
        if (target === 'cover' && !gameForm.title) {
          const fileName = path.split('\\').pop()?.split('/').pop() || '';
          const name = fileName.replace(/\.[^/.]+$/, "").replace(/(_cover|_banner|_logo)/i, "");
          setGameForm(prev => ({ ...prev, title: name.replace(/[_-]/g, ' ').toUpperCase() }));
        }

        if (editingId) {
          onUpdateCategories(prev => prev.map(cat => ({
            ...cat,
            games: cat.games.map(g => g.id === editingId ? { ...g, [target]: newPath } : g)
          })));
        }
      }
    } catch (e) {
      console.error("Asset import failed", e);
    }
  };

  const handleWipeMasterRegistry = () => {
    requestConfirmation(
      "ADVERTENCIA CRÍTICA: Borrado total de la biblioteca maestra y RECURSOS LOCALES.",
      async () => {
        try {
          await fetch('/api/system/wipe', { method: 'POST' });
          onUpdateCategories(prev => prev.map(c => ({ ...c, games: [] })));
        } catch (e) {
          console.error("Wipe failed", e);
        }
      }
    );
  };

  const handleDeleteGame = (gameId: string) => {
    requestConfirmation(
      "¿Eliminar permanentemente este registro y sus recursos locales?",
      async () => {
        try {
          await fetch('/api/games/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId })
          });
          onUpdateCategories(prev => prev.map(c => ({
            ...c,
            games: c.games.filter(g => g.id !== gameId)
          })));
        } catch (e) {
          console.error("Delete failed", e);
        }
      }
    );
  };

  const handleSaveCategoryData = async () => {
    if (!catForm.name || !editingId) return;
    onUpdateCategories(prev => prev.map(c => c.id === editingId ? { ...c, ...catForm } : c));
    setIsFormOpen(false);
    setEditingId(null);
    resetForms();
  };

  const NEON_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800', '#ff0000', '#8800ff', '#0088ff'];

  const handleCreateCategory = () => {
    const newId = `node_${Date.now()}`;
    const nextColor = NEON_COLORS[categories.length % NEON_COLORS.length];
    const newCat: Category = {
      id: newId,
      name: 'NEW_NODE',
      icon: ASSETS.templates.icon,
      color: nextColor,
      games: [],
      enabled: true
    };
    onUpdateCategories(prev => [...prev, newCat]);
    setEditingId(newId);
    setCatForm({
      name: newCat.name, icon: newCat.icon, color: newCat.color,
      wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15, enabled: true
    });
    scrollToForm();
  };

  const handleDeleteCategory = (catId: string) => {
    if (catId === 'all') return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    requestConfirmation(`¿Eliminar nodo "${cat.name}"?`, () => {
      onUpdateCategories(prev => prev.filter(c => c.id !== catId));
      if (editingId === catId) setEditingId(null);
    });
  };

  const handleMoveCategory = (catId: string, direction: 'up' | 'down') => {
    if (catId === 'all') return;
    onUpdateCategories(prev => {
      const idx = prev.findIndex(c => c.id === catId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 1 || newIdx >= prev.length) return prev;

      const newCategories = [...prev];
      const temp = newCategories[idx];
      newCategories[idx] = newCategories[newIdx];
      newCategories[newIdx] = temp;
      return newCategories;
    });
  };

  const handleMoveGameInCategory = (catId: string, gameId: string, direction: 'up' | 'down') => {
    onUpdateCategories(prev => prev.map(cat => {
      if (cat.id !== catId) return cat;
      const gameIdx = cat.games.findIndex(g => g.id === gameId);
      if (gameIdx === -1) return cat;
      const newIdx = direction === 'up' ? gameIdx - 1 : gameIdx + 1;
      if (newIdx < 0 || newIdx >= cat.games.length) return cat;

      const newGames = [...cat.games];
      const temp = newGames[gameIdx];
      newGames[gameIdx] = newGames[newIdx];
      newGames[newIdx] = temp;
      return { ...cat, games: newGames };
    }));
  };

  const handleSystemFormat = () => {
    requestConfirmation(
      "RESTABLECIMIENTO DE FÁBRICA: Esta acción eliminará todos los juegos, nodos y RECURSOS LOCALES. El sistema regresará a su estado inicial vacío.",
      async () => {
        try {
          await fetch('/api/system/wipe', { method: 'POST' });
          const factoryCategories: Category[] = [
            {
              id: 'all',
              name: 'ALL GAMES',
              icon: ASSETS.templates.icon,
              color: '#ffffff',
              wallpaper: '',
              wallpaperMode: 'cover',
              gridOpacity: 0.15,
              cardOpacity: 0.7,
              bgAnimationsEnabled: true,
              gridEnabled: true,
              scanlineEnabled: true,
              vignetteEnabled: true,
              games: []
            }
          ];
          onUpdateCategories(factoryCategories);
          onUpdateTaskbarMargin(0);
          setTab('games');
          setEditingId(null);
          resetForms();
        } catch (e) {
          console.error("Factory reset failed", e);
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-md">
      <AssetSearchModal
        isOpen={searchModal.isOpen}
        onClose={() => setSearchModal(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleCloudSelect}
        type={searchModal.type}
        accentColor={activeAccent}
        initialQuery={gameForm.title}
      />

      {confirmData && (
        <div className="absolute inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-300">
          <div className="max-w-[400px] w-full border border-red-500/20 bg-red-950/10 p-6 lg:p-10 flex flex-col gap-6 lg:gap-8 shadow-[0_0_100px_rgba(239,68,68,0.1)]">
            <div className="flex flex-col gap-2">
              <h3 className="font-['Press_Start_2P'] text-[8px] lg:text-[10px] text-red-500 uppercase">[ ERASE_PROTOCOL ]</h3>
              <p className="text-[10px] lg:text-[12px] font-bold text-white/80 leading-relaxed uppercase font-mono tracking-tight">{confirmData.message}</p>
            </div>
            <div className="flex gap-3 lg:gap-4">
              <button
                onClick={confirmData.onConfirm}
                className="flex-1 py-3 lg:py-4 bg-red-600 text-white font-bold text-[8px] lg:text-[9px] uppercase tracking-[0.2em] transition-all border-2 border-red-500 active:scale-95"
              >
                [ COMMIT_ERASE ]
              </button>
              <button
                onClick={() => setConfirmData(null)}
                className="flex-1 py-3 lg:py-4 border-2 border-white/20 hover:border-white/40 text-white font-bold text-[8px] lg:text-[9px] uppercase tracking-[0.2em] transition-all active:scale-95"
              >
                [ ABORT_LOG ]
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex flex-col bg-[#020202]/85 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] group/modal"
        style={{
          width: 'min(1100px, 95vw)',
          height: 'min(850px, 90vh)',
          clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
          transform: 'translateZ(0)',
          contain: 'layout paint'
        }}>

        <div className="absolute inset-0 pointer-events-none z-[90] opacity-30 transition-all duration-700"
          style={{
            clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
            background: activeAccent,
            padding: '2.5px'
          }}>
          <div className="w-full h-full bg-[#050505] opacity-80"
            style={{
              clipPath: 'polygon(27.5px 0, 100% 0, 100% calc(100% - 27.5px), calc(100% - 27.5px) 100%, 0 100%, 0 27.5px)',
              boxShadow: `inset 0 0 40px ${activeAccent}66`
            }}></div>
        </div>

        {allGamesCategory.scanlineEnabled !== false && (
          <div className="absolute inset-0 pointer-events-none z-[70] opacity-[0.04] overflow-hidden" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.08), rgba(0, 255, 0, 0.04), rgba(0, 0, 255, 0.08))', backgroundSize: '100% 3px, 2px 100%' }}></div>
        )}
        {allGamesCategory.vignetteEnabled !== false && (
          <div className="absolute inset-0 pointer-events-none z-[71] opacity-20 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
        )}

        <div className="flex justify-between items-center px-6 lg:px-10 py-5 lg:py-8 bg-black/60 border-b-2 border-white/10 shrink-0 relative z-[80]">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-['Press_Start_2P'] text-[9px] lg:text-[11px] uppercase tracking-tighter animate-pulse" style={{ color: activeAccent, textShadow: `0 0 20px ${activeAccent}aa`, filter: 'brightness(1.5)', willChange: 'transform, opacity' }}>[ CORE_ENGINE_TERMINAL ]</h2>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-['Space_Mono'] opacity-60 uppercase tracking-[0.5em] text-white">Phantom_Shell_v{APP_VERSION}.SYS</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: activeAccent, willChange: 'transform, opacity' }}></div>
                <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: activeAccent }}></div>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="px-6 py-2 font-bold text-[8px] uppercase tracking-widest transition-all border-2 active:scale-95 shadow-lg"
            style={{ borderColor: activeAccent, color: activeAccent }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = activeAccent; e.currentTarget.style.color = '#000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = activeAccent; }}
          >
            {t('nav.disconnect')}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 lg:w-60 bg-black/80 border-r-2 border-white/10 flex flex-col p-3 lg:p-4 gap-2 overflow-y-auto no-scrollbar shrink-0">
            {[
              { id: 'games', label: t('nav.unit_registry'), color: allGamesCategory.assetColor || activeAccent },
              { id: 'categories', label: t('nav.neural_nodes'), color: allGamesCategory.nodeColor || activeAccent },
              ...(isSecretUnlocked ? [{ id: 'secret', label: t('nav.secret_link'), color: '#ec4899' }] : []),
              { id: 'integrations', label: t('nav.sync_protocols'), color: allGamesCategory.syncColor || activeAccent },
              { id: 'system', label: t('nav.core_sequence'), color: allGamesCategory.coreColor || activeAccent }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id as any); resetForms(); setEditingId(null); setIsFormOpen(false); }}
                className={`w-full py-4 text-[9px] font-bold uppercase tracking-[0.3em] transition-all relative border-2 active:scale-95 text-left px-5 ${tab === item.id ? 'text-black' : 'bg-transparent text-white/40 border-white/5 hover:text-white hover:border-white/20'
                  }`}
                style={{
                  backgroundColor: tab === item.id ? item.color : 'transparent',
                  borderColor: tab === item.id ? item.color : 'transparent',
                  color: tab === item.id ? '#000' : undefined,
                  boxShadow: tab === item.id ? `0 0 15px ${item.color}44` : undefined
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-5 lg:p-10 overflow-y-auto custom-scrollbar font-['Space_Mono'] pb-24 lg:pb-32 backdrop-blur-xl">
            {tab === 'games' && (
              <div className="flex flex-col gap-10 lg:gap-16">
                <div ref={formRef}>
                  <GameEditForm
                    isFormOpen={isFormOpen}
                    setIsFormOpen={setIsFormOpen}
                    editingId={editingId}
                    activeAccent={activeAccent}
                    gameForm={gameForm}
                    setGameForm={setGameForm}
                    handleSaveGame={handleSaveGame}
                    triggerFileBrowser={triggerFileBrowser}
                    onResolveAsset={onResolveAsset}
                    otherCategories={otherCategories.filter(c => c.id !== 'hidden')}
                    sgdbKey={sgdbKey}
                    sgdbEnabled={sgdbEnabled}
                    setSearchModal={setSearchModal}
                  />
                </div>

                <div className="flex flex-col gap-6 lg:gap-8">
                  <div className="flex flex-col lg:flex-row justify-between lg:items-center border-b border-white/5 pb-4 lg:pb-5 gap-4">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.4em] opacity-60">{t('registry.storage_inventory')}</h4>
                      <span className="text-[6px] opacity-30 uppercase font-mono tracking-tighter">{t('registry.verified_list')}</span>
                    </div>
                    <div className="flex items-center gap-4 lg:gap-6">
                      <div className="relative group/filter">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('registry.query_placeholder')} className="bg-black/40 text-[10px] border-2 border-white/10 p-2 lg:p-2.5 outline-none uppercase font-mono w-40 lg:w-64 focus:border-white focus:bg-white/5 transition-all" />
                      </div>
                      <button
                        onClick={handleWipeMasterRegistry}
                        className="px-5 py-2 border-2 border-red-500 bg-red-600/10 text-red-500 font-bold text-[8px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                      >
                        {t('registry.erase_registry')}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 lg:gap-2">
                    {/* CATEGORY FILTER CHIPS */}
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar mb-2">
                      <button
                        onClick={() => setFilterCategory('all')}
                        className={`px-3 py-1 text-[8px] font-bold uppercase border transition-all whitespace-nowrap ${filterCategory === 'all'
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white'
                          }`}
                      >
                        {t('nav.all_units')}
                      </button>
                      {categories.filter(c => c.id !== 'all' && c.id !== 'hidden').map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setFilterCategory(cat.id)}
                          className={`px-3 py-1 text-[8px] font-bold uppercase border transition-all whitespace-nowrap ${filterCategory === cat.id
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white'
                            }`}
                          style={filterCategory === cat.id ? {
                            backgroundColor: cat.color,
                            borderColor: cat.color,
                            color: '#000' // Ensure legible text on bright colors
                          } : {
                            borderColor: filterCategory === cat.id ? cat.color : undefined
                          }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5 lg:gap-2">
                      {sortedAndFilteredMasterGames.length === 0 ? (
                        <div className="py-10 text-center opacity-10 text-[8px] uppercase tracking-[0.5em]">Registry_Status: EMPTY</div>
                      ) : sortedAndFilteredMasterGames.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 lg:p-5 bg-black/40 border-2 border-white/5 hover:border-white/20 group/row transition-all shrink-0 relative overflow-hidden">
                          <div className="flex items-center gap-4 lg:gap-7 min-w-0">
                            <div className="relative shrink-0">
                              <img src={onResolveAsset(g.cover)} className="w-8 h-12 lg:w-10 lg:h-14 object-cover opacity-80 border-2 border-white/10" alt="" />
                              <div className="absolute -inset-[2px] border-2 border-white/5 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col min-w-0 truncate">
                              <span className="text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.15em] truncate group-hover/row:text-white" style={{ textShadow: `0 0 10px ${accentColor}22` }}>{g.title}</span>
                              <span className="text-[6px] lg:text-[7px] opacity-40 uppercase font-mono tracking-tighter truncate">{`REF::${g.id.substring(0, 8)}...`}</span>
                            </div>
                          </div>
                          <div className="flex gap-3 lg:gap-5 opacity-0 group-hover/row:opacity-100 transition-all shrink-0 z-10">
                            <button
                              onClick={() => { setEditingId(g.id); setGameForm({ title: g.title, cover: g.cover, banner: g.banner, logo: g.logo, execPath: g.execPath || '', execArgs: g.execArgs || '', wallpaper: g.wallpaper || '', categoryIds: categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.games.some(x => x.id === g.id)).map(c => c.id) }); scrollToForm(); }}
                              className="px-5 py-2 text-[9px] font-bold uppercase border-2 transition-all active:scale-95"
                              style={{ borderColor: activeAccent, color: activeAccent }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = activeAccent; e.currentTarget.style.color = '#000'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = activeAccent; }}
                            >
                              MODIFY
                            </button>
                            <button
                              onClick={() => handleDeleteGame(g.id)}
                              className="px-5 py-2 text-[9px] font-bold uppercase border-2 border-red-500 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                            >
                              PURGE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'secret' && (
              <div className="flex flex-col gap-10 lg:gap-16">
                <div className="flex flex-col gap-4 border-b border-pink-500/20 pb-8">
                  <div className="flex items-center gap-4">
                    <img src={(ASSETS.external as any).hidden || './res/external/hidden.png'} className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#ec4899]" alt="" />
                    <div className="flex flex-col">
                      <h3 className="text-pink-500 font-['Press_Start_2P'] text-[10px] uppercase tracking-widest">Secret_Node.EXE</h3>
                      <span className="text-[7px] text-white/40 uppercase font-mono">Offline-Only Isolated Protocol</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Left Side: Category Config */}
                  <div className="flex flex-col gap-6 p-6 bg-pink-950/10 border border-pink-500/20 rounded-sm">
                    <h4 className="text-[8px] font-bold text-pink-500/60 uppercase tracking-widest">[ SYSTEM_PARAMS ]</h4>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[6px] opacity-40 uppercase">Label</label>
                        <input
                          type="text"
                          value={categories.find(c => c.id === 'hidden')?.name || ''}
                          onChange={(e) => onUpdateCategories(prev => prev.map(c => c.id === 'hidden' ? { ...c, name: e.target.value.toUpperCase() } : c))}
                          className="bg-black/40 border-2 border-white/10 p-2 text-[10px] text-white outline-none focus:border-pink-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[6px] opacity-40 uppercase">Neural_Color</label>
                        <div className="flex gap-3 items-center">
                          <input
                            type="color"
                            value={categories.find(c => c.id === 'hidden')?.color || '#ec4899'}
                            onChange={(e) => onUpdateCategories(prev => prev.map(c => c.id === 'hidden' ? { ...c, color: e.target.value } : c))}
                            className="w-10 h-10 bg-transparent border-none cursor-pointer"
                          />
                          <span className="text-[10px] font-mono opacity-60 uppercase">{categories.find(c => c.id === 'hidden')?.color}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Hidden Games Management */}
                  <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[8px] font-bold text-pink-500/60 uppercase tracking-widest">[ HIDDEN_REGISTRY ]</h4>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setGameForm({ title: '', cover: '', banner: '', logo: '', execPath: '', categoryIds: ['hidden'], wallpaper: '' });
                          setIsFormOpen(true);
                        }}
                        className="px-4 py-2 bg-pink-600 text-white text-[7px] font-bold uppercase tracking-widest hover:bg-pink-500 transition-all"
                      >
                        + Add_Hidden
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {(categories.find(c => c.id === 'hidden')?.games || []).map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 bg-white/[0.02] border-2 border-white/5 hover:border-pink-500/30 transition-all group">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={onResolveAsset(g.cover)} className="w-6 h-9 object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                            <span className="text-[9px] font-bold uppercase tracking-tight truncate">{g.title}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingId(g.id); setGameForm({ ...g, categoryIds: ['hidden'] }); setIsFormOpen(true); }}
                              className="text-[7px] font-bold uppercase border-2 transition-all active:scale-95 px-2 py-1"
                              style={{ borderColor: '#ec4899', color: '#ec4899' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ec4899'; e.currentTarget.style.color = '#000'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#ec4899'; }}
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => handleDeleteGame(g.id)}
                              className="text-[7px] font-bold uppercase border-2 border-red-500 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 px-2 py-1"
                            >
                              PURGE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {isFormOpen && gameForm.categoryIds.includes('hidden') && (
                  <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
                    <GameEditForm
                      isFormOpen={isFormOpen}
                      setIsFormOpen={setIsFormOpen}
                      editingId={editingId}
                      activeAccent="#ec4899"
                      gameForm={gameForm}
                      setGameForm={setGameForm}
                      handleSaveGame={handleSaveGame}
                      triggerFileBrowser={triggerFileBrowser}
                      onResolveAsset={onResolveAsset}
                      otherCategories={otherCategories.filter(c => c.id !== 'hidden')}
                      sgdbKey="" // OFF BY DEFAULT
                      sgdbEnabled={false} // OFFLINE ONLY
                      setSearchModal={setSearchModal}
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'categories' && (
              <div className="flex flex-col gap-10 lg:gap-16">
                {!editingId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6" style={{ contain: 'layout paint' }}>

                    {/* NEW NODE BUTTON - Architect Style */}
                    <div onClick={() => { handleCreateCategory(); scrollToForm(); }}
                      className="relative group cursor-pointer min-h-[160px] lg:min-h-[200px]"
                      style={{
                        clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
                      }}>
                      <div className="absolute inset-0 bg-white/10 group-hover:bg-white/30 transition-all pointer-events-none" /> {/* Border Layer */}
                      <div className="absolute inset-[2px] bg-black/40 group-hover:bg-black/50 transition-all flex flex-col items-center justify-center gap-3"
                        style={{
                          clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)'
                        }}>
                        <div className="w-10 h-10 flex items-center justify-center border-2 border-white/10 rounded-full text-white/20 group-hover:text-white group-hover:border-white transition-all text-2xl font-light">+</div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-40 group-hover:opacity-100 transition-opacity text-center text-white">INITIALIZE_NODE</span>
                      </div>
                    </div>

                    {/* CATEGORY NODES */}
                    {categories.filter(c => c.id !== 'hidden').map((c, idx) => (
                      <div key={c.id} className="relative group min-h-[160px] lg:min-h-[200px]"
                        style={{
                          clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
                          contain: 'layout paint'
                        }}>

                        {/* 1. Border Layer (Background color acts as border) */}
                        <div className="absolute inset-0 transition-all duration-300"
                          style={{ backgroundColor: idx === currentCatIdx ? c.color : 'rgba(255,255,255,0.1)' }}></div>

                        {/* 2. Content Layer (Inset by 2px) */}
                        <div className="absolute inset-[2px] bg-[#080808] flex flex-col"
                          style={{
                            clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)'
                          }}>

                          {/* Main clickable area */}
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 cursor-pointer relative overflow-hidden group/content"
                            onClick={() => { setEditingId(c.id); scrollToForm(); }}>

                            {/* Background Image/Gradient Effect */}
                            <div className="absolute inset-0 opacity-0 group-hover/content:opacity-20 transition-opacity duration-700 bg-gradient-to-br from-white/5 to-transparent"></div>

                            {/* Order Number - Prominent */}
                            <div className="absolute top-0 right-0 p-3 opacity-30 font-mono text-[24px] font-bold leading-none select-none transition-all group-hover/content:opacity-60"
                              style={{ color: c.color }}>
                              {String(idx + 1).padStart(2, '0')}
                            </div>

                            {/* Icon */}
                            <div className="relative z-10 w-12 h-12 flex items-center justify-center transition-transform group-hover/content:scale-110 duration-500">
                              <img src={onResolveAsset(c.icon)} className="w-full h-full object-contain brightness-0 invert opacity-60 group-hover/content:opacity-100 transition-all drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" alt="" />
                            </div>

                            {/* Name & ID */}
                            <div className="flex flex-col items-center gap-1 z-10">
                              <span className="text-[10px] font-bold uppercase tracking-[0.3em] font-['Space_Mono'] text-white group-hover/content:text-white transition-colors text-center">{c.name}</span>
                              <span className="text-[7px] opacity-30 uppercase font-mono tracking-tighter">NODE_ID::{c.id.substring(0, 8)}</span>
                            </div>
                          </div>

                          {/* Action Bar (Bottom) - Only visible for manageable categories */}
                          {c.id !== 'all' && (
                            <div className="h-10 border-t border-white/5 bg-white/[0.02] flex divide-x divide-white/5 opacity-60 group-hover:opacity-100 transition-opacity">
                              {/* Move Up */}
                              <button onClick={(e) => { e.stopPropagation(); idx > 1 && handleMoveCategory(c.id, 'up'); }}
                                disabled={idx <= 1}
                                className="flex-1 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-white/60 hover:text-white transition-colors text-[10px]">
                                ▲
                              </button>

                              {/* Move Down */}
                              <button onClick={(e) => { e.stopPropagation(); idx < categories.length - 1 && handleMoveCategory(c.id, 'down'); }}
                                disabled={idx >= categories.length - 1}
                                className="flex-1 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-white/60 hover:text-white transition-colors text-[10px]">
                                ▼
                              </button>

                              {/* Delete */}
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }}
                                className="flex-[1.5] bg-red-900/10 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center text-red-500 text-[8px] font-bold uppercase tracking-widest">
                                PURGE
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-10 lg:gap-14 animate-in fade-in duration-500">
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center border-b border-white/5 pb-6 lg:pb-8 gap-4">
                      <div className="flex gap-4 lg:gap-8 items-center">
                        <h3 className="text-[10px] lg:text-[12px] font-bold uppercase tracking-[0.3em] lg:tracking-[0.5em]" style={{ color: catForm.color }}>Node: {catForm.name}</h3>
                        {editingId !== 'all' && <button onClick={() => handleDeleteCategory(editingId!)} className="text-[7px] lg:text-[8px] font-bold text-red-500 opacity-40 hover:opacity-100 uppercase tracking-widest border-2 border-red-500/20 px-3 py-1 hover:bg-red-500/10 transition-all">PURGE</button>}
                      </div>
                      <button onClick={() => { setEditingId(null); setIsFormOpen(false); resetForms(); }} className="text-[9px] lg:text-[10px] opacity-40 hover:opacity-100 uppercase font-bold self-start lg:self-auto">Back</button>
                    </div>
                    <div ref={formRef}>
                      <CategoryEditForm
                        isFormOpen={isFormOpen}
                        setIsFormOpen={setIsFormOpen}
                        gameList={categories.find(c => c.id === editingId)?.games || []}
                        editingId={editingId}
                        catForm={catForm}
                        setCatForm={setCatForm}
                        handleSaveCategoryData={handleSaveCategoryData}
                        handleMoveGameInCategory={handleMoveGameInCategory}
                        triggerFileBrowser={triggerFileBrowser}
                        onResolveAsset={onResolveAsset}
                        activeAccent={activeAccent}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'integrations' && (
              <div className="flex flex-col gap-10 lg:gap-16">
                <div className="flex flex-col gap-6">
                  <h3 className="text-[10px] lg:text-[12px] font-bold uppercase tracking-[0.4em] opacity-60">EXTERNAL_SYNC_PROTOCOLS</h3>
                  <div className="grid grid-cols-1 gap-12">

                    <Subsection title="Sync_Protocol: Steam" onSync={handleSyncSteamLibrary} syncLabel="INIT_SYNC" accentColor={activeAccent}>
                      <div className="flex flex-col lg:flex-row gap-4 col-span-1 lg:col-span-2 w-full">
                        {/* Left Side: Identity Card (Grows to fill space) */}
                        <div className="flex-1 flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 rounded-sm min-h-[80px]">
                          <img src="./res/external/steam_icon.png" className="w-8 h-8 opacity-80" alt="Steam" />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-white uppercase tracking-widest">Valve_Master_System</span>
                            <span className="text-[7px] text-white/60 uppercase font-mono">Link_Status: {categories.find(c => c.id === 'steam') ? 'STABLE' : 'UNCONNECTED'}</span>
                          </div>
                        </div>

                        {/* Right Side: Options Stack (Fixed width, separate blocks) */}
                        <div className="flex flex-col gap-2 w-full lg:w-48 shrink-0">
                          <button onClick={() => setSteamOptions(prev => ({ ...prev, includeHidden: !prev.includeHidden }))}
                            className={`flex flex-1 items-center justify-between px-3 py-1.5 border-2 transition-all ${steamOptions.includeHidden ? 'bg-white/5 border-white shadow-lg' : 'bg-transparent border-white/5 opacity-40 hover:opacity-100 hover:border-white/20'}`}
                            style={{ borderColor: steamOptions.includeHidden ? activeAccent : undefined }}
                          >
                            <span className="text-[7px] font-bold uppercase tracking-wider text-left">INDEX_REDACTED</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${steamOptions.includeHidden ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-white/10'}`} />
                          </button>

                          <button onClick={() => setSteamOptions(prev => ({ ...prev, includeSoftware: !prev.includeSoftware }))}
                            className={`flex flex-1 items-center justify-between px-3 py-1.5 border-2 transition-all ${steamOptions.includeSoftware ? 'bg-white/5 border-white shadow-lg' : 'bg-transparent border-white/5 opacity-40 hover:opacity-100 hover:border-white/20'}`}
                            style={{ borderColor: steamOptions.includeSoftware ? activeAccent : undefined }}
                          >
                            <span className="text-[7px] font-bold uppercase tracking-wider text-left">SCAN_TOOLS</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${steamOptions.includeSoftware ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-white/10'}`} />
                          </button>
                        </div>
                      </div>
                    </Subsection>

                    <Subsection title="Xbox" onSync={handleSyncXboxLibrary} syncLabel="INIT_SYNC" accentColor={activeAccent}>
                      <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 rounded-sm col-span-1 lg:col-span-2 w-full">
                        <img src="./res/external/xbox.png" className="w-8 h-8 opacity-80 backdrop-brightness-75" alt="Xbox" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-white uppercase tracking-widest">Xbox_Game_Pass</span>
                          <span className="text-[7px] text-white/40 uppercase font-mono">Link_Status: {categories.find(c => c.id === 'xbox') ? 'STABLE' : 'OFFLINE'}</span>
                        </div>
                      </div>
                    </Subsection>

                    <Subsection title="GOG Galaxy" accentColor={activeAccent}>
                      <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 rounded-sm opacity-50 col-span-1 lg:col-span-2 w-full">
                        <div className="w-8 h-8 flex items-center justify-center bg-purple-500/10 text-purple-500 rounded-full font-bold text-[10px]">G</div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-white uppercase tracking-widest">GOG Galaxy</span>
                          <span className="text-[7px] text-white/40 uppercase font-mono">Status: COMING SOON</span>
                        </div>
                      </div>
                    </Subsection>

                    <Subsection title="SteamGridDB Gateway" accentColor={activeAccent}>
                      <div className="flex flex-col gap-4 col-span-1 lg:col-span-2 w-full">
                        {/* Main Status & Control Card */}
                        <div className="flex items-center justify-between p-4 bg-white/[0.01] border-2 border-white/5 rounded-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-full font-bold text-[10px]">☁</div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-white uppercase tracking-widest">Asset_Cloud_Link</span>
                              <span className="text-[7px] text-white/40 uppercase font-mono">Status: {sgdbEnabled ? (sgdbKey ? 'ONLINE' : 'MISSING_KEY') : 'DISABLED'}</span>
                            </div>
                          </div>

                          {/* Integrated Toggle Switch */}
                          <button
                            onClick={() => sgdbKey.trim() && handleToggleSgdb(!sgdbEnabled)}
                            disabled={!sgdbKey.trim()}
                            className={`flex items-center gap-3 px-4 py-2 border-2 transition-all ${sgdbEnabled && sgdbKey.trim() ? 'bg-white/10 border-white/40 cursor-pointer' : 'bg-transparent border-white/5 opacity-40 cursor-not-allowed'}`}
                            style={{ borderColor: sgdbEnabled && sgdbKey.trim() ? activeAccent : undefined }}
                          >
                            <span className="text-[7px] font-bold uppercase tracking-wider">{sgdbEnabled ? 'MODULE_ACTIVE' : 'MODULE_OFF'}</span>
                            <div className={`w-2 h-2 rounded-full transition-all ${sgdbEnabled && sgdbKey.trim() ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-white/20'}`} />
                          </button>
                        </div>

                        {/* API Key Input Section (Simplified & Always Visible) */}
                        <div className="flex flex-col gap-2 px-1">
                          <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold pl-1">API_ACCESS_KEY (Required for Cloud)</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={sgdbKey}
                              onChange={(e) => setSgdbKey(e.target.value)}
                              placeholder="PASTE_KEY_HERE"
                              className="flex-1 bg-black/40 border-2 border-white/10 p-3 text-[10px] outline-none font-mono tracking-widest focus:border-white focus:bg-white/5 transition-all text-white/60 focus:text-white"
                            />
                            <button
                              onClick={() => {
                                handleUpdateSgdbKey(sgdbKey);
                                if (sgdbKey.trim() && !sgdbEnabled) handleToggleSgdb(true);
                              }}
                              className="px-6 font-bold text-[8px] uppercase tracking-widest border-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all text-white/60 active:scale-95"
                              style={{ borderColor: activeAccent, color: activeAccent }}
                            >
                              COMMIT_KEY
                            </button>
                          </div>
                          <a href="https://www.steamgriddb.com/profile/preferences" target="_blank" rel="noopener noreferrer" className="text-[6px] text-white/20 hover:text-white/60 uppercase tracking-widest font-mono pl-1 transition-colors self-start">
                            [ GET_API_KEY ]
                          </a>
                        </div>
                      </div>
                    </Subsection>

                  </div>
                </div>
              </div>
            )}

            {tab === 'system' && (
              <SystemTab
                activeAccent={activeAccent}
                allGamesCategory={allGamesCategory}
                onUpdateCategories={onUpdateCategories}
                taskbarMargin={taskbarMargin}
                onUpdateTaskbarMargin={onUpdateTaskbarMargin}
                triggerFileBrowser={triggerFileBrowser}
                onResolveAsset={onResolveAsset}
                handleSystemFormat={handleSystemFormat}
              />
            )}
          </div>
        </div>
      </div>

      <FileExplorerModal
        isOpen={explorer.isOpen}
        onClose={() => setExplorer(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleExplorerSelect}
        filter={explorer.filter}
        accentColor={activeAccent}
        initialPath={explorer.initialPath}
      />
    </div >
  );
};

export default ManagementModal;
