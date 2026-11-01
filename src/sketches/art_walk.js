// Full-screen landing sketch for the art section, grown out of a week 6 homework (archive/week 6):
// a crowd of stick figures walks across the screen, laid out like the water on the home page
// (see home/water.js). They walk in rows that get closer together toward the horizon, so the crowd
// stretches away into the distance. Swells of Perlin noise lift and drop the figures as they pass.
//
// A figure's feet are below the horizon by the camera's height at that figure's size. The view
// is warped so that the ground curls upward as it goes away from the camera, like a road rising
// up a wall: the further away, the more it lifts, and the more the figures tip back with it.
//
// The figures are a walk cycle painted with a p5.brush brush when the page starts (see
// brush_frames.js). There can be thousands of them, so everything about each one that doesn't
// change is worked out once (see buildCrowd()), and each frame only works out where they've got to.

import p5 from 'p5';
import { paintSheets, paintGates, gateMargin, frameWidth, frameHeight, feetX, feetY, steps } from './brush_frames.js';

// The friendly-error checker slows every p5 call; it's for development, not the live site.
p5.disableFriendlyErrors = import.meta.env.PROD;

let horizon = 0.45; // How far down the screen the horizon is (0 = the top, 1 = the bottom)
let cameraHeight = 375; // How high off the ground the camera is, in the frames' own pixels (a figure is about 150 tall)
let curl = 0.1; // How much the ground curls upward with distance, as a fraction of the screen's height (0 = flat)
let curlTip = 0.12; // How much the figures tip back as the ground curls, so they look shorter in the distance (0 = not at all)
let ratio = 0.9; // Each row is this much the size of the one in front of it (smaller = bunch up faster)
let furthestSize = 0.005; // The rows carry on until they reach the top of the screen, or get this small, per 900 pixels of window height
let rowsBelow = 0; // How many rows to draw with their feet below the bottom of the screen, since the rest of them still shows
let spacing = 260; // How far apart the figures in a row are on average, in the frames' own pixels
let rowJitter = 1.2; // How far forward or back of its row a figure can stray, in gaps between rows
let walkSpeed = [60, 180]; // The slowest and fastest a figure can walk, in the frames' own pixels per second
let stride = 7.5; // How far a planted foot slides back each frame of the walk cycle, in the frames' own pixels
let offScreen = 100; // How far past the side of the screen a figure goes before wrapping round, in the frames' own pixels
let waveScale = 0.004; // How long the swells are (smaller = longer swells)
let waveSpeed = 0.5; // How quickly the swells change, per second
let waveHeight = 28; // How tall the swells are, in pixels, near the bottom of the screen
let alpha = 0.9; // How solid the figures are, near the bottom of the screen (1 = solid)
let distanceFade = 0.2; // How quickly they fade toward the horizon (smaller = slower)

// The brush the crowd is drawn in. p5.brush's brushes are pen, rotring, 2B, HB, 2H, cpencil,
// pastel, crayon, charcoal, spray and marker.
let brushName = 'pen';
let lineWeights = [3, 3.5, 4, 4.75, 5.5]; // How thick its lines can be, from the far distance to the front
let weightJitter = 0.35; // How far a figure's lines stray from what's usual at its distance, as a fraction of that whole range
let density; // How many pixels of canvas for each pixel of window
let resolution; // How many pixels of sheet for each of the frames' own pixels
let sheets; // The walk cycle painted at each line weight, at each size (see brush_frames.js)
let rows = []; // The crowd, the furthest row first (see buildCrowd())
let gates = []; // A gate for each project, the furthest first (see setupGates() and standGates())
let gateAlpha = 0.7; // How solid their white is (1 = hides everyone behind them)
let gateWidth = 44; // How wide a gate is, in pixels
let gateWidthTouch = 76; // ...and on touch screens, where the names stay on the gates and need room
let gateGap = 14; // The space under the navbar, and between rows of gates if they don't all fit in one
let gateShape = 1.43; // How tall a gate is, compared to how wide
let gatePen = { width: 80, weight: 2.2, hole: 12 }; // How the outlines are drawn, before they're stretched to fit
let lightTime = 0.5; // How many seconds a gate's light takes to come on or go off
let lightColour = 0.5; // How strong the light's colours are (1 = as they are in the picture)
let glowLength = 0.7; // How far the light reflects along the ground in front of a gate, compared to its height
let glowWidth = 2.4; // How wide that reflection is, compared to the gate
let glowAlpha = 0.75; // How strong it is, right at the gate's foot
let glow; // A very small picture of the reflection, which goes soft when it's stretched out (see showGlow())
let horizonDark = 0.12; // How dark the world gets at the horizon as a gate lights up (0 = not at all, 1 = black)
let frontDark = 0; // ...and at the front
let worldShade; // That darkness, as a gradient down the screen

