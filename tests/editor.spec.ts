import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

const demoPath = path.join(process.cwd(), "public", "demo-mountains.jpg");
const background = { r: 24, g: 76, b: 110 };

async function solidPng(width = 900, height = 600) {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0], "The editor should fit within the viewport").toBeLessThanOrEqual(widths[1]);
}

async function prepareAndDownload(page: Page, testInfo: TestInfo, filename = "album.zip") {
  await page.getByRole("button", { name: "Preparar fotos para baixar" }).click();
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

test("uploads a mixed album, compares previews, and exports full-size watermarked images", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const preview = page.getByRole("region", { name: "Prévia da foto", exact: true });
  await expect(preview.getByRole("img", { name: "Marca d’água AE Carvalho" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar fotos para baixar" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("empty.png"), fullPage: true });

  const landscape = await readFile(demoPath);
  const portrait = await sharp(demoPath).resize(600, 900).jpeg().toBuffer();
  await page.getByTestId("photo-input").setInputFiles([
    { name: "viagem.jpg", mimeType: "image/jpeg", buffer: landscape },
    { name: "viagem.jpg", mimeType: "image/jpeg", buffer: portrait },
    { name: "uniforme.png", mimeType: "image/png", buffer: await solidPng() },
  ]);
  const gallery = page.getByRole("region", { name: "Fotos adicionadas" });
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Preparar fotos para baixar" })).toBeEnabled();
  await expect(preview.getByText("1600 × 1067 px")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("loaded.png"), fullPage: true });

  await preview.getByRole("button", { name: "Original", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Original", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByRole("img", { name: "Marca d’água AE Carvalho" })).toHaveCount(0);
  await preview.getByRole("button", { name: "Com marca", exact: true }).click();
  await expect(preview.getByRole("img", { name: "Marca d’água AE Carvalho" })).toBeVisible();
  await preview.getByRole("button", { name: "Ampliar" }).click();
  const dialog = page.getByRole("dialog", { name: "Prévia ampliada" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Marca d’água AE Carvalho" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await gallery.getByRole("button", { name: "Visualizar uniforme.png" }).click();
  await expect(preview.getByText("900 × 600 px")).toBeVisible();
  await page.getByLabel("Formato de saída").selectOption("image/png");
  for (let step = 0; step < 4; step++) await page.getByLabel("Tamanho", { exact: true }).press("ArrowRight");
  for (let step = 0; step < 2; step++) await page.getByLabel("Margem das bordas").press("ArrowRight");
  for (let step = 0; step < 20; step++) await page.getByLabel("Opacidade", { exact: true }).press("ArrowLeft");
  await expect(page.getByLabel("Tamanho", { exact: true })).toHaveValue("32");
  await expect(page.getByLabel("Margem das bordas")).toHaveValue("5");
  await expect(page.getByLabel("Opacidade", { exact: true })).toHaveValue("80");

  const photoBounds = await preview.locator(".photo-image").boundingBox();
  const watermarkBounds = await preview.getByRole("img", { name: "Marca d’água AE Carvalho" }).boundingBox();
  expect(photoBounds).not.toBeNull();
  expect(watermarkBounds).not.toBeNull();
  if (!photoBounds || !watermarkBounds) throw new Error("Preview image geometry is unavailable");
  const previewScale = photoBounds.width / 900;
  expect((watermarkBounds.x - photoBounds.x) / previewScale).toBeCloseTo(30, 0);
  expect((photoBounds.y + photoBounds.height - watermarkBounds.y - watermarkBounds.height) / previewScale).toBeCloseTo(30, 0);
  expect(watermarkBounds.width / previewScale).toBeCloseTo(288, 0);

  const zip = await prepareAndDownload(page, testInfo);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  expect(entries).toHaveLength(3);
  expect(new Set(entries.map((entry) => entry.name)).size).toBe(3);
  expect(entries.every((entry) => entry.name.endsWith(".png"))).toBe(true);
  const metadata = await Promise.all(entries.map(async (entry) => sharp(await entry.async("nodebuffer")).metadata()));
  expect(metadata.map(({ width, height, format }) => ({ width, height, format }))).toEqual([
    { width: 1600, height: 1067, format: "png" },
    { width: 600, height: 900, format: "png" },
    { width: 900, height: 600, format: "png" },
  ]);

  const exportedSolid = entries.find((entry) => entry.name.includes("uniforme"));
  expect(exportedSolid).toBeDefined();
  const { data, info } = await sharp(await exportedSolid!.async("nodebuffer")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  let outsideChanges = 0;
  let left = info.width;
  let bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      const differs = data[offset] !== background.r || data[offset + 1] !== background.g || data[offset + 2] !== background.b;
      if (!differs) continue;
      changed++;
      left = Math.min(left, x);
      bottom = Math.max(bottom, y);
      if (x < 29 || x > 319 || y < 300 || y > 570) outsideChanges++;
    }
  }
  expect(changed, "The downloaded PNG must contain the visible watermark").toBeGreaterThan(500);
  expect(outsideChanges, "Pixels outside the bottom-left watermark area must remain untouched").toBe(0);
  expect(left).toBeGreaterThanOrEqual(29);
  expect(left).toBeLessThanOrEqual(35);
  expect(bottom).toBeGreaterThanOrEqual(562);
  expect(bottom).toBeLessThanOrEqual(570);

  await page.getByLabel("Opacidade", { exact: true }).press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Baixar ZIP" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preparar fotos para baixar" })).toBeEnabled();
  await gallery.getByRole("button", { name: "Remover uniforme.png" }).click();
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(2);
  await expect(preview.getByText("600 × 900 px")).toBeVisible();
  await gallery.getByRole("button", { name: "Limpar" }).click();
  await expect(gallery.getByRole("button", { name: /^Visualizar / })).toHaveCount(0);
  await expect(page.getByText("Foto de demonstração", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar fotos para baixar" })).toBeDisabled();
  expect(pageErrors).toEqual([]);
});

test("retains valid photos when corrupt JPEG and HEIC files are selected in the same batch", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Assinatura AE Carvalho FJU" })).toBeVisible();
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
  expect(entries[0].name).toMatch(/\.jpg$/);
  expect(await sharp(await entries[0].async("nodebuffer")).metadata()).toMatchObject({ width: 640, height: 480, format: "jpeg" });
});

test("shows the same white background in transparent-photo JPEG preview and export", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Assinatura AE Carvalho FJU" })).toBeVisible();
  const transparent = await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await solidPng(200, 200), top: 0, left: 0 }]).png().toBuffer();
  await page.getByTestId("photo-input").setInputFiles({ name: "transparente.png", mimeType: "image/png", buffer: transparent });
  await expect(page.getByRole("button", { name: "Preparar fotos para baixar" })).toBeEnabled();
  const frame = page.getByRole("region", { name: "Prévia da foto", exact: true }).locator(".photo-frame");
  const screenshot = await frame.screenshot({ path: testInfo.outputPath("transparent-jpeg-preview.png") });
  const preview = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cornerOffset = (10 * preview.info.width + preview.info.width - 10) * preview.info.channels;
  expect([...preview.data.subarray(cornerOffset, cornerOffset + 3)]).toEqual([255, 255, 255]);
  const zip = await prepareAndDownload(page, testInfo, "transparent-as-jpeg.zip");
  const entry = Object.values(zip.files).find((file) => !file.dir)!;
  const exported = await sharp(await entry.async("nodebuffer")).raw().toBuffer({ resolveWithObject: true });
  expect(exported.info).toMatchObject({ width: 600, height: 400, channels: 3 });
  const exportOffset = (10 * exported.info.width + exported.info.width - 10) * exported.info.channels;
  expect([...exported.data.subarray(exportOffset, exportOffset + 3)]).toEqual([255, 255, 255]);

  await page.getByLabel("Formato de saída").selectOption("image/png");
  const pngZip = await prepareAndDownload(page, testInfo, "transparent-as-png.zip");
  const pngEntry = Object.values(pngZip.files).find((file) => !file.dir)!;
  const png = await sharp(await pngEntry.async("nodebuffer")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(png.data[(10 * png.info.width + png.info.width - 10) * png.info.channels + 3], "PNG export should preserve the photo's transparent area").toBe(0);
});
