import p5 from 'p5';
import spiralWorm from './spiral-worm.js';
import { soundButton, startAudio, soundWanted, onSoundChange } from '../scripts/sound.js';

// The sketchbook as one continuous piece: old sketches that turn into each other on the same canvas.
//
// There are no cuts. Every stage is a list of settings, and the settings always drift toward the current
// stage's, and whatever's been painted is what the next sketch starts from. Among the flowers, the pixel array
// closes in as a circle from the corners, like a tunnel, more quickly if the worm's boosting. The flowers and the
// worm carry on as they were while shrinking away, into the array, with the worm's head pulled more and more to the
// middle and the array getting closer to static, the flowers still flying past. When the worm's a few pixels wide, or
// once it's been long enough (see arrayHold), the array absorbs it, and it cuts
// to the noisy spiral bursting out, white on black, with lightning, some of it in the colours of the Luminin. That last
// stage is a sketch of its own, spiral-worm.js, which this hands the screen over to: the spiral unwinds into a worm,
// which flies on to three portals, to art, music and bio, and goes through whichever's chosen. The skip link at the
// bottom goes straight to the portals.
// (The noisy spiral's drawing here, and its ending, growing off the screen to white, aren't used any more.)
//
// Playing moves it along (see screensToNext), and it carries on slowly by itself if nobody's playing
// (see secondsToNext). Psychworm moves on when it's clicked, by flying through a flower: each of its segments turns into
// a flower as it passes through, and it carries on through a field of them. Each sketch also has its own file in this folder (wake.js, psychworm.js,
// flowers.js, pixel-array.js, noisy-spiral.js, and curves.js and finger-aulos.js). Curves, boxyworm and linear boil aren't stages at the
// moment, but their settings and drawing are still here. This file has its own blended version of them, so changing
// one of those files doesn't change this piece.
//
// It opens on the first stage with a welcome that fades in and out (see .flow-intro in main.css), and waits there
// until someone presses, anywhere, which begins the journey into the next stage.
//
// The speaker at the bottom turns the sound on and off, for the whole site (see src/scripts/sound.js). Any stage
// can use it: `sound` is an AudioContext once it's been turned on, which stays silent while it's switched off. The camera isn't offered at the
// moment, but cameraReady() says whether `video` has a picture, for stages that use it (curves, linear boil).
// They work without it.

const stages = [
  {
    name: 'wake',
    hint: 'hold to turn it white',
    settings: { length: 150, flat: 1, box: 0, scatter: 1, wash: 255, washHeld: 255, low: 150, whiteHeld: 1, body: 1, grid: 0, bloom: 0, ground: 0, space: 0, spiral: 0, pixels: 0, curves: 0, coil: 0, noisy: 0 },
  },
  {
    name: 'psychworm',
    hint: 'click for the next sketch, hold to leave trails',
    through: 'flowers', // The stage that going through the ring leads to
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 50, washHeld: 0, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 0, ground: 0, space: 1, spiral: 0, pixels: 0, curves: 0, coil: 0, noisy: 0 },
  },
  {
    name: 'flowers',
    hint: 'hold for a boost, let go to burst, drag to plant more',
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 1, grid: 0, bloom: 1, ground: 255, space: 1, spiral: 0, pixels: 0, curves: 0, coil: 0, noisy: 0 },
  },
  // The pixel array used to be a stage of its own here. It's part of the flowers stage now (see arrayHold).
  {
    name: 'noisy spiral',
    hint: 'click for lightning, let go for a rose',
    sketch: spiralWorm, // The stage is this sketch, which takes over the screen (see handOver())
    settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 0, grid: 0, bloom: 0, ground: 0, space: 0, spiral: 1, pixels: 0, curves: 0, coil: 1, noisy: 1 },
  },
];
// The curves stage, played with your hands, for when it's put back in:
// {
//   name: 'curves',
//   hint: 'open and close your fingers to play, with the sound on',
//   hintWithoutCamera: 'turn the camera on to play it with your hands',
//   settings: { length: 70, flat: 0, box: 0, scatter: 0, wash: 255, washHeld: 255, low: 100, whiteHeld: 0, body: 0, grid: 0, bloom: 0, ground: 255, space: 0, spiral: 0, pixels: 0, curves: 1, coil: 0, noisy: 0 },
// },
const after = '/art/'; // Where it goes after the last stage