function setup() {
  density = Math.min(2, window.devicePixelRatio); // Sharp enough, and any more is slow on phones
  pixelDensity(density);
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  // Sharp enough for the biggest figures on this screen, and no bigger
  resolution = constrain(bottomSize() * 1.1 * density, 1, 3);
  setupGates(); // (Before the sheets, since painting those finishes with the brush)
  sheets = paintSheets(brushName, lineWeights, resolution);
  buildCrowd();
}

// The size that puts a figure's feet at the bottom of the screen
function bottomSize() {
  return (height * (1 - horizon)) / cameraHeight;
}

// Work out everything about the crowd that doesn't change from frame to frame
function buildCrowd() {
  worldShade = drawingContext.createLinearGradient(0, 0, 0, height);
  worldShade.addColorStop(0, `rgba(0, 0, 0, ${horizonDark})`);
  worldShade.addColorStop(1, `rgba(0, 0, 0, ${frontDark})`);
  let bottom = bottomSize();
  let smallestSize = (furthestSize * height) / 900;
  let furthest = 0;
  while (groundAt(bottom * pow(ratio, furthest), bottom) > 0 && bottom * pow(ratio, furthest) > smallestSize) {
    furthest++;
  }
  rows = [];
  // The furthest row first, so the nearer ones walk in front of it
  for (let n = furthest; n >= -rowsBelow; n--) {
    rows.push(buildRow(n, bottom * pow(ratio, n), bottom));
  }
  standGates();
}

// Find the gates on the page, draw their outlines, and get ready to light them up on hover
function setupGates() {
  let links = [...document.querySelectorAll('.gate')];
  let title = document.getElementById('gate-title');
  let pictures = paintGates(links.length, brushName, gatePen.weight, gatePen.width, gatePen.width * gateShape, gatePen.hole, density * 1.5);
  gates = links.map((link, i) => {
    let gate = {
      link,
      frame: link.querySelector('.gate-frame'),
      name: link.querySelector('.gate-name'),
      light: 0,
      picture: pictures[i],
      media: null,
    };
    link.addEventListener('mouseenter', () => {
      startLight(gate);
      title.textContent = gate.name.textContent;
      title.classList.add('showing');
    });
    link.addEventListener('mouseleave', () => {
      if (gate.media?.pause && !document.body.classList.contains('fading')) gate.media.pause();
      title.classList.remove('showing');
    });
    return gate;
  });
}

// What lights up a gate only gets loaded once the mouse goes over it. The gate that sets off the
// transition (see fade_link.js) shares its video.
function startLight(gate) {
  if (!gate.media) {
    let source = gate.link.dataset.light;
    if (gate.link.id === 'fade-link') {
      gate.media = document.querySelector('#fade-background video');
    } else if (source.endsWith('.mp4')) {
      gate.media = document.createElement('video');
      gate.media.muted = true;
      gate.media.loop = true;
      gate.media.playsInline = true;
      gate.media.src = source;
    } else {
      gate.media = new Image();
      gate.media.src = source;
    }
  }
  if (gate.media.play && !matchMedia('(prefers-reduced-motion: reduce)').matches) gate.media.play();
}

// Stand the gates in a row across the top of the screen (or two, if they don't fit), each on the row
// of people nearest to where it goes, so they all line up
function standGates() {
  let target = matchMedia('(hover: hover)').matches ? gateWidth : gateWidthTouch;
  let perRow = width < gates.length * (target + 8) ? Math.ceil(gates.length / 2) : gates.length;
  let wide = Math.min(target, width / perRow - 8);
  let high = wide * gateShape;
  let top = document.querySelector('.navbar').getBoundingClientRect().bottom + gateGap;

  document.querySelectorAll('.gate').forEach((link, i) => {
    let gate = gates.find((g) => g.link === link);
    let foot = top + (high + gateGap) * Math.floor(i / perRow) + high;
    let row = rows.reduce((best, r) => (Math.abs(r.ground - foot) < Math.abs(best.ground - foot) ? r : best));
    gate.left = (((i % perRow) + 0.5) / perRow) * width - wide / 2;
    gate.top = row.ground - high;
    gate.width = wide;
    gate.height = high;
    gate.bottom = row.ground;

    gate.link.style.left = `${gate.left + wide / 2}px`;
    gate.link.style.top = `${gate.top}px`;
    gate.frame.style.width = `${wide}px`;
    gate.frame.style.height = `${high}px`;
    // Small enough for its longest word to fit across the gate
    let longest = Math.max(...gate.name.textContent.split(' ').map((word) => word.length));
    gate.name.style.fontSize = `${Math.min(18, (wide * 0.85) / (longest * 0.68))}px`;
  });
  gates.sort((a, b) => a.bottom - b.bottom);
}

