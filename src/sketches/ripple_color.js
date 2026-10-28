// The colour scheme shared by the ripple circles and the boat's wake lines.
// amount goes from 0 to 1 along a trail; colours shift through blues, greens and pinks,
// with a little random flicker. Holding the mouse down turns everything white, and so does
// the boat going through a gate (see turnWhite()).

let whiteOut = false;

// Turn everything white (or back), like holding the mouse down
export function turnWhite(on) {
  whiteOut = on;
}

// Should everything be white right now?
export function isWhite() {
  return mouseIsPressed || whiteOut;
}

export default function rippleColor(amount, alpha) {
  if (isWhite()) return color(255, alpha);
  let s = abs(sin(amount * PI));
  let c = abs(cos(amount * PI));
  return color(random(150, 255) * s, random(150, 255) * c, 255 - random(100, 255) * s, alpha);
}

// Any colour, with the same flicker as the ripples: every frame each of its red, green and
// blue is dimmed by a random amount (like random(150, 255) above). White when isWhite().
export function flicker(hex, alpha) {
  if (isWhite()) return color(255, alpha);
  let c = color(hex);
  return color(red(c) * random(0.6, 1), green(c) * random(0.6, 1), blue(c) * random(0.6, 1), alpha);
}
