// Raindrops fall, one into the middle of the screen at the start and then more, anywhere, now and then, and wherever
// one lands a new wormhole grows: rings spreading out from there, over the ones before.
let worms = []; // The wormholes, oldest first (each has its own xLoc and yLoc, and colours)
let drops = []; // The raindrops still falling

let numSegments = 188;
// let wormWidth = 150;
let gap = 40; // How far apart the rings are, in pixels (the biggest is numSegments * gap across)
let centreFade = 4; // How many seconds into a wormhole's life the rings it makes have faded away completely, so that
// its middle goes calm as its rings spread out (0 = no fading)
let centreFadeCurve = 1.5; // How they fade over that time (1 = evenly, more = fading sooner)
let growSpeed = 0.3; // How quickly the rings spread out (1 = a ring's width every frame, as it was; less = slower,
// still smoothly, and just as far apart)
let blendWidth = 1; // How wide a ring has to be to be all the outer colour, as a share of the screen's width (the
// colours blend from the inner one in the middle out to that)

let counter = 0;

let wander = 50; // How far each worm's head wanders from where its drop landed, in pixels

// Colour options: press C to go through them, R to roll the random ones again
let palettes = [
  { name: 'ember and sea', outer: () => color(255, random(50), 0), inner: () => color(0, random(200), random(200, 255)) },
  { name: 'wake', outer: () => color(255, 40, 90), inner: () => color(0, 230, 255) },
  { name: 'moonlight', outer: () => color(20, 40, 120), inner: () => color(255) },
  { name: 'gold leaf', outer: () => color(110, 35, 0), inner: () => color(255, 215, 100) },
  { name: 'acid', outer: () => color(255, 0, 200), inner: () => color(140, 255, 0) },
  { name: 'violet dusk', outer: () => color(40, 0, 90), inner: () => color(255, 140, 60) },
  { name: 'grey', outer: () => color(50), inner: () => color(255) },
  { name: 'deep sea', outer: () => color(0, 20, 60), inner: () => color(0, 255, 190) },
  { name: 'rose', outer: () => color(90, 0, 40), inner: () => color(255, 190, 210) },
  { name: 'forest', outer: () => color(10, 50, 20), inner: () => color(210, 255, 120) },
  { name: 'fire', outer: () => color(120, 0, 0), inner: () => color(255, 240, 80) },
  { name: 'ice', outer: () => color(200, 240, 255), inner: () => color(0, 90, 255) },
  { name: 'neon', outer: () => color(0, 80, 255), inner: () => color(255, 0, 90) },
  { name: 'copper', outer: () => color(0, 110, 100), inner: () => color(230, 120, 50) },
  { name: 'lavender', outer: () => color(70, 50, 140), inner: () => color(220, 200, 255) },
  { name: 'sunset', outer: () => color(60, 0, 120), inner: () => color(255, 180, 0) },
  { name: 'cream on black', outer: () => color(20), inner: () => color(246, 236, 210) },
  { name: 'random warm', outer: () => color(random(150, 255), random(60), random(40)), inner: () => color(255, random(150, 255), random(100)) },
  { name: 'random cool', outer: () => color(random(40), random(60, 160), random(150, 255)), inner: () => color(random(150, 255), random(200, 255), 255) },
  { name: 'random', outer: () => color(random(255), random(255), random(255)), inner: () => color(random(255), random(255), random(255)) },
];
let palette = 0; // Which one it starts with
let mix = 0.5; // How often a new wormhole picks a palette of its own, at random, instead of the one chosen (0 = never,
// 1 = always). Press M to go through none, half and all.
let flipChance = 0.25; // ...and how often it has the palette the other way round, inside out (0 = never, 1 = always)

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(sharp ? displayDensity() : 1); // Standard resolution is a quarter of the pixels on a Retina screen
  dropRain(width / 2, lerp(dropTop, dropBottom, 0.5) * height); // The first one, into the middle of where they land
  //noLoop();
}

let colourRandomness = 40; // How far each worm's colours can be nudged from the palette's (0 = exactly), so no two are quite alike
let shimmer = 0.01; // How much each ring's colour flickers from frame to frame, along the blend (0 = steady)

