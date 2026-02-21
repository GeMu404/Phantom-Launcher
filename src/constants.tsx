
import { Category } from './types';

export const APP_VERSION = '0.8.1.0';

// CONFIGURACIÓN DE ASSETS
// Usamos rutas de texto directas.
// NOTA: Para que esto funcione, la carpeta 'res' debe estar servida en la raíz de tu servidor web (junto al index.html).
export const ASSETS = {
  templates: {
    cover: './res/templates/cover.png',
    banner: './res/templates/banner.png',
    logo: './res/templates/logo.png',
    icon: './res/templates/icon.png',
  },
  ui: {
    config: './res/ui/config.png',
    wallpaper: './res/ui/wallpaper.jpg',
  },
  external: {
    steam: './res/external/steam.png',
    hidden: './res/external/hidden.png'
  }
};

export const CATEGORIES: Category[] = [
  {
    id: 'all',
    name: 'ALL GAMES',
    icon: ASSETS.templates.icon,
    color: '#ffffff',
    assetColor: '#00ffff',
    nodeColor: '#ff00ff',
    syncColor: '#ffff00',
    coreColor: '#00ff00',
    wallpaper: '',
    wallpaperMode: 'cover',
    gridOpacity: 0.15,
    cardOpacity: 0.7,
    bgAnimationsEnabled: true,
    gridEnabled: true,
    scanlineEnabled: true,
    vignetteEnabled: true,
    configIcon: ASSETS.ui.config,
    games: []
  }
];
