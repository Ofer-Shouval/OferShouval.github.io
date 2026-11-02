// Water class
// The water, drawn as a series of wavy horizontal lines that get closer together toward the
// top of the screen, which gives a sense of perspective: it stretches away into the distance.
//
// Each line is a fixed fraction (this.ratio) of the way up from the one below it, so the gaps
// shrink steadily as they go up, like a real surface seen at a low angle. The waves are Perlin
// noise, smaller and fainter in the distance. As the boat sails forward the lines roll toward
// the camera. The wake pushes them aside where it passes (see Wake.pushAt()), and the boat
// drags them along as it sails across them; they spring back afterwards (see pull()). Wherever
// the boat pulls a line, ripples run outward along it both ways (see rippleAt()), further the
// faster the boat's going, and tall enough to throw it across its neighbours. Under the wake,
// the lines are only black or flickers of white.
//
// The points along each line are fixed to the water, not the screen (every `step` pixels of
// water), so a bit of line that's been dragged stays dragged as it scrolls past.

import p5 from 'p5';
import { grey } from './color.js';
import { depth } from './perspective.js';

export default class Water {
  constructor() {
    this.ratio = 0.95; // Each line is this much as far down the screen as the one below it (smaller = bunch up faster)
    this.waveScale = 0.01; // How long the waves are (smaller = longer waves)
    this.waveSpeed = 0.01; // How quickly the waves change
    this.waveHeight = 10; // How tall the waves are, in pixels, near the bottom of the screen
    this.drift = 0.003; // How fast the lines drift toward the bottom of the screen on their own, in gaps per frame
    this.alpha = 200; // How bright the lines are, near the bottom of the screen (255 = solid)
    this.distanceFade = 0.8; // How quickly they fade toward the horizon (smaller = slower)
    this.step = 10; // Pixels between the points along each line
    this.distantBelow = 0.25; // Lines nearer the horizon than this (0 to 1) only need every other point
    this.top = 40; // No lines higher than this up the screen
    this.thinnerBehind = 0.8; // How thick the lines behind the boat are, compared to if they kept growing toward the camera
    this.band = 0.45; // How far a line can move toward its neighbours (0.5 = halfway, so under that they never cross)
    this.pullStrength = 2.5; // How hard the boat drags the lines along with it
    this.maxPull = 500; // Furthest (in pixels) a bit of line can be dragged
    this.springBack = 0.97; // How quickly dragged lines settle back (smaller = faster)
    this.bowPush = 1.5; // How hard the front of the boat pushes the lines just ahead of it forward

    // Ripples that run along a line, outward both ways from where the boat pulled it
    this.rippleSpeed = 5; // Pixels per frame
    this.rippleWavelength = 90; // Pixels from one crest to the next
    this.rippleLength = 220; // How long each run of ripples is, in pixels
    this.rippleHeight = 22; // How tall, in pixels, near the bottom of the screen
    this.rippleHeadStart = 10; // How far along its length a ripple already is when it starts, so the waves are at full height close to the boat
    this.rippleLife = 120; // How many frames until they've died away, with the boat at its usual top speed (faster goes further)
    this.rippleEvery = 4; // While the boat keeps pulling a line, a new ripple this often (frames)
    this.rippleVariety = 0.18; // How different each line's ripples are from its neighbours' (0 = all the same)
    this.rippleChop = 0.2; // How tall the smaller, faster waves on top of the ripples are, compared to the ripples
    this.rippleGusts = 0.012; // How long the stretches of bigger and smaller ripples are (smaller = longer)
    this.rippleRoom = 0.7; // How far ripples can lift a line, in gaps between lines (over 0.5, they cross its neighbours)
    this.ripples = []; // { line, x (on the water), born (frameCount), strength (0 to 1), life }
    this.lastRipple = new Map(); // Line number -> when it last sent out a ripple

    // Under the wake, short segments of the lines flicker on in white
    this.segmentLengths = [1, 2, 4, 8]; // How many points are in a segment, from right behind the boat to the far end of the wake
    this.flickerEvery = 24; // How many frames a segment holds before it can change (bigger = calmer)
    this.whiteNear = 0; // How likely a segment is to be on, right behind the boat
    this.whiteFar = 0; // ...and at the far end of the wake
    this.ragged = 700; // The furthest (in pixels) a line reaches into the dark water from either side, at the far end of the wake

    // How far each point of each line has been dragged by the boat. Keyed by line and point
    // number (see key()), so it sticks to the water; points that haven't been dragged (or have
    // settled back) aren't in it at all.
    this.dragged = new Map();

    // How far the boat has sailed, so the lines and waves move with the water:
    // forward is counted in lines, sideways in pixels
    this.travelled = 0;
    this.travelledX = 0;
  }

