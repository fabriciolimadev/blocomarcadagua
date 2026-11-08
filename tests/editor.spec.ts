import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

const demoPath = path.join(process.cwd(), "public", "demo-mountains.jpg");
const templatePath = path.join(process.cwd(), "public", "instagram-template.png");
const background = { r: 24, g: 76, b: 110 };
const output = { width: 1080, height: 1350 };
type SharedFile = { name: string; type: string; size: number; width: number; height: number; sha256: string; signature: number[] };
type ShareCapture = { active: boolean; files: SharedFile[] };

async function solidPng(width = 900, height = 600) {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Prévia da foto", exact: true }).locator(".photo-watermark")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0], "The editor should fit within the viewport").toBeLessThanOrEqual(widths[1]);
}

async function expectPortraitFrame(page: Page) {
  const bounds = await page.getByRole("region", { name: "Prévia da foto", exact: true }).getByTestId("crop-frame").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width / bounds!.height).toBeCloseTo(0.8, 2);
}

async function prepareAndDownload(page: Page, testInfo: TestInfo, filename = "album.zip") {
  await page.getByRole("button", { name: /^Preparar fotos/ }).click();
  const downloadButton = page.getByRole("button", { name: "Baixar ZIP" });
  await expect(downloadButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fotos-assinadas.zip");
  const destination = testInfo.outputPath(filename);
  await download.saveAs(destination);
  expect(await download.failure()).toBeNull();
  return JSZip.loadAsync(await readFile(destination));
}

async function mockNativeShare(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as { __shares: ShareCapture[] };
    target.__shares = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data: ShareData) => !!data.files?.length && data.files.every((file) => file instanceof File) });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      const active = navigator.userActivation.isActive;
      const files = await Promise.all((data.files ?? []).map(async (file) => {
        const bytes = await file.arrayBuffer();
        const view = new DataView(bytes);
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        return {
          name: file.name, type: file.type, size: file.size,
          width: view.getUint32(16), height: view.getUint32(20),
          signature: Array.from(new Uint8Array(bytes, 0, 8)),
          sha256: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""),
        };
      }));
      target.__shares.push({ active, files });
    } });
  });
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

