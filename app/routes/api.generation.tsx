import { GenerateProductInfo } from "~/utils/generation.server"
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/utils/requireUser";
import { GeneratedProduct, Collection } from "@prisma/client";
import { addTask } from "~/utils/queue";

import {
    AddProduct,
    UpdateProduct,
    DeleteProduct,
    DuplicateProduct,
    GetProductById,
  } from "app/utils/product.server";

  function normalizeGeneratedProduct(res: any) {
    return {
      title: res.title || null,
      description: res.description || null,
      vendor: res.vendor || null,
      type: res.type || res.product_type || null,
      tags: Array.isArray(res.tags) ? res.tags : [],
      price: typeof res.price === "number" ? res.price : 0,
      comparePrice: typeof res.comparePrice === "number" ? res.comparePrice : 0,
      sku: res.sku !== "null" ? res.sku : null,
      barcode: res.barcode !== "null" ? res.barcode : null,
      weight: typeof res.weight === "number" ? res.weight : null,
      weightUnit: res.weightUnit || "GRAMS",
      status: res.status || "draft",
      seoTitle: res.seoTitle || res["seo-title"] || null,
      seoDescription: res.seoDescription || res["seo-description"] || null,
      id: res.id, // якщо потрібно для update
    } as GeneratedProduct;
  }

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const user = await requireUser(request);
  if(user){

  const actionType = formData.get("action");

  switch (actionType) {
    case "generate": {
        let productid = formData.get("id")?.toString();
        productid = productid ? productid : ''
    
        let fields: string[] = [];
        
        formData.getAll("fields").forEach((field)=>{
          fields.push(field as string);
        })

        addTask({productId: productid, fields, jobType: "product-generation", userId: user.id})

        const result = await GetProductById(productid, user.id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    
    }
  }
    
  }else{
    return {
        error: "User required"
    }
  }
  

  
};