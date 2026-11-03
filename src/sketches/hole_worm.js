// A little worm that comes up out of the sketchbook hole on the art page, when the page has been come to through the
// sketchbook (see the end of src/sketchbook/spiral-worm.js, which leaves a note in sessionStorage saying so). It's the
// spiral worm, small: a line coiling round and round its body, in black on the white page. It rises out of the hole,
// and then wafts smoothly about the screen, on and on. It's drawn on a canvas of its own over the page, which lets
// presses through.

const noteKey = 'wormArrives';
const wait = 0.8; // How many seconds the hole has to have been still, on the screen, before it comes out
const waitLongest = 6; // ...or how many seconds after the hole's first been put in place, as long as it's on the screen
const rise = 1.6; // How many seconds it takes to rise out of the hole
const riseHeight = 0.22; // How far up it rises, as a share of the screen's height
const settle = 3; // How many seconds it takes to ease into wafting about, once it's out
const wanderWide = 0.3; // How far it wafts from side to side, as a share of the screen's width
const wanderTall = 0.18; // ...and up and down, as a share of the screen's height
const wanderSpeed = 0.35; // How quickly it wafts about (smaller = slower)
const length = 0.9; // How long its body is, in seconds of where its head's been
const fat = 7; // How fat it is in the middle, in pixels
const turns = 9; // How many times its line coils round its body
const steps = 16; // How many points on its line for each turn
const ripple = 0.3; // How much its coil swells and shrinks along it, slowly (0 = an even coil)

function noteWasLeft() {
  try {
    const left = sessionStorage.getItem(noteKey) === '1';
    sessionStorage.removeItem(noteKey);
    return left;
  } catch {
    return false;
  }
}

const ease = (amount) => amount * amount * (3 - 2 * amount);

if (noteWasLeft() && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none';
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  const density = window.devicePixelRatio || 1;
  const fit = () => {
    canvas.width = innerWidth * density;
    canvas.height = innerHeight * density;
  };
  fit();
  addEventListener('resize', fit);

  const link = document.querySelector('.art-hole[href="/art/sketchbook/"]');
  const mouth = link?.querySelector('.art-hole-mouth');
  let stillSince = null; // Since when the hole's been still, on the screen
  let lastSeen = null; // Where the hole was last frame
  let placedAt = null; // When the hole was first put in its place
  let outAt = null; // When it started coming out
  let from = null; // Where the hole is now. Everything's measured from there, so it stays with the hole as the view moves.

  // Where its head is, this many seconds after it started coming out: rising out of the hole, then wafting about,
  // smoothly, on a path that loops without quite repeating
  const headAt = (t) => {
    if (t <= 0) return { ...from };
    const up = from.y - ease(Math.min(1, t / rise)) * riseHeight * innerHeight;
    if (t <= rise) return { x: from.x, y: up };
    const w = (t - rise) * wanderSpeed;
    const into = ease(Math.min(1, (t - rise) / settle));
    return {
      x: from.x + (Math.sin(w * 0.9) + 0.5 * Math.sin(w * 2.1 + 1)) * wanderWide * innerWidth * into,
      y: up + (Math.sin(w * 1.3 + 2) * 0.8 + 0.4 * Math.sin(w * 2.7)) * wanderTall * innerHeight * into,
    };
  };

  const frame = (now) => {
    const seconds = now / 1000;
    // Where the hole is, from where the art page puts its link: its middle, and half its height above the link's top,
    // which is where its ground is (see placeHoles() in art_walk.js). The link's somewhere else until the art page has
    // painted its crowd, which takes a while.
    if (!mouth || !link.style.left) return requestAnimationFrame(frame);
    from = { x: parseFloat(link.style.left), y: parseFloat(link.style.top) - parseFloat(mouth.style.height) / 2 };
    // Wait until it's on the screen and has stopped moving, since the view moves as the mouse walks on
    if (outAt === null) {
      placedAt ??= seconds;
      const onScreen = from.y > 0 && from.y < innerHeight && from.x > 0 && from.x < innerWidth;
      const moved = lastSeen ? Math.hypot(from.x - lastSeen.x, from.y - lastSeen.y) : Infinity;
      lastSeen = from;
      stillSince = onScreen && moved < 0.5 ? (stillSince ?? seconds) : null;
      const ready = (stillSince !== null && seconds - stillSince >= wait) || (onScreen && seconds - placedAt >= waitLongest);
      if (!ready) return requestAnimationFrame(frame);
      outAt = seconds;
    }
    const t = seconds - outAt;

    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
    context.save();
    // While it's coming out, none of it's drawn below the hole
    if (t < rise + length) {
      context.beginPath();
      context.rect(0, 0, innerWidth, from.y);
      context.clip();
    }
    context.strokeStyle = 'black';
    context.lineWidth = 1.3;
    context.lineJoin = 'round';
    context.beginPath();
    const total = turns * steps;
    for (let i = 0; i <= total; i++) {
      const along = i / total; // 0 at the tail, 1 at the head
      const middle = headAt(t - (1 - along) * length);
      const radius = Math.sin(along * Math.PI) * fat * (1 + ripple * Math.sin(i * 0.35 - t * 2));
      const angle = (i / steps) * Math.PI * 2 + t * 1.5; // Turning slowly round itself
      const x = middle.x + radius * Math.cos(angle);
      const y = middle.y + radius * Math.sin(angle);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
