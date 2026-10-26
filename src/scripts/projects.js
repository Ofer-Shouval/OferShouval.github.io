const tab = document.querySelector('.tab');
const tablinks = document.querySelectorAll('.tablinks');
const tabcontent = document.querySelectorAll('.tabcontent');

function openProject(button) {
  tabcontent.forEach((content) => (content.style.display = 'none'));
  tablinks.forEach((link) => link.classList.remove('active'));

  document.getElementById(button.dataset.project).style.display = 'block';
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0;
  button.classList.add('active');
}

function toggleMenu() {
  const expanding = tablinks[0].style.display == 'none' || tablinks[0].style.display == '';

  if (expanding) {
    tablinks.forEach((link) => (link.style.display = 'block'));
    tabcontent.forEach((content) => {
      content.style.paddingLeft = '8%';
      content.style.paddingRight = '8%';
      if (window.innerWidth >= 700) {
        content.style.width = '75%';
        content.style.marginLeft = '25%';
      }
    });
    tab.style.height = '100%';
    tab.style.width = '25%';
    tab.style.border = 'white 1px solid';
    tab.style.borderTop = 'none';
  } else {
    tablinks.forEach((link) => (link.style.display = 'none'));
    tabcontent.forEach((content) => {
      content.style.width = '100%';
      content.style.marginLeft = '0%';
      if (window.innerWidth > 700) {
        content.style.paddingLeft = '12%';
        content.style.paddingRight = '12%';
      }
    });
    tab.style.height = 'auto';
    tab.style.width = '10%';
    if (window.innerWidth >= 700) {
      tab.style.border = 'white 0px solid';
    }
  }
}

function screenCorrection() {
  if (window.innerWidth > 700 && tablinks[0].style.display == 'block') {
    tabcontent.forEach((content) => {
      content.style.width = '75%';
      content.style.marginLeft = '25%';
    });
  }
}

// Videos only download once they scroll near view (videos in hidden tabs never intersect).
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

tablinks.forEach((button) => button.addEventListener('click', () => openProject(button)));
document.querySelector('.tab .icon').addEventListener('click', toggleMenu);
window.addEventListener('resize', screenCorrection);

openProject(document.getElementById('defaultOpen'));
