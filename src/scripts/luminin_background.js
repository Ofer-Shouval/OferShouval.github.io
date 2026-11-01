// The moving background of the Luminin page. Coming from the link on the art landing page, it
// carries on from the moment in the video that page had got to (see fade_link.js).

let video = document.getElementById('luminin-background');

let saved = sessionStorage.getItem('lumininVideo');
if (saved) {
  sessionStorage.removeItem('lumininVideo');
  let { time, at } = JSON.parse(saved);
  video.addEventListener('loadedmetadata', () => {
    video.currentTime = (time + (Date.now() - at) / 1000) % video.duration;
  }, { once: true });
}

// Asking for less motion leaves it still
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play();
