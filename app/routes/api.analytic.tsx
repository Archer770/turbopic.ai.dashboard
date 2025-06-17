import {
    unstable_parseMultipartFormData,
    unstable_createMemoryUploadHandler,
    type ActionFunctionArgs,
  } from "@remix-run/node";
  import { requireUser } from "~/utils/requireUser";
  import { getLogs, getTokensUsage, getPayments, getTokenDistribution, takeAwaiTokens, recordProductUsage, getUserProductUsageThisMonth, getProductUsage } from "~/utils/analytic.server";
  
  export const action = async ({ request }: ActionFunctionArgs) => {
    const user = await requireUser(request);
  
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 20_000_000,
    });
  
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    const actionType = formData.get("action");
    const firstDay = formData.get("firstDay")?.toString();
    const endDay = formData.get("endDay")?.toString();
    const take = formData.get("take") ? Number(formData.get("take")) : undefined;
  
    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  
    let result;
  
    switch (actionType) {
      case "get-logs":
        result = await getLogs({ userId: user.id, firstDay, endDay, take });
        break;
  
      case "get-tokens-usage":
        result = await getTokensUsage({ userId: user.id, firstDay, endDay });
        break;

      case "get-products-usage":
        const shopDomain = formData.get("myshopifyDomain") ? formData.get("myshopifyDomain") as string : null ;
        result = await getProductUsage({ userId: user.id, firstDay, endDay, shopDomain });
        break;
  
      case "get-payments":
        result = await getPayments({ userId: user.id, firstDay, endDay });
        break;

      case "get-token-distribution":
        result = await getTokenDistribution({ userId: user.id });
        break;
      case "take-awai-token" : {
        const tokens = formData.get("tokens") ? Number(formData.get("tokens")) : 0;
        result = await takeAwaiTokens({ userId: user.id, tokens })
        break;
      }
      case "get-product-usage-distribution":
        result = await getUserProductUsageThisMonth(user.id);
        break;
      case "take-awai-product-usage" : {
        
        const shopDomain = formData.get("myshopifyDomain") ? formData.get("myshopifyDomain") as string : null ;
        const key = formData.get("key") ? formData.get("key") as string : "full_product" ;
        const weight = formData.get("weight") ? Number(formData.get("weight")) : 1.0 ;
        
        result = await recordProductUsage({ 
          userId: user.id,
          shopDomain,
          productId: null,
          key: key,
          weight: weight,
          subscriptionId: null,
          logGenId: null
        })

        break;
      }  
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  