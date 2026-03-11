
import { AppDatabase } from './database.js';
import path from 'path';

try {
    const db = new AppDatabase(path.join(process.cwd(), 'phantom.db'));
    console.log(JSON.stringify(db.getCategories()));
} catch (e) {
    console.error(e);
}
