import { Jimp } from 'jimp';
console.log('Jimp object:', Jimp);
try {
    const j = new Jimp(100, 100);
    console.log('Jimp instance created');
} catch (e) {
    console.log('Jimp instance failed:', e.message);
}
try {
    // Check static read if available
    if (Jimp.read) console.log('Jimp.read exists');
} catch (e) { }