// Row number n, with its figures drawn at this size
function buildRow(n, size, bottom) {
  let near = size / bottom; // 1 at the bottom of the screen, smaller in the distance

  // The row is a strip a little wider than the screen, which the figures wrap round. It's
  // worked out from the smallest a figure in this row can be, so they always wrap off screen.
  let smallest = size * (1 - (rowJitter * (1 - ratio)) / 2);
  let span = width / smallest + offScreen * 2;
  let count = Math.round(span / spacing);

  let people = [];
  for (let i = 0; i < count; i++) {
    let person = n * 1000 + i;
    // Stepping out of the row toward the camera makes a figure bigger, as well as lower down
    let stray = 1 + (hash(person + 0.25) - 0.5) * rowJitter * (1 - ratio);
    let personSize = size * stray;

    // The further away the ground has curled, the more the figures tip back with it
    let distance = Math.max(0, Math.log(bottom / personSize));
    let tipped = Math.cos(Math.min(distance * curlTip, 1.2));

    // Thicker lines toward the front, and a little different for each figure
    let thickness = Math.sqrt(Math.min(1, near)) + (hash(person + 0.35) - 0.5) * weightJitter;
    let weight = constrain(Math.round(thickness * (lineWeights.length - 1)), 0, lineWeights.length - 1);

    // The smallest size of the sheet that's still sharp for this figure
    let level = constrain(Math.floor(Math.log2(resolution / (personSize * density))), 0, sheets.length - 1);
    let sheetScale = resolution / 2 ** level;

    people.push({
      size: personSize,
      tipped,
      ground: groundAt(personSize, bottom),
      stepsPerSecond: lerp(walkSpeed[0], walkSpeed[1], hash(person + 0.75)) / stride,
      start: hash(person) * span,
      firstStep: Math.floor(hash(person + 0.5) * steps),
      sheet: sheets[level],
      sheetScale,
      sheetY: weight * Math.round(frameHeight * resolution) / 2 ** level,
    });
  }

  return {
    people,
    span,
    direction: n % 2 === 0 ? 1 : -1, // Every other row walks the other way
    ground: groundAt(size, bottom),
    size,
    alpha: alpha * Math.min(1, pow(near, distanceFade)),
    swell: waveHeight * near,
    noiseRow: n * 0.3 + 100,
  };
}

function draw() {
  updateGateLights();
  background(255);
  let seconds = millis() / 1000;
  let ctx = drawingContext;
  let brightest = Math.max(...gates.map((gate) => gate.light));
  if (brightest > 0) {
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.globalAlpha = brightest;
    ctx.fillStyle = worldShade;
    ctx.fillRect(0, 0, width, height);
  }
  let swellTime = seconds * waveSpeed;
  let cellWidth = Math.round(frameWidth * resolution); // How wide a picture is on the full-size sheet
  let cellHeight = Math.round(frameHeight * resolution);

  let nextGate = 0;
  for (let row of rows) {
    // Everyone drawn so far is further away than the foot of the next gate, so behind it
    while (nextGate < gates.length && row.ground > gates[nextGate].bottom - 1) {
      showGate(ctx, gates[nextGate]);
      nextGate++;
    }
    ctx.globalAlpha = row.alpha;
    let span = row.span;
    for (let p of row.people) {
      // Each figure walks at its own speed, and only moves when its walk cycle moves on, by
      // exactly as far as its planted foot slides back, so that foot stays put on the ground
      let walked = Math.floor(p.stepsPerSecond * seconds);
      let along = p.start + walked * stride * row.direction;
      let x = width / 2 + ((((along % span) + span) % span) - span / 2) * p.size;

      // Figures in the far distance are too small for the swells to show
      let feet = p.ground;
      if (row.swell > 1) feet += (noise(x * waveScale + 100, row.noiseRow, swellTime) - 0.5) * 2 * row.swell;

      let scaleDown = p.sheetScale / resolution;
      ctx.setTransform(row.direction * p.size * density, 0, 0, p.size * p.tipped * density, x * density, feet * density);
      ctx.drawImage(
        p.sheet,
        ((walked + p.firstStep) % steps) * cellWidth * scaleDown, p.sheetY, cellWidth * scaleDown, cellHeight * scaleDown,
        -feetX, -feetY, frameWidth, frameHeight,
      );
    }
  }
  while (nextGate < gates.length) {
    showGate(ctx, gates[nextGate]);
    nextGate++;
  }
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.globalAlpha = 1;
}