const morphTime = 2.5; // How quickly the settings drift to the next stage's, in seconds (bigger = slower)
// Pressing to begin forms the worm where it was pressed: the wake's scattered all over the screen, so first it gathers
// into a circle around there, then into the worm, which then drifts off from there on its own way
const formRound = 0.3; // How far into turning into the worm the wake's become a circle, from 0 to 1
const formRadius = 0.45; // How big the circle is, as a share of the smaller side of the screen
const formTime = 7; // How many seconds the worm takes to drift from where it formed onto its own way
const screensToNext = 25; // How far the pointer travels to reach the next stage, in lengths of the screen's diagonal
const stageSeconds = 15; // Roughly how long each stage lasts if nobody plays with it (the first waits to be pressed). The
// stages that end in their own ways are timed to it: see ringLongest. (The flowers stage has its own timing: see arrayDelay, arrayTime and arrayHold.)
const secondsToNext = stageSeconds; // How long a stage lasts if nobody plays with it, unless it has its own `seconds`
const idleTime = 5; // How many seconds after the pointer stops before the sketch starts moving by itself
// In space, the worm weaves along by itself and the camera follows just above and behind it
const weaveSpeed = 0.2; // How quickly it weaves (smaller = slower)
const weaveWide = 1.3; // How far it weaves from side to side, as a share of the screen's width
const weaveTall = 0.6; // ...and up and down, as a share of the screen's height
const bodyTime = 4; // How many seconds back along its path its tail is, which sets how much of the weave shows
const tailWander = 0.15; // How quickly its tail drifts around the screen (smaller = slower)
const tailWide = 0.4; // How far it can drift from the middle of the screen, as a share of the width: small enough that it can't leave it
const tailTall = 0.1; // ...and up and down, as a share of the height
const tailDistance = 0.9; // How far its tail is from the camera (1 = at its full size, and less is nearer). Too near and it's off the bottom of the screen.
const headDistance = 4; // How far its head is
const spaceHorizon = 0.25; // How far down the screen the point straight ahead of the camera is
const cameraAbove = 0.5; // How far the camera is above it, as a share of the screen's height (bigger = looking down more)
const bodyScale = 2; // How big it's drawn, compared to its size when it isn't in space
// In space a flower waits up ahead, labelled, with the next stage to be seen through its middle. A click, or
// enough time going by, brings it toward the camera, the worm goes through its middle, and that leads to the next stage.
const ringLead = 5; // How many seconds after it sets off the worm's head gets to it
const ringWait = tailDistance + (headDistance - tailDistance) * (1 + ringLead / bodyTime); // How far away it waits, in the same units as headDistance
const ringLabel = 'next sketch';
const ringSmall = 0.2; // How big it is while it waits, compared to what it would be at the worm's head
const ringCovers = 9.7; // How many seconds after it sets off it's covered the screen
const psychwormSeconds = 22; // Roughly how long the psychworm stage lasts if nobody clicks, a little longer than the others
const ringLongest = Math.max(0, psychwormSeconds - ringCovers); // How many seconds into the stage it comes by itself, if nobody's clicked, so it's gone through after psychwormSeconds
const ringRush = 0.2; // How much its growth keeps speeding up on the way, so it never seems to slow (0 = steady, 1 = most of it at the end)
const ringFade = 3; // How slowly the next stage's ground fades from the colour of the flower's middle, in seconds (bigger = slower)
const ringSpin = 0.25; // How quickly it turns, in radians per second
const ringNearest = 0.05; // How near it can get, if the circle in its middle hasn't covered the screen by then
const ringBehind = 0; // How far the camera is above the worm once it's right behind it, as a share of the screen's height
const ringLinedUp = 5.2; // How far away the flower is when the camera's lined up with it, which is before the worm's head gets to it
const ringWash = 160; // How quickly the paint fades while the ring's there, so that the ring doesn't leave a smear behind it
const ringSize = 1.7; // How wide the circle in its middle is, compared to the widest the worm can be
const wormFollow = 0.55; // How closely the worm follows the mouse, at most (1 = exactly, 0 = not at all)
const steerFollow = 0.05; // How quickly the place it's following catches up with the mouse
const focusFollow = 0.06; // How quickly the point the stars stream from catches up with where it's heading
const starCount = 120;
const starSpeed = 0.35; // How much of the way to the camera a star comes each second
const cell = 16; // Size of each square in linear boil
const stirSize = 6; // How far stirring reaches, in squares
const cooling = 0.97; // How much of the stirred heat each square keeps from one frame to the next
const whitenTime = 12; // How many seconds linear boil's squares take to lose their colours and go white
const cameraTime = 3; // How quickly linear boil turns from the painting to the camera, in seconds (bigger = slower)
const fieldCount = 1100; // How many flowers fly by at once, the way the stars do
const fieldSpeed = 0.28; // How much of the distance to the camera they come each second, so they slow down as they get near
const fieldStream = 2.5; // Sets how many appear each second: fieldCount * fieldSpeed / this
const fieldLane = 0.15; // They start at least this far from straight ahead, so they all leave the screen rather than coming right at the camera
const fieldPace = 0.5; // How fast the worm weaves among them, compared to its speed in space
const fieldDelay = 2; // How many seconds after the worm gets there they start to appear
const fieldDrift = 1; // The fastest they drift across the screen as well, in pixels per frame
const fieldSize = 0.25; // How big they are when they first appear, on a screen whose shorter side is 800 pixels
const fieldBiggest = 0.2; // The longest their petals can grow, as a share of the screen's shorter side
const fieldGrow = 1.05; // How quickly they get bigger as they get nearer (1 = in true perspective, and more is quicker)
const fieldFade = 0.3; // How far they come before they've faded in, as a share of the way from where they appear
const fieldClosing = 0.5; // How much smaller they've got by the time the pixel array has covered the screen, from 0 to 1
const fieldLingers = 7.5; // How many seconds they carry on for after that, getting smaller, before they've gone
const mostFlowers = 1400;
const plantedDrift = 2; // How fast planted flowers drift away from the middle of the stream, in pixels per frame. Near it they'd hardly move otherwise.
const burstReach = 1.6; // Going through the ring, how far the worm's flowers are thrown, at most, as a share of the screen's width
const burstExtra = 400; // How many more flowers it throws out, from all along it, which carry on off the screen rather than going back into the worm
const burstExtraSpeed = [0.3, 1]; // How fast they carry on, in shares of the screen's width per second
const burstExtraSize = [0.4, 2.2]; // How big they are, compared to usual, at the least and the most
// Coming through the ring, as the worm's turned into flowers, the field's colour fades in, then the flower worm
// wobbles, more and more, and bursts
const bloomFade = 0.6; // How many seconds it waits, as the field's colour fades in
const bloomWobbleTime = 0.9; // ...and then how many seconds it wobbles before it bursts
const bloomWobble = 0.35; // How far its flowers wobble about, at the most, compared to how big they are
const bloomWobbleSpeed = 9; // How quickly they wobble, in radians a second
const bloomFaint = 0.35; // How see-through the flower worm is, from turning into flowers until it bursts (1 = solid)
const bloomSolid = 1.5; // How many seconds it takes to come back to solid, once it's burst
const burstOut = 5; // How quickly they fly out (bigger = quicker)
const burstApart = 2.4; // How far the worm's own flowers are thrown, compared to burstReach
const burstReturn = 1.5; // How slowly they settle back into the shape of the worm (bigger = slower)
const boostRise = 2; // How quickly holding the mouse down adds speed, in multiples of the usual speed each second
const boostMost = 6; // The most speed it can add
const boostFade = 1.5; // How slowly it wears off when let go, in seconds (bigger = slower)
const boostSpread = 0.02; // How far the worm's flowers have spread at the top speed, at most, as a share of the screen's width
// Letting go of the mouse makes the worm explode, more the longer it was held
const explodeCharge = 3; // How many seconds of holding it takes to reach the biggest explosion
const explodeLeast = 0.05; // How far its flowers are thrown by a quick click, as a share of the screen's shorter side
const explodeMost = 0.8; // ...and by the longest hold
const explodeJets = [2, 6]; // Every explosion throws its flowers out in a few jets, in random directions: this many, at the least and the most
const explodeJetWidth = [0.15, 0.9]; // How wide a jet is, in radians, at the least and the most
const explodeStray = 0.2; // How many of the flowers ignore the jets and go anywhere
const explodeUneven = 2.5; // How uneven the distances are: most flowers stay near, and a few go a long way (1 = evenly spread)
const explodeSpeed = [2, 9]; // How quickly a flower flies out, at the least and the most (bigger = quicker)
const explodeReturn = [0.7, 2.6]; // How slowly a flower comes back, in seconds, at the least and the most
const explodeGrow = 0.5; // How much of its lost size a flower gets back while it's exploding (1 = all of it)
const coilSpin = 0.3; // How quickly the spiral turns while it's still smooth, in radians per second
const wormShrink = 6; // How slowly the worm shrinks away, once the tunnel's started, in seconds (bigger = slower). Boosting speeds it up.
const wormAbsorbedAt = 5; // How wide the worm is, in pixels, when the pixel array absorbs it and the noisy spiral bursts out
const wormStretch = 4; // How many times longer the worm's stretched by the end of the pixel array, as it nears the noisy spiral
const wormThin = 0.25; // ...and how much thinner it is by then (1 = not at all)
const wormAbsorbTime = 0.35; // How many seconds it takes to go from there
const spiralTicks = 12; // How many times a second the noisy spiral changes, however fast the rest is drawn
const spiralStep = 0.05; // How far around it goes between one line and the next, in radians
const spiralReach = 2.8; // It stops at the screen's width or height divided by this
const spiralTurn = 1; // How far it turns each time it changes, in radians
const spiralMostLines = 20000; // Enough for the loosest shape, and it has to stop somewhere if the noise runs away
const spiralWeights = 8; // How many different weights of line it has, from 2 to 3 pixels going out
const spiralRoughest = 1; // How much of the last point goes into the next is 1 / this, times the noise
const spiralSmoothest = 3; // It smooths out to this...
const spiralSmoothing = 0.05; // ...by this much each time it changes
const spiralLoosest = 8; // How tightly it's wound when it bursts out (bigger = more turns, closer together)
const spiralTightest = 300; // ...which it tightens up to, more and more, as the stage goes on
const spiralSettling = 0.05; // How quickly it gets back to that after a click changes it, each time it changes
// In the flowers, the pixel array closes in as a circle from the corners, like a tunnel, until it's taken over
const arrayDelay = 10; // How many seconds into the stage it starts, so the flower worm has a while to itself
// Once the array's absorbed the worm, all static, it switches off like an old TV: the picture squashes to a bright line
// across the middle, the line shrinks to a bright dot, and the dot fades, before the noisy spiral bursts out of the dark
const tvSquash = 0.28; // How many seconds squashing to a line takes
const tvShrink = 0.22; // ...shrinking the line to a dot
const tvFade = 0.4; // ...and the dot fading away
const arrayHold = 10; // How many seconds the flowers go on once the pixel array's covered the screen, while the worm stretches and shrinks away, before it's absorbed anyway
const arrayTime = 10.5; // How many seconds it takes to cover the screen, at the worm's usual speed. Boosting speeds it up by as much.
// Once it's covered the screen, it slowly looks more and more like it's on an old TV: its edges pull in to a rounded
// screen, darker toward its edges, with black around it. Then it cracks: seams break through it, more and more, from
// working the pattern out as if the screen were the wrong width, so each row slips out of step with the one above
const crtTime = 7; // How many seconds taking on the old TV's shape takes, easing in and out
const crtInset = 0.25; // How far its edges pull in, as a share of the screen's smaller side
const crtCorner = 0.16; // How round its corners get, as a share of the screen's smaller side
const crtShade = 0.75; // How dark it gets at its edges (1 = black)
const crackAfter = 4; // How many seconds after it's covered the screen it starts to crack
const crackTime = 4.5; // How many seconds the cracks take to spread
const crackMost = 0.3; // How wrong the width gets, as a share of the real one, by the end
// It moves by itself, as if a mouse were spiralling out from the middle and then going around the edges of the screen
const pathTurns = 1.5; // How many times it goes around on the way out. Any faster and every pixel changes every frame, which flashes.
const pathOut = 35; // How many seconds it takes to get out to the edges. Boosting speeds it up, the same as the fade.
const pathEdge = 0.96; // How far out it goes, as a share of the way to the edge of the screen
// It gets closer and closer to pure static as the worm gets near to being absorbed
const noiseFrom = 60; // How wide the worm is when that starts, in pixels
const noiseFinest = 1.5; // The value of the mouse the pattern ends up using, which is where it's all static
const noiseFollow = 0.03; // How quickly it follows how wide the worm is, each frame
const pixelFollow = 0.1; // How quickly the pixel array catches up with the pointer, each frame
const pixelDriftSpeed = 0.02; // How quickly its curves always flow out of the corners, each frame
const staticReach = 40; // How far from the middle, across the half-size picture, its static starts
const scanSpeed = 0.05; // How quickly its slow waves of colour roll, each frame
const scanEdgeSpeed = 2; // How many times faster they roll with the pointer at the top or bottom
const scanTurn = 0.05; // How quickly they reverse, when the pointer crosses the middle: down when it's above, up when it's below
const curveSpacing = 10; // How far apart the curves are, and the points along them, in pixels
const curveBend = 10; // How far the brightest and darkest points are pushed, in pixels
const curveAcross = 64; // How many points are along each curve
const curveDown = 48; // How many curves there are
const curveCameraTime = 1; // How quickly they turn from their own ripples to the camera, in seconds (bigger = slower)
const curveCalm = 0.2; // How quickly they ripple while there's no camera to follow (smaller = slower)
// Finger aulos: two pipes, one for each hand, and the distance between its thumb and index finger picks its note
const pipeNotes = [
  [207, 220, 233.08, 261.63, 293.66, 329.63, 349.23, 392, 440],
  [261.63, 293.66, 329.63, 349.23, 392, 440, 463.16, 523.25],
];
const pipeLevel = 0.25; // How loud each one is at most (1 = full)
const pinchClosed = 25; // How far apart the fingers are for the lowest note, in pixels of a camera 640 pixels wide
const pinchOpen = 280; // ...and for the note above the highest, so that it's reached before they're fully open
const stringBend = 14; // How far the curves near a hand vibrate, in pixels
const stringReach = 70; // How far around the hand they do it, in pixels, on top of half the distance between its fingers
const stringWaves = [80, 24]; // How long the waves are for the lowest note and the highest, in pixels
const stringTime = 70; // How quickly the waves run along the curves
const handOptions = { maxHands: 2, flipped: false, runtime: 'tfjs', modelType: 'full' };
const spiralBursts = { roughness: 0.5, tightness: [spiralLoosest, spiralLoosest] }; // What it bursts out as: loose and spiky
// Lightning: the noisy spiral's colours swap for a moment every so often. Flashes are kept at least strikeGap apart,
// so there can't be more than three in a second, which is the limit for not being a danger to people with epilepsy.
// How it ends: it grows off the screen, its lines stop fading and pile up, and the screen goes white
const endStarts = 0.6; // How far through the stage that starts, from 0 to 1
const endReach = 3; // How many times its usual size it grows to, which takes it off the screen
const endPiling = 0.9; // How far through the ending its lines have stopped fading, from 0 to 1. After that, the white comes up.
const endWhite = 60; // How strongly the white's being painted over it each frame, at the very end, out of 255
const strikeEvery = [3, 9]; // How many seconds there are between strikes, at the least and the most
const strikesFirst = 3; // How many strikes it opens with, straight after the cut
const strikesFirstEvery = [0.5, 1.1]; // How many seconds there are between those
const strikeLength = 0.06; // How many seconds a flash stays at its brightest
const strikeFade = 0.3; // ...and how many it takes to fade out after that
const strikeGap = 0.4; // How many seconds there are from the start of one flash to the start of the next, in a double strike
const strikeDouble = 0.4; // How often a strike flashes twice (1 = always)
// Colourful lightning: some strikes flash a fragment of the stabilized close-up of the Luminin, rather than white
const strikeClip = '/media/lumininCloseupStabilized.mp4';
const strikeInColour = 0.7; // How often a strike's in colour (1 = always), as long as the video's ready
const strikeClipLength = 0.25; // How many seconds a strike in colour lasts. It cuts in and out, without fading.
const strikeClipCrop = [0.35, 0.8]; // How much of the width and height of the video a fragment shows, at the least and the most
const strikeRose = { roughness: 0.5, tightness: 250 }; // Each flash sets the spiral bursting into a rose: a spiky star that tangles up, wound at least this tightly
// The number keys pick one of these, in order
const spiralShapes = [
  { roughness: 0.7, tightness: [20, 100] },
  { roughness: 3, tightness: [180, 200] },
  { roughness: 4, tightness: [1, 100] },
  { roughness: 0.5, tightness: [1000, 2000] },
  { roughness: 0.5, tightness: [1, 4] },
];

const slug = (name) => name.replace(' ', '-');

