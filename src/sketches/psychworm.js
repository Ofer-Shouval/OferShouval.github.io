import p5 from 'p5';

// Interactive visualiser shown in the "02_Interactive_Visualisers" project tab.
const psychworm = (p) => {
  const length = 70;
  const xValue = new Array(length);
  const yValue = new Array(length);
  const coswave = new Array(length);
  const sinwave = new Array(length);
  let containerSize;

  p.setup = () => {
    containerSize = p.select('#psychwormContainer').size();
    p.createCanvas(containerSize.width, 700);
    p.fill(0);
    p.background(0);
    p.cursor(p.CROSS);
    for (let i = 0; i < length; i++) {
      const amount = p.map(i, 0, length, 0, p.PI);
      coswave[i] = p.abs(p.cos(amount));
      sinwave[i] = p.abs(p.sin(amount));
    }
  };

  p.draw = () => {
    p.background(0, p.mouseIsPressed ? 0 : 50);

    // The container is hidden until its tab opens, so keep the canvas matched to its width.
    const currentSize = p.select('#psychwormContainer').size();
    if (containerSize.width != currentSize.width) {
      containerSize = currentSize;
      p.resizeCanvas(containerSize.width - 4, 700);
    }

    for (let i = 0; i < yValue.length - 1; i++) {
      yValue[i] = yValue[i + 1];
      xValue[i] = xValue[i + 1];
      p.stroke(p.random(100, 255) * sinwave[i], p.random(100, 255) * coswave[i], 255 - p.random(100, 255) * sinwave[i]);
      const diameter = p.sin(p.map(i, 0, yValue.length, 0, p.PI)) * p.width / 8;
      p.ellipse(xValue[i], yValue[i], diameter, diameter);
    }
    p.strokeWeight(p.random(1, 2));

    yValue[yValue.length - 1] = p.mouseY;
    xValue[xValue.length - 1] = p.mouseX;
  };
};

new p5(psychworm, document.getElementById('psychwormContainer'));
