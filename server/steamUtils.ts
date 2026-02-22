import fs from 'fs';
import path from 'path';

// Auto-detect base dir (same logic as server.ts)
const isPkg = typeof (process as any).pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : process.cwd();
const TAGS_CACHE_FILE = path.join(BASE_DIR, 'tags_cache.json');

// Steam tag cache
let steamTagCache: Record<string, string[]> = {};
let isTagCacheLoaded = false;

const loadTagCache = () => {
    if (isTagCacheLoaded) return;
    try {
        if (fs.existsSync(TAGS_CACHE_FILE)) {
            steamTagCache = JSON.parse(fs.readFileSync(TAGS_CACHE_FILE, 'utf-8'));
        }
        isTagCacheLoaded = true;
    } catch (e) { }
};

export const saveTagCache = () => {
    try {
        fs.writeFileSync(TAGS_CACHE_FILE, JSON.stringify(steamTagCache, null, 2));
    } catch (e) { }
};

export const getStoreTags = async (appId: string): Promise<string[]> => {
    loadTagCache();
    if (steamTagCache[appId]) return steamTagCache[appId];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.status === 429) {
            console.log(`[Steam] Rate limit hit fetching tags for app ${appId}`);
            return [];
        }

        const json = await res.json() as any;
        if (json[appId]?.success) {
            const data = json[appId].data;
            const genres = (data.genres || []).map((g: any) => g.description.toLowerCase());
            const categories = (data.categories || []).map((c: any) => c.description.toLowerCase());
            const adult = (data.content_descriptors?.ids?.includes(3) || data.required_age >= 18) ? ['adultonly'] : [];
            const isSoftware = (data.type === 'software' || data.type === 'tool' || data.type === 'application') ? ['software'] : [];

            const tags = [...genres, ...categories, ...adult, ...isSoftware];
            steamTagCache[appId] = tags;
            return tags;
        }
    } catch (e) { }

    steamTagCache[appId] = [];
    return [];
};

let heaviestSteamUserCache: string | null = null;

export const getHeaviestSteamUser = (userdataDir: string) => {
    if (heaviestSteamUserCache) return heaviestSteamUserCache;
    let heaviestUser = '';
    let maxFiles = -1;
    try {
        if (!fs.existsSync(userdataDir)) return null;
        const users = fs.readdirSync(userdataDir);
        for (const user of users) {
            const gridDir = path.join(userdataDir, user, 'config', 'grid');
            if (fs.existsSync(gridDir)) {
                const fileCount = fs.readdirSync(gridDir).length;
                if (fileCount > maxFiles) {
                    maxFiles = fileCount;
                    heaviestUser = user;
                }
            }
        }
        if (heaviestUser) heaviestSteamUserCache = heaviestUser;
    } catch (e) { }
    return heaviestSteamUserCache;
};

/** Local Steam Asset Crawler */
export const findLocalSteamAsset = (appId: string, type: 'cover' | 'banner' | 'logo' | 'hero'): string | null => {
    const steamPath = 'C:\\Program Files (x86)\\Steam';

    const suffixes = {
        cover: ['p.png', 'p.jpg'],
        banner: ['.png', '.jpg'],
        logo: ['_logo.png', '_logo.jpg'],
        hero: ['_hero.png', '_hero.jpg']
    };

    // Priority 1: userdata/*/config/grid (Heaviest user folder first)
    const userdataDir = path.join(steamPath, 'userdata');
    const heaviestUser = getHeaviestSteamUser(userdataDir);

    if (heaviestUser) {
        const gridDir = path.join(userdataDir, heaviestUser, 'config', 'grid');
        for (const suffix of suffixes[type]) {
            const localPath = path.join(gridDir, `${appId}${suffix}`);
            if (fs.existsSync(localPath)) return localPath;
        }
    }

    if (fs.existsSync(userdataDir)) {
        try {
            const users = fs.readdirSync(userdataDir);
            for (const user of users) {
                if (user === heaviestUser) continue;
                const gridDir = path.join(userdataDir, user, 'config', 'grid');
                for (const suffix of suffixes[type]) {
                    const localPath = path.join(gridDir, `${appId}${suffix}`);
                    if (fs.existsSync(localPath)) return localPath;
                }
            }
        } catch (e) { }
    }

    // Priority 2: appcache/librarycache (Official Steam cache - mostly legacy)
    const legacyFilenameMap = {
        cover: `${appId}_library_600x900.jpg`,
        banner: `${appId}_header.jpg`,
        logo: `${appId}_logo.png`,
        hero: `${appId}_library_hero.jpg`
    };
    const libraryCache = path.join(steamPath, 'appcache', 'librarycache', legacyFilenameMap[type]);
    if (fs.existsSync(libraryCache)) return libraryCache;

    return null;
};
