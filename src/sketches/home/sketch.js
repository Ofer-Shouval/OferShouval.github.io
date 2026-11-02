// Full-screen background sketch for the home page, another take on "Wake" (2019).
//
// The water is a series of wavy lines (see Water), and the boat, drawn as a mouse pointer (see
// Boat), trails two lines tracing out the V of its wake (see Wake), inside which the water
// flickers in white. The gates to the site's pages stand in a row in the distance (see Gate).
// Click one to sail there, or steer with the arrow keys. The boat stays near the middle of the
// screen; the water moves past it.

import p5 from 'p5';
import Boat from './boat.js';
import Gate, { NAME_FONT } from './gate.js';
import Wake from './wake.js';
import Water from './water.js';
import { depth } from './perspective.js';

// The friendly-error checker slows every p5 call; it's for development, not the live site.
p5.disableFriendlyErrors = import.meta.env.PROD;

const PAGES = [
  ['/music/', 'music'],
  ['/art/', 'art'],
  ['/teaching/', 'teaching'],
  ['/bio/', 'bio'],
];

let boat;
let wake;
let water;
let gates = [];
let hintAlpha = 230; // The hint at the bottom of the screen, which fades away
let overGate = false; // Is the mouse over a gate or its name?

// The row of gates in the distance
let rowY = 90; // How far down the screen the row is, when it's furthest away (see fitToWindow())
let rowForward = 0; // How far the boat has sailed toward it (0 = at the start, can't go back further)
let rowSideways = 0; // How far the boat has sailed to the side of the middle of the row
let rowGateWidth = 26; // How wide (in pixels) a gate is in the row, when it's furthest away (see fitToWindow())
let gateAtBoat = 1.4; // How wide a gate is when it reaches the boat, compared to the boat's length

// Sailing to a gate that's been clicked
let sailTime = 5; // How many seconds it takes the boat to reach it (see fitToWindow(); going through it takes a moment more)
let sailStart = null; // When it set off, in milliseconds
let sailPeak = 1; // The fastest it's gone on this trip, compared to its usual speed
let easeDistance = 0.25; // How far from the gate it starts easing down, compared to the height of the screen
let easeTime = 1.5; // Roughly how long easing down takes, in seconds
let easeTo = 0.4; // How fast it's going when it reaches the gate, compared to its fastest

// The camera swinging round behind the boat
let cameraSpeed = 0.015; // How quickly it swings round, when the boat's heading diagonally
let cameraEase = 0.05; // How gradually it starts and stops swinging (smaller = gentler)
let cameraDeadZone = 0.2; // Heading closer to sideways than this (0 to 1), the camera doesn't move
let cameraTurn = 0; // How fast it's swinging right now, in radians per frame

let wakeLength = 0.9; // How long the wake is, compared to the height of the screen
let boatHome = 0.61; // How far down the screen the camera keeps the boat, which leaves the water behind it in view
let wakeThinner = 0.8; // How thick the wake's lines are, compared to the water's in front of the boat

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  cursor(CROSS);
  document.fonts.load(`16px "${NAME_FONT}"`); // Nothing else on the page uses the gates' font, so ask for it

  boat = new Boat(width / 2, height * boatHome);
  wake = new Wake();
  water = new Water();

  PAGES.forEach(([url, label], i) => {
    let gate = new Gate(url, label, placeGate);
    gate.inRow = ((i + 0.5) / PAGES.length - 0.5) * 2; // Where in the row: -1 is the left of the screen, 1 the right
    gates.push(gate);
  });
  fitToWindow();
}

