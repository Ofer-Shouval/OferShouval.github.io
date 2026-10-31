// Gate class
// A gate standing in the sea: a simple frame (two posts and a beam across the top) that the boat
// sails through. When the boat reaches it, the opening fills with light, the boat passes
// through, and the page goes to `url`. Its position and size are set by the sketch each frame
// (see placeGate()). When it's off the screen, a tag at the edge of the screen points the way.

import p5 from 'p5';
import { grey, turnWhite } from './color.js';
import { depth, flatness } from './perspective.js';

const REFLECTION = 0.4; // How far its reflection hangs down, compared to its height

export default class Gate {
  constructor(url, label, place) {
    this.position = createVector(0, 0);
    this.url = url; // Where to go when the boat sails through
    this.label = label; // The page's name, shown under the gate
    this.place = place; // Sets where it is each frame

    this.gateWidth = 300; // Width in pixels (if it were at the bottom of the screen)
    this.gateHeight = 1.1; // Height, compared to its width
    this.brightness = 255; // How bright its line is (255 = solid)
    this.pull = 0.5; // How hard it draws a passing boat toward the middle
    this.reach = 1.6; // How far out it starts pulling the boat in (1 = the posts, 2 = twice as far)
    this.catchDistance = 0.5; // How close to the middle the boat has to get to go through (1 = the posts)

    this.labelArea = null; // Where the name was last drawn, so it can be clicked
    this.passTime = 0; // Frames since the boat started going through (0 = not yet)
    this.boatSide = 0; // Which side of the gate the boat was on last frame (-1 = beyond it, 1 = in front)
    this.measure();
  }

  // (No run(): the sketch updates every gate first, then draws the ones behind the boat
  // before it and the ones in front of it after it, so the boat can sail behind a gate.)

  update(boat) {
    this.place(this);
    this.measure();

    // Where the boat touches the water
    let bx = boat.position.x;
    let by = boat.waterY();

    if (this.passTime > 0) {
      this.passThrough(boat);
      return;
    }
    if (boat.sinking) return; // Already going through another gate

    // Did the boat cross the line between the posts since last frame? The patch of water
    // between the posts is only a few pixels deep in perspective, and the boat can move
    // further than that in one frame, so check for crossing it, not just for being on it.
    let side = by < this.position.y ? -1 : 1;
    let betweenPosts = abs(bx - this.position.x) < this.rx;
    let nearby = abs(by - this.position.y) < this.rx;
    let crossed = this.boatSide !== 0 && side !== this.boatSide && betweenPosts && nearby;
    let cameFrom = crossed ? this.boatSide : side; // Which side it's coming through from
    this.boatSide = side;

    let d = this.distanceFromCenter(bx, by);
    if (crossed || d < this.catchDistance) {
      this.passTime = 1;
      this.cameFrom = cameFrom;
      boat.sinking = true;
      turnWhite(true);
    } else if (d < this.reach && boat.destination !== this) { // (One it's already sailing to doesn't need to)
      // Close enough: draw the boat toward the middle, harder the closer it gets
      let strength = 1 - d / this.reach;
      let inward = createVector(this.position.x - bx, this.position.y - by).normalize();
      inward.mult(this.pull * strength + 0.03);
      boat.applyForce(inward);
    }
  }

  // The boat has reached the gate: it sails steadily on through, and the part of it that's
  // already through is cut off at the gate, as if it's gone somewhere else. Once all of it
  // is through, change page.
  passThrough(boat) {
    this.passTime++;
    // Straight on through, away from the side it came from, and into the middle of the opening
    boat.velocity.set((this.position.x - boat.position.x) * 0.05 * boat.hurry, -this.cameFrom * 3 * boat.hurry);

    // Cut the boat off between the posts, on the far side of the gate (see Boat.cutAtGate())
    boat.gateCut = { left: this.position.x - this.rx, width: this.rx * 2, y: this.position.y, cameFrom: this.cameFrom };

    // Is the back of the boat through yet? Then it's all gone: change page a moment later
    // (or after a few seconds, just in case)
    let sternThrough = this.cameFrom === 1 ? boat.stern.y < this.position.y : boat.stern.y > this.position.y;
    if (sternThrough && !this.allThroughAt) this.allThroughAt = this.passTime;
    let done = (this.allThroughAt && this.passTime > this.allThroughAt + 10) || this.passTime > 150;
    if (done && !this.leaving) {
      this.leaving = true;
      window.location.href = this.url;
    }
  }

  // How far the gate has filled with light since the boat reached it: 0 to 1
  through() {
    return Math.min(1, this.passTime / 60);
  }

  // While the gate is off the screen, show its name at the edge of the screen with an arrow
  // pointing toward it
  showTag() {
    if (this.isOnScreen()) return;

    // Head from the middle of the screen toward the gate, stopping just inside the edge
    // (with extra room at the top for the navbar)
    let center = createVector(width / 2, height / 2);
    let direction = p5.Vector.sub(this.position, center);
    let room = createVector(width / 2 - 40, direction.y < 0 ? height / 2 - 80 : height / 2 - 40);
    let fit = Math.min(room.x / abs(direction.x), room.y / abs(direction.y));
    let tag = p5.Vector.add(center, p5.Vector.mult(direction, fit));
    let pointing = direction.copy().normalize();

    push();
    translate(tag.x, tag.y);
    noStroke();
    fill(255, 220);
    // Long and narrow, so it can't be mistaken for pointing another way
    let side = createVector(-pointing.y, pointing.x).mult(4);
    triangle(pointing.x * 16, pointing.y * 16, side.x, side.y, -side.x, -side.y);
    pop();

    // Name, just on the inside of the arrow
    textSize(14);
    let gap = abs(pointing.x) * (textWidth(this.label) / 2 + 12) + abs(pointing.y) * 18;
    this.drawName(tag.x - pointing.x * gap, tag.y - pointing.y * gap, 14, 18);
  }

