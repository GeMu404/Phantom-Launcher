import chokidar from 'chokidar';
import { ServerContext } from './context.js';

export function setupSyncEngine(ctx: ServerContext, app: any) {
    let sseClients: any[] = [];

    app.get('/api/sync/events', (req: any, res: any) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        sseClients.push(res);
        req.on('close', () => {
            sseClients = sseClients.filter(client => client !== res);
        });
    });

    const broadcastSyncEvent = (eventData: any) => {
        sseClients.forEach(client => client.write(`data: ${JSON.stringify(eventData)}\n\n`));
    };

    // Expose broadcast function to the app so any route can trigger it
    app.broadcastSyncEvent = broadcastSyncEvent;

    try {
        const steamConfigPath = 'C:/Program Files (x86)/Steam/userdata/*/config/grid';
        const watchPaths = [ctx.ASSETS_DIR, steamConfigPath];

        console.log(`[Sync] Mounting Chokidar Sentry on watch paths...`);

        chokidar.watch(watchPaths, {
            ignored: /(^|[\/\\])\../,
            ignoreInitial: true,
            depth: 5
        }).on('all', (event, filePath) => {
            if (['add', 'change', 'unlink'].includes(event)) {
                if (filePath.match(/\.(png|jpg|jpeg|webp)$/i)) {
                    broadcastSyncEvent({ type: 'ASSET_CHANGED', path: filePath, event });
                }
            }
        }).on('error', (error: any) => {
            console.error(`[Sync] Chokidar Watcher Error:`, error.message);
        });
    } catch (e: any) {
        console.error('[Sync] Sentry mount failed:', e.message);
    }
}
