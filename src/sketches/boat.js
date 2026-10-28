// Boat class
// A line-drawn boat you can steer. The arrow keys push it,
// holding the mouse down pulls it toward the mouse.
//
// The boat sails forward on the screen, and a "camera" follows it with a little ease:
// each frame the world scrolls back by part of the gap between the boat and its home
// in the middle of the screen (this.scroll). So when the boat speeds up it pulls ahead,
// and when it stops the background catches up and it drifts back to the middle.
// The sketch scrolls the ripples by -scroll. The boat's wake is part of those ripples:
// while the boat is moving, the sketch puts new ripples at its stern (this.stern).
//
// The boat is a small 3D model made of outlines (hull slices and cabin).
// Every point is a vector in "boat space", measured in hull lengths:
//   x runs from the back of the boat (-0.5) to the front (+0.5)
//   y runs across the boat, from side to side
//   z is the height above the water
// toScreen() turns those 3D points into 2D points on the canvas.

import p5 from 'p5';

export default class Boat {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.home = createVector(x, y); // Where the camera wants to keep the boat
    this.scroll = createVector(0, 0); // How far the world slides back this frame
    this.followSpeed = 0.025; // How quickly the background catches up (0 to 1, smaller = boat gets further ahead)
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.maxspeed = 4; // Maximum speed
    this.maxforce = 0.25; // How hard the keys / mouse can push
    this.drag = 0.96; // Water slows the boat down a little every frame
    this.sinking = false; // Set by a gate when the boat starts going through it
    this.gateCut = null; // Set by a gate while the boat goes through it: where to cut the boat off
    this.destination = null; // A portal to sail to by itself (see sailTo())
    this.arcAmount = 0.4; // How wide the boat swings out on its way there (radians at the start)

    this.angle = -PI/2; // Which way the boat is facing
    this.turnSpeed = 0.08; // How quickly it turns toward where it's going
    this.baseTilt = 0.35; // How far above the water we're looking from (radians)
    this.cameraSwing = 0.0006; // How much the view angle shifts per pixel the boat is ahead of the camera
    this.depthShrink = 0.5; // How much the boat shrinks as it moves away (1 = exactly like the ripples, 0 = never)
    this.length = 400; // Hull length in pixels, updated to fit the window
    this.aimCamera();

    // Stroke colours for each part of the boat. Change these any time,
    // or press "c" to open the colour pickers.
    this.colors = {
      hull: ['#b4b4b4', '#8e3b2c', '#c9a35a', '#9fb08f', '#7aa6dc', '#5fd6dc', '#9b2d8f'], // deck to waterline
      cabin: ['#d9b36a', '#7d8a8c', '#d8507a', '#7fe0a8'], // top to bottom
      ripple: ['#7aa6dc', '#e8a4b8', '#c8c8d0', '#e0d0e0'], // inside to outside
    };

    this.stern = createVector(x, y); // Where the back of the boat meets the water, on the screen

