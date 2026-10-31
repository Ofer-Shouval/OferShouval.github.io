// Full-screen background sketch for the home page, another take on "Wake" (2019):
// the water is a series of wavy lines that get closer together into the distance (see
// WaterLines), and the boat's wake is two lines tracing its outline (see LineWake) that push
// the water's lines aside, with bubbles pouring out between them. The boat stays near the
// middle; the water moves past it.

import p5 from 'p5';
import Boat from './boat.js';
import Portal from './portal.js';
import LineWake from './line_wake.js';
import WaterLines from './water_lines.js';
import rippleColor, { isWhite } from './ripple_color.js';
import { depth, flatness } from './perspective.js';

// The friendly-error checker slows every p5 call; it's for development, not the live site.
p5.disableFriendlyErrors = import.meta.env.PROD;

let boat;
let wake;
let water;
let portals = [];
let hintAlpha = 230; // The hint at the bottom of the screen, which fades away

// The bubbles behind the boat, filling the V between the two sides of the wake: little
// ripples that swell and shrink, a few new ones every frame while the boat is moving. Each is thrown outward
// at its own speed and slowed by drag, like the wake's lines, so they fan out. Oldest first.
let bubbleLife = 140; // How many frames a bubble lasts (as long as the wake's lines, so they fill the V all the way back)
let bubbleSize = 12; // How wide (in pixels) a bubble gets at its biggest, near the bottom of the screen
let bubblesPerFrame = 0; // 0 = no bubbles
let bubbleSpread = 1.6; // How hard the outermost bubbles are thrown sideways, compared to the boat's speed
let bubbleAlpha = 100; // How bright they are, like the boat's reflection (255 = solid)
let bubbles = []; // { position, velocity, born }

// The row of gates in the distance
let rowY = 110; // How far down the screen the row is, when it's furthest away
let rowForward = 0; // How far the boat has sailed toward it (0 = at the start, can't go back further)
let rowSideways = 0; // How far the boat has sailed to the side of the middle of the row

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  cursor(CROSS);

  boat = new Boat(width / 2, height / 1.5);
  wake = new LineWake();
  water = new WaterLines();
  water.sternBubbles = 0; // The sketch pours out its own bubbles (see showBubbles())

  boat.cameraSwing = 0; // The view stays put: everything's worked out from the row of gates (see placeGate())

  // A portal for each page, in a row in the distance, evenly across the screen. As the boat
  // nears them they grow and spread out (see placeGate()). Sail into one to go to that page.
  let pages = [
    ['/music/', 'music'],
    ['/art/', 'art'],
    ['/teaching/', 'teaching'],
    ['/bio/', 'bio'],
  ];
  pages.forEach(([url, label], i) => {
    let portal = new Portal(width / 2, rowY, url, label);
    portal.inRow = ((i + 0.5) / pages.length - 0.5) * 2; // Where in the row: -1 is the left of the screen, 1 the right
    portal.place = placeGate;
    portals.push(portal);
  });
}

// Where a gate is on the screen. The whole row grows and spreads out from the middle of the
// screen by the same amount (rowScale) as the boat sails toward it, so the gate it's heading
// for grows and centres, and the others slide off the sides.
function placeGate(portal) {
  let x = portal.inRow * (width / 2) - rowSideways;
  portal.position.set(width / 2 + x * rowScale(), rowY * rowScale());
}

// How much bigger the row is than when it's furthest away (1)
function rowScale() {
  return exp(rowForward);
}

// Follow the boat: forward at the same rate as the water's lines (which move in proportion to
// how far down the screen they are), and sideways, keeping to the width of the row
function moveRow() {
  rowForward = max(0, rowForward - boat.scroll.y / (boat.position.y + boat.length * 0.12));
  rowSideways = constrain(rowSideways + boat.scroll.x, -width / 2, width / 2);
}

