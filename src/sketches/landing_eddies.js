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

// The camera swings round to follow the boat: behind it when it heads away up the screen
// at an angle, in front of it when it heads toward us, so it ends up sailing straight away
// or straight toward us. (Heading mostly sideways, the camera stays put.)
let cameraSpeed = 0.012; // How quickly the camera swings round
let cameraEase = 0.03; // How gradually it starts and stops swinging (smaller = gentler)
let cameraTurn = 0; // How fast it's swinging right now, in radians per frame
let cameraDeadZone = 0.2; // Heading closer to sideways than this (0 to 1), the camera doesn't move

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  cursor(CROSS);

  boat = new Boat(width / 2, height / 1.5);
  wake = new LineWake();
  water = new WaterLines();
  water.sternBubbles = 0; // The sketch pours out its own bubbles (see showBubbles())

  // A portal for each page, in a diamond around where the boat starts: above it, to its
  // right, below it and to its left, all just out of sight to start with. Tags at the edge
  // of the screen point the way. Sail into one to go to that page.
  let out = 250; // How far off the screen they start
  let below = 380; // Further for the bottom one: gates are tallest there, and would poke up into view
  let pages = [
    ['/music/', 'music', boat.home.x, -out],
    ['/art/', 'art', width + out, boat.home.y],
    ['/teaching/', 'teaching', boat.home.x, height + below],
    ['/bio/', 'bio', -out, boat.home.y],
  ];
  for (let [url, label, x, y] of pages) {
    portals.push(new Portal(x, y, url, label));
  }
}

function draw() {
  background(0);
  swingCamera();
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
    text('click a name to sail there, or steer with the arrow keys', width / 2, height - 70); // Above the bottom gate's tag
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

// Swing the camera round a little toward being behind (or in front of) the boat. Swinging the
// camera is the same as turning everything on the water the other way around the boat: the
// boat's heading, its wake, the gates and the bubbles. (Not the water's lines: they're waves
// running across the view, so they look the same from any angle.)
function swingCamera() {
  // Hold still while the boat's going through a gate, so the gate stays put around it
  if (boat.sinking) {
    cameraTurn = 0;
    return;
  }
  // How fast it would like to be swinging: toward having the boat head straight up or down
  // the screen, more the steeper it's heading (and not at all when it's still)
  let wanted = 0;
  if (boat.velocity.mag() > 0.5) {
    let heading = boat.velocity.heading();
    let upOrDown = sin(heading); // -1 = straight up the screen (away), 1 = straight down (toward us)
    let steepness = constrain((abs(upOrDown) - cameraDeadZone) / 0.3, 0, 1);
    let target = upOrDown < 0 ? -HALF_PI : HALF_PI;
    wanted = atan2(sin(target - heading), cos(target - heading)) * cameraSpeed * steepness;
  }
  // Ease into it and out of it, rather than starting and stopping all at once
  cameraTurn = lerp(cameraTurn, wanted, cameraEase);
  if (abs(cameraTurn) < 0.00001) return;
  let turn = cameraTurn;

  // Turn about where the boat sits on the water, on the water (unsquashing it first, so
  // things go round in circles on the water, not on the screen)
  let pivot = createVector(boat.position.x, boat.position.y + boat.length * 0.12);
  let squash = boat.sinTilt;
  let turnPoint = (v) => {
    let dx = v.x - pivot.x;
    let dy = (v.y - pivot.y) / squash;
    v.set(pivot.x + dx * cos(turn) - dy * sin(turn), pivot.y + (dx * sin(turn) + dy * cos(turn)) * squash);
  };
  let turnDirection = (v) => {
    let dy = v.y / squash;
    v.set(v.x * cos(turn) - dy * sin(turn), (v.x * sin(turn) + dy * cos(turn)) * squash);
  };

  turnDirection(boat.velocity);
  boat.angle += turn;
  for (let portal of portals) {
    turnPoint(portal.position);
    if (portal.facing !== null) portal.facing += turn;
  }
  for (let line of wake.lines.concat(wake.hullLines)) {
    for (let particle of line) {
      turnPoint(particle.position);
      turnDirection(particle.velocity);
    }
  }
  for (let b of bubbles) {
    turnPoint(b.position);
    turnDirection(b.velocity);
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
