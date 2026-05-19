const MIN_LONG_SIDE_STD = 2000;
const MAX_LONG_SIDE_STD = 3500;
const MIN_LONG_SIDE_HQ = 3200;
const MAX_LONG_SIDE_HQ = 5200;

export interface PreprocessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function preprocessForOcr(
  file: File,
  highQuality = false
): Promise<PreprocessedImage> {
  const bitmap = await createImageBitmap(file);

  const minSide = highQuality ? MIN_LONG_SIDE_HQ : MIN_LONG_SIDE_STD;
  const maxSide = highQuality ? MAX_LONG_SIDE_HQ : MAX_LONG_SIDE_STD;

  const longSide = Math.max(bitmap.width, bitmap.height);
  let scale = 1;
  if (longSide < minSide) {
    scale = minSide / longSide;
  } else if (longSide > maxSide) {
    scale = maxSide / longSide;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo crear el canvas para preprocesar');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  toGrayscale(imageData.data);
  if (highQuality) {
    unsharpMask(imageData.data, width, height);
  }
  const threshold = otsuThreshold(imageData.data);
  binarize(imageData.data, threshold);
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Fallo al generar blob preprocesado'))),
      'image/png'
    );
  });

  return { blob, width, height };
}

function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function otsuThreshold(data: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
    total++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

function binarize(data: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

function unsharpMask(data: Uint8ClampedArray, width: number, height: number): void {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = data[i];

  const blurred = new Uint8ClampedArray(width * height);
  const k = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -k; dy <= k; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -k; dx <= k; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += gray[yy * width + xx];
          count++;
        }
      }
      blurred[y * width + x] = sum / count;
    }
  }

  const amount = 1.5;
  for (let j = 0, i = 0; j < gray.length; j++, i += 4) {
    const sharp = gray[j] + amount * (gray[j] - blurred[j]);
    const v = sharp < 0 ? 0 : sharp > 255 ? 255 : sharp;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}