import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: process.env.VITE_BASE_PATH || '/', plugins: [react()], server: { watch: { usePolling: process.platform === 'win32', interval: 300, ignored: ['**/public/assets/**', '**/artifacts/**'] } }, test: { include: ['src/tests/**/*.test.ts'] } } as Parameters<typeof defineConfig>[0]);