  // scroll: how far the world slides back this frame (see Boat)
  // boatY: how far down the screen the boat is
  update(scroll, boatY) {
    // Sailing forward (up the screen) brings the lines toward us (down the screen). They're
    // spaced in perspective, so move them by however many gaps the scroll is at the boat
    this.travelled -= scroll.y / (boatY * (1 - this.ratio));
    // ...and they drift slowly toward the camera on their own, as if the water's flowing
    this.travelled += this.drift;
    this.travelledX += scroll.x;
  }

  // Drag the bits of line near the boat along in the direction it's moving, and let
  // everything that's been dragged before spring back a little
  pull(boat) {
    for (let [key, offset] of this.dragged) {
      offset.x *= this.springBack;
      offset.y *= this.springBack;
      if (offset.x * offset.x + offset.y * offset.y < 0.01) this.dragged.delete(key);
    }
    this.ripples = this.ripples.filter((r) => frameCount - r.born < r.life);
    let speed = boat.velocity.mag();
    if (speed < 0.1) {
      this.lastRipple.clear();
      return;
    }

    // Where the boat sits on the water, and how far around it reaches: across the screen,
    // about half its length; up and down, much less, since the water's seen at a low angle
    let bx = boat.position.x;
    let by = boat.waterY();
    let reachX = boat.length * 0.5;
    let reachY = boat.length * 0.2;
    let pulledLines = this.drag(bx, by, reachX, reachY, boat.velocity.x * this.pullStrength, boat.velocity.y * this.pullStrength);

    // A bow wave: the lines just in front of the boat get pushed forward, ahead of it
    let strength = this.bowPush * Math.min(1, speed / boat.maxspeed);
    let fx = boat.velocity.x / speed;
    let fy = boat.velocity.y / speed;
    this.drag(boat.bow.x + fx * reachX * 0.3, boat.bow.y + fy * reachY * 0.3, reachX * 0.6, reachY * 0.6, fx * strength, fy * strength);

    // Send ripples out along the lines being pulled: straight away when the boat first
    // reaches a line, then every few frames while it keeps pulling it. They start where the
    // boat's path crosses the line, so when it crosses at an angle, the starting point slides
    // along the line with it (see rippleAt() for why that looks natural).
    for (let n of pulledLines) {
      let last = this.lastRipple.get(n);
      if (last === undefined || frameCount - last >= this.rippleEvery) {
        let crossing = bx;
        if (abs(boat.velocity.y) > 0.1) {
          let alongPath = (this.lineY(n) - by) / boat.velocity.y; // How far along the boat's path the line is
          crossing = bx + constrain(alongPath * boat.velocity.x, -reachX, reachX);
        }
        // The faster the boat's going, the longer they last, so the further they run along the line
        let pace = speed / (boat.maxspeed * boat.fit());
        this.ripples.push({
          line: n,
          x: crossing + this.travelledX,
          born: frameCount,
          strength: Math.min(1, speed / boat.maxspeed), // Bigger ripples from a faster boat
          life: this.rippleLife * constrain(pace, 0.3, 4),
        });
        this.lastRipple.set(n, frameCount);
      }
    }
    // Lines the boat has moved off will send a new ripple as soon as it reaches them again
    for (let n of this.lastRipple.keys()) {
      if (!pulledLines.has(n)) this.lastRipple.delete(n);
    }
  }

  // Push the points of line in an oval (rx by ry) around (cx, cy) by (px, py), most in the
  // middle and fading to nothing at the edge. Gives the set of lines it moved.
  drag(cx, cy, rx, ry, px, py) {
    let lines = new Set();
    let first = this.firstPoint();
    let last = this.lastPoint();
    for (let n = Math.ceil(this.travelled); ; n++) {
      let y = this.lineY(n);
      if (y < this.top) break;
      let dy = (y - cy) / ry;
      if (dy > 1 || dy < -1) continue;
      let limit = (this.maxPull * depth(y)) / 0.8;
      for (let i = first; i <= last; i++) {
        let dx = (this.pointX(i) - cx) / rx;
        if (dx > 1 || dx < -1) continue;
        let closeness = 1 - Math.sqrt(dx * dx + dy * dy);
        if (closeness <= 0) continue;
        let key = this.key(n, i);
        let offset = this.dragged.get(key);
        if (!offset) {
          offset = createVector(0, 0);
          this.dragged.set(key, offset);
        }
        offset.add(px * closeness, py * closeness);
        offset.limit(limit);
        lines.add(n);
      }
    }
    return lines;
  }

