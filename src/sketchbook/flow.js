// The sketchbook as one continuous piece: old sketches that turn into each other on the same canvas.
//
// There are no cuts. Every stage is a list of settings, and the settings always drift toward the current
// stage's, so a worm squares itself off, and whatever's been painted is what the next sketch starts from.
// The paint lasts longer at each stage, from none at all to all of it, and then linear boil takes
// the painting apart into its grid, the brightest squares open up into flowers, and the flowers shrink
// away into the water where it began.
//
// Playing moves it along (see screensToNext), and it carries on slowly by itself if nobody's playing
// (see secondsToNext). Each sketch also has its own file in this folder (wake.js, psychworm.js,
// boxyworm.js, linear-boil.js and flowers.js). This file has its own blended version of them, so changing
// one of those files doesn't change this piece.
//
// The box in art/sketchbook/index.html asks for the camera and sound before anything moves on. Any stage
// can use them: cameraReady() says whether `video` has a picture, and `sound` is an AudioContext once
// it's been turned on, which stays silent while it's switched off.

const stages = [
  {
    name: 'wake',
    hint: 'hold to turn it white',
    settings: { length: 150, flat: 1, box: 0, scatter: 1, wash: 255, washHeld: 255, low: 150, whiteHeld: 1, body: 1, grid: 0, bloom: 0, ground: 0 },
  },
  {
    name: 'psychworm',
    hint: 'hold to leave trails',
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 50, washHeld: 0, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 0, ground: 0 },
  },
  {
    name: 'boxyworm',
    hint: 'hold to wash it away',
    settings: { length: 70, flat: 0, box: 1, scatter: 0, wash: 0, washHeld: 50, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 0, ground: 0 },
  },
  {
    name: 'linear boil',
    hint: 'move to stir it',
    settings: { length: 70, flat: 0, box: 1, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 0, grid: 1, bloom: 0, ground: 51 },
  },
  {
    name: 'flowers',
    hint: 'drag to plant more',
    settings: { length: 150, flat: 1, box: 0, scatter: 1, wash: 255, washHeld: 255, low: 150, whiteHeld: 1, body: 0, grid: 0, bloom: 1, ground: 220 },
  },
];

const morphTime = 2.5; // How quickly the settings drift to the next stage's, in seconds (bigger = slower)
const screensToNext = 25; // How far the pointer travels to reach the next stage, in lengths of the screen's diagonal
const secondsToNext = 45; // How long a stage lasts if nobody plays with it
const idleTime = 5; // How many seconds after the pointer stops before the sketch starts moving by itself
const cell = 16; // Size of each square in linear boil
const stirSize = 6; // How far stirring reaches, in squares
const cooling = 0.97; // How much of the stirred heat each square keeps from one frame to the next
const whitenTime = 12; // How many seconds linear boil's squares take to lose their colours and go white
const cameraTime = 3; // How quickly linear boil turns from the painting to the camera, in seconds (bigger = slower)
const firstFlowers = 30; // How many flowers open when the flowers stage starts
const mostFlowers = 300;

const slug = (name) => name.replace(' ', '-');

