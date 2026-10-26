import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

function localAudioSavePlugin(): Plugin {
  return {
    name: 'vite-plugin-save-audio',
    configureServer(server) {
      server.middlewares.use('/__api/save-audio', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer | string) => { body += chunk; });
          req.on('end', () => {
            try {
              const { itemId, dataUrl } = JSON.parse(body);
              if (itemId && dataUrl) {
                const base64Data = dataUrl.replace(/^data:audio\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const targetDir = path.resolve(process.cwd(), 'public/audio/custom');
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }
                const fileName = `${itemId}.wav`;
                const filePath = path.join(targetDir, fileName);
                fs.writeFileSync(filePath, buffer);

                // 更新 manifest.json
                const manifestPath = path.join(targetDir, 'manifest.json');
                let manifest: Record<string, string> = {};
                if (fs.existsSync(manifestPath)) {
                  try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                  } catch {}
                }
                manifest[itemId] = fileName;
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
                return;
              }
            } catch (err) {
              console.error('[SaveAudio] Failed to save audio file to disk:', err);
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload' }));
          });
          return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localAudioSavePlugin()],
});
