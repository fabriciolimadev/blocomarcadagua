import assert from "node:assert/strict";
import test from "node:test";
import { calculateCoverCrop, getImageSizeError } from "./geometry";

test("center-crops a landscape photo to the portrait output without distortion", () => {
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350), { x: 1400, y: 0, width: 3200, height: 4000 });
});

test("center-crops a tall portrait and leaves a matching 4:5 photo intact", () => {
  assert.deepEqual(calculateCoverCrop(2000, 4000, 1080, 1350), { x: 0, y: 750, width: 2000, height: 2500 });
  assert.deepEqual(calculateCoverCrop(1600, 2000, 1080, 1350), { x: 0, y: 0, width: 1600, height: 2000 });
});

test("moves the source crop to the chosen edges without exposing blank space", () => {
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350, { x: 100, y: 0, zoom: 1 }), { x: 2800, y: 0, width: 3200, height: 4000 });
  assert.deepEqual(calculateCoverCrop(2000, 4000, 1080, 1350, { x: 0, y: 100, zoom: 1 }), { x: 0, y: 1500, width: 2000, height: 2500 });
});

test("zoom narrows the crop and permits positioning on both axes", () => {
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350, { x: 50, y: 50, zoom: 2 }), { x: 2200, y: 1000, width: 1600, height: 2000 });
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350, { x: 0, y: 100, zoom: 2 }), { x: 0, y: 2000, width: 1600, height: 2000 });
});

test("clamps invalid framing and retains a finite in-bounds 4:5 crop", () => {
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350, { x: NaN, y: Infinity, zoom: NaN }), { x: 1400, y: 0, width: 3200, height: 4000 });
  assert.deepEqual(calculateCoverCrop(6000, 4000, 1080, 1350, { x: -50, y: 500, zoom: 0 }), { x: 0, y: 0, width: 3200, height: 4000 });
  const crop = calculateCoverCrop(6000, 4000, 1080, 1350, { x: 100, y: 100, zoom: 100 });
  assert.ok(Math.abs(crop.width - 3200 / 3) < 0.000001);
  assert.ok(Math.abs(crop.height - 4000 / 3) < 0.000001);
  assert.ok(crop.x >= 0 && crop.y >= 0);
  assert.ok(crop.x + crop.width <= 6000 && crop.y + crop.height <= 4000);
  assert.ok(Math.abs(crop.width / crop.height - 4 / 5) < 0.000001);
});

test("rejects invalid source and target dimensions", () => {
  assert.throws(() => calculateCoverCrop(0, 300, 1080, 1350), /dimensões/);
  assert.throws(() => calculateCoverCrop(300, NaN, 1080, 1350), /dimensões/);
  assert.throws(() => calculateCoverCrop(300, 300, 0, 1350), /dimensões/);
  assert.throws(() => calculateCoverCrop(300, 300, 1080, Infinity), /dimensões/);
});

test("accepts ordinary photos and rejects unsupported source image sizes", () => {
  assert.equal(getImageSizeError(4000, 3000), null);
  assert.equal(getImageSizeError(4096, 4096), null);
  assert.match(getImageSizeError(5000, 4000) ?? "", /16 megapixels/);
  assert.match(getImageSizeError(9000, 1000) ?? "", /8192/);
  assert.match(getImageSizeError(0, 1000) ?? "", /dimensões/i);
});
