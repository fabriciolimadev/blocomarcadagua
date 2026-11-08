import assert from "node:assert/strict";
import test from "node:test";
import {
  getShareUnavailableReason,
  isShareCancellation,
  shareImageFiles,
  type SharingEnvironment,
} from "./sharing";

function supportedEnvironment(): SharingEnvironment {
  return {
    isSecureContext: true,
    navigator: { canShare: () => true, share: async () => {} },
  };
}

const files = [new File(["photo"], "foto.jpg", { type: "image/jpeg" })];

test("explains HTTPS requirement before reporting unsupported browser APIs", () => {
  assert.match(getShareUnavailableReason(files, { isSecureContext: false, navigator: {} }) ?? "", /HTTPS/);
});

test("offers ZIP when native file sharing is missing", () => {
  assert.match(getShareUnavailableReason(files, { isSecureContext: true, navigator: {} }) ?? "", /ZIP/);
  assert.match(getShareUnavailableReason(files, {
    isSecureContext: true,
    navigator: { share: async () => {} },
  }) ?? "", /ZIP/);
});

test("checks the exact prepared files, not just general sharing support", () => {
  const environment = supportedEnvironment();
  let received: File[] | undefined;
  environment.navigator.canShare = (data) => {
    received = data.files;
    return false;
  };
  assert.match(getShareUnavailableReason(files, environment) ?? "", /lote.*ZIP/);
  assert.equal(received, files);
});

test("checks browser capability before preparing without testing an empty file batch", () => {
  const environment = supportedEnvironment();
  environment.navigator.canShare = () => { throw new Error("Do not inspect an empty batch"); };
  assert.equal(getShareUnavailableReason([], environment), null);
});

test("handles browser errors when checking an actual file batch", () => {
  const environment = supportedEnvironment();
  environment.navigator.canShare = () => { throw new DOMException("Blocked", "SecurityError"); };
  assert.match(getShareUnavailableReason(files, environment) ?? "", /ZIP/);
});

test("opens native sharing synchronously and passes only actual photo files", async () => {
  const environment = supportedEnvironment();
  let received: ShareData | undefined;
  environment.navigator.share = (data) => {
    received = data;
    return Promise.resolve();
  };
  const promise = shareImageFiles(files, environment);
  assert.deepEqual(received, { files });
  await promise;
});

test("never opens native sharing for unsupported or empty batches", () => {
  const environment = supportedEnvironment();
  let called = false;
  environment.navigator.share = async () => { called = true; };
  assert.throws(() => shareImageFiles([], environment), /Prepare/);
  environment.navigator.canShare = () => false;
  assert.throws(() => shareImageFiles(files, environment), /ZIP/);
  assert.equal(called, false);
});

test("recognizes cancellation without hiding other sharing failures", () => {
  assert.equal(isShareCancellation(new DOMException("Canceled", "AbortError")), true);
  assert.equal(isShareCancellation({ name: "AbortError" }), true);
  assert.equal(isShareCancellation(new DOMException("Denied", "NotAllowedError")), false);
  assert.equal(isShareCancellation(null), false);
});
