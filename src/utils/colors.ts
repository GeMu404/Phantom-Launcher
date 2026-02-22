
/** Returns '#000' or '#fff' for best contrast against the given hex color */
export function getContrastColor(hex: string): string {
    if (!hex) return '#fff';
    const c = hex.replace('#', '');
    if (c.length !== 6 && c.length !== 3) return '#fff';

    const r = parseInt(c.length === 3 ? c[0] + c[0] : c.substring(0, 2), 16) / 255;
    const g = parseInt(c.length === 3 ? c[1] + c[1] : c.substring(2, 4), 16) / 255;
    const b = parseInt(c.length === 3 ? c[2] + c[2] : c.substring(4, 6), 16) / 255;

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5 ? '#000' : '#fff';
}