// Fade each gate's light on while the mouse is over it, and off when it isn't. As the transition's
// video fades in behind everything (see fade_link.js), the lights fade out at the same pace, since
// the white then lets the video through anyway.
function updateGateLights() {
  let fading = document.body.classList.contains('fading');
  let change = deltaTime / 1000 / (fading ? 4.5 : lightTime);
  for (let gate of gates) {
    let on = !fading && gate.link.matches(':hover');
    gate.light = constrain(gate.light + (on ? change : -change), 0, 1);
  }
}

// How wide and tall a video or image is, once it's ready to be drawn (or null until then)
function mediaSize(media) {
  if (!media) return null;
  if (media.videoWidth) return media.readyState >= 2 ? { width: media.videoWidth, height: media.videoHeight } : null;
  return media.naturalWidth ? { width: media.naturalWidth, height: media.naturalHeight } : null;
}

// A gate: see-through white with its light inside, its outline and post holes on top, and the
// light's reflection on the ground in front of it
function showGate(ctx, gate) {
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.globalAlpha = gateAlpha;
  ctx.fillStyle = 'white';
  ctx.fillRect(gate.left, gate.top, gate.width, gate.height);

  let size = mediaSize(gate.media);
  if (gate.light > 0 && size) {
    // The middle of the picture, keeping its proportions, to fill the gate
    let fit = Math.max(gate.width / size.width, gate.height / size.height);
    let crop = { width: gate.width / fit, height: gate.height / fit };
    crop.x = (size.width - crop.width) / 2;
    crop.y = (size.height - crop.height) / 2;
    ctx.globalAlpha = gate.light * lightColour;
    ctx.drawImage(gate.media, crop.x, crop.y, crop.width, crop.height, gate.left, gate.top, gate.width, gate.height);
    paintGlow(gate, crop);
    showGlow(ctx, gate);
  }

  let margin = (gateMargin * gate.width) / gatePen.width;
  ctx.globalAlpha = 1;
  ctx.drawImage(gate.picture, gate.left - margin, gate.top - margin, gate.width + margin * 2, gate.height + margin * 2);
  ctx.globalAlpha = 1;
}

// The light reflecting off the ground: the bottom half of what's in the gate, upside down, fading
// out into the distance from its foot and off to the sides
function paintGlow(gate, crop) {
  if (!glow) {
    glow = document.createElement('canvas').getContext('2d');
    glow.canvas.width = 64;
    glow.canvas.height = 32;
  }
  let w = glow.canvas.width;
  let h = glow.canvas.height;
  glow.globalCompositeOperation = 'source-over';
  glow.clearRect(0, 0, w, h);
  glow.save();
  glow.translate(0, h);
  glow.scale(1, -1);
  glow.drawImage(gate.media, crop.x, crop.y + crop.height / 2, crop.width, crop.height / 2, 0, 0, w, h);
  glow.restore();

  glow.save();
  glow.globalCompositeOperation = 'destination-in';
  glow.translate(w / 2, 0);
  glow.scale(w / 2, h);
  let fade = glow.createRadialGradient(0, 0, 0, 0, 0, 1);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(0.25, 'rgba(0, 0, 0, 0.45)');
  fade.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  glow.fillStyle = fade;
  glow.fillRect(-1, 0, 2, 1);
  glow.restore();

  // It starts as wide as the gate's foot, and spreads out from there
  let foot = (w * (1 - 1 / glowWidth)) / 2;
  glow.globalCompositeOperation = 'destination-out';
  glow.beginPath();
  glow.moveTo(0, 0);
  glow.lineTo(foot, 0);
  glow.lineTo(0, h * 0.7);
  glow.moveTo(w, 0);
  glow.lineTo(w - foot, 0);
  glow.lineTo(w, h * 0.7);
  glow.fill();
}

// Draw the reflection out from a gate's foot, along the ground in front of it
function showGlow(ctx, gate) {
  let spread = gate.width * glowWidth;
  ctx.globalAlpha = gate.light * glowAlpha;
  ctx.drawImage(glow.canvas, gate.left + (gate.width - spread) / 2, gate.bottom, spread, gate.height * glowLength);
}

// How far down the screen the ground is under a figure of this size.
//
// The ground lifts steadily with distance, counted in how many times smaller the figures have
// got (a log, so it keeps on rising instead of stopping at the horizon). That gives the rows a
// smallest gap they settle toward. The figures keep shrinking, so against them the ground looks
// steeper and steeper. Lifting any faster than this would make the gaps shrink and then grow
// again, which looks like a dip in the ground.
function groundAt(size, bottomSize) {
  let distance = Math.max(0, Math.log(bottomSize / size));
  return horizon * height + cameraHeight * size - curl * height * distance;
}

// A number from 0 to 1 that's always the same for the same input, but looks random
function hash(x) {
  let h = Math.sin(x * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildCrowd();
}

// This file is a module, so its functions aren't global by default.
// Putting them on window lets p5 find them and run in "global mode".
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
