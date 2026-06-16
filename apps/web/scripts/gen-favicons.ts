/**
 * Regenerate all favicon assets from a single source image.
 *
 * Usage:
 *   bun run gen:favicons [path/to/source.png]
 *
 * Drop a high-res SQUARE image (ideally 512×512 or larger, PNG with
 * transparency) at apps/web/assets/logo-source.png — or pass a path — then
 * run the script. Every file Next.js serves is rebuilt from that one source.
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "../src/app");
const defaultSource = resolve(here, "../assets/logo-source.png");

const source = process.argv[2] ? resolve(process.argv[2]) : defaultSource;

// PNG variants: [output filename, edge size in px]
const PNG_TARGETS: Array<[string, number]> = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
];

// .ico bundles these resolutions for crisp rendering at any tab size.
const ICO_SIZES = [16, 32, 48];

async function main() {
  if (!existsSync(source)) {
    console.error(`✗ Source image not found: ${source}`);
    console.error(`  Place your logo there, or pass a path: bun run gen:favicons ./my-logo.png`);
    process.exit(1);
  }

  const base = sharp(source).ensureAlpha();
  const { width, height } = await base.metadata();
  if (width !== height) {
    console.warn(`⚠ Source is ${width}×${height} (not square) — it will be fit into a square and may have padding.`);
  }

  // PNGs (contain-fit onto a transparent square so non-square sources don't distort).
  for (const [name, size] of PNG_TARGETS) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(resolve(appDir, name));
    console.log(`✓ ${name} (${size}×${size})`);
  }

  // Multi-resolution .ico.
  const icoBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(source)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );
  const ico = await pngToIco(icoBuffers);
  await writeFile(resolve(appDir, "favicon.ico"), ico);
  console.log(`✓ favicon.ico (${ICO_SIZES.join(", ")})`);

  console.log("\nDone — all favicon assets regenerated from", source);
}

main();