    this.outlines = []; // Every shape to draw: { points, part, index, alpha }
    this.buildModel();
    this.panel = null;
    this.mouseOverPanel = false;
  }

  run() {
    this.steer();
    this.update();
    this.show();
  }

  // Stroke weight for the ripples, which grows and shrinks with the boat
  wakeWeight() {
    return max(1, this.length * 0.004);
  }

  // Sail to a portal by itself (when its name is clicked)
  sailTo(portal) {
    this.destination = portal;
    let toTarget = p5.Vector.sub(portal.position, this.position);
    this.arcStart = toTarget.mag(); // How far it was when we set off
    // Swing out on the side the boat is already facing, so it turns smoothly: if the
    // portal is clockwise of where it's facing, aim anticlockwise of it, and vice versa
    let facing = p5.Vector.fromAngle(this.angle);
    let clockwise = facing.x * toTarget.y - facing.y * toTarget.x > 0;
    this.arcSide = clockwise ? -1 : 1;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  // Turn keyboard / mouse input into a force
  steer() {
    if (this.sinking) return; // Caught in a portal: no more steering
    let force = createVector(0, 0);
    if (keyIsDown(LEFT_ARROW)) force.x -= 1;
    if (keyIsDown(RIGHT_ARROW)) force.x += 1;
    if (keyIsDown(UP_ARROW)) force.y -= 1;
    if (keyIsDown(DOWN_ARROW)) force.y += 1;

    // Steering with the keys takes back control from sailing by itself
    if (force.mag() > 0) this.destination = null;

    if (force.mag() === 0 && this.destination) {
      // Sailing by itself: head for the middle of the portal. The boat is drawn a little
      // above where it touches the water, so aim that much higher.
      let target = createVector(this.destination.position.x, this.destination.position.y - this.length * 0.12);
      force = p5.Vector.sub(target, this.position);
      // Arc there rather than going straight: aim off to one side at first, less and less
      // the closer it gets, so the boat curves in and arrives head on
      let stillToGo = constrain(force.mag() / this.arcStart, 0, 1);
      force.rotate(this.arcSide * this.arcAmount * stillToGo);
    } else if (force.mag() === 0 && mouseIsPressed && !this.mouseOverPanel) {
      // No keys? Then holding the mouse down pulls the boat toward it
      let mouse = createVector(mouseX, mouseY);
      force = p5.Vector.sub(mouse, this.position);
      if (force.mag() < 20) force.mult(0); // Close enough, stop pulling
    }

    force.setMag(this.maxforce);
    this.applyForce(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.mult(this.drag);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);

    // The camera eases toward the boat: slide the world (and the boat) back
    // by a small part of how far the boat is from home
    this.scroll = p5.Vector.sub(this.position, this.home).mult(this.followSpeed);
    this.position.sub(this.scroll);

    // Turn smoothly to face the direction we're moving
    if (this.velocity.mag() > 0.5) {
      let target = this.velocity.heading();
      let difference = atan2(sin(target - this.angle), cos(target - this.angle)); // The shortest way round
      this.angle += difference * this.turnSpeed;
    }

    this.aimCamera();

    // Keep the boat a sensible size for the window, and shrink it as it moves away up the screen.
    // The ripples are sized by how far down the screen they are, so the boat follows the same rule.
    let depth = this.position.y / this.home.y; // Under 1 = further away than home, over 1 = closer
    let shrink = constrain(1 + (depth - 1) * this.depthShrink, 0.5, 1.5);
    this.length = min(width, height /2, 1100) * 0.59 * shrink;

    // Where the back of the boat meets the water, for the sketch to put its wake ripples
    this.stern = this.toScreen(createVector(-0.45, 0, 0));
    this.stern.add(this.position.x, this.position.y + this.length * 0.12);
  }

  // The camera stays back at home while the boat eases ahead of it, so it sees the boat
  // from a slightly different angle: further ahead (up the screen) it looks flatter,
  // closer it's seen more from above, and off to one side it's seen slightly turned.
  aimCamera() {
    let offset = p5.Vector.sub(this.position, this.home);
    this.tilt = constrain(this.baseTilt + offset.y * this.cameraSwing, this.baseTilt - 0.18, this.baseTilt + 0.18);
    let turn = constrain(-offset.x * this.cameraSwing, -0.18, 0.18);

    // toScreen() needs these for every point of the boat, so work them out once a frame
    this.cosAngle = cos(this.angle + turn);
    this.sinAngle = sin(this.angle + turn);
    this.cosTilt = cos(this.tilt);
    this.sinTilt = sin(this.tilt);

    // How squashed the water looks compared to when the boat is at rest:
    // under 1 = flatter (camera lower), over 1 = rounder (camera higher).
    // The sketch uses this to squash the ripples the same way as the boat.
    this.squash = this.sinTilt / sin(this.baseTilt);
  }

  // Is the point (x, y) on the water underneath the boat?
  isOver(x, y) {
    // Undo toScreen(): measure from the boat's centre, unsquash the water, unspin
    let dx = (x - this.position.x) / this.length;
    let dy = (y - this.position.y - this.length * 0.12) / this.length / this.sinTilt;
    let along = dx * this.cosAngle + dy * this.sinAngle;
    let across = -dx * this.sinAngle + dy * this.cosAngle;
    // Inside an ellipse about the size of the hull
    return sq(along / 0.5) + sq(across / 0.18) < 1;
  }

  // Turn a 3D point on the boat into a 2D point on the screen
  toScreen(point) {
    // Spin the point around the boat's centre so it faces this.angle
    let x = point.x * this.cosAngle - point.y * this.sinAngle;
    let y = point.x * this.sinAngle + point.y * this.cosAngle;
    // Look at it from above: the water gets squashed, height goes up the screen
    let screenX = x;
    let screenY = y * this.sinTilt - point.z * this.cosTilt;
    return createVector(screenX * this.length, screenY * this.length);
  }

  show() {
    push();
    translate(this.position.x, this.position.y + this.length * 0.12);
    // Black silhouette first, so anything behind the boat is hidden
    noStroke();
    fill(0);
    for (let outline of this.outlines) {
      if (outline.part === 'ripple') continue; // Keep the water see-through
      this.drawOutline(outline);
    }

    // Then the coloured lines on top
    noFill();
    strokeWeight(max(1, this.length * 0.0046));
    for (let outline of this.outlines) {
      let c = color(this.colors[outline.part][outline.index]);
      c.setAlpha(outline.alpha);
      stroke(c);
      this.drawOutline(outline);
    }
    pop();
  }

  drawOutline(outline) {
    push();
    if (this.gateCut) this.cutAtGate(outline.points[0].z);
    beginShape();
    for (let point of outline.points) {
      let s = this.toScreen(point);
      vertex(s.x, s.y);
    }
    endShape(CLOSE);
    pop();
  }

  // While going through a gate, hide the part of an outline that's already through, so the
  // boat looks sliced off by the gate. The gate's line is on the water, so for an outline at
  // height z it shows up that much higher on the screen. (Called with the boat translated
  // to its own position, so everything here is measured from there.)
  cutAtGate(z) {
    let g = this.gateCut;
    let line = g.y - (this.position.y + this.length * 0.12) - z * this.cosTilt * this.length;
    let left = g.left - this.position.x;
    beginClip({ invert: true }); // Draw everywhere except inside this rectangle
    if (g.cameFrom === 1) rect(left, line - height * 2, g.width, height * 2); // Through = up the screen
    else rect(left, line, g.width, height * 2); // Through = down the screen
    endClip();
  }

  // Build every outline once. show() just draws them from the current angle.
  buildModel() {
    let sliceGap = 0.014; // Height between hull slices (smaller = flatter boat)
    let deck = (this.colors.hull.length - 1) * sliceGap; // Height of the top slice
    let deckShape = hullShape(0.18, 40);

    // Hull: a stack of slices, each a bit smaller than the one above
    for (let i = 0; i < this.colors.hull.length; i++) {
      let z = deck - i * sliceGap;
      this.addOutline(hullSlice(deckShape, i, z), 'hull', i, 230);
    }

    // Ripples on the water, getting bigger and fainter
    // for (let i = 0; i < this.colors.ripple.length; i++) {
    //   let grow = 1.12 + i * 0.12;
    //   let points = deckShape.map((p) => createVector(p.x * grow, p.y * (grow + 0.15 * i), -0.01));
    //   this.addOutline(points, 'ripple', i, 110 - i * 22);
    // }

    // Cabin: rounded rectangles, widest at the bottom
    for (let i = 0; i < this.colors.cabin.length; i++) {
      let grow = 0.88 + i * 0.05;
      let z = deck + 0.05 - i * 0.017;
      let points = roundedRect(0.15 * grow, 0.09 * grow, 40).map((p) => createVector(p.x - 0.13, p.y, z));
      this.addOutline(points, 'cabin', i, 230);
    }
  }

  addOutline(points, part, index, alpha) {
    this.outlines.push({ points, part, index, alpha });
  }

  // Show or hide a panel of colour pickers, one for every entry in this.colors
  toggleColorPanel() {
    if (this.panel === null) this.makeColorPanel();
    if (this.panelVisible) {
      this.panel.hide();
      this.mouseOverPanel = false;
    } else {
      this.panel.show();
    }
    this.panelVisible = !this.panelVisible;
  }

  makeColorPanel() {
    this.panel = createDiv();
    this.panel.style('position', 'fixed');
    this.panel.style('top', '70px');
    this.panel.style('right', '16px');
    this.panel.style('z-index', '1000');
    this.panel.style('padding', '10px 12px');
    this.panel.style('background', 'rgba(20, 20, 20, 0.85)');
    this.panel.style('color', '#ddd');
    this.panel.style('font', '12px monospace');
    this.panel.style('border-radius', '6px');
    this.panel.mouseOver(() => (this.mouseOverPanel = true));
    this.panel.mouseOut(() => (this.mouseOverPanel = false));

    for (let part in this.colors) {
      let row = createDiv(part);
      row.parent(this.panel);
      for (let i = 0; i < this.colors[part].length; i++) {
        let picker = createColorPicker(this.colors[part][i]);
        picker.parent(row);
        picker.style('width', '24px');
        picker.input(() => (this.colors[part][i] = picker.value()));
      }
    }

    // Copy the colours, ready to paste back into the constructor
    let copyButton = createButton('Copy colours');
    copyButton.parent(this.panel);
    copyButton.mousePressed(() => navigator.clipboard.writeText(JSON.stringify(this.colors, null, 2)));

    this.panel.hide();
    this.panelVisible = false;
  }
}

