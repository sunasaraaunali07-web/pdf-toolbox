import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // pdfjs-dist must NOT be pre-bundled — its worker URL resolution breaks if Vite
    // rewrites the import paths at pre-bundle time.
    exclude: ['pdfjs-dist'],
  },
  build: {
    // Increase the warning threshold; pdf-lib + pdfjs-dist are expected to be larger
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown requires manualChunks to be a function (not a plain object)
        manualChunks(id) {
          if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs-dist';
        },
      },
    },
  },
});
