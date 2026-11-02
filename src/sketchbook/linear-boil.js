// The webcam as a grid of white squares, mirrored, each as big as that part of the picture is bright.
// It asks for the camera when it starts, and what it sees never leaves the browser.
export default function linearBoil(p, container) {
  const vScale = 16;
  let video;

  // The picture, one pixel to each square (p5's video.loadPixels doesn't work in instance mode)
  const small = document.createElement('canvas');
  const smallContext = small.getContext('2d', { willReadFrequently: true });

  p.setup = () => {
    p.createCanvas(container.clientWidth, container.clientHeight);
    video = p.createCapture(p.VIDEO);
    video.hide();
  };

  p.draw = () => {
    p.background(51);
    p.rectMode(p.CENTER);
    p.noStroke();
    p.fill(255);

    const camera = video.elt;
    if (camera.readyState < 2 || !camera.videoWidth) return; // camera still starting

    const cols = Math.ceil(p.width / vScale) + 1;
    const rows = Math.ceil(p.height / vScale) + 1;
    small.width = cols;
    small.height = rows;

    // Mirrored, and cropped to fit
    const scale = Math.max(cols / camera.videoWidth, rows / camera.videoHeight);
    const drawnWidth = camera.videoWidth * scale;
    const drawnHeight = camera.videoHeight * scale;
    smallContext.translate(cols, 0);
    smallContext.scale(-1, 1);
    smallContext.drawImage(camera, (cols - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
    const pixels = smallContext.getImageData(0, 0, cols, rows).data;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const index = (x + y * cols) * 4;
        const bright = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        const w = p.map(bright, 0, 255, 0, vScale);
        p.rect(x * vScale, y * vScale, w, w);
      }
    }
  };
}
