// Paints the walk cycle with a p5.brush brush, along the lines of the skeleton in figure.js.
//
// Brush strokes are far too slow to paint a whole crowd every frame, so they're painted once at
// the start, and the crowd stamps the pictures. p5.brush only draws in WebGL, so this uses its
// standalone build, with a hidden canvas of its own.
//
// All the pictures go on one big sheet, a row for each line weight and a column for each step of
// the walk cycle, since the browser draws lots of pictures from one sheet much faster than one
// picture each from lots of canvases.

import * as brush from 'p5.brush/standalone';
import Figure, { poses } from './figure.js';

// How big each picture is, in the frames' own pixels, with room around the figure for the brush
// to wander (a very scattered brush, like spray, could still get cut off at the edges)
export let frameWidth = 96;
export let frameHeight = 174;
// Where the figure stands in the picture
export let feetX = 45;
export let feetY = 160;
export let steps = poses.length * 2; // How many steps there are in the walk cycle
export let gateMargin = 20; // Room around a gate's picture for the post holes and the pen to wander, in pixels
let levels = 4; // How many sizes of the sheet to keep, each half the size of the last

let figure = new Figure();

// Paint the whole walk cycle at each line weight. Gives the sheet at each size, from the full size
// down, since shrinking a big picture a long way looks rough and is slow.
// name: the name of the brush
// weights: how thick its lines are (each brush has its own idea of what 1 is)
// resolution: how many pixels of sheet for each of the frames' own pixels
export function paintSheets(name, weights, resolution) {
  let canvas = brush.createCanvas(frameWidth, frameHeight, { pixelDensity: resolution, parent: null });
  let gl = canvas.getContext('webgl2');

  let sheet = document.createElement('canvas');
  sheet.width = canvas.width * steps;
  sheet.height = canvas.height * weights.length;
  let context = sheet.getContext('2d');

  weights.forEach((weight, row) => {
    for (let step = 0; step < steps; step++) {
      // brush.clear() leaves the canvas a see-through white, which stamps as a white box that
      // wipes out whatever's behind it, so clear it again to properly nothing
      brush.clear();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      paint(step, name, weight);
      brush.render();
      context.drawImage(canvas, step * canvas.width, row * canvas.height);
    }
  });

  makeBlack(sheet);

  // That's all the WebGL needed, and browsers only allow so many contexts at a time
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  let sheets = [sheet];
  for (let i = 1; i < levels; i++) {
    let smaller = document.createElement('canvas');
    smaller.width = Math.ceil(sheet.width / 2 ** i);
    smaller.height = Math.ceil(sheet.height / 2 ** i);
    let smallerContext = smaller.getContext('2d');
    smallerContext.imageSmoothingQuality = 'high';
    smallerContext.drawImage(sheets[i - 1], 0, 0, smaller.width, smaller.height);
    sheets.push(smaller);
  }
  return sheets;
}

// Paint some gates' outlines (with no bottom) and post holes, like hand drawings: each line its own
// stroke, not quite straight, running a little past the corners. Gives a canvas for each,
// gateMargin bigger than the gate on every side, to be stretched to whatever size it's needed.
export function paintGates(count, name, weight, width, height, holeWidth, density) {
  let canvas = brush.createCanvas(width + gateMargin * 2, height + gateMargin * 2, { pixelDensity: density, parent: null });
  let gl = canvas.getContext('webgl2');

  // Everything's measured from the middle of the gate, as the brush does
  let left = -width / 2;
  let right = width / 2;
  let top = -height / 2;
  let bottom = height / 2;
  let pictures = [];
  for (let i = 0; i < count; i++) {
    brush.clear();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    brush.set(name, '#000000', weight);
    stroke(left, bottom, left, top - 3);
    stroke(left - 3, top, right + 3, top);
    stroke(right, top - 3, right, bottom);
    for (let x of [left, right]) {
      stroke(x - holeWidth / 2, bottom, x + holeWidth / 2, bottom);
    }
    brush.render();

    let picture = document.createElement('canvas');
    picture.width = canvas.width;
    picture.height = canvas.height;
    picture.getContext('2d').drawImage(canvas, 0, 0);
    makeBlack(picture);
    pictures.push(picture);
  }
  return pictures;
}

// The brush leaves pale edges on its lines, which show on anything darker than white. Turn every
// bit of it pure black, keeping how see-through it is.
function makeBlack(canvas) {
  let context = canvas.getContext('2d');
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'source-over';
}

// A straight line, as a shaky hand would draw it
function stroke(x1, y1, x2, y2) {
  let points = [];
  let count = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 35));
  for (let i = 0; i <= count; i++) {
    let along = i / count;
    let shake = i === 0 || i === count ? 0.3 : 1;
    points.push([
      x1 + (x2 - x1) * along + (Math.random() - 0.5) * shake,
      y1 + (y2 - y1) * along + (Math.random() - 0.5) * shake,
    ]);
  }
  brush.spline(points, 0.6);
}

function paint(step, name, weight) {
  let j = figure.joints(poses[step % poses.length]);
  // The brush measures from the middle of its canvas
  let toImage = (point) => [point.x + feetX - frameWidth / 2, point.y - j.ground + feetY - frameHeight / 2];

  brush.set(name, '#000000', weight);
  for (let side of [j.far, j.near]) {
    brush.spline(side.arm.map(toImage), 0);
    brush.spline(side.leg.map(toImage), 0);
  }
  brush.spline([j.shoulders, j.hips].map(toImage), 0);
  let [headX, headY] = toImage(j.head);
  brush.circle(headX, headY, figure.headRadius);
}
