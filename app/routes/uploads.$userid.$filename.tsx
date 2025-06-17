// routes/uploads.$userId.$filename.tsx
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, filename } = params;
  const url = new URL(request.url);
  const width = Number(url.searchParams.get("width"));
  const height = Number(url.searchParams.get("height"));

  if (!userId || !filename) {
    return new Response("Bad request", { status: 400 });
  }

  const originalPath = path.resolve("public", "uploads", userId, filename);
  if (!fs.existsSync(originalPath)) {
    return new Response("File not found", { status: 404 });
  }

  try {
    const acceptHeader = request.headers.get("accept") || "";
    const prefersWebp = acceptHeader.includes("image/webp");

    let fileBuffer: Buffer;

    if (width || height) {
      const cacheDir = path.resolve("public", "uploads", userId, `${width}x${height}`);
      const baseFilename = path.parse(filename).name;
      const outputBasePath = path.join(cacheDir, baseFilename);

      const tryCachedFile = (ext: string) => {
        const full = `${outputBasePath}.${ext}`;
        return fs.existsSync(full) ? full : null;
      };

      let cachedPath: string | null = null;
      if (prefersWebp) {
        cachedPath = tryCachedFile("webp") || tryCachedFile("jpeg") || tryCachedFile("png");
      } else {
        cachedPath = tryCachedFile("jpeg") || tryCachedFile("png") || tryCachedFile("webp");
      }

      if (cachedPath) {
        fileBuffer = fs.readFileSync(cachedPath);
        const type = await fileTypeFromBuffer(fileBuffer);
        return new Response(fileBuffer, {
          status: 200,
          headers: { "Content-Type": type?.mime || "application/octet-stream" },
        });
      }

      fs.mkdirSync(cacheDir, { recursive: true });

      const sharpInstance = sharp(originalPath)
        .rotate()
        .resize(width || null, height || null, { fit: "inside" });

      const [jpegBuffer, pngBuffer, webpBuffer] = await Promise.all([
        sharpInstance.clone().jpeg({ quality: 90 }).toBuffer(),
        sharpInstance.clone().png().toBuffer(),
        sharpInstance.clone().webp({ lossless: true }).toBuffer(),
      ]);

      const sizes = [jpegBuffer, pngBuffer, webpBuffer].map((b) => b.length);
      const formats = ["jpeg", "png", "webp"];
      const smallestIndex = sizes.indexOf(Math.min(...sizes));
      const bestFormat = formats[smallestIndex];
      const bestBuffer = [jpegBuffer, pngBuffer, webpBuffer][smallestIndex];

      const finalFormat = prefersWebp ? "webp" : bestFormat;
      const finalBuffer = prefersWebp ? webpBuffer : bestBuffer;

      const finalPath = `${outputBasePath}.${finalFormat}`;
      fs.writeFileSync(finalPath, finalBuffer);
      fileBuffer = finalBuffer;
    } else {
      fileBuffer = fs.readFileSync(originalPath);
    }

    const type = await fileTypeFromBuffer(fileBuffer);
    return new Response(fileBuffer, {
      status: 200,
      headers: { "Content-Type": type?.mime || "application/octet-stream" },
    });
  } catch (err) {
    console.error("Image processing error:", err);
    return new Response("Internal error", { status: 500 });
  }
};
