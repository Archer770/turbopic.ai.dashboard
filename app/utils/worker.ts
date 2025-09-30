import { Worker } from "bullmq";
import redis from "./redis.server.js";
import pRetry from "p-retry";
import { db } from "./db.server.js"
import { GenerateProductInfo } from "./generation.server.js";
import { UpdateProduct } from "./product.server";
import { GeneratedProduct, Collection } from "@prisma/client";

console.log("🟢 Worker is ready and listening...");

function normalizeGeneratedProduct(res: any) {
    return {
      title: res.title || undefined,
      description: res.description || undefined,
      vendor: res.vendor || undefined,
      type: res.type || res.product_type || undefined,
      tags: Array.isArray(res.tags) ? res.tags : undefined,
      price: typeof res.price === "number" ? res.price : undefined,
      comparePrice: typeof res.comparePrice === "number" ? res.comparePrice : undefined,
      sku: res.sku !== "null" ? res.sku : undefined,
      barcode: res.barcode !== "null" ? res.barcode : undefined,
      weight: typeof res.weight === "number" ? res.weight : undefined,
      weightUnit: res.weightUnit || "GRAMS",
      status: res.status || "draft",
      seoTitle: res.seoTitle || res["seo-title"] || undefined,
      seoDescription: res.seoDescription || res["seo-description"] || undefined,
      id: res.id, // якщо потрібно для update
    } as GeneratedProduct;
  }

const worker = new Worker(
  "dashboardtaskQueue",
  async (job) => {
    console.log("💼 Job received:", job.name, job.data);
    const { jobId, jobData } = job.data;
    console.log(`🚀 Processing job ${jobId}`);

    try {

        const userId = job.data.userId; 
        const productId = job.data.productId; 
        const fields = job.data.fields; 
        const jobType = job.data.jobType;

    if (job.data.jobType === "product-generation") {
  const ProductGeneration = async () => {

    console.log( 'test444', productId, userId)

    await db.generatedProduct.update({
      where: {
          id: productId,
          userId: userId,
        },
      data: { cronJob: "pending" },
    }).then(console.log);

    const data = await GenerateProductInfo(productId, fields, userId);

    if (data.error) {
      await db.generatedProduct.update({
        where: {
          id: productId,
          userId: userId,
        },
        data: { cronJob: "failed" },
      });
      throw new Error(data.error);
    }

    const input = normalizeGeneratedProduct({ ...data, id: productId });
    const collections = (data.collections || []).map((col_id: string) => ({ id: col_id }));

    await UpdateProduct({
      input,
      collections_input: collections,
      userId,
    });

    await db.generatedProduct.update({
      where: {
        id: productId,
        userId: userId,
      },
      data: { cronJob: "completed" },
    }).then(console.log);

    console.log(`✅ Job ${jobId} completed`);
  };

  await pRetry(ProductGeneration, {
    retries: 5,
    minTimeout: 60_000,
    maxTimeout: 150_000,
    randomize: true,
    factor: 2,
    onFailedAttempt: (error) => {
      
      console.warn(
        `⏳ Attempt ${error.attemptNumber} failed. Retrying in ${error.retryDelay}ms...`
      );
      console.log(error);
    },
  });
}

    } catch (error) {
        console.error(`❌ Error processing job ${jobId}:`, error);
        console.log(error);
      }
  },
  { connection: redis, concurrency: 10 }
);

  console.log("👷 Worker started...");