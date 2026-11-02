// The sketchbook as one continuous piece: old sketches that turn into each other on the same canvas.
//
// There are no cuts. Every stage is a list of settings, and the settings always drift toward the current
// stage's, so a worm squares itself off, and whatever's been painted is what the next sketch starts from.
// The paint lasts longer at each stage, from none at all to all of it, and then linear boil takes
// the painting apart into its grid, and the flowers shrink away into the water where it began.
//
// Playing moves it along (see screensToNext), and it carries on slowly by itself if nobody's playing
// (see secondsToNext). Psychworm moves on when it's clicked, by flying through a flower: each of its segments turns into
// a flower as it passes through, and it carries on through a field of them. Each sketch also has its own file in this folder (wake.js, psychworm.js,
// boxyworm.js, linear-boil.js and flowers.js). This file has its own blended version of them, so changing
// one of those files doesn't change this piece.
//
// The line in art/sketchbook/index.html offers the camera and sound on the first stage, until it's
// answered. Any stage can use them: cameraReady() says whether `video` has a picture, and `sound` is
// an AudioContext once it's been turned on, which stays silent while it's switched off.

const stages = [
  {
    name: 'wake',
    hint: 'hold to turn it white',
    settings: { length: 150, flat: 1, box: 0, scatter: 1, wash: 255, washHeld: 255, low: 150, whiteHeld: 1, body: 1, grid: 0, bloom: 0, ground: 0, space: 0 },
  },
  {
    name: 'psychworm',
    hint: 'click for the next sketch, hold to leave trails',
    through: 'flowers', // The stage that going through the ring leads to
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 50, washHeld: 0, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 0, ground: 0, space: 1 },
  },
  {
    name: 'boxyworm',
    hint: 'hold to wash it away',
    settings: { length: 70, flat: 0, box: 1, scatter: 0, wash: 0, washHeld: 50, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 0, ground: 0, space: 0 },
  },
  {
    name: 'linear boil',
    hint: 'move to stir it',
    settings: { length: 70, flat: 0, box: 1, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 0, grid: 1, bloom: 0, ground: 51, space: 0 },
  },
  {
    name: 'flowers',
    hint: 'click to burst, drag to plant more',
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 1, ground: 220, space: 1 },
  },
];

