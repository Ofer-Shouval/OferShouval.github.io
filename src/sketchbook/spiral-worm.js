// Trying out: a worm drawn by the line of the noisy spiral. One line coils round and round the worm's body from its
// tail to its head, like a spring bent along its path, and the path weaves away into the distance, toward a point up
// near the horizon, like the psychworm in space in the sketchbook. Its tail's nearest, at the spiral, and each turn of
// the coil is smaller the further away it is. Like the noisy spiral, each point on the line comes partly from the last
// one, by an amount that's different every time, which makes it noisy, and the noise changes a few times a second.
// Its tail stays where it comes off the spiral until the spiral's all unwound. Then it's free: its tail drifts about the
// screen, and once it's let go and jolts forward, stars streak past, out from the point it's heading toward, as they do round the psychworm (see
// drawStars() in flow.js), so it looks like it's set off, moving forward. Then its tail's let go, and the view comes
// round to the psychworm's, like a rubber band let go (see stretchTime): from just above and behind it, with its tail near, at the bottom of the screen, as it
// weaves through space (see seenFromBehind() in flow.js).
//
// It curves about wildly like the noisy spiral's roses, with noise that changes quickly from point to point, but it's
// held in close to the body, gently, so it never flies out into spikes.
//
// It comes out of the noisy spiral itself, in the middle of the screen: the spiral's line carries straight on into the
// worm's coil, which starts as wide as the spiral and round it, and narrows and drifts out onto the worm's path over
// the first part of the worm (see emerge). It unwinds like thread off a spool: the spiral's used up from the outside in,
// as the worm gets longer, its head leading the way out, until the spiral's gone (see unwindTime).
//
// Trying out how it could end the noisy spiral stage in the sketchbook: it opens on the noisy spiral, big, as it is
// there (see spiralTime), loose at first and winding tighter, with its lines closer and closer together and the line
// longer and longer, always as big. Then the worm comes out of it. Once the worm's let go and jolted forward, it flies on
// for a moment, and a portal comes up ahead of it, where it's heading, near the horizon: a little white ring, black
// inside, which waits a moment (see portalHold) and then starts to grow,
// drifting to the middle of the screen as the worm slowly gets nearer. It flies into it, head first, growing faster and
// faster as the stars rush past, and once it's as wide as the screen's smaller side, its middle fades to white, as it
// goes on to cover the screen (see portalAfter), which is where it
// goes on to the art page, white too. The noisy spiral's lightning flashes all through it, some of it in the colours of the
// Luminin, until the end (see strikeEvery), apart from while it's unwinding into the worm, when there's only what
// someone asks for: pressing the mouse brings a flash of lightning, and letting go of it sets the spiral bursting into a rose.
// Run it by itself at /art/sketchbook/test.html?sketch=spiral-worm.

// The worm
const turns = 18; // How many times the line coils round its body, from its tail to its head
const size = 1; // How fat it is, compared to the psychworm
const bodyTime = 4; // How many seconds back along its path its tail is
const headDistance = 4; // How far away its head is, compared to its tail, which is at the spiral
const bodyScale = 2; // How big it's drawn
const weaveSpeed = 0.2; // How quickly it weaves (smaller = slower)
const weaveWide = 1.3; // How far it weaves from side to side, as a share of the screen's width
const weaveTall = 0.6; // ...and up and down, as a share of the screen's height
const weaving = 0.5; // How much of its weave shows, as it goes away (0 = straight away from the spiral)
const horizon = 0.25; // How far down the screen the point it's heading away toward is

// The stars streaking past (as in flow.js)
const starCount = 120;
const starSpeed = 0.35; // How much of the way to the camera a star comes each second
const setOffTime = 3.5; // How many seconds after it's free its tail's let go, and its tail takes to start drifting
const driftWide = 0.25; // How far its tail drifts from the middle of the screen, once it's free, as a share of the width
const driftTall = 0.12; // ...and up and down, as a share of the height
const driftSpeed = 0.15; // How quickly it drifts (smaller = slower)

// The psychworm's view, which it comes round to once it's set off (as in flow.js)
const releaseTime = 4; // How many seconds that takes

