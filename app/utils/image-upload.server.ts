import * as fs from "node:fs";
import path from "node:path"
import { Readable } from "node:stream"
import { db } from "~/utils/db.server"
import type { Prisma } from "@prisma/client"
import fsp from "fs/promises";
import axios from "axios";
import crypto from "crypto";

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function fileExistsAndEqual(filePath: string, buffer: Buffer) {
  try {
    const existing = await fsp.readFile(filePath);
    return hashBuffer(existing) === hashBuffer(buffer);
  } catch {
    return false;
  }
}

function generateSafeFilename(baseName: string, ext: string, existingNames: Set<string>): string {
  let name = `${baseName}${ext}`;
  let counter = 1;

  while (existingNames.has(name)) {
    name = `${baseName}-${counter}${ext}`;
    counter++;
  }

  return name;
}

export const downloadImageAndSave = async (
  imageUrl: string,
  userId: string,
  altText?: string
) => {
  try {
    const response = await axios.get<Buffer>(imageUrl, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || "image/jpeg";
    const extFromMime = contentType.split("/")[1]; // image/jpeg → jpeg
    const extFromPath = path.extname(new URL(imageUrl).pathname);
    const ext = extFromPath || `.${extFromMime}`;

    const baseName = altText
      ? altText.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
      : path.basename(new URL(imageUrl).pathname, extFromPath);

    const safeBase = baseName.replace(/\.+$/, "") || "image";
    const userFolder = path.resolve("public", "uploads", userId);

    await fsp.mkdir(userFolder, { recursive: true });

    const existingFiles = new Set(await fsp.readdir(userFolder));
    let filename = generateSafeFilename(safeBase, ext.startsWith(".") ? ext : `.${ext}`, existingFiles);
    let fullPath = path.join(userFolder, filename);

    while (existingFiles.has(filename)) {
      const isSame = await fileExistsAndEqual(fullPath, buffer);
      if (isSame) {
        return {
          url: `/uploads/${userId}/${filename}`,
          path: fullPath,
          name: filename,
        };
      }

      existingFiles.add(filename);
      const nameOnly = path.basename(filename, ext);
      filename = generateSafeFilename(nameOnly, ext, existingFiles);
      fullPath = path.join(userFolder, filename);
    }

    await fsp.writeFile(fullPath, buffer);

    const file = new File([buffer], filename, { type: contentType });
    const saved = await saveImageToUserFolder(file, userId);

    return saved;
  } catch (err) {
    console.error("Error downloading image:", imageUrl, err);
    return null;
  }
};

export const saveImageToUserFolder = async (file: File, userId: string) => {
    const cleanName = encodeURIComponent(file.name.replace(/ /g, "_"))
    const safeName = cleanName.replace(/%20/g, "_")
    const userFolder = path.join("public", "uploads", userId)
    const fullPath = path.join(userFolder, safeName)
 
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
  
    const readable = Readable.fromWeb(file.stream() as any)
    const writable = fs.createWriteStream(fullPath)

    await new Promise<void>((resolve, reject) => {
      readable.pipe(writable)
        .on("finish", resolve)
        .on("error", reject)
    })
  
    return {
      url: `/uploads/${userId}/${safeName}`,
      path: fullPath,
      name: safeName,
    }
  }
  
  export const addImagesByForm = async ({
    userId,
    imagesFile,
    productId,
  }: {
    userId: string
    imagesFile: File[]
    productId?: string
  }) => {
    const imagesBd = []
    let productDb = null

    for (const file of imagesFile) {
      const image = await saveImageToUserFolder(file, userId)
      if (!image) continue
  
      const imageDb = await AddImage(image, userId)

      if (!productDb && !productId) {
       productDb = await createGeneratedProduct(userId)
      }

      const targetProductId = productId ?? productDb?.id
        if (!targetProductId) continue

      const connected = await connectImageToProduct( imageDb.id, targetProductId)
  
      if (connected) {
        imagesBd.push(connected)
      }
    }
  
    return imagesBd
  }

export type ImageInput = {
  id?: string,
  url: string,
  path: string,
  name: string
}

export const AddImage = async (
    image: ImageInput,
    userId: string
  ) => {
    const existing = await GetImage(image, userId)
  
    if (existing) {

        if (existing.userId !== userId) {
            throw new Error("Access denied: image belongs to another user");
          }

      return await db.image.update({
        data: {
          imageUrl: image.url,
          imagePath: image.path,
          name: image.name,
        },
        where: { id: existing.id },
      })
    }
  
    return await db.image.create({
      data: {
        imageUrl: image.url,
        imagePath: image.path,
        name: image.name,
        userId,
      },
    })
  }
  

type ImageSearchInput = {
    url?: string
    path?: string
  }
  
  export const GetImage = async (
    image: ImageSearchInput,
    userId: string
  ) => {
    const orConditions: Prisma.ImageWhereInput[] = []

    if (image.url) {
      orConditions.push({ imageUrl: { contains: image.url } })
    }
    if (image.path) {
      orConditions.push({ imagePath: { contains: image.path } })
    }
    
    return await db.image.findFirst({
      where: {
        userId,
        OR: orConditions,
      },
    })
  }

export const connectImageToProduct = async (
  imageId: string,
  productId: string
) => {
  return await db.image.update({
    where: {
      id: imageId,
    },
    data: {
      products: {
        connect: {
          id: productId,
        },
      },
    },
  })
}

export const createGeneratedProduct = async (
    userId: string
  ) => {
    return await db.generatedProduct.create({
      data: {
        userId,
        title: "Untitled product",
        description: "Auto-generated product",
        status: "draft",
      },
    })
  }


  async function deleteIfExists(filePath: string) {
    if (fs.existsSync(filePath)) {
      await fsp.unlink(filePath);
    }
  }
  
  export async function attachImagesToProduct(images: ImageInput[], productId: string, userId: string) {
  if (!images || images.length === 0) {
    console.log("🟡 attachImagesToProduct: no images provided, skipping.");
    return;
  }

  const finalImageIds: string[] = [];

  for (const img of images) {
    // Якщо це зображення вже має id — воно існує в базі
    if ("id" in img && typeof img.id === "string") {
      finalImageIds.push(img.id);
      continue;
    }

    // Якщо це нове зображення
    const existing = await db.image.findFirst({
      where: {
        OR: [
          { imageUrl: img.url, userId },
          { imagePath: img.path, userId },
        ],
      },
    });

    const imageRecord = existing ?? await db.image.create({
      data: {
        name: img.name,
        imageUrl: img.url,
        imagePath: img.path,
        userId,
      },
    });

    finalImageIds.push(imageRecord.id);
  }

  // Повністю оновлюємо зв'язки з продуктом (старі — відв'язуються)
  await db.generatedProduct.update({
    where: { id: productId },
    data: {
      images: {
        set: finalImageIds.map((id) => ({ id })),
      },
    },
  });
}

  
  export async function detachOrphanedImages() {
    const orphaned = await db.image.findMany({
      where: { products: { none: {} } },
    });
  
    for (const img of orphaned) {
      try {
        if (img.imagePath) {
          const basePath = path.resolve("public", "uploads", img.userId);
          const originalFile = path.resolve(basePath, path.basename(img.imagePath));
  
          await deleteIfExists(originalFile);
  
          const subdirs = await fsp.readdir(basePath, { withFileTypes: true });
          for (const dirent of subdirs) {
            if (dirent.isDirectory() && /^[0-9]+x[0-9]+$/.test(dirent.name)) {
              const cachedFile = path.resolve(basePath, dirent.name, path.parse(img.name).name);
              for (const ext of [".jpeg", ".png", ".webp"]) {
                await deleteIfExists(cachedFile + ext);
              }
            }
          }
        }
  
        await db.image.delete({ where: { id: img.id } });
      } catch (e) {
        console.error("Failed to delete orphaned image or file:", img.imageUrl, e);
      }
    }
  }
  
  