  // Draw the name like a link, centred on (x, y): underlined, and brighter with a
  // "click to sail here" hint when the mouse is over it, so it's clear it can be clicked
  drawName(x, y, size, padding) {
    let hovered = this.isLabelAt(mouseX, mouseY);
    push();
    textSize(size);
    textAlign(CENTER, CENTER);
    let w = textWidth(this.label);
    noStroke();
    fill(255, hovered ? 255 : 210);
    text(this.label, x, y);
    // Underline
    stroke(255, hovered ? 255 : 130);
    strokeWeight(1);
    line(x - w / 2, y + size * 0.7, x + w / 2, y + size * 0.7);
    if (hovered) {
      noStroke();
      fill(255, 180);
      textSize(11);
      text('click to sail here', x, y + size + 10);
    }
    pop();
    // Remember a box around it (with room to spare), so clicks on it can be found
    this.labelArea = { left: x - w / 2 - padding, right: x + w / 2 + padding, top: y - size / 2 - padding, bottom: y + size / 2 + padding };
  }

  // Is any of the gate on the screen?
  isOnScreen() {
    return (
      this.position.x + this.rx > 0 && this.position.x - this.rx < width &&
      this.position.y + this.ry > 0 && this.position.y - this.h < height
    );
  }

  // Is (x, y) on the gate's name?
  isLabelAt(x, y) {
    let a = this.labelArea;
    return a !== null && x > a.left && x < a.right && y > a.top && y < a.bottom;
  }

  // Is (x, y) on the gate itself, or its reflection? (With a little room to spare, so a
  // small one in the distance is still easy to click)
  isGateAt(x, y) {
    let room = 10;
    let inside = abs(x - this.position.x) < this.rx + room;
    return inside && y > this.position.y - this.h - room && y < this.position.y + this.h * REFLECTION + room;
  }

  // How big the gate looks at its spot on the screen. rx and ry are the patch of water
  // between its posts, squashed in perspective; h is how tall it stands.
  measure() {
    this.rx = (this.gateWidth / 2) * depth(this.position.y);
    this.ry = this.rx * flatness(this.position.y);
    this.h = this.rx * 2 * this.gateHeight;
  }

  // How far (x, y) on the water is from the middle of the gate: 0 in the middle,
  // 1 out at the posts, more than 1 outside
  distanceFromCenter(x, y) {
    let dx = (x - this.position.x) / this.rx;
    let dy = (y - this.position.y) / this.ry;
    return Math.sqrt(dx * dx + dy * dy);
  }

  show(boat) {
    if (!this.isOnScreen()) return;
    let x = this.position.x;
    let y = this.position.y; // Where the posts meet the water
    let w = this.rx * 2;
    push();

    // As the boat passes through, the opening fills with light, and so does its
    // reflection in the water (more faintly)
    if (this.passTime > 0) {
      noStroke();
      fill(255, 220 * this.through());
      rect(x - w / 2, y - this.h, w, this.h);
      fill(255, 90 * this.through());
      this.reflection(x, y, w, true);
    }

    // The gate: no bottom, so you can sail through. As thin as the water's lines at its
    // height, but never so thin it can't be seen.
    noFill();
    strokeWeight(Math.max(0.75, boat.wakeWeight() * constrain(y / height, 0, 1)));
    stroke(grey(0.5, this.brightness));
    beginShape();
    vertex(x - w / 2, y);
    vertex(x - w / 2, y - this.h);
    vertex(x + w / 2, y - this.h);
    vertex(x + w / 2, y);
    endShape();
    // Its reflection in the water: upside down, squashed, faint and wobbly
    stroke(grey(0.5, this.brightness * 0.43));
    this.reflection(x, y, w, false);
    pop();

    // Name underneath (when it's off the screen, showTag() shows the name instead)
    let size = constrain(this.rx * 0.2, 13, 18);
    this.drawName(x, y + this.ry + 10 + size / 2, size, 10);
  }

  // The gate's reflection in the water: the frame upside down and squashed, wobbling sideways
  // like a reflection on moving water, more the deeper it is. Lots of points, so it can bend.
  // close fills it in as one shape (for the light).
  reflection(x, y, w, close) {
    let down = this.h * REFLECTION;
    let amount = Math.min(w * 0.03, 5);
    let steps = 16;
    let fc = frameCount;
    let point = (px, deep) => {
      let py = y + deep * down;
      let wave = Math.sin(py * 0.25 + fc * 0.12) + 0.5 * Math.sin(py * 0.6 - fc * 0.08);
      vertex(px + wave * amount * deep, py);
    };
    beginShape();
    for (let i = 0; i <= steps; i++) point(x - w / 2, i / steps); // Down the left post
    for (let i = 1; i <= steps; i++) point(x - w / 2 + (w * i) / steps, 1); // Along the beam
    for (let i = steps - 1; i >= 0; i--) point(x + w / 2, i / steps); // Back up the right post
    if (close) endShape(CLOSE);
    else endShape();
  }
}
