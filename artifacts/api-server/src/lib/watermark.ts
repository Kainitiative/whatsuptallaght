import sharp from "sharp";
import path from "path";
import { readFile } from "fs/promises";
import { logger } from "./logger";

let logoBuffer: Buffer | null = null;

async function getLogoBuffer(): Promise<Buffer> {
  if (logoBuffer) return logoBuffer;
  const logoPath = path.join(__dirname, "wut-logo-white.png");
  logoBuffer = await readFile(logoPath);
  return logoBuffer;
}

/**
 * Composites the white What's Up Tallaght logo onto the bottom-left corner
 * of an image buffer. Returns the watermarked buffer as a JPEG.
 * Falls back to the original buffer if anything fails.
 */
export async function applyWatermark(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const logo = await getLogoBuffer();

    const image = sharp(inputBuffer);
    const { width = 1024, height = 1024 } = await image.metadata();

    const logoWidth = Math.round(width * 0.28);
    const paddingX = Math.round(width * 0.025);
    const paddingY = Math.round(height * 0.025);

    const resizedLogo = await sharp(logo)
      .resize(logoWidth, undefined, { fit: "inside" })
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();
    const logoHeight = logoMeta.height ?? Math.round(logoWidth / 1.9);

    const left = paddingX;
    const top = height - logoHeight - paddingY;

    const watermarked = await image
      .composite([{ input: resizedLogo, left, top, blend: "over" }])
      .jpeg({ quality: 88 })
      .toBuffer();

    return watermarked;
  } catch (err) {
    logger.warn({ err }, "Watermark: failed to apply — returning original buffer");
    return inputBuffer;
  }
}
