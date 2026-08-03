import path from 'node:path';
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

/** Proxy de desarrollo: misma origen (túnel demo) → API local. */
const apiProxy: ProxyOptions = {
  target: 'http://127.0.0.1:3000',
  changeOrigin: true,
  ws: true,
};

const API_PROXY_PATHS = [
  '/auth',
  '/users',
  '/agents',
  '/transactions',
  '/chats',
  '/payments',
  '/wallet',
  '/reviews',
  '/audit',
  '/evidence',
  '/disputes',
  '/health',
  '/docs',
  '/socket.io',
] as const;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet';
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('react-bootstrap') || id.includes('/bootstrap/')) return 'bootstrap';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('axios') || id.includes('zod')) return 'http-utils';
        },
      },
    },
  },
  server: {
    host: true,
    port: 3001,
    // Túneles demo (Cloudflare quick tunnel) + LAN
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      ...Object.fromEntries(API_PROXY_PATHS.map((p) => [p, apiProxy])),
      '/api': {
        ...apiProxy,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
