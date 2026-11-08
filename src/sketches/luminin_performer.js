// The guitar for the Luminin simulation (see luminin_sim.js): a guitar by itself in 3D, with the controller on its
// headstock, in front of the screens, which fill the background. The viewer moves it, and what the controller would read
// comes from how its headstock actually moves, as the real one's accelerometer and gyroscope would see it: how far it's
// tipped (zTilt), sudden jerks down and up (downJolt, upJolt), swings toward the audience and back (forwardJolt,
// backJolt), how hard it's moving (totalAcc), how fast it's turning (gyroX, gyroY), and the little bit of noise that the
// guitar's own vibration puts into all of them, more while it's strummed. A screen beside it graphs those numbers as
// they come in. (A version with a performer holding it is kept in archive/luminin-performer.)
//
// To play it: drag on the stage to move the guitar (up and down tips the neck, side to side swings it toward the
// audience and back), and flick to jolt it. Or the arrow keys: down and up jolt, left and right swing; space strums;
// enter, or clicking the controller, presses its button for the next song. The buttons under it do the same.
//
// The guitar's a clean black silhouette; the only light on it is the controller's, which leaves a fading trail.

const W = 800;
const H = 500;
const GRAVITY = 981; // cm/s², to turn accelerations into g

// The camera, looking at the performer a little from the side and above
const TURN = -0.2; // How far the guitar's turned from facing the camera (radians)
const CAMERA = { yaw: -0.25, pitch: 0.12, distance: 300, focal: 1250, look: [28, 112, 0], x: W * 0.46, y: H * 0.52 };

// The guitar: where it's slung (its body's middle), and how it moves
const SLUNG = [-8, 100, 14];
const REST = { pitch: 0.35, yaw: 0 }; // The neck's usual angle up from level, and swing toward the audience (radians)
const LIMITS = { pitch: [-0.7, 1.3], yaw: [-0.9, 0.9] };
const DRAG = { pitch: 0.011, yaw: 0.009 }; // Radians for each pixel dragged, up and down and side to side
const SPRING = 90; // How stiffly it follows where it's moved to
const DAMPING = 0.55; // ...and how quickly it settles (1 = no bounce)
const NECK = 85; // How far the controller is from the guitar's middle, in cm
// The gestures, as a push lasting a moment (how strong, in cm/s² or radians/s², and for how long, in seconds)
const PUSH_TIME = 0.08;
const GESTURES = {
  down: { h: -3200, pitch: -14 },
  up: { h: 3200, pitch: 14 },
  forward: { yaw: 70 },
  back: { yaw: -70 },
};
// Its vibration: always a little, much more just after a strum, dying away
const HUM = 0.04; // In g
const STRUM = 0.9;
const STRUM_FADE = 2.5; // How quickly a strum dies away (per second)

// How the motion becomes the controller's numbers (roughly in the ranges the original sketches expect)
const JOLT_FROM = 0.4; // How many g it takes to count as a jolt
const JOLT_GAIN = 700; // ...and how much each g past that adds
const JOLT_HOLD = 0.85; // How much of a jolt is left each frame
const GYRO_SCALE = 0.1; // For each degree a second

const STAGE = '#121212'; // Behind everything, until the screens draw
const SILHOUETTE = '#000'; // The guitar, black against the screens

