// Full-screen landing sketch for the art section, grown out of a week 6 homework (archive/week 6):
// a stick figure walks along a street of doors, one for each piece. Walk up to a door and step
// through it (or click one) to go to that piece. Behind the street, a crowd of smaller figures
// walks back and forth in the distance.
//
// The figures are a 12-frame walk cycle (public/media/walk_cycle), drawn in black on clear
// backgrounds and turned light here for the dark page. The camera follows the walker along
// the street; the crowd is further away, so it slides past more slowly.

import p5 from 'p5';

// The friendly-error checker slows every p5 call; it's for development, not the live site.
p5.disableFriendlyErrors = import.meta.env.PROD;

let pieces = [
  ['The Luminin', '/art/luminin.html'],
  ['Visuals for O. Wake', '/art/band-visuals.html'],
  ['Ghost Harp', '/art/ghost-harp.html'],
  ['Point in Passing', '/art/point-in-passing.html'],
  ['Sun Deity', '/art/sun-deity.html'],
  ['Refracture', '/art/refracture.html'],
  ['Sketchbook', '/art/sketchbook/'],
  ['Animation', '/art/animation.html'],
];

let frames = []; // The walk cycle
let standing = 1; // The frame to show when standing still
let crowdSize = 120;
let crowd = [];
let doors = [];
let walker;
let cameraX = 0; // Where on the street the middle of the screen is
let hintAlpha = 230; // The hint at the bottom of the screen, which fades away

// Sizes, worked out from the window (see layout())
let groundY; // Where the street is, down the screen
let horizonY; // Where the crowd fades into the distance
let figureScale; // How big the walker is drawn (1 = the frames' own size)
let doorWidth;
let doorHeight;
let doorSpacing;

async function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  imageMode(CENTER);
  textFont('Source Code Pro');

  for (let i = 1; i <= 12; i++) {
    frames.push(lighten(await loadImage('/media/walk_cycle/' + i + '.png')));
  }

  layout();
  walker = { x: -doorSpacing, direction: 1, walked: 0, target: null, entering: null, enterTime: 0 };
  cameraX = walker.x;
  for (let i = 0; i < crowdSize; i++) {
    crowd.push(new Passerby());
  }
  crowd.sort((a, b) => a.depth - b.depth); // The furthest away drawn first
}

// Turn a black-on-clear frame light, for the dark page (the clear parts stay clear)
function lighten(img) {
  img.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 4) {
    img.pixels[i] = 255 - img.pixels[i];
    img.pixels[i + 1] = 255 - img.pixels[i + 1];
    img.pixels[i + 2] = 255 - img.pixels[i + 2];
  }
  img.updatePixels();
  return img;
}

// Work out the sizes from the window, and space the doors out along the street
function layout() {
  groundY = height * 0.8;
  horizonY = height * 0.32;
  figureScale = constrain(height / 750, 0.6, 1.4);
  let figureHeight = 168 * figureScale;
  doorWidth = figureHeight * 0.6;
  doorHeight = figureHeight * 1.3;
  doorSpacing = max(doorWidth * 2.6, 240);
  doors = pieces.map(([name, url], i) => ({ name, url, x: i * doorSpacing, light: 0 }));
}

function draw() {
  if (frames.length < 12) return; // Still loading
  background(0);

  walk();
  cameraX = lerp(cameraX, walker.x, 0.06); // Follow the walker, with a little ease

  for (let person of crowd) {
    person.update();
    person.show();
  }

  // The street
  stroke(255, 90);
  strokeWeight(1.5);
  line(0, groundY, width, groundY);

  let near = nearestDoor();
  for (let door of doors) {
    showDoor(door, door === near && !walker.entering);
  }
  showWalker();
  showHint();
}

// Move the walker: with the arrow keys (or A and D), or toward a door that was clicked,
// and through a door once it's gone in
function walk() {
  if (walker.entering) {
    walker.enterTime++;
    walker.entering.light = min(1, walker.enterTime / 40);
    if (walker.enterTime === 45) window.location.href = walker.entering.url;
    return;
  }

  let step = 2.2 * figureScale; // How far it walks each frame
  let move = 0;
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) move -= 1; // A
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) move += 1; // D
  if (move !== 0) {
    walker.target = null; // The keys take back control from walking to a door by itself
  } else if (walker.target) {
    let toGo = walker.target.x - walker.x;
    if (abs(toGo) <= step) {
      walker.x = walker.target.x;
      enter(walker.target);
      return;
    }
    move = Math.sign(toGo);
  }

  if (move !== 0) {
    walker.x += move * step;
    walker.direction = move;
    walker.walked += step;
  }
  // Keep to the street
  walker.x = constrain(walker.x, -doorSpacing * 1.5, doors[doors.length - 1].x + doorSpacing * 1.5);
  walker.moving = move !== 0;
}

function enter(door) {
  walker.entering = door;
  walker.enterTime = 0;
}

// The door the walker is standing at, if any
function nearestDoor() {
  return doors.find((door) => abs(door.x - walker.x) < doorWidth * 0.4) || null;
}

// Where something on the street is on the screen
function screenX(streetX) {
  return width / 2 + streetX - cameraX;
}

