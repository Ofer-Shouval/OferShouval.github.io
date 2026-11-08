// The Luminin, simulated: the 2025 album-release Processing sketch
// (~/Documents/Projects/Luminin/sketch_20250602_Album_Release_Sketches), ported to p5 scene by scene, as close to the
// original as it'll go. On stage the controller on the guitar's headstock sends its motion over serial; here the mouse
// stands in for it (see readController), and a click is its button, moving on to the next song, as do the arrow keys.
//
// Like the original it draws at 800 x 300, with one shared offscreen layer (pg) that scenes leave their trails on.
// It only runs while it's on the screen.
//
// Left out for now: the strobe() the original lays over some songs, which flashes about twelve times a second and has to
// be held to three a second here (photosensitive epilepsy) before it goes in; and the songs not ported yet.

import p5 from 'p5';

p5.disableFriendlyErrors = import.meta.env.PROD;

const WIDTH = 800;
const HEIGHT = 300;

// The controller's readings, as the original names them (see serialEvent in the original), with roughly their ranges
const controller = {
  zTilt: 0, // How far the headstock tips, about -1 to 1: here, the mouse's height, top = 1
  totalAcc: 0, // How hard it's moving, 0 to about 3: here, the mouse's speed
  gyroX: 0, // How fast it's turning, about -30 to 30: here, how fast the mouse moves up and down
  gyroY: 0, // ...and side to side
  downJolt: 0, // A sudden jerk downward, 0 to about 2000: here, a quick flick of the mouse down, dying away
};
// How the mouse is turned into those
const SPEED_TO_ACC = 0.06; // totalAcc for each pixel a frame the mouse moves
const SPEED_TO_GYRO = 0.6; // gyro for each pixel a frame
const JOLT_FROM = 12; // How many pixels a frame down the mouse has to move to count as a jolt
const JOLT_GAIN = 90; // downJolt for each pixel a frame past that
const SMOOTHING = 0.15; // How quickly the readings follow the mouse (1 = at once)
const JOLT_DECAY = 0.9; // How much of a jolt is left each frame

const holder = document.querySelector('.luminin-sim');
const label = holder.querySelector('.sim-label');

