// "Refracture" (2018), converted from the original Processing sketch: a webcam feed chopped up into lines.
//
// The picture is sampled on a grid. Along each row of the grid, it finds where the brightness crosses the
// threshold, and draws a line between each crossing and the next: green where it's over the threshold,
// and blue to magenta in the gaps between. It works along the row from right to left, as the original
// did, so every line's length comes out negative, and that's part of what picks its colour.
//
// The camera only starts when it's asked for, and what it sees never leaves the browser. The up and down
// arrow keys change the threshold, and the left and right ones how much the colours vary.

const VIDEO_SCALE = 4; // Size of each cell in the grid
const THRESHOLD_STEP = 5;
const THRESHOLD_LIMIT = 255; // At this, or over it, the threshold goes back to where it starts

let threshold = 250;
let randomFactor = 50;

let holder = document.querySelector('.refracture');
let canvas = holder.querySelector('canvas');
let button = holder.querySelector('button');
let readout = holder.querySelector('.refracture-readout');
let context = canvas.getContext('2d');
let video = document.createElement('video');
video.playsInline = true;
video.muted = true;

// The picture, one pixel to each cell of the grid
let sampler = document.createElement('canvas');
let samplerContext = sampler.getContext('2d', { willReadFrequently: true });

let width, height, cols, rows, density;
let stream = null;
let lastTime = -1;

function fit() {
  let box = canvas.getBoundingClientRect();
  density = Math.min(2, window.devicePixelRatio || 1);
  width = Math.round(box.width);
  height = Math.round(box.height);
  canvas.width = width * density;
  canvas.height = height * density;
  cols = Math.floor(width / VIDEO_SCALE);
  rows = Math.floor(height / VIDEO_SCALE);
  sampler.width = cols;
  sampler.height = rows;
  blank();
}

function blank() {
  context.setTransform(density, 0, 0, density, 0, 0);
  context.fillStyle = 'black';
  context.fillRect(0, 0, width, height);
}

function randomBetween(low, high) {
  return low + Math.random() * (high - low);
}

// (Processing limits colours to this range by itself)
function channel(value) {
  return Math.max(0, Math.min(255, value));
}

function drawLine(point1, point2, y, red, green, blue) {
  context.strokeStyle = `rgb(${channel(red)},${channel(green)},${channel(blue)})`;
  context.beginPath();
  context.moveTo(point1, y + 0.5);
  context.lineTo(point2, y + 0.5);
  context.stroke();
}

function drawFrame() {
  // Fill the grid with the picture, cropped to fit, with no smoothing: each cell is a single sample from
  // the middle of its square, as in the original, since averaging would soften the brightest spots
  let scale = Math.max(cols / video.videoWidth, rows / video.videoHeight);
  let drawnWidth = video.videoWidth * scale;
  let drawnHeight = video.videoHeight * scale;
  samplerContext.imageSmoothingEnabled = false;
  samplerContext.drawImage(video, (cols - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
  let pixels = samplerContext.getImageData(0, 0, cols, rows).data;

  blank();
  context.lineWidth = 1;

  for (let i = 1; i < rows - 1; i++) {
    let linePoints = [];
    let newLine = true;
    let yLocation = i * VIDEO_SCALE;

    for (let j = 1; j < cols - 1; j++) {
      let xLocation = width - 1 - j * VIDEO_SCALE;

      // Processing's brightness(): whichever of red, green and blue is highest
      let column = Math.min(cols - 1, Math.max(0, Math.floor(xLocation / VIDEO_SCALE)));
      let spot = (i * cols + column) * 4;
      let currentBrightness = Math.max(pixels[spot], pixels[spot + 1], pixels[spot + 2]);

      if (currentBrightness > threshold && newLine) {
        linePoints.push(xLocation);
        newLine = false;
      }
      if (currentBrightness < threshold && !newLine) {
        linePoints.push(xLocation);
        newLine = true;
      }
      if (xLocation >= width - 2 * VIDEO_SCALE && !newLine) {
        linePoints.push(xLocation);
      }
    }

    // From point 0 to point 1, point 2 to point 3, etc.
    for (let k = 0; k < linePoints.length - 1; k += 2) {
      let lineLength = linePoints[k + 1] - linePoints[k];
      drawLine(linePoints[k], linePoints[k + 1], yLocation, 0, 200 + randomBetween(-randomFactor, randomFactor), lineLength + randomBetween(-randomFactor, randomFactor));
    }

    // From point 1 to point 2, point 3 to point 4, etc.
    for (let k = 1; k < linePoints.length - 1; k += 2) {
      let lineLength = linePoints[k + 1] - linePoints[k];
      drawLine(linePoints[k], linePoints[k + 1], yLocation, lineLength * 2 - randomBetween(-randomFactor, randomFactor), 0, 255 - lineLength - randomBetween(-randomFactor, randomFactor));
    }
  }
}

function loop() {
  if (!stream) return;
  // Only when the camera has a new picture, like video.available()
  if (video.readyState >= 2 && video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    drawFrame();
  }
  requestAnimationFrame(loop);
}

function showReadout() {
  readout.textContent = `threshold ${threshold} · colour variation ${randomFactor} · arrow keys change these`;
}

async function startCamera() {
  button.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    button.textContent = 'turn off camera';
    holder.classList.add('running');
    showReadout();
    canvas.focus({ preventScroll: true });
    requestAnimationFrame(loop);
  } catch {
    stopCamera();
    readout.textContent = 'the camera could not start. check that this page is allowed to use it';
  }
  button.disabled = false;
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  lastTime = -1;
  button.textContent = 'turn on camera';
  holder.classList.remove('running');
  readout.textContent = 'uses your camera. the video stays on your device';
  blank();
}

button.addEventListener('click', () => (stream ? stopCamera() : startCamera()));

canvas.addEventListener('keydown', (event) => {
  if (!stream) return;
  if (event.key === 'ArrowUp') {
    threshold = Math.abs(threshold - THRESHOLD_STEP);
  } else if (event.key === 'ArrowDown') {
    threshold += THRESHOLD_STEP;
    if (threshold >= THRESHOLD_LIMIT) threshold = 250;
  } else if (event.key === 'ArrowRight') {
    randomFactor++;
  } else if (event.key === 'ArrowLeft') {
    randomFactor--;
  } else {
    return;
  }
  event.preventDefault(); // Rather than scrolling the page
  showReadout();
});

let resizing;
new ResizeObserver(() => {
  clearTimeout(resizing);
  resizing = setTimeout(fit, 150);
}).observe(canvas);

fit();
stopCamera();
