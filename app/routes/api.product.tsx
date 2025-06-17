import { data, unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";

  import {
    AddProduct,
    UpdateProduct,
    DeleteProduct,
    DuplicateProduct,
    GetProductById,
    fetchProductsFromShopifyAPI,
    fetchProductFromShopifyAPI,
    createProductFromShopify,
    exportProductsForTransferShopifyApp,
    createProductFromShopifyApp
  } from "app/utils/product.server";
  
  import { requireUser } from "~/utils/requireUser";

  import { addTask } from "~/utils/queue";

  import { db } from "~/utils/db.server";

  import { saveImageToUserFolder, type ImageInput } from "~/utils/image-upload.server";

  import { GeneratedProduct, Collection } from "@prisma/client";

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
  
  export const action = async ({ request }: { request: Request }) => {
    const user = await requireUser(request);

    
  
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 20_000_000,
    });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  
    const actionType = formData.get("action");
  
    const input: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (key !== "action" && key !== "images" && key !== "collections") {
        input[key] = formData.getAll(key).length > 1
          ? formData.getAll(key)
          : formData.get(key);
      }
    });

    let images: ImageInput[] = [];
    const images_form = formData.getAll('images');

   for (const image of images_form) {
    if (image instanceof File) {
      console.log('file');
      const image_new = await saveImageToUserFolder(image, user.id);
      images.push(image_new);
    } else {
      console.log('object');
      const image_new: ImageInput[] = JSON.parse(image as string);
      image_new.id = null;

      images.push(JSON.parse(image as string));
    }
  } 

    let collectionsRaw = formData.getAll('collections') as string[];

    const collections = collectionsRaw.map((c) => ({
      id: c.replace(/^"(.*)"$/, "$1").trim(),
    }));
  
    switch (actionType) {
      case "save": {
        await UpdateProduct({input, images, collections_input: collections, userId: user.id});
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      case "duplicate": {
        const result = await DuplicateProduct(input.id, user.id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      case "delete": {
        if(Array.isArray(input.id)){
          input.id.forEach( async (id)=>{
            await DeleteProduct(id, user.id);
          })
        }else{
          await DeleteProduct(input.id, user.id);
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      case "get": {
        const result = await GetProductById(input.id, user.id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      case "create": {
        const result = await AddProduct(input, images, collections, user.id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      case "get-from-shopify" : {

        const IntegrationId = formData.get("IntegrationId");
        if(typeof IntegrationId == "string"){
          let Integration = await db.integration.findFirst({
            where: {
            id: IntegrationId,
            userId: user.id,
            }
          })

          let products_data = {
            action: "list-products",
            queryValue: formData.get("queryValue") as string || undefined,
            sortSelected: formData.get("sortSelected") as string || undefined, 
            cursor: formData.get("cursor") as string, 
            paginationEvent: formData.get("paginationEvent") as string || undefined
          }

          if(Integration){
            const ProductsFromShopify = await fetchProductsFromShopifyAPI(Integration.accessToken, products_data);
            console.log(ProductsFromShopify);
            return ProductsFromShopify;
          }

        }else{
          return new Response(JSON.stringify({ error: "Unknown IntegrationId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        
      }

      case "connect-from-shopify" : {

        const IntegrationId = formData.get("IntegrationId");
        if(typeof IntegrationId == "string"){
          let Integration = await db.integration.findFirst({
            where: {
            id: IntegrationId,
            userId: user.id,
            }
          })

          let productGids = formData.getAll("productGid") as string[];

          let productPromises = [];

          if(productGids.length > 0){
            productGids.forEach((productGid)=>{
              let products_data = {
                action: "get-product",
                productGid
              }

              if(Integration){

                productPromises.push( fetchProductFromShopifyAPI(Integration.accessToken, products_data)
                .then(data=>data.json())
                .then(shopify_product=>{
                  createProductFromShopify(shopify_product, user.id);
                })
                )
                
              }

            })
          }

          await Promise.all(productPromises);

          return new Response(JSON.stringify({ status: "connected" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });

        }else{
          return new Response(JSON.stringify({ error: "Unknown IntegrationId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        
      }

      case "to_shop_by_ids": {

        const IntegrationId = formData.get("IntegrationId");

        if(typeof IntegrationId == "string"){

          let Integration = await db.integration.findFirst({
            where: {
            id: IntegrationId,
            userId: user.id,
            }
          })

        const product_ids = formData.getAll("id") as string[];
      
        if (!product_ids.length) {
          return new Response(JSON.stringify({ error: "No product IDs provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      
        try {
          const exportedProducts = await exportProductsForTransferShopifyApp({
            accessTokenDashboard: Integration.accessToken,
            userId: user.id,
            productIds: product_ids,
          });
      
          return new Response(JSON.stringify(exportedProducts), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("Export error:", e);
          return new Response(JSON.stringify({ error: "Export failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

    }

    
    case "import-from-shopify": {
      try {
        console.log("-> Start import-from-shopify");
    
        const raw = formData.get("products");
        if (!raw) {
          return new Response(JSON.stringify({ error: "Missing products" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
    
        let products;
        try {
          products = JSON.parse(raw.toString());
        } catch (err) {
          console.error("-> JSON parse error:", err);
          return new Response(JSON.stringify({ error: "Invalid JSON in products" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
    
        console.log("-> Products count:", products.length);
    
        const userId = user.id ?? session?.userId;
        const results = await Promise.all(
          products.map((p, index) =>
            createProductFromShopifyApp(p, userId)
              .then((res) => ({ id: res.id, status: "created" }))
              .catch((err) => {
                console.error(`-> Error creating product #${index}:`, err.message);
                return { id: null, status: "failed", reason: err.message };
              })
          )
        );
    
        return new Response(JSON.stringify({ success: true, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("-> Fatal server error:", err);
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
     case "generation_by_ids": {
      if (Array.isArray(input.id)) {
        input.id.forEach(async (id) => {
          await addTask({ productId: id, fields: [], jobType: "product-generation", userId: user.id });
        });
      } else {
        await addTask({ productId: input.id, fields: [], jobType: "product-generation", userId: user.id });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    

  };
  