// The bio picture's look, after Ofer's Processing sketch Video_Processing_Sketch_RTR_2 (2022), in grey.
//
// The picture is sampled on a grid of thin rows, GRID pixels apart. Along each row, every run that's brighter than the
// threshold becomes a thin line, from where it starts to where it ends, its ends nudged a little at random (JITTER);
// the brighter the run, the thicker its line, so what's only just over the threshold is a hairline. Each line sits a random distance above or below its row (Y_SPREAD).
// What isn't bright enough stays black. Lines from the last few frames (trail) are drawn again, thinner the older they
// are, so they fade by getting thinner rather than see-through. It's drawn small and shown at twice the size, pixels
// kept sharp, like the bio picture.
//
// For now it uses the camera (which only starts when asked for; what it sees never leaves the browser). Later it'll
// play a video instead.
//
// Keys: up and down change the threshold, left and right how far the line ends wander, b and n how many frames lines
// linger (as in the original), c goes through the colour modes (MODES, below), the number keys bring
// back a saved setting (PRESETS, below), and Enter clears it.
//
// In a mode, each row can be looked along more than once (a pass): for how bright the picture is, or just how red,
// green or blue, each pass giving its own lines in its own colour. Where passes' lines cross they're added together
// like light (so red, green and blue make white), or, on paper, multiplied like ink.

const GRID = 6; // How far apart the rows are, and how finely each is looked along, in the small picture's pixels
const ZOOM = 1; // How many screen pixels each of the small picture's pixels is shown as
let threshold = 140; // How bright (out of 255) is bright enough
let jitter = 4; // How far, in pixels, each end of a line can wander
let trail = 6; // How many frames a line lasts, getting thinner each one
// A new line's thickness, in pixels, from a run only just over the threshold to one that's white
const WEIGHTS = [0.1, 1.2];
const Y_SPREAD = 4; // How far, in pixels, a line can sit above or below its row
const GREY = 220; // How bright the lines are, out of 255
const GREY_JITTER = 15; // How much each line's grey varies at random

// A colour from a list of them, `over` of the way along it (0 to 1)
function blend(stops, over) {
  let spot = Math.min(stops.length - 1.001, over * (stops.length - 1));
  let i = Math.floor(spot);
  let t = spot - i;
  return stops[i].map((value, k) => value + (stops[i + 1][k] - value) * t);
}
const HEAT = [[40, 30, 170], [190, 40, 150], [255, 150, 50], [255, 245, 215]]; // Blue, magenta, amber, near white
const EMBER = [[90, 0, 10], [220, 30, 20], [255, 140, 40], [255, 230, 170]]; // Dark red to pale orange

// Each mode: the background, how crossing lines mix, and its passes. A pass looks at a channel of each pixel (-1 = the
// brightest of red, green and blue, 0 red, 1 green, 2 blue), turned upside down if `dark` (so what's dark counts as
// bright), its lines moved `dx` pixels sideways, and coloured `colour(over)`, where over is how far over the threshold
// the run is (0 to 1)
const MODES = {
  grey: { background: 'black', mix: 'source-over', passes: [{ channel: -1, colour: () => [255, 255, 255] }] },
  rgb: {
    background: 'black',
    mix: 'lighter',
    passes: [
      { channel: 0, colour: () => [255, 0, 0] },
      { channel: 1, colour: () => [0, 255, 0] },
      { channel: 2, colour: () => [0, 0, 255] },
    ],
  },
  red: { background: 'black', mix: 'source-over', passes: [{ channel: 0, colour: () => [255, 0, 0] }] },
  // Red, green and blue apart, and a little apart sideways too, like a misaligned print or old TV
  split: {
    background: 'black',
    mix: 'lighter',
    passes: [
      { channel: 0, dx: -6, colour: () => [255, 0, 0] },
      { channel: 1, colour: () => [0, 255, 0] },
      { channel: 2, dx: 6, colour: () => [0, 0, 255] },
    ],
  },
  // Brightness, coloured: just over the threshold is blue, then magenta, amber, and near white
  heat: { background: 'black', mix: 'source-over', passes: [{ channel: -1, colour: (over) => blend(HEAT, over) }] },
  // Red alone, coloured from dark red to pale orange
  ember: { background: 'black', mix: 'lighter', passes: [{ channel: 0, colour: (over) => blend(EMBER, over) }] },
  // Cyan, magenta and yellow ink on paper, where the picture is short of red, green and blue
  ink: {
    background: '#eee8da',
    mix: 'multiply',
    passes: [
      { channel: 0, dark: true, colour: () => [0, 175, 225] },
      { channel: 1, dark: true, colour: () => [230, 0, 140] },
      { channel: 2, dark: true, colour: () => [255, 225, 0] },
    ],
  },
};
const MODE_NAMES = Object.keys(MODES);
let mode = 'grey';

