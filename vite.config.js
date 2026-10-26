import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const partialsDir = resolve(import.meta.dirname, 'src/partials');
const includePattern = /<!--\s*@include\s+(\S+)\s*-->/g;

// Replaces <!-- @include name.html --> with the contents of src/partials/name.html (recursively).
function includePartials(html) {
  return html.replace(includePattern, (_, file) =>
    includePartials(readFileSync(resolve(partialsDir, file), 'utf-8'))
  );
}

function htmlPartials() {
  return {
    name: 'html-partials',
    transformIndexHtml: { order: 'pre', handler: includePartials },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  plugins: [htmlPartials()],
  build: {
    // p5 alone is ~1 MB minified and can't be split further.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        projects: resolve(import.meta.dirname, 'projects.html'),
        bio: resolve(import.meta.dirname, 'bio.html'),
      },
    },
  },
});