const morphTime = 2.5; // How quickly the settings drift to the next stage's, in seconds (bigger = slower)
const screensToNext = 25; // How far the pointer travels to reach the next stage, in lengths of the screen's diagonal
const secondsToNext = 45; // How long a stage lasts if nobody plays with it
const idleTime = 5; // How many seconds after the pointer stops before the sketch starts moving by itself
// In space, the worm weaves along by itself and the camera follows just above and behind it
const weaveSpeed = 0.2; // How quickly it weaves (smaller = slower)
const weaveWide = 1.3; // How far it weaves from side to side, as a share of the screen's width
const weaveTall = 0.6; // ...and up and down, as a share of the screen's height
const bodyTime = 4; // How many seconds back along its path its tail is, which sets how much of the weave shows
const tailWander = 0.15; // How quickly its tail drifts around the screen (smaller = slower)
const tailWide = 0.4; // How far it can drift from the middle of the screen, as a share of the width: small enough that it can't leave it
const tailTall = 0.1; // ...and up and down, as a share of the height
const tailDistance = 0.9; // How far its tail is from the camera (1 = at its full size, and less is nearer). Too near and it's off the bottom of the screen.
const headDistance = 4; // How far its head is
const spaceHorizon = 0.25; // How far down the screen the point straight ahead of the camera is
const cameraAbove = 0.5; // How far the camera is above it, as a share of the screen's height (bigger = looking down more)
const bodyScale = 2; // How big it's drawn, compared to its size when it isn't in space
// In space a flower waits up ahead, labelled, with the next stage to be seen through its middle. A click, or
// enough time going by, brings it toward the camera, the worm goes through its middle, and that leads to the next stage.
const ringLongest = 20; // How many seconds into the stage it comes by itself, if nobody's clicked
const ringLead = 5; // How many seconds after it sets off the worm's head gets to it
const ringWait = tailDistance + (headDistance - tailDistance) * (1 + ringLead / bodyTime); // How far away it waits, in the same units as headDistance
const ringLabel = 'next sketch';
const ringSmall = 0.2; // How big it is while it waits, compared to what it grows to by the time the worm gets there
const ringNearest = 0.05; // How near it can get, if the circle in its middle hasn't covered the screen by then
const ringBehind = 0.1; // How far the camera is above the worm once it's right behind it, as a share of the screen's height
const ringWash = 160; // How quickly the paint fades while the ring's there, so that the ring doesn't leave a smear behind it
const ringSize = 1.7; // How wide the circle in its middle is, compared to the widest the worm can be
const wormFollow = 0.55; // How closely the worm follows the mouse, at most (1 = exactly, 0 = not at all)
const steerFollow = 0.05; // How quickly the place it's following catches up with the mouse
const focusFollow = 0.06; // How quickly the point the stars stream from catches up with where it's heading
const starCount = 120;
const starSpeed = 0.35; // How much of the way to the camera a star comes each second
const cell = 16; // Size of each square in linear boil
const stirSize = 6; // How far stirring reaches, in squares
const cooling = 0.97; // How much of the stirred heat each square keeps from one frame to the next
const whitenTime = 12; // How many seconds linear boil's squares take to lose their colours and go white
const cameraTime = 3; // How quickly linear boil turns from the painting to the camera, in seconds (bigger = slower)
const fieldCount = 1100; // How many flowers fly by at once, the way the stars do
const fieldSpeed = 0.28; // How much of the distance to the camera they come each second, so they slow down as they get near
const fieldStream = 2.5; // Sets how many appear each second: fieldCount * fieldSpeed / this
const fieldLane = 0.15; // They start at least this far from straight ahead, so they all leave the screen rather than coming right at the camera
const fieldPace = 0.5; // How fast the worm weaves among them, compared to its speed in space
const fieldDelay = 2; // How many seconds after the worm gets there they start to appear
const fieldDrift = 1; // The fastest they drift across the screen as well, in pixels per frame
const fieldSize = 0.25; // How big they are when they first appear, on a screen 1200 pixels wide
const fieldGrow = 1.05; // How quickly they get bigger as they get nearer (1 = in true perspective, and more is quicker)
const fieldFade = 0.3; // How far they come before they've faded in, as a share of the way from where they appear
const mostFlowers = 1400;
const burstReach = 1; // Going through the ring, how far the worm's flowers are thrown, at most, as a share of the screen's width
const burstExtra = 120; // How many more flowers it throws out, which carry on off the screen rather than going back into the worm
const burstExtraSpeed = [0.25, 0.6]; // How fast they carry on, in shares of the screen's width per second
const burstOut = 5; // How quickly they fly out (bigger = quicker)
const burstApart = 1.8; // How far the worm's own flowers are thrown, compared to burstReach
const burstReturn = 1.5; // How slowly they settle back into the shape of the worm (bigger = slower)

const slug = (name) => name.replace(' ', '-');

