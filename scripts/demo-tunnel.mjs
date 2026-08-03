import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const TARGET = process.env.DEMO_TUNNEL_TARGET ?? 'http://localhost:3001';

function candidates() {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const local = process.env.LOCALAPPDATA ?? '';
  const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

  return [
    'cloudflared',
    path.join(pf86, 'cloudflared', 'cloudflared.exe'),
    path.join(pf, 'cloudflared', 'cloudflared.exe'),
    path.join(local, 'cloudflared', 'cloudflared.exe'),
    path.join(home, 'bin', 'cloudflared'),
    path.join(home, 'bin', 'cloudflared.exe'),
  ];
}

function resolveBin() {
  for (const candidate of candidates()) {
    if (candidate === 'cloudflared') continue;
    if (existsSync(candidate)) return candidate;
  }
  return 'cloudflared';
}

const bin = resolveBin();
const args = ['tunnel', '--url', TARGET];

console.log(`> ${bin} ${args.join(' ')}`);

const child = spawn(bin, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32' && bin === 'cloudflared',
});

child.on('error', (err) => {
  console.error('\nNo se encontró cloudflared.');
  console.error('Instalá con: winget install --id Cloudflare.cloudflared -e');
  console.error('Luego cerrá y abrí la terminal, o usá la ruta completa al .exe.\n');
  console.error(err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
