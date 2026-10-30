// LineWake class
// The water churned up behind the boat, drawn as lines that spread out and drift.
//
// Each line is a chain of particles, like bits of foam. Every frame the boat drops
// a new particle at the start of each line. The particles are then:
//   thrown sideways, the outer lines harder, which opens the wake into a V
//   slowed down by drag, so the V curves as it spreads
//   stirred by a Perlin noise "flow field", so the lines wobble like moving water
// The lines are drawn through their particles with splineVertex(), p5 2.x's version of
// curveVertex().
//
// The camera follows the boat, so every particle also scrolls back by however far the
// world moved this frame. pushAt() lets the water's lines get pushed aside by the wake.

import p5 from 'p5';
import rippleColor from './ripple_color.js';

class WakeParticle {
  constructor(position, velocity) {
    this.position = position.copy();
    this.velocity = velocity.copy();
    this.acceleration = createVector(0, 0);
    this.age = 0; // In frames
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update(drag) {
    this.velocity.add(this.acceleration);
    this.velocity.mult(drag);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    this.age++;
  }
}

export default class LineWake {
  constructor() {
    this.lineCount = 9; // How many lines, spread evenly across the V
    this.lifespan = 110; // How many frames a particle lasts
    this.drag = 0.97; // How quickly the water calms down
    this.spread = 1.2; // How hard particles are thrown sideways, compared to the boat's speed
    this.emptyMiddle = 0.6; // Leave out the lines nearer the middle than this (0 = middle, 1 = edges), so it's an open V
    this.flowScale = 0.004; // Size of the swirls in the water (smaller = bigger swirls)
    this.flowStrength = 0.03; // How hard the swirls push
    this.pieceLength = 8; // Particles per drawn piece: smaller = smoother fade, but slower
    this.pushReach = 40; // How close (in pixels) the water's lines have to be to get pushed aside
    this.pushStrength = 7; // How far (in pixels) the wake pushes them

    // How far the boat has sailed in total, so the flow field moves with the water
    this.travelled = createVector(0, 0);

    // One array of particles per line, newest first
    this.lines = [];
    for (let i = 0; i < this.lineCount; i++) {
      this.lines.push([]);
    }
  }

  // Drop a new particle at the start of every line.
  // stern: where the back of the boat is; sideways: a unit vector across the boat
  emit(stern, sideways, boatVelocity, sternWidth) {
    let speed = boatVelocity.mag();
    if (speed < 0.5) return; // Not moving, no new wake

    for (let i = 0; i < this.lineCount; i++) {
      let side = map(i, 0, this.lineCount - 1, -1, 1); // -1 is one edge of the V, 1 the other
      if (abs(side) < this.emptyMiddle) continue; // Only the arms of the V
      let start = p5.Vector.add(stern, p5.Vector.mult(sideways, side * sternWidth));
      let push = p5.Vector.mult(sideways, side * speed * this.spread);
      let pulled = p5.Vector.mult(boatVelocity, 0.2); // Water gets dragged along behind the boat a little
      this.lines[i].unshift(new WakeParticle(start, p5.Vector.add(push, pulled)));
    }
  }

  // scroll: how far the world slides back this frame (see Boat)
  update(scroll) {
    this.travelled.add(scroll);

    for (let line of this.lines) {
      for (let particle of line) {
        // Flow field: the noise value at this spot (in the water, not on the screen)
        // picks a direction to drift in
        let x = particle.position.x + this.travelled.x;
        let y = particle.position.y + this.travelled.y;
        let n = noise(x * this.flowScale, y * this.flowScale, frameCount * 0.005);
        let flow = p5.Vector.fromAngle(n * TWO_PI * 2);
        flow.mult(this.flowStrength);
        particle.applyForce(flow);
        particle.update(this.drag);

        // The camera follows the boat, so the water (and everything on it) slides backward
        particle.position.sub(scroll);
      }
      // The oldest particles are at the end of the line
      while (line.length > 0 && line[line.length - 1].age > this.lifespan) {
        line.pop();
      }
    }

    this.findBounds();
    this.findV();
  }

  // A box around the whole wake (plus how far it reaches), so pushAt() can quickly
  // skip anything nowhere near it
  findBounds() {
    let r = this.pushReach;
    this.bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (let line of this.lines) {
      for (let particle of line) {
        this.bounds.left = min(this.bounds.left, particle.position.x - r);
        this.bounds.right = max(this.bounds.right, particle.position.x + r);
        this.bounds.top = min(this.bounds.top, particle.position.y - r);
        this.bounds.bottom = max(this.bounds.bottom, particle.position.y + r);
      }
    }
  }