export default function flow(p, container) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = { ...stages[0].settings };
  let current = 0;
  let progress = 0;
  let trail = [];
  let focus = { x: 0, y: 0 }; // The point the worm's heading for, which the stars stream from
  let stageStart = 0;
  let burstStart = null; // When the worm burst into flowers, having gone through the ring
  let thrownOut = []; // The extra flowers it threw out
  let pathTime = 0; // How far along its path the worm's got, in seconds at its speed in space
  let ringDistance = null; // How far away the ring is, while there is one
  let ringMeets = 0; // When the worm's head gets to it, which says where on the worm's path it is
  let ringWaiting = false; // Is it still waiting for a click?
  let portal = null; // The flower itself
  let steer = { x: 0, y: 0 }; // The place the worm's following, which is the mouse, a little behind
  const steerTrail = []; // Where that's been, so that the rest of the worm can follow it later
  let ringPull = 0; // How far the view has shifted to put the worm through the ring (0 = not at all)
  const stars = [];
  let field = []; // The flowers flying by, furthest first
  let fieldDue = 0; // How many more are due to appear
  const segments = []; // The flowers that the worm is made of, once it's been through the ring
  let frameTime = 0;

  let canvas;
  let at = { x: 0, y: 0 }; // Where the worm is heading
  let pointer = { x: 0, y: 0, down: false, lastMoved: -Infinity, travelled: 0 };
  let lastPointer = { x: 0, y: 0 };
  let seconds = 0;

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
  const nextLabel = document.createElement('button');
  nextLabel.className = 'flow-next';
  nextLabel.textContent = ringLabel;
  nextLabel.addEventListener('click', () => {
    if (ringWaiting) bringRing();
  });

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

  function newFlower() {
    return {
      petals: p.random(3, 12),
      petalLength: p.random(30, 80),
      petalWidth: p.random(10, 30),
      middle: p.random(10, 40),
      middleColour: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`,
      petalColour: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`,
      spin: p.radians(p.random(1, 8)),
      turned: 0,
      xSpeed: p.random(-fieldDrift, fieldDrift),
      ySpeed: p.random(-fieldDrift, fieldDrift),
      driftX: 0,
      driftY: 0,
    };
  }

  // Goes straight to the canvas, since there can be thousands of petals
  function drawFlower(flower, x, y, scale, alpha = 1) {
    flower.turned += flower.spin * frameTime * 60;
    const across = flower.petalLength * scale;
    if (scale < 0.005 || x < -across || x > p.width + across || y < -across || y > p.height + across) return;
    const context = p.drawingContext;
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.scale(scale, scale);
    context.rotate(flower.turned);
    // The flower the worm goes through is only drawn in outline, in the colour of its petals
    context.strokeStyle = flower.outlined ? flower.petalColour : 'black';
    context.lineWidth = (flower.outlined ? 1.5 : 1) / scale;
    context.fillStyle = flower.petalColour;
    const turn = p.TWO_PI / flower.petals;
    for (let i = 0; i < flower.petals; i++) {
      context.rotate(turn);
      context.beginPath();
      context.ellipse(flower.petalLength / 2, 0, flower.petalLength / 2, flower.petalWidth / 2, 0, 0, p.TWO_PI);
      if (!flower.outlined) context.fill();
      context.stroke();
    }
    context.fillStyle = flower.middleColour;
    context.beginPath();
    context.arc(0, 0, flower.middle / 2, 0, p.TWO_PI);
    context.fill();
    context.stroke();
    context.restore();
  }

  // The flowers fly by in the same way as the stars (see drawStars()), from the same point. They start
  // far away, a steady stream of them, which comes to fieldCount by the time the first have passed.
  function burst() {
    burstStart = seconds;
    for (const flower of segments) {
      if (flower) flower.burstAngle = p.random(p.TWO_PI);
    }
    throwFlowers();
  }

  function throwFlowers() {
    const middle = seenFromBehind(0.5, cameraAt(pathTime));
    for (let i = 0; i < burstExtra; i++) {
      thrownOut.push({
        ...newFlower(),
        fromX: middle.x,
        fromY: middle.y,
        thrownAt: seconds,
        angle: p.random(p.TWO_PI),
        reach: p.random(0.15, 1) * burstReach * p.width,
        speed: p.random(burstExtraSpeed[0], burstExtraSpeed[1]) * p.width,
        size: (p.random(0.4, 1.4) * p.width) / 1200,
      });
    }
  }

  // They fly out with the burst and carry on until they're off the screen, and only then do they go
  function drawThrownOut() {
    if (burstStart === null) thrownOut = [];
    thrownOut = thrownOut.filter((flower) => {
      const since = seconds - flower.thrownAt;
      const distance = flower.reach * (1 - Math.exp(-since * burstOut)) + flower.speed * since;
      const x = flower.fromX + Math.cos(flower.angle) * distance;
      const y = flower.fromY + Math.sin(flower.angle) * distance;
      const across = flower.petalLength * flower.size;
      if (x < -across || x > p.width + across || y < -across || y > p.height + across) return false;
      drawFlower(flower, x, y, flower.size);
      return true;
    });
  }

  // How far the worm's flowers have come back since the burst (from 0 to 1), slowing as they settle
  function burstBack() {
    return 1 - Math.exp((burstStart - seconds) / burstReturn);
  }

  function forwardMotion() {
    return burstStart === null ? 1 : burstBack();
  }

  function newFieldFlower() {
    let x = p.random(-1, 1);
    let y = p.random(-1, 1);
    while (Math.abs(x) < fieldLane && Math.abs(y) < fieldLane) {
      x = p.random(-1, 1);
      y = p.random(-1, 1);
    }
    return { ...newFlower(), x, y, z: calm ? p.random(0.1, 1) : 1 };
  }

  function moveField() {
    const { bloom } = stages[current].settings;
    if (bloom === 0 && now.bloom < 0.01) {
      field = [];
      return;
    }
    if (bloom === 1 && seconds - stageStart > fieldDelay) {
      fieldDue += (fieldCount * fieldSpeed * frameTime * forwardMotion()) / fieldStream;
      for (; fieldDue >= 1; fieldDue--) {
        if (field.length < fieldCount) field.push(newFieldFlower());
      }
    }
    if (!calm) {
      for (const flower of field) {
        flower.z -= flower.z * fieldSpeed * frameTime * forwardMotion();
        flower.driftX += flower.xSpeed * frameTime * 60;
        flower.driftY += flower.ySpeed * frameTime * 60;
      }
      // They keep growing until they're off the screen, and only then do they go
      field = field.filter((flower) => {
        const { x, y, size } = fieldPlace(flower);
        const across = flower.petalLength * size;
        return x > -across && x < p.width + across && y > -across && y < p.height + across;
      });
    }
    field.sort((a, b) => b.z - a.z);
  }

  // Dragging plants them where the pointer is, partway along, to fly by with the rest
  function plantInField(screenX, screenY) {
    if (field.length >= mostFlowers) return;
    const z = p.random(0.5, 1);
    const reach = Math.max(p.width, p.height) * 0.5;
    field.push({ ...newFlower(), x: ((screenX - focus.x) * z) / reach, y: ((screenY - focus.y) * z) / reach, z });
  }

  // Where a flower flying by shows on the screen, and how big
  function fieldPlace(flower) {
    const reach = Math.max(p.width, p.height) * 0.5;
    return {
      x: focus.x + (flower.x * reach) / flower.z + flower.driftX,
      y: focus.y + (flower.y * reach) / flower.z + flower.driftY,
      size: ((fieldSize * p.width * now.bloom) / 1200) / Math.pow(flower.z, fieldGrow),
    };
  }

  function drawField() {
    for (const flower of field) {
      const { x, y, size } = fieldPlace(flower);
      drawFlower(flower, x, y, size, Math.min(1, (1 - flower.z) / fieldFade)); // They fade in in the distance
    }
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
    if (current !== 0) closeWelcome(); // The offer of the camera and sound is only on the first stage
    progress = 0;
    stageStart = seconds;
    ringDistance = null;
    ringWaiting = false;
    burstStart = null;
    // The flowers stage always starts with the worm bursting
    if (stages[current].settings.bloom) burst();
    const { name, hint, settings } = stages[current];
    if (settings.grid) {
      takePicture();
      boilStart = seconds;
    }

    [...marks.children].forEach((mark, i) => {
      if (i === current) mark.setAttribute('aria-current', 'step');
      else mark.removeAttribute('aria-current');
    });
    showCaption(name, hint);
    history.replaceState(null, '', `#${slug(name)}`);
  }

  function closeWelcome() {
    container.querySelector('.flow-welcome').hidden = true;
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

  // Where the worm's path is, this many seconds ago
  function weaveAt(time) {
    return {
      x: (p.noise(time * weaveSpeed) - 0.5) * 2 * weaveWide * p.width,
      y: (p.noise(time * weaveSpeed, 100) - 0.5) * 2 * weaveTall * p.height,
    };
  }

  // Where the camera is at a given time: wherever puts the tail where it's drifted to on the screen
  function cameraAt(time) {
    const tail = weaveAt(time - bodyTime);
    const x = tail.x - (p.noise(time * tailWander, 200) - 0.5) * 2 * tailWide * p.width;
    const y = tail.y - (p.noise(time * tailWander, 300) - 0.5) * 2 * tailTall * p.height;
    if (ringPull < 0.001) return { x, y };
    // As the worm nears the ring, the camera moves into line with it, so that it's in the middle of the screen
    const ring = weaveAt(ringMeets);
    return { x: p.lerp(x, ring.x, ringPull), y: p.lerp(y, ring.y, ringPull) };
  }

  // How high the camera's looking from: as the worm nears the ring it comes down right behind it, looking
  // along it into the middle of the screen
  function screenLevel() {
    return p.height * p.lerp(spaceHorizon, 0.5, ringPull);
  }

  function cameraHeight() {
    return p.height * p.lerp(cameraAbove, ringBehind, ringPull);
  }

  // Keeps what's near the camera on the screen while it's lined up with the ring
  function keepOnScreen(x, y) {
    const wide = p.width * 0.45;
    const tall = p.height * 0.42;
    return {
      x: p.lerp(x, p.width / 2 + wide * Math.tanh((x - p.width / 2) / wide), ringPull),
      y: p.lerp(y, p.height / 2 + tall * Math.tanh((y - p.height / 2) / tall), ringPull),
    };
  }

  // Where a place along the worm shows on the screen, from just above and behind it (along: 0 at the tail, 1 at the head)
  function seenFromBehind(along, camera) {
    const closer = 1 / p.lerp(tailDistance, headDistance, along);
    const place = weaveAt(pathTime - (1 - along) * bodyTime);
    return {
      x: p.width / 2 + (place.x - camera.x) * closer,
      y: screenLevel() + (cameraHeight() - (place.y - camera.y)) * closer,
      closer,
    };
  }

  // Where the ring shows on the screen. It's at a place on the worm's path, so the worm's going to go
  // right through its middle, and it moves with everything else as the camera does.
  function ringPlace(pathTime) {
    const camera = cameraAt(pathTime);
    const place = weaveAt(ringWaiting ? pathTime + ringLead : ringMeets);
    const closer = 1 / ringDistance;
    return {
      x: p.width / 2 + (place.x - camera.x) * closer,
      y: screenLevel() + (cameraHeight() - (place.y - camera.y)) * closer,
      closer,
    };
  }

  // The part of the worm beyond the ring is seen through its middle. It keeps its wobble, but is drawn in
  // as far as it takes to stay inside, which matters most on narrow screens.
  function insideRing(x, y, size, ring) {
    const hole = ringHole(ring);
    const room = Math.max(hole - size / 2, hole * 0.1);
    const gap = Math.hypot(x - ring.x, y - ring.y);
    const keep = gap > 0 ? p.lerp(1, (room * Math.tanh(gap / room)) / gap, ringPull) : 1;
    return { x: ring.x + (x - ring.x) * keep, y: ring.y + (y - ring.y) * keep };
  }

  // How far the worm's got to it, once it's set off (from 0 to 1)
  function ringOpening() {
    return ringWaiting ? 0 : p.constrain((ringWait - ringDistance) / (ringWait - headDistance), 0, 1);
  }

  // The size of the circle in its middle
  function ringHole(ring) {
    return ((p.width / 8) * bodyScale * ringSize * ring.closer * p.lerp(ringSmall, 1, ringOpening())) / 2;
  }

  function bringRing() {
    ringWaiting = false;
    ringMeets = pathTime + ringLead;
  }

  function ringCoversScreen() {
    const ring = ringPlace(pathTime);
    return ringHole(ring) > Math.hypot(Math.max(ring.x, p.width - ring.x), Math.max(ring.y, p.height - ring.y));
  }

  // The flower the worm goes through. It's a flower like any other, with a black middle, which turns into
  // the next stage's ground as the worm gets to it
  function drawRing() {
    const ring = ringPlace(pathTime);
    const ground = stages.find(({ name }) => name === stages[current].through)?.settings.ground ?? 0;
    const shade = Math.round(ground * ringOpening());
    portal.middleColour = `rgb(${shade},${shade},${shade})`;
    drawFlower(portal, ring.x, ring.y, (ringHole(ring) * 2) / portal.middle);
  }

  // Where the place the worm's following was at a given time, in between the frames either side of it
  function steerAt(time) {
    if (!steerTrail.length) return null;
    let low = 0;
    let high = steerTrail.length - 1;
    if (time <= steerTrail[low].time) return steerTrail[low];
    if (time >= steerTrail[high].time) return steerTrail[high];
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (steerTrail[middle].time <= time) low = middle;
      else high = middle;
    }
    const before = steerTrail[low];
    const after = steerTrail[high];
    const between = (time - before.time) / (after.time - before.time);
    return { x: p.lerp(before.x, after.x, between), y: p.lerp(before.y, after.y, between) };
  }

  function drawWorm() {
    moveField();
    drawField();
    drawThrownOut();
    if (ringDistance !== null) drawRing();
    if (now.body < 0.01) return;
    const length = Math.round(now.length);
    const start = Math.max(0, trail.length - length);
    const round = p.width / 8;
    p.rectMode(p.CENTER);
    p.fill(0);
    const wormWeight = p.random(1, 2); // The worms flicker a whole frame at a time, and the wake holds steady
    const white = pointer.down && now.whiteHeld > 0.5;
    const camera = cameraAt(pathTime);

    // From behind, the nearest has to go on top, which means the tail last
    const inSpace = now.space > 0.5;
    for (let n = start; n < trail.length; n++) {
      const i = inSpace ? trail.length - 1 - (n - start) : n;
      const along = (i - start + length - (trail.length - start)) / length; // 0 at the tail, 1 at the head
      const distance = p.lerp(tailDistance, headDistance, along);
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
      let w = size * p.lerp(round, 200 * depth, now.flat);
      let h = size * p.lerp(round, 75 * depth * depth, now.flat);
      let seenX = x;
      let seenY = y;
      if (now.space > 0.01) {
        const seen = seenFromBehind(along, camera);
        // It roughly follows the mouse, each part of it getting to where the head has been, until it's
        // lined up with the ring
        const followed = steerAt(seconds - (1 - along) * bodyTime);
        if (followed) {
          seen.x = p.lerp(seen.x, followed.x, wormFollow * (1 - ringPull));
          seen.y = p.lerp(seen.y, followed.y, wormFollow * (1 - ringPull));
        }
        const sizeInSpace = size * round * bodyScale * seen.closer;
        let inView = keepOnScreen(seen.x, seen.y);
        if (ringDistance !== null && distance > ringDistance) inView = insideRing(seen.x, seen.y, sizeInSpace, ringPlace(pathTime));
        seenX = p.lerp(x, inView.x, now.space);
        seenY = p.lerp(y, inView.y, now.space);
        w = p.lerp(w, sizeInSpace, now.space);
        h = p.lerp(h, sizeInSpace, now.space);
      }
      // Having been through the ring, this part of the worm is a flower
      const isFlower = ringDistance !== null ? distance > ringDistance : stages[current].settings.bloom === 1;
      if (isFlower) {
        const segment = i - start;
        segments[segment] ??= { ...newFlower(), burstAngle: p.random(p.TWO_PI), burstSize: p.random(0.5, 1) };
        const flower = segments[segment];
        // Thrown out quickly, and settling back
        const thrown = burstStart === null ? 0 : (1 - Math.exp((burstStart - seconds) * burstOut)) * (1 - burstBack()) * burstReach * burstApart * p.width * flower.burstSize;
        drawFlower(flower, seenX + Math.cos(flower.burstAngle) * thrown, seenY + Math.sin(flower.burstAngle) * thrown, w / (flower.petalLength * 2));
      } else if (now.box < 0.01) p.ellipse(seenX, seenY, w, h);
      else p.rect(seenX, seenY, w, h, (Math.min(w, h) / 2) * (1 - now.box));
    }
  }

  // Stars streaking past behind the worm, so that it looks like it's flying forward through space. They
  // stream from the point it's heading for.
  function drawStars(dt) {
    if (now.space < 0.02) return;
    if (!stars.length) {
      for (let i = 0; i < starCount; i++) stars.push({ x: p.random(-1, 1), y: p.random(-1, 1), z: p.random(0.05, 1) });
    }
    const reach = Math.max(p.width, p.height) * 0.5;
    for (const star of stars) {
      const fromX = focus.x + (star.x * reach) / star.z;
      const fromY = focus.y + (star.y * reach) / star.z;
      star.z -= starSpeed * dt;
      if (star.z < 0.05) {
        star.x = p.random(-1, 1);
        star.y = p.random(-1, 1);
        star.z = 1;
        continue;
      }
      p.stroke(255, 255 * (1 - star.z) * now.space * (1 - now.bloom));
      p.strokeWeight(1 + (1 - star.z));
      p.line(fromX, fromY, focus.x + (star.x * reach) / star.z, focus.y + (star.y * reach) / star.z);
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

  p.setup = () => {
    canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    p.background(0);
    at = { x: p.width / 2, y: p.height / 2 };
    focus = { ...at };
    steer = { ...at };

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
    container.append(caption, nextLabel, marks);

    const yes = container.querySelector('.flow-yes');
    const no = container.querySelector('.flow-no');
    yes.addEventListener('click', () => {
      closeWelcome();
      startSound();
      startCamera();
    });
    no.addEventListener('click', closeWelcome);
    yes.disabled = no.disabled = false;

    let pressedAt = null;
    canvas.elt.addEventListener('pointerdown', (event) => {
      pointer.down = true;
      pressedAt = { x: event.clientX, y: event.clientY };
    });
    // A click, rather than a drag, brings the flower that's waiting, or sets the worm's flowers bursting again
    canvas.elt.addEventListener('click', (event) => {
      if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >= 6) return;
      if (stages[current].settings.bloom) burst();
      if (ringWaiting) bringRing();
    });
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
    pathTime += dt * p.lerp(1, fieldPace, now.bloom) * forwardMotion();

    // Everything drifts toward the current stage
    const drift = 1 - Math.exp(-dt / morphTime);
    for (const key in now) now[key] += (stages[current].settings[key] - now[key]) * drift;
    if (calm) now.space = 0; // The stars are too much motion for anyone who's asked for less

    const wash = pointer.down ? now.washHeld : p.lerp(now.wash, Math.max(now.wash, ringWash), ringPull * now.space);
    if (wash >= 1) p.background(now.ground, wash);

    const moved = moveWorm(dt);
    steer.x += (at.x - steer.x) * steerFollow;
    steer.y += (at.y - steer.y) * steerFollow;
    steerTrail.push({ x: steer.x, y: steer.y, time: seconds });
    while (steerTrail.length > 2 && seconds - steerTrail[1].time > bodyTime + 1) steerTrail.shift();
    // In space that's where its head is going, and otherwise where the pointer is
    const heading = p.width / 2 + (weaveAt(pathTime).x - cameraAt(pathTime).x) / headDistance;
    const level = screenLevel();
    focus.x += (p.lerp(at.x, heading, now.space) - focus.x) * focusFollow;
    focus.y += (p.lerp(at.y, level, now.space) - focus.y) * focusFollow;
    drawBoil(moved, dt);
    frameTime = dt;
    if (pointer.down && moved > 0 && stages[current].settings.bloom) plantInField(at.x, at.y);
    drawStars(dt);
    drawWorm();

    // Playing moves things along. Left alone, it carries on by itself, unless motion's been turned down
    progress += pointer.travelled / Math.hypot(p.width, p.height) / screensToNext;
    pointer.travelled = 0;
    if (!calm) progress += dt / secondsToNext;
    const { through } = stages[current];
    const usesRing = through && !calm;
    if (progress >= 1 && !usesRing) goTo(current + 1);

    // The flower waits for a click, and going through it leads to the next stage
    if (usesRing && ringDistance === null) {
      ringDistance = ringWait;
      ringWaiting = true;
      portal = newFlower();
      portal.middle = portal.petalLength * 0.6; // Big enough for the worm to go through
      portal.outlined = true;
    }
    if (ringWaiting && seconds - stageStart > ringLongest) bringRing();
    if (ringDistance !== null && !ringWaiting) {
      // As the worm goes along its path, the ring comes along it at just the same speed
      ringDistance = p.lerp(tailDistance, headDistance, 1 - (pathTime - ringMeets) / bodyTime);
      if (ringDistance < ringNearest || ringCoversScreen()) {
        goTo(stages.findIndex(({ name }) => name === through));
        // The next stage has already wiped across, so there's nothing to fade to
        Object.assign(now, { ground: stages[current].settings.ground, wash: stages[current].settings.wash, bloom: stages[current].settings.bloom });
      }
    }
    // The camera comes into line with it slowly as it nears the worm's head, and goes back once it's over
    // Its label's there until the worm gets to it
    nextLabel.style.opacity = ringDistance === null ? 0 : 1 - ringOpening();
    nextLabel.disabled = !ringWaiting;
    const coming = ringDistance === null || ringWaiting ? 0 : p.constrain((ringWait - ringDistance) / (ringWait - headDistance), 0, 1);
    ringPull += (coming * coming * (3 - 2 * coming) - ringPull) * (1 - Math.exp((-dt * forwardMotion()) / (ringDistance === null ? 1.5 : 0.5)));
  };
}