// Settings worth keeping, brought back with the number keys (1 for the first)
const PRESETS = [
  // Ofer's favourite so far (13 Nov 2026): the colours split and smeared wide
  { name: 'split smear', threshold: 135, jitter: 30, trail: 6, mode: 'split' },
];
let preset = null; // The name of the preset last brought back, until something's changed

let holder = document.querySelector('.bio-streaks');
let canvas = holder.querySelector('canvas');
let button = holder.querySelector('.bio-streaks-camera');
let readout = holder.querySelector('.bio-streaks-readout');
let context = canvas.getContext('2d');
let sampler = document.createElement('canvas');
let samplerContext = sampler.getContext('2d', { willReadFrequently: true });
let video = document.createElement('video');
video.playsInline = true;
video.muted = true;
let stream = null;
let width, height, cols, rows;
let lastTime = -1;
let frames = []; // The lines of the last few frames, newest first: each line is [from, to, y, grey]

function fit() {
  width = Math.max(1, Math.round(canvas.clientWidth / ZOOM));
  height = Math.max(1, Math.round(canvas.clientHeight / ZOOM));
  canvas.width = width;
  canvas.height = height;
  cols = Math.floor(width / GRID);
  rows = Math.floor(height / GRID);
  sampler.width = cols;
  sampler.height = rows;
  clear();
}

function clear() {
  frames = [];
  context.fillStyle = MODES[mode].background;
  context.fillRect(0, 0, width, height);
}

// Brightness as Processing measures it (in HSB, the brightest of red, green and blue)
// or, with a channel, just how red, green or blue it is
// (upside down if dark)
function brightness(pixels, spot, channel, dark) {
  let value = channel >= 0 ? pixels[spot + channel] : Math.max(pixels[spot], pixels[spot + 1], pixels[spot + 2]);
  return dark ? 255 - value : value;
}

