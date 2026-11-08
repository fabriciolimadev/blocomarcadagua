export type CropRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhotoFraming = { x: number; y: number; zoom: number };

export const INSTAGRAM_WIDTH = 1080;
export const INSTAGRAM_HEIGHT = 1350;
export const DEFAULT_FRAMING: PhotoFraming = { x: 50, y: 50, zoom: 1 };

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

/** Source rectangle that fills the output; x/y position the crop within available space. */
export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  framing: PhotoFraming = DEFAULT_FRAMING,
): CropRectangle {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("As dimensões da foto e da saída precisam ser válidas.");
  }

  const targetRatio = targetWidth / targetHeight;
  const zoom = clamp(framing.zoom, 1, 3, 1);
  const height = Math.min(sourceHeight, sourceWidth / targetRatio) / zoom;
  const width = height * targetRatio;
  return {
    x: Math.max(0, sourceWidth - width) * clamp(framing.x, 0, 100, 50) / 100,
    y: Math.max(0, sourceHeight - height) * clamp(framing.y, 0, 100, 50) / 100,
    width,
    height,
  };
}