// A worm's colours: the biggest rings' (outer) and the smallest's (inner)
function pickColours(worm) {
  // Some of the time its own palette, at random, otherwise the one chosen, and now and then the other way round
  let chosen = random() < mix ? random(palettes) : palettes[palette];
  let flip = mix > 0 && random() < flipChance;
  let outer = nudge(chosen.outer());
  let inner = nudge(chosen.inner());
  worm.outer = flip ? inner : outer;
  worm.inner = flip ? outer : inner;
  // In black and white, now and then a tinted wormhole (see tints)
  worm.tint = random() < tintChance ? random(tints) : null;
  // ...and its greys in black and white: dark in the middle, lighter out to the edge
  worm.middleGrey = random(...middleGreys);
  worm.edgeGrey = random(...edgeGreys);
}

// A colour moved a little, at random, in red, green and blue
function nudge(c) {
  let n = () => random(-colourRandomness, colourRandomness);
  return color(constrain(red(c) + n(), 0, 255), constrain(green(c) + n(), 0, 255), constrain(blue(c) + n(), 0, 255));
}

function keyPressed() {
  if (key === 'm' || key === 'M') mix = mix === 0 ? 0.5 : mix === 0.5 ? 1 : 0; // New ones from then on
  if (key === 'c' || key === 'C') palette = (palette + 1) % palettes.length;
  if (key === 'c' || key === 'C' || key === 'r' || key === 'R') [...worms, ...drops].forEach(pickColours);
  if (key === 'd' || key === 'D') dropRain();
  if (key === 'b' || key === 'B') blackAndWhite = !blackAndWhite;
  // The camera's angle: up looks down at the water more steeply (the horizon goes further above the screen), down
  // looks out toward the horizon more
  if (keyCode === UP_ARROW) horizon = Math.round((horizon - 0.1) * 10) / 10;
  if (keyCode === DOWN_ARROW) horizon = Math.min(0, Math.round((horizon + 0.1) * 10) / 10);
}

// The raindrops: little circles, falling from the top of the screen, faster and faster. Where each lands, a new
// wormhole starts. Press D to drop one now.
let dropTime = 1.2; // How many seconds one takes to fall
let dropSize = 7; // How wide it is, in pixels
let dropLine = 1.2; // How thick its outline is, in pixels
let dropLength = 1.6; // How long the teardrop is, compared to how wide
let dropStretch = 0.5; // How much longer it gets as it speeds up, from 0 to 1
let dropEvery = [0.8, 1.2]; // How many seconds between drops, at the least and most
let dropMargin = 0.15; // How far in from the edges of the screen they land, as a share of it
let dropTop = 1 / 3; // The highest they land, as a share of the way down the screen...
let dropBottom = 2 / 3; // ...and the lowest (a third to two thirds = the middle third)
let mostWorms = 10; // The most wormholes there are at once (the oldest goes, if there'd be more)
let leaveTime = 1.5; // How many seconds the oldest takes to fade away when it goes
let nextDrop = 0; // When the next one falls, in seconds