// The outline of the deck, seen from above: round at the back, pointed at the front
function hullShape(halfWidth, steps) {
  let widthAt = (t) => pow(t, 0.5) * pow(1 - t, 0.75); // t goes from back (0) to front (1)
  let widest = widthAt(0.4);
  let side = [];
  for (let i = 0; i <= steps; i++) {
    let t = (1 - cos((PI * i) / steps)) / 2; // More points near the ends, where it curves most
    side.push(createVector(t - 0.5, (halfWidth * widthAt(t)) / widest));
  }
  // Mirror one side to make the other
  let otherSide = side.slice(1, -1).reverse().map((p) => createVector(p.x, -p.y));
  return side.concat(otherSide);
}

// Slice number i of the hull, at height z.
// Lower slices are shorter and narrower, and every slice curves up at the front.
function hullSlice(deckShape, i, z) {
  let lengthScale = 1 - 0.022 * i;
  let widthScale = 1 - 0.05 * i;
  return deckShape.map((p) => {
    let front = max(0, (p.x - 0.1) / 0.4); // 0 until the front part of the boat, then up to 1
    return createVector(-0.2 + (p.x + 0.2) * lengthScale, p.y * widthScale, z + 0.03 * front * front);
  });
}

// A rectangle with very rounded corners (a "superellipse")
function roundedRect(halfLength, halfWidth, steps) {
  let points = [];
  for (let i = 0; i < steps; i++) {
    let a = (TWO_PI * i) / steps;
    let x = halfLength * Math.sign(cos(a)) * sqrt(abs(cos(a)));
    let y = halfWidth * Math.sign(sin(a)) * sqrt(abs(sin(a)));
    points.push(createVector(x, y));
  }
  return points;
}