  // How far the ripples running along a line lift it at water position wx.
  //
  // The boat sends out a ripple every few frames while it's on a line. Each one spreads out
  // both ways from where it started (it only depends on the distance from there), swelling
  // up and fading over its length, and dying away as it gets older. Together they add up to
  // one steady train of waves, because on any one line they all share the same rhythm: the
  // waves are timed by frameCount, not by when each ripple started.
  //
  // That's what makes an angled crossing look natural. The starting point slides along the
  // line with the boat, so the waves ahead of it (the way it's heading) get bunched up, and
  // the ones behind get stretched out, like the sound of a passing car (the Doppler effect).
  //
  // Each line has its own speed, wavelength, height and starting phase (see rippleStyle()), so
  // neighbouring lines are out of step, and noise makes them swell and die along the way, which
  // together is what makes the water look churned up rather than combed.
  rippleAt(lineRipples, wx, style) {
    // Ripples overlap a lot, so each one only adds a share, sized so that together they make
    // waves about rippleHeight tall
    let share = (PI * this.rippleEvery * style.speed) / (2 * this.rippleLength);
    let lift = 0;
    for (let r of lineRipples) {
      let age = frameCount - r.born;
      let distance = Math.abs(wx - r.x);
      let behindFront = age * style.speed + this.rippleHeadStart - distance; // How far behind the leading edge
      if (behindFront <= 0 || behindFront > this.rippleLength) continue;
      let swell = Math.sin((PI * behindFront) / this.rippleLength);
      let fade = 1 - age / r.life;
      let crest = (frameCount * style.speed - distance) / style.wavelength;
      let wave = Math.sin(TWO_PI * crest + style.phase) + this.rippleChop * Math.sin(TWO_PI * crest * 1.6 - style.phase);
      lift += wave * swell * fade * r.strength * share;
    }
    let gust = 2 * noise(wx * this.rippleGusts, style.seed, frameCount * 0.015);
    return lift * style.height * gust * gust;
  }

  // What makes line number n's ripples different from its neighbours'
  rippleStyle(n) {
    let vary = (salt) => 1 + (this.hash(n + salt) * 2 - 1) * this.rippleVariety;
    return {
      speed: this.rippleSpeed * vary(0.1),
      wavelength: this.rippleWavelength * vary(0.2),
      height: this.rippleHeight * vary(0.3),
      phase: this.hash(n + 0.4) * TWO_PI,
      seed: n * 0.7,
    };
  }

  // Line number n's height on the screen: the bottom of the screen when n equals
  // travelled, and further up as n gets bigger
  lineY(n) {
    return height * pow(this.ratio, n - this.travelled);
  }

  // A number for point i of line n, for looking it up in this.dragged
  key(n, i) {
    return n * 1000000 + i;
  }

  // Points along a line are every `step` pixels of water. These number the ones on screen
  // (with one spare at each end), and give a point's position on the screen.
  firstPoint() {
    return Math.floor(this.travelledX / this.step) - 1;
  }
  lastPoint() {
    return Math.ceil((this.travelledX + width) / this.step) + 1;
  }
  pointX(i) {
    return i * this.step - this.travelledX;
  }

