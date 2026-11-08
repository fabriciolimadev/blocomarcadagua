import assert from "node:assert/strict";
import test from "node:test";
import { createPhotoZip, DEFAULT_FRAMING, DEFAULT_SETTINGS, INSTAGRAM_HEIGHT, INSTAGRAM_WIDTH, normalizeOpacity, outputFileName, validatePhoto, WATERMARK_SOURCE } from "./image-processing";

test("uses the full supplied Instagram template with an opaque overlay by default", () => {
  assert.equal(WATERMARK_SOURCE, "/instagram-template.png");
  assert.deepEqual([INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT], [1080, 1350]);
  assert.deepEqual(DEFAULT_SETTINGS, { opacity: 100, format: "image/jpeg" });
  assert.deepEqual(DEFAULT_FRAMING, { x: 50, y: 50, zoom: 1 });
});

test("normalizes overlay opacity to valid canvas alpha, including invalid input", () => {
  assert.equal(normalizeOpacity(100), 1);
  assert.equal(normalizeOpacity(50), 0.5);
  assert.equal(normalizeOpacity(0), 0);
  assert.equal(normalizeOpacity(-10), 0);
  assert.equal(normalizeOpacity(200), 1);
  assert.equal(normalizeOpacity(NaN), 1);
  assert.equal(normalizeOpacity(Infinity), 1);
});

function photo(name: string, type: string, size = 128): File {
  return { name, type, size } as File;
}

test("accepts JPEG, PNG and WebP plus a recognized extension when MIME is absent", () => {
  assert.equal(validatePhoto(photo("foto.jpg", "image/jpeg")), null);
  assert.equal(validatePhoto(photo("foto.png", "image/png")), null);
  assert.equal(validatePhoto(photo("foto.webp", "image/webp")), null);
  assert.equal(validatePhoto(photo("FOTO.JPEG", "")), null);
});

test("explains how iPhone HEIC photos must be converted", () => {
  assert.match(validatePhoto(photo("IMG_0001.HEIC", "image/heic")) ?? "", /HEIC.*JPG/i);
});

test("rejects empty, oversized and unsupported uploads", () => {
  assert.match(validatePhoto(photo("foto.jpg", "image/jpeg", 0)) ?? "", /vazio/i);
  assert.match(validatePhoto(photo("foto.jpg", "image/jpeg", 30 * 1024 * 1024 + 1)) ?? "", /30 MB/);
  assert.match(validatePhoto(photo("animacao.gif", "image/gif")) ?? "", /JPG, PNG ou WebP/);
  assert.match(validatePhoto(photo("script.jpg", "text/plain")) ?? "", /JPG, PNG ou WebP/);
});

test("creates safe output names using the chosen format", () => {
  assert.equal(outputFileName("minha.foto.JPG", "image/png"), "minha.foto-carvalho.png");
  assert.equal(outputFileName("../pasta/foto.webp", "image/jpeg"), "foto-carvalho.jpg");
  assert.equal(outputFileName("", "image/jpeg"), "foto-carvalho.jpg");
});

test("ZIP preserves every photo when filenames repeat and reports completion", async () => {
  const { default: JSZip } = await import("jszip");
  const progress: number[] = [];
  const blob = await createPhotoZip([
    { name: "foto.jpg", blob: new Blob(["first photo"]) },
    { name: "foto.jpg", blob: new Blob(["second photo"]) },
    { name: "../pasta/outra.png", blob: new Blob(["third photo"]) },
  ], (value) => progress.push(value));
  const archive = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.deepEqual(Object.keys(archive.files), ["foto.jpg", "foto (2).jpg", "outra.png"]);
  assert.equal(await archive.file("foto.jpg")?.async("string"), "first photo");
  assert.equal(await archive.file("foto (2).jpg")?.async("string"), "second photo");
  assert.equal(progress.at(-1), 100);
});

test("does not create an empty ZIP", async () => {
  await assert.rejects(createPhotoZip([]), /pelo menos uma foto/);
});
