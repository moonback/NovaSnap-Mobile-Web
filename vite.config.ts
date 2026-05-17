import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // env is kept here for any safe VITE_ prefixed variables in the future.
  // NEVER expose private keys (GEMINI_API_KEY, etc.) via `define` — they end up in the bundle.
  return {
    plugins: [react(), tailwindcss()],
    // ✅ No secret keys injected into the client bundle.
    // GEMINI_API_KEY lives ONLY in server.ts (loaded via dotenv).
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
