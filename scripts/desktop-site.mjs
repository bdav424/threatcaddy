import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const distDir = path.join(rootDir, 'dist');
const host = '127.0.0.1';
const preferredPort = Number(process.env.TC_DESKTOP_SITE_PORT || 4174);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`));
    });
  });
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function createStaticServer() {
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${host}`);
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const cleanPath = decodedPath.replace(/^\/+/, '');
      const targetPath = path.normalize(path.join(distDir, cleanPath || 'index.html'));

      if (!targetPath.startsWith(distDir)) {
        sendNotFound(res);
        return;
      }

      let filePath = targetPath;
      if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
      });
      createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(port);
    });
  });
}

async function listenOnAvailablePort(server, firstPort) {
  for (let port = firstPort; port < firstPort + 20; port += 1) {
    try {
      await listen(server, port);
      return port;
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No available localhost port from ${firstPort} to ${firstPort + 19}`);
}

await run('pnpm', ['build']);

const server = createStaticServer();
const port = await listenOnAvailablePort(server, preferredPort);
const siteUrl = `http://${host}:${port}/`;
console.log(`ThreatCaddy desktop site: ${siteUrl}`);

const electron = spawn('pnpm', ['desktop:start'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    TC_DESKTOP_DEV_URL: siteUrl,
  },
});

electron.on('exit', (code, signal) => {
  server.close(() => {
    process.exit(code ?? (signal ? 1 : 0));
  });
});

electron.on('error', (error) => {
  server.close(() => {
    console.error(error);
    process.exit(1);
  });
});