function draw() {
  background(0);
  let seconds = millis() / 1000;

  if (seconds > nextDrop) dropRain();

  // The wormholes, oldest first, so that each new one opens over the ones before
  worms = worms.filter((w) => w.leaving === undefined || seconds - w.leaving < leaveTime); // Gone, once faded away
  for (let worm of worms) moveWorm(worm);
  drawWorms();
  // Once one's grown all the way out, its biggest rings cover the screen, so the ones under it can go
  for (let n = worms.length - 1; n > 0; n--) {
    if (worms[n].xLoc[0] !== undefined) {
      worms.splice(0, n);
      break;
    }
  }

  drawSplashes(seconds);

  // The drops, falling, and starting a wormhole where they land
  for (let drop of [...drops]) {
    let t = (seconds - drop.start) / dropTime;
    if (t >= 1) {
      drops.splice(drops.indexOf(drop), 1);
      splash(drop, seconds);
      // With the drop's colours, which were picked when it fell, so its middle is the drop's colour
      let worm = { home: drop.at, offset: random(1000), xLoc: [], yLoc: [], inner: drop.inner, outer: drop.outer, tint: drop.tint, middleGrey: drop.middleGrey, edgeGrey: drop.edgeGrey, inColour: drop.inColour, landing: drop.landing, born: seconds };
      worms.push(worm);
      // If there are too many, the oldest that isn't already going fades away (see leaveTime)
      let staying = worms.filter((w) => w.leaving === undefined);
      if (staying.length > mostWorms) staying[0].leaving = seconds;
      continue;
    }
    drawDrop(drop, t);
  }

  counter+=0.01

  // Which colours these are
  noStroke();
  fill(255, 120);
  textSize(12);
  text((blackAndWhite ? 'black and white, from ' : '') + palettes[palette].name + (mix === 1 ? ', all mixed' : mix > 0 ? ', half mixed' : '') + '   (B: black and white or colour, M: none, half or all mixed, C: next colours, R: roll again, D: drop one now)', 16, height - 16);
  // How it's coping: frames a second (60 is smooth), how many wormholes there are, and how many rings were drawn
  if (frameCount % 15 === 0) speed = `${round(frameRate())} fps   ${worms.length} wormholes   ${ringsDrawn} rings drawn   camera: horizon ${horizon} (up and down arrows)`;
  text(speed, 16, 24);
}

// A raindrop, to land at (x, y), or anywhere if that's not given
// inColour: whether it's in colour even when the rest is black and white (as the ones dropped by clicking are)
function dropRain(x, y, inColour = false) {
  let at = {
    x: x ?? random(dropMargin, 1 - dropMargin) * width,
    y: y ?? random(dropTop, dropBottom) * height,
  };
  let drop = { at, start: millis() / 1000, inColour };
  pickColours(drop); // Its wormhole's colours: the drop's the inner one, the colour of the wormhole's middle
  if (inColour) {
    // In the landing page's colours (see landingColour), so its middle, and the drop, are the wake's cyan
    drop.landing = true;
    drop.inner = color(0, (landingLow + 255) / 2, 255);
    drop.outer = drop.inner;
  }
  drops.push(drop);
  if (!inColour) nextDrop = millis() / 1000 + random(...dropEvery); // Clicking doesn't hold up the rain
}

// The landing page's colours, as the wake on the front page has them over a ring's life: cyan when it's new, through
// red and magenta in the middle of its life, and back to cyan, shimmering. Here from the middle of a wormhole (s = 0)
// to its edge (s = 1).
let landingLow = 150; // The least each colour shimmers down to (the wake's `low`)
function landingColour(s) {
  let along = 1 - s; // The middle's newest, as the wake's newest rings are
  let sine = Math.abs(Math.sin(along * Math.PI));
  let cosine = Math.abs(Math.cos(along * Math.PI));
  return color(random(landingLow, 255) * sine, random(landingLow, 255) * cosine, 255 - random(100, 255) * sine);
}

// Clicking drops a raindrop in colour, where it's clicked
function mousePressed() {
  dropRain(mouseX, mouseY, true);
}

// Each worm's trail moves on one place: its head goes where it's wandered to, and every ring moves one place down
// (It moves on a place only every so often, at growSpeed, and in between the rings grow smoothly: see ringSize.)
function moveWorm(worm){
  let { xLoc, yLoc } = worm;
   let head = headAt(worm)
   xLoc[numSegments-1] = head.x
   yLoc[numSegments-1] = head.y
  worm.phase = (worm.phase ?? 0) + growSpeed;
  while (worm.phase >= 1) {
    worm.phase -= 1;
    worm.made = (worm.made ?? 0) + 1; // How many rings it has made
    for(let i = 0; i < numSegments-1; i++){
      xLoc[i] = xLoc[i+1];
      yLoc[i] = yLoc[i+1];
    }
  }
}

