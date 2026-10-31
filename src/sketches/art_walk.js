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
import { paintSheets, frameWidth, frameHeight, feetX, feetY, steps } from './brush_frames.js';

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

function setup() {
  density = Math.min(2, window.devicePixelRatio); // Sharp enough, and any more is slow on phones
  pixelDensity(density);
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  // Sharp enough for the biggest figures on this screen, and no bigger
  resolution = constrain(bottomSize() * 1.1 * density, 1, 3);
  sheets = paintSheets(brushName, lineWeights, resolution);
  buildCrowd();
}

// The size that puts a figure's feet at the bottom of the screen
function bottomSize() {
  return (height * (1 - horizon)) / cameraHeight;
}

// Work out everything about the crowd that doesn't change from frame to frame
function buildCrowd() {
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
    alpha: alpha * Math.min(1, pow(near, distanceFade)),
    swell: waveHeight * near,
    noiseRow: n * 0.3 + 100,
  };
}

function draw() {
  background(255);
  let seconds = millis() / 1000;
  let ctx = drawingContext;
  let swellTime = seconds * waveSpeed;
  let cellWidth = Math.round(frameWidth * resolution); // How wide a picture is on the full-size sheet
  let cellHeight = Math.round(frameHeight * resolution);

  for (let row of rows) {
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
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.globalAlpha = 1;
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
