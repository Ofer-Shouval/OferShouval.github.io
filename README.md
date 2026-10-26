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
- `projects/` — one page per project, `projects/index.html` is the grid
- `music/` — releases grid, `live.html`, and `release-template.html` to copy for each release
- `teaching/` — courses and student work
- `bio/` — bio
- `projects.html`, `bio.html` — redirects from the old URLs
- `src/partials/` — shared HTML pulled in with `<!-- @include file.html -->` at build time
- `src/sketches/wake.js` — the home page background sketch
- `src/sketchbook/` — sketchbook sketches, mounted by `src/scripts/sketchbook.js`
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

## Adding a sketch to the sketchbook

1. Copy `src/sketchbook/template.js` to `src/sketchbook/<name>.js` and write the sketch in instance mode
   (`export default function (p, container) { ... }`, size the canvas to `container`).
2. Copy `projects/sketchbook/sketch-template.html` to `projects/sketchbook/<name>.html` and set `data-sketch="<name>"`.
3. Add a card with `<div class="sketch" data-sketch="<name>"></div>` to `projects/sketchbook/index.html`.

Any page can show live sketches this way. Each one loads when it scrolls near view, pauses off screen,
and resizes with its container. p5's friendly errors are on in `npm run dev` and off in the build.