// How big ring i of a worm is (i = 0 is the oldest and biggest)
// phase: how far the worm is toward moving on its next place (0 to 1), so the rings grow smoothly in between
function ringSize(i, phase = 0) {
    // let s = cos(map(i,0,numSegments-1, 0,HALF_PI))
    // let d = wormWidth*s

    // Evenly spaced, gap apart
    let d = (numSegments - 1 - i + phase) * gap
    // For the colour: from 0 (the inner colour) at the middle to 1 (the outer colour) at blendWidth across, and the
    // outer colour from there out. Over all the rings, most of the blend was on ones too big to be seen.
    let s = Math.min(1, d / (blendWidth * width))
    return { d, s };
}

// All the wormholes' rings, drawn from the oldest worm's biggest ring to the newest's smallest, each filled black, so
// that each hides what's behind it. Only what can be seen is drawn: going the other way, from the newest's smallest
// ring outward, it stops at the first ring that covers the whole screen, since everything before that is hidden behind
// it (and it's black itself, like the background), and it leaves out any ring that's off the screen altogether.
function drawWorms() {
  let seen = [];
  let seconds = millis() / 1000;
  findSeen: for (let w = worms.length - 1; w >= 0; w--) {
    let worm = worms[w];
    let leaving = worm.leaving !== undefined ? constrain(1 - (seconds - worm.leaving) / leaveTime, 0, 1) : 1;
    let calmDrawn = false; // Has its calm middle been filled in?
    for (let i = numSegments - 2; i >= 0; i--) {
      if (worm.xLoc[i] === undefined) continue; // The worm's still growing
      // Fainter the later in its life it was made, so the middle goes calm as the rings spread, and fading away
      // altogether if the worm's going
      let madeAt = ((worm.made ?? 0) - (numSegments - 1 - i)) / (growSpeed * 60); // Seconds into the worm's life
      let strength = centreFade > 0 ? Math.pow(constrain(1 - madeAt / centreFade, 0, 1), centreFadeCurve) : 1;
      strength *= leaving;
      // The faded rings in the calm middle can't be seen, so only the biggest of them is drawn, as just a black fill,
      // which hides what's behind the middle (going out from the smallest, it's the last before they show)
      let calm = strength <= 0.003;
      if (calm && i > 0 && worm.xLoc[i - 1] !== undefined && !calmDrawn) {
        let madeNext = ((worm.made ?? 0) - (numSegments - i)) / (growSpeed * 60);
        if (centreFade > 0 && madeNext >= centreFade && leaving > 0) continue; // A bigger one's still calm too
      }
      if (calm && calmDrawn) continue;
      let { d, s } = ringSize(i, worm.phase);
      let ringSeed = worm.offset + ((worm.made ?? 0) - (numSegments - 1 - i)) * 0.37; // The same all its life
      let shape = ringShape(worm.xLoc[i], worm.yLoc[i], d, splashLift(worm, d, worm.yLoc[i]), ringSeed);
      if (!shape) continue;
      if (shape.covers) break findSeen;
      if (calm) calmDrawn = true;
      if (shape.offScreen) continue;
      seen.push({ shape, worm, i, s, strength, calm });
    }
  }
  for (let n = seen.length - 1; n >= 0; n--) {
    let { shape, worm, i, s, strength, calm } = seen[n];
    let c1 = worm.inner; // As it was: the blend goes from c2 for the biggest rings to c1 for the smallest
    let c2 = worm.outer;
   let c = calm ? null : worm.landing ? landingColour(s) : lerpColor(c1, c2, constrain(s + random(-shimmer, shimmer), 0, 1))
    let weight = map(i, 0, numSegments,3,0.2)
    drawRing(shape, c, weight, worm, s, strength);
  }
  ringsDrawn = seen.length;
}
let ringsDrawn = 0;
let speed = '';


// Where a worm's head is now, wandering round where its drop landed (noise is 0.5 on average, so this is there on
// average). Each worm has its own offset, so they wander their own ways.
function headAt(worm) {
  return {
    x: worm.home.x + (noise(counter + worm.offset) - 0.5) * 2 * wander,
    y: worm.home.y + (noise(counter + worm.offset + 50) - 0.5) * 2 * wander,
  }
}

