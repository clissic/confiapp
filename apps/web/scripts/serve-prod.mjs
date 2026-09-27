import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import handler from 'serve-handler';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3001;
const host = '0.0.0.0';

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error(
    `[web] No hay build en ${dist}. Corré "pnpm --filter @confiapp/web build" antes del start.`,
  );
  process.exit(1);
}

const server = http.createServer((request, response) =>
  handler(request, response, {
    public: dist,
    rewrites: [{ source: '**', destination: '/index.html' }],
  }),
);

server.listen(port, host, () => {
  console.log(`[web] listening on http://${host}:${port}`);
});
