import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWatermarkPlacement,
  findAlphaBounds,
  getImageSizeError,
} from "./geometry";

test("positions the mark at bottom left using photo width and short-side margin", () => {
  const box = calculateWatermarkPlacement(4000, 3000, 2000, 200, { size: 28, margin: 3 });
  assert.equal(box.x, 90);
  assert.equal(box.y, 2798);
  assert.equal(box.width, 1120);
  assert.ok(Math.abs(box.height - 112) < 0.000001);
});

test("fits a tall mark inside a panoramic photo while preserving its ratio", () => {
  const box = calculateWatermarkPlacement(4000, 300, 200, 800, { size: 80, margin: 5 });
  assert.deepEqual(box, { x: 15, y: 15, width: 67.5, height: 270 });
});

test("keeps a positive inset and contains the mark even with extreme settings", () => {
  const box = calculateWatermarkPlacement(100, 100, 200, 20, { size: 1000, margin: -5 });
  assert.ok(box.x > 0);
  assert.ok(box.x + box.width < 100);
  assert.ok(box.y + box.height < 100);
  assert.equal(box.width / box.height, 10);
});

test("rejects non-finite dimensions instead of returning invalid coordinates", () => {
  assert.throws(() => calculateWatermarkPlacement(0, 300, 200, 20, { size: 28, margin: 3 }));
  assert.throws(() => calculateWatermarkPlacement(100, NaN, 200, 20, { size: 28, margin: 3 }));
});

test("trims only transparent padding and includes faint alpha artwork", () => {
  const rgba = new Uint8ClampedArray(5 * 4 * 4);
  rgba[(1 * 5 + 1) * 4 + 3] = 255;
  rgba[(2 * 5 + 3) * 4 + 3] = 1;
  assert.deepEqual(findAlphaBounds(rgba, 5, 4), { x: 1, y: 1, width: 3, height: 2 });
  assert.equal(findAlphaBounds(new Uint8ClampedArray(8), 2, 1), null);
});

test("accepts ordinary photos and rejects unsupported export canvas sizes", () => {
  assert.equal(getImageSizeError(4000, 3000), null);
  assert.equal(getImageSizeError(4000, 4000), null);
  assert.match(getImageSizeError(5000, 4000) ?? "", /16 megapixels/);
  assert.match(getImageSizeError(9000, 1000) ?? "", /8192/);
  assert.match(getImageSizeError(0, 1000) ?? "", /dimensões/i);
});