// A raindrop, this far through falling (t, from 0 to 1): a circle, speeding up, as things fall
function drawDrop(drop, t) {
  let fall = t * t;
  let y = lerp(-dropSize, drop.at.y, fall);
  let g = drawingContext; // Straight onto the canvas, like the rings
  // Filled black, like the rings, so it hides what it passes over, with its outline in just the colour the middle of
  // its wormhole will be, where it lands: made brighter, faded toward the horizon and glowing toward the front, as the
  // rings' lines are there (see drawRing)
  // A teardrop: pointed at the top and round at the bottom, stretching a little as it speeds up. Its bottom is at y.
  let x = drop.at.x;
  let r = dropSize / 2;
  let h = dropSize * dropLength * (1 + dropStretch * t);
  y += r; // So its round bottom lands where the circle's middle did
  g.beginPath();
  g.moveTo(x, y - h);
  g.bezierCurveTo(x + r * 0.2, y - h * 0.6, x + r, y - r * 1.4, x + r, y - r);
  g.bezierCurveTo(x + r, y - r * 0.45, x + r * 0.55, y, x, y);
  g.bezierCurveTo(x - r * 0.55, y, x - r, y - r * 0.45, x - r, y - r);
  g.bezierCurveTo(x - r, y - r * 1.4, x - r * 0.2, y - h * 0.6, x, y - h);
  g.closePath();
  g.lineJoin = 'round';
  g.fillStyle = 'black';
  g.fill();
  g.strokeStyle = seenColour(drop.inner, drop.at.y, drop, 0); // As the middle, where s is 0
  g.lineWidth = dropLine;
  g.stroke();
}

// The colour a ring's line of this colour is seen as, this far down the screen: the same as the gradient in drawRing
function seenColour(colour, y, who, s) {
  let top = horizon * height;
  let below = height - top;
  let [r, gr, b] = shown(colour, who, s);
  let gone = top + below * fadeGone;
  let full = Math.min(1, (below * (fadeFull - fadeGone)) / (height - gone));
  let t = constrain((y - gone) / (height - gone), 0, 1); // How far along the gradient it is
  if (t < full) return `rgba(${Math.round(r)},${Math.round(gr)},${Math.round(b)},${Math.pow(t / full, fadeCurve)})`;
  let glow = frontGlow * ((t - full) / (1 - full || 1));
  let mix = (v) => Math.round(v + (255 - v) * glow);
  return `rgb(${mix(r)},${mix(gr)},${mix(b)})`;
}

// The pond's perspective: the rings lie flat on the water, which goes off to a horizon at the top of the screen.
// Further up is further away, so things there look smaller and flatter, and a big ring's near side is lower and
// wider than its far side, which bunches up toward the horizon.
let flatness = 0.375; // How much flatter than round a small ring is at the bottom of the screen (the pond's is 0.375)
let horizon = -0.5; // Where the horizon is, as a share of the screen's height down from its top. 0 is the top edge, as
// in the pond, which leaves the top of the screen empty, as the rings bunch up toward it without ever getting there.
// Less than 0 is above the screen, as if looking down at the water more, so that the rings can reach the top edge.
let ripplePoints = 72; // How many points the biggest rings are drawn with (more = smoother). Smaller ones get fewer.
let pointSpacing = 8; // Roughly how far apart a ring's points are, in pixels across (smaller = smoother, but slower)
let sharp = true; // Whether it's drawn at the screen's full resolution (sharper on a Retina screen, but much slower)
// The lines fade as they go off toward the horizon. How near something is goes from 0 at the horizon to 1 at the
// bottom of the screen (with the horizon at -0.5, the top of the screen is a third).
let fadeGone = 0.05; // How near the lines are when they've faded away completely
let fadeFull = 0.55; // ...and when they're at their full colour
let fadeCurve = 1; // How it fades in between (1 = evenly, more = staying faint longer before coming up)
let brightness = 1.4; // How much brighter every ring's colour is made, before it fades (1 = as the palette has it)
let blackAndWhite = true; // Whether it's all in greys: each colour as the grey of how bright it is (press B to switch)
let tintChance = 0; // In black and white, how many wormholes are tinted, from 0 to 1
let tints = [[1, 0.35, 0.3]]; // The tints: red (how much of each of red, green and blue is kept). Blue was [0.45, 0.65, 1].
let tintStrength = 0.8; // How strongly they're tinted in the middle, from 0 (grey) to 1
let tintFade = 1; // How quickly the tint fades going out from the middle (1 = evenly, more = only right in the middle)
let middleGreys = [30, 70]; // How light the middle of a wormhole is in black and white, at the least and most (0 to 255)
let edgeGreys = [160, 230]; // ...and its edge (they're made brighter by brightness too)