function drawFrame() {
  // The picture, one pixel to each cell of the grid, cropped to fit and mirrored like a mirror
  let scale = Math.max(cols / video.videoWidth, rows / video.videoHeight);
  let drawnWidth = video.videoWidth * scale;
  let drawnHeight = video.videoHeight * scale;
  samplerContext.save();
  samplerContext.translate(cols, 0);
  samplerContext.scale(-1, 1);
  samplerContext.drawImage(video, (cols - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
  samplerContext.restore();
  let pixels = samplerContext.getImageData(0, 0, cols, rows).data;

  let lines = [];
  for (let { channel, dark, dx = 0, colour } of MODES[mode].passes)
  for (let row = 1; row < rows - 1; row++) {
    let start = -1;
    let total = 0; // The run's brightness, added up
    for (let col = 1; col < cols; col++) {
      let bright = brightness(pixels, (row * cols + col) * 4, channel, dark);
      let lit = col < cols - 1 && bright > threshold;
      if (lit && start < 0) {
        start = col;
        total = 0;
      }
      if (lit) total += bright;
      if (!lit && start >= 0) {
        let from = start * GRID + dx + (Math.random() * 2 - 1) * jitter;
        let to = col * GRID + dx + (Math.random() * 2 - 1) * jitter;
        let over = (total / (col - start) - threshold) / (255 - threshold); // 0 just over the threshold, 1 white
        let weight = WEIGHTS[0] + over * (WEIGHTS[1] - WEIGHTS[0]);
        let grey = Math.round(Math.max(0, Math.min(255, GREY + (Math.random() * 2 - 1) * GREY_JITTER)));
        let y = row * GRID + (Math.random() * 2 - 1) * Y_SPREAD;
        let style = `rgb(${colour(over).map((value) => Math.round((value * grey) / 255)).join(', ')})`;
        lines.push([from, Math.max(to, from + 1), y, style, weight]);
        start = -1;
      }
    }
  }
  frames.unshift(lines);
  frames.length = Math.min(frames.length, trail);

  // Oldest first, so the newest, thickest lines are on top
  context.fillStyle = MODES[mode].background;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = MODES[mode].mix;
  for (let age = frames.length - 1; age >= 0; age--) {
    let thinning = 1 - age / trail;
    for (let [from, to, y, style, weight] of frames[age]) {
      context.lineWidth = weight * thinning;
      context.strokeStyle = style;
      context.beginPath();
      context.moveTo(from, y);
      context.lineTo(to, y);
      context.stroke();
    }
  }
  context.globalCompositeOperation = 'source-over';
}

function loop() {
  if (!stream) return;
  if (video.readyState >= 2 && video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    drawFrame();
  }
  requestAnimationFrame(loop);
}

function showReadout() {
  readout.textContent = `${preset ? preset + ' · ' : ''}threshold ${threshold} · wander ${jitter} · trail ${trail} · ${mode} · keys: up/down, left/right, b/n, c, 1, enter`;
}

async function startCamera() {
  button.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    button.textContent = 'turn off your camera';
    showReadout();
    canvas.focus({ preventScroll: true });
    lastTime = -1;
    requestAnimationFrame(loop);
  } catch {
    stopCamera();
    readout.textContent = window.isSecureContext
      ? 'the camera could not start. check that this page is allowed to use it'
      : 'the camera only works on a secure (https) page';
  }
  button.disabled = false;
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  button.textContent = 'turn on your camera';
  readout.textContent = 'uses your camera. the video stays on your device';
  clear();
}

button.addEventListener('click', () => (stream ? stopCamera() : startCamera()));

canvas.addEventListener('keydown', (event) => {
  let key = event.key;
  if (key === 'ArrowUp') threshold = Math.max(5, threshold - 5); // More of it
  else if (key === 'ArrowDown') threshold = Math.min(250, threshold + 5); // Less
  else if (key === 'ArrowRight') jitter = Math.min(30, jitter + 1);
  else if (key === 'ArrowLeft') jitter = Math.max(0, jitter - 1);
  else if (key === 'b' || key === 'B') trail = Math.min(40, trail + 1); // Linger longer
  else if (key === 'n' || key === 'N') trail = Math.max(1, trail - 1); // Less
  else if (key === 'c' || key === 'C') mode = MODE_NAMES[(MODE_NAMES.indexOf(mode) + 1) % MODE_NAMES.length];
  else if (key === 'Enter') clear();
  else if (PRESETS[Number(key) - 1]) {
    ({ threshold, jitter, trail, mode } = PRESETS[Number(key) - 1]);
    preset = PRESETS[Number(key) - 1].name;
    clear();
    event.preventDefault();
    showReadout();
    return;
  } else return;
  preset = null;
  event.preventDefault();
  showReadout();
});

let resizing;
new ResizeObserver(() => {
  clearTimeout(resizing);
  resizing = setTimeout(fit, 150);
}).observe(canvas);

fit();
stopCamera();