// Sizes that depend on the window
function fitToWindow() {
  // The water's lines are further apart on a tall screen (each is this much as far down the
  // screen as the one below it)
  water.ratio = 1 - 0.046 * Math.max(1, height / 900);
  // A little more time to sail there on a big screen, which keeps its speed closer to a small
  // screen's (it never takes more than about 7 seconds, going through the gate included)
  sailTime = constrain(map(height, 500, 1440, 4.8, 5.8), 4.8, 5.8);
  // The row's a shorter trip away on a tall screen, for the same reason
  rowY = Math.max(90, height * 0.1);
  // The wake is the same share of the screen on any window, at any speed
  wake.maxLength = height * wakeLength;
  // The gates in the distance are smaller on a small screen, down to a limit
  rowGateWidth = 26 * constrain(Math.min(width / 1440, height / 900), 0.5, 1);
}

// Where a gate is on the screen. The whole row grows and spreads out from the middle of the
// screen by the same amount (rowScale) as the boat sails toward it, so the gate it's heading
// for grows and centres, and the others slide off the sides.
function placeGate(gate) {
  let scale = rowScale();
  gate.position.set(width / 2 + (gate.inRow * (width / 2) - rowSideways) * scale, rowY * scale);

  // Its size: growing from rowGateWidth in the distance to gateAtBoat times the length of the
  // boat by the time it reaches the boat, at an even rate, whatever the size of the window
  let growth = Math.log((gateAtBoat * boat.length) / rowGateWidth) / Math.log(boat.waterY() / rowY);
  let wide = rowGateWidth * pow(gate.position.y / rowY, growth);
  gate.gateWidth = wide / depth(gate.position.y); // Gate scales this back down by depth()
}

// How much bigger the row is than when it's furthest away (1)
function rowScale() {
  return Math.exp(rowForward);
}

// Follow the boat: forward at the same rate as the water's lines (which move in proportion to
// how far down the screen they are), and sideways, keeping to the width of the row
function moveRow() {
  rowForward = Math.max(0, rowForward - boat.scroll.y / boat.waterY());
  rowSideways = constrain(rowSideways + boat.scroll.x, -width / 2, width / 2);
}

function draw() {
  background(0);
  moveRow();
  swingCamera();
  hurryToGate();

  // The water, with the wake pushing its lines aside, then the wake on top
  water.update(boat.scroll, boat.position.y);
  water.pull(boat);
  wake.update(boat.scroll, boat);
  water.show(wake, boat);
  wake.show(boat.wakeWeight() * wakeThinner);

  // Update the gates, then draw the ones further away than the boat (higher up the screen)
  // behind it, and the nearer ones in front of it, so the boat can sail behind a gate
  for (let gate of gates) gate.update(boat);
  let boatOnWater = boat.waterY();
  for (let gate of gates) {
    if (gate.position.y <= boatOnWater) gate.show(boat);
  }
  boat.run();
  for (let gate of gates) {
    if (gate.position.y > boatOnWater) gate.show(boat);
  }
  for (let gate of gates) gate.showTag();

  // Stir up the water for next frame's wake (at no more than the boat's usual speed, so the
  // wake doesn't fan out wildly when it's in a hurry)
  wake.emit(boat, boat.velocity.copy().limit(boat.maxspeed * boat.fit()));

  // A pointing hand over the gates and their names, since clicking one sails the boat there
  let over = gates.some((gate) => gate.isLabelAt(mouseX, mouseY) || gate.isGateAt(mouseX, mouseY));
  if (over !== overGate) {
    overGate = over;
    cursor(over ? HAND : CROSS);
  }

  // A hint at the bottom of the screen, which fades once a gate is clicked (or after ten seconds)
  if (boat.destination || frameCount > 600) hintAlpha = Math.max(0, hintAlpha - 4);
  if (hintAlpha > 0) {
    push();
    noStroke();
    fill(255, hintAlpha);
    textAlign(CENTER, BOTTOM);
    textSize(14);
    text('click a gate to sail there, or steer with the arrow keys', width / 2, height - 24);
    pop();
  }
}