// Like a rubber band: just before its tail's let go, it's pulled out longer and thinner, while the camera rises to look
// down on it, so the stretch shows. Once it's let go, it snaps back to its usual size, and spins round itself: its coil
// turns round the middle of its body, like a drill bit spinning, while its body stays on its path.
const stretchTime = 3; // How many seconds before it's let go it starts stretching
const stretchOut = 2; // How much longer it gets (1 = twice as long)
const stretchCalm = 0.85; // How much its noise calms down while it's stretched out, pulled taut (1 = a plain coil)
const snapTime = 0.07; // How quickly it snaps back once it's let go, in seconds (bigger = slower)
const lookDown = 0.6; // How far above the top of the screen the point it's heading for goes as the camera rises, as a share of the screen's height
const lookDownDepth = 1.5; // How far away its head looks then, compared to its tail (less than headDistance, so it lies out across the screen)
const formingSlide = 0.86; // How far down the screen the spiral and the worm's tail slide as it forms, as the camera moves up and forward (0.5 = staying in the middle)
const formingLift = 0.8; // How far the camera's risen, as the worm forms out of the spiral, by the time it's all unwound (1 = as far as for the stretch)
const formingZoom = 0.85; // How small everything's got, as the camera pulls back while it moves up and forward, by the time it's formed (1 = not at all)
const settleView = 0.35; // How quickly the camera comes back down once it's let go, in seconds (bigger = slower)
// As it's let go and snaps back, it jolts forward: the stars rush past much faster for a moment, and slow back down
const joltStars = 5; // How much faster the stars go at the height of it
const joltOut = 0.8; // How quickly they slow back down, in seconds (bigger = slower)
const tailSnap = 0.7; // How far in toward its body its tail snaps as it's let go (1 = all the way)
const tailSnapPart = 0.3; // How much of the worm, from its tail, snaps in
const tailSnapIn = 0.04; // How many seconds snapping in takes
const tailSnapOut = 0.45; // ...and how many it takes to go back out
const spinSpeed = 6; // How quickly it spins round itself once it's let go, in radians a second

// Its tail stays at the middle of the spiral until it's let go, and then it's pushed out, going round and round it
const circling = 0.35; // How far out from the middle of the spiral its tail goes round, compared to how far the spiral reaches
const circlingSpeed = 2.5; // How quickly it goes round, in radians a second
const circlingPush = 3; // How many seconds after it's let go it takes to be pushed all the way out
const circlingTail = 0.4; // Once it's let go, how much of the worm, from its tail, goes round with it
const tailDistance = 0.9; // How far its tail is from the camera (1 = at its full size, and less is nearer)
const tailWander = 0.15; // How quickly its tail drifts around the screen (smaller = slower)
const tailWide = 0.4; // How far it can drift from the middle of the screen, as a share of the width
const tailTall = 0.1; // ...and up and down, as a share of the height
const cameraAbove = 0.5; // How far the camera is above it, as a share of the screen's height