test("exports the exact portrait template and shares the actual prepared photo files", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await mockNativeShare(page);
  await ready(page);
  const preview = page.getByRole("region", { name: "Prévia da foto", exact: true });
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeDisabled();
  await expectPortraitFrame(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("empty.png"), fullPage: true });

  await page.getByTestId("photo-input").setInputFiles([
    { name: "viagem.jpg", mimeType: "image/jpeg", buffer: await readFile(demoPath) },
    { name: "viagem.jpg", mimeType: "image/jpeg", buffer: await sharp(demoPath).resize(600, 900).jpeg().toBuffer() },
    { name: "uniforme.png", mimeType: "image/png", buffer: await solidPng() },
  ]);
  const gallery = page.getByRole("region", { name: "Fotos adicionadas" });
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await expectPortraitFrame(page);
  await page.screenshot({ path: testInfo.outputPath("loaded.png"), fullPage: true });

  await preview.getByRole("button", { name: "Sem modelo", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Sem modelo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.locator(".photo-watermark")).toHaveCount(0);
  await preview.getByRole("button", { name: "Com modelo", exact: true }).click();
  await expect(preview.locator(".photo-watermark")).toBeVisible();
  const frame = await preview.getByTestId("crop-frame").boundingBox();
  const overlay = await preview.locator(".photo-watermark").boundingBox();
  expect(overlay!.width).toBeCloseTo(frame!.width, 0);
  expect(overlay!.height).toBeCloseTo(frame!.height, 0);
  await preview.getByRole("button", { name: "Ampliar" }).click();
  const dialog = page.getByRole("dialog", { name: "Prévia ampliada" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".photo-watermark")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await page.getByLabel("Formato de saída").selectOption("image/png");
  const zip = await prepareAndDownload(page, testInfo);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  expect(entries).toHaveLength(3);
  expect(new Set(entries.map((entry) => entry.name)).size).toBe(3);
  for (const entry of entries) {
    expect(entry.name).toMatch(/\.png$/);
    expect(await sharp(await entry.async("nodebuffer")).metadata()).toMatchObject({ ...output, format: "png" });
  }

  const uniform = await entries.find((entry) => entry.name.includes("uniforme"))!.async("nodebuffer");
  await writeFile(testInfo.outputPath("template-composite.png"), uniform);
  const actual = await sharp(uniform).removeAlpha().raw().toBuffer();
  const expected = await sharp(await solidPng(output.width, output.height)).composite([{ input: templatePath }]).removeAlpha().raw().toBuffer();
  let totalDifference = 0;
  let maximumDifference = 0;
  for (let index = 0; index < actual.length; index++) {
    const difference = Math.abs(actual[index] - expected[index]);
    totalDifference += difference;
    maximumDifference = Math.max(maximumDifference, difference);
  }
  expect(actual.length).toBe(expected.length);
  expect(totalDifference / actual.length, "The export must composite the complete supplied template once").toBeLessThan(0.6);
  expect(maximumDifference).toBeLessThanOrEqual(3);

  await page.getByRole("button", { name: "Compartilhar fotos", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shares: ShareCapture[] }).__shares.length)).toBe(1);
  const [shared] = await page.evaluate(() => (window as unknown as { __shares: ShareCapture[] }).__shares);
  expect(shared.active, "Sharing must begin during the user's click activation").toBe(true);
  expect(shared.files.map((file) => file.name)).toEqual(entries.map((entry) => entry.name));
  for (const file of shared.files) {
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
    expect(file).toMatchObject(output);
    expect(file.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const zippedBytes = await entries.find((entry) => entry.name === file.name)!.async("nodebuffer");
    expect(file.sha256, "Sharing must send the same processed image bytes as the ZIP").toBe(createHash("sha256").update(zippedBytes).digest("hex"));
  }

  await page.getByLabel("Opacidade do modelo", { exact: true }).press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Baixar ZIP" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeEnabled();
  await gallery.getByRole("button", { name: "Remover uniforme.png" }).click();
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(2);
  await gallery.getByRole("button", { name: "Limpar" }).click();
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("keeps framing per photo and exports the chosen crop after keyboard and drag adjustments", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await ready(page);
  const colors = [{ r: 220, g: 30, b: 40 }, { r: 30, g: 180, b: 80 }, { r: 35, g: 65, b: 220 }, { r: 235, g: 195, b: 35 }];
  const panels = await sharp({ create: { width: 1200, height: 600, channels: 3, background: colors[0] } })
    .composite(await Promise.all(colors.map(async (color, index) => ({ input: await sharp({ create: { width: 300, height: 600, channels: 3, background: color } }).png().toBuffer(), left: index * 300, top: 0 })))).png().toBuffer();
  await page.getByTestId("photo-input").setInputFiles([
    { name: "paineis.png", mimeType: "image/png", buffer: panels },
    { name: "vertical.png", mimeType: "image/png", buffer: await sharp(panels).rotate(90).png().toBuffer() },
  ]);
  await expect(page.getByRole("button", { name: /^Visualizar / })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeEnabled();
  const horizontal = page.getByLabel("Posição horizontal", { exact: true });
  const vertical = page.getByLabel("Posição vertical", { exact: true });
  const zoom = page.getByLabel("Zoom da foto", { exact: true });
  const frame = page.getByRole("region", { name: "Prévia da foto", exact: true }).getByTestId("crop-frame");
  await frame.scrollIntoViewIfNeeded();
  const initialBox = (await frame.boundingBox())!;
  await page.mouse.move(initialBox.x + initialBox.width * 0.4, initialBox.y + initialBox.height * 0.5);
  await page.mouse.down();
  await page.getByRole("button", { name: "Visualizar vertical.png" }).focus();
  await page.keyboard.press("Enter");
  await page.mouse.move(initialBox.x + initialBox.width * 0.6, initialBox.y + initialBox.height * 0.5);
  await page.mouse.up();
  await expect(horizontal, "A drag begun on another photo must not alter this photo's crop").toHaveValue("50");
  await expect(vertical).toHaveValue("50");
  await page.getByRole("button", { name: "Visualizar paineis.png" }).click();
  await zoom.press("End");
  await expect(zoom).toHaveValue("300");
  await horizontal.press("Home");
  await expect(horizontal).toHaveValue("0");
  await page.getByRole("button", { name: "Visualizar vertical.png" }).click();
  await expect(zoom).toHaveValue("100");
  await expect(horizontal).toHaveValue("50");
  await vertical.press("End");
  await page.getByRole("button", { name: "Visualizar paineis.png" }).click();
  await expect(zoom).toHaveValue("300");
  await expect(horizontal).toHaveValue("0");
  await zoom.press("Home");
  await horizontal.press("End");
  await frame.scrollIntoViewIfNeeded();
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  expect(Number(await horizontal.inputValue())).toBeLessThan(100);
  const afterDrag = await horizontal.inputValue();
  await frame.press("ArrowLeft");
  expect(await horizontal.inputValue()).not.toBe(afterDrag);
  await page.getByRole("button", { name: "Centralizar corte", exact: true }).click();
  await expect(horizontal).toHaveValue("50");
  await expect(vertical).toHaveValue("50");
  await expect(zoom).toHaveValue("100");
  await horizontal.press("Home");
  await expectPortraitFrame(page);
  await expectNoHorizontalOverflow(page);
  await frame.screenshot({ path: testInfo.outputPath("crop-preview.png") });
  await page.getByLabel("Formato de saída").selectOption("image/png");
  const zip = await prepareAndDownload(page, testInfo, "cropped-album.zip");
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const cropped = await entries.find((entry) => entry.name.includes("paineis"))!.async("nodebuffer");
  await writeFile(testInfo.outputPath("crop-export.png"), cropped);
  const pixel = await sharp(cropped).extract({ left: 540, top: 100, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  const expectedComposite = await sharp({ create: { ...output, channels: 3, background: colors[0] } }).composite([{ input: templatePath }]).png().toBuffer();
  const expected = await sharp(expectedComposite).extract({ left: 540, top: 100, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  expect([...pixel].every((value, index) => Math.abs(value - expected[index]) <= 3), "The left crop should export the red panel at the image center").toBe(true);
  await horizontal.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Baixar ZIP" })).toHaveCount(0);
  await page.getByRole("button", { name: "Visualizar vertical.png" }).click();
  await expect(vertical).toHaveValue("100");
  expect(runtimeErrors).toEqual([]);
});

test("retains valid photos beside corrupt JPEG and HEIC files without overflowing", async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }); });
  await ready(page);
  const validName = `foto-${"de-uma-viagem-".repeat(12)}.png`;
  const corruptName = `corrompida${"x".repeat(180)}.jpg`;
  await page.getByTestId("photo-input").setInputFiles([
    { name: corruptName, mimeType: "image/jpeg", buffer: Buffer.from("not a valid JPEG") },
    { name: validName, mimeType: "image/png", buffer: await solidPng(640, 480) },
    { name: "iphone.heic", mimeType: "image/heic", buffer: Buffer.from("unsupported HEIC") },
  ]);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("2 arquivos");
  await expect(alert).toContainText(corruptName);
  await expect(alert).toContainText("imagem válida");
  await expect(alert).toContainText("iphone.heic");
  await expect(alert).toContainText("convertidas para JPG");
  await expect(page.getByRole("button", { name: /^Visualizar / })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(alert).toHaveCount(0);
  const zip = await prepareAndDownload(page, testInfo, "valid-only.zip");
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  expect(entries).toHaveLength(1);
  expect(await sharp(await entries[0].async("nodebuffer")).metadata()).toMatchObject({ ...output, format: "jpeg" });
  await expect(page.getByRole("button", { name: "Compartilhar fotos", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Exportar fotos" }).locator(".share-hint")).toContainText("ZIP");
  await expectNoHorizontalOverflow(page);
});

test("preserves transparent photo areas for PNG and flattens them onto white for JPEG", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await ready(page);
  const transparent = await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await solidPng(200, 200), top: 0, left: 0 }]).png().toBuffer();
  await page.getByTestId("photo-input").setInputFiles({ name: "transparente.png", mimeType: "image/png", buffer: transparent });
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeEnabled();
  const frame = page.getByRole("region", { name: "Prévia da foto", exact: true }).getByTestId("crop-frame");
  const screenshot = await frame.screenshot({ path: testInfo.outputPath("transparent-jpeg-preview.png") });
  const previewMetadata = await sharp(screenshot).metadata();
  const sample = { left: Math.floor(previewMetadata.width! * 0.85), top: Math.floor(previewMetadata.height! * 0.08), width: 7, height: 7 };
  const actualSample = await sharp(screenshot).extract(sample).removeAlpha().raw().toBuffer();
  const scaledTemplate = await sharp(templatePath).resize(previewMetadata.width!, previewMetadata.height!).toBuffer();
  const whitePreview = await sharp({ create: { width: previewMetadata.width!, height: previewMetadata.height!, channels: 3, background: "white" } }).composite([{ input: scaledTemplate }]).png().toBuffer();
  const expectedSample = await sharp(whitePreview).extract(sample).removeAlpha().raw().toBuffer();
  const sampleDifference = [...actualSample].reduce((sum, value, index) => sum + Math.abs(value - expectedSample[index]), 0) / actualSample.length;
  expect(sampleDifference).toBeLessThan(3);

  const jpegZip = await prepareAndDownload(page, testInfo, "transparent-as-jpeg.zip");
  const jpegEntry = Object.values(jpegZip.files).find((file) => !file.dir)!;
  const location = { left: 950, top: 100, width: 1, height: 1 };
  const jpegPixel = await sharp(await jpegEntry.async("nodebuffer")).extract(location).removeAlpha().raw().toBuffer();
  const whiteComposite = await sharp({ create: { ...output, channels: 3, background: "white" } }).composite([{ input: templatePath }]).png().toBuffer();
  const whitePixel = await sharp(whiteComposite).extract(location).removeAlpha().raw().toBuffer();
  expect([...jpegPixel].every((value, index) => Math.abs(value - whitePixel[index]) <= 4)).toBe(true);

  await page.getByLabel("Formato de saída").selectOption("image/png");
  const pngZip = await prepareAndDownload(page, testInfo, "transparent-as-png.zip");
  const pngEntry = Object.values(pngZip.files).find((file) => !file.dir)!;
  const pngPixel = await sharp(await pngEntry.async("nodebuffer")).extract(location).ensureAlpha().raw().toBuffer();
  const templatePixel = await sharp(templatePath).extract(location).ensureAlpha().raw().toBuffer();
  expect(pngPixel[3], "Transparent photo pixels should retain only the supplied template's alpha").toBe(templatePixel[3]);
  expect(pngPixel[3]).toBeLessThan(255);
  expect(runtimeErrors).toEqual([]);
});

test("tablet layout keeps the portrait editor usable with reduced motion", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await ready(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await page.getByTestId("photo-input").setInputFiles(demoPath);
  await expect(page.getByRole("button", { name: /^Preparar fotos/ })).toBeEnabled();
  await expectPortraitFrame(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByLabel("Zoom da foto", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Opacidade do modelo", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tablet.png"), fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