export function createPerformer(holder, { onButton }) {
  const canvas = holder.querySelector('canvas');
  canvas.width = W;
  canvas.height = H;
  const stageContext = canvas.getContext('2d');
  let context = stageContext; // Where shapes are drawn: the stage, or the figure's mask while the performer's drawn
  // The performer and guitar are drawn first as a black mask, then laid on the stage in the chosen style (see figure())
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const maskContext = mask.getContext('2d', { willReadFrequently: true });

  const guitar = {
    pitch: REST.pitch, pitchV: 0, pitchTarget: REST.pitch,
    yaw: REST.yaw, yawV: 0, yawTarget: REST.yaw,
    h: 0, hV: 0, // How far it's moved up or down from where it's slung
  };
  let pushes = [];
  let vibration = 0;
  let time = 0;
  let last = null; // The controller's last position and velocity
  let smoothAcc = [0, 0, 0];
  let controllerOnScreen = [0, 0];
  let readings = {};

  // ------------------------------------------------------------ Moving it
  const gesture = (name) => {
    if (name === 'strum') {
      vibration = STRUM;
    } else if (name === 'button') onButton();
    else pushes.push({ ...GESTURES[name], until: time + PUSH_TIME });
  };

  let dragging = null;
  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toCanvas(event);
    if (Math.hypot(x - controllerOnScreen[0], y - controllerOnScreen[1]) < 18) {
      gesture('button');
      return;
    }
    dragging = { x, y };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const [x, y] = toCanvas(event);
    guitar.pitchTarget = clamp(guitar.pitchTarget - (y - dragging.y) * DRAG.pitch, ...LIMITS.pitch);
    guitar.yawTarget = clamp(guitar.yawTarget + (x - dragging.x) * DRAG.yaw, ...LIMITS.yaw);
    dragging = { x, y };
  });
  const stop = () => (dragging = null);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  const KEYS = { ArrowDown: 'down', ArrowUp: 'up', ArrowRight: 'forward', ArrowLeft: 'back', ' ': 'strum', Enter: 'button' };
  canvas.addEventListener('keydown', (event) => {
    if (!KEYS[event.key]) return;
    event.preventDefault();
    gesture(KEYS[event.key]);
  });
  for (const button of holder.querySelectorAll('[data-gesture]')) {
    button.addEventListener('click', () => gesture(button.dataset.gesture));
  }

  function toCanvas(event) {
    const box = canvas.getBoundingClientRect();
    return [((event.clientX - box.left) / box.width) * W, ((event.clientY - box.top) / box.height) * H];
  }

  // ------------------------------------------------------------ The physics, and what the controller reads
  function move(dt) {
    let force = { h: 0, pitch: 0, yaw: 0 };
    pushes = pushes.filter((push) => push.until > time);
    for (const push of pushes) for (const key in force) force[key] += push[key] || 0;
    const damping = 2 * Math.sqrt(SPRING) * DAMPING;
    const spring = (value, velocity, target, push) => velocity + (SPRING * (target - value) - damping * velocity + push) * dt;
    guitar.pitchV = spring(guitar.pitch, guitar.pitchV, guitar.pitchTarget, force.pitch);
    guitar.yawV = spring(guitar.yaw, guitar.yawV, guitar.yawTarget, force.yaw);
    guitar.hV = spring(guitar.h, guitar.hV, 0, force.h);
    guitar.pitch += guitar.pitchV * dt;
    guitar.yaw += guitar.yawV * dt;
    guitar.h += guitar.hV * dt;
    vibration = HUM + (vibration - HUM) * Math.exp(-STRUM_FADE * dt);
  }

  function read(dt, controller) {
    const { u } = frame();
    const position = add(slung(), scale(u, NECK));
    if (!last) last = { position, velocity: [0, 0, 0] };
    const velocity = scale(sub(position, last.position), 1 / dt);
    const acceleration = scale(sub(velocity, last.velocity), 1 / dt);
    last = { position, velocity };
    smoothAcc = smoothAcc.map((a, i) => a + (acceleration[i] - a) * 0.5);
    // In g, with the vibration's noise in it
    const g = smoothAcc.map((a) => a / GRAVITY + gaussian() * vibration);
    const jolt = (amount, now) => Math.min(2000, Math.max(Math.max(0, amount - JOLT_FROM) * JOLT_GAIN, now * JOLT_HOLD));
    controller.downJolt = jolt(-g[1], controller.downJolt || 0);
    controller.upJolt = jolt(g[1], controller.upJolt || 0);
    // Toward the audience is toward the camera, +z
    controller.forwardJolt = jolt(g[2], controller.forwardJolt || 0);
    controller.backJolt = jolt(-g[2], controller.backJolt || 0);
    controller.totalAcc += (Math.min(3, Math.hypot(...g)) - controller.totalAcc) * 0.3;
    controller.zTilt = Math.sin(guitar.pitch) + gaussian() * vibration * 0.3;
    const degrees = 180 / Math.PI;
    controller.gyroX = clamp(guitar.pitchV * degrees * GYRO_SCALE + gaussian() * vibration * 4, -30, 30);
    controller.gyroY = clamp(guitar.yawV * degrees * GYRO_SCALE + gaussian() * vibration * 4, -30, 30);
    for (const key of ['downJolt', 'upJolt', 'forwardJolt', 'backJolt']) if (controller[key] < 1) controller[key] = 0;
    readings = { ...controller, vibration };
  }

  // ------------------------------------------------------------ 3D
  const slung = () => add(SLUNG, [0, guitar.h, 0]);
  // The guitar's own directions: u along the neck, v across it (toward its top edge), n out of its front
  function frame() {
    const shake = vibration * 0.012;
    const p = guitar.pitch + gaussian() * shake;
    const w = guitar.yaw + gaussian() * shake;
    const u = [Math.cos(p) * Math.cos(w), Math.sin(p), Math.cos(p) * Math.sin(w)];
    const n = [-Math.sin(w), 0, Math.cos(w)];
    return { u, n, v: cross(n, u) };
  }
  const onGuitar = (a, b, c = 0) => {
    const { u, v, n } = frame();
    return add(add(add(slung(), scale(u, a)), scale(v, b)), scale(n, c));
  };

  function project([x, y, z]) {
    // The performer turns side-on to face the right, as in the clips, with the guitar's neck pointing right and away
    [x, z] = [x * Math.cos(TURN) + z * Math.sin(TURN), -x * Math.sin(TURN) + z * Math.cos(TURN)];
    const { yaw, pitch, distance, focal, look } = CAMERA;
    x -= look[0];
    y -= look[1];
    z -= look[2];
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const s = focal / (distance - z2);
    return [CAMERA.x + x1 * s, CAMERA.y - y2 * s, s];
  }

  // ------------------------------------------------------------ Drawing shapes
  // A path through some points (on the canvas), filled and/or stroked
  function pen(points, { width = 1.5, close = false, fill = null, ink = null } = {}) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    if (close) context.closePath();
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (ink) {
      context.lineWidth = width;
      context.strokeStyle = ink;
      context.lineJoin = context.lineCap = 'round';
      context.stroke();
    }
  }
  // A rounded, tapering limb from a to b (in 3D), thick ra at a and rb at b, as one closed outline on the canvas
  function capsule(a, b, ra, rb, options) {
    const [ax, ay, as] = project(a);
    const [bx, by, bs] = project(b);
    const r1 = ra * as;
    const r2 = rb * bs;
    const angle = Math.atan2(by - ay, bx - ax);
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const t = angle + Math.PI / 2 + (i / 12) * Math.PI; // Round the back of a
      points.push([ax + Math.cos(t) * r1, ay + Math.sin(t) * r1]);
    }
    for (let i = 0; i <= 12; i++) {
      const t = angle - Math.PI / 2 + (i / 12) * Math.PI; // ...and the front of b
      points.push([bx + Math.cos(t) * r2, by + Math.sin(t) * r2]);
    }
    pen(points, { close: true, ...options });
  }
  const pen3 = (points, options) => pen(points.map(project), options);

  // ------------------------------------------------------------ Drawing
  function draw(screenImage, glowColour) {
    context.fillStyle = STAGE;
    context.fillRect(0, 0, W, H);

    // The screens fill the whole background, showing what the sketch is drawing (scaled to cover, cropping its sides)
    if (screenImage) {
      const fit = Math.max(W / screenImage.width, H / screenImage.height);
      const width = screenImage.width * fit;
      const height = screenImage.height * fit;
      context.drawImage(screenImage, (W - width) / 2, (H - height) / 2, width, height);
    }

    context = maskContext;
    context.clearRect(0, 0, W, H);
    // The guitar by itself, a black silhouette against the screens: an offset body, its neck, and a headstock with
    // six tuners along its top edge, the controller on its tip
    const fill = { fill: SILHOUETTE };
    pen3(smooth(OFFSET_BODY).map(([a, b]) => onGuitar(a, b)), { ...fill, close: true });
    pen3([onGuitar(12, -2.7, 0.5), onGuitar(63, -2.2, 0.5), onGuitar(63, 2.2, 0.5), onGuitar(12, 2.7, 0.5)], { ...fill, close: true });
    pen3(smooth(HEADSTOCK).map(([a, b]) => onGuitar(a, b, 0.5)), { ...fill, close: true });
    for (let i = 0; i < 6; i++) {
      const at = 66 + i * 2.4;
      capsule(onGuitar(at, 3.2 + i * 0.25, 0.5), onGuitar(at, 5.6 + i * 0.25, 0.5), 0.7, 0.9, fill);
    }
    const box = [];
    for (const a of [78, 86]) for (const b of [-4, 4]) for (const c of [0.5, 4.5]) box.push(onGuitar(a, b, c));
    for (const face of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
      pen3(face.map((i) => box[i]), { ...fill, close: true });
    }
    const light = project(onGuitar(82, 0, 4.6));
    controllerOnScreen = light;

    context = stageContext;
    haze(glowColour);
    trail(glowColour, light);
    figure(holder.dataset.style || 'solid', glowColour);
    bloom(glowColour, light);
    graph();
  }

  // The controller's light leaves a fading trail as it moves, like a brush on the screens
  const TRAIL = 40; // How many frames it lasts
  const trailPoints = [];
  function trail(colour, light) {
    trailPoints.push(light.slice(0, 2));
    if (trailPoints.length > TRAIL) trailPoints.shift();
    const c = stageContext;
    c.save();
    c.globalCompositeOperation = 'screen';
    c.lineCap = 'round';
    for (let i = 1; i < trailPoints.length; i++) {
      const age = i / trailPoints.length; // 1 = newest
      c.strokeStyle = withAlpha(colour, age * 0.7);
      c.lineWidth = 2 + age * 7;
      c.beginPath();
      c.moveTo(...trailPoints[i - 1]);
      c.lineTo(...trailPoints[i]);
      c.stroke();
    }
    c.restore();
  }

  // The controller's light, blooming hot white through the haze, brighter the harder it's moving
  function bloom(colour, light) {
    const c = stageContext;
    c.save();
    c.globalCompositeOperation = 'screen';
    const size = 18 + Math.min(3, readings.totalAcc || 0) * 8;
    const glow = c.createRadialGradient(light[0], light[1], 0, light[0], light[1], size * 2.5);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.35, withAlpha(colour, 0.5));
    glow.addColorStop(1, withAlpha(colour, 0));
    c.fillStyle = glow;
    c.fillRect(light[0] - size * 2.5, light[1] - size * 2.5, size * 5, size * 5);
    c.restore();
  }

  // The figure's mask laid on the stage in a style (holder's data-style; trying them out):
  // solid, soft, neon, led, halftone, cutout, brush, hatch
  const scratch = document.createElement('canvas');
  scratch.width = W;
  scratch.height = H;
  const scratchContext = scratch.getContext('2d');
  function figure(style, colour) {
    const c = stageContext;
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
      c.fillStyle = 'rgba(0, 0, 0, 0.55)';
      c.globalCompositeOperation = 'source-over';
      c.drawImage(mask, 0, 0); // A dark body behind the tube
      c.globalAlpha = 0.6;
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
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
      c.drawImage(mask, 0.6, 0.6);
    } else if (style === 'brush') {
      // Ink brushed on: ragged, dry-brush edges and a few spatters
      for (let i = 0; i < 6; i++) {
        c.globalAlpha = 0.35;
        c.drawImage(mask, Math.sin(time * 3 + i * 2.1) * 2.5, Math.cos(time * 2 + i * 1.3) * 2.5);
      }
      c.globalAlpha = 1;
      c.drawImage(mask, 0, 0);
      c.fillStyle = 'black';
      const pixels = maskContext.getImageData(0, 0, W, H).data;
      for (let i = 0; i < 260; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
        const y = (Math.sin(i * 78.233) * 12543.5453 % 1 + 1) % 1 * H;
        const near = pixels[4 * (Math.floor(y) * W + Math.floor(x)) + 3];
        if (!near) continue;
        c.beginPath();
        c.arc(x + ((i % 7) - 3) * 3, y + ((i % 5) - 2) * 3, 0.6 + (i % 4) * 0.5, 0, Math.PI * 2);
        c.fill();
      }
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
      // ...plus the outline: the mask spread a little, minus the mask
      scratchContext.globalCompositeOperation = 'source-over';
      const ring = document.createElement('canvas');
      ring.width = W;
      ring.height = H;
      const r = ring.getContext('2d');
      for (let k = 0; k < 8; k++) r.drawImage(mask, Math.cos((k / 8) * Math.PI * 2) * 1.6, Math.sin((k / 8) * Math.PI * 2) * 1.6);
      r.globalCompositeOperation = 'destination-out';
      r.drawImage(mask, 0, 0);
      scratchContext.drawImage(ring, 0, 0);
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
    const back = project([-30, 170, -60]);
    const bloom = context.createRadialGradient(back[0], back[1], 0, back[0], back[1], H * 0.7);
    bloom.addColorStop(0, withAlpha(colour, 0.55));
    bloom.addColorStop(1, withAlpha(colour, 0));
    context.fillStyle = bloom;
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
    pen([[x, y], [x + width, y], [x + width, y + height], [x, y + height]], { close: true, width: 1, ink: 'rgba(255, 255, 255, 0.5)' });
  }

  return {
    // Moves the guitar on by dt seconds, fills in the controller's readings, and draws the stage with the screen showing
    // screenImage (a canvas)
    update(dt, controller, screenImage, glowColour) {
      dt = Math.min(dt, 1 / 30);
      time += dt;
      move(dt);
      read(dt, controller);
      draw(screenImage, glowColour);
    },
  };
}

