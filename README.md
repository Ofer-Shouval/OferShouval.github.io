# OferShouval.github.io

Personal site, built with [Vite](https://vite.dev).

```sh
npm install
npm run dev      # local dev server with live reload
npm run build    # production build into dist/
npm run preview  # serve the dist/ build locally
```

## Layout

- `index.html` — home (full-screen "Wake" sketch)
- `work/` — one page per project, `work/index.html` is the grid
- `music/` — releases grid, `live.html`, and `release-template.html` to copy for each release
- `teaching/` — courses and student work
- `bio/` — bio
- `projects.html`, `bio.html` — redirects from the old URLs
- `src/partials/` — shared HTML pulled in with `<!-- @include file.html -->` at build time
- `src/sketches/` — p5.js sketches (instance mode)
- `src/scripts/media.js` — lazy-loads videos on every page
- `src/styles/main.css` — site styles
- `public/media/` — images and videos, referenced as `/media/name.ext`
- `archive/` — old pages, sketches and images, not part of the build

Any `.html` file outside `src/`, `public/` and `archive/` is built as a page automatically.
Dashed "TODO" boxes (`class="placeholder"`) mark content still to be added.

## Adding a video

Convert GIFs or clips to MP4 and use a poster frame:

```html
<video data-src="/media/name.mp4" poster="/media/name_poster.jpg" autoplay muted loop playsinline></video>
```
