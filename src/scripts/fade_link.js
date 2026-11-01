// The link in the middle of the art landing page. Pressing it slowly fades a smeared close-up video
// of the Luminin in behind the crowd, who keep walking across it. Then the crowd fades away, the
// video dims to match the Luminin page, where it's the background, and that page carries on from
// the same moment in the video. Pressing the link again skips the wait.

let fadeTime = 4.5; // How many seconds the video takes to fade in
let holdTime = 1.5; // How many seconds to stay like that
let leaveTime = 1.5; // How many seconds the crowd takes to fade away, and the video to dim
let dimmedTo = 0.4; // How bright the video ends up (the same as .luminin-background in main.css)

let link = document.getElementById('fade-link');
let background = document.getElementById('fade-background');
let video = background.querySelector('video');
let started = false;

function go() {
  sessionStorage.setItem('lumininVideo', JSON.stringify({ time: video.currentTime, at: Date.now() }));
  window.location.href = link.href;
}

link.addEventListener('click', (event) => {
  // Opening it in a new tab, or asking for less motion, just follows the link
  if (event.metaKey || event.ctrlKey || event.shiftKey || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  event.preventDefault();
  if (started) {
    go();
    return;
  }
  started = true;

  document.body.classList.add('fading');
  video.play();
  background.style.transition = `opacity ${fadeTime}s ease-in-out`;
  background.style.opacity = 1;

  setTimeout(() => {
    // Taking away "light" turns the navbar back to how it is on the Luminin page
    document.body.classList.remove('light');
    document.body.classList.add('leaving');
    let canvas = document.querySelector('canvas');
    canvas.style.transition = `opacity ${leaveTime}s`;
    canvas.style.opacity = 0;
    video.style.transition = `opacity ${leaveTime}s`;
    video.style.opacity = dimmedTo;
  }, (fadeTime + holdTime) * 1000);
  setTimeout(go, (fadeTime + holdTime + leaveTime) * 1000);
});

// The sketch shows the video inside the portal while the mouse is over it
link.addEventListener('mouseenter', () => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play();
});
link.addEventListener('mouseleave', () => {
  if (!started) video.pause();
});

// Coming back with the browser's Back button can restore the page just as it was left, so start
// it fresh instead
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