// ------------------------------------------------------------ The guitar's shape
// In the guitar's own terms: along the neck (toward the headstock) and across it (toward its top edge), in cm, measured
// from the middle of the body. An offset body, like Ofer's: the waist set off-centre, the lower horn reaching further
const OFFSET_BODY = [
  [12, 3], [15, 7], [18, 11], [17, 14], [12, 14.5], [5, 12.5], [-2, 11.8], [-10, 14], [-18, 16], [-25, 14.5],
  [-29.5, 8], [-30.5, 0], [-29.5, -8], [-25, -14.5], [-17, -16.8], [-9, -15], [-3, -12.2], [3, -12.8], [10, -15],
  [16, -15], [19, -12], [16, -7.5], [12.5, -3.5],
];
const HEADSTOCK = [[62, -2.3], [70, -2.8], [79, -3.1], [81, -1], [80.5, 3.6], [76, 4.8], [69, 4.4], [65, 3.2], [62, 2.3]];
// A closed outline smoothed through its points (Catmull-Rom)
function smooth(points, steps = 5) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => points[(i + k + points.length) % points.length]);
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  return out;
}

// ------------------------------------------------------------ Little helpers
// An 'rgb(r g b)' colour (or any CSS colour with three numbers in it) with an alpha
function withAlpha(colour, alpha) {
  const [r = 255, g = 255, b = 255] = (colour.match(/[\d.]+/g) || []).map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const scale = (a, s) => a.map((x) => x * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
}
