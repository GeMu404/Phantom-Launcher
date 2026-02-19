import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Category, Game } from '../types';
import { ASSETS, APP_VERSION } from '../constants';
import AssetInput from './AssetInput';
import FileExplorerModal from './FileExplorerModal';
import Subsection from './management/Subsection';
import GameEditForm from './management/GameEditForm';
import CategoryEditForm from './management/CategoryEditForm';
import SystemTab from './management/SystemTab';
import AssetSearchModal from './AssetSearchModal';
import GamesTab from './management/GamesTab';
import CategoriesTab from './management/CategoriesTab';
import IntegrationsTab from './management/IntegrationsTab';
import { useTranslation } from '../hooks/useTranslation';
// const useTranslation = () => ({ t: (key: string) => key });

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
  const otherCategories = categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent');

  const recentExists = categories.some(c => c.id === 'recent');
  const editableCategories = [...categories.filter(c => c.id !== 'all' && c.id !== 'hidden')];

  if (!recentExists) {
    editableCategories.unshift({
      id: 'recent',
      name: 'RECENT',
      icon: (ASSETS as any).templates?.icon || '',
      color: '#00ffcc',
      games: [],
      enabled: true,
      wallpaper: '',
      wallpaperMode: 'cover',
      gridOpacity: 0.15
    });
  }

  const [gameForm, setGameForm] = useState({ title: '', cover: '', banner: '', logo: '', execPath: '', execArgs: '', categoryIds: [] as string[], wallpaper: '' });
  const [catForm, setCatForm] = useState({ name: '', icon: '', color: '#ffffff', wallpaper: '', wallpaperMode: 'cover' as any, gridOpacity: 0.15, enabled: true });
  const [steamOptions, setSteamOptions] = useState({ includeHidden: false, includeSoftware: false });
  const [sgdbKey, setSgdbKey] = useState('');
  const [sgdbEnabled, setSgdbEnabled] = useState(false);
  const [searchModal, setSearchModal] = useState({ isOpen: false, type: 'grid' as 'grid' | 'hero' | 'logo', targetField: 'cover' as 'cover' | 'banner' | 'logo' | 'icon' });
  const [activeTempId, setActiveTempId] = useState<string | null>(null);

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
    if (enabled && !sgdbKey.trim()) return;
    setSgdbEnabled(enabled);
    fetch('/api/sgdb/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: sgdbKey, enabled })
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setSearchQuery('');
      setConfirmData(null);
      setIsFormOpen(false);
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

  useEffect(() => {
    if (tab === 'categories' && editingId) {
      let cat = categories.find(c => c.id === editingId);
      if (!cat && editingId === 'recent') {
        cat = {
          id: 'recent',
          name: 'RECENT',
          icon: (ASSETS as any).templates?.icon || '',
          color: '#00ffcc',
          games: [],
          enabled: true,
          wallpaper: '',
          wallpaperMode: 'cover',
          gridOpacity: 0.15
        } as any;
      }

      if (cat) {
        setCatForm({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          wallpaper: cat.wallpaper || '',
          wallpaperMode: cat.wallpaperMode || 'cover',
          gridOpacity: cat.gridOpacity ?? 0.15,
          enabled: cat.enabled ?? true,
          ...cat // Spread everything else to be safe
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
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const [filterCategory, setFilterCategory] = useState<string>('all');

  const sortedAndFilteredMasterGames = useMemo(() => {
    let games = [...allGamesCategory.games];
    if (filterCategory !== 'all') {
      const targetCat = categories.find(c => c.id === filterCategory);
      if (targetCat) {
        const targetIds = new Set(targetCat.games.map(g => g.id));
        games = games.filter(g => targetIds.has(g.id));
      }
    }
    if (searchQuery) {
      games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return games.sort((a, b) => a.title.localeCompare(b.title));
  }, [allGamesCategory.games, searchQuery, filterCategory, categories]);

  const handleSyncSteamLibrary = async () => {
    try {
      const response = await fetch('/api/steam/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steamOptions)
      });
      const { games: steamGames } = await response.json();
      onUpdateCategories(prev => {
        const steamCatIndex = prev.findIndex(c => c.id === 'steam');
        let newCategories = [...prev];
        if (steamCatIndex === -1 && steamGames.length > 0) {
          newCategories.push({
            id: 'steam',
            name: 'STEAM',
            icon: (ASSETS as any).external?.steam || './res/external/steam_icon.png',
            color: '#1b2838',
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
      const { games: xboxGames } = await response.json();
      onUpdateCategories(prev => {
        const xboxCatIndex = prev.findIndex(c => c.id === 'xbox');
        let newCategories = [...prev];
        if (xboxCatIndex === -1 && xboxGames.length > 0) {
          newCategories.push({
            id: 'xbox',
            name: 'XBOX',
            icon: './res/external/xbox.png',
            color: '#107C10',
            games: [],
            enabled: true,
            wallpaper: '',
            wallpaperMode: 'cover',
            gridOpacity: 0.15
          });
        }
        return newCategories.map(cat => {
          if (cat.id === 'all' || cat.id === 'xbox') {
            const existingIds = new Set(cat.games.map(g => g.id));
            const uniqueNew = xboxGames.filter((g: Game) => !existingIds.has(g.id));
            return { ...cat, games: [...cat.games, ...uniqueNew] };
          }
          return cat;
        });
      });
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
    // Preserve existing game metadata (e.g., lastPlayed, playTime)
    const existingGame = categories.flatMap(c => c.games).find(g => g.id === newId);

    const gameObj: Game = {
      ...existingGame!, // Spread existing props first
      id: newId!,
      title: gameForm.title,
      cover: gameForm.cover,
      banner: gameForm.banner,
      logo: gameForm.logo,
      execPath: gameForm.execPath,
      execArgs: gameForm.execArgs,
      source: existingGame?.source || 'manual', // Keep source or default to manual
      wallpaper: gameForm.wallpaper
    };
    onUpdateCategories(prev => prev.map(cat => {
      let isTarget = cat.id === 'all' || gameForm.categoryIds.includes(cat.id);
      if (cat.id === 'all' && gameForm.categoryIds.includes('hidden')) isTarget = false;
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
    if (tab === 'categories') {
      const catId = editingId;
      if (!catId) return;
      // Import the file to local storage so it persists
      try {
        const importRes = await fetch('/api/assets/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: path, gameId: `_cat_${catId}`, assetType: target })
        });
        const importData = await importRes.json();
        const storedPath = importData.path || path;
        setCatForm(prev => ({ ...prev, [target]: storedPath }));
        const exists = categories.some(c => c.id === catId);
        if (exists) {
          onUpdateCategories(prev => prev.map(c => c.id === catId ? { ...c, [target]: storedPath } : c));
        } else {
          onUpdateCategories(prev => [...prev, { id: catId, ...catForm, [target]: storedPath, games: [] } as any]);
        }
      } catch (e) {
        // Fallback to raw path if import fails
        setCatForm(prev => ({ ...prev, [target]: path }));
        const exists = categories.some(c => c.id === catId);
        if (exists) {
          onUpdateCategories(prev => prev.map(c => c.id === catId ? { ...c, [target]: path } : c));
        } else {
          onUpdateCategories(prev => [...prev, { id: catId, ...catForm, [target]: path, games: [] } as any]);
        }
      }
      return;
    }
    if (target === 'execPath') {
      const gameId = editingId || activeTempId;
      if (!gameId) return;

      try {
        // 1. Create Internal Portable Shortcut
        const importRes = await fetch('/api/assets/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: path, gameId, assetType: 'launch' })
        });
        const importData = await importRes.json();
        const internalPath = importData.path || path;

        // 2. Fetch original info for metadata (args, resolved title)
        const infoRes = await fetch('/api/files/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: path })
        });
        const info = await infoRes.json();

        setGameForm(prev => ({
          ...prev,
          execPath: internalPath,
          execArgs: info.Arguments || prev.execArgs || '',
          title: prev.title || info.TargetPath?.split('\\').pop()?.split('/').pop()?.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').toUpperCase() || path.split('\\').pop()?.split('/').pop()?.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').toUpperCase() || ''
        }));
      } catch (e) {
        console.error("Internal shortcut creation failed", e);
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
        setGameForm(prev => ({ ...prev, [target]: data.path }));
        if (editingId) {
          onUpdateCategories(prev => prev.map(cat => ({
            ...cat,
            games: cat.games.map(g => g.id === editingId ? { ...g, [target]: data.path } : g)
          })));
        }
      }
    } catch (e) {
      console.error("Asset import failed", e);
    }
  };

  const handleWipeMasterRegistry = () => {
    requestConfirmation("ERASE_ALL_REGISTRY_DATA?", async () => {
      await fetch('/api/system/wipe', { method: 'POST' });
      onUpdateCategories(prev => prev.map(c => ({ ...c, games: [] })));
    });
  };

  const handleDeleteGame = (gameId: string) => {
    requestConfirmation("PURGE_GAME_REGISTRY?", async () => {
      await fetch('/api/games/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
      onUpdateCategories(prev => prev.map(c => ({ ...c, games: c.games.filter(g => g.id !== gameId) })));
    });
  };

  const handleSaveCategoryData = async () => {
    if (!catForm.name || !editingId) return;

    onUpdateCategories(prev => {
      const exists = prev.some(c => c.id === editingId);

      // If editing 'recent' or 'all' and it's not in the state yet (virtual), add it
      if (!exists && (editingId === 'recent' || editingId === 'all')) {
        const newCatPart = {
          id: editingId,
          ...catForm,
          games: [] // Games are managed dynamically for these, only style persists
        };
        return [...prev, newCatPart as any];
      }

      return prev.map(c => c.id === editingId ? { ...c, ...catForm } : c);
    });

    setIsFormOpen(false);
    setEditingId(null);
    resetForms();
  };

  const NEON_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800', '#ff0000', '#8800ff', '#0088ff'];
  const handleCreateCategory = () => {
    const newId = `node_${Date.now()}`;
    const nextColor = NEON_COLORS[categories.length % NEON_COLORS.length];
    const newCat = { id: newId, name: 'NEW_NODE', icon: ASSETS.templates.icon, color: nextColor, games: [], enabled: true };
    onUpdateCategories(prev => [...prev, newCat as any]);
    setEditingId(newId);
    setCatForm({ name: 'NEW_NODE', icon: ASSETS.templates.icon, color: nextColor, wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15, enabled: true });
    scrollToForm();
  };

  const handleDeleteCategory = (catId: string) => {
    if (catId === 'all') return;
    requestConfirmation(`PURGE_NODE_${catId}?`, () => {
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
      const newCats = [...prev];
      [newCats[idx], newCats[newIdx]] = [newCats[newIdx], newCats[idx]];
      return newCats;
    });
  };

  const handleMoveGameInCategory = (catId: string, gameId: string, direction: 'up' | 'down') => {
    onUpdateCategories(prev => prev.map(cat => {
      if (cat.id !== catId) return cat;
      const gIdx = cat.games.findIndex(g => g.id === gameId);
      if (gIdx === -1) return cat;
      const newIdx = direction === 'up' ? gIdx - 1 : gIdx + 1;
      if (newIdx < 0 || newIdx >= cat.games.length) return cat;
      const newGames = [...cat.games];
      [newGames[gIdx], newGames[newIdx]] = [newGames[newIdx], newGames[gIdx]];
      return { ...cat, games: newGames };
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-glass fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-md">
      <AssetSearchModal
        isOpen={searchModal.isOpen}
        onClose={() => setSearchModal(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleCloudSelect}
        type={searchModal.type}
        accentColor={activeAccent}
        initialQuery={gameForm.title}
      />
      {confirmData && (
        <div className="absolute inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-[400px] w-full border border-red-500/20 bg-red-950/10 p-6 flex flex-col gap-6">
            <h3 className="font-['Press_Start_2P'] text-[8px] text-red-500">[ ERASE_PROTOCOL ]</h3>
            <p className="text-[10px] text-white/80 uppercase font-mono">{confirmData.message}</p>
            <div className="flex gap-4">
              <button onClick={confirmData.onConfirm} className="flex-1 py-3 bg-red-600 text-white font-bold text-[8px] uppercase">COMMIT</button>
              <button onClick={() => setConfirmData(null)} className="flex-1 py-3 border border-white/20 text-white font-bold text-[8px] uppercase">ABORT</button>
            </div>
          </div>
        </div>
      )}
      <div className="relative flex flex-col bg-[#020202]/85 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
        style={{
          width: 'min(1100px, 95vw)',
          height: 'min(850px, 90vh)',
          clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
          transform: 'translateZ(0)',
          contain: 'layout paint'
        }}>
        <div className="absolute inset-0 pointer-events-none z-[90] opacity-30"
          style={{
            clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
            background: activeAccent,
            padding: '2.5px'
          }}>
          <div className="w-full h-full bg-[#050505] opacity-80" style={{ clipPath: 'polygon(27.5px 0, 100% 0, 100% calc(100% - 27.5px), calc(100% - 27.5px) 100%, 0 100%, 0 27.5px)' }}></div>
        </div>

        <div className="flex justify-between items-center px-6 lg:px-10 py-5 lg:py-8 bg-black/60 border-b-2 border-white/10 shrink-0 relative z-[80]">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-['Press_Start_2P'] text-[9px] lg:text-[11px] uppercase tracking-tighter" style={{ color: activeAccent }}>[ CORE_ENGINE_TERMINAL ]</h2>
            <span className="text-[7px] font-['Space_Mono'] opacity-60 uppercase tracking-[0.5em] text-white">Phantom_Shell_v{APP_VERSION}.SYS</span>
          </div>
          <button onClick={onClose} className="px-6 py-2 font-bold text-[8px] uppercase tracking-widest border-2" style={{ borderColor: activeAccent, color: activeAccent }}>{t('nav.disconnect')}</button>
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
              <button key={item.id} onClick={() => { setTab(item.id as any); setEditingId(null); setIsFormOpen(false); }}
                className={`w-full py-4 text-[9px] font-bold uppercase tracking-[0.3em] transition-all relative border-2 text-left px-5 ${tab === item.id ? 'text-black' : 'bg-transparent text-white/40 border-white/5 hover:text-white'}`}
                style={{ backgroundColor: tab === item.id ? item.color : 'transparent', borderColor: tab === item.id ? item.color : 'transparent' }}>
                {item.label}
              </button>
            ))}
          </div>

          <div ref={scrollContainerRef} className="flex-1 p-5 lg:p-10 overflow-y-auto custom-scrollbar font-['Space_Mono'] pb-24 lg:pb-32">
            {tab === 'games' && (
              <GamesTab
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
                editingId={editingId}
                setEditingId={setEditingId}
                activeAccent={activeAccent}
                gameForm={gameForm}
                setGameForm={setGameForm}
                handleSaveGame={handleSaveGame}
                triggerFileBrowser={triggerFileBrowser}
                onResolveAsset={onResolveAsset}
                otherCategories={otherCategories}
                sgdbKey={sgdbKey}
                sgdbEnabled={sgdbEnabled}
                setSearchModal={setSearchModal}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleWipeMasterRegistry={handleWipeMasterRegistry}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                categories={categories}
                sortedGames={sortedAndFilteredMasterGames}
                handleDeleteGame={handleDeleteGame}
                scrollToForm={scrollToForm}
              />
            )}

            {tab === 'categories' && (
              <CategoriesTab
                editingId={editingId}
                setEditingId={setEditingId}
                handleCreateCategory={handleCreateCategory}
                categories={categories}
                editableCategories={editableCategories}
                onResolveAsset={onResolveAsset}
                handleMoveCategory={handleMoveCategory}
                handleDeleteCategory={handleDeleteCategory}
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
                catForm={catForm}
                setCatForm={setCatForm}
                handleSaveCategoryData={handleSaveCategoryData}
                handleMoveGameInCategory={handleMoveGameInCategory}
                triggerFileBrowser={triggerFileBrowser}
                activeAccent={activeAccent}
                scrollToForm={scrollToForm}
              />
            )}

            {tab === 'integrations' && (
              <IntegrationsTab
                activeAccent={activeAccent}
                handleSyncSteamLibrary={handleSyncSteamLibrary}
                handleSyncXboxLibrary={handleSyncXboxLibrary}
                sgdbKey={sgdbKey}
                handleUpdateSgdbKey={handleUpdateSgdbKey}
                sgdbEnabled={sgdbEnabled}
                handleToggleSgdb={handleToggleSgdb}
                steamOptions={steamOptions}
                setSteamOptions={setSteamOptions}
              />
            )}

            {tab === 'system' && (
              <SystemTab activeAccent={activeAccent} allGamesCategory={allGamesCategory} onUpdateCategories={onUpdateCategories} taskbarMargin={taskbarMargin} onUpdateTaskbarMargin={onUpdateTaskbarMargin} triggerFileBrowser={triggerFileBrowser} onResolveAsset={onResolveAsset} />
              // <div className="p-4 bg-red-500/20 text-white font-mono">SYSTEM TAB TEMPORARILY DISABLED FOR DEBUGGING</div>
            )}
          </div>
        </div>
      </div>
      <FileExplorerModal isOpen={explorer.isOpen} onClose={() => setExplorer(prev => ({ ...prev, isOpen: false }))} onSelect={handleExplorerSelect} filter={explorer.filter} accentColor={activeAccent} initialPath={explorer.initialPath} />
    </div>
  );
};

export default ManagementModal;