new p5((p) => {
  let pg;
  let scene = 0;
  let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  let lastMouse = { ...mouse };

  // ------------------------------------------------------------------ Intermission: the worm (Worm.pde)
  const worm = {
    numSegments: 80,
    xyLoc: [],
    noiseCounter: 0,
    speed: 0.002,
    setup() {
      for (let i = 0; i < this.numSegments; i++) this.xyLoc[i] = p.createVector(0, 0);
    },
    update(circSize) {
      const { zTilt, downJolt } = controller;
      const head = this.xyLoc[this.numSegments - 1];
      head.x = p.map(p.noise(this.noiseCounter), 0, 1, -WIDTH / 2, (3 * WIDTH) / 2);
      head.y = p.map(p.noise(this.noiseCounter + 50), 0, 1, -HEIGHT / 2, (3 * HEIGHT) / 2);
      this.speed = p.map(downJolt, 0, 2000, 0.005, 0.5);

      pg.colorMode(p.RGB);
      pg.strokeWeight(3);
      const n = this.noiseCounter;
      pg.fill(p.noise(n) * 50, 150 * p.noise(n + 5), 150 * p.noise(n + 10), Math.max(0, p.map(downJolt, 0, 100, 50, 10)));
      pg.rect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < this.numSegments - 1; i++) {
        this.xyLoc[i].x = this.xyLoc[i + 1].x;
        this.xyLoc[i].y = this.xyLoc[i + 1].y;
        const scalar = Math.sin(p.map(i, 0, this.numSegments - 1, 0, Math.PI));
        const tilt = Math.abs(zTilt);
        pg.stroke(255 - scalar * 255 * tilt + p.random(-20, 20), p.random(downJolt), scalar * 250 * tilt + p.random(-20, 20));
        pg.fill(scalar * 250 * tilt + p.random(-20, 20), p.random(downJolt), 255 - scalar * 255 * tilt + p.random(-20, 20));
        pg.ellipse(this.xyLoc[i].x, this.xyLoc[i].y, circSize * scalar, circSize * scalar);
      }
      p.image(pg, 0, 0);
      this.noiseCounter += this.speed;
    },
  };

  // ------------------------------------------------------------------ Odysseus: the pink cloud (Pink_Cloud.pde)
  // The original works out every pixel; this does every fourth one each way and scales it up, which the LED screens'
  // own coarseness hides anyway
  const CLOUD_STEP = 4;
  const cloud = {
    image: null,
    setup() {
      this.image = p.createImage(WIDTH / CLOUD_STEP, HEIGHT / CLOUD_STEP);
    },
    update() {
      const { zTilt, totalAcc, downJolt } = controller;
      const z = p.millis() * 0.0001 + totalAcc / 2;
      const dx = p.millis() * 0.0001;
      const scale = 0.02 * (1 + totalAcc / 3) * CLOUD_STEP;
      const img = this.image;
      img.loadPixels();
      for (let x = 0; x < img.width; x++) {
        for (let y = 0; y < img.height; y++) {
          const n = p.noise(x * scale, dx + y * scale, z) - 0.2;
          // Processing's HSB clamps the hue to 0-255, which is what turns most of it pink
          const hue = p.map(zTilt, -1, 1, 0, -80) + 240 + 100 * n - p.random(20 + downJolt);
          const [r, g, b] = hsb(hue, 255, 255);
          const at = 4 * (x + img.width * y);
          img.pixels[at] = r;
          img.pixels[at + 1] = g;
          img.pixels[at + 2] = b;
          img.pixels[at + 3] = 255;
        }
      }
      img.updatePixels();
      p.image(img, 0, 0, WIDTH, HEIGHT);
    },
  };

  // ------------------------------------------------------------------ Little Drone + Head in the Cloud: golden circles (Golden_Circles.pde)
  const golden = {
    slow: 3,
    num: 40,
    xLoc: [],
    yLoc: [],
    cosWave: [],
    speedCounter: 0,
    setup() {
      for (let i = 0; i < this.num; i++) {
        this.xLoc[i] = 0;
        this.yLoc[i] = 0;
        this.cosWave[i] = Math.abs(Math.cos(p.map(i, 0, this.num, 0, Math.PI)));
      }
    },
    update() {
      const { zTilt, totalAcc, gyroY, downJolt } = controller;
      if (this.speedCounter % this.slow === 0) {
        p.strokeWeight(10);
        p.background(0);
        for (let i = 0; i < this.yLoc.length - 1; i++) {
          this.yLoc[i] = this.yLoc[i + 1];
          this.xLoc[i] = this.xLoc[i + 1];
          p.fill(...hsb(10 * this.cosWave[i] + p.map(zTilt, -2, 1, 100, 260) - p.random(downJolt), 255, 100 + downJolt / 2));
          p.stroke(...hsb(20 * this.cosWave[i] + p.map(zTilt, -1, 1, 0, 40), 255, 255));
          const diameter = Math.sin(p.map(i, 0, this.yLoc.length, 0, Math.PI)) * ((HEIGHT / 2) * (1 + totalAcc / 3));
          p.ellipse(this.xLoc[i], this.yLoc[i], diameter, diameter);
        }
      }
      this.yLoc[this.yLoc.length - 1] = p.random(HEIGHT);
      this.xLoc[this.xLoc.length - 1] = p.random(WIDTH) + gyroY * 5;
      this.speedCounter++;
    },
  };

  // ------------------------------------------------------------------ Crush: scanlines (Scanlines.pde)
  const scanlines = {
    y: -60,
    ySpeed: 9, // The original works this out once, at the start, when there's no jolt yet
    update() {
      const { zTilt, totalAcc } = controller;
      p.background(0);
      pg.colorMode(p.RGB);
      pg.noStroke();
      pg.fill(0, 50);
      pg.rect(0, 0, WIDTH, HEIGHT);
      pg.strokeWeight(5 + totalAcc * 5);
      pg.stroke(...hsb(255 - (zTilt - 0.2) * 100 - p.random(totalAcc * 50), 255 - p.random(totalAcc * 50), 255));
      pg.push();
      pg.translate(0, this.y);
      for (let i = -HEIGHT * 5; i < HEIGHT * 5; i += 120) {
        pg.line(0, i, WIDTH / 2, i + zTilt * 600);
        pg.line(WIDTH, i, WIDTH / 2, i + zTilt * 600);
      }
      pg.pop();
      p.image(pg, 0, 0);
      this.y += this.ySpeed;
      if (this.y > HEIGHT) this.y = -HEIGHT;
    },
  };

  // The songs, in the original's order (its switch in draw()), with the ones not ported yet left out
  const songs = [
    { name: 'intermission', draw: () => worm.update(200) },
    { name: 'odysseus', draw: () => cloud.update() },
    { name: 'little drone + head in the cloud', draw: () => golden.update() },
    { name: 'crush', draw: () => scanlines.update() },
  ];

  // Processing's HSB, out of 255 each, clamped as Processing clamps it, to RGB
  function hsb(h, s, v) {
    h = (Math.min(255, Math.max(0, h)) / 255) * 6;
    s = Math.min(255, Math.max(0, s)) / 255;
    v = Math.min(255, Math.max(0, v));
    const i = Math.floor(h) % 6;
    const f = h - Math.floor(h);
    const a = v * (1 - s);
    const b = v * (1 - s * f);
    const c = v * (1 - s * (1 - f));
    return [[v, c, a], [b, v, a], [a, v, c], [a, b, v], [c, a, v], [v, a, b]][i];
  }

  // The mouse, read as if it were the controller
  function readController() {
    const vx = mouse.x - lastMouse.x;
    const vy = mouse.y - lastMouse.y;
    lastMouse = { ...mouse };
    const speed = Math.hypot(vx, vy);
    const follow = (now, target) => now + (target - now) * SMOOTHING;
    controller.zTilt = follow(controller.zTilt, p.map(mouse.y, 0, HEIGHT, 1, -1, true));
    controller.totalAcc = follow(controller.totalAcc, Math.min(3, speed * SPEED_TO_ACC));
    controller.gyroX = follow(controller.gyroX, p.constrain(vy * SPEED_TO_GYRO, -30, 30));
    controller.gyroY = follow(controller.gyroY, p.constrain(vx * SPEED_TO_GYRO, -30, 30));
    const jolt = Math.max(0, vy - JOLT_FROM) * JOLT_GAIN;
    controller.downJolt = Math.min(2000, Math.max(jolt, controller.downJolt * JOLT_DECAY));
    if (controller.downJolt < 1) controller.downJolt = 0;
  }

  function nextSong(step = 1) {
    scene = (scene + step + songs.length) % songs.length;
    label.textContent = `the luminin, simulated: ${songs[scene].name}`;
  }

  p.setup = () => {
    p.pixelDensity(1);
    const canvas = p.createCanvas(WIDTH, HEIGHT);
    canvas.parent(holder);
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('aria-label', 'The Luminin, simulated: move the mouse over it to play it like the controller; click, or press the arrow keys, for the next song.');
    pg = p.createGraphics(WIDTH, HEIGHT);
    pg.pixelDensity(1);
    p.noiseDetail(5, 0.4); // As the original's cloud sets it, for every scene
    worm.setup();
    cloud.setup();
    golden.setup();
    nextSong(0);

    // Where the mouse is, in the sketch's own 800 x 300, however big the canvas is shown
    const move = (event) => {
      const box = canvas.elt.getBoundingClientRect();
      mouse = { x: ((event.clientX - box.left) / box.width) * WIDTH, y: ((event.clientY - box.top) / box.height) * HEIGHT };
    };
    canvas.elt.addEventListener('pointermove', move);
    canvas.elt.addEventListener('pointerdown', (event) => {
      move(event);
      lastMouse = { ...mouse };
    });
    canvas.elt.addEventListener('click', () => nextSong(1));
    canvas.elt.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') nextSong(1);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') nextSong(-1);
      else return;
      event.preventDefault();
    });

    p.noLoop();
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? p.loop() : p.noLoop())).observe(canvas.elt);
  };

  p.draw = () => {
    readController();
    songs[scene].draw();
  };
}, holder);
