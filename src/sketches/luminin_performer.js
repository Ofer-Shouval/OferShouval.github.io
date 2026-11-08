// The performer for the Luminin simulation (see luminin_sim.js), playing a guitar with the controller on its headstock,
// in front of the screens, which fill the background. It's one of three (the stage's data-performer):
//
//   guitar   (the default) just the guitar: Ofer's Fender Mustang silhouette with the Luminin on its headstock (made by
//            tools/mustang/mustang.py, into public/sprites/mustang-luminin.png, with where its controller and middle
//            are in luminin_mustang.json), swung as a whole about its middle
//   sprites  Ofer's sprite sheets, played frame by frame (cut out by tools/performer-sprites/build.py,
//            into public/sprites/luminin-performer.png, with each frame's place, feet and headstock in
//            luminin_performer_frames.json)
//   puppet   the 3D puppet (luminin_puppet.js), drawn as a flat black silhouette, moving smoothly through its poses;
//            set aside for now, as it didn't look right
//
// For now there are only the jolts down and up (the guitar does both; the sprites and the puppet only the jolt down). What the controller would
// read comes from how the headstock moves, as the real one's accelerometer and gyroscope would see it: how far it's
// tipped (zTilt), sudden jerks down and up (downJolt, upJolt), swings toward the audience and back (forwardJolt,
// backJolt), how hard it's moving (totalAcc), how fast it's turning (gyroX, gyroY), and the little bit of noise the
// guitar's own hum puts into all of them. A screen beside it graphs those numbers as they come in. (Earlier performers
// are kept in archive/luminin-performer.)
//
// To play it, the buttons under it, or the down and up arrows. Clicking the controller presses its button for the next song.

import SHEET from './luminin_performer_frames.json';
import MUSTANG from './luminin_mustang.json';

const W = 800;
const H = 540;
const GRAVITY = 981; // cm/s², to turn accelerations into g
const FEET = [260, 480]; // Where the performer stands on the stage
const STANDING = 330; // ...and how tall, in pixels

// The jolts each move is tied to: a move's motion only counts toward its own (the catch at the bottom of a jolt down
// would otherwise read as a jolt up, and the dip before a jolt up as a jolt down)
const TIED = { down: ['downJolt'], up: ['upJolt'] };

const HUM = 0.04; // The guitar's vibration, in g
const NECK = 85; // How far the controller is from the guitar's middle, in cm (for how fast it's swinging)

// How the motion becomes the controller's numbers (roughly in the ranges the original sketches expect)
const JOLT_FADE = 0.98; // How much of a jolt is left each time round the controller's loop
const JOLT_LOOP = 0.05; // ...which comes round every 50 ms
const GYRO_SCALE = 0.1; // For each degree a second

const SHOW_STAGE = false; // The stage (the screens behind the performer, and the room's haze and beams), off for now
// (the canvas is see-through)
const SHOW_GRAPH = false; // The graph of the controller's readings, off for now
const SHOW_LIGHT = false; // The controller's light blooming and leaving a trail, off for now
const SKETCH = { x: 20, y: 10, size: 300 }; // Where a song's sketch is shown, as on the laptop