export default function flow(p, container) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = { ...stages[0].settings };
  let current = 0;
  let progress = 0;
  let trail = [];
  let focus = { x: 0, y: 0 }; // The point the worm's heading for, which the stars stream from
  let stageStart = 0;
  let burstStart = null; // When the worm burst into flowers, having gone through the ring
  let bloomStart = null; // When it came through the ring, as the flower worm
  let heldFrom = 0; // When the mouse was pressed
  let boost = 0; // How much extra speed there is from holding the mouse down
  let thrownOut = []; // The extra flowers it threw out
  let pathTime = 0; // How far along its path the worm's got, in seconds at its speed in space
  let ringDistance = null; // How far away the ring is, while there is one
  let ringMeets = 0; // When the worm's head gets to it, which says where on the worm's path it is
  let ringWaiting = false; // Is it still waiting for a click?
  let portal = null; // The flower itself
  let groundColour = [0, 0, 0]; // The colour of the middle of the flower that was last gone through
  let groundTint = 0; // How much of that colour is still in the ground (0 = none)
  let steer = { x: 0, y: 0 }; // The place the worm's following, which is the mouse, a little behind
  const steerTrail = []; // Where that's been, so that the rest of the worm can follow it later
  let ringPull = 0; // How far the view has shifted to put the worm through the ring (0 = not at all)
  const stars = [];
  let field = []; // The flowers flying by, furthest first
  let fieldDue = 0; // How many more are due to appear
  const segments = []; // The flowers that the worm is made of, once it's been through the ring
  let frameTime = 0;
  // While the flowers are faint, they're drawn solid here first (see drawWorm())
  const faintLayer = document.createElement('canvas');
  const faintContext = faintLayer.getContext('2d');
  const pixelCanvas = document.createElement('canvas');
  const pixelContext = pixelCanvas.getContext('2d');
  let pixelImage = null;
  let arrayOpening = 0; // How far it's closed in from the corners (1 = it covers the screen)
  let pixelX = 0; // How far from the middle the pointer is, once it's caught up
  let pixelY = 0;
  let arrayPath = 0; // How long it's been moving by itself, while it's been showing
  let pixelDrift = 0;
  let scanDirection = 1; // Which way its waves of colour are heading: 1 is down, -1 is up
  let scanPosition = 0;
  const curveCanvas = document.createElement('canvas'); // The camera, one pixel to a point on the curves
  const curveContext = curveCanvas.getContext('2d', { willReadFrequently: true });
  let curveCamera = new Float32Array(0); // How bright the camera is at each point, from 0 to 1
  let curveMix = 0; // How far they've turned from their own ripples to the camera
  let pictureChecked = false; // Has the camera's picture been checked for being blank?
  let handTracker = null; // Loaded the first time it's needed, since it's big and the model comes from the web
  let handTrackerLoading = false;
  let trackingHands = false;
  let hands = [];
  let pipes = null; // The two oscillators and their volumes, once the sound's been turned on
  let pipeAmount = 0; // How far the pipes have faded in
  let spiralLines = []; // The noisy spiral's lines, one path for each weight
  let nextStrike = 0; // When the next flash of lightning is
  let strikeEnds = 0; // When the one that's happening ends
  const clip = document.createElement('video'); // Only loaded once it's getting near (see goTo())
  clip.muted = true;
  clip.loop = true;
  clip.playsInline = true;
  clip.preload = 'auto';
  let strikeFades = true; // Does the flash that's happening fade out? The ones in colour just stop.
  let clipCrop = null; // The part of the video the strike that's happening shows, if it's in colour
  let clipMoved = true; // Has the video been moved on to somewhere new since it was last shown?
  let firstStrikes = 0; // How many of the strikes it opens with are still to come
  let secondFlash = false; // Is there another straight after this one?
  let fieldLeft = 1; // How much of their size the flowers flying by have left
  let arrayNoise = 0; // How close the pixel array is to pure static (1 = all the way)
  let arrayFullAt = null; // When it covered the screen, in the flowers stage
  let tvOffAt = null; // When it started switching off like an old TV (see tvSquash)
  let tvScreen = null; // Where the old TV's screen was then, in the canvas's own pixels, so it switches off inside it
  const tvPicture = document.createElement('canvas'); // What was on the screen as it switched off
  let wormSize = 1; // How big the worm is, compared to its usual size
  let wormWide = Infinity; // How wide it was on the screen, last frame, in pixels
  let wormAbsorbed = 0; // How far it's gone into the pixel array (1 = gone)
  let wormFront = { x: 0, y: 0 }; // Where its head is, once it's been pulled toward the middle
  let spiralAt = { x: 0, y: 0 }; // Where the noisy spiral's coming from, which is where the worm was
  let tunnel = 0; // How far the worm and the flowers have shrunk away into the tunnel (1 = all the way)
  let spiralDue = 0; // How many seconds it's been since it last changed
  let spiralLength = 1; // How far around it went last time
  let spiralTurned = 0;
  let roughness = spiralRoughest;
  let tightness = spiralLoosest;

  let canvas;
  let at = { x: 0, y: 0 }; // Where the worm is heading
  let pointer = { x: 0, y: 0, down: false, lastMoved: -Infinity, travelled: 0 };
  let lastPointer = { x: 0, y: 0 };
  let seconds = 0;
  let leaving = false; // Has it gone on to the art page?
  let begun = false; // Has someone pressed to begin, past the welcome?
  let handedOver = false; // Has a stage that's a sketch of its own taken over the screen? (see handOver())
  let formAt = null; // Where it was pressed, while the worm's forming there (see formRound)
  let formStart = 0;
  let headSeen = null; // Where the worm's head was going to be last frame, before being moved to where it's forming
  // Coming back from there with the browser's Back button can restore it just as it was left, all white, so start
  // it fresh instead
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  let cameraWanted = false;
  let sound = null;
  let soundSwitch;

  // Linear boil's grid: a small copy of whatever was on the canvas, one pixel to a square
  const small = document.createElement('canvas');
  const smallContext = small.getContext('2d', { willReadFrequently: true });
  let cols = 0;
  let rows = 0;
  let picture = new Float32Array(0); // How bright each square was, from 0 to 1
  let live = new Float32Array(0); // The same, from the camera
  let cameraMix = 0; // How far the squares have turned from the picture to the camera
  let colours = new Uint8ClampedArray(0);
  let heat = new Float32Array(0);
  let boilStart = 0;

  const marks = document.createElement('nav');
  marks.className = 'flow-marks';
  marks.setAttribute('aria-label', 'skip');
  const soundSpot = document.createElement('div');
  soundSpot.className = 'flow-sound-spot';
  const welcome = document.createElement('div');
  welcome.className = 'flow-intro';
  welcome.innerHTML = '<span>welcome to my<br>wormhole</span><span>click anywhere<br>to enter</span>';
  const caption = document.createElement('p');
  caption.className = 'flow-caption';
  caption.setAttribute('aria-live', 'polite');
  const nextLabel = document.createElement('button');
  nextLabel.className = 'flow-next';
  nextLabel.textContent = ringLabel;
  nextLabel.addEventListener('click', () => {
    if (ringWaiting) bringRing();
  });

  // The start of a random range of brightness, without the flicker for anyone who's asked for less motion
  const shimmer = (low) => (calm ? (low + 255) / 2 : p.random(low, 255));

  function takePicture() {
    cols = Math.ceil(p.width / cell) + 1;
    rows = Math.ceil(p.height / cell) + 1;
    small.width = cols;
    small.height = rows;
    smallContext.drawImage(canvas.elt, 0, 0, cols, rows);
    const pixels = smallContext.getImageData(0, 0, cols, rows).data;
    picture = new Float32Array(cols * rows);
    live = new Float32Array(cols * rows);
    cameraMix = 0;
    colours = new Uint8ClampedArray(cols * rows * 3);
    heat = new Float32Array(cols * rows);

    let darkest = 255;
    let brightest = 0;
    for (let i = 0; i < picture.length; i++) {
      const bright = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3;
      picture[i] = bright;
      darkest = Math.min(darkest, bright);
      brightest = Math.max(brightest, bright);
      colours.set(pixels.subarray(i * 4, i * 4 + 3), i * 3);
    }
    // Thin lines average out dim at this size, so stretch whatever range is there to fill 0 to 1
    const range = brightest - darkest;
    for (let i = 0; i < picture.length; i++) {
      picture[i] = range > 8 ? Math.sqrt((picture[i] - darkest) / range) : 0;
    }
  }

  const cameraReady = () => cameraWanted && video.readyState >= 2 && video.videoWidth > 0;

  // Reads the camera into an array, mirrored and cropped to fit, as the original sketch's squares were
  function readCamera(smallContext, cols, rows, live) {
    const scale = Math.max(cols / video.videoWidth, rows / video.videoHeight);
    const drawnWidth = video.videoWidth * scale;
    const drawnHeight = video.videoHeight * scale;
    smallContext.save();
    smallContext.translate(cols, 0);
    smallContext.scale(-1, 1);
    smallContext.drawImage(video, (cols - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
    smallContext.restore();
    const pixels = smallContext.getImageData(0, 0, cols, rows).data;
    for (let i = 0; i < live.length; i++) {
      live[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3 / 255;
    }
  }

  async function startCamera() {
    cameraWanted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!cameraWanted) {
        stream.getTracks().forEach((track) => track.stop()); // Switched off while the browser was asking
        return;
      }
      video.srcObject = stream;
      await video.play();
      pictureChecked = false;
      if (stages[current].hintWithoutCamera) showCaption(stages[current].name, stages[current].hint);
    } catch (error) {
      stopCamera();
      const blocked = error.name === 'NotAllowedError' || !navigator.mediaDevices;
      showCaption('no camera', blocked ? 'it\'s blocked here: allow it in this browser and in System Settings, or try another browser' : `${error.name}: ${error.message}`);
    }
  }

  function stopCamera() {
    cameraWanted = false;
    video.srcObject?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  function startSound() {
    sound = startAudio() ?? sound;
  }

  function stopSound() {
    sound?.suspend();
  }

  // A fully saturated colour of the given hue (in degrees round the colour wheel), as [red, green, blue]
  function vivid(hue) {
    const h = (((hue % 360) + 360) % 360) / 60;
    const x = 255 * (1 - Math.abs((h % 2) - 1));
    return [[255, x, 0], [x, 255, 0], [0, 255, x], [0, x, 255], [x, 0, 255], [255, 0, x]][Math.floor(h)];
  }

  function newFlower() {
    return {
      petals: p.random(3, 12),
      petalLength: p.random(30, 80),
      petalWidth: p.random(10, 30),
      middle: p.random(10, 40),
      middleColour: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`,
      petalColour: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`,
      spin: p.radians(p.random(1, 8)),
      turned: 0,
      xSpeed: p.random(-fieldDrift, fieldDrift),
      ySpeed: p.random(-fieldDrift, fieldDrift),
      driftX: 0,
      driftY: 0,
    };
  }

  // Goes straight to the canvas, since there can be thousands of petals
  function drawFlower(flower, x, y, scale, alpha = 1, context = p.drawingContext) {
    flower.turned += flower.spin * frameTime * 60;
    const across = flower.petalLength * scale;
    if (scale < 0.005 || x < -across || x > p.width + across || y < -across || y > p.height + across) return;
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.scale(scale, scale);
    context.rotate(flower.turned);
    // The flower the worm goes through has strokes of their own colour
    context.strokeStyle = flower.strokeColour ?? 'black';
    context.lineWidth = (flower.strokeColour ? 1.5 : 1) / scale;
    context.fillStyle = flower.petalColour;
    const turn = p.TWO_PI / flower.petals;
    for (let i = 0; i < flower.petals; i++) {
      context.rotate(turn);
      context.beginPath();
      context.ellipse(flower.petalLength / 2, 0, flower.petalLength / 2, flower.petalWidth / 2, 0, 0, p.TWO_PI);
      context.fill();
      context.stroke();
    }
    context.fillStyle = flower.middleColour;
    context.beginPath();
    context.arc(0, 0, flower.middle / 2, 0, p.TWO_PI);
    context.fill();
    context.stroke();
    context.restore();
  }

  // The patterns come from running x and y through sines, so most of them are in how the pixels happen to land
  // on the waves. It's drawn at half the size and stretched, which is a part of how it looks. See src/testbed/iteration-1.js.
  function drawPixelArray(dt) {
    const opening = moveArrayCircle(dt);
    if (!stages[current].settings.bloom && !stages[current].settings.pixels) arrayNoise = 0;
    if (now.pixels < 0.01 && opening <= 0) {
      arrayPath = 0;
      return;
    }
    const w = Math.floor(p.width / 2);
    const h = Math.floor(p.height / 2);
    if (pixelCanvas.width !== w || pixelCanvas.height !== h) {
      pixelCanvas.width = w;
      pixelCanvas.height = h;
      pixelImage = pixelContext.createImageData(w, h);
    }
    // Anyone who's asked for less motion moves it themselves
    arrayPath += dt * (1 + boost);
    // At a steady pace along the spiral, so it goes around quickly in the middle, and slowly further out, where
    // the same movement shows as curves flowing rather than as static
    const out = Math.sqrt(Math.min(1, arrayPath / pathOut));
    const turned = pathTurns * p.TWO_PI;
    const angle = turned * (out + Math.max(0, arrayPath - pathOut) / (2 * pathOut));
    const toEdge = p.lerp(1, 1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))), out); // Rounder in the middle, and square to the screen at the edges
    const mouseX = calm ? pointer.x / 2 : (w / 2) * (1 + Math.cos(angle) * toEdge * out * pathEdge);
    const mouseY = calm ? pointer.y / 2 : (h / 2) * (1 + Math.sin(angle) * toEdge * out * pathEdge);
    pixelX = p.lerp(pixelX, Math.max(1, Math.abs(mouseX - w / 2)), pixelFollow);
    pixelY = p.lerp(pixelY, Math.max(1, Math.abs(mouseY - h / 2)), pixelFollow);
    if (!calm) {
      scanDirection = p.lerp(scanDirection, mouseY < h / 2 ? 1 : -1, scanTurn);
      const edge = Math.min(1, pixelY / (h / 2)) ** 2; // How close the mouse is to the top or bottom, from 0 to 1
      scanPosition += scanSpeed * p.lerp(1, scanEdgeSpeed, edge) * scanDirection;
      pixelDrift += pixelDriftSpeed;
    }
    // Near the middle, a tiny random nudge every frame keeps the static going, even if the mouse is still
    const nearMiddle = Math.max(0, 1 - Math.abs(mouseX - w / 2) / staticReach);
    arrayNoise += (p.constrain(Math.log(noiseFrom / wormWide) / Math.log(noiseFrom / wormAbsorbedAt), 0, 1) - arrayNoise) * noiseFollow;
    const crackle = Math.pow(pixelX, 1 - arrayNoise) * Math.pow(noiseFinest, arrayNoise) + (calm ? 0 : Math.max(nearMiddle, arrayNoise) * p.random(1));
    const scan = w / 2; // Always wide, gradual waves
    // Fading in evenly, all over
    const shown = Math.max(now.pixels, ease(opening)) * 255;
    // Cracking, once it's covered the screen for a while: worked out as if each row were this wide
    const cracked = arrayFullAt === null ? 0 : ease(Math.min(1, Math.max(0, (seconds - arrayFullAt - crackAfter) / crackTime)));
    const wrongWidth = Math.max(1, Math.round(w * (1 - crackMost * cracked)));
    const { data } = pixelImage;
    let i = 0;
    for (let row = 0; row < h; row++) {
      for (let column = 0; column < w; column++) {
        // Where on the pattern this pixel comes from: where it is, until it cracks
        const along = row * w + column;
        const x = cracked > 0 ? along % wrongWidth : column;
        const y = cracked > 0 ? Math.floor(along / wrongWidth) : row;
        data[i + 3] = shown;
        data[i] = 100 * (1 + Math.cos(y / w / pixelY + pixelY / 10));
        data[i + 1] = 100 * (1 + (Math.sin((x * y) / (0.5 * crackle) + crackle / 10 - pixelDrift) + Math.sin(((w - x) * (h - y)) / (0.5 * crackle) + crackle / 10 - pixelDrift)) / 2);
        data[i + 2] = 100 * (1 + Math.cos((1.414 * y) / scan + scan / 10 - scanPosition));
        i += 4;
      }
    }
    pixelContext.putImageData(pixelImage, 0, 0);
    const context = p.drawingContext;
    context.save();
    context.imageSmoothingEnabled = false;
    // Taking on the shape of an old TV's screen, once it's covered the screen
    const crt = tvShaped();
    if (crt > 0) {
      context.fillStyle = 'black';
      context.fillRect(0, 0, p.width, p.height);
      clipToTv(context, crt);
    }
    context.drawImage(pixelCanvas, 0, 0, p.width, p.height);
    if (crt > 0) {
      // ...darker toward its edges
      const shade = context.createRadialGradient(p.width / 2, p.height / 2, Math.min(p.width, p.height) * 0.3, p.width / 2, p.height / 2, Math.hypot(p.width, p.height) / 2);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, `rgba(0,0,0,${crtShade * crt})`);
      context.fillStyle = shade;
      context.fillRect(0, 0, p.width, p.height);
    }
    context.restore();
  }

  // Where a place along the worm shows on the screen, while it's in space (along: 0 at the tail, 1 at the head)
  function wormPlace(along) {
    const seen = seenFromBehind(along, cameraAt(pathTime));
    const followed = steerAt(seconds - (1 - along) * bodyTime);
    if (!followed) return seen;
    return { x: p.lerp(seen.x, followed.x, wormFollow), y: p.lerp(seen.y, followed.y, wormFollow) };
  }

  // How far it's closed in from the corners, opening again if the flowers stage is left before it's done
  function moveArrayCircle(dt) {
    if (stages[current].settings.bloom) {
      if (seconds - stageStart > arrayDelay) arrayOpening = Math.min(1, arrayOpening + (dt * (1 + boost)) / arrayTime);
      tunnel = arrayOpening;
    } else {
      arrayOpening = arrayOpening < 0.01 ? 0 : arrayOpening * Math.exp(-dt / morphTime);
      tunnel += ((stages[current].settings.coil ? 1 : 0) - tunnel) * (1 - Math.exp(-dt / morphTime));
    }
    const { bloom, pixels, noisy } = stages[current].settings;
    if (bloom && arrayOpening > 0) wormSize *= Math.exp((-dt * (1 + boost)) / wormShrink);
    else if (pixels) wormSize *= Math.exp(-dt / wormShrink); // Bursting it here doesn't hurry it away
    else if (!noisy) wormSize = 1;
    if (wormSize === 1) wormAbsorbed = 0;
    // ...when it's small enough, or once the array's covered the screen for long enough anyway
    else if (wormWide < wormAbsorbedAt || wormAbsorbed > 0 || (arrayFullAt !== null && seconds - arrayFullAt > arrayHold)) wormAbsorbed = Math.min(1, wormAbsorbed + dt / wormAbsorbTime);
    return arrayOpening;
  }

  async function loadHandTracker() {
    handTrackerLoading = true;
    try {
      window.p5 = p5; // ml5 needs the global one set before it loads
      const { default: ml5 } = await import('ml5');
      handTracker = await ml5.handPose(handOptions);
    } catch (error) {
      console.error(error);
      showCaption('no hand tracking', 'the curves still follow the camera');
    }
  }

  // The hands are only looked for while the curves are showing and the camera has a picture
  function trackHands() {
    const wanted = stages[current].settings.curves && cameraReady();
    if (wanted && !handTracker && !handTrackerLoading) loadHandTracker();
    if (wanted && handTracker && !trackingHands) {
      trackingHands = true;
      // It goes by these rather than the size of the picture, and they're 0 until they're set
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      handTracker.detectStart(video, (results) => (hands = results));
    }
    if (!wanted && trackingHands) {
      trackingHands = false;
      handTracker.detectStop();
      hands = [];
    }
  }

  // Each hand's fingers, where they show on the curves, and the note they pick
  function handsOnCurves() {
    const scale = Math.max(curveAcross / video.videoWidth, curveDown / video.videoHeight);
    const onCurves = ({ x, y }) => ({
      x: (curveAcross - (x * scale + (curveAcross - video.videoWidth * scale) / 2)) * curveSpacing,
      y: (y * scale + (curveDown - video.videoHeight * scale) / 2) * curveSpacing,
    });
    return hands.slice(0, pipeNotes.length).map((hand, i) => {
      const thumb = hand.keypoints[4];
      const finger = hand.keypoints[8];
      const pinch = (Math.hypot(thumb.x - finger.x, thumb.y - finger.y) * 640) / video.videoWidth;
      const notes = pipeNotes[i];
      const note = p.constrain(Math.floor(p.map(pinch, pinchClosed, pinchOpen, 0, notes.length - 1)), 0, notes.length - 1);
      const from = onCurves(thumb);
      const to = onCurves(finger);
      return {
        from,
        to,
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        reach: stringReach + Math.hypot(from.x - to.x, from.y - to.y) / 2,
        wave: p.lerp(stringWaves[0], stringWaves[1], note / (notes.length - 1)),
        pitch: notes[note],
      };
    });
  }

  // A pipe holds its last note when its hand's gone. They fade out when there aren't any hands, and back in
  // when they return. They can only be heard while the sound's on.
  function playPipes(playing, dt) {
    pipeAmount = playing.length ? Math.min(1, pipeAmount + 0.03 * dt * 60) : pipeAmount * Math.pow(0.95, dt * 60);
    if (!sound) return;
    pipes ??= pipeNotes.map(() => {
      const pipe = sound.createOscillator();
      const volume = sound.createGain();
      pipe.type = 'triangle';
      pipe.frequency.value = 0;
      volume.gain.value = 0;
      pipe.connect(volume).connect(sound.destination);
      pipe.start();
      return { pipe, volume };
    });
    pipes.forEach(({ pipe, volume }, i) => {
      if (playing[i]) pipe.frequency.setTargetAtTime(playing[i].pitch, sound.currentTime, 0.01);
      volume.gain.setTargetAtTime(pipeAmount * pipeLevel, sound.currentTime, 0.02);
    });
  }

  // A block of curves in the middle of the screen, each point pushed by how bright the camera is there, and
  // smaller on a screen too small for it. It goes straight to the canvas, since there are thousands of points.
  function drawCurves(dt) {
    trackHands();
    const playing = trackingHands && video.videoWidth ? handsOnCurves() : [];
    playPipes(playing, dt);
    if (now.curves < 0.01) return;
    const across = curveAcross;
    const down = curveDown;
    if (curveCanvas.width !== across || curveCanvas.height !== down) {
      curveCanvas.width = across;
      curveCanvas.height = down;
      curveCamera = new Float32Array(across * down);
    }
    const useCamera = stages[current].settings.curves && cameraReady();
    if (useCamera) readCamera(curveContext, across, down, curveCamera);
    curveMix += ((useCamera ? 1 : 0) - curveMix) * (1 - Math.exp(-dt / curveCameraTime));
    // A camera can be on and still send nothing, as virtual ones do when nothing's feeding them
    if (useCamera && !pictureChecked && curveMix > 0.9) {
      pictureChecked = true;
      if (Math.max(...curveCamera) - Math.min(...curveCamera) < 0.02) {
        showCaption('blank camera', `${video.srcObject.getVideoTracks()[0].label} isn't sending a picture`);
      }
    }

    const time = calm ? 0 : seconds * curveCalm;
    const bend = curveBend * now.curves;
    const xs = new Float32Array(across);
    const ys = new Float32Array(across);
    const context = p.drawingContext;
    context.save();
    const wide = (across - 1) * curveSpacing;
    const tall = (down - 1) * curveSpacing;
    const fit = Math.min(1, p.width / (wide + curveBend * 2), p.height / (tall + curveBend * 2));
    context.translate((p.width - wide * fit) / 2, (p.height - tall * fit) / 2);
    context.scale(fit, fit);
    context.globalAlpha = now.curves;
    context.strokeStyle = 'black';
    context.lineWidth = 1 / fit;
    context.beginPath();
    for (let y = 0; y < down; y++) {
      for (let x = 0; x < across; x++) {
        const ripple = p.constrain(p.noise(x * 0.1, y * 0.1, time) * 2 - 0.5, 0, 1);
        const bright = ripple + (curveCamera[y * across + x] - ripple) * curveMix;
        const push = (bright * 2 - 1) * bend;
        xs[x] = x * curveSpacing + push;
        ys[x] = y * curveSpacing + push;
        // Near a hand they vibrate, more tightly for higher notes
        for (const { x: handX, y: handY, reach, wave } of playing) {
          const near = Math.exp(-((x * curveSpacing - handX) ** 2 + (y * curveSpacing - handY) ** 2) / (2 * reach * reach));
          ys[x] += stringBend * pipeAmount * near * Math.sin((x * curveSpacing * Math.PI * 2) / wave - time * stringTime);
        }
      }
      // A curve through every point, in the way that p5's splineVertex() does it
      context.moveTo(xs[0], ys[0]);
      for (let x = 0; x < across - 1; x++) {
        const before = Math.max(0, x - 1);
        const after = Math.min(across - 1, x + 2);
        context.bezierCurveTo(xs[x] + (xs[x + 1] - xs[before]) / 6, ys[x] + (ys[x + 1] - ys[before]) / 6, xs[x + 1] - (xs[after] - xs[x]) / 6, ys[x + 1] - (ys[after] - ys[x]) / 6, xs[x + 1], ys[x + 1]);
      }
    }
    context.stroke();
    // The line between each hand's thumb and finger, which is what plays it
    context.lineWidth = 3 / fit;
    context.beginPath();
    for (const { from, to } of playing) {
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    }
    context.stroke();
    context.restore();
  }

  // Works out the noisy spiral afresh. Each point comes partly from the last one, by an amount that's
  // different every time, which is what makes it noisy.
  function growSpiral() {
    const row = calm ? 0 : p.random(1000); // A new row of noise each time, without reseeding it, which would jolt the worm
    const grown = p.lerp(1, endReach, spiralEnding());
    const limitX = (p.width / spiralReach) * now.spiral * grown;
    const limitY = (p.height / spiralReach) * now.spiral * grown;
    spiralLines = Array.from({ length: spiralWeights }, () => new Path2D());
    let x = 0;
    let y = 0;
    let around = 0;
    for (let i = 0; i < spiralMostLines && x < limitX && y < limitY; i++) {
      const wobble = p.noise(around, row);
      const radius = (around * around) / tightness;
      const nextX = radius * Math.cos(around) + (x / roughness) * wobble * now.noisy;
      const nextY = radius * Math.sin(around) + (y / roughness) * wobble * now.noisy;
      const weight = Math.min(spiralWeights - 1, Math.floor((around / spiralLength) * spiralWeights));
      spiralLines[weight].moveTo(x, y);
      spiralLines[weight].lineTo(nextX, nextY);
      x = nextX;
      y = nextY;
      around += spiralStep;
    }
    spiralLength = around;
  }

  // How far through its ending the noisy spiral is, from 0 to 1
  function spiralEnding() {
    return stages[current].settings.noisy ? p.constrain((progress - endStarts) / (1 - endStarts), 0, 1) : 0;
  }

  // How bright the flash of lightning is, from 0 to 1. Moves on to the next one when it's time. There's none once
  // the lines are piling up, since they'd all stay.
  function strikeLight() {
    if (calm || !stages[current].settings.noisy || spiralEnding() > endPiling / 2) return 0;
    if (seconds >= nextStrike) {
      pickFragment();
      strikeFades = !clipCrop;
      strikeEnds = seconds + (clipCrop ? strikeClipLength : strikeLength);
      roseBurst();
      if (firstStrikes > 0) {
        firstStrikes--;
        secondFlash = false;
        nextStrike = seconds + (firstStrikes > 0 ? p.random(strikesFirstEvery[0], strikesFirstEvery[1]) : p.random(strikeEvery[0], strikeEvery[1]));
      } else {
        secondFlash = !secondFlash && p.random() < strikeDouble;
        nextStrike = seconds + (secondFlash ? strikeGap : p.random(strikeEvery[0], strikeEvery[1]));
      }
    }
    if (seconds < strikeEnds) return 1;
    return strikeFades ? Math.max(0, 1 - (seconds - strikeEnds) / strikeFade) : 0;
  }

  // Whether the strike starting now is in colour, and which part of the video it shows
  function pickFragment() {
    clipCrop = null;
    if (clip.readyState < 2 || clip.seeking || p.random() >= strikeInColour) return;
    const share = p.random(strikeClipCrop[0], strikeClipCrop[1]);
    const wide = clip.videoWidth * share;
    const tall = clip.videoHeight * share;
    clipCrop = { x: p.random(clip.videoWidth - wide), y: p.random(clip.videoHeight - tall), wide, tall };
    clipMoved = false;
  }

  // A strike in colour, over the ground and under the spiral. Once it's over, the video moves on to somewhere new.
  function drawFragment() {
    const light = strikeLight();
    if (clipCrop && light > 0) {
      const context = p.drawingContext;
      context.save();
      context.globalAlpha = light;
      context.drawImage(clip, clipCrop.x, clipCrop.y, clipCrop.wide, clipCrop.tall, 0, 0, p.width, p.height);
      context.restore();
    } else if (light === 0) {
      clipCrop = null;
      if (!clipMoved && clip.readyState >= 1) {
        clip.currentTime = p.random(clip.duration);
        clipMoved = true;
      }
    }
  }

  // The ground, with any lightning in it
  function groundNow() {
    const light = strikeLight();
    return clipCrop ? now.ground : p.lerp(now.ground, 255 - now.ground, light);
  }

  // The spiral bursts into a rose. Lightning sets it off, and so does letting go of the mouse.
  function roseBurst() {
    roughness = strikeRose.roughness;
    tightness = Math.max(tightness, strikeRose.tightness);
    spiralDue = 1;
  }

  function changeSpiral(shape) {
    roughness = shape.roughness;
    tightness = p.random(shape.tightness[0], shape.tightness[1]);
  }

  // Only there for its own stage, where it bursts out of where the worm was.
  // Goes straight to the canvas, since there can be thousands of lines.
  function drawSpiral(dt) {
    if (!calm && now.coil > 0.01 && now.noisy < 0.5) spiralTurned += coilSpin * dt;
    if (now.spiral < 0.01) return;
    spiralDue += dt;
    if (now.noisy < 0.5) {
      growSpiral(); // Smooth until it's mostly noisy, when it starts to jump
    } else if (spiralDue >= 1 / spiralTicks) {
      spiralDue %= 1 / spiralTicks;
      growSpiral();
      if (!calm) spiralTurned += spiralTurn;
      if (roughness < spiralSmoothest) roughness += spiralSmoothing;
      tightness += (spiralLoosest * Math.pow(spiralTightest / spiralLoosest, Math.min(1, progress)) - tightness) * spiralSettling;
    }
    const context = p.drawingContext;
    context.save();
    spiralAt.x += (p.width / 2 - spiralAt.x) * (1 - Math.exp(-dt / morphTime));
    spiralAt.y += (p.height / 2 - spiralAt.y) * (1 - Math.exp(-dt / morphTime));
    context.translate(spiralAt.x, spiralAt.y);
    context.rotate(spiralTurned);
    const ink = groundNow() > 127 ? 0 : 255; // Whichever the ground isn't
    context.strokeStyle = `rgb(${ink},${ink},${ink})`;
    spiralLines.forEach((lines, i) => {
      context.lineWidth = 2 + i / (spiralWeights - 1);
      context.stroke(lines);
    });
    context.restore();
  }

  // The flowers fly by in the same way as the stars (see drawStars()), from the same point. They start
  // far away, a steady stream of them, which comes to fieldCount by the time the first have passed.
  function burst() {
    burstStart = seconds;
    for (const flower of segments) {
      if (flower) flower.burstAngle = p.random(p.TWO_PI);
    }
    throwFlowers();
  }

  function throwFlowers() {
    const camera = cameraAt(pathTime);
    for (let i = 0; i < burstExtra; i++) {
      const from = seenFromBehind(p.random(0.1, 0.9), camera); // From all along it
      thrownOut.push({
        ...newFlower(),
        fromX: from.x,
        fromY: from.y,
        thrownAt: seconds,
        angle: p.random(p.TWO_PI),
        reach: p.random(0.15, 1) * burstReach * p.width,
        speed: p.random(burstExtraSpeed[0], burstExtraSpeed[1]) * p.width,
        size: (p.random(burstExtraSize[0], burstExtraSize[1]) * p.width) / 1200,
      });
    }
  }

  // They fly out with the burst and carry on until they're off the screen, and only then do they go
  // Throws the worm's flowers out, up to this far, in pixels. It's different every time: a few jets in random
  // directions, a few flowers going a long way while most stay near, and each with its own speed.
  function explode(reach) {
    const jets = Array.from({ length: Math.round(p.random(explodeJets[0], explodeJets[1])) }, () => ({
      angle: p.random(p.TWO_PI),
      wide: p.random(explodeJetWidth[0], explodeJetWidth[1]),
      far: p.random(0.4, 1),
    }));
    const most = explodeMost * Math.min(p.width, p.height);
    for (const flower of segments) {
      if (!flower) continue;
      const jet = p.random(jets);
      const stray = p.random() < explodeStray;
      const angle = stray ? p.random(p.TWO_PI) : jet.angle + p.randomGaussian(0, jet.wide / 2);
      const distance = reach * (stray ? 0.5 : jet.far) * Math.pow(p.random(), explodeUneven);
      const toX = (flower.blastToX ?? 0) + Math.cos(angle) * distance;
      const toY = (flower.blastToY ?? 0) + Math.sin(angle) * distance;
      const limit = Math.min(1, most / (Math.hypot(toX, toY) || 1));
      flower.blastToX = toX * limit;
      flower.blastToY = toY * limit;
      flower.blastSpeed = p.random(explodeSpeed[0], explodeSpeed[1]);
      flower.blastReturn = p.random(explodeReturn[0], explodeReturn[1]);
    }
  }

  function drawThrownOut(context) {
    if (burstStart === null) thrownOut = [];
    thrownOut = thrownOut.filter((flower) => {
      const since = seconds - flower.thrownAt;
      const distance = flower.reach * (1 - Math.exp(-since * burstOut)) + flower.speed * since;
      const x = flower.fromX + Math.cos(flower.angle) * distance;
      const y = flower.fromY + Math.sin(flower.angle) * distance;
      const across = flower.petalLength * flower.size;
      if (x < -across || x > p.width + across || y < -across || y > p.height + across) return false;
      drawFlower(flower, x, y, flower.size * (1 - tunnel), 1, context);
      return true;
    });
  }

  // How far the worm's flowers have come back since the burst (from 0 to 1), slowing as they settle
  function burstBack() {
    return 1 - Math.exp((burstStart - seconds) / burstReturn);
  }

  function forwardMotion() {
    return (burstStart === null ? 1 : burstBack()) * (1 + boost);
  }

  function newFieldFlower() {
    let x = p.random(-1, 1);
    let y = p.random(-1, 1);
    while (Math.abs(x) < fieldLane && Math.abs(y) < fieldLane) {
      x = p.random(-1, 1);
      y = p.random(-1, 1);
    }
    return { ...newFlower(), x, y, z: calm ? p.random(0.1, 1) : 1 };
  }

  function moveField() {
    const { bloom, pixels } = stages[current].settings;
    // They last into the pixel array
    if (bloom) fieldLeft = 1 - fieldClosing * arrayOpening;
    else if (pixels) fieldLeft = Math.max(0, fieldLeft - ((1 - fieldClosing) * frameTime) / fieldLingers);
    else fieldLeft = 1;
    const lasting = pixels && fieldLeft > 0;
    if (bloom === 0 && now.bloom < 0.01 && !lasting) {
      field = [];
      return;
    }
    if (lasting || (bloom === 1 && seconds - stageStart > fieldDelay)) {
      fieldDue += (fieldCount * fieldSpeed * frameTime * forwardMotion()) / fieldStream;
      for (; fieldDue >= 1; fieldDue--) {
        if (field.length < fieldCount) field.push(newFieldFlower());
      }
    }
    if (!calm) {
      for (const flower of field) {
        flower.z -= flower.z * fieldSpeed * frameTime * forwardMotion();
        flower.driftX += flower.xSpeed * frameTime * 60;
        flower.driftY += flower.ySpeed * frameTime * 60;
      }
      // They keep growing until they're off the screen, and only then do they go
      field = field.filter((flower) => {
        const { x, y, size } = fieldPlace(flower);
        const across = flower.petalLength * size;
        return x > -across && x < p.width + across && y > -across && y < p.height + across;
      });
    }
    field.sort((a, b) => b.z - a.z);
  }

  // Dragging plants them where the pointer is, partway along, to fly by with the rest. They always leave.
  function plantInField(screenX, screenY) {
    if (field.length >= mostFlowers) return;
    const z = p.random(0.5, 1);
    const reach = Math.max(p.width, p.height) * 0.5;
    const away = Math.atan2(screenY - focus.y, screenX - focus.x);
    field.push({
      ...newFlower(),
      x: ((screenX - focus.x) * z) / reach,
      y: ((screenY - focus.y) * z) / reach,
      z,
      xSpeed: Math.cos(away) * plantedDrift,
      ySpeed: Math.sin(away) * plantedDrift,
    });
  }

  // Where a flower flying by shows on the screen, and how big
  function fieldPlace(flower) {
    const reach = Math.max(p.width, p.height) * 0.5;
    const shorter = Math.min(p.width, p.height);
    return {
      x: focus.x + (flower.x * reach) / flower.z + flower.driftX,
      y: focus.y + (flower.y * reach) / flower.z + flower.driftY,
      size: (stages[current].settings.pixels ? 1 : now.bloom) * fieldLeft * Math.min(((fieldSize * shorter) / 800) / Math.pow(flower.z, fieldGrow), (fieldBiggest * shorter) / flower.petalLength),
    };
  }

  function drawField(context) {
    for (const flower of field) {
      const { x, y, size } = fieldPlace(flower);
      drawFlower(flower, x, y, size, Math.min(1, (1 - flower.z) / fieldFade), context); // They fade in in the distance
    }
  }

  function showCaption(name, hint) {
    caption.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'flow-caption-name';
    title.textContent = name;
    caption.append(title, ` ${hint}`);
    // Restarts the fade
    caption.classList.remove('showing');
    void caption.offsetWidth;
    caption.classList.add('showing');
  }

  function goTo(index) {
    if (handedOver) return; // Another sketch has the screen now
    if (index >= stages.length) {
      if (!leaving) location.href = after;
      leaving = true;
      return;
    }
    current = (index + stages.length) % stages.length;
    progress = 0;
    stageStart = seconds;
    arrayFullAt = null;
    ringDistance = null;
    ringWaiting = false;
    burstStart = null;
    boost = 0;
    // The flowers stage always starts with the worm bursting
    if (stages[current].settings.bloom) bloomStart = seconds; // It waits, wobbles and bursts (see bloomFade)
    else bloomStart = null;
    const { name, hint, hintWithoutCamera, settings } = stages[current];
    if (settings.grid) {
      takePicture();
      boilStart = seconds;
    }
    if ((settings.bloom || settings.noisy) && !clip.src) {
      clip.src = strikeClip;
      clip.addEventListener('loadedmetadata', () => (clip.currentTime = p.random(clip.duration)), { once: true });
    }
    if (settings.noisy && !calm) clip.play().catch(() => {});
    else clip.pause();
    // The noisy spiral doesn't carry over into any other stage
    if (!settings.noisy) Object.assign(now, { spiral: 0, noisy: 0 });
    // The noisy spiral's a cut: straight to black, with the spiral already bursting out
    if (settings.noisy) {
      changeSpiral(spiralBursts);
      for (const flower of segments) if (flower) flower.blastX = flower.blastY = flower.blastToX = flower.blastToY = 0;
      Object.assign(now, { noisy: 1, spiral: 1, body: 0, pixels: 0, bloom: 0, ground: settings.ground, wash: settings.wash });
      arrayOpening = 0;
      spiralDue = 1;
      nextStrike = seconds; // It opens with lightning
      firstStrikes = strikesFirst;
    }

    if (begun) showCaption(name, hintWithoutCamera && !cameraReady() ? hintWithoutCamera : hint);
    history.replaceState(null, '', `#${slug(name)}`);
    if (stages[current].sketch) handOver(stages[current].sketch);
  }

  // Keeps what's drawn after this inside the old TV's screen, at however far it's taken on its shape
  function clipToTv(context, crt) {
    const smaller = Math.min(p.width, p.height);
    const inset = crtInset * smaller * crt;
    context.beginPath();
    context.roundRect(inset, inset, p.width - inset * 2, p.height - inset * 2, crtCorner * smaller * crt);
    context.clip();
  }

  // How far the pixel array's taken on the old TV's shape, from 0 to 1, easing gently in and out
  function tvShaped() {
    if (arrayFullAt === null) return 0;
    const t = Math.min(1, (seconds - arrayFullAt) / crtTime);
    return t ** 3 * (t * (t * 6 - 15) + 10);
  }

  // Switching off like an old TV: the picture squashed to a bright line across the middle, the line shrunk to a bright
  // dot, and the dot fading, and then it's on to the next stage
  function drawTvOff() {
    const t = seconds - tvOffAt;
    const context = p.drawingContext;
    const { width, height } = context.canvas;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = 'black';
    context.fillRect(0, 0, width, height);
    const squashing = ease(Math.min(1, t / tvSquash));
    const shrinking = ease(Math.min(1, Math.max(0, (t - tvSquash) / tvShrink)));
    const fading = Math.min(1, Math.max(0, (t - tvSquash - tvShrink) / tvFade));
    // All of it inside the old TV's screen
    const screen = tvScreen ?? { x: 0, y: 0, wide: width, tall: height, round: 0 };
    context.beginPath();
    context.roundRect(screen.x, screen.y, screen.wide, screen.tall, screen.round);
    context.clip();
    const line = Math.max(2, height * 0.004); // How thick the line is, in the canvas's own pixels
    const tall = p.lerp(screen.tall, line, squashing);
    const wide = p.lerp(screen.wide, line, shrinking);
    context.translate(screen.x + screen.wide / 2, screen.y + screen.tall / 2);
    if (shrinking < 1) {
      // The picture on the screen, squashed and brightening to white as it goes
      context.drawImage(tvPicture, screen.x, screen.y, screen.wide, screen.tall, -wide / 2, -tall / 2, wide, tall);
      context.fillStyle = `rgba(255,255,255,${squashing})`;
      context.fillRect(-wide / 2, -tall / 2, wide, tall);
    }
    // The dot, glowing, and fading
    if (shrinking > 0.8) {
      const glow = line * 4;
      const dot = context.createRadialGradient(0, 0, 0, 0, 0, glow);
      dot.addColorStop(0, `rgba(255,255,255,${1 - fading})`);
      dot.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = dot;
      context.fillRect(-glow, -glow, glow * 2, glow * 2);
    }
    context.restore();
    if (fading >= 1) {
      tvOffAt = null;
      goTo(current + 1);
    }
  }

  // A stage that's a sketch of its own takes over the screen: this one stops, and that one starts in its place, with
  // the captions, the sound switch and the skip link staying as they are. `options` go to the next sketch.
  function handOver(sketch, options = {}) {
    handedOver = true;
    clip.pause();
    // Once this frame's done. The page keeps resizing this one (see src/scripts/sketchbook.js), so that's turned off,
    // and the next one keeps itself the size of the screen.
    requestAnimationFrame(() => {
      p.resizeCanvas = () => {};
      p.remove();
      new p5((next) => sketch(next, container, options), container);
    });
  }

  // Skipping goes straight to the end of the wormhole, where the portals are (see spiral-worm.js)
  function skipToPortals() {
    if (handedOver) {
      container.skipToPortals?.();
      return;
    }
    begun = true;
    welcome.classList.add('gone');
    current = stages.findIndex(({ sketch }) => sketch);
    history.replaceState(null, '', `#${slug(stages[current].name)}`);
    handOver(stages[current].sketch, { atPortals: true });
  }


  function moveWorm(dt) {
    const idle = seconds - pointer.lastMoved > idleTime;
    const before = { ...at };
    if (!idle) {
      at.x = pointer.x;
      at.y = pointer.y;
    } else if (!calm) {
      const wander = seconds * 0.15;
      at.x += (p.noise(wander) * p.width - at.x) * Math.min(1, dt);
      at.y += (p.noise(wander, 40) * p.height - at.y) * Math.min(1, dt);
    }

    // Any frame the pointer hasn't moved, the wake comes up anywhere on the water
    const still = pointer.x === lastPointer.x && pointer.y === lastPointer.y;
    lastPointer = { x: pointer.x, y: pointer.y };
    let next;
    if (still && !calm && now.scatter > 0.5) next = { x: p.random(p.width), y: p.random(p.height) };
    else next = { x: at.x + p.random(-70, 70) * now.scatter, y: at.y + p.random(-30, 30) * now.scatter };
    trail.push(next);
    if (trail.length > stages[0].settings.length) trail.shift();
    return p.dist(before.x, before.y, at.x, at.y);
  }

  // Where the worm's path is, this many seconds ago
  function weaveAt(time) {
    return {
      x: (p.noise(time * weaveSpeed) - 0.5) * 2 * weaveWide * p.width,
      y: (p.noise(time * weaveSpeed, 100) - 0.5) * 2 * weaveTall * p.height,
    };
  }

  // Where the camera is at a given time: wherever puts the tail where it's drifted to on the screen
  function cameraAt(time) {
    const tail = weaveAt(time - bodyTime);
    const x = tail.x - (p.noise(time * tailWander, 200) - 0.5) * 2 * tailWide * p.width;
    const y = tail.y - (p.noise(time * tailWander, 300) - 0.5) * 2 * tailTall * p.height;
    if (ringPull < 0.001) return { x, y };
    // As the worm nears the ring, the camera moves into line with it, so that it's in the middle of the screen
    const ring = weaveAt(ringMeets);
    return { x: p.lerp(x, ring.x, ringPull), y: p.lerp(y, ring.y, ringPull) };
  }

  // How high the camera's looking from: as the worm nears the ring it comes down right behind it, looking
  // along it into the middle of the screen
  function screenLevel() {
    return p.height * p.lerp(spaceHorizon, 0.5, ringPull);
  }

  function cameraHeight() {
    return p.height * p.lerp(cameraAbove, ringBehind, ringPull);
  }

  // Keeps what's near the camera on the screen while it's lined up with the ring
  function keepOnScreen(x, y) {
    const wide = p.width * 0.45;
    const tall = p.height * 0.42;
    return {
      x: p.lerp(x, p.width / 2 + wide * Math.tanh((x - p.width / 2) / wide), ringPull),
      y: p.lerp(y, p.height / 2 + tall * Math.tanh((y - p.height / 2) / tall), ringPull),
    };
  }

  // Where a place along the worm shows on the screen, from just above and behind it (along: 0 at the tail, 1 at the head)
  function seenFromBehind(along, camera) {
    const closer = 1 / p.lerp(tailDistance, headDistance, along);
    const place = weaveAt(pathTime - (1 - along) * bodyTime);
    return {
      x: p.width / 2 + (place.x - camera.x) * closer,
      y: screenLevel() + (cameraHeight() - (place.y - camera.y)) * closer,
      closer,
    };
  }

  // Where the ring shows on the screen. It's at a place on the worm's path, so the worm's going to go
  // right through its middle, and it moves with everything else as the camera does.
  function ringPlace(pathTime) {
    const camera = cameraAt(pathTime);
    const place = weaveAt(ringWaiting ? pathTime + ringLead : ringMeets);
    const closer = 1 / ringDistance;
    return {
      x: p.width / 2 + (place.x - camera.x) * closer,
      y: screenLevel() + (cameraHeight() - (place.y - camera.y)) * closer,
      closer,
    };
  }

  // The part of the worm beyond the ring is seen through its middle. It keeps its wobble, but is drawn in
  // as far as it takes to stay inside, which matters most on narrow screens.
  function insideRing(x, y, size, ring) {
    const hole = ringHole();
    const room = Math.max(hole - size / 2, hole * 0.1);
    const gap = Math.hypot(x - ring.x, y - ring.y);
    const keep = gap > 0 ? p.lerp(1, (room * Math.tanh(gap / room)) / gap, ringPull) : 1;
    return { x: ring.x + (x - ring.x) * keep, y: ring.y + (y - ring.y) * keep };
  }

  // How far the worm's got to it, once it's set off (from 0 to 1)
  function ringOpening() {
    return ringWaiting ? 0 : p.constrain((ringWait - ringDistance) / (ringWait - headDistance), 0, 1);
  }

  // The size of the circle in its middle
  function ringHole() {
    const start = ((p.width / 8) * bodyScale * ringSize * ringSmall) / (2 * ringWait);
    if (ringWaiting) return start;
    const going = (pathTime - (ringMeets - ringLead)) / ringCovers;
    const covered = Math.hypot(p.width, p.height) * 0.55;
    return start * Math.pow(covered / start, (1 - ringRush) * going + ringRush * going * going);
  }

  function bringRing() {
    ringWaiting = false;
    ringMeets = pathTime + ringLead;
  }

  function ringCoversScreen() {
    const ring = ringPlace(pathTime);
    return ringHole() > Math.hypot(Math.max(ring.x, p.width - ring.x), Math.max(ring.y, p.height - ring.y));
  }

  // The flower the worm goes through. Its middle grows to cover the screen, and its colour becomes the next
  // stage's ground, which then fades away
  function drawRing() {
    const ring = ringPlace(pathTime);
    drawFlower(portal, ring.x, ring.y, (ringHole() * 2) / portal.middle);
  }

  // Where the place the worm's following was at a given time, in between the frames either side of it
  function steerAt(time) {
    if (!steerTrail.length) return null;
    let low = 0;
    let high = steerTrail.length - 1;
    if (time <= steerTrail[low].time) return steerTrail[low];
    if (time >= steerTrail[high].time) return steerTrail[high];
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (steerTrail[middle].time <= time) low = middle;
      else high = middle;
    }
    const before = steerTrail[low];
    const after = steerTrail[high];
    const between = (time - before.time) / (after.time - before.time);
    return { x: p.lerp(before.x, after.x, between), y: p.lerp(before.y, after.y, between) };
  }

  function drawWorm() {
    moveField();
    // All the flowers are faint from the worm turning into flowers until it's burst, and then come back slowly. While
    // they're faint, they're drawn solid on a layer of their own first, and then put on the canvas faint all at once, so
    // each flower fades as a whole, without its petals showing through each other.
    const flowerShown = burstStart === null ? bloomFaint : Math.min(1, bloomFaint + ((1 - bloomFaint) * (seconds - burstStart)) / bloomSolid);
    // ...and as the pixel array takes on the shape of an old TV, they turn into black silhouettes against it
    const silhouette = tvShaped();
    const layered = (flowerShown < 1 && (ringDistance !== null || bloomStart !== null)) || silhouette > 0; // Only while there are flowers to fade or darken
    const flowerContext = layered ? faintContext : p.drawingContext;
    if (layered) {
      const main = p.drawingContext;
      if (faintLayer.width !== main.canvas.width || faintLayer.height !== main.canvas.height) {
        faintLayer.width = main.canvas.width;
        faintLayer.height = main.canvas.height;
      }
      faintContext.setTransform(main.getTransform());
      faintContext.clearRect(0, 0, p.width, p.height);
    }
    const showFaint = () => {
      if (!layered) return;
      const main = p.drawingContext;
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = flowerShown;
      main.drawImage(faintLayer, 0, 0);
      if (silhouette > 0) {
        // The same again, in black, over them
        faintContext.save();
        faintContext.setTransform(1, 0, 0, 1, 0, 0);
        faintContext.globalCompositeOperation = 'source-in';
        faintContext.fillStyle = 'black';
        faintContext.fillRect(0, 0, faintLayer.width, faintLayer.height);
        faintContext.restore();
        main.globalAlpha = flowerShown * silhouette;
        main.drawImage(faintLayer, 0, 0);
      }
      main.restore();
    };
    drawField(flowerContext);
    drawThrownOut(flowerContext);
    if (ringDistance !== null) drawRing();
    if (now.body < 0.01) {
      showFaint();
      return;
    }
    const length = Math.round(now.length);
    const start = Math.max(0, trail.length - length);
    const round = p.width / 8;
    p.rectMode(p.CENTER);
    p.fill(0);
    const wormWeight = p.random(1, 2); // The worms flicker a whole frame at a time, and the wake holds steady
    // Having come through the ring as the flower worm, waiting as the field's colour fades in, wobbling more and more,
    // and bursting
    const wobbling = bloomStart === null ? 0 : Math.min(1, Math.max(0, (seconds - bloomStart - bloomFade) / bloomWobbleTime));
    if (bloomStart !== null && burstStart === null && wobbling >= 1) burst();
    const white = pointer.down && now.whiteHeld > 0.5;
    const camera = cameraAt(pathTime);

    // Through the pixel array it stretches out, longer and thinner, as it nears the noisy spiral
    const stretching = arrayFullAt !== null ? ease(Math.min(1, (seconds - arrayFullAt) / arrayHold)) : 0;
    const longer = p.lerp(1, wormStretch, stretching);
    const thinner = p.lerp(1, wormThin, stretching);

    // From behind, the nearest has to go on top, which means the tail last
    const inSpace = now.space > 0.5;
    // As the tunnel closes, its head's pulled more and more toward the middle, and the rest of it shrinks toward its head
    const head = wormPlace(1);
    if (now.space < 0.5) Object.assign(head, trail[trail.length - 1]);
    const pull = tunnel * tunnel * (3 - 2 * tunnel);
    wormFront = { x: p.lerp(head.x, p.width / 2, pull), y: p.lerp(head.y, p.height / 2, pull) };
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let n = start; n < trail.length; n++) {
      const i = inSpace ? trail.length - 1 - (n - start) : n;
      const along = (i - start + length - (trail.length - start)) / length; // 0 at the tail, 1 at the head
      const distance = p.lerp(tailDistance, headDistance, along);
      const { x, y } = trail[i];
      // Having been through the ring, this part of the worm is a flower
      const isFlower = ringDistance !== null ? distance > ringDistance : stages[current].settings.bloom === 1 || now.bloom > 0.01 || tunnel > 0.01;
      const fade = p.lerp(1, p.sin(along * p.HALF_PI), now.flat);
      p.strokeWeight(p.lerp(wormWeight, white ? p.random(1.8, 2) : 1.8, now.flat));
      if (white) {
        p.stroke(255, 255 * fade);
      } else {
        const sine = p.abs(p.sin(along * p.PI));
        const cosine = p.abs(p.cos(along * p.PI));
        p.stroke(shimmer(now.low) * sine, shimmer(now.low) * cosine, 255 - shimmer(100) * sine, 255 * fade);
      }
      const size = p.sin(along * p.PI) * now.body;
      const depth = y / p.height; // The wake gets bigger toward the bottom of the screen
      let w = size * p.lerp(round, 200 * depth, now.flat);
      let h = size * p.lerp(round, 75 * depth * depth, now.flat);
      let seenX = x;
      let seenY = y;
      if (now.space > 0.01) {
        const seen = seenFromBehind(along, camera);
        // It roughly follows the mouse, each part of it getting to where the head has been, until it's
        // lined up with the ring
        const followed = steerAt(seconds - (1 - along) * bodyTime);
        if (followed) {
          seen.x = p.lerp(seen.x, followed.x, wormFollow * (1 - ringPull));
          seen.y = p.lerp(seen.y, followed.y, wormFollow * (1 - ringPull));
        }
        const sizeInSpace = size * round * bodyScale * seen.closer;
        let inView = keepOnScreen(seen.x, seen.y);
        if (ringDistance !== null && distance > ringDistance) inView = insideRing(seen.x, seen.y, sizeInSpace, ringPlace(pathTime));
        let fromX = x;
        let fromY = y;
        if (formAt) {
          if (i === trail.length - 1) headSeen = { ...inView };
          // The wake gathers into a circle around where it was pressed...
          const rounding = ease(Math.min(1, now.space / formRound));
          const across = (x / p.width) * 2 - 1;
          const down = (y / p.height) * 2 - 1;
          const radius = formRadius * Math.min(p.width, p.height);
          fromX = p.lerp(x, formAt.x + across * Math.sqrt(Math.max(0, 1 - (down * down) / 2)) * radius, rounding);
          fromY = p.lerp(y, formAt.y + down * Math.sqrt(Math.max(0, 1 - (across * across) / 2)) * radius, rounding);
          // ...and the worm forms there, then drifts off on its own way
          const away = 1 - ease(Math.min(1, (seconds - formStart) / formTime));
          if (headSeen) inView = { x: inView.x + (formAt.x - headSeen.x) * away, y: inView.y + (formAt.y - headSeen.y) * away };
        }
        seenX = p.lerp(fromX, inView.x, now.space);
        seenY = p.lerp(fromY, inView.y, now.space);
        w = p.lerp(w, sizeInSpace, now.space);
        h = p.lerp(h, sizeInSpace, now.space);
      }
      // It carries on as it was while the whole of it gets smaller
      if (tunnel > 0.001 || wormSize < 1) {
        seenX = wormFront.x + (seenX - head.x) * wormSize * longer;
        seenY = wormFront.y + (seenY - head.y) * wormSize * longer;
        w *= wormSize * thinner * (1 - wormAbsorbed);
        h *= wormSize * thinner * (1 - wormAbsorbed);
        left = Math.min(left, seenX - w / 2);
        right = Math.max(right, seenX + w / 2);
        top = Math.min(top, seenY - h / 2);
        bottom = Math.max(bottom, seenY + h / 2);
      }
      if (isFlower) {
        const segment = i - start;
        segments[segment] ??= { ...newFlower(), burstAngle: p.random(p.TWO_PI), burstSize: p.random(0.5, 1) };
        const flower = segments[segment];
        // Thrown out quickly, and settling back
        const thrown = (burstStart === null ? 0 : (1 - Math.exp((burstStart - seconds) * burstOut)) * (1 - burstBack()) * burstReach * burstApart * p.width * flower.burstSize)
          + (boost / boostMost) * boostSpread * p.width * wormSize * flower.burstSize; // ...swelling as it speeds up
        // Exploding when the mouse is let go, each flower in its own way
        flower.blastX = (flower.blastX ?? 0) + ((flower.blastToX ?? 0) - (flower.blastX ?? 0)) * (1 - Math.exp(-frameTime * (flower.blastSpeed ?? 1)));
        flower.blastY = (flower.blastY ?? 0) + ((flower.blastToY ?? 0) - (flower.blastY ?? 0)) * (1 - Math.exp(-frameTime * (flower.blastSpeed ?? 1)));
        const settling = Math.exp(-frameTime / (flower.blastReturn ?? 1));
        flower.blastToX = (flower.blastToX ?? 0) * settling;
        flower.blastToY = (flower.blastToY ?? 0) * settling;
        const grown = p.lerp(1, Math.pow(wormSize, -explodeGrow), Math.min(1, Math.hypot(flower.blastX, flower.blastY) / (explodeLeast * Math.min(p.width, p.height)))); // It'd be too small to see otherwise
        // Wobbling more and more, until it bursts
        const wobble = burstStart === null ? bloomWobble * w * wobbling * wobbling : 0;
        const wobbleX = Math.sin(seconds * bloomWobbleSpeed + segment * 0.7) * wobble;
        const wobbleY = Math.cos(seconds * bloomWobbleSpeed * 1.3 + segment * 0.5) * wobble;
        drawFlower(flower, seenX + Math.cos(flower.burstAngle) * thrown + flower.blastX + wobbleX, seenY + Math.sin(flower.burstAngle) * thrown + flower.blastY + wobbleY, (w * grown) / (flower.petalLength * 2), 1 - wormAbsorbed, flowerContext);
      } else if (now.box < 0.01) p.ellipse(seenX, seenY, w, h);
      else p.rect(seenX, seenY, w, h, (Math.min(w, h) / 2) * (1 - now.box));
    }
    showFaint();
    if (formAt && seconds - formStart > formTime && now.space > 0.999) formAt = null;
    // (Its trail's still short when the page has only just opened, which would make it look tiny)
    wormWide = wormSize < 1 && trail.length >= length ? Math.max(right - left, bottom - top) : Infinity;
  }

  // Smooth at both ends
  function ease(amount) {
    return amount * amount * (3 - 2 * amount);
  }

  // Stars streaking past behind the worm, so that it looks like it's flying forward through space. They
  // stream from the point it's heading for.
  function drawStars(dt) {
    if (now.space < 0.02) return;
    if (!stars.length) {
      for (let i = 0; i < starCount; i++) stars.push({ x: p.random(-1, 1), y: p.random(-1, 1), z: p.random(0.05, 1) });
    }
    const reach = Math.max(p.width, p.height) * 0.5;
    for (const star of stars) {
      const fromX = focus.x + (star.x * reach) / star.z;
      const fromY = focus.y + (star.y * reach) / star.z;
      star.z -= starSpeed * dt;
      if (star.z < 0.05) {
        star.x = p.random(-1, 1);
        star.y = p.random(-1, 1);
        star.z = 1;
        continue;
      }
      p.stroke(255, 255 * (1 - star.z) * now.space * (1 - now.bloom) * (1 - tunnel));
      p.strokeWeight(1 + (1 - star.z));
      p.line(fromX, fromY, focus.x + (star.x * reach) / star.z, focus.y + (star.y * reach) / star.z);
    }
  }

  // Goes straight to the canvas, since there can be thousands of squares
  function drawBoil(moved, dt) {
    if (now.grid < 0.01 || !picture.length) return;
    if (cols !== Math.ceil(p.width / cell) + 1 || rows !== Math.ceil(p.height / cell) + 1) takePicture();

    // Once the stage has started, the camera takes over from the painting
    const useCamera = stages[current].settings.grid && cameraReady();
    if (useCamera) readCamera(smallContext, cols, rows, live);
    cameraMix += ((useCamera ? 1 : 0) - cameraMix) * (1 - Math.exp(-dt / cameraTime));

    if (moved > 0) {
      const column = Math.floor(at.x / cell);
      const row = Math.floor(at.y / cell);
      const strength = (Math.min(moved, 60) / 60) * (pointer.down ? 1.5 : 0.5);
      for (let y = Math.max(0, row - stirSize); y <= Math.min(rows - 1, row + stirSize); y++) {
        for (let x = Math.max(0, column - stirSize); x <= Math.min(cols - 1, column + stirSize); x++) {
          const near = 1 - Math.hypot(x - column, y - row) / stirSize;
          if (near > 0) heat[y * cols + x] += near * strength;
        }
      }
    }

    const context = p.drawingContext;
    context.save(); // p5 doesn't know about the fill set below
    const white = Math.min(1, (seconds - boilStart) / whitenTime);
    const time = calm ? 0 : seconds * 0.6;
    const keep = Math.pow(cooling, dt * 60);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        heat[i] *= keep;
        const boiling = (p.noise(x * 0.15, y * 0.15, time) - 0.5) * 0.6;
        const seen = picture[i] + (live[i] - picture[i]) * cameraMix;
        const size = cell * now.grid * Math.min(1, Math.max(0, seen + heat[i] + boiling));
        if (size < 1) continue;
        const r = colours[i * 3] + (255 - colours[i * 3]) * white;
        const g = colours[i * 3 + 1] + (255 - colours[i * 3 + 1]) * white;
        const b = colours[i * 3 + 2] + (255 - colours[i * 3 + 2]) * white;
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.fillRect(x * cell - size / 2, y * cell - size / 2, size, size);
      }
    }
    context.restore();
  }

  p.setup = () => {
    canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    p.background(0);
    at = { x: p.width / 2, y: p.height / 2 };
    spiralAt = { ...at };
    focus = { ...at };
    steer = { ...at };

    soundSwitch = soundButton();
    onSoundChange((on) => (on ? startSound() : stopSound()));
    const skip = document.createElement('a');
    skip.className = 'flow-skip';
    skip.href = after;
    skip.textContent = 'skip';
    skip.addEventListener('click', (event) => {
      event.preventDefault();
      skipToPortals();
    });
    marks.append(skip);
    soundSpot.append(soundSwitch);
    container.append(welcome, caption, nextLabel, marks, soundSpot);

    // Pressing anywhere, or a key, gets past the welcome and on to the next stage, with the worm forming at (x, y)
    function begin(x = p.width / 2, y = p.height / 2) {
      if (begun) return;
      begun = true;
      formAt = { x, y };
      formStart = seconds;
      if (soundWanted()) startSound();
      welcome.classList.add('gone');
      goTo(current + 1);
    }

    let pressedAt = null;
    canvas.elt.addEventListener('pointerdown', (event) => {
      const box = container.getBoundingClientRect();
      const beginning = !begun;
      begin(event.clientX - box.left, event.clientY - box.top);
      pointer.down = true;
      pressedAt = beginning ? null : { x: event.clientX, y: event.clientY }; // The press that begins isn't a click on the next stage
      heldFrom = seconds;
    });
    // A click, rather than a drag, brings the flower that's waiting
    canvas.elt.addEventListener('click', (event) => {
      if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >= 6) return;
      if (ringWaiting) bringRing();
    });
    window.addEventListener('pointerup', () => {
      if (pointer.down && stages[current].settings.noisy) roseBurst();
      if (pointer.down && (stages[current].settings.bloom || stages[current].settings.pixels)) {
        const charge = Math.min(1, (seconds - heldFrom) / explodeCharge);
        explode(p.lerp(explodeLeast, explodeMost, charge) * Math.min(p.width, p.height));
      }
      pointer.down = false;
    });
    window.addEventListener('pointercancel', () => (pointer.down = false));
    window.addEventListener('pointermove', (event) => {
      const box = container.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (seconds - pointer.lastMoved < 1) pointer.travelled += Math.hypot(x - pointer.x, y - pointer.y);
      pointer.x = x;
      pointer.y = y;
      pointer.lastMoved = seconds;
    });
    window.addEventListener('keydown', (event) => {
      if (!begun) {
        if (!event.metaKey && !event.ctrlKey && event.key !== 'Tab') begin();
        return;
      }
      if (event.key === 'ArrowRight') goTo(current + 1);
      if (event.key === 'ArrowLeft') goTo(current - 1);
      if (stages[current].settings.noisy && spiralShapes[event.key - 1]) changeSpiral(spiralShapes[event.key - 1]);
    });

    const named = stages.findIndex(({ name }) => `#${slug(name)}` === location.hash);
    if (named > 0) {
      Object.assign(now, stages[named].settings);
      begun = true; // Straight to a stage, past the welcome
      welcome.remove();
    }
    goTo(Math.max(0, named));
  };

  p.draw = () => {
    if (handedOver) return;
    const dt = Math.min(p.deltaTime / 1000, 0.1); // So coming back to the tab doesn't jump ahead
    seconds += dt;
    if (tvOffAt !== null) {
      drawTvOff();
      return;
    }
    pathTime += dt * p.lerp(1, fieldPace, Math.max(now.bloom, tunnel)) * forwardMotion();

    // Everything drifts toward the current stage
    const drift = 1 - Math.exp(-dt / morphTime);
    for (const key in now) now[key] += (stages[current].settings[key] - now[key]) * drift;
    if (calm) now.space = 0; // The stars are too much motion for anyone who's asked for less

    const wash = pointer.down ? now.washHeld : p.lerp(now.wash, Math.max(now.wash, ringWash), ringPull * now.space);
    groundTint *= Math.exp(-dt / ringFade);
    if (pointer.down && (stages[current].settings.bloom || stages[current].settings.pixels)) boost = Math.min(boostMost, boost + boostRise * dt);
    else boost *= Math.exp(-dt / boostFade);
    const ground = groundNow();
    const ending = spiralEnding();
    const fading = wash * (1 - Math.min(1, ending / endPiling)) ** 3;
    if (fading >= 1) p.background(...groundColour.map((colour) => p.lerp(ground, colour, groundTint)), fading);
    const white = Math.max(0, (ending - endPiling) / (1 - endPiling));
    if (white > 0) p.background(255, white * white * endWhite);
    drawFragment();

    const moved = moveWorm(dt);
    steer.x += (at.x - steer.x) * steerFollow;
    steer.y += (at.y - steer.y) * steerFollow;
    steerTrail.push({ x: steer.x, y: steer.y, time: seconds });
    while (steerTrail.length > 2 && seconds - steerTrail[1].time > bodyTime + 1) steerTrail.shift();
    // In space that's where its head is going, and otherwise where the pointer is
    const heading = p.width / 2 + (weaveAt(pathTime).x - cameraAt(pathTime).x) / headDistance;
    const level = screenLevel();
    focus.x += (p.lerp(at.x, heading, now.space) - focus.x) * focusFollow;
    focus.y += (p.lerp(at.y, level, now.space) - focus.y) * focusFollow;
    drawBoil(moved, dt);
    drawPixelArray(dt);
    drawCurves(dt);
    drawSpiral(dt);
    frameTime = dt;
    if (pointer.down && moved > 0 && stages[current].settings.bloom) plantInField(at.x, at.y);
    // The stars, the flowers and the worm stay inside the old TV's screen, once the pixel array's taking on its shape
    const crt = tvShaped();
    if (crt > 0) {
      p.drawingContext.save();
      clipToTv(p.drawingContext, crt);
    }
    drawStars(dt);
    drawWorm();
    if (crt > 0) p.drawingContext.restore();

    // Playing moves things along. Left alone, it carries on by itself, unless motion's been turned down
    progress += pointer.travelled / Math.hypot(p.width, p.height) / screensToNext;
    pointer.travelled = 0;
    if (!calm) progress += dt / (stages[current].seconds ?? secondsToNext);
    if (!begun) progress = 0; // The welcome waits for a press
    const { through } = stages[current];
    const usesRing = through && !calm;
    // The flowers go on as the pixel array closes in, and once it's covered the screen, until it's absorbed the worm,
    // when the noisy spiral bursts out
    const { bloom } = stages[current].settings;
    if (bloom && wormAbsorbed >= 1) {
      // Switching off like an old TV, from what's on the screen now, and then on to the noisy spiral (see drawTvOff())
      const screen = p.drawingContext.canvas;
      tvPicture.width = screen.width;
      tvPicture.height = screen.height;
      tvPicture.getContext('2d').drawImage(screen, 0, 0);
      tvOffAt = seconds;
      const density = screen.width / p.width;
      const crt = tvShaped();
      const inset = crtInset * Math.min(p.width, p.height) * crt * density;
      tvScreen = { x: inset, y: inset, wide: screen.width - inset * 2, tall: screen.height - inset * 2, round: crtCorner * Math.min(p.width, p.height) * crt * density };
      spiralAt = { ...wormFront };
    } else if (bloom && arrayOpening >= 1) {
      now.pixels = 1;
      arrayFullAt ??= seconds;
    } else if (!bloom && progress >= 1 && !usesRing) {
      goTo(current + 1);
    }

    // The flower waits for a click, and going through it leads to the next stage
    if (usesRing && ringDistance === null) {
      ringDistance = ringWait;
      ringWaiting = true;
      portal = newFlower();
      portal.middle = portal.petalLength * 0.6; // Big enough for the worm to go through
      // Always vivid: its petals in one hue, its middle (and the field beyond) in the opposite one, and its outline in a
      // third, between them
      const hue = p.random(360);
      portal.petalColour = `rgb(${vivid(hue)})`;
      groundColour = vivid(hue + 180);
      portal.middleColour = `rgb(${groundColour})`;
      portal.strokeColour = `rgb(${vivid(hue + 90)})`;
      portal.spin = ringSpin / 60;
    }
    if (ringWaiting && seconds - stageStart > ringLongest) bringRing();
    if (ringDistance !== null && !ringWaiting) {
      // As the worm goes along its path, the ring comes along it at just the same speed
      ringDistance = p.lerp(tailDistance, headDistance, 1 - (pathTime - ringMeets) / bodyTime);
      if (ringDistance < ringNearest || ringCoversScreen()) {
        goTo(stages.findIndex(({ name }) => name === through));
        // The next stage has already wiped across, so there's nothing to fade to
        Object.assign(now, { ground: stages[current].settings.ground, wash: stages[current].settings.wash, bloom: stages[current].settings.bloom });
        groundTint = 1;
      }
    }
    // The camera comes into line with it slowly as it nears the worm's head, and goes back once it's over
    // Its label's there until the worm gets to it
    nextLabel.style.opacity = ringDistance === null ? 0 : 1 - ringOpening();
    nextLabel.disabled = !ringWaiting;
    const coming = ringDistance === null || ringWaiting ? 0 : p.constrain((ringWait - ringDistance) / (ringWait - ringLinedUp), 0, 1);
    ringPull += (coming * coming * (3 - 2 * coming) - ringPull) * (1 - Math.exp((-dt * forwardMotion()) / (ringDistance === null ? 1.5 : 0.5)));
  };
}
