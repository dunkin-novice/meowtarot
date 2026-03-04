import { readFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function createStaticServer(rootDir, defaultPath = '/index.html') {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname || '/');
      if (pathname === '/') pathname = defaultPath;

      const candidate = path.join(rootDir, pathname);
      const normalized = path.normalize(candidate);
      if (!normalized.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      const file = await readFile(normalized);
      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeType(normalized));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(file);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
}

export async function startStaticPreviewServer({
  rootDir,
  host = '127.0.0.1',
  port = 0,
  defaultPath = '/index.html',
} = {}) {
  if (!rootDir) throw new Error('rootDir is required');

  const server = createStaticServer(rootDir, defaultPath);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const selectedPort = typeof address === 'object' && address ? address.port : port;
  const baseUrl = `http://${host}:${selectedPort}`;

  let closed = false;
  const stop = async () => {
    if (closed) return;
    closed = true;
    await new Promise((resolve) => server.close(resolve));
  };

  const terminate = () => {
    if (!closed) server.close();
  };

  process.once('exit', terminate);
  process.once('SIGINT', terminate);
  process.once('SIGTERM', terminate);

  return {
    baseUrl,
    port: selectedPort,
    stop: async () => {
      process.off('exit', terminate);
      process.off('SIGINT', terminate);
      process.off('SIGTERM', terminate);
      await stop();
    },
  };
}
