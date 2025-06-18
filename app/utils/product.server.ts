// Типи для продуктів і зображень
import { db } from "~/utils/db.server";
import { attachImagesToProduct, detachOrphanedImages, downloadImageAndSave, type ImageInput } from "./image-upload.server";
import { GeneratedProduct, Collection } from "@prisma/client";

type ProductInput = {
  title?: string;
  description?: string | null;
  price?: number | null;
  comparePrice?: number | null;
  sku?: string | null;
  barcode?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  vendor?: string | null;
  type?: string | null;
  tags?: string[];
  status?: string;
  seoTitle?: string | null;
  seoDescription?: string | null
};

type CollectionInput =
  | { id: string }
  | { title: string; handle: string };

  export async function resolveCollections(
  input: CollectionInput[]
): Promise<Collection[]> {
  const collections: Collection[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue; 
    }

    let found: Collection | null = null;

    if ("id" in item) {
      found = await db.collection.findUnique({
        where: { id: item.id },
      });
    } else if ("title" in item && "handle" in item) {
      found = await db.collection.findFirst({
        where: {
          title: item.title,
          handle: item.handle,
        },
      });
    }

    if (found) {
      collections.push(found);
    }
  }

  return collections;
}

// Створення нового продукту
export async function AddProduct(input: ProductInput, images: ImageInput[], collections_input: CollectionInput[] , userId: string) {
  const resolved_collections = await resolveCollections(collections_input);
  
  const data = {
    userId,
    title: input.title || "Untitled",
    description: input.description || "",
    price: input.price ,
    comparePrice: input.comparePrice,
    sku: input.sku,
    barcode: input.barcode,
    weight: input.weight,
    weightUnit: input.weightUnit,
    vendor: input.vendor,
    type: input.type,
    tags: input.tags || [],
    status: input.status || "draft",
    collections: resolved_collections.length > 0
    ? { connect: resolved_collections.map((c) => ({ id: c.id })) }
    : undefined,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription
  } ;

  const product = await db.generatedProduct.create({ data });

  if (images?.length) {
    await attachImagesToProduct(images, product.id, userId);
  }

  await detachOrphanedImages();
  return product;
}

