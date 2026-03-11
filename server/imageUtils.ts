import fs from 'fs';
import https from 'https';
import { createRequire } from 'node:module';
import path from 'path';

// Dynamic Sharp import using createRequire for Node SEA compatibility
const isExe = process.execPath.toLowerCase().endsWith('phantomserver.exe');

// Robust require for both ESM (ts-node) and CJS (bundled)
let requireFunc: any;
if (isExe) {
    // In SEA, createRequire(process.execPath) allows loading modules relative to the EXE
    requireFunc = createRequire(process.execPath);
} else {
    try {
        // @ts-ignore
        requireFunc = require;
    } catch (e) {
        requireFunc = createRequire(import.meta.url);
    }
}

export let sharp: any = null;
try {
    const exeDir = isExe ? path.dirname(process.execPath) : process.cwd();
    const sharpPath = path.join(exeDir, 'node_modules', 'sharp');
    sharp = requireFunc(sharpPath);
} catch (e) {
    if (isExe) console.error("FATAL: First absolute load failed for sharp:", e);
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
                // ABSOLUTE_SNUG_PROTOCOL: Manual alpha-scan for pixel-perfect cropping
                const raw = await sharpInstance.raw().toBuffer({ resolveWithObject: true });
                const { data, info } = raw;
                let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
                let hasAlpha = false;

                for (let y = 0; y < info.height; y++) {
                    for (let x = 0; x < info.width; x++) {
                        const idx = (y * info.width + x) * info.channels;
                        const alpha = info.channels === 4 ? data[idx + 3] : 255;
                        if (alpha > 10) { // Threshold for "real" content
                            if (x < minX) minX = x;
                            if (y < minY) minY = y;
                            if (x > maxX) maxX = x;
                            if (y > maxY) maxY = y;
                            hasAlpha = true;
                        }
                    }
                }

                if (hasAlpha) {
                    const cropWidth = (maxX - minX) + 1;
                    const cropHeight = (maxY - minY) + 1;
                    sharpInstance = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
                        .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
                        .resize(800, 320, { fit: 'inside', withoutEnlargement: true })
                        .png({ palette: true });
                } else {
                    sharpInstance = sharpInstance.resize(800, 320, { fit: 'inside' });
                }
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
export const downloadImage = async (url: string, dest: string): Promise<string> => {
    if (dest.includes('steam_') && fs.existsSync(dest)) return dest;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(dest, buffer);
        return dest;
    } catch (e: any) {
        console.error(`[Download] Error for ${url}:`, e.message);
        throw e;
    }
};
/** Specialized thumbnail generator for UI backgrounds (32x32) */
export const generateThumbnail = async (input: string, dest: string): Promise<string | null> => {
    try {
        if (!sharp) return null;
        if (!fs.existsSync(input)) return null;

        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        await sharp(input)
            .resize(64, 64, { fit: 'cover' })
            .blur(3.5)
            .webp({ quality: 40, effort: 6 })
            .toFile(dest);

        return dest;
    } catch (e: any) {
        console.error(`[Sharp] Thumbnail failed for ${input}:`, e.message);
        return null;
    }
};