// The noise (as in the noisy spiral in flow.js)
const ticks = 12; // How many times a second it changes
const spin = 1; // How far the coil turns each time it changes, in radians
// The rose (as strikeRose in flow.js)
const roseRoughness = 0.8; // How much of the last point goes into the next is 1 / this, times the noise (under 1 = wilder)
const roseSteps = 70; // How many points on the line for each turn
const roseNoise = 0.05; // How quickly the noise changes from one point to the next (as the noisy spiral's step)
const roseReach = 2; // How far out it can go, compared to the body's width there: it's held in more and more toward that
// The noisy spiral it opens on, before the worm comes out of it
const spiralTime = 6; // How many seconds it's there before it starts unwinding
const spiralBig = 2.8; // How far out it goes: the smaller side of the screen divided by this (as in flow.js)
const roseSettling = 0.05; // How quickly it gets back to how it was wound, after bursting into a rose, each time it changes (as spiralSettling in flow.js)
const roseTightness = 250; // Lightning, and letting go of the mouse, set it bursting into a rose, wound at least this tightly (as strikeRose in flow.js)
// Lightning, as in the noisy spiral in flow.js: the colours swap for a moment every so often, and each flash sets the spiral
// bursting into a rose. Flashes are kept at least strikeGap apart, so there can't be more than three in a second, which is
// the limit for not being a danger to people with epilepsy.
const strikeEvery = [3, 9]; // How many seconds there are between strikes, at the least and the most
const strikesFirst = 3; // How many strikes it opens with
const strikesFirstEvery = [0.5, 1.1]; // How many seconds there are between those
const strikeLength = 0.06; // How many seconds a flash stays at its brightest
const strikeFade = 0; // ...and how many it takes to fade out after that (0 = it cuts out)
const strikeGap = 0.4; // How many seconds there are from the start of one flash to the start of the next, in a double strike
const strikeDouble = 0.4; // How often a strike flashes twice (1 = always)
// Colourful lightning: some strikes flash a fragment of the stabilized close-up of the Luminin, rather than white
const strikeClip = '/media/lumininCloseupStabilized.mp4';
const strikeInColour = 0.7; // How often a strike's in colour (1 = always), as long as the video's ready
const strikeClipLength = 0.1; // How many seconds a strike in colour lasts. It cuts in and out, without fading.
const strikeClipCrop = [0.35, 0.8]; // How much of the width and height of the video a fragment shows, at the least and the most
// The end: once it's flown on a while, a portal comes up ahead of it, and grows until the screen fills with white
const portalAfter = 2.5; // How many seconds after it's let go the portal comes up
const portalTime = 8; // How many seconds it takes to grow until it covers the screen
const portalWhite = 1.5; // How many seconds its middle takes to fade from black to white, once it's as wide as the screen's smaller side
const portalSmallest = 16; // How wide it is when it comes up, in pixels
const portalHold = 2.5; // How many seconds it stays that small, an empty ring, before it starts to grow
const portalFollow = 0.6; // How slowly it drifts, in seconds (bigger = slower)
const portalRing = 2; // How thick its white ring is, in pixels
const portalPull = 0.9; // How far into its middle the worm's drawn by the end (1 = all the way, to a point)
const artPage = '/art/'; // Where it goes once the screen's white
const exitRush = 12; // How much faster the stars go by the time it's covered the screen
// The spiral it comes out of (as the noisy spiral in flow.js)
const unwindTime = 6; // How many seconds the spiral takes to unwind into the worm
const emerge = 0.25; // How much of the worm, from its tail, it takes to come out of the spiral and onto its own path
const spiralReach = 5; // Sets how far out its tail goes round, once it's let go (see circling): the smaller side of the screen divided by this
const spiralStep = 0.05; // How far around it goes between one point and the next, in radians
const spiralMostPoints = 20000; // It has to stop somewhere if the noise runs away
const spiralRoughest = 0.5; // How much of the last point goes into the next is 1 / this, times the noise...
const spiralSmoothest = 3; // ...smoothing out to this
const spiralSmoothing = 0.05; // ...by this much each time it changes
const loosest = 1; // How tightly it's wound at first (bigger = more turns, closer together), as spiralLoosest in flow.js
const tightest = 1; // ...tightening up to this over tightenTime
const tightenTime = spiralTime; // In seconds: so it's loose when it opens, and as tight as it gets just as it starts to unwind
const thinnest = 1; // How thick the line is, in pixels, at the head
const thickest = 3; // ...and at the tail

