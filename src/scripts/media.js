// Videos only download once they scroll near view.
const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.src = target.dataset.src;
      videoObserver.unobserve(target);
    });
  },
  { rootMargin: '500px 0px' }
);

document.querySelectorAll('video[data-src]').forEach((video) => {
  videoObserver.observe(video);
  // Fallback for when autoplay is blocked (e.g. iOS Low Power Mode): tap to play.
  video.addEventListener('click', () => video.play());
});
