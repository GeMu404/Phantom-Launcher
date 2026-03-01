import { AppDatabase } from './database.ts';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'phantom.db');
if (!fs.existsSync(DB_FILE)) {
    console.log('Database file not found at:', DB_FILE);
    process.exit(1);
}

const db = new AppDatabase(DB_FILE);
const categories = db.getCategories();

console.log('--- Emulator Games Check ---');
categories.forEach(cat => {
    cat.games.forEach(game => {
        if (game.source === 'emulator') {
            const exists = fs.existsSync(game.execPath);
            console.log(`[${exists ? 'OK' : 'MISSING'}] ID: ${game.id} | Title: ${game.title}`);
            console.log(`      Path: ${game.execPath}`);
        }
    });
});
