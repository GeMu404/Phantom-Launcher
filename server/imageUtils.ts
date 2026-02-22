import fs from 'fs';
import https from 'https';
import { createRequire } from 'node:module';
import path from 'path';

// Dynamic Sharp import using createRequire for Node SEA compatibility
const isExe = process.execPath.toLowerCase().endsWith('phantomserver.exe');
const requireFunc = isExe ? createRequire(process.execPath) : (typeof require !== 'undefined' ? require : eval('require'));

export let sharp: any = null;
try {
    const exeDir = isExe ? path.dirname(process.execPath) : process.cwd();
    const sharpPath = path.join(exeDir, 'node_modules', 'sharp');
    sharp = requireFunc(sharpPath);
} catch (e) {
    console.error("FATAL: First absolute load failed for sharp:", e);
    try {
        sharp = requireFunc('sharp');
    } catch (e2) {
        console.error("FATAL: Could not load sharp module.", e2);
    }
}

/** Image Processor for standardizing dimensions */
export const processImage = async (input: string | Buffer, dest: string, type: string): Promise<string> => {
    console.log(`[Sharp] Processing ${type} -> ${dest}`);
    try {
        const metadata = await sharp(input).metadata();
        const isAnimated = metadata.pages && metadata.pages > 1;

        if (isAnimated) {
            console.log(`[Sharp] Animation detected (frames: ${metadata.pages}). Bypassing processing for ${dest}`);
            if (typeof input === 'string') {
                fs.copyFileSync(input, dest);
            } else {
                fs.writeFileSync(dest, input);
            }
            return dest;
        }

        let sharpInstance = sharp(input, { animated: true });

        if (type === 'cover') {
            sharpInstance = sharpInstance.resize(600, 900, { fit: 'cover' });
        } else if (type === 'banner') {
            sharpInstance = sharpInstance.resize(920, 430, { fit: 'cover' });
        } else if (type === 'icon') {
            sharpInstance = sharpInstance.resize(256, 246, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
        } else if (type === 'logo') {
            if (isAnimated) {
                sharpInstance = sharpInstance.resize(800, 320, { fit: 'inside' }).webp({ effort: 0 });
            } else {
                sharpInstance = sharpInstance.trim().resize(800, 320, { fit: 'inside' });
                const buffer = await sharpInstance.png().toBuffer();
                sharpInstance = sharp({
                    create: {
                        width: 800,
                        height: 320,
                        channels: 4,
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    }
                }).composite([{ input: buffer, gravity: 'center' }]);
            }
        }

        await sharpInstance.toFile(dest);
        return dest;
    } catch (e: any) {
        console.error(`[Sharp] Final error on ${dest}:`, e.message);
        if (typeof input === 'string' && fs.existsSync(input) && input !== dest) {
            fs.copyFileSync(input, dest);
        }
        return dest;
    }
};

/** Download Helper for Offline protocol */
export const downloadImage = (url: string, dest: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (dest.includes('steam_') && fs.existsSync(dest)) return resolve(dest);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }
            const chunks: any[] = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(dest, buffer);
                resolve(dest);
            });
        }).on('error', reject);
    });
};