  show(wake, boat) {
    let weight = boat.wakeWeight();
    let boatX = boat.position.x;
    let boatY = boat.waterY();
    let fc = frameCount;
    let first = this.firstPoint();
    let last = this.lastPoint();

    // The ripples on each line
    let ripplesOn = new Map();
    for (let r of this.ripples) {
      let list = ripplesOn.get(r.line);
      if (list) list.push(r);
      else ripplesOn.set(r.line, [r]);
    }

    push();
    noFill();
    for (let n = Math.ceil(this.travelled); ; n++) {
      let y = this.lineY(n);
      if (y < this.top) break;
      let near = depth(y) / 0.8; // 1 at the bottom of the screen, smaller in the distance
      let bright = this.alpha * pow(near, this.distanceFade);

      // Thinner behind the boat, easing in just past it
      strokeWeight(weight * near * lerp(1, this.thinnerBehind, constrain((y - boatY) / 60, 0, 1)));
      let shade = (((n * 0.137) % 1) + 1) % 1; // Each line its own shade
      let lineRipples = ripplesOn.get(n);
      let style = lineRipples ? this.rippleStyle(n) : null;

      // This line's band: it can move up or down a little under halfway to the lines either
      // side of it. Every line keeps to its own band, so they never cross, however hard the
      // boat drags them or the waves lift them. Only ripples can carry it out of its band.
      let roomUp = (y - this.lineY(n + 1)) * this.band;
      let roomDown = (this.lineY(n - 1) - y) * this.band;
      let rippleRoom = ((roomUp + roomDown) / (2 * this.band)) * this.rippleRoom;

      // How far this line reaches into the dark water from each side, so its edge is uneven:
      // mostly not far, now and then a long way
      let reachLeft = this.ragged * this.hash(n + 0.6) ** 2;
      let reachRight = this.ragged * this.hash(n + 0.7) ** 2;

      // Tiny distant lines look just the same with half the points
      let stride = near < this.distantBelow ? 2 : 1;
      let start = stride === 2 ? Math.floor(first / 2) * 2 : first;

      // The line is drawn in pieces, one for each stretch that's the same: plain line, a
      // segment of white, or hidden under the wake
      let pieceOn = -1; // Whether the piece being drawn shows: 1 or 0 (-1 = none yet)
      let pieceWhite = null; // Which segment of white the piece being drawn is (null = none)
      let hasPrevious = false;
      let previousX = 0;
      let previousY = 0;
      let previousInside = false;
      for (let i = start; i <= last; i += stride) {
        let x = this.pointX(i);
        let wave = (noise(i * this.step * this.waveScale, n * 0.3, fc * this.waveSpeed) - 0.5) * 2;
        let wy = y + wave * this.waveHeight * near;
        // Dragged along by the boat, and pushed aside by the wake
        let offset = this.dragged.get(this.key(n, i));
        if (offset) {
          x += offset.x;
          wy += offset.y;
        }
        wy += wake.pushAt(x, wy);
        // Ease into the edge of the band rather than stopping dead there, so the line stays
        // curvy: small moves are left as they are, big ones slow down as they near the edge
        let moved = wy - y;
        let room = moved < 0 ? roomUp : roomDown;
        wy = y + room * Math.tanh(moved / room);
        if (lineRipples) wy -= rippleRoom * Math.tanh((this.rippleAt(lineRipples, i * this.step, style) * near) / rippleRoom);

        // Under the wake it's black or white, and much more likely to be white the further
        // behind the boat it is. It flickers as one with the rest of its segment: segments are
        // short right behind the boat, and longer further back.
        let inside = wake.isInside(x, wy);
        let far = inside ? Math.min(1, Math.hypot(x - boatX, wy - boatY) / wake.maxLength) : 0;
        // It carries on into the dark water for a while, more the further behind the boat it is
        if (inside) inside = wake.isInside(x - reachLeft * far, wy) && wake.isInside(x + reachRight * far, wy);
        let on = 1;
        let whitePiece = null;
        if (inside) {
          let sizes = this.segmentLengths;
          let size = Math.min(Math.floor(far * sizes.length), sizes.length - 1);
          let segmentKey = this.key(n, Math.floor(i / sizes[size]) * sizes.length + size);
          // Each segment holds for a moment before it can change, at its own time, so it doesn't strobe
          let beat = Math.floor((fc + this.hash(segmentKey) * this.flickerEvery) / this.flickerEvery);
          if (this.hash(segmentKey + beat * 0.61) < lerp(this.whiteNear, this.whiteFar, far * far)) whitePiece = segmentKey;
          else on = 0;
        }

        // Start a new piece of line whenever that changes, joined to the last point. Where the
        // line goes into or comes out of the V, end or start it exactly on the V's arm.
        if (on !== pieceOn || whitePiece !== pieceWhite) {
          let onArm = hasPrevious && inside !== previousInside ? wake.crossing(previousX, previousY, x, wy) : null;
          if (pieceOn > 0) {
            if (onArm) vertex(onArm.x, onArm.y);
            else vertex(x, wy);
            endShape();
          }
          pieceOn = on;
          pieceWhite = whitePiece;
          if (on > 0) {
            if (whitePiece !== null) stroke(255, bright);
            else stroke(grey(shade, bright));
            beginShape();
            if (onArm) vertex(onArm.x, onArm.y);
            else if (hasPrevious) vertex(previousX, previousY);
          }
        }
        if (on > 0) vertex(x, wy);
        hasPrevious = true;
        previousX = x;
        previousY = wy;
        previousInside = inside;
      }
      if (pieceOn > 0) endShape();
    }
    pop();
  }

  // A number from 0 to 1 that's always the same for the same input, but looks random
  hash(x) {
    let h = Math.sin(x * 12.9898) * 43758.5453;
    return h - Math.floor(h);
  }
}
