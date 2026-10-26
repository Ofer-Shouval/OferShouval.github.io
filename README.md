# OferShouval.github.io

Personal site, built with [Vite](https://vite.dev).

```sh
npm install
npm run dev      # local dev server with live reload
npm run build    # production build into dist/
npm run preview  # serve the dist/ build locally
```

## Layout

- `index.html`, `projects.html`, `bio.html` — page entries
- `src/partials/` — shared HTML pulled in with `<!-- @include file.html -->` at build time
  (`head.html`, `navbar.html`, and one file per project under `projects/`)
- `src/sketches/` — p5.js sketches (instance mode)
- `src/scripts/` — page scripts
- `src/styles/main.css` — site styles
- `public/` — copied as-is (media, resume)
- `archive/` — old pages and sketches, not part of the build
