import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

export const imageToBase64 = async (
  imagePath: string,
  width: number | null = null,
  height: number | null = null,
  enhanceForRecognition: boolean = false,
  grayscale: boolean = false
): Promise<string> => {
  const inputPath = path.resolve(imagePath);

  if (!fs.existsSync(inputPath)) {
    throw new Error("File not found: " + inputPath);
  }

  let fileBuffer: Buffer;
  let selectedMimeType: string;
  let resolvedWidth: number | null = null;
  let resolvedHeight: number | null = null;

  if (width || height) {
    const { dir, name } = path.parse(imagePath);
    const baseCacheDir = enhanceForRecognition || grayscale
      ? path.resolve("uploads/.cache.gpt")
      : path.resolve("uploads/.cache");
    const cacheDir = path.resolve(baseCacheDir, `${width}x${height}`, dir);
    const outputFilePath = path.resolve(cacheDir, name);

    const tryFormats = ['webp', 'jpeg', 'png'] as const;
    for (const ext of tryFormats) {
      const tryPath = `${outputFilePath}.${ext}`;
      if (fs.existsSync(tryPath)) {
        fileBuffer = fs.readFileSync(tryPath);
        const fileType = await fileTypeFromBuffer(fileBuffer);
        selectedMimeType = fileType?.mime || `image/${ext}`;
        const metadata = await sharp(fileBuffer).metadata();
        resolvedWidth = metadata.width || null;
        resolvedHeight = metadata.height || null;
        return `data:${selectedMimeType};base64,${fileBuffer.toString("base64")}`;
      }
    }

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    let sharpInstance = sharp(inputPath)
      .rotate()
      .resize(width || null, height || null, { fit: 'inside' });

    if (enhanceForRecognition) {
      sharpInstance = sharpInstance.linear(1.2, -20).sharpen();
    }

    if (grayscale) {
      sharpInstance = sharpInstance.grayscale();
    }

    const jpegBuffer = await sharpInstance.clone().jpeg({ quality: 90 }).toBuffer();
    const pngBuffer = await sharpInstance.clone().png().toBuffer();
    const webpBuffer = await sharpInstance.clone().webp({ lossless: true }).toBuffer();

    const sizes = [
      { format: 'jpeg', buffer: jpegBuffer },
      { format: 'png', buffer: pngBuffer },
      { format: 'webp', buffer: webpBuffer },
    ];

    const best = sizes.reduce((min, current) =>
      current.buffer.length < min.buffer.length ? current : min
    );

    const finalOutputPath = `${outputFilePath}.${best.format}`;
    fs.writeFileSync(finalOutputPath, best.buffer);
    fileBuffer = best.buffer;
    selectedMimeType = `image/${best.format}`;

    const metadata = await sharp(fileBuffer).metadata();
    resolvedWidth = metadata.width || null;
    resolvedHeight = metadata.height || null;
  } else {
    fileBuffer = fs.readFileSync(inputPath);
    const fileType = await fileTypeFromBuffer(fileBuffer);
    selectedMimeType = fileType?.mime || 'application/octet-stream';

    const metadata = await sharp(fileBuffer).metadata();
    resolvedWidth = metadata.width || null;
    resolvedHeight = metadata.height || null;
  }

  const { name } = path.parse(imagePath);
  return `data:${selectedMimeType};base64,${fileBuffer.toString("base64")}`;
};