// Set the boat's speed to reach the gate it's been sent to in time: however far is left to
// sail (forward, and to the side), over however long is left, easing down as it nears the gate
function hurryToGate() {
  if (!boat.destination) {
    boat.hurry = 1;
    sailStart = null;
    sailPeak = 1;
    return;
  }
  if (boat.sinking) return; // Going through: keep the same speed
  if (sailStart === null) sailStart = millis();
  let gate = boat.destination.position;
  let boatY = boat.waterY();
  let forward = Math.max(0, Math.log(boatY / gate.y)) * boatY;
  let sideways = Math.abs(gate.x - boat.position.x) / rowScale();
  let left = Math.hypot(forward, sideways);
  let easeFrom = height * easeDistance;

  if (left > easeFrom) {
    // Getting there: fast enough to reach where it starts easing down in time
    let timeLeft = Math.max(0.3, sailTime - easeTime - (millis() - sailStart) / 1000);
    let needed = (left - easeFrom) / (timeLeft * 60); // Pixels every 60th of a second
    // (Never slowing down on the way, or it would lurch)
    sailPeak = Math.max(sailPeak, needed / (boat.maxspeed * boat.fit()));
    boat.hurry = sailPeak;
  } else {
    // Nearly there: easing down, gently at first
    let eased = constrain(left / easeFrom, 0, 1);
    boat.hurry = sailPeak * lerp(easeTo, 1, eased * eased * (3 - 2 * eased));
  }
}

// Swing the camera round toward being behind the boat (or in front of it, if it's heading
// toward us) when it's heading diagonally, so it ends up sailing straight away or straight
// toward us. Everything else turns the other way around it: the boat's heading and its wake,
// and the row of gates, which all share a height, so turning just slides them sideways.
function swingCamera() {
  // Hold still while the boat's going through a gate, so the gate stays put around it
  if (boat.sinking) {
    cameraTurn = 0;
    return;
  }
  let wanted = 0;
  if (boat.velocity.mag() > 0.5) {
    let heading = boat.velocity.heading();
    let upOrDown = sin(heading); // -1 = straight up the screen (away), 1 = straight down (toward us)
    let steepness = constrain((Math.abs(upOrDown) - cameraDeadZone) / 0.3, 0, 1);
    let target = upOrDown < 0 ? -HALF_PI : HALF_PI;
    wanted = atan2(sin(target - heading), cos(target - heading)) * cameraSpeed * steepness;
  }
  // Ease into it and out of it, rather than starting and stopping all at once
  cameraTurn = lerp(cameraTurn, wanted, cameraEase);
  let turn = cameraTurn * boat.dt;
  if (Math.abs(turn) < 0.00001) return;

  // Slide the row (unless it's as far as it goes: then there's nothing more to swing round to)
  let boatX = boat.position.x;
  let boatY = boat.waterY();
  let slid = rowSideways - ((boatY - rowY * rowScale()) * turn) / rowScale();
  if (Math.abs(slid) > width / 2) {
    cameraTurn = 0;
    return;
  }
  rowSideways = slid;

  boat.velocity.rotate(turn);
  boat.angle += turn;
  boat.keyTurn += turn;
  let c = Math.cos(turn);
  let s = Math.sin(turn);
  for (let line of wake.lines) {
    for (let particle of line) {
      let p = particle.position;
      let v = particle.velocity;
      let dx = p.x - boatX;
      let dy = p.y - boatY;
      p.x = boatX + dx * c - dy * s;
      p.y = boatY + dx * s + dy * c;
      let vx = v.x;
      v.x = vx * c - v.y * s;
      v.y = vx * s + v.y * c;
    }
  }
}

function mousePressed() {
  // Clicking a gate or its name sends the boat sailing there by itself;
  // clicking anywhere else takes back control
  boat.destination = null;
  for (let gate of gates) {
    if (gate.isLabelAt(mouseX, mouseY) || gate.isGateAt(mouseX, mouseY)) boat.sailTo(gate);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitToWindow();
  // Keep the boat where it was on the screen, and move everything on the water along with it
  let shift = createVector(width / 2 - boat.home.x, height * boatHome - boat.home.y);
  boat.home.add(shift);
  boat.position.add(shift);
  wake.shift(shift);
}

function keyPressed() {
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
