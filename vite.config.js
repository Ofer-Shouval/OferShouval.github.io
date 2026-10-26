import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = import.meta.dirname;
const partialsDir = resolve(root, 'src/partials');
const includePattern = /<!--\s*@include\s+(\S+)\s*-->/g;
const ignoredDirs = ['node_modules', 'dist', 'archive', 'src', 'public', '.git'];

// Replaces <!-- @include name.html --> with the contents of src/partials/name.html (recursively).
function includePartials(html) {
  return html.replace(includePattern, (_, file) =>
    includePartials(readFileSync(resolve(partialsDir, file), 'utf-8'))
  );
}

// Marks the navbar link for the page's top-level section (e.g. /work/ for work/luminin.html).
function markCurrentSection(html, filename) {
  const [first, ...rest] = relative(root, filename).split('/');
  const section = rest.length ? `/${first}/` : '/';
  return html.replace(`<a href="${section}">`, `<a href="${section}" aria-current="page">`);
}

function htmlPartials() {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => markCurrentSection(includePartials(html), ctx.filename),
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

// Every .html file outside the ignored folders is a page, so new pages need no config changes.
function findPages() {
  return readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.html') && !ignoredDirs.includes(file.split('/')[0]))
    .map((file) => resolve(root, file));
}

export default defineConfig({
  plugins: [htmlPartials()],
  build: {
    // p5 alone is ~1 MB minified and can't be split further.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      input: findPages(),
    },
  },
});