// A ring's colour as it's shown, before it fades: made brighter, and grey if it's in black and white. Gives [r, g, b].
// who: the wormhole (or its drop), for its greys and tint. s: how far out the ring is, from 0 in the middle to 1 at
// the edge (blendWidth across).
function shown(colour, who, s) {
  let rgb = [red(colour), green(colour), blue(colour)];
  if (blackAndWhite && !who.inColour) {
    // Its own greys, dark in the middle and lighter going out, and if it's tinted, the tint strongest in the middle,
    // fading out to grey toward the edge
    let grey = lerp(who.middleGrey, who.edgeGrey, s);
    let strength = who.tint ? tintStrength * Math.pow(1 - s, tintFade) : 0;
    let tint = who.tint ?? [1, 1, 1];
    rgb = tint.map((t) => grey * (1 - strength + strength * t));
  }
  return rgb.map((v) => Math.min(255, v * brightness));
}
let frontGlow = 0.5; // How much brighter they get from there to the front, at the bottom of the screen, mixing toward
// white (0 = no brighter, 1 = white at the very front)

// A ring on the water, centred where (x, y) is on the screen, as wide across as diameter would be at that depth,
// filled black, with a line of this colour and weight. It's drawn straight onto the canvas (drawingContext) rather
// than with beginShape() and vertex(), which are far too slow for this many points every frame.
//
// It's worked out in two steps: where the ring's outline goes on the screen (ringShape), then drawing it (drawRing).
// The splash: as a drop lands, the water in the middle rises a little and falls back, the smallest rings lifting the
// most and the bigger ones less and less, as a little dome. How far up a ring of this size is lifted, in pixels.
// Little splashes: as a drop lands, a crown of droplets is thrown out, each arcing up and falling back onto the water
// a little way off, where it makes a tiny ripple of its own. All of it's in the pond's perspective, so it's bigger
// and goes further nearer the front.
let droplets = []; // The droplets in the air
let littleRipples = []; // ...and the ripples they've made
let splashCount = [0, 0]; // How many droplets each drop throws out, at the least and most (0 = none; it was [6, 11])
let splashReach = [25, 70]; // How far out they land, in pixels across, at the bottom of the screen
let splashUp = [15, 45]; // How high they go, in pixels, at the bottom of the screen
let splashFlight = [0.35, 0.7]; // How many seconds they're in the air
let splashDropletSize = [1.5, 3.5]; // How big they are, in pixels, at the bottom of the screen
let littleRippleSize = [12, 30]; // How wide their ripples get, in pixels across, at the bottom of the screen
let littleRippleTime = 0.9; // How many seconds their ripples take to spread and fade

// How near (x, y) on the screen is, from 0 at the horizon to 1 at the bottom, and how much flatter than round a small
// ring there is (the same as ringShape works out)
function nearness(y) {
  let top = horizon * height;
  let near = Math.max(0.01, (y - top) / (height - top));
  return { near, flat: flatness * near };
}

function splash(drop, seconds) {
  let { near, flat } = nearness(drop.at.y);
  let colour = seenColour(drop.inner, drop.at.y, drop, 0);
  let count = Math.round(random(...splashCount));
  for (let k = 0; k < count; k++) {
    let angle = (k / count) * Math.PI * 2 + random(-0.3, 0.3); // All the way round, a little uneven
    let reach = random(...splashReach) * near;
    droplets.push({
      from: { x: drop.at.x, y: drop.at.y },
      to: { x: drop.at.x + Math.cos(angle) * reach, y: drop.at.y + Math.sin(angle) * reach * flat },
      up: random(...splashUp) * near,
      size: random(...splashDropletSize) * near,
      start: seconds,
      flight: random(...splashFlight),
      colour,
    });
  }
}

