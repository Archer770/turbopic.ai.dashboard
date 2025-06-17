import { db } from "./db.server.js"
import openai from "./openai.server.js"
import { imageToBase64 } from "./imageToBase64.js"
import { hasPermission } from "./permissions.server.js"
import { recordProductUsage } from "./analytic.server.js"
import { logGenAction } from "./analytic.server.js"
import { getUserProductUsageThisMonth } from "./analytic.server.js"

function addTranslationInstructions(
  targetLanguage,
  excludeFields = [],
  fieldsToTranslate = []
) {
  const lang = targetLanguage || "English"

  const excluded = excludeFields.length
    ? `🟡 Important: The following fields must remain in English and should not be translated or altered: ${excludeFields
        .map(f => `"${f}"`)
        .join(", ")}.`
    : ""

  const included = fieldsToTranslate.length
    ? `🔵 Translate all other textual fields, including ${fieldsToTranslate
        .map(f => `"${f}"`)
        .join(", ")}, into ${lang}.`
    : `Translate all string fields into ${lang}.`

  return `Translate the answer into: "${lang}".\n\n${excluded}\n\n${included}`
}

const buildMessageRule = ({ key, text, type = "string", unit }) => {
  const rule = { key, text, type }
  if (unit !== undefined) {
    rule.unit = unit
  }
  return rule
}

export async function checkUserTokens(userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      oneTimeTokens: true,
      subscriptions: {
        where: { status: "active" },
        select: { remainingTokens: true }
      }
    }
  })

  if (!user) return 0

  const subTokens = user.subscriptions.reduce(
    (sum, sub) => sum + (sub.remainingTokens || 0),
    0
  )

  return (user.oneTimeTokens || 0) + subTokens
}

export const GenerateProductInfo = async (productId, fields, userId) => {

  



  if (fields.length == 0) {
    fields = [
      "title",
      "description",
      "weight",
      "google_product_category",
      "vendor",
      "product_type",
      "collections",
      "barcode",
      "sku",
      "tags",
      "seo-title",
      "seo-description",
      "all_metafields"
    ]
  }

  const activeSubscription = await db.subscription.findFirst({
  where: {
    userId,
    status: { in: ["active", "paid"] }
  },
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    remainingProductUnits: true
  }
});

// if (!activeSubscription) {
//   return { error: "No active subscription found for this user." }
// }

const productWeight = fields.length === 1 ? 0.1 : 1.0; // або гнучка логіка

const productUsedLimit = await getUserProductUsageThisMonth(userId);

console.log(productUsedLimit);