function draw() {
  background(0);
  moveRow();
  fill(0);

  // The water, with the wake pushing its lines aside, then the bubbles and the wake on top
  water.update(boat.scroll, boat.position.y);
  water.pull(boat);
  wake.update(boat.scroll, boat);
  water.show(wake, boat.wakeWeight(), boat.squash);
  showBubbles();
  wake.show(boat.wakeWeight());

  // Update the gates, then draw the ones further away than the boat (higher up the screen)
  // behind it, and the nearer ones in front of it, so the boat can sail behind a gate
  for (let portal of portals) {
    portal.update(boat);
  }
  let boatOnWater = boat.position.y + boat.length * 0.12;
  for (let portal of portals) {
    if (portal.position.y <= boatOnWater) portal.show(boat);
  }
  boat.run();
  for (let portal of portals) {
    if (portal.position.y > boatOnWater) portal.show(boat);
  }
  for (let portal of portals) {
    portal.showTag();
  }

  // Stir up the water down the sides of the boat, for next frame's wake, and pour out
  // bubbles behind it
  let sideways = createVector(-boat.sinAngle, boat.cosAngle * boat.sinTilt); // Across the boat, squashed like the water
  wake.emit(boat.stern, sideways, boat.velocity, boat.length * 0.08, boat);
  if (boat.velocity.mag() > 0.5) {
    // Anywhere across the gap between the two sides of the wake, just behind the stern
    let gap = boat.widthAt(wake.hullTo) * boat.length * 0.8;
    let speed = boat.velocity.mag();
    for (let k = 0; k < bubblesPerFrame; k++) {
      let across = random(-1, 1);
      let position = p5.Vector.add(boat.stern, p5.Vector.mult(sideways, across * gap));
      let velocity = p5.Vector.mult(sideways, across * speed * bubbleSpread).add(p5.Vector.mult(boat.velocity, 0.2));
      bubbles.push({ position, velocity, born: frameCount });
    }
  }

  // A pointing hand over the portals' names, since clicking one sails the boat there
  let overName = portals.some((portal) => portal.isLabelAt(mouseX, mouseY));
  cursor(overName ? HAND : CROSS);

  // A hint at the bottom of the screen, which fades once a name is clicked (or after ten seconds)
  if (boat.destination || frameCount > 600) hintAlpha = max(0, hintAlpha - 4);
  if (hintAlpha > 0) {
    push();
    noStroke();
    fill(255, hintAlpha);
    textAlign(CENTER, BOTTOM);
    textSize(14);
    text('click a name to sail there, or steer with the arrow keys', width / 2, height - 24);
    pop();
  }
}

function showBubbles() {
  bubbles = bubbles.filter((b) => frameCount - b.born < bubbleLife);
  let weight = boat.wakeWeight();
  for (let b of bubbles) {
    // Fanning out and slowing down, like the wake's lines, and sliding back with the water
    b.velocity.mult(wake.drag);
    b.position.add(b.velocity);
    b.position.sub(boat.scroll);
    if (boat.isOver(b.position.x, b.position.y)) continue; // Hidden under the boat

    let age = (frameCount - b.born) / bubbleLife; // 0 = just made, 1 = about to disappear
    let diameter = sin(age * PI); // Swells up, then shrinks away
    let fade = sin((1 - age) * HALF_PI);
    strokeWeight(isWhite() ? weight * random(1, 1.1) : weight);
    stroke(rippleColor(age, bubbleAlpha * fade));
    let w = diameter * bubbleSize * depth(b.position.y);
    ellipse(b.position.x, b.position.y, w, w * flatness(b.position.y) * boat.squash); // Too small to need a wavy edge
  }
}

function mousePressed() {
  // Clicking a portal's name sends the boat sailing there by itself;
  // clicking anywhere else takes back control
  boat.destination = null;
  for (let portal of portals) {
    if (portal.isLabelAt(mouseX, mouseY)) boat.sailTo(portal);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Keep the boat where it was on the screen, and move everything on the water along with it
  let shift = createVector(width / 2 - boat.home.x, height / 1.5 - boat.home.y);
  boat.home.add(shift);
  boat.position.add(shift);
  wake.shift(shift);
  for (let b of bubbles) {
    b.position.add(shift);
  }
  for (let portal of portals) {
    portal.position.add(shift);
  }
}

function keyPressed() {
  // "c" opens the boat's colour pickers
  if (key === 'c') boat.toggleColorPanel();
  // Stop the arrow keys from scrolling the page while steering
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return false;
}

// Coming back with the browser's Back button can restore the page exactly as it was left,
// with the boat already gone through a gate, so start it fresh instead
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

// This file is a module, so its functions aren't global by default.
// Putting them on window lets p5 find them and run in "global mode".
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
window.keyPressed = keyPressed;
window.mousePressed = mousePressed;