function drawSplashes(seconds) {
  let g = drawingContext;
  // The ripples where droplets came down, spreading and fading
  littleRipples = littleRipples.filter((r) => seconds - r.start < littleRippleTime);
  for (let r of littleRipples) {
    let t = (seconds - r.start) / littleRippleTime;
    let { flat } = nearness(r.y);
    let w = r.size * Math.sqrt(t);
    g.globalAlpha = 1 - t;
    g.beginPath();
    g.ellipse(r.x, r.y, w / 2, (w / 2) * flat, 0, 0, Math.PI * 2);
    g.strokeStyle = r.colour;
    g.lineWidth = 1;
    g.stroke();
  }
  // The droplets, flying up and out and back down, and making a ripple where they land
  for (let d of [...droplets]) {
    let t = (seconds - d.start) / d.flight;
    if (t >= 1) {
      droplets.splice(droplets.indexOf(d), 1);
      littleRipples.push({ x: d.to.x, y: d.to.y, size: random(...littleRippleSize) * nearness(d.to.y).near, start: seconds, colour: d.colour });
      continue;
    }
    let x = lerp(d.from.x, d.to.x, t);
    let y = lerp(d.from.y, d.to.y, t) - d.up * 4 * t * (1 - t); // Up and back down, as things thrown do
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(x, y, d.size, 0, Math.PI * 2);
    g.fillStyle = d.colour;
    g.fill();
  }
  g.globalAlpha = 1;
}

let splashTime = 0.5; // How many seconds it rises and falls back in
let splashHeight = 40; // How high the middle rises, in pixels, at the bottom of the screen (less further away)
let splashWidth = 60; // How wide the rise is, in pixels across (bigger = more of the rings lift)
function splashLift(worm, diameter, y) {
  let age = millis() / 1000 - (worm.born ?? -Infinity);
  if (age > splashTime) return 0;
  let top = horizon * height;
  let near = Math.max(0, (y - top) / (height - top)); // Smaller further away
  let rise = Math.sin((Math.PI * age) / splashTime); // Up and back down
  return splashHeight * near * rise * Math.exp(-diameter / splashWidth);
}

// Noise on the rings: each is pushed in and out round its edge, its own way, more and more as it spreads, so the new
// rings in the middle are nearly round and they get wavier going out. (It's a few waves round each ring rather than
// Perlin noise, which is too slow for this many rings.)
let ringNoise = 0.012; // How much a ring's pushed in and out, as a share of how big it is
let ringNoiseMost = 80; // ...but never more than this, in pixels across
let ringNoiseBumps = [3, 9]; // How many bumps round a ring, at the least and most
let ringNoiseDrift = 0.4; // How quickly the bumps move round (0 = each ring keeps its shape)

