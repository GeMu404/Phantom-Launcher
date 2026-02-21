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
import CyberScrollbar from './CyberScrollbar';
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
  uiScale: number;
  onUpdateUIScale: (val: number) => void;
  onResolveAsset: (path: string | undefined) => string;
  bumpAssetVersion: () => void;
  isSecretUnlocked?: boolean;
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
  isDanger?: boolean;
}


const ManagementModal: React.FC<ManagementModalProps> = ({
  isOpen, onClose, categories, currentCatIdx, onUpdateCategories, accentColor,
  taskbarMargin, onUpdateTaskbarMargin, uiScale, onUpdateUIScale, onResolveAsset, bumpAssetVersion,
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
  const [steamOptions, setSteamOptions] = useState({ includeSoftware: false, includeAdultOnly: false });
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
        bumpAssetVersion();
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
        setIsFormOpen(true); // Ensure form opens when category is selected
      }
    } else if (tab === 'secret') {
      const hiddenCat = categories.find(c => c.id === 'hidden');
      if (hiddenCat) {
        setEditingId('hidden');
        setCatForm({
          name: hiddenCat.name,
          icon: hiddenCat.icon,
          color: hiddenCat.color,
          wallpaper: hiddenCat.wallpaper || '',
          wallpaperMode: hiddenCat.wallpaperMode || 'cover',
          gridOpacity: hiddenCat.gridOpacity ?? 0.15,
          enabled: hiddenCat.enabled ?? true
        });
        setIsFormOpen(true); // Force open for secret tab
      }
    }
  }, [editingId, tab, categories]);

  // Handle game editing within secret tab context
  const [currentSecretGameId, setCurrentSecretGameId] = useState<string | null>(null);

  useEffect(() => {
    // Reset secret game editing when tab changes
    if (tab !== 'secret') setCurrentSecretGameId(null);
  }, [tab]);

  useEffect(() => {
    if (tab === 'secret' && currentSecretGameId) {
      if (currentSecretGameId === 'new_secret') {
        setGameForm({
          title: '', cover: '', banner: '', logo: '', execPath: '', execArgs: '',
          categoryIds: ['hidden'],
          wallpaper: ''
        });
        setIsFormOpen(true);
      } else {
        const g = categories.flatMap(c => c.games).find(x => x.id === currentSecretGameId);
        if (g) {
          setGameForm({
            title: g.title,
            cover: g.cover,
            banner: g.banner,
            logo: g.logo,
            execPath: g.execPath,
            execArgs: g.execArgs || '',
            categoryIds: categories.filter(c => c.id !== 'all' && c.games.some(x => x.id === g.id)).map(c => c.id),
            wallpaper: g.wallpaper || ''
          });
          setIsFormOpen(true);
        }
      }
    }
  }, [tab, currentSecretGameId, allGamesCategory.games]);

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
      // Clear existing steam list to "restart"
      onUpdateCategories(prev => prev.map(cat => (cat.id === 'steam' || cat.id === 'all') ? { ...cat, games: cat.games.filter(g => g.source !== 'steam') } : cat));

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
      bumpAssetVersion();
    } catch (e) {
      console.error("Steam sync failed", e);
    }
  };

  const handleSyncXboxLibrary = async () => {
    try {
      // Clear existing xbox list to "restart"
      onUpdateCategories(prev => prev.map(cat => (cat.id === 'xbox' || cat.id === 'all') ? { ...cat, games: cat.games.filter(g => g.source !== 'xbox') } : cat));

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
      bumpAssetVersion();
    } catch (e: any) {
      console.error("Xbox sync failed", e);
    }
  };

  const handleSaveGame = async () => {
    if (!gameForm.title.trim()) return;

    // Force secret isolation if editing from the secret tab
    const finalForm = (tab === 'secret' && currentSecretGameId)
      ? { ...gameForm, categoryIds: ['hidden'] }
      : gameForm;

    const slug = slugify(finalForm.title);
    const targetId = (tab === 'secret' && currentSecretGameId)
      ? (currentSecretGameId === 'new_secret' ? null : currentSecretGameId)
      : editingId;
    let newId = targetId;

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
      title: finalForm.title,
      cover: finalForm.cover,
      banner: finalForm.banner,
      logo: finalForm.logo,
      execPath: finalForm.execPath,
      execArgs: finalForm.execArgs,
      source: existingGame?.source || 'manual', // Keep source or default to manual
      wallpaper: finalForm.wallpaper
    };
    onUpdateCategories(prev => prev.map(cat => {
      let isTarget = cat.id === 'all' || finalForm.categoryIds.includes(cat.id);
      if (cat.id === 'all' && finalForm.categoryIds.includes('hidden')) isTarget = false;
      const exists = cat.games.some(g => g.id === newId);
      if (isTarget) return exists ? { ...cat, games: cat.games.map(g => g.id === newId ? gameObj : g) } : { ...cat, games: [...cat.games, gameObj] };
      return { ...cat, games: cat.games.filter(g => g.id !== newId) };
    }));
    bumpAssetVersion();
    setIsFormOpen(false);
    setEditingId(null);
    if (tab === 'secret') setCurrentSecretGameId(null);
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
        bumpAssetVersion();
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
        bumpAssetVersion();
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
        bumpAssetVersion();
      }
    } catch (e) {
      console.error("Asset import failed", e);
    }
  };

  const handleWipeMasterRegistry = () => {
    requestConfirmation("ERASE_ALL_REGISTRY_DATA?", async () => {
      await fetch('/api/system/wipe', { method: 'POST' });
      onUpdateCategories(prev => prev.map(c => ({ ...c, games: [] })));
      bumpAssetVersion();
    });
  };

  const handleDeleteGame = (gameId: string) => {
    requestConfirmation("PURGE_GAME_REGISTRY?", async () => {
      await fetch('/api/games/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
      onUpdateCategories(prev => prev.map(c => ({ ...c, games: c.games.filter(g => g.id !== gameId) })));
      bumpAssetVersion();
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
    bumpAssetVersion();
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

  const handleToggleGameInCategory = (catId: string, gameId: string) => {
    onUpdateCategories(prev => {
      let isRemovingFromHidden = false;
      let isAddingToHidden = false;

      if (catId === 'hidden') {
        const hiddenCat = prev.find(c => c.id === 'hidden');
        if (hiddenCat?.games.some(g => g.id === gameId)) {
          isRemovingFromHidden = true;
        } else {
          isAddingToHidden = true;
        }
      }

      return prev.map(cat => {
        if (isAddingToHidden) {
          if (cat.id === 'hidden') {
            const game = prev.flatMap(c => c.games).find(g => g.id === gameId);
            return game ? { ...cat, games: [...cat.games, game] } : cat;
          } else {
            return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
          }
        }

        if (isRemovingFromHidden) {
          if (cat.id === 'hidden') {
            return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
          } else if (cat.id === 'all') {
            const game = prev.find(c => c.id === 'hidden')?.games.find(g => g.id === gameId);
            return game ? { ...cat, games: [...cat.games, game] } : cat;
          }
          return cat;
        }

        // Normal toggle
        if (cat.id !== catId) return cat;
        const exists = cat.games.some(g => g.id === gameId);
        if (exists) {
          return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
        } else {
          const game = prev.flatMap(c => c.games).find(g => g.id === gameId);
          return game ? { ...cat, games: [...cat.games, game] } : cat;
        }
      });
    });
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
          <div className="flex items-center gap-6 lg:gap-10">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-['Press_Start_2P'] text-[9px] lg:text-[11px] uppercase tracking-tighter" style={{ color: activeAccent }}>[ TERMINAL_NUCLEO_MOTOR ]</h2>
              <span className="text-[7px] font-['Space_Mono'] opacity-60 uppercase tracking-[0.5em] text-white">PHANTOM_SHELL_V{APP_VERSION}.SYS</span>
            </div>

            {/* Master Status Tool */}
            <div className="hidden md:flex items-center gap-4 bg-black/40 border-l-2 border-white/5 pl-6 py-1">
              <div className="flex flex-col gap-1">
                <span className="text-[6px] text-white/20 uppercase font-mono tracking-widest">Master_Link</span>
                <div className="flex gap-1.5">
                  <div className="w-1 h-3 bg-emerald-500/40"></div>
                  <div className="w-1 h-3 bg-emerald-500/20"></div>
                  <div className="w-1 h-3 bg-white/5"></div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[6px] text-white/20 uppercase font-mono tracking-widest">Neural_Load</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-white/5 overflow-hidden">
                    <div className="w-3/4 h-full" style={{ backgroundColor: activeAccent }}></div>
                  </div>
                  <span className="text-[6px] font-mono" style={{ color: activeAccent }}>74%</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="px-6 py-2 font-bold text-[8px] uppercase tracking-widest border-2 hover:bg-white hover:text-black transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]" style={{ borderColor: activeAccent, color: activeAccent }}>{t('nav.disconnect')}</button>
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
              <button key={item.id} onClick={() => {
                setTab(item.id as any);
                if (item.id === 'secret') {
                  setEditingId('hidden');
                  setIsFormOpen(true);
                } else {
                  setEditingId(null);
                  setIsFormOpen(false);
                }
              }}
                className={`w-full py-4 text-[9px] font-bold uppercase tracking-[0.3em] transition-all relative border-2 text-left px-5 ${tab === item.id ? 'text-black' : 'bg-transparent text-white/40 border-white/5 hover:text-white'}`}
                style={{ backgroundColor: tab === item.id ? item.color : 'transparent', borderColor: tab === item.id ? item.color : 'transparent' }}>
                {item.label}
              </button>
            ))}
          </div>

          <div ref={scrollContainerRef} className="flex-1 p-5 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10 relative">
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
                handleToggleGameInCategory={handleToggleGameInCategory}
                allGames={allGamesCategory.games}
                triggerFileBrowser={triggerFileBrowser}
                activeAccent={activeAccent}
                scrollToForm={scrollToForm}
                onEditGame={setCurrentSecretGameId}
                onDeleteGame={handleDeleteGame}
                onWipeRegistry={handleWipeMasterRegistry}
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
              <SystemTab
                activeAccent={activeAccent}
                allGamesCategory={allGamesCategory}
                onUpdateCategories={onUpdateCategories}
                taskbarMargin={taskbarMargin}
                onUpdateTaskbarMargin={onUpdateTaskbarMargin}
                uiScale={uiScale}
                onUpdateUIScale={onUpdateUIScale}
                triggerFileBrowser={triggerFileBrowser}
                onResolveAsset={onResolveAsset}
                handleSystemFormat={handleWipeMasterRegistry}
              />
            )}

            {tab === 'secret' && (
              currentSecretGameId ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[12px] font-bold tracking-[0.2em]">{t('modal.secret_unit_override')}</h3>
                    <button
                      onClick={() => setCurrentSecretGameId(null)}
                      className="text-[8px] text-white/40 hover:text-white uppercase tracking-widest text-left"
                    >
                      {t('modal.back_to_node')}
                    </button>
                  </div>
                  <GameEditForm
                    isFormOpen={true}
                    setIsFormOpen={setIsFormOpen}
                    isSecretContext={true}
                    editingId={currentSecretGameId}
                    activeAccent="#ec4899"
                    gameForm={gameForm}
                    setGameForm={setGameForm}
                    handleSaveGame={handleSaveGame}
                    handleSyncWithGemini={() => { }}
                    isSyncingGemini={false}
                    triggerFileBrowser={triggerFileBrowser}
                    onResolveAsset={onResolveAsset}
                    otherCategories={otherCategories}
                    sgdbKey={sgdbKey}
                    sgdbEnabled={sgdbEnabled}
                    setSearchModal={setSearchModal}
                  />
                </div>
              ) : (
                <CategoryEditForm
                  isFormOpen={true}
                  setIsFormOpen={setIsFormOpen}
                  gameList={categories.find(c => c.id === 'hidden')?.games || []}
                  editingId="hidden"
                  catForm={catForm}
                  setCatForm={setCatForm}
                  handleSaveCategoryData={handleSaveCategoryData}
                  handleMoveGameInCategory={handleMoveGameInCategory}
                  handleToggleGameInCategory={handleToggleGameInCategory}
                  onEditGame={setCurrentSecretGameId}
                  onDeleteGame={handleDeleteGame}
                  onInitializeUnit={() => setCurrentSecretGameId('new_secret')}
                  onWipeRegistry={handleWipeMasterRegistry}
                  allGames={allGamesCategory.games}
                  triggerFileBrowser={triggerFileBrowser}
                  onResolveAsset={onResolveAsset}
                  activeAccent="#ec4899"
                />
              )
            )}
          </div>
        </div>
        <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
      </div>
      <FileExplorerModal isOpen={explorer.isOpen} onClose={() => setExplorer(prev => ({ ...prev, isOpen: false }))} onSelect={handleExplorerSelect} filter={explorer.filter} accentColor={activeAccent} initialPath={explorer.initialPath} />
    </div>
  );
};

export default ManagementModal;