function showDoor(door, near) {
  let x = screenX(door.x);
  if (x < -doorWidth * 2 || x > width + doorWidth * 2) return;
  let left = x - doorWidth / 2;
  let top = groundY - doorHeight;
  let corner = doorWidth * 0.25;

  push();
  // Light pours out as the walker goes through
  if (door.light > 0) {
    noStroke();
    fill(255, 220 * door.light);
    rect(left, top, doorWidth, doorHeight, corner, corner, 0, 0);
  }
  // A couple of outlines, one inside the other, brighter when the walker's at it
  noFill();
  strokeWeight(1.5);
  for (let i = 0; i < 2; i++) {
    let inset = i * doorWidth * 0.06;
    stroke(255, (near ? 230 : 140) - i * 60);
    rect(left + inset, top + inset, doorWidth - inset * 2, doorHeight - inset, corner, corner, 0, 0);
  }

  // Its name above it, underlined when the walker's there or the mouse is over it
  let hovered = isOverDoor(door, mouseX, mouseY);
  noStroke();
  fill(255, near || hovered ? 255 : 190);
  textAlign(CENTER, BOTTOM);
  textSize(constrain(doorWidth * 0.14, 12, 16));
  text(door.name, x, top - 12);
  if (near || hovered) {
    let w = textWidth(door.name);
    stroke(255, 160);
    strokeWeight(1);
    line(x - w / 2, top - 8, x + w / 2, top - 8);
  }
  if (near && !walker.target) {
    noStroke();
    fill(255, 170);
    textSize(11);
    textAlign(CENTER, TOP);
    text('↑ to go in', x, groundY + 10);
  }
  pop();
}

function showWalker() {
  let figureHeight = 168 * figureScale;
  let frame = walker.moving ? frames[floor(walker.walked / (11 * figureScale)) % frames.length] : frames[standing];
  push();
  translate(screenX(walker.x), groundY - figureHeight / 2);
  // Fades away through the door as it goes in
  if (walker.entering) tint(255, 255 * (1 - walker.entering.light));
  scale(walker.direction * figureScale, figureScale);
  image(frame, 0, 0);
  pop();
}

// A figure in the crowd: walks one way along its own bit of the distance, at its own pace,
// and wraps round when it goes off the side of the screen
class Passerby {
  constructor() {
    this.depth = random(0.2, 0.75); // How close it is: smaller and higher up the screen further away
    this.x = random(width * 1.5);
    this.direction = random([1, -1]);
    this.pace = floor(random(3, 7)); // Frames between steps of its walk cycle
    this.frame = floor(random(frames.length));
    this.counter = 0;
  }

  update() {
    this.counter++;
    if (this.counter % this.pace === 0) {
      this.frame++;
      this.x += 7.5 * figureScale * this.depth * this.direction;
    }
  }

  show() {
    let size = figureScale * this.depth;
    let y = lerp(horizonY, groundY - 30 * figureScale, (this.depth - 0.2) / 0.55) - (168 * size) / 2;
    // Further away, so it slides past more slowly as the camera follows the walker. Wrap
    // round a strip a little wider than the screen.
    let span = width + 200;
    let x = ((((this.x - cameraX * this.depth) % span) + span) % span) - 100;
    push();
    translate(x, y);
    tint(255, 40 + 120 * this.depth); // Fainter in the distance
    scale(this.direction * size, size);
    image(frames[this.frame % frames.length], 0, 0);
    pop();
  }
}

// Is (x, y) on a door or its name?
function isOverDoor(door, x, y) {
  let dx = screenX(door.x);
  return abs(x - dx) < doorWidth * 0.7 && y > groundY - doorHeight - 40 && y < groundY;
}

// A hint at the bottom of the screen, which fades once a door is clicked (or after ten seconds)
function showHint() {
  if (walker.target || frameCount > 600) hintAlpha = max(0, hintAlpha - 4);
  if (hintAlpha <= 0) return;
  push();
  noStroke();
  fill(255, hintAlpha);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text('walk with ← → (or A D), ↑ to go through a door, or click one', width / 2, height - 24);
  pop();
}

function mousePressed() {
  if (walker.entering) return;
  // Clicking a door sends the walker there and through it
  for (let door of doors) {
    if (isOverDoor(door, mouseX, mouseY)) walker.target = door;
  }
}

function mouseMoved() {
  cursor(doors.some((door) => isOverDoor(door, mouseX, mouseY)) ? HAND : ARROW);
}

function keyPressed() {
  if (walker.entering) return false;
  // Up (or W, or Enter) at a door goes through it
  if (keyCode === UP_ARROW || key === 'w' || keyCode === ENTER) {
    let door = nearestDoor();
    if (door) {
      walker.x = door.x;
      enter(door);
    }
  }
  // Stop the arrow keys from scrolling the page
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Keep the walker at the same door
  let at = walker.x / doorSpacing;
  layout();
  walker.x = at * doorSpacing;
  cameraX = walker.x;
}

// Coming back with the browser's Back button can restore the page exactly as it was left,
// with the walker already through a door, so start it fresh instead
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

// This file is a module, so its functions aren't global by default.
// Putting them on window lets p5 find them and run in "global mode".
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseMoved = mouseMoved;
window.keyPressed = keyPressed;
window.windowResized = windowResized;
