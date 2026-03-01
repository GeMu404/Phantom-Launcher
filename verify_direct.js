import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'phantom.db');
const db = new Database(DB_FILE);

const games = db.prepare("SELECT id, title, execPath FROM games WHERE source='emulator'").all();

console.log('--- Emulator Games Check ---');
games.forEach(game => {
    const exists = fs.existsSync(game.execPath);
    console.log(`[${exists ? 'OK' : 'MISSING'}] ID: ${game.id} | Title: ${game.title}`);
    console.log(`      Path: ${game.execPath}`);
});