export default function spiralWorm(p, container) {
  let spiralRoughness = spiralRoughest;
  let unwindStart = 0; // When it started unwinding, in seconds
  let openedAt = 0; // When the noisy spiral opened, in seconds
  let roseFloor = 0; // How tightly the spiral's wound at least, once it's burst into a rose

  // Start again, from the noisy spiral
  function restart() {
    openedAt = seconds;
    unwindStart = seconds + spiralTime;
    roseFloor = 0;
    stars.length = 0;
    portalAt = null;
    fillsAt = null;
    wormIn = false;
    nextStrike = seconds; // It opens with lightning
    firstStrikes = strikesFirst;
    spiralRoughness = spiralRoughest;
  }
  const stars = [];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; // No lightning for anyone who's asked for less motion
  let nextStrike = 0; // When the next flash of lightning is
  let strikeEnds = 0; // When the one that's happening ends
  let strikeStarted = -Infinity; // When it started
  let asked = false; // Was the next one asked for, by pressing the mouse?
  let strikeFades = true; // Does the flash that's happening fade out? The ones in colour just stop.
  let firstStrikes = 0; // How many of the strikes it opens with are still to come
  let secondFlash = false; // Is the flash that's happening the second of a double strike?
  let clipCrop = null; // The part of the video the strike that's happening shows, if it's in colour
  let clipMoved = true; // Has the video been moved on to somewhere new since it was last shown?
  const clip = document.createElement('video');
  clip.muted = true;
  clip.loop = true;
  clip.playsInline = true;
  clip.preload = 'auto';
  let stretch = 1; // How long the worm is, compared to usual (see stretchTime)
  let lift = 0; // How far the camera's risen to look down on it, from 0 to 1
  let spun = 0; // How far it's spun round itself, in radians
  let rushing = 0; // How hard the stars are rushing past, as it jolts forward, from 0 to 1
  let portalAt = null; // Where the portal is, once it's open
  let fillsAt = null; // When it got as wide as the screen's smaller side
  let leaving = false; // Has it gone on to the art page?
  let wormIn = false; // Has all of the worm gone into the portal?
  let turned = 0;
  let row = 0; // The row of noise it's using now
  let due = 0;
  let seconds = 0;

  // Where the worm's path is at a given time
  function weaveAt(time) {
    return {
      x: (p.noise(time * weaveSpeed) - 0.5) * 2 * weaveWide * p.width,
      y: (p.noise(time * weaveSpeed, 100) - 0.5) * 2 * weaveTall * p.height,
    };
  }

  // Where a place along the worm shows on the screen (along: 0 at the tail, 1 at the head). The tail's at the spiral,
  // in the middle of the screen, and the rest goes away from there, smaller and smaller toward the horizon, weaving
  // along its path as it goes.
  function awayFrom(along, centre) {
    const closer = 1 / p.lerp(1, p.lerp(headDistance, lookDownDepth, lift), along * stretch);
    const place = weaveAt(seconds - (1 - along) * bodyTime);
    const tail = weaveAt(seconds - bodyTime);
    const farX = p.width / 2;
    const farY = p.lerp(p.height * horizon, -p.height * lookDown, lift); // Further up as the camera rises
    return {
      x: farX + (centre.x - farX) * closer + (place.x - tail.x) * weaving * closer,
      y: farY + (centre.y - farY) * closer - (place.y - tail.y) * weaving * closer,
      closer,
    };
  }

  // Stars streaking out from where it's heading, each a line from where it was last frame to where it is now
  function drawStars(dt, shown, faster, ink) {
    if (shown <= 0) return;
    if (!stars.length) {
      for (let i = 0; i < starCount; i++) stars.push({ x: p.random(-1, 1), y: p.random(-1, 1), z: p.random(0.05, 1) });
    }
    const farX = p.width / 2;
    const farY = p.height * horizon;
    const reach = Math.max(p.width, p.height) * 0.5;
    for (const star of stars) {
      const fromX = farX + (star.x * reach) / star.z;
      const fromY = farY + (star.y * reach) / star.z;
      star.z -= starSpeed * (1 + joltStars * rushing + faster) * dt;
      if (star.z < 0.05) {
        star.x = p.random(-1, 1);
        star.y = p.random(-1, 1);
        star.z = 1;
        continue;
      }
      p.stroke(ink, 255 * (1 - star.z) * shown);
      p.strokeWeight(1 + (1 - star.z));
      p.line(fromX, fromY, farX + (star.x * reach) / star.z, farY + (star.y * reach) / star.z);
    }
  }

  // The spiral bursts into a rose, while there's still some of it. Lightning sets it off, and so does letting go of the mouse.
  function roseBurst() {
    if (seconds >= unwindStart + unwindTime) return;
    spiralRoughness = spiralRoughest;
    roseFloor = roseTightness;
  }

  // How bright the flash of lightning is, from 0 to 1. Moves on to the next one when it's time.
  function strikeLight(ending) {
    if (calm || ending) return 0;
    // None comes by itself while it's unwinding: it waits until that's over
    const unwinding = seconds >= unwindStart && seconds < unwindStart + unwindTime;
    if (seconds >= nextStrike && unwinding && !asked) nextStrike = unwindStart + unwindTime + p.random(...strikeEvery);
    if (seconds >= nextStrike) {
      asked = false;
      strikeStarted = seconds;
      pickFragment();
      strikeFades = !clipCrop;
      strikeEnds = seconds + (clipCrop ? strikeClipLength : strikeLength);
      roseBurst();
      if (firstStrikes > 0) {
        firstStrikes--;
        secondFlash = false;
        nextStrike = seconds + (firstStrikes > 0 ? p.random(...strikesFirstEvery) : p.random(...strikeEvery));
      } else {
        secondFlash = !secondFlash && p.random() < strikeDouble;
        nextStrike = seconds + (secondFlash ? strikeGap : p.random(...strikeEvery));
      }
    }
    if (seconds < strikeEnds) return 1;
    return strikeFades && strikeFade > 0 ? Math.max(0, 1 - (seconds - strikeEnds) / strikeFade) : 0;
  }

  // Whether the strike starting now is in colour, and which part of the video it shows
  function pickFragment() {
    clipCrop = null;
    if (clip.readyState < 2 || clip.seeking || p.random() >= strikeInColour) return;
    const share = p.random(...strikeClipCrop);
    const wide = clip.videoWidth * share;
    const tall = clip.videoHeight * share;
    clipCrop = { x: p.random(clip.videoWidth - wide), y: p.random(clip.videoHeight - tall), wide, tall };
    clipMoved = false;
  }

  // The ground, with any lightning in it: white for a moment, or a fragment of the video. Gives the colour to draw in,
  // whichever the ground isn't.
  function drawGround(light) {
    const context = p.drawingContext;
    if (clipCrop && light > 0) {
      p.background(0);
      context.save();
      context.globalAlpha = light;
      context.drawImage(clip, clipCrop.x, clipCrop.y, clipCrop.wide, clipCrop.tall, 0, 0, p.width, p.height);
      context.restore();
      return 255;
    }
    if (light === 0) {
      clipCrop = null;
      // Once it's over, the video moves on to somewhere new
      if (!clipMoved && clip.readyState >= 1) {
        clip.currentTime = p.random(clip.duration);
        clipMoved = true;
      }
    }
    const ground = 255 * light;
    p.background(ground);
    return ground > 127 ? 0 : 255;
  }

  // Where the camera is, in the psychworm's view: wherever puts the tail where it's drifted to on the screen
  function cameraAt(time) {
    const tail = weaveAt(time - bodyTime);
    return {
      x: tail.x - (p.noise(time * tailWander, 200) - 0.5) * 2 * tailWide * p.width,
      y: tail.y - (p.noise(time * tailWander, 300) - 0.5) * 2 * tailTall * p.height,
    };
  }

  // Where a place along the worm shows on the screen in the psychworm's view (along: 0 at the tail, 1 at the head)
  function seenFromBehind(along, camera) {
    const closer = 1 / p.lerp(tailDistance, headDistance, along * stretch);
    const place = weaveAt(seconds - (1 - along) * bodyTime);
    return {
      x: p.width / 2 + (place.x - camera.x) * closer,
      y: p.height * horizon + (p.height * cameraAbove - (place.y - camera.y)) * closer,
      closer,
    };
  }

  p.setup = () => {
    const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    clip.src = strikeClip;
    clip.addEventListener('loadedmetadata', () => (clip.currentTime = p.random(clip.duration)), { once: true });
    if (!calm) clip.play().catch(() => {});
    restart();
    // Pressing the mouse brings a flash of lightning, as long as it's not too soon after the last (see strikeGap), and
    // letting go sets the spiral bursting into a rose
    canvas.mousePressed(() => {
      if (seconds - strikeStarted >= strikeGap) {
        nextStrike = seconds;
        asked = true;
      }
    });
    canvas.mouseReleased(roseBurst);
  };

  p.draw = () => {
    const dt = Math.min(p.deltaTime / 1000, 0.1);
    seconds += dt;
    due += dt;
    if (due >= 1 / ticks) {
      due %= 1 / ticks;
      row = p.random(1000);
      turned += spin;
      if (spiralRoughness < spiralSmoothest) spiralRoughness += spiralSmoothing;
      roseFloor *= 1 - roseSettling; // The rose wears off
    }

    const context = p.drawingContext;
    const unwound = Math.min(1, Math.max(0, (seconds - unwindStart) / unwindTime)); // How much of it's unwound, from 0 to 1
    // Once it's all unwound, it's free, and sets off
    const freeFor = seconds - unwindStart - unwindTime;
    const setOff = freeFor > 0 ? Math.min(1, freeFor / setOffTime) : 0;
    const settingOff = setOff * setOff * (3 - 2 * setOff);
    // ...and then the view comes round to the psychworm's
    const release = Math.min(1, Math.max(0, (freeFor - setOffTime) / releaseTime));
    const released = 1 - (1 - release) ** 3; // Setting off straight away, the moment it's let go, and slowing as it settles
    const camera = cameraAt(seconds);
    // The rubber band: pulled out just before it's let go, as the camera rises, then snapping back
    const sinceLetGo = freeFor - setOffTime;
    // ...and once it's flown on a while, rushing faster and faster until the screen's white
    const portalUp = sinceLetGo > portalAfter; // Has the portal come up?
    const exiting = Math.min(1, Math.max(0, (sinceLetGo - portalAfter - portalHold) / portalTime)); // How far it's grown
    const ink = drawGround(strikeLight(portalUp));
    drawStars(dt, sinceLetGo > 0 ? 1 : 0, exitRush * exiting * exiting, ink); // No stars until it jolts forward, then all at once
    const forming = unwound * unwound * (3 - 2 * unwound); // How far it's formed, eased
    if (sinceLetGo < 0) {
      const pulled = Math.min(1, Math.max(0, (sinceLetGo + stretchTime) / stretchTime));
      const stretching = pulled * pulled; // Faster and faster, so it's let go right at its farthest, not after it's eased to a stop
      stretch = 1 + stretchOut * stretching;
      // Rising as the worm forms, and held there through the stretch: rising more would flatten it out, and pull it
      // back in just before it's let go
      lift = formingLift * forming;
    } else {
      stretch = 1 + stretchOut * Math.exp(-sinceLetGo / snapTime);
      lift = formingLift * Math.exp(-sinceLetGo / settleView);
    }
    // ...jolting forward as it snaps back, with the stars rushing past
    rushing = sinceLetGo > 0 ? Math.exp(-sinceLetGo / joltOut) : 0; // At its height the moment the stretch lets go
    // ...and spinning round itself once it's let go
    if (sinceLetGo > 0) spun += spinSpeed * (1 - Math.exp(-sinceLetGo / snapTime)) * dt;
    else spun = 0;
    const perTurn = roseSteps;
    const total = Math.max(1, Math.round(turns * perTurn * unwound)); // The worm's only as long as the thread that's come off
    // The spiral's in the middle of the screen, and slides down it as the camera moves up and forward over it
    const centre = { x: p.width / 2, y: p.height * p.lerp(0.5, formingSlide, forming) };
    // Where its tail is: where it comes off the spiral, until it's free, and then drifting about
    // ...going round and round, a little way out from the middle of the spiral
    const pushed = sinceLetGo > 0 ? Math.min(1, sinceLetGo / circlingPush) : 0;
    const round = circling * (Math.min(p.width, p.height) / spiralReach) * pushed * pushed * (3 - 2 * pushed);
    const circle = { x: Math.cos(seconds * circlingSpeed) * round, y: Math.sin(seconds * circlingSpeed) * round };
    const tailAt = {
      x: centre.x + circle.x + (p.noise(seconds * driftSpeed, 200) - 0.5) * 2 * driftWide * p.width * settingOff,
      y: centre.y + circle.y + (p.noise(seconds * driftSpeed, 300) - 0.5) * 2 * driftTall * p.height * settingOff,
    };

    // The spiral, out from the middle of the screen. Each point comes partly from the last one, by a different
    // amount every time.
    const spiral = [];
    // As big as in the sketchbook, however tightly it's wound: tighter, it just goes round more times before it gets there
    const limit = Math.min(p.width, p.height) / spiralBig;
    const winding = loosest * Math.pow(tightest / loosest, Math.min(1, (seconds - openedAt) / tightenTime));
    const tightness = Math.max(winding, roseFloor);
    let x = 0;
    let y = 0;
    let around = 0;
    for (let i = 0; i < spiralMostPoints && Math.hypot(x, y) < limit; i++) {
      const wobble = p.noise(around, row);
      const radius = (around * around) / tightness;
      x = radius * Math.cos(around) + (x / spiralRoughness) * wobble;
      y = radius * Math.sin(around) + (y / spiralRoughness) * wobble;
      // Turned with the coil
      spiral.push({ x: centre.x + x * Math.cos(turned) - y * Math.sin(turned), y: centre.y + x * Math.sin(turned) + y * Math.cos(turned) });
      around += spiralStep;
    }
    spiral.length = Math.round(spiral.length * (1 - unwound)); // What's left on the spool: it comes off from the outside in
    const last = spiral[spiral.length - 1] ?? centre;
    const startAngle = Math.atan2(last.y - tailAt.y, last.x - tailAt.x); // Where the coil carries on from, round its tail
    const startRadius = spiral.length ? Math.hypot(last.x - tailAt.x, last.y - tailAt.y) : 0; // Nothing to come from once it's all unwound

    // Where the worm's line goes, worked out from the tail, since each point comes from the one before
    const points = [];
    let offX = 0; // Where the line is, round the middle of its body
    let offY = 0;
    for (let i = 0; i <= total; i++) {
      const along = (i / total) * unwound; // 0 at the tail, 1 at the head, once it's all come off
      const coming = Math.min(1, along / emerge);
      // How far it's come out of the spiral, from 0 to 1, all of it once its tail's let go
      const leaving = p.lerp(coming * coming * (3 - 2 * coming), 1, released);
      const away = awayFrom(along, tailAt);
      let behind = away;
      if (released > 0) {
        // In the psychworm's view, the tail end still goes round, less and less further along it
        const seen = seenFromBehind(along, camera);
        const going = Math.max(0, 1 - along / circlingTail) ** 2;
        behind = { x: seen.x + circle.x * going, y: seen.y + circle.y * going, closer: seen.closer };
      }
      const onPath = {
        x: p.lerp(away.x, behind.x, released),
        y: p.lerp(away.y, behind.y, released),
        closer: p.lerp(away.closer, behind.closer, released),
      };
      const middle = { x: p.lerp(tailAt.x, onPath.x, leaving), y: p.lerp(tailAt.y, onPath.y, leaving) };
      const body = (Math.sin(along * Math.PI) * (p.width / 8) * bodyScale * onPath.closer * size) / 2 / Math.sqrt(stretch); // Thinner as it stretches
      const radius = p.lerp(startRadius, body, leaving);
      const angle = startAngle + (i / perTurn) * Math.PI * 2;
      // Each point partly from the last one, by a different amount every time
      const wobble = p.noise(i * roseNoise, row);
      offX = radius * Math.cos(angle) + (offX / roseRoughness) * wobble;
      offY = radius * Math.sin(angle) + (offY / roseRoughness) * wobble;
      // Held in, more and more the further out it is, so it curves back round before it can spike
      const out = Math.hypot(offX, offY);
      const most = roseReach * radius * 2;
      if (out > 0 && most > 0) {
        const held = (most * Math.tanh(out / most)) / out;
        offX *= held;
        offY *= held;
      }
      // Coming out of the spiral, it starts as a plain circle round it, from where the spiral ended, and the noise comes in
      const plainX = radius * Math.cos(angle);
      const plainY = radius * Math.sin(angle);
      // Turned round the middle of its body by how far it's spun
      // ...and calming down while it's stretched taut
      const noisy = leaving * (1 - stretchCalm * ((stretch - 1) / stretchOut));
      const roundX = p.lerp(plainX, offX, noisy);
      const roundY = p.lerp(plainY, offY, noisy);
      const c = Math.cos(spun);
      const sn = Math.sin(spun);
      points.push({ x: middle.x + roundX * c - roundY * sn, y: middle.y + roundX * sn + roundY * c, along });
    }

    // As it's let go, its tail snaps in toward its body, like the end of a rubber band, and goes back out
    const snapping = sinceLetGo > 0 ? tailSnap * (1 - Math.exp(-sinceLetGo / tailSnapIn)) * Math.exp(-sinceLetGo / tailSnapOut) : 0;
    if (snapping > 0.001) {
      const body = points[Math.min(total, Math.round(total * (tailSnapPart / Math.max(unwound, 0.001))))];
      for (const point of points) {
        if (point.along >= tailSnapPart) break;
        const pulled = snapping * (1 - point.along / tailSnapPart);
        point.x += (body.x - point.x) * pulled;
        point.y += (body.y - point.y) * pulled;
      }
    }

    // The portal, out ahead where the worm's heading, near the horizon, drifting to the middle of the screen as it gets
    // nearer, growing faster and faster until it covers the screen: a white ring, its middle getting
    // lighter and lighter until it's white. It goes behind the worm, so the worm goes into it head first.
    if (portalUp) {
      const head = points[total];
      // Out ahead, where it's heading, near the horizon, drifting to the middle of the screen as it grows
      const nearer = exiting * exiting * (3 - 2 * exiting);
      const wanted = { x: p.width / 2, y: p.lerp(p.height * horizon, p.height / 2, nearer) };
      portalAt ??= { ...wanted };
      const keep = 1 - Math.exp(-dt / portalFollow);
      portalAt.x += (wanted.x - portalAt.x) * keep;
      portalAt.y += (wanted.y - portalAt.y) * keep;
      const covers = Math.hypot(Math.max(portalAt.x, p.width - portalAt.x), Math.max(portalAt.y, p.height - portalAt.y));
      // Growing by the same share each moment, so it's slow while it's small and races at the end, like something
      // coming nearer
      const radius = (portalSmallest / 2) * Math.pow(covers / (portalSmallest / 2), exiting);
      context.beginPath();
      context.arc(portalAt.x, portalAt.y, radius, 0, Math.PI * 2);
      // Black in the middle, until it's as wide as the screen's smaller side, and then fading to white
      if (fillsAt === null && radius * 2 >= Math.min(p.width, p.height)) fillsAt = seconds;
      const whiting = fillsAt === null ? 0 : Math.min(1, (seconds - fillsAt) / portalWhite);
      const shade = Math.round(255 * whiting * whiting * (3 - 2 * whiting));
      context.fillStyle = `rgb(${shade},${shade},${shade})`;
      context.fill();
      context.strokeStyle = 'white';
      context.lineWidth = portalRing;
      context.stroke();

      // The worm's drawn in toward its middle as it grows: head first, aiming straight at it, and the rest following,
      // until all of it's going in
      const drawn = exiting * exiting * (3 - 2 * exiting);
      for (const point of points) {
        const pulled = drawn * p.lerp(point.along, 1, drawn * drawn) * portalPull;
        point.x += (portalAt.x - point.x) * pulled;
        point.y += (portalAt.y - point.y) * pulled;
      }
      wormIn = points.every(({ x, y }) => Math.hypot(x - portalAt.x, y - portalAt.y) < radius);
    }

    // The camera pulls back as it moves up and forward, so the worm doesn't grow as it forms: everything's smaller,
    // round the spiral, until the view comes round to the psychworm's
    const zoom = p.lerp(p.lerp(1, formingZoom, forming), 1, released);
    context.save();
    context.translate(centre.x, centre.y);
    context.scale(zoom, zoom);
    context.translate(-centre.x, -centre.y);

    // The spiral, then the worm, drawn a little at a time, each bit as thick as it is near
    context.strokeStyle = `rgb(${ink},${ink},${ink})`;
    context.lineJoin = 'round';
    context.lineWidth = thickest / zoom;
    context.beginPath();
    spiral.forEach(({ x, y }, i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
    const chunk = Math.max(2, Math.round(perTurn / 8));
    for (let end = total; end > 0; end -= chunk) {
      const start = Math.max(0, end - chunk);
      const { along } = points[Math.round((start + end) / 2)];
      context.beginPath();
      context.moveTo(points[start].x, points[start].y);
      for (let i = start + 1; i <= end; i++) context.lineTo(points[i].x, points[i].y);
      context.lineWidth = p.lerp(thickest, thinnest, along) / zoom; // Thicker nearer the camera, at the tail, whatever the zoom
      context.stroke();
    }
    context.restore();

    // The end: once the worm's gone into the portal and it's white, it's on to the art page, white too (or once the
    // portal's covered the screen, whatever happens)
    const faded = fillsAt !== null && seconds - fillsAt >= portalWhite;
    if (((wormIn && faded) || (exiting >= 1 && (fillsAt === null || faded))) && !leaving) {
      leaving = true;
      // So a little worm comes up out of the sketchbook hole when it gets there (see src/sketches/hole_worm.js)
      try {
        sessionStorage.setItem('wormArrives', '1');
      } catch {}
      window.location.href = artPage;
    }
  };
}
