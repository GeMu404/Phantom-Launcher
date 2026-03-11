
import { Category } from './types';


// CONFIGURACIÓN DE ASSETS
export const APP_VERSION = '0.9.02';

// Usamos rutas de texto directas.
// NOTA: Para que esto funcione, la carpeta 'res' debe estar servida en la raíz de tu servidor web (junto al index.html).
export const ASSETS = {
  templates: {
    cover: './res/templates/cover.png',
    banner: './res/templates/banner.png',
    logo: './res/templates/logo.png',
    icon: './res/templates/icon.png',
  },
  external: {
    steam: './res/external/steam.png',
    hidden: './res/external/hidden.png'
  },
  ui: {
    config: './res/ui/config.png',
    all: './res/ui/all.png',
    wallpaper: './res/ui/wallpaper.jpg',
  }
};

export const CATEGORIES: Category[] = [
  {
    id: 'all',
    name: 'ALL GAMES',
    icon: ASSETS.ui.all,
    color: '#ffffff',
    syncColor: '#ffff00',
    coreColor: '#00ff00',
    configColor: '#ffffff',
    secretColor: '#b829da',
    assetColor: '#a855f7',
    nodeColor: '#ff00ff',
    wallpaper: '',
    wallpaperMode: 'cover',
    gridOpacity: 0.15,
    cardOpacity: 0.7,
    bgAnimationsEnabled: true,
    gridEnabled: true,
    scanlineEnabled: false,
    vignetteEnabled: true,
    outlineEnabled: true,
    configIcon: ASSETS.ui.config,
    games: []
  }
];