function ringShape(x, y, diameter, lift = 0, seed = 0) {
  if (diameter <= 0) return null;
  // Where (x, y) is on the water: how far away (z), and how far to the side
  let top = horizon * height; // Where the horizon is on the screen
  let below = height - top; // How far the bottom of the screen is below it
  let depth = Math.max(0.01, (y - top) / below); // 0 at the horizon, 1 at the bottom of the screen
  let z = 1 / depth;
  let across = below / flatness; // How wide 1 on the water is on the screen, at the bottom
  let side = (x - width / 2) / (across * depth);
  let radius = diameter / 2 / (across * depth); // How big the ring is on the water
  // The noise: how far its points are pushed in and out, in pixels across, more the bigger it is
  let churn = Math.min(ringNoise * diameter, ringNoiseMost);
  if (churn < 0.3) churn = 0; // Too little to see
  let churnOnWater = churn / (across * depth); // ...on the water
  // Its own waves round it, from its seed: three of them, with their own numbers of bumps, sizes and starting places
  let waves = [];
  if (churn > 0) {
    let hash = (k) => { let v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let k = 0; k < 3; k++) {
      waves.push({
        bumps: Math.round(lerp(ringNoiseBumps[0], ringNoiseBumps[1], hash(k))),
        size: (0.5 + hash(k + 3)) / 3,
        phase: hash(k + 6) * Math.PI * 2 + counter * ringNoiseDrift * (hash(k + 9) - 0.5) * 2,
      });
    }
  }
  let points = Math.max(churn > 0.5 ? 32 : 12, Math.min(ripplePoints, Math.round(diameter / pointSpacing)));

  let xs = new Float32Array(points);
  let ys = new Float32Array(points);
  let left = Infinity, right = -Infinity, high = Infinity, low = -Infinity;
  for (let n = 0; n < points; n++) {
    let angle = (n / points) * Math.PI * 2;
    // Pushed in and out by its waves
    let r = radius;
    for (let wave of waves) r += churnOnWater * wave.size * Math.sin(wave.bumps * angle + wave.phase);
    let pz = Math.max(0.05, z + Math.sin(angle) * r); // Not behind the camera
    let px = side + Math.cos(angle) * r;
    xs[n] = width / 2 + (px * across) / pz;
    ys[n] = top + below / pz - lift; // Raised by the splash, if it's there
    left = Math.min(left, xs[n]);
    right = Math.max(right, xs[n]);
    high = Math.min(high, ys[n]);
    low = Math.max(low, ys[n]);
  }
  let offScreen = right < 0 || left > width || low < 0 || high > height;
  // It covers the screen if all four corners are inside it (it's a rounded shape with no dents, so then all of it is)
  let inside = (cx, cy) => {
    let yes = false;
    for (let n = 0, m = points - 1; n < points; m = n++) {
      if (ys[n] > cy !== ys[m] > cy && cx < ((xs[m] - xs[n]) * (cy - ys[n])) / (ys[m] - ys[n]) + xs[n]) yes = !yes;
    }
    return yes;
  };
  let covers = !offScreen && inside(0, 0) && inside(width, 0) && inside(0, height) && inside(width, height);
  return { xs, ys, top, below, offScreen, covers };
}

function drawRing(shape, colour, weight, who, s, strength = 1) {
  let { xs, ys, top, below } = shape;
  let g = drawingContext;
  g.beginPath();
  for (let n = 0; n < xs.length; n++) g.lineTo(xs[n], ys[n]);
  g.closePath();
  g.fillStyle = 'black';
  g.fill();
  if (!colour || strength <= 0.003) return; // A calm middle: just the fill
  let [r, gr, b] = shown(colour, who, s).map(Math.round);
  g.strokeStyle = fadeFor(r, gr, b, strength, top, below);
  g.lineWidth = weight;
  g.stroke();
}

// The gradient a line of this colour and strength is drawn with: fading toward the horizon (up and down the screen
// is nearer and further, so a gradient from top to bottom does it), from gone, far off, to its colour, and on to
// brighter at the front. They're kept and used again, since making one for every ring every frame is slow; colours
// and strengths are rounded a little so that rings can share them.
let fades = new Map();
function fadeFor(r, gr, b, strength, top, below) {
  r = Math.round(r / 4) * 4;
  gr = Math.round(gr / 4) * 4;
  b = Math.round(b / 4) * 4;
  strength = Math.round(strength * 32) / 32;
  let key = `${r},${gr},${b},${strength},${height},${horizon}`;
  let fade = fades.get(key);
  if (fade) return fade;
  if (fades.size > 4000) fades.clear(); // Not keeping them for ever
  let g = drawingContext;
  let gone = top + below * fadeGone;
  let full = Math.min(1, (below * (fadeFull - fadeGone)) / (height - gone)); // Where it's at its colour, along the gradient
  fade = g.createLinearGradient(0, gone, 0, height);
  for (let k = 0; k <= 4; k++) {
    fade.addColorStop((k / 4) * full, `rgba(${r},${gr},${b},${strength * Math.pow(k / 4, fadeCurve)})`);
  }
  for (let k = 1; k <= 3; k++) {
    let glow = frontGlow * (k / 3);
    let mix = (v) => Math.min(255, Math.round(v + (255 - v) * glow));
    fade.addColorStop(full + (1 - full) * (k / 3), `rgba(${mix(r)},${mix(gr)},${mix(b)},${strength})`);
  }
  fades.set(key, fade);
  return fade;
}
