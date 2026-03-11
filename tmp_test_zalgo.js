
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
    CREATE TABLE Games (
        id TEXT PRIMARY KEY,
        title TEXT
    );
`);

const zalgoTitle = "S̷i̷l̷e̷n̷t̷ H̷i̷l̷l̷ S̷h̷a̷t̷t̷e̷r̷e̷d̷ D̷r̷e̷a̷m̷s̷";
console.log("Testing Zalgo Title:", zalgoTitle);
console.log("Length:", zalgoTitle.length);

try {
    db.prepare('INSERT INTO Games (id, title) VALUES (?, ?)').run('test_game', zalgoTitle);
    const row = db.prepare('SELECT * FROM Games WHERE id = ?').get('test_game');
    console.log("Retrieved Title:", row.title);
    console.log("Success!");
} catch (e) {
    console.error("Failed to insert Zalgo title:", e);
}