if (
  // activeSubscription?.remainingProductUnits !== null &&
  // activeSubscription.remainingProductUnits < productWeight &&
  productUsedLimit.available < productWeight
) {
  return { error: "You have reached your product generation limit for this month." };
}

  if (Boolean(productId) && Boolean(fields)) {
    let product = await db.generatedProduct.findFirst({
      where: {
        id: productId,
        userId: userId
      },
      select: {
        id: true,
        status: true,
        weightUnit: true,
        images: {
          select: {
            id: true,
            imageUrl: true,
            imagePath: true
          }
        }
      }
    })

    if (typeof product == null) {
      return {
        error: "product id and fields required"
      }
    }

    let settings;

    settings = await db.setting.findFirst({
      where: {
        userId: userId
      }
    })

    if(settings == null){
      settings = await db.setting.create({
        data: {
          userId: userId
        }
      })
    }

    let targetLanguage = "English"; 

    if(await hasPermission(userId, 'language:change', {
      exactValue: 'true'
    })){
      console.log(settings?.locale)
      targetLanguage = settings?.locale || "English"
    }else{
      settings.locale = "English";
    }



    let description_rule = false;
    let title_rule = false;
    let seo_tile_rule = false;
    let seo_desc_rule = false;

    let minDesLength = 300
    let maxDesLength = 600

    let generationMode = "normal";

    let productWithCondition = false;

    if(await hasPermission(userId, 'settings:fields', {
      exactValue: 'true'
    })){

      title_rule = settings?.messageTitle;

      description_rule = settings?.messageDes;

      seo_tile_rule = settings?.messageSeoTitle;
      seo_desc_rule = settings?.messageSeoDes;

      minDesLength = settings?.minDesLength
        ? Number(settings.minDesLength)
        : 300
      maxDesLength = settings?.maxDesLength
        ? Number(settings.maxDesLength)
        : 600

      generationMode = settings?.generationMode
        ? settings.generationMode
        : "normal"

       productWithCondition = await db.generatedProduct.findUnique({
        where: { id: productId },
        select: {
          conditionId: true,
          conditionCustomGpt: true,
          condition: {
            select: {
              message: true
            }
          }
        }
      });  
      
    }else{
      description_rule = false;
    }

    



    const userCollections = await db.collection.findMany({
      where: {
        integrations: {
          some: {
            integration: {
              userId: userId
            }
          }
        }
      },
      include: {
        integrations: {
          include: {
            integration: true
          }
        }
      }
    })

    const collection_list = []

    userCollections.map(collection => {
      collection_list.push(collection.title)
    })

    // To Do

    const messages = []

    const openai_query = {
      model: "gpt-4-turbo",
      tools: [
        {
          type: "function",
          function: {
            name: "generate_product",
            parameters: {
              type: "object",
              properties: {},
              required: []
            }
          }
        }
      ],
      tool_choice: {
        type: "function",
        function: { name: "generate_product" }
      },
      temperature: 0.2,
      top_p: 0.1,
      max_tokens: 4096,
      messages
    }

    openai_query.messages.push({
      role: "system",
      content: `You are a product understanding AI.

Your task is to analyze one or more product images taken from different angles. Use vision to understand the product's type, packaging, visible text, and any identifying features.

Extract relevant information about the product and return it in structured JSON format, following the rules provided.

If the product images contain text in a non-English language (e.g., Hebrew, Arabic, Russian), detect it automatically using OCR and translate it into ${targetLanguage} for the output.

Translate OCR and label text into ${targetLanguage} if needed, but return the final product data in ${targetLanguage}.`
    })

    const images = product ? product.images : null

    if (typeof images == null) {
      return {
        error: "images required"
      }
    }

    const message_user = {
      role: "user",
      content: []
    }

    if (Array.isArray(images)) {
      for (const item of images) {
        const image_base64 = await imageToBase64(
          item.imagePath,
          1000,
          1000,
          true,
          true
        )
        if (Array.isArray(message_user.content)) {
          message_user.content.push({
            type: "image_url",
            image_url: {
              url: image_base64
            }
          })
        }
      }

      openai_query.messages.push(message_user)
    }

    const message_rules = []

    for (let key in fields) {
      if (fields[key] == "title") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            title: { type: "string" }
          })
        }
        const text =
          'Title ( use these rules for sure to generate the title: "' +
          (typeof title_rule == "string"
            ? title_rule
            : "simple and clear") +
          '", ' +
          0 +
          " to " +
          100 +
          " characters ) "

        message_rules.push(
          buildMessageRule({ key: "title", text: text, type: "string" })
        )
        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("title")
        }
      } else if (fields[key] == "description") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            description: { type: "string" }
          })
        }

        

        // if(product.descriptionGenMode !== 'default'){
        //     generationMode = product.descriptionGenMode;
        // }



        if (generationMode == "normal") {
          if (Boolean(description_rule)) {
            minDesLength = description_rule?.minDesLength
              ? Number(description_rule.minDesLength)
              : 300
            maxDesLength = description_rule?.maxDesLength
              ? Number(description_rule.maxDesLength)
              : 600
          } else {
            minDesLength = settings?.minTextLength
              ? Number(settings.minTextLength)
              : 300
            maxDesLength = settings?.maxTextLength
              ? Number(settings.maxTextLength)
              : 600
          }
        } else if (generationMode == "simplified") {
          if (Boolean(description_rule)) {
            minDesLength = description_rule?.minDesLengthSimple
              ? Number(description_rule.minDesLengthSimple)
              : 150
            maxDesLength = description_rule?.maxDesLengthSimple
              ? Number(description_rule.maxDesLengthSimple)
              : 300
          } else {
            minDesLength = settings?.minTextLengthSimple
              ? Number(settings.minTextLengthSimple)
              : 150
            maxDesLength = settings?.maxTextLengthSimple
              ? Number(settings.maxTextLengthSimple)
              : 300
          }
        }

        let text =
          "Description ( use these rules for sure to generate the description: " +
          minDesLength +
          " to " +
          maxDesLength +
          " characters )"

        if (Boolean(description_rule)) {
          text =
            "Description ( use these rules for sure to generate the description: " +
            description_rule.message +
            ", " +
            minDesLength +
            " to " +
            maxDesLength +
            " characters ) "
        }

        message_rules.push(
          buildMessageRule({ key: "description", text: text, type: "string" })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("description")
        }
      } else if (fields[key] == "weight") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            weight: { type: "number" }
          })
        }

        message_rules.push(
          buildMessageRule({
            key: "weight",
            text: "Weight in " + product?.weightUnit,
            type: "number"
          })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("weight")
        }
      }
      // else if(fields[key] == 'google_product_category'){
      //     Object.assign(openai_query.tools[0].function.parameters.properties, {
      //         shopify_taxonomy: { "type": "string" }
      //     });

      //     message_rules.push(buildMessageRule({
      //         key: 'shopify_taxonomy',
      //         text: `Return the full category path from Shopify's Product Taxonomy - Categories: 2025-03-rc1  .
      //         ${buildTopLevelTaxonomyPrompt()} . Only use the official category name from the list. Do not invent or modify.`,
      //         type: 'string' }));

      //     openai_query.tools[0].function.parameters.required.push('shopify_taxonomy')
      // }
      else if (fields[key] == "vendor") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            vendor: { type: "string" }
          })
        }
        message_rules.push(
          buildMessageRule({ key: "vendor", text: "Vendor", type: "string" })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("vendor")
        }
      } else if (fields[key] == "product_type") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            product_type: { type: "string" }
          })
        }

        message_rules.push(
          buildMessageRule({
            key: "product_type",
            text: "Shopify product family",
            type: "string"
          })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push(
            "product_type"
          )
        }
      } else if (fields[key] == "barcode") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            barcode: { type: "string" }
          })
        }

        message_rules.push(
          buildMessageRule({
            key: "barcode",
            text: "Barcode (small numbers on the edges are also important)",
            type: "string"
          })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("barcode")
        }
      } else if (fields[key] == "sku") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            sku: { type: "string" }
          })
        }

        message_rules.push(
          buildMessageRule({ key: "sku", text: "Sku", type: "string" })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("sku")
        }
      } else if (fields[key] == "tags") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            tags: { type: "string" }
          })
        }

        const text =
          'Tags separated by ", " ( use these rules for sure to generate the tags: "' +
          (settings?.messageTags || "simple and clear") +
          " ) "

        message_rules.push(
          buildMessageRule({ key: "tags", text: text, type: "string" })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("tags")
        }
      } else if (fields[key] == "seo-title") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            "seo-title": { type: "string" }
          })
        }

        const text =
          'Seo title ( use these rules for sure to generate the seo title: "' +
          (seo_tile_rule || "simple and clear") +
          '", ' +
          0 +
          " to " +
          65 +
          " characters ) "

        message_rules.push(
          buildMessageRule({ key: "seo-title", text: text, type: "string" })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push("seo-title")
        }
      } else if (fields[key] == "seo-description") {
        if (openai_query.tools?.[0]?.function?.parameters?.properties) {
          Object.assign(openai_query.tools[0].function.parameters.properties, {
            "seo-description": { type: "string" }
          })
        }

        const text =
          'Seo description ( use these rules for sure to generate the seo description: "' +
          (seo_desc_rule || "simple and clear") +
          '", ' +
          0 +
          " to " +
          150 +
          " characters ) "

        message_rules.push(
          buildMessageRule({
            key: "seo-description",
            text: text,
            type: "string"
          })
        )

        if (openai_query.tools?.[0]?.function?.parameters?.required) {
          openai_query.tools[0].function.parameters.required.push(
            "seo-description"
          )
        }
      } else if (fields[key] == "collections") {
        if (collection_list) {
          if (openai_query.tools?.[0]?.function?.parameters?.properties) {
            Object.assign(
              openai_query.tools[0].function.parameters.properties,
              {
                collections: { type: "string" }
              }
            )
          }

          message_rules.push({
            text:
              "Select one or more collections from this list (" +
              collection_list.join(", ") +
              ') according to the product type if there is no suitable one return "null" if there are multiple values ​​separated by ", " ',
            key: "collections",
            type: "string"
          })

          if (openai_query.tools?.[0]?.function?.parameters?.required) {
            openai_query.tools[0].function.parameters.required.push(
              "collections"
            )
          }
        }
      }
    }

    let general_message = `Analyze this product.
      Fill in and return a json according to the following rules: `

    

    if (productWithCondition) {
      if (productWithCondition.conditionId && productWithCondition.condition?.message) {
        general_message += ` Additional instructions: ${productWithCondition.condition.message}. `;
      } else if (productWithCondition.conditionCustomGpt) {
        general_message += ` Additional instructions: ${productWithCondition.conditionCustomGpt}. `;
      }
    }  

    message_rules.forEach((message_rule, index) => {
      general_message =
        general_message +
        ` ` +
        (Number(index) + 1) +
        `. ` +
        message_rule.text +
        ` in the field with the key "` +
        message_rule.key +
        `" and data type "` +
        message_rule.type +
        `"`
      if (Boolean(message_rule.unit)) {
        general_message =
          general_message +
          ", use unit of measurement: " +
          '"' +
          message_rule.unit +
          '"'
      }
      general_message = general_message + ". "
    })

    general_message =
      general_message +
      `  Suitable for the store shopify, do not use the * sign. If the data is not in the image, find it in the product database. `

    let translationInstruction

    if (!settings?.locale) {
      general_message =
        general_message +
        ` Translate the answer into another language: "English". `
      translationInstruction = addTranslationInstructions(
        "English",
        ["shopify_taxonomy"],
        [
          "title",
          "description",
          "vendor",
          "tags",
          "seo-title",
          "seo-description",
          "collections"
        ]
      )
    } else {
      general_message =
        general_message +
        ` Translate the answer into another language: "` +
        settings.locale +
        `". `
      translationInstruction = addTranslationInstructions(
        settings.locale,
        ["shopify_taxonomy"],
        [
          "title",
          "description",
          "vendor",
          "tags",
          "seo-title",
          "seo-description",
          "collections"
        ]
      )
    }

    general_message += "\n\n" + translationInstruction

    if (Array.isArray(message_user.content)) {
      message_user.content.push({
        type: "text",
        text: general_message
      })
    }

    try {
      const response = await openai.chat.completions.create(openai_query)
      let result

      try {
        const toolCall = response.choices?.[0]?.message?.tool_calls?.[0]
        if (!toolCall?.function?.arguments) {
          return { error: "No function call returned from GPT" }
        }
        result = {}
        result = JSON.parse(toolCall.function.arguments)
      } catch (e) {
        return {
          error: "Invalid JSON returned from OpenAI",
          raw: response.choices[0].message.content
        }
      }

      if (response && response.usage?.total_tokens && product && product?.id) {
      
        const productUsage = await recordProductUsage({
          userId,
          integrationId: null,
          productId: product.id,
          key: fields.length === 1 ? fields[0] : "full_product",
          weight: productWeight,
          subscriptionId: activeSubscription?.id ? activeSubscription.id : null
        });

        await logGenAction(
          userId,
          "generate_product",
          {
            input: '',
            output: result
          },
          response.usage.total_tokens,
          response?.created ? Date.now() - response.created * 1000 : 0,
          product.id,
          (product.images || []).map(img => img.id),
          productUsage.id
        )

        
      }

      // if (result?.shopify_taxonomy) {
      //     const ShopifyTaxonomyId = getClosestShopifyTaxonomyId(result.shopify_taxonomy);

      //     result.category = ShopifyTaxonomyId ? ShopifyTaxonomyId : undefined;
      // }

      if (typeof result?.collections === "string") {
        const collectionTitles = result.collections
          .split(",")
          .map(title => title.trim())

        const resultCollections = userCollections.filter(item =>
          collectionTitles.includes(item.title)
        )

        result.collections = resultCollections.map(item => item.id)
      }

      if (Boolean(result?.product_type)) {
        result.type = result.product_type
      }

      if (Boolean(result?.tags)) {
        result.tags = result.tags.split(", ")
      }

      if (Boolean(result["seo-title"])) {
        result.seoTitle = result["seo-title"]
      }

      if (Boolean(result["seo-description"])) {
        result.seoDescription = result["seo-description"]
      }

      message_rules.forEach((message_rule, index) => {
        if (message_rule.type == "number" || message_rule.type == "int") {
          if (result[message_rule.key]) {
            result[message_rule.key] = parseFloat(result[message_rule.key])
          }
        }
      })

      if (result.status == 400 || result.status == "400") {
        return Promise.reject(new Error("Network failure"))
      }

      result.status = "GENERATED"

      return result
    } catch (error) {
      return Promise.reject(error)
    }
  } else {
    return {
      error: "product id and fields required"
    }
  }
}
