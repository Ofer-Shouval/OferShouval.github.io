// Full-screen landing sketch for the art section, grown out of a week 6 homework (archive/week 6):
// a crowd of stick figures walks across the screen, laid out like the water on the home page
// (see home/water.js). They walk in rows that get closer together toward the horizon, so the crowd
// stretches away into the distance. Swells of Perlin noise lift and drop the figures as they pass.
//
// A figure's feet are below the horizon by the camera's height at that figure's size. The view
// is warped so that the ground curls upward as it goes away from the camera, like a road rising
// up a wall: the further away, the more it lifts, and the more the figures tip back with it.
//
// The figures are a 12-frame walk cycle (public/media/walk_cycle), drawn in black on clear
// backgrounds. Everything here works out from the clock and the window, so nothing needs
// remembering from one frame to the next.

import p5 from 'p5';

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

let frames = []; // The walk cycle
let frameHeight = 168; // How tall the frames are

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  imageMode(CENTER);

  for (let i = 1; i <= 12; i++) {
    frames.push(await loadImage('/media/walk_cycle/' + i + '.png'));
  }
}

function draw() {
  background(255);
  let seconds = millis() / 1000;

  // The furthest row first, so the nearer ones walk in front of it
  let bottomSize = (height * (1 - horizon)) / cameraHeight; // The size that puts a figure's feet at the bottom of the screen
  let smallestSize = (furthestSize * height) / 900;
  let furthest = 0;
  while (groundAt(bottomSize * pow(ratio, furthest), bottomSize) > 0 && bottomSize * pow(ratio, furthest) > smallestSize) {
    furthest++;
  }
  for (let n = furthest; n >= -rowsBelow; n--) {
    showRow(n, bottomSize * pow(ratio, n), bottomSize, seconds);
  }
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

// Row number n, with its figures drawn at this size
function showRow(n, size, bottomSize, seconds) {
  let near = size / bottomSize; // 1 at the bottom of the screen, smaller in the distance

  let direction = n % 2 === 0 ? 1 : -1; // Every other row walks the other way

  // The row is a strip a little wider than the screen, which the figures wrap round. It's
  // worked out from the smallest a figure in this row can be, so they always wrap off screen.
  let smallest = size * (1 - (rowJitter * (1 - ratio)) / 2);
  let span = width / smallest + offScreen * 2;
  let count = Math.round(span / spacing);

  push();
  drawingContext.globalAlpha = alpha * Math.min(1, pow(near, distanceFade));

  for (let i = 0; i < count; i++) {
    let person = n * 1000 + i;
    // Stepping out of the row toward the camera makes a figure bigger, as well as lower down
    let stray = 1 + (hash(person + 0.25) - 0.5) * rowJitter * (1 - ratio);
    let personSize = size * stray;

    // Each figure walks at its own speed, and only moves when its walk cycle moves on, by
    // exactly as far as its planted foot slides back, so that foot stays put on the ground
    let speed = lerp(walkSpeed[0], walkSpeed[1], hash(person + 0.75));
    let steps = Math.floor((speed * seconds) / stride);
    let along = hash(person) * span + steps * stride * direction;
    let x = width / 2 + (((along % span) + span) % span - span / 2) * personSize;

    let wave = (noise(x * waveScale + 100, n * 0.3 + 100, seconds * waveSpeed) - 0.5) * 2;
    let feet = groundAt(personSize, bottomSize) + wave * waveHeight * near;
    let frame = frames[(steps + Math.floor(hash(person + 0.5) * frames.length)) % frames.length];

    // The further away the ground has curled, the more the figures tip back with it
    let distance = Math.max(0, Math.log(bottomSize / personSize));
    let tipped = Math.cos(Math.min(distance * curlTip, 1.2));

    push();
    translate(x, feet - (frameHeight * personSize * tipped) / 2);
    scale(direction * personSize, personSize * tipped);
    image(frame, 0, 0);
    pop();
  }
  pop();
}

// A number from 0 to 1 that's always the same for the same input, but looks random
function hash(x) {
  let h = Math.sin(x * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// This file is a module, so its functions aren't global by default.
// Putting them on window lets p5 find them and run in "global mode".
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
