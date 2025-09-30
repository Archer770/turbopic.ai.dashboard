import { db } from "~/utils/db.server";
import { addPaymentLog } from "~/utils/analytic.server";
import { requireUser } from "~/utils/requireUser";

type WebhookPayload = {
  topic: string;
  shop: string;   // my-shop.myshopify.com
  payload: any;
};

async function resolveUserIdByShop(shop: string, shopGid?: string) {
  const norm = String(shop || "").trim().toLowerCase();

  const integ = await db.integration.findFirst({
    where: {
      type: "shopify",
      OR: [
        { shopDomain: norm },
        shopGid ? { metadata: { path: ["shopGid"], equals: shopGid } } : undefined,
        { metadata: { path: ["domain"], equals: norm } },
      ].filter(Boolean) as any,
    },
    select: { userId: true },
  });

  return integ?.userId ?? null;
}

export const action = async ({ request }: { request: Request }) => {
  try {
    const auth = request.headers.get("Authorization");
    const isService = auth === `Bearer ${process.env.APP_OR_CRON_TOKEN}`;

    const userCtx = isService ? null : await requireUser(request);

    const { topic, shop, payload }: WebhookPayload = await request.json();

    let userId: string | null = userCtx?.id ?? null;

    console.log("🔔 Shopify Webhook Received:", topic);
    console.log("From shop:", shop);

    switch (topic) {
      case "APP_SUBSCRIPTIONS_UPDATE": {
        const sub = payload?.app_subscription;

        if (!sub) {
          console.warn("❌ payload.app_subscription missing");
          return new Response("Invalid payload", { status: 400 });
        }

        const subGid = sub.admin_graphql_api_id;
        const shopGid = sub.admin_graphql_api_shop_id;

        // Якщо сервісний режим — визначаємо userId за магазином
        if (!userId) {
          userId = await resolveUserIdByShop(shop, shopGid);
          if (!userId) {
            console.warn("❌ Cannot resolve userId by shop/shopGid", { shop, shopGid });
            return new Response("User not found for shop", { status: 404 });
          }
        }

        const planHandle = sub.plan_handle;
        const amountCents = Math.round(parseFloat(sub.price || "0") * 100);
        const currency = sub.currency || "USD";
        const status = String(sub.status || "").toLowerCase();

        const rawPeriodEnd =
          sub.current_period_end ??
          sub.currentPeriodEnd ??
          sub.updated_at ??
          sub.created_at ??
          null;

        if (!rawPeriodEnd) {
          console.warn("❌ missing current_period_end/currentPeriodEnd/updated_at/created_at");
          return new Response("missing current_period_end", { status: 400 });
        }

        const currentPeriodEnd =
          typeof rawPeriodEnd === "number"
            ? new Date(rawPeriodEnd * 1000) // якщо в секундах
            : new Date(String(rawPeriodEnd)); // ISO-строка

        const isCanceled = ["cancelled", "expired"].includes(status);

        const plan = await db.subscriptionPlan.findFirst({
          where: { shopifyPlanHandle: planHandle },
        });

        if (!plan) {
          console.warn("⚠️ No SubscriptionPlan matched for handle:", planHandle);
          return new Response("Plan not found", { status: 404 });
        }

        const subscription = await db.subscription.upsert({
          where: { shopifySubscriptionGid: subGid },
          update: {
            planId: plan.id,
            userId,
            shopifyShopGid: shopGid,
            provider: "SHOPIFY",
            currentPeriodEnd,
            status,
            remainingTokens: isCanceled ? 0 : plan.tokens,
            remainingProductUnits: isCanceled ? 0 : (plan.maxProductUnitsPerMonth ?? 0),
          },
          create: {
            planId: plan.id,
            userId,
            provider: "SHOPIFY",
            shopifySubscriptionGid: subGid,
            shopifyShopGid: shopGid,
            status,
            currentPeriodEnd,
            createdAt: new Date(),
            remainingTokens: isCanceled ? 0 : plan.tokens,
            remainingProductUnits: isCanceled ? 0 : (plan.maxProductUnitsPerMonth ?? 0),
          },
        });

        await addPaymentLog({
          userId,
          amountCents,
          currency,
          status,
          invoiceId: subGid,
          subscriptionId: subscription.id,
          oneTimeProductId: undefined,
          provider: "SHOPIFY",
        });

        break;
      }

      case "APP_PURCHASES_ONE_TIME_UPDATE": {
        const oneTimeGid = payload.admin_graphql_api_id;
        const shopGid = payload.admin_graphql_api_shop_id;
        const amountCents = Math.round(parseFloat(payload.price) * 100);
        const currency = payload.currency || "USD";
        const status = String(payload.status || "").toLowerCase();

        if (!userId) {
          const resolved = await resolveUserIdByShop(shop, shopGid);
          if (!resolved) {
            console.warn("❌ Cannot resolve userId for one-time by shop", { shop, shopGid });
            return new Response("User not found for shop", { status: 404 });
          }
          userId = resolved;
        }

        await db.payment.upsert({
          where: { shopifyPurchaseGid: oneTimeGid },
          update: {
            status,
            currency,
            amountCents,
          },
          create: {
            userId,
            provider: "SHOPIFY",
            shopifyPurchaseGid: oneTimeGid,
            shopifyShopGid: shopGid,
            amountCents,
            currency,
            status,
            paidAt: new Date(),
            createdAt: new Date(),
          },
        });

        break;
      }

      default:
        console.log("⚠️ Unhandled topic:", topic);
        break;
    }

    console.log("User ID:", userId);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Shopify Webhook error:", err);
    return new Response("Webhook error", { status: 500 });
  }
};