export default function flow(p, container) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = { ...stages[0].settings };
  let current = 0;
  let progress = 0;
  let trail = [];
  let flowers = [];

  let canvas;
  let at = { x: 0, y: 0 }; // Where the worm is heading
  let pointer = { x: 0, y: 0, down: false, lastMoved: -Infinity, travelled: 0 };
  let lastPointer = { x: 0, y: 0 };
  let seconds = 0;
  let begun = false; // Has the box been answered?

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  let cameraWanted = false;
  let sound = null;
  let cameraSwitch, soundSwitch;

  // Linear boil's grid: a small copy of whatever was on the canvas, one pixel to a square
  const small = document.createElement('canvas');
  const smallContext = small.getContext('2d', { willReadFrequently: true });
  let cols = 0;
  let rows = 0;
  let picture = new Float32Array(0); // How bright each square was, from 0 to 1
  let live = new Float32Array(0); // The same, from the camera
  let cameraMix = 0; // How far the squares have turned from the picture to the camera
  let colours = new Uint8ClampedArray(0);
  let heat = new Float32Array(0);
  let boilStart = 0;

  const marks = document.createElement('nav');
  marks.className = 'flow-marks';
  marks.setAttribute('aria-label', 'sketches');
  const caption = document.createElement('p');
  caption.className = 'flow-caption';
  caption.setAttribute('aria-live', 'polite');

  // The start of a random range of brightness, without the flicker for anyone who's asked for less motion
  const shimmer = (low) => (calm ? (low + 255) / 2 : p.random(low, 255));

  function takePicture() {
    cols = Math.ceil(p.width / cell) + 1;
    rows = Math.ceil(p.height / cell) + 1;
    small.width = cols;
    small.height = rows;
    smallContext.drawImage(canvas.elt, 0, 0, cols, rows);
    const pixels = smallContext.getImageData(0, 0, cols, rows).data;
    picture = new Float32Array(cols * rows);
    live = new Float32Array(cols * rows);
    cameraMix = 0;
    colours = new Uint8ClampedArray(cols * rows * 3);
    heat = new Float32Array(cols * rows);

    let darkest = 255;
    let brightest = 0;
    for (let i = 0; i < picture.length; i++) {
      const bright = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3;
      picture[i] = bright;
      darkest = Math.min(darkest, bright);
      brightest = Math.max(brightest, bright);
      colours.set(pixels.subarray(i * 4, i * 4 + 3), i * 3);
    }
    // Thin lines average out dim at this size, so stretch whatever range is there to fill 0 to 1
    const range = brightest - darkest;
    for (let i = 0; i < picture.length; i++) {
      picture[i] = range > 8 ? Math.sqrt((picture[i] - darkest) / range) : 0;
    }
  }

  const cameraReady = () => cameraWanted && video.readyState >= 2 && video.videoWidth > 0;

  // Reads the camera into `live`, mirrored and cropped to fit, as the original sketch's squares were
  function readCamera() {
    const scale = Math.max(cols / video.videoWidth, rows / video.videoHeight);
    const drawnWidth = video.videoWidth * scale;
    const drawnHeight = video.videoHeight * scale;
    smallContext.save();
    smallContext.translate(cols, 0);
    smallContext.scale(-1, 1);
    smallContext.drawImage(video, (cols - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
    smallContext.restore();
    const pixels = smallContext.getImageData(0, 0, cols, rows).data;
    for (let i = 0; i < live.length; i++) {
      live[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3 / 255;
    }
  }

  async function startCamera() {
    cameraWanted = true;
    cameraSwitch.textContent = 'camera on';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!cameraWanted) {
        stream.getTracks().forEach((track) => track.stop()); // Switched off while the browser was asking
        return;
      }
      video.srcObject = stream;
      await video.play();
    } catch {
      stopCamera();
      showCaption('no camera', 'linear boil will boil your painting instead');
    }
  }

  function stopCamera() {
    cameraWanted = false;
    video.srcObject?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    cameraSwitch.textContent = 'camera off';
  }

  function startSound() {
    sound ??= new AudioContext();
    sound.resume();
    soundSwitch.textContent = 'sound on';
  }

  function stopSound() {
    sound?.suspend();
    soundSwitch.textContent = 'sound off';
  }

  function plantFlower(x, y) {
    flowers.push({
      x,
      y,
      xSpeed: p.random(-5, 5),
      ySpeed: p.random(-5, 5),
      petals: p.random(3, 12),
      petalLength: p.random(30, 80),
      petalWidth: p.random(10, 30),
      middle: p.random(10, 40),
      middleColour: [p.random(255), p.random(255), p.random(255)],
      petalColour: [p.random(255), p.random(255), p.random(255)],
      spin: p.radians(p.random(1, 8)),
      turned: 0,
    });
    if (flowers.length > mostFlowers) flowers.shift();
  }

  // The flowers open out of the brightest squares of whatever was on the canvas
  function openFlowers() {
    for (let tries = 0, planted = 0; tries < firstFlowers * 40 && planted < firstFlowers; tries++) {
      const i = Math.floor(p.random(picture.length));
      if (picture[i] < 0.5) continue;
      plantFlower((i % cols) * cell, Math.floor(i / cols) * cell);
      planted++;
    }
    while (flowers.length < firstFlowers / 2) plantFlower(p.random(p.width), p.random(p.height));
  }

  function showCaption(name, hint) {
    caption.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'flow-caption-name';
    title.textContent = name;
    caption.append(title, ` ${hint}`);
    // Restarts the fade
    caption.classList.remove('showing');
    void caption.offsetWidth;
    caption.classList.add('showing');
  }

  function goTo(index) {
    current = (index + stages.length) % stages.length;
    progress = 0;
    const { name, hint, settings } = stages[current];
    if (settings.grid || settings.bloom) takePicture();
    if (settings.grid) boilStart = seconds;
    if (settings.bloom) openFlowers();

    [...marks.children].forEach((mark, i) => {
      if (i === current) mark.setAttribute('aria-current', 'step');
      else mark.removeAttribute('aria-current');
    });
    showCaption(name, hint);
    history.replaceState(null, '', `#${slug(name)}`);
  }

  function begin() {
    begun = true;
    container.querySelector('.flow-welcome').hidden = true;
    container.classList.add('flow-begun');
    showCaption(stages[current].name, stages[current].hint);
  }

  function moveWorm(dt) {
    const idle = seconds - pointer.lastMoved > idleTime;
    const before = { ...at };
    if (!idle) {
      at.x = pointer.x;
      at.y = pointer.y;
    } else if (!calm) {
      const wander = seconds * 0.15;
      at.x += (p.noise(wander) * p.width - at.x) * Math.min(1, dt);
      at.y += (p.noise(wander, 40) * p.height - at.y) * Math.min(1, dt);
    }

    // Any frame the pointer hasn't moved, the wake comes up anywhere on the water
    const still = pointer.x === lastPointer.x && pointer.y === lastPointer.y;
    lastPointer = { x: pointer.x, y: pointer.y };
    let next;
    if (still && !calm && now.scatter > 0.5) next = { x: p.random(p.width), y: p.random(p.height) };
    else next = { x: at.x + p.random(-70, 70) * now.scatter, y: at.y + p.random(-30, 30) * now.scatter };
    trail.push(next);
    if (trail.length > stages[0].settings.length) trail.shift();
    return p.dist(before.x, before.y, at.x, at.y);
  }

  function drawWorm() {
    if (now.body < 0.01) return;
    const length = Math.round(now.length);
    const start = Math.max(0, trail.length - length);
    const round = p.width / 8;
    p.rectMode(p.CENTER);
    p.fill(0);
    const wormWeight = p.random(1, 2); // The worms flicker a whole frame at a time, and the wake holds steady
    const white = pointer.down && now.whiteHeld > 0.5;

    for (let i = start; i < trail.length; i++) {
      const along = (i - start + length - (trail.length - start)) / length; // 0 at the tail, 1 at the head
      const { x, y } = trail[i];
      const fade = p.lerp(1, p.sin(along * p.HALF_PI), now.flat);
      p.strokeWeight(p.lerp(wormWeight, white ? p.random(1.8, 2) : 1.8, now.flat));
      if (white) {
        p.stroke(255, 255 * fade);
      } else {
        const sine = p.abs(p.sin(along * p.PI));
        const cosine = p.abs(p.cos(along * p.PI));
        p.stroke(shimmer(now.low) * sine, shimmer(now.low) * cosine, 255 - shimmer(100) * sine, 255 * fade);
      }
      const size = p.sin(along * p.PI) * now.body;
      const depth = y / p.height; // The wake gets bigger toward the bottom of the screen
      const w = size * p.lerp(round, 200 * depth, now.flat);
      const h = size * p.lerp(round, 75 * depth * depth, now.flat);
      if (now.box < 0.01) p.ellipse(x, y, w, h);
      else p.rect(x, y, w, h, (Math.min(w, h) / 2) * (1 - now.box));
    }
  }

  // Goes straight to the canvas, since there can be thousands of squares
  function drawBoil(moved, dt) {
    if (now.grid < 0.01 || !picture.length) return;
    if (cols !== Math.ceil(p.width / cell) + 1 || rows !== Math.ceil(p.height / cell) + 1) takePicture();

    // Once the stage has started, the camera takes over from the painting
    const useCamera = stages[current].settings.grid && cameraReady();
    if (useCamera) readCamera();
    cameraMix += ((useCamera ? 1 : 0) - cameraMix) * (1 - Math.exp(-dt / cameraTime));

    if (moved > 0) {
      const column = Math.floor(at.x / cell);
      const row = Math.floor(at.y / cell);
      const strength = (Math.min(moved, 60) / 60) * (pointer.down ? 1.5 : 0.5);
      for (let y = Math.max(0, row - stirSize); y <= Math.min(rows - 1, row + stirSize); y++) {
        for (let x = Math.max(0, column - stirSize); x <= Math.min(cols - 1, column + stirSize); x++) {
          const near = 1 - Math.hypot(x - column, y - row) / stirSize;
          if (near > 0) heat[y * cols + x] += near * strength;
        }
      }
    }

    const context = p.drawingContext;
    context.save(); // p5 doesn't know about the fill set below
    const white = Math.min(1, (seconds - boilStart) / whitenTime);
    const time = calm ? 0 : seconds * 0.6;
    const keep = Math.pow(cooling, dt * 60);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        heat[i] *= keep;
        const boiling = (p.noise(x * 0.15, y * 0.15, time) - 0.5) * 0.6;
        const seen = picture[i] + (live[i] - picture[i]) * cameraMix;
        const size = cell * now.grid * Math.min(1, Math.max(0, seen + heat[i] + boiling));
        if (size < 1) continue;
        const r = colours[i * 3] + (255 - colours[i * 3]) * white;
        const g = colours[i * 3 + 1] + (255 - colours[i * 3 + 1]) * white;
        const b = colours[i * 3 + 2] + (255 - colours[i * 3 + 2]) * white;
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.fillRect(x * cell - size / 2, y * cell - size / 2, size, size);
      }
    }
    context.restore();
  }

  function drawFlowers(dt) {
    if (now.bloom < 0.01 && stages[current].settings.bloom === 0) {
      flowers = [];
      return;
    }
    const pace = dt * 60;
    p.stroke(0);
    p.strokeWeight(1);
    for (const flower of flowers) {
      flower.x = (flower.x + flower.xSpeed * pace + p.width) % p.width;
      flower.y = (flower.y + flower.ySpeed * pace + p.height) % p.height;
      flower.turned += flower.spin * pace;

      p.push();
      p.translate(flower.x, flower.y);
      p.scale(now.bloom);
      p.rotate(flower.turned);
      p.fill(...flower.petalColour);
      for (let i = 0; i < flower.petals; i++) {
        p.rotate(p.TWO_PI / flower.petals);
        p.ellipse(flower.petalLength / 2, 0, flower.petalLength, flower.petalWidth);
      }
      p.fill(...flower.middleColour);
      p.circle(0, 0, flower.middle);
      p.pop();
    }
  }

  p.setup = () => {
    canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    p.background(0);
    at = { x: p.width / 2, y: p.height / 2 };

    stages.forEach(({ name }, i) => {
      const mark = document.createElement('button');
      mark.textContent = name;
      mark.addEventListener('click', () => goTo(i));
      marks.append(mark);
    });
    cameraSwitch = document.createElement('button');
    cameraSwitch.className = 'flow-switch';
    cameraSwitch.textContent = 'camera off';
    cameraSwitch.addEventListener('click', () => (cameraWanted ? stopCamera() : startCamera()));
    soundSwitch = document.createElement('button');
    soundSwitch.className = 'flow-switch';
    soundSwitch.textContent = 'sound off';
    soundSwitch.addEventListener('click', () => (sound?.state === 'running' ? stopSound() : startSound()));
    marks.append(cameraSwitch, soundSwitch);
    container.append(caption, marks);

    const yes = container.querySelector('.flow-yes');
    const no = container.querySelector('.flow-no');
    yes.addEventListener('click', () => {
      begin();
      startSound();
      startCamera();
    });
    no.addEventListener('click', begin);
    yes.disabled = no.disabled = false;
    yes.focus({ preventScroll: true });

    canvas.elt.addEventListener('pointerdown', () => (pointer.down = true));
    window.addEventListener('pointerup', () => (pointer.down = false));
    window.addEventListener('pointercancel', () => (pointer.down = false));
    window.addEventListener('pointermove', (event) => {
      const box = container.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (seconds - pointer.lastMoved < 1) pointer.travelled += Math.hypot(x - pointer.x, y - pointer.y);
      pointer.x = x;
      pointer.y = y;
      pointer.lastMoved = seconds;
    });
    window.addEventListener('keydown', (event) => {
      if (!begun) return;
      if (event.key === 'ArrowRight') goTo(current + 1);
      if (event.key === 'ArrowLeft') goTo(current - 1);
    });

    const named = stages.findIndex(({ name }) => `#${slug(name)}` === location.hash);
    if (named > 0) Object.assign(now, stages[named].settings);
    goTo(Math.max(0, named));
  };

  p.draw = () => {
    const dt = Math.min(p.deltaTime / 1000, 0.1); // So coming back to the tab doesn't jump ahead
    seconds += dt;

    // Everything drifts toward the current stage
    const drift = 1 - Math.exp(-dt / morphTime);
    for (const key in now) now[key] += (stages[current].settings[key] - now[key]) * drift;

    const wash = pointer.down ? now.washHeld : now.wash;
    if (wash >= 1) p.background(now.ground, wash);

    const moved = moveWorm(dt);
    drawBoil(moved, dt);
    drawFlowers(dt);
    if (pointer.down && moved > 0 && stages[current].settings.bloom) plantFlower(at.x, at.y);
    drawWorm();

    // Playing moves things along. Left alone, it carries on by itself, unless motion's been turned down
    const played = pointer.travelled / Math.hypot(p.width, p.height) / screensToNext;
    pointer.travelled = 0;
    if (!begun) return;
    progress += played;
    if (!calm) progress += dt / secondsToNext;
    if (progress >= 1) goTo(current + 1);
  };
}
