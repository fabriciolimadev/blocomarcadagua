import { calculateCoverCrop, DEFAULT_FRAMING, getImageSizeError, INSTAGRAM_HEIGHT, INSTAGRAM_WIDTH, type PhotoFraming } from "./geometry";

export { DEFAULT_FRAMING, INSTAGRAM_HEIGHT, INSTAGRAM_WIDTH, type PhotoFraming } from "./geometry";

export type WatermarkSettings = {
  opacity: number;
  format: "image/jpeg" | "image/png";
};

export const DEFAULT_SETTINGS: WatermarkSettings = {
  opacity: 100,
  format: "image/jpeg",
};

export const WATERMARK_SOURCE = "/instagram-template.png";
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

export function normalizeOpacity(opacity: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(opacity) ? opacity : 100)) / 100;
}

export function validatePhoto(file: File): string | null {
  if (file.size === 0) return "Este arquivo está vazio. Escolha outra foto.";
  if (file.size > MAX_PHOTO_BYTES) return "Cada foto pode ter até 30 MB. Escolha uma versão menor.";
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    return "Fotos HEIC/HEIF precisam ser convertidas para JPG antes de adicionar. No iPhone, use a opção Mais Compatível da câmera.";
  }
  const supportedMime = /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type);
  const supportedExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!supportedMime && !(file.type === "" && supportedExtension)) {
    return "Formato não compatível. Escolha fotos JPG, PNG ou WebP.";
  }
  return null;
}

function safeFileName(name: string): string {
  return name.split(/[\\/]/).pop()?.replace(/[<>:"|?*]/g, "-").replace(/\p{Cc}/gu, "-").trim() || "foto";
}

export function outputFileName(name: string, format: WatermarkSettings["format"]): string {
  const stem = safeFileName(name).replace(/\.[^.]+$/, "") || "foto";
  return `${stem}-carvalho.${format === "image/png" ? "png" : "jpg"}`;
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some mobile browsers decode files through <img> but not ImageBitmap.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível abrir esta foto. Verifique se o arquivo é uma imagem válida."));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => { image.src = ""; URL.revokeObjectURL(url); },
    };
  } catch (error) {
    image.src = "";
    URL.revokeObjectURL(url);
    throw error;
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não há memória suficiente para abrir esta foto. Tente uma imagem menor.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

function canvasBlob(canvas: HTMLCanvasElement, format: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível exportar esta foto. Tente uma imagem menor.")),
      format,
      quality,
    );
  });
}

let watermarkPromise: Promise<HTMLCanvasElement> | undefined;

/** The supplied full-frame RGBA template, including its vignette and baked-in logo. */
export function getWatermark(): Promise<HTMLCanvasElement> {
  if (!watermarkPromise) {
    watermarkPromise = (async () => {
      const response = await fetch(WATERMARK_SOURCE);
      if (!response.ok) throw new Error("Não foi possível carregar a assinatura. Atualize a página e tente novamente.");
      const decoded = await decodeImage(await response.blob());
      const original = createCanvas(decoded.width, decoded.height);
      try {
        const context = context2d(original);
        context.drawImage(decoded.source, 0, 0);
        return original;
      } catch (error) {
        releaseCanvas(original);
        throw error;
      } finally {
        decoded.close();
      }
    })().catch((error) => {
      watermarkPromise = undefined;
      throw error;
    });
  }
  return watermarkPromise;
}

export async function createThumbnail(file: File): Promise<{ url: string; width: number; height: number }> {
  const validation = validatePhoto(file);
  if (validation) throw new Error(validation);
  const decoded = await decodeImage(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const sizeError = getImageSizeError(decoded.width, decoded.height);
    if (sizeError) throw new Error(sizeError);
    const scale = Math.min(1, 1200 / Math.max(decoded.width, decoded.height));
    canvas = createCanvas(Math.max(1, Math.round(decoded.width * scale)), Math.max(1, Math.round(decoded.height * scale)));
    context2d(canvas).drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas, "image/webp", 0.86);
    return { url: URL.createObjectURL(blob), width: decoded.width, height: decoded.height };
  } finally {
    decoded.close();
    if (canvas) releaseCanvas(canvas);
  }
}

export async function processPhoto(
  file: File,
  settings: WatermarkSettings,
  framing: PhotoFraming = DEFAULT_FRAMING,
): Promise<{ blob: Blob; width: number; height: number }> {
  const validation = validatePhoto(file);
  if (validation) throw new Error(validation);
  const watermark = await getWatermark();
  const decoded = await decodeImage(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const sizeError = getImageSizeError(decoded.width, decoded.height);
    if (sizeError) throw new Error(sizeError);
    canvas = createCanvas(INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT);
    const context = context2d(canvas);
    if (settings.format === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const crop = calculateCoverCrop(decoded.width, decoded.height, INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT, framing);
    context.drawImage(decoded.source, crop.x, crop.y, crop.width, crop.height, 0, 0, INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT);
    context.globalAlpha = normalizeOpacity(settings.opacity);
    context.drawImage(watermark, 0, 0, INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT);
    const blob = await canvasBlob(canvas, settings.format, 0.95);
    return { blob, width: INSTAGRAM_WIDTH, height: INSTAGRAM_HEIGHT };
  } finally {
    decoded.close();
    if (canvas) releaseCanvas(canvas);
  }
}

export async function createPhotoZip(
  items: { name: string; blob: Blob }[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (items.length === 0) throw new Error("Adicione pelo menos uma foto antes de baixar o ZIP.");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const item of items) {
    const name = safeFileName(item.name);
    const extension = name.match(/\.[^.]+$/)?.[0] ?? "";
    const stem = extension ? name.slice(0, -extension.length) : name;
    let uniqueName = name;
    let copy = 2;
    while (usedNames.has(uniqueName.toLocaleLowerCase())) {
      uniqueName = `${stem} (${copy++})${extension}`;
    }
    usedNames.add(uniqueName.toLocaleLowerCase());
    zip.file(uniqueName, await item.blob.arrayBuffer());
  }
  return zip.generateAsync(
    { type: "blob", compression: "STORE", streamFiles: true },
    (metadata) => onProgress?.(metadata.percent),
  );
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(name);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari may read the Blob after the click handler has returned.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