export function createPerformer(holder, { onButton }) {
  const canvas = holder.querySelector('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  // The performer is drawn first on its own, then laid on the stage in the chosen style (see figure())
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const maskContext = mask.getContext('2d', { willReadFrequently: true });

  const vibration = HUM;
  let time = 0;
  let last = null; // The controller's last position and velocity
  let smoothAcc = [0, 0, 0];
  let lastTurn = null;
  const jolts = {}; // The jolts as the controller keeps them, before they're rounded to send
  let controllerOnScreen = [0, 0];
  let readings = {};

  // The body: each can set off a move, move on in time, draw itself, and say where the controller is
  let body = null;
  const which = holder.dataset.performer || 'guitar';
  if (which === 'puppet') import('./luminin_puppet.js').then(({ createPuppet }) => (body = puppetBody(createPuppet)));
  else if (which === 'sprites') body = spriteBody(() => time);
  else body = guitarBody(() => time);

  function play(name) {
    if (body) body.play(name);
  }
  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toCanvas(event);
    if (Math.hypot(x - controllerOnScreen[0], y - controllerOnScreen[1]) < 22) onButton();
  });
  const KEYS = { ArrowDown: 'down', ArrowUp: 'up' };
  canvas.addEventListener('keydown', (event) => {
    const name = KEYS[event.key];
    if (!name) return;
    event.preventDefault();
    if (!event.repeat) play(name);
  });
  for (const button of holder.querySelectorAll('[data-move]')) {
    const name = button.dataset.move;
    button.addEventListener('click', () => play(name));
  }

  function toCanvas(event) {
    const box = canvas.getBoundingClientRect();
    return [((event.clientX - box.left) / box.width) * W, ((event.clientY - box.top) / box.height) * H];
  }

  // ------------------------------------------------------------ Just the guitar
  function guitarBody(now) {
    const LENGTH = 300; // How long the guitar is on the stage, in pixels
    const HELD = [SKETCH.x + 68, 405]; // Where its middle is on the stage: the guitar centred under the sketch
    const s = LENGTH / MUSTANG.width;
    const perCm = MUSTANG.perCm * s;
    // Poses: how far its neck is tipped up (radians) and how far it's lifted (px), and when they're reached (s)
    const REST = { angle: 0.25, lift: 0 };
    const MOVES = {
      // Wound up, the neck lifting, then brought down hard, past level, and back up to where it was held
      down: [
        { t: 0.14, angle: 0.55, lift: 14 },
        { t: 0.32, angle: -0.45, lift: -20 },
        { t: 0.44, angle: -0.32, lift: -14 },
        { t: 0.78, angle: 0.1, lift: -4 },
        { t: 1.15, ...REST },
      ],
      // Dipped, the neck dropping, then thrust up hard, well past where it was held, and settling back
      up: [
        { t: 0.14, angle: 0, lift: -10 },
        { t: 0.32, angle: 1.0, lift: 18 },
        { t: 0.44, angle: 0.88, lift: 14 },
        { t: 0.78, angle: 0.4, lift: 4 },
        { t: 1.15, ...REST },
      ],
    };
    // Drawn once at its size on the stage, so it isn't shrunk from the full image every frame
    const image = document.createElement('canvas');
    const source = new Image();
    source.onload = () => {
      image.width = Math.round(MUSTANG.width * s);
      image.height = Math.round(MUSTANG.height * s);
      const c = image.getContext('2d');
      c.imageSmoothingQuality = 'high';
      c.drawImage(source, 0, 0, image.width, image.height);
    };
    source.src = `${import.meta.env.BASE_URL}sprites/mustang-luminin.png`;

    let pose = { ...REST };
    let move = null;
    // A point in the image, on the stage, as the guitar's held
    const onStage = ([x, y]) => {
      const dx = (x - MUSTANG.pivot[0]) * s;
      const dy = (y - MUSTANG.pivot[1]) * s;
      const [c, n] = [Math.cos(-pose.angle), Math.sin(-pose.angle)];
      return [HELD[0] + dx * c - dy * n, HELD[1] - pose.lift + dx * n + dy * c];
    };
    return {
      // Starts from wherever it is, so one can cut into another
      play(name) {
        if (!MOVES[name]) return;
        move = { name, start: now(), keys: [{ t: 0, ...pose }, ...MOVES[name]] };
      },
      update() {
        if (!move) return;
        const t = now() - move.start;
        const keys = move.keys;
        if (t >= keys[keys.length - 1].t) {
          move = null;
          pose = { ...REST };
          return;
        }
        let i = 0;
        while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
        const k = [i - 1, i, i + 1, i + 2].map((j) => keys[clamp(j, 0, keys.length - 1)]);
        const u = clamp((t - k[1].t) / (k[2].t - k[1].t), 0, 1);
        pose = { angle: curve(k.map((p) => p.angle), u), lift: curve(k.map((p) => p.lift), u) };
      },
      move: () => move && move.name,
      draw(c) {
        if (!image.width) return;
        c.save();
        c.translate(HELD[0], HELD[1] - pose.lift);
        c.rotate(-pose.angle);
        c.drawImage(image, -MUSTANG.pivot[0] * s, -MUSTANG.pivot[1] * s);
        c.restore();
      },
      controller() {
        const at = onStage(MUSTANG.controller);
        // In cm: y up, z forward (toward the headstock, as it's held level)
        return { position: [0, (H - at[1]) / perCm, at[0] / perCm], onCanvas: at, pitch: pose.angle, yaw: 0 };
      },
    };
  }

  // ------------------------------------------------------------ The 3D puppet
  function puppetBody(createPuppet) {
    const puppet = createPuppet({ width: W, height: H, feet: FEET, standing: STANDING });
    return {
      play: (name) => puppet.play(name),
      update: (dt) => puppet.update(dt),
      move: () => puppet.move,
      draw: (c) => c.drawImage(puppet.canvas, 0, 0),
      controller() {
        const { room, onCanvas, pitch, yaw } = puppet.controller();
        return { position: room, onCanvas, pitch, yaw };
      },
    };
  }

  // ------------------------------------------------------------ The sprite sheets
  function spriteBody(now) {
    const CM = 178 / SHEET.standing; // cm per pixel, the performer standing 178 cm tall
    // The moves: which of the sheet's frames play, in order, and how long each is shown (s)
    const IDLE = { name: 'down', index: 7 }; // Low in the lunge the jolt down ends in, playing
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const MOVES = { down: { frames: range(0, 7), each: 0.14 } };
    const atlas = new Image();
    atlas.src = `${import.meta.env.BASE_URL}sprites/luminin-performer.png`;

    // What's shown: a list of frames, each with the move that put it there, when it starts and how long it lasts
    let steps = [{ ...IDLE, move: null, t: 0, d: Infinity }];
    const frameOf = (step) => SHEET.moves[step.name][step.index];
    const current = () => {
      let i = 0;
      while (i < steps.length - 1 && steps[i + 1].t <= now()) i++;
      return i;
    };
    // Drops what hasn't been shown yet, keeping a few frames back for the readings to run smoothly on from
    function cut() {
      const i = current();
      steps = steps.slice(Math.max(0, i - 2), i + 1);
      const shown = steps[steps.length - 1];
      shown.d = Math.max(0, now() - shown.t);
    }
    function queue(move, indices, each) {
      const end = steps[steps.length - 1];
      let t = Math.max(now(), end.t + end.d);
      for (const index of indices) {
        steps.push({ move, name: move, index, t, d: each });
        t += each;
      }
    }
    function rest() {
      const end = steps[steps.length - 1];
      steps.push({ ...IDLE, move: null, t: end.t + end.d, d: Infinity });
    }

    const place = (frame) => [FEET[0] - frame.anchor[0], FEET[1] - frame.anchor[1]];
    const tipOnStage = (frame) => {
      const [x, y] = place(frame);
      return [x + frame.tip[0], y + frame.tip[1]];
    };
    // The neck's angle, up from pointing forward (to the right)
    const angleOf = (frame) => Math.atan2(-frame.neck[1], frame.neck[0]);

    // The frames only say where the headstock is now and then; the controller itself moves smoothly between them, on
    // a curve through each frame's headstock, reached halfway through the time that frame's shown
    function headstockAt(t) {
      const knots = steps.map((s) => ({ t: s.t + Math.min(s.d, 0.2) / 2, frame: frameOf(s) }));
      let i = 0;
      while (i < knots.length - 1 && knots[i + 1].t <= t) i++;
      const k = [i - 1, i, i + 1, i + 2].map((j) => knots[clamp(j, 0, knots.length - 1)]);
      if (k[2] === k[1] || t <= k[1].t) return { position: tipOnStage(k[1].frame), angle: angleOf(k[1].frame) };
      const u = clamp((t - k[1].t) / (k[2].t - k[1].t), 0, 1);
      const tips = k.map((knot) => tipOnStage(knot.frame));
      // Angles unwrapped, so a swing over the head goes the short way round
      const angles = [angleOf(k[0].frame)];
      for (let j = 1; j < 4; j++) {
        let a = angleOf(k[j].frame);
        while (a - angles[j - 1] > Math.PI) a -= Math.PI * 2;
        while (a - angles[j - 1] < -Math.PI) a += Math.PI * 2;
        angles.push(a);
      }
      return { position: [0, 1].map((d) => curve(tips.map((p) => p[d]), u)), angle: curve(angles, u) };
    }

    return {
      // Each starts at once, cutting into whatever's playing
      play(name) {
        if (!MOVES[name]) return;
        cut();
        queue(name, MOVES[name].frames, MOVES[name].each);
        rest();
      },
      update() {
        // Frames long past aren't needed any more
        const i = current();
        if (i > 3) steps = steps.slice(i - 3);
      },
      move: () => steps[current()].move,
      draw(c) {
        const frame = frameOf(steps[current()]);
        if (atlas.complete && atlas.naturalWidth) c.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, ...place(frame), frame.w, frame.h);
      },
      controller() {
        const { position: onStage, angle } = headstockAt(now());
        // In cm, from the feet: y up, z forward (the way the performer faces, toward the audience); swinging forward
        // and back counted round the guitar's middle
        const forward = (onStage[0] - FEET[0]) * CM;
        return {
          position: [0, (FEET[1] - onStage[1]) * CM, forward],
          onCanvas: tipOnStage(frameOf(steps[current()])),
          pitch: angle,
          yaw: forward / NECK,
        };
      },
    };
  }

  // ------------------------------------------------------------ The controller's readings
  function read(dt, controller) {
    const { position, pitch, yaw } = body.controller();
    if (!last) last = { position, velocity: [0, 0, 0] };
    const velocity = scale(sub(position, last.position), 1 / dt);
    const acceleration = scale(sub(velocity, last.velocity), 1 / dt);
    last = { position, velocity };
    smoothAcc = smoothAcc.map((a, i) => a + (acceleration[i] - a) * 0.5);
    // In g, with the vibration's noise in it
    const g = smoothAcc.map((a) => a / GRAVITY + gaussian() * vibration);
    controller.totalAcc += (Math.min(3, Math.hypot(...g)) - controller.totalAcc) * 0.3;
    controller.zTilt = Math.sin(pitch) + gaussian() * vibration * 0.3;
    // Turning, in degrees a second, as the gyroscope reads it: tipping the neck up and down (x), and swinging it
    // toward the audience and back (y)
    const turn = [pitch, yaw];
    const degrees = 180 / Math.PI;
    const gyro = lastTurn ? turn.map((a, i) => ((a - lastTurn[i]) / dt) * degrees) : [0, 0];
    lastTurn = turn;
    controller.gyroX = clamp(gyro[0] * GYRO_SCALE + gaussian() * vibration * 4, -30, 30);
    controller.gyroY = clamp(gyro[1] * GYRO_SCALE + gaussian() * vibration * 4, -30, 30);
    // The jolts, as the controller's firmware works them out (20250602_Luminin_Controller.ino): turning faster than
    // a threshold sets the jolt to how fast, which then fades by 2% each time round its loop (every 50 ms), so a jolt
    // lasts a good while after the motion's over (half gone in 1.7 s). Its value's sent rounded
    const move = body.move();
    const tied = (move && TIED[move]) || [];
    const fade = Math.pow(JOLT_FADE, dt / JOLT_LOOP);
    const latch = (key, speed, over) => {
      jolts[key] = (jolts[key] || 0) * fade;
      if (tied.includes(key) && speed > over) jolts[key] = speed;
      controller[key] = Math.round(jolts[key]);
    };
    latch('downJolt', -gyro[0], 350);
    latch('upJolt', gyro[0], 350);
    latch('forwardJolt', gyro[1], 400);
    latch('backJolt', -gyro[1], 400);
    readings = { ...controller, vibration };
  }

  // ------------------------------------------------------------ Drawing
  function draw(screenImage, glowColour, sketch) {
    context.clearRect(0, 0, W, H);
    // The sketch's frame, scaled to cover the stage (cropping its sides)
    if (screenImage && SHOW_STAGE) {
      const fit = Math.max(W / screenImage.width, H / screenImage.height);
      const width = screenImage.width * fit;
      const height = screenImage.height * fit;
      context.drawImage(screenImage, (W - width) / 2, (H - height) / 2, width, height);
    }
    // A song's sketch as it is on the laptop running it ({image, samples}), with a dot on each spot its LEDs take
    // their colour from
    if (sketch) {
      const { x, y, size } = SKETCH;
      context.drawImage(sketch.image, x, y, size, size);
      const cell = size / sketch.samples;
      context.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for (let i = 0; i < sketch.samples; i++) {
        for (let j = 0; j < sketch.samples; j++) {
          context.beginPath();
          context.arc(x + (i + 0.5) * cell, y + (j + 0.5) * cell, 1, 0, Math.PI * 2);
          context.fill();
        }
      }
    }

    // The performer, feet on the stage
    maskContext.clearRect(0, 0, W, H);
    body.draw(maskContext);
    const light = body.controller().onCanvas;
    controllerOnScreen = light;

    if (SHOW_STAGE) haze(glowColour);
    if (SHOW_LIGHT) trail(glowColour, light);
    figure(holder.dataset.style || 'solid', glowColour);
    if (SHOW_LIGHT) bloom(glowColour, light);
    if (SHOW_GRAPH) graph();
  }

  // The controller's light leaves a fading trail as it moves, like a brush on the screens
  const TRAIL = 40; // How many frames it lasts
  const trailPoints = [];
  function trail(colour, light) {
    trailPoints.push(light.slice(0, 2));
    if (trailPoints.length > TRAIL) trailPoints.shift();
    context.save();
    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';
    for (let i = 1; i < trailPoints.length; i++) {
      const age = i / trailPoints.length; // 1 = newest
      context.strokeStyle = withAlpha(colour, age * 0.7);
      context.lineWidth = 2 + age * 7;
      context.beginPath();
      context.moveTo(...trailPoints[i - 1]);
      context.lineTo(...trailPoints[i]);
      context.stroke();
    }
    context.restore();
  }

  // The controller's light, blooming hot white through the haze, brighter the harder it's moving
  function bloom(colour, light) {
    context.save();
    context.globalCompositeOperation = 'screen';
    const size = 18 + Math.min(3, readings.totalAcc || 0) * 8;
    const glow = context.createRadialGradient(light[0], light[1], 0, light[0], light[1], size * 2.5);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.35, withAlpha(colour, 0.5));
    glow.addColorStop(1, withAlpha(colour, 0));
    context.fillStyle = glow;
    context.fillRect(light[0] - size * 2.5, light[1] - size * 2.5, size * 5, size * 5);
    context.restore();
  }

  // The performer laid on the stage in a style (holder's data-style; trying them out):
  // solid, soft, neon, led, halftone, cutout, brush, hatch
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = H;
  const scratchContext = scratch.getContext('2d');
  function figure(style, colour) {
    const c = context;
    c.save();
    if (style === 'soft') {
      // As through stage haze: blurred edges
      c.filter = 'blur(5px)';
      c.drawImage(mask, 0, 0);
    } else if (style === 'neon') {
      // Only its outline, glowing like a neon tube in the screens' colour
      scratchContext.clearRect(0, 0, W, H);
      scratchContext.save();
      for (let a = 0; a < 12; a++) scratchContext.drawImage(mask, Math.cos((a / 12) * Math.PI * 2) * 2.5, Math.sin((a / 12) * Math.PI * 2) * 2.5);
      scratchContext.globalCompositeOperation = 'destination-out';
      scratchContext.drawImage(mask, 0, 0);
      scratchContext.globalCompositeOperation = 'source-in';
      scratchContext.fillStyle = 'white';
      scratchContext.fillRect(0, 0, W, H);
      scratchContext.restore();
      c.drawImage(mask, 0, 0); // A dark body behind the tube
      c.shadowColor = colour;
      c.shadowBlur = 16;
      c.drawImage(scratch, 0, 0);
      c.drawImage(scratch, 0, 0);
    } else if (style === 'led' || style === 'halftone') {
      // Made of lights on a grid, like the Luminin's own screens (led), or of printed dots sized by how much of each
      // cell it covers (halftone)
      const cell = style === 'led' ? 9 : 6;
      const pixels = maskContext.getImageData(0, 0, W, H).data;
      for (let y = cell / 2; y < H; y += cell) {
        for (let x = cell / 2; x < W; x += cell) {
          let cover = 0;
          for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, 0]]) {
            cover += pixels[4 * (Math.floor(y + dy * cell) * W + Math.floor(x + dx * cell)) + 3] / 255 / 5;
          }
          if (cover < 0.05) continue;
          c.beginPath();
          if (style === 'led') {
            c.fillStyle = 'black';
            c.fillRect(x - cell / 2, y - cell / 2, cell, cell);
            c.fillStyle = 'rgba(255, 255, 255, 0.92)';
            c.arc(x, y, cell * 0.3 * Math.min(1, cover * 1.4), 0, Math.PI * 2);
          } else {
            c.fillStyle = 'black';
            c.arc(x, y, cell * 0.62 * Math.sqrt(cover), 0, Math.PI * 2);
          }
          c.fill();
        }
      }
    } else if (style === 'cutout') {
      // Cut from black paper: a shadow behind it, as if it stands a little off the screens
      c.globalAlpha = 0.45;
      c.filter = 'blur(3px)';
      c.drawImage(mask, 10, 8);
      c.filter = 'none';
      c.globalAlpha = 1;
      c.drawImage(mask, 0, 0);
    } else if (style === 'brush') {
      // Ink brushed on: ragged, dry-brush edges
      for (let i = 0; i < 6; i++) {
        c.globalAlpha = 0.35;
        c.drawImage(mask, Math.sin(time * 3 + i * 2.1) * 2.5, Math.cos(time * 2 + i * 1.3) * 2.5);
      }
      c.globalAlpha = 1;
      c.drawImage(mask, 0, 0);
    } else if (style === 'hatch') {
      // Pen hatching, crossed, inside a drawn outline
      scratchContext.clearRect(0, 0, W, H);
      scratchContext.save();
      scratchContext.strokeStyle = 'black';
      scratchContext.lineWidth = 1.1;
      scratchContext.beginPath();
      for (let k = -H; k < W; k += 5) {
        scratchContext.moveTo(k, 0);
        scratchContext.lineTo(k + H, H);
        scratchContext.moveTo(k + H, 0);
        scratchContext.lineTo(k, H);
      }
      scratchContext.stroke();
      scratchContext.globalCompositeOperation = 'destination-in';
      scratchContext.drawImage(mask, 0, 0);
      scratchContext.restore();
      c.drawImage(scratch, 0, 0);
    } else {
      c.drawImage(mask, 0, 0);
    }
    c.restore();
  }

  // The room's haze, lit by the screens: a bloom of their light behind the performer, a couple of slow beams cutting
  // through it, and a wash of it over everything, as on stage at Baby's
  function haze(colour) {
    context.save();
    context.globalCompositeOperation = 'screen';
    const back = [FEET[0] + 20, FEET[1] - SHEET.standing * 0.8];
    const glow = context.createRadialGradient(back[0], back[1], 0, back[0], back[1], H * 0.7);
    glow.addColorStop(0, withAlpha(colour, 0.55));
    glow.addColorStop(1, withAlpha(colour, 0));
    context.fillStyle = glow;
    context.fillRect(0, 0, W, H);
    // Beams from lights above, sweeping slowly
    context.filter = 'blur(10px)';
    for (const [from, sweep, speed] of [[0.18, 0.5, 0.21], [0.62, -0.4, 0.13]]) {
      const x = W * from;
      const swing = Math.sin(time * speed * Math.PI * 2) * 0.25 + sweep;
      context.fillStyle = withAlpha(colour, 0.22);
      context.beginPath();
      context.moveTo(x - 6, -10);
      context.lineTo(x + 6, -10);
      context.lineTo(x + Math.tan(swing + 0.12) * H, H);
      context.lineTo(x + Math.tan(swing - 0.12) * H, H);
      context.closePath();
      context.fill();
    }
    context.filter = 'none';
    context.fillStyle = withAlpha(colour, 0.12);
    context.fillRect(0, 0, W, H);
    context.restore();
  }

  // A screen on the right graphing the controller's numbers over the last few seconds, as the sketch receives them,
  // one trace each, newest on the right
  const TRACES = [
    ['zTilt', -1.3, 1.3],
    ['downJolt', 0, 2000],
    ['upJolt', 0, 2000],
    ['forwardJolt', 0, 2000],
    ['backJolt', 0, 2000],
    ['totalAcc', 0, 3],
    ['gyroX', -30, 30],
    ['gyroY', -30, 30],
    ['vibration', 0, 1],
  ];
  const HISTORY = 240; // Readings kept (four seconds at 60 a second)
  const history = TRACES.map(() => []);
  const GRAPH = { x: W - 214, y: 40, width: 200, lane: (H - 54) / 9 }; // Below the song's name
  function graph() {
    TRACES.forEach(([name], i) => {
      history[i].push(readings[name] || 0);
      if (history[i].length > HISTORY) history[i].shift();
    });
    const { x, y, width, lane } = GRAPH;
    const height = lane * TRACES.length;
    context.fillStyle = '#060807';
    context.fillRect(x, y, width, height);
    context.font = '11px Inconsolata, monospace';
    context.textBaseline = 'top';
    TRACES.forEach(([name, low, high], i) => {
      const top = y + i * lane;
      const toY = (value) => top + lane - 4 - ((clamp(value, low, high) - low) / (high - low)) * (lane - 8);
      // The lane, its zero line, and its name
      context.fillStyle = 'rgba(255, 255, 255, 0.05)';
      if (i % 2) context.fillRect(x, top, width, lane);
      context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, toY(0));
      context.lineTo(x + width, toY(0));
      context.stroke();
      context.fillStyle = 'rgba(255, 255, 255, 0.45)';
      context.fillText(name, x + 4, top + 3);
      // The trace
      const values = history[i];
      context.strokeStyle = 'rgba(150, 255, 190, 0.85)';
      context.lineWidth = 1.2;
      context.beginPath();
      values.forEach((value, j) => {
        const px = x + width - (values.length - 1 - j) * (width / (HISTORY - 1));
        j ? context.lineTo(px, toY(value)) : context.moveTo(px, toY(value));
      });
      context.stroke();
    });
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.strokeRect(x, y, width, height);
  }

  return {
    // Moves the performer on by dt seconds, fills in the controller's readings, and draws the stage with the screen
    // showing screenImage (a canvas)
    update(dt, controller, screenImage, glowColour, sketch) {
      dt = Math.min(dt, 1 / 30);
      time += dt;
      if (!body) return; // The puppet's still loading
      body.update(dt);
      read(dt, controller);
      draw(screenImage, glowColour, sketch);
    },
  };
}

// ------------------------------------------------------------ Little helpers
// An 'rgb(r g b)' colour (or any CSS colour with three numbers in it) with an alpha
function withAlpha(colour, alpha) {
  const [r = 255, g = 255, b = 255] = (colour.match(/[\d.]+/g) || []).map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const sub = (a, b) => a.map((x, i) => x - b[i]);
const scale = (a, s) => a.map((x) => x * s);
// A smooth curve (Catmull-Rom) through four values, at u between the middle two
function curve([a, b, c, d], u) {
  return 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
}
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
}
