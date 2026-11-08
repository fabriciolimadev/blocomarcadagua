export type WatermarkPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_IMAGE_PIXELS = 16_777_216;

export function getImageSizeError(width: number, height: number): string | null {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    return "Não foi possível ler as dimensões desta foto.";
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return "Esta foto ultrapassa 8192 pixels em um dos lados. Redimensione a foto e tente novamente.";
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return "Esta foto ultrapassa 16 megapixels. Redimensione a foto para processá-la com segurança no celular.";
  }
  return null;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

/** Percent of the photo width for size; percent of its shortest side for margin. */
export function calculateWatermarkPlacement(
  photoWidth: number,
  photoHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
  settings: { size: number; margin: number },
): WatermarkPlacement {
  if (![photoWidth, photoHeight, watermarkWidth, watermarkHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("As dimensões da foto e da assinatura precisam ser válidas.");
  }

  const margin = Math.min(photoWidth, photoHeight) * clamp(settings.margin, 0.5, 25, 3) / 100;
  const desiredWidth = photoWidth * clamp(settings.size, 1, 100, 28) / 100;
  const scale = Math.min(
    desiredWidth / watermarkWidth,
    (photoWidth - 2 * margin) / watermarkWidth,
    (photoHeight - 2 * margin) / watermarkHeight,
  );
  const width = watermarkWidth * scale;
  const height = watermarkHeight * scale;

  return { x: margin, y: photoHeight - margin - height, width, height };
}

/** Includes every nonzero alpha value, preserving antialiasing and white artwork. */
export function findAlphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): WatermarkPlacement | null {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