  show(weight) {
    push();
    noFill();
    strokeWeight(weight);
    // The first and last vertex of each shape only steer the curve, like the old curve()
    splineProperty('ends', EXCLUDE);

    for (let line of this.lines) {
      for (let run of this.unbrokenRuns(line)) {
        // Draw the run in short pieces, each one curve with its own colour, so the wake
        // fades along its length. (One shape per piece is much faster than one per gap.)
        for (let start = 1; start < run.length - 2; start += this.pieceLength) {
          // Take one extra particle on each side to steer the curve, so the pieces join smoothly
          let piece = run.slice(start - 1, start + this.pieceLength + 2);
          let age = piece[1].age / this.lifespan; // 0 = just made, 1 = about to disappear
          stroke(rippleColor(age, 220 * (1 - age)));
          beginShape();
          for (let particle of piece) {
            splineVertex(particle.position.x, particle.position.y);
          }
          endShape();
        }
      }
    }
    pop();
  }

  // Split a line wherever neighbouring particles shouldn't be joined
  unbrokenRuns(line) {
    let runs = [];
    let run = [];
    for (let i = 0; i < line.length; i++) {
      if (i > 0 && this.isBroken(line[i - 1], line[i])) {
        runs.push(run);
        run = [];
      }
      run.push(line[i]);
    }
    runs.push(run);
    return runs;
  }

  // Two neighbouring particles shouldn't be joined if the boat stopped between them
  // (a gap in their ages) or they've somehow ended up far apart
  isBroken(p1, p2) {
    return abs(p1.age - p2.age) > 2 || p5.Vector.dist(p1.position, p2.position) > 100;
  }

  // How far the wake pushes the water up or down at (x, y), in pixels. Water near the wake
  // gets pushed away from it (up if the wake is below, down if it's above), most by the
  // newest parts of the wake, so the water's lines bend and break up around it.
  // This runs for every point of every water line, so it uses plain Math (much faster
  // than p5's dist() while developing) and skips anywhere outside the wake's bounds.
  pushAt(x, y) {
    let b = this.bounds;
    if (!b || x < b.left || x > b.right || y < b.top || y > b.bottom) return 0;

    let push = 0;
    for (let line of this.lines) {
      for (let i = 0; i < line.length; i += 2) { // Every other particle is plenty
        let particle = line[i];
        let dx = particle.position.x - x;
        let dy = particle.position.y - y;
        if (Math.abs(dx) > this.pushReach || Math.abs(dy) > this.pushReach) continue; // Quick check: too far
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < this.pushReach) {
          let closeness = 1 - d / this.pushReach;
          let freshness = 1 - particle.age / this.lifespan;
          push += (dy > 0 ? -1 : 1) * closeness * freshness;
        }
      }
    }
    return constrain(push, -1, 1) * this.pushStrength;
  }

  // The outline of the V: down the outermost left arm, across its far end, and back up the
  // outermost right arm (the two arms' particles were dropped together, so they line up)
  findV() {
    let left = this.lines[0];
    let right = this.lines[this.lines.length - 1];
    this.vShape = left.map((p) => p.position).concat(right.map((p) => p.position).reverse());
  }

  // How much the wake covers the water at (x, y): 1 inside the V between its outer arms,
  // 0 outside it, so whatever the wake covers stops right at the arms
  coverAt(x, y) {
    let b = this.bounds;
    if (!b || x < b.left || x > b.right || y < b.top || y > b.bottom) return 0; // Quick check
    return this.insideV(x, y) ? 1 : 0;
  }

  // Where the line from (ax, ay) to (bx, by) crosses the V's outline (the crossing nearest
  // to the first point), or null if it doesn't
  crossV(ax, ay, bx, by) {
    let shape = this.vShape;
    if (!shape || shape.length < 2) return null;
    let best = null;
    let bestT = Infinity;
    for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
      let p = shape[j];
      let q = shape[i];
      // Solve for where the two lines meet: t along a->b, u along p->q (both 0 to 1 if on both)
      let denom = (bx - ax) * (q.y - p.y) - (by - ay) * (q.x - p.x);
      if (denom === 0) continue; // Parallel
      let t = ((p.x - ax) * (q.y - p.y) - (p.y - ay) * (q.x - p.x)) / denom;
      let u = ((p.x - ax) * (by - ay) - (p.y - ay) * (bx - ax)) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bestT) {
        bestT = t;
        best = { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
      }
    }
    return best;
  }

  // Is (x, y) inside the V's outline? Count how many of the outline's edges a line from the
  // point straight across to the right crosses: an odd number means it's inside.
  // (Plain Math, since it runs for lots of points.)
  insideV(x, y) {
    let shape = this.vShape;
    if (!shape || shape.length < 3) return false;
    let inside = false;
    for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
      let a = shape[i];
      let c = shape[j];
      if (a.y > y !== c.y > y) {
        let crossX = a.x + ((y - a.y) / (c.y - a.y)) * (c.x - a.x);
        if (x < crossX) inside = !inside;
      }
    }
    return inside;
  }

  // Slide the whole wake, e.g. when the window resizes and the boat moves to the new middle
  shift(offset) {
    for (let line of this.lines) {
      for (let particle of line) {
        particle.position.add(offset);
      }
    }
  }
}