// Оновлення продукту
export async function UpdateProduct({input, images, collections_input, userId}:{input: GeneratedProduct, images?: ImageInput[], collections_input?: CollectionInput[], userId: string}) {
  if (!input.id) throw new Error("Missing product ID");

let parsedTags: string[] | undefined = undefined;

if (typeof input.tags !== "undefined") {
  try {
    if (Array.isArray(input.tags)) {
      parsedTags = input.tags;
    } else if (typeof input.tags === "string") {
      const parsed = JSON.parse(input.tags);

      if (Array.isArray(parsed)) {
        parsedTags = parsed;
      } else if (typeof parsed === "string") {
        parsedTags = parsed.split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    // 🔧 Знімаємо подвійні лапки, якщо є
    if (parsedTags) {
      parsedTags = parsedTags.map(tag =>
        tag.replace(/^"(.*)"$/, "$1").trim()
      );
    }

  } catch (e) {
    console.warn("❗ Не вдалося розпарсити input.tags:", input.tags);
    parsedTags = [];
  }
}

  const resolved_collections = await resolveCollections(collections_input ?? []);

  const parsedPrice = input.price !== undefined && typeof input.price === "string" ? parseFloat(input.price) : undefined;
  const parsedComparePrice = input.comparePrice !== undefined && typeof input.comparePrice === "string" ? parseFloat(input.comparePrice) : undefined;
  const parsedWeight = input.weight !== undefined && typeof input.weight === "string" ? parseFloat(input.weight) : undefined;

  let conditionExists = false;

  if (input.conditionId && input.conditionId !== "custom") {
    conditionExists = await db.conditionGPT.findFirst({
      where: {
        id: input.conditionId,
        userId: userId
      }
    }) !== null;
  }

  const data: any = {
    title: input.title,
    description: input.description,
    price: parsedPrice,
    comparePrice: parsedComparePrice,
    sku: input.sku,
    barcode: input.barcode,
    weight: parsedWeight,
    weightUnit: input.weightUnit,
    vendor: input.vendor,
    type: input.type,
    tags: parsedTags ,
    collections: resolved_collections.length > 0
    ? { set: resolved_collections.map((c) => ({ id: c.id })) }
    : undefined,
    status: input.status || "draft",
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    conditionId: conditionExists ? input.conditionId : null,
    conditionCustomGpt: input.conditionCustomGpt !== null && input.conditionCustomGpt !== 'null' ? input.conditionCustomGpt : undefined
  };

  ;
  

  if (images?.length) {
    await attachImagesToProduct(images, input.id, userId);
  }

  await detachOrphanedImages();

  const product = await db.generatedProduct.update({
    where: {
      id: input.id,
      userId: userId,
    },
    data,
    include: {
      images: true , 
      collections: true
      
    },
  })

  return product;
}

// Отримання одного продукту за ID
export async function GetProductById(id: string, userId: string) {
  return db.generatedProduct.findFirst({
    where: { id, userId },
    include: { images: true, collections: true },
  });
}

// Видалення продукту
export async function DeleteProduct(id: string, userId: string) {
  const product = await db.generatedProduct.findFirst({
    where: { id, userId },
  });
  if (!product) throw new Error("Product not found or access denied");

  await db.generatedProduct.delete({ where: { id } });
  await detachOrphanedImages();
}

// Клонування продукту
export async function DuplicateProduct(id: string, userId: string) {
  const original = await GetProductById(id, userId);
  if (!original) throw new Error("Product not found");

  const cloned = await AddProduct({
    title: `${original.title || "Untitled"} (Copy)`,
    description: original.description,
    price: original.price,
    comparePrice: original.comparePrice,
    sku: original.sku,
    barcode: original.barcode,
    weight: original.weight ,
    weightUnit: original.weightUnit,
    vendor: original.vendor,
    type: original.type,
    tags: original.tags,
    status: original.status,
    seoTitle: original.seoTitle,
    seoDescription: original.seoDescription
    
  }, 
  original.images.map((img: any) => ({
    name: img.name,
    url: img.imageUrl,
    path: img.imagePath, 
  })),
    original.collections.map((col: any) => ({
      id: col.id,
    }))
    , userId);

  return cloned;
}

export async function fetchProductsFromShopifyAPI(accessTokenDashboard: string, data: {action: string, queryValue: string | undefined, sortSelected: string | undefined, cursor: string | null, paginationEvent: string | undefined}) {
  const res = await fetch(`${process.env.SHOPIFY_APP_URL}/api/products`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessTokenDashboard}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }) 

  if (!res.ok) {
    const text = await res.text(); // або res.json() якщо впевнений
    throw new Error(`Shopify API error (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function fetchProductFromShopifyAPI(accessTokenDashboard: string, data: { action: string, productGid: string }) {
  return fetch(`${process.env.SHOPIFY_APP_URL}/api/products`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessTokenDashboard}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }) 
}

type InputImageSource = string | {
  __typename?: string;
  image?: {
    url: string;
    altText?: string;
  };
};

type InputImageSource =
  | string
  | {
      __typename?: string;
      image?: {
        url: string;
        altText?: string;
      };
    };

export const extractAndDownloadImages = async (
  sources: InputImageSource[],
  userId: string
): Promise<ImageInput[]> => {
  const images: ImageInput[] = [];

 

  for (const source of sources || []) {
    let imageUrl: string | null = null;
    let altText = "";

    // Shopify тип
    if (typeof source === "object" && source?.__typename === "MediaImage" && source.image?.url) {
      imageUrl = source.image.url;
      altText = source.image.altText || "";
    }

    // Об'єкт без __typename
    else if (typeof source === "object" && source?.image?.url) {
      imageUrl = source.image.url;
      altText = source.image.altText || "";
    }

    // Простий URL
    else if (typeof source === "string" && source.startsWith("http")) {
      imageUrl = source;
    }

     console.log("Start", imageUrl);

    if (!imageUrl) continue;

    try {
      const downloaded = await downloadImageAndSave(imageUrl, userId, altText);
      if (downloaded) {
        images.push({
          url: downloaded.url,
          path: downloaded.path,
          name: downloaded.name,
        });
      }
      console.log("downloaded", downloaded);

    } catch (err) {
      console.warn("❌ Failed to download image:", imageUrl, err);
    }
  }

  console.log(images);

  return images;
};

export async function createProductFromShopify(
  shopifyProduct: object,
  userId: string
) {

  const variant = shopifyProduct.variants?.nodes?.[0];
  const weightData = variant?.inventoryItem?.measurement?.weight || {};

  

  const input: ProductInput = {
    title: shopifyProduct.title,
    description: shopifyProduct.descriptionHtml || "",
    price: parseFloat(variant?.price) || 0,
    comparePrice: 0,
    sku: variant?.sku || null,
    barcode: variant?.barcode || null,
    weight: typeof weightData.value === "number" ? weightData.value : null,
    weightUnit: weightData.unit || "GRAMS",
    vendor: shopifyProduct.vendor || "",
    type: shopifyProduct.productType || "",
    tags: shopifyProduct.tags || [],
    status: "draft",
  };

  const images: ImageInput[] = await extractAndDownloadImages(
    shopifyProduct.media?.nodes || [],
    userId
  );

  console.log(images);

  const imageList = Array.isArray(images) && images.length > 0
    ? images
    : [];

  let collections: CollectionInput[] = (shopifyProduct.collections?.nodes || []).map((c: any) => {
    if(c.title && c.handle){
      return({
        title: c.title,
        handle: c.handle
      })
    }
  })

  console.log(imageList);

  return await AddProduct(input, imageList, collections, userId);
}

export async function exportProductsForTransferShopifyApp({
  accessTokenDashboard,
  userId,
  productIds,
}: {
  accessTokenDashboard: string;
  userId: string;
  productIds: string[];
}) {
  const products = await db.generatedProduct.findMany({
    where: {
      id: { in: productIds },
      userId,
    },
    include: {
      images: true,
      collections: true,
    },
  });

  const transformed = products.map((p) => ({
    title: p.title,
    description: p.description,
    tags: p.tags,
    type: p.type,
    vendor: p.vendor,
    comparePrice: p.comparePrice ? Math.round(p.comparePrice * 100) : null,
    price: p.price ? Math.round(p.price * 100) : null,
    barcode: p.barcode,
    sku: p.sku,
    weight: p.weight,
    weightUnit: p.weightUnit,
    status: p.status,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    collections: p.collections.map((c) => c.title),
    images: p.images.map((img) => ({
      DashboardimageUrl: process.env.DASHBOARD_API_URL + img.imageUrl,
    })),
  }));

  await fetch(`${process.env.SHOPIFY_APP_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessTokenDashboard}`,
    },
    body: JSON.stringify({
      action: "import-products",
      products: transformed
    })
  });

  return transformed;
}

export async function createProductFromShopifyApp(
  appProduct: AppProduct,
  userId: string
) {
  const {
    title,
    description,
    price,
    comparePrice,
    sku,
    barcode,
    weight,
    weightUnit,
    vendor,
    type,
    tags,
    status,
    collections = [],
    images = [],
    seoTitle,
    seoDescription,
  } = appProduct;

  const input = {
    title: title || "Untitled",
    description: description || "",
    price: typeof price === "number" ? price / 100 : null,
    comparePrice: typeof comparePrice === "number" ? comparePrice / 100 : null,
    sku: sku || null,
    barcode: barcode || null,
    weight: weight ?? null,
    weightUnit: weightUnit || "GRAMS",
    vendor: vendor || null,
    type: type || null,
    tags: Array.isArray(tags) ? tags : [],
    status: status || "draft",
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
  };

  const resolved_collections = await resolveCollections(
    collections.map((title) => ({ title }))
  );

  const imagesDownload: ImageInput[] = await extractAndDownloadImages(
    images.map((image)=>{ return (process.env.SHOPIFY_APP_URL + image.imageUrl) }) || [],
    userId
  );

  const imageList = Array.isArray(imagesDownload) && imagesDownload.length > 0
    ? imagesDownload
    : []; 

  console.log(imageList) ;

  return await AddProduct(input, imageList, resolved_collections, userId);
}