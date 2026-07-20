import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Artifact build: everything (JS, CSS, base64 Rapier WASM) inlined into one
// index.html so the page works under a CSP that blocks all external requests.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    chunkSizeWarningLimit: 8000,
  },
});
