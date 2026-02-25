import { AppDatabase } from '../database.js';

export interface ServerContext {
    db: AppDatabase;
    ASSETS_DIR: string;
    STORAGE_DIR: string;
    CONFIG_FILE: string;
    BASE_DIR: string;
    slugify: (text: string) => string;